// 🧪 Tests du serveur (sécurité, sauvegarde des données, mails) — avec une fausse base, rien ne sort.
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { demarrer, appeler, etat, mailsIntercepte } from "./outils/fauxServeur.mjs";
import { RACINE } from "./outils/compiler.mjs";
import { ADMIN, SECRETS, baseDeTest } from "./outils/donnees.mjs";

let serveur;
before(async () => { serveur = await demarrer(); });
beforeEach(() => { etat.base = baseDeTest(); etat.ecritures = 0; etat.appelsExterieurs = []; });
// Garantie globale : aucun appel n'est jamais parti vers un vrai service
after(() => { assert.ok(globalThis.fetch.name === "fauxFetch", "le réseau doit rester intercepté"); });

const source = fs.readFileSync(path.join(RACINE, "supabase/functions/public-api/index.ts"), "utf8");
const actionsAdmin = [...new Set([...source.matchAll(/action === "(admin_[a-z_]+)"/g)].map((m) => m[1]))];
// Actions sans « admin_ » dans le nom mais qui doivent être réservées (bureau, tâches automatiques, paiement)
const actionsReservees = [
  "check_reminders", "cleanup_expired", "cron_send_scheduled_drafts", "send_backup_email", "check_backup_email",
  "notify_membres", "notify_new_season", "notify_new_poll", "notify_engagement_open", "send_report_to_members",
  "sync_sheets", "mark_paid", "toggle_presentation", "clear_email_history", "delete_email_log", "interclub_save",
];

function sansSecret(texte, contexte) {
  for (const s of SECRETS) assert.ok(!texte.includes(s), `${contexte} : « ${s} » ne doit pas apparaître`);
}

// ─── Partie publique ───

test("le site public ne montre aucune donnée privée (emails, téléphones, codes, factures, journal, lien WhatsApp)", async () => {
  const r = await appeler({ action: "fetch_public" });
  assert.equal(r.status, 200);
  sansSecret(r.texte, "fetch_public");
  assert.equal(r.json.membresCount, 3);
  assert.equal(r.json.whatsappEnabled, true);
  assert.deepEqual(r.json.actualites.map((a) => a.id), ["a1"], "les actus réservées aux adhérents ne sont pas publiques");
  assert.equal(r.json.polls[0].votes, undefined, "on ne voit pas qui a voté quoi");
  assert.equal(r.json.polls[0].totalVotes, 1);
});

// ─── Accès admin ───

test(`les ${actionsAdmin.length} actions admin refusent quelqu'un qui n'est pas connecté`, async () => {
  assert.ok(actionsAdmin.length > 20, "liste des actions admin introuvable");
  for (const action of actionsAdmin) {
    const r = await appeler({ action });
    assert.notEqual(r.json?.ok, true, `${action} a répondu ok sans connexion`);
    sansSecret(r.texte, action);
  }
  assert.equal(etat.ecritures, 0, "aucune action non connectée ne doit modifier la base");
  assert.deepEqual(mailsIntercepte(), [], "aucun mail ne doit être préparé");
});

test("les actions admin refusent un faux code", async () => {
  for (const action of actionsAdmin) {
    const r = await appeler({ action, email: "intrus@exemple.fr", code: "mauvais", adminEmail: "intrus@exemple.fr", adminCode: "mauvais", data: { membres: [] } });
    assert.notEqual(r.json?.ok, true, `${action} a accepté un faux code`);
    sansSecret(r.texte, action);
  }
  // Seule écriture permise : la note « requête bloquée » du Journal (le compte de l'intrus est bloqué)
  const { _rev: _a, securiteBlocages: _b, ...apres } = etat.base;
  const { _rev: _c, securiteBlocages: _d, ...avant } = baseDeTest();
  assert.deepEqual(apres, avant, "les données du club n'ont pas changé");
  assert.deepEqual(mailsIntercepte(), []);
});

test("les actions réservées (tâches automatiques, envois groupés, paiements) refusent sans secret", async () => {
  for (const action of actionsReservees) {
    const r = await appeler({ action, secret: "mauvais", email: "intrus@exemple.fr", code: "mauvais" });
    sansSecret(r.texte, action);
  }
  assert.equal(etat.ecritures, 0, "la base n'a pas été modifiée");
  assert.deepEqual(mailsIntercepte(), [], "aucun mail n'a été préparé");
});

test("un admin avec le bon code accède à l'admin, sans voir les codes chiffrés ni le journal du propriétaire", async () => {
  const r = await appeler({ action: "admin_fetch", email: ADMIN.email, code: ADMIN.code });
  assert.equal(r.json?.ok, true, r.texte);
  const admin = r.json.data.membres.find((m) => m.id === "m-admin");
  assert.equal(admin.code, "", "le code chiffré est masqué");
  assert.equal(r.json.data.adminJournal, undefined, "le journal est réservé au propriétaire");
  assert.equal(r.json.data.securiteBlocages, undefined, "les requêtes bloquées sont réservées au propriétaire");
});

// ─── Ne rien perdre ───

test("enregistrer depuis l'admin garde les codes, le journal et les requêtes bloquées", async () => {
  const { json } = await appeler({ action: "admin_fetch", email: ADMIN.email, code: ADMIN.code });
  const vue = json.data;
  const modifiee = { ...structuredClone(vue), quota: 70, adminJournal: [], securiteBlocages: [] };
  const r = await appeler({ action: "admin_save", email: ADMIN.email, code: ADMIN.code, data: modifiee, base: vue });
  assert.equal(r.json?.ok, true, r.texte);
  const b = etat.base;
  assert.equal(b.quota, 70);
  assert.equal(b.membres.length, 3, "aucun adhérent perdu");
  for (const m of b.membres) assert.ok(String(m.code).length > 10, `code de ${m.nom} conservé et chiffré`);
  assert.ok(JSON.stringify(b.securiteBlocages).includes("BLOCAGE-SECRET"), "le client ne peut pas effacer les blocages");
  assert.ok(JSON.stringify(b.adminJournal).includes("JOURNAL-SECRET"), "l'ancien journal est gardé");
  assert.ok(b.adminJournal.length >= 2, "la modification est notée dans le journal");
  assert.equal(b.factures.length, 1);
});

test("deux admins qui enregistrent en même temps : aucune modification n'efface l'autre", async () => {
  const { json } = await appeler({ action: "admin_fetch", email: ADMIN.email, code: ADMIN.code });
  const vue = json.data;
  const nouveau = (id, nom) => ({ id, nom, email: id + "@exemple.fr", tel: "0600000000", code: "Code" + id, type: "Adulte", ok: true, date: "2026-10-10" });
  const a = { ...structuredClone(vue), membres: [...structuredClone(vue.membres), nouveau("m-lea", "Léa")] };
  const b = { ...structuredClone(vue), membres: [...structuredClone(vue.membres), nouveau("m-tom", "Tom")], quota: 80 };
  const [ra, rb] = await Promise.all([
    appeler({ action: "admin_save", email: ADMIN.email, code: ADMIN.code, data: a, base: vue }),
    appeler({ action: "admin_save", email: ADMIN.email, code: ADMIN.code, data: b, base: vue }),
  ]);
  assert.equal(ra.json?.ok, true, ra.texte);
  assert.equal(rb.json?.ok, true, rb.texte);
  const ids = etat.base.membres.map((m) => m.id).sort();
  assert.deepEqual(ids, ["m-admin", "m-lea", "m-marie", "m-paul", "m-tom"]);
  assert.equal(etat.base.quota, 80);
});

test("fusion des modifications : ajouts et suppressions des deux côtés conservés", () => {
  const base = { membres: [{ id: "1", nom: "A" }, { id: "2", nom: "B" }], quota: 65, titre: "x" };
  const moi = { membres: [{ id: "1", nom: "A modifié" }, { id: "2", nom: "B" }, { id: "3", nom: "C" }], quota: 65, titre: "x" };
  const eux = { membres: [{ id: "1", nom: "A" }, { id: "4", nom: "D" }], quota: 70, titre: "x" }; // 2 supprimé, 4 ajouté
  const r = serveur.merge3(base, moi, eux);
  assert.deepEqual(r.membres.map((m) => m.id).sort(), ["1", "3", "4"]);
  assert.equal(r.membres.find((m) => m.id === "1").nom, "A modifié");
  assert.equal(r.quota, 70);
});

// ─── Inscriptions et mails ───

test("une inscription enregistre l'adhérent avec un code chiffré, et le mail est préparé pour lui seul (jamais envoyé)", async () => {
  const r = await appeler({ action: "add_membre", nom: "Nina Nouvelle", email: "nina@exemple.fr", tel: "0633445566", type: "Adulte", paymentMethod: "virement", code: "CodeNina1" });
  assert.equal(r.json?.ok, true, r.texte);
  const nina = etat.base.membres.find((m) => m.email === "nina@exemple.fr");
  assert.ok(nina, "adhérente ajoutée");
  assert.equal(nina.ok, false, "en attente de paiement");
  assert.ok(!JSON.stringify(nina).includes("CodeNina1"), "le code n'est jamais stocké en clair");
  assert.equal(etat.base.membres.length, 4, "les autres adhérents sont toujours là");
  for (const mail of mailsIntercepte()) {
    const dest = JSON.stringify(mail.to ?? mail);
    assert.ok(dest.includes("nina@exemple.fr") || !dest.includes("@exemple.fr"), "le mail ne part qu'à la nouvelle adhérente");
    sansSecret(JSON.stringify(mail), "mail d'inscription");
  }
});

test("on ne peut pas réinscrire par-dessus un adhérent déjà à jour", async () => {
  const r = await appeler({ action: "add_membre", nom: "Faux Marie", email: "marie.secrete@exemple.fr", tel: "0600000000", type: "Adulte", code: "Pirate123" });
  assert.notEqual(r.json?.ok, true);
  assert.equal(etat.base.membres.find((m) => m.id === "m-marie").code, "CodeMarieXy", "le code de Marie n'a pas changé");
});

// ─── Protection contre les rafales de requêtes ───

test("trop de requêtes depuis la même adresse sont bloquées", async () => {
  const statuts = [];
  for (let i = 0; i < 130; i++) statuts.push((await appeler({ action: "interclub_get", token: "inconnu" }, "203.0.113.9")).status);
  assert.ok(statuts.includes(429), "le blocage doit se déclencher");
  assert.ok(statuts.slice(0, 100).every((s) => s !== 429), "une utilisation normale n'est pas bloquée");
});
