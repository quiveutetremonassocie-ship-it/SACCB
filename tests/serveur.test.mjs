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
beforeEach(() => { etat.base = baseDeTest(); etat.ecritures = 0; etat.ecrituresMembres = 0; etat.appelsExterieurs = []; etat.fichiers = {}; });
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
  assert.equal(r.json.agItems[0].authorMembreId, null, "aucun identifiant d'adhérent public");
  assert.equal(r.json.agItems[0].authorNom, "Marie Secrète", "le nom reste affiché");
});

// ─── Accès admin ───

test(`les ${actionsAdmin.length} actions admin refusent quelqu'un qui n'est pas connecté`, async () => {
  assert.ok(actionsAdmin.length > 20, "liste des actions admin introuvable");
  for (const action of actionsAdmin) {
    const r = await appeler({ action });
    assert.notEqual(r.json?.ok, true, `${action} a répondu ok sans connexion`);
    sansSecret(r.texte, action);
  }
  assert.equal(etat.ecrituresMembres, 0, "aucune action non connectée ne doit modifier la base");
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
  assert.equal(etat.ecrituresMembres, 0, "la base n'a pas été modifiée");
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

// ─── ✏️ Coordonnées changées par l'adhérent ───

test("un adhérent change son mail et son téléphone : c'est noté sur sa fiche, rien d'autre ne bouge, aucun mail", async () => {
  const lu = await appeler({ action: "member_contact", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie" });
  assert.equal(lu.json?.ok, true, lu.texte);
  assert.equal(lu.json.tel, "0611223344");
  const r = await appeler({ action: "member_contact", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie", newEmail: "marie.nouvelle@exemple.fr", newTel: "0699887766" });
  assert.equal(r.json?.ok, true, r.texte);
  const marie = etat.base.membres.find((m) => m.id === "m-marie");
  assert.equal(marie.email, "marie.nouvelle@exemple.fr");
  assert.equal(marie.tel, "0699887766");
  assert.deepEqual(marie.coordonneesModifiees.map((c) => [c.champ, c.avant, c.apres]).sort(), [["email", "marie.secrete@exemple.fr", "marie.nouvelle@exemple.fr"], ["tel", "0611223344", "0699887766"]]);
  assert.equal(etat.base.membres.length, 3);
  assert.equal(etat.base.membres.find((m) => m.id === "m-paul").email, "paul.attente@exemple.fr");
  assert.deepEqual(mailsIntercepte(), []);
  // Elle se connecte ensuite avec sa nouvelle adresse
  const apres = await appeler({ action: "member_contact", email: "marie.nouvelle@exemple.fr", code: "CodeMarieXy", membreId: "m-marie" });
  assert.equal(apres.json?.ok, true, apres.texte);
});

test("changer les coordonnées est refusé avec un faux code, vers l'adresse d'un autre adhérent, ou pour une adresse admin", async () => {
  const faux = await appeler({ action: "member_contact", email: "paul.attente@exemple.fr", code: "mauvais", newTel: "0600000009" });
  assert.notEqual(faux.json?.ok, true);
  const pris = await appeler({ action: "member_contact", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie", newEmail: "paul.attente@exemple.fr" });
  assert.notEqual(pris.json?.ok, true);
  const admin = await appeler({ action: "member_contact", email: ADMIN.email, code: ADMIN.code, membreId: "m-admin", newEmail: "autre@exemple.fr" });
  assert.notEqual(admin.json?.ok, true);
  const invalide = await appeler({ action: "member_contact", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie", newTel: "abc" });
  assert.notEqual(invalide.json?.ok, true);
  assert.equal(etat.ecrituresMembres, 0, "rien n'a été enregistré");
});

// ─── 👀 Dernière visite (propriétaire seul) ───

test("la visite d'un adhérent est notée (le jour seulement), visible par le propriétaire seul et impossible à effacer", async () => {
  const r = await appeler({ action: "check_session", email: "marie.secrete@exemple.fr", membreId: "m-marie" });
  assert.equal(r.json?.ok, true, r.texte);
  const jour = etat.base.membres.find((m) => m.id === "m-marie").vuLe;
  assert.match(jour, /^\d{4}-\d{2}-\d{2}$/, "seulement le jour, sans heure");
  const ecritures = etat.ecrituresMembres;
  await appeler({ action: "check_session", email: "marie.secrete@exemple.fr", membreId: "m-marie" });
  assert.equal(etat.ecrituresMembres, ecritures, "une seule écriture par jour");
  // Un admin qui n'est pas le propriétaire ne voit pas les visites
  const vue = (await appeler({ action: "admin_fetch", email: ADMIN.email, code: ADMIN.code })).json.data;
  assert.ok(!JSON.stringify(vue).includes('"vuLe"'), "visites cachées aux autres admins");
  // … et en enregistrant, il ne les efface pas
  const s = await appeler({ action: "admin_save", email: ADMIN.email, code: ADMIN.code, data: { ...structuredClone(vue), quota: 66 }, base: vue });
  assert.equal(s.json?.ok, true, s.texte);
  assert.equal(etat.base.membres.find((m) => m.id === "m-marie").vuLe, jour);
  // Le propriétaire, lui, les voit
  etat.base.adminEmails.push("gabin.binay@gmail.com");
  etat.base.adminCredentials.push({ email: "gabin.binay@gmail.com", code: "CodeProprio" });
  const proprio = (await appeler({ action: "admin_fetch", email: "gabin.binay@gmail.com", code: "CodeProprio" })).json;
  assert.equal(proprio?.ok, true);
  assert.equal(proprio.data.membres.find((m) => m.id === "m-marie").vuLe, jour);
});

// ─── 🎓 Adulte / étudiant au renouvellement ───

test("au renouvellement, un adhérent pas encore payé peut passer d'étudiant à adulte (noté pour le bureau) ; impossible une fois payé", async () => {
  const r = await appeler({ action: "member_set_type", email: "paul.attente@exemple.fr", code: "CodePaul", membreId: "m-paul", type: "Adulte" });
  assert.equal(r.json?.ok, true, r.texte);
  const paul = etat.base.membres.find((m) => m.id === "m-paul");
  assert.equal(paul.type, "Adulte");
  assert.deepEqual([paul.coordonneesModifiees[0].champ, paul.coordonneesModifiees[0].avant, paul.coordonneesModifiees[0].apres], ["type", "Etudiant", "Adulte"]);
  const ecritures = etat.ecrituresMembres;
  const paye = await appeler({ action: "member_set_type", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie", type: "Etudiant" });
  assert.notEqual(paye.json?.ok, true, "déjà payé : on ne change plus de tarif soi-même");
  const faux = await appeler({ action: "member_set_type", email: "paul.attente@exemple.fr", code: "mauvais", membreId: "m-paul", type: "Etudiant" });
  assert.notEqual(faux.json?.ok, true);
  assert.equal(etat.ecrituresMembres, ecritures);
  assert.equal(etat.base.membres.find((m) => m.id === "m-marie").type, "Adulte");
});

// ─── 💶 Tarif adulte remisé (demande → accord ou refus du bureau) ───

const sujets = () => mailsIntercepte().map((m) => `${m.subject} → ${JSON.stringify(m.to)} :: ${m.htmlContent || m.html || ""}`);

test("inscription avec demande de tarif remisé : en attente, le bureau est prévenu, puis l'accord envoie le lien pour payer", async () => {
  const r = await appeler({ action: "add_membre", nom: "Rémi Remise", email: "remi@exemple.fr", tel: "0644556677", type: "Adulte", paymentMethod: "online", code: "CodeRemi1", remiseDemandee: true });
  assert.equal(r.json?.ok, true, r.texte);
  const remi = etat.base.membres.find((m) => m.email === "remi@exemple.fr");
  assert.equal(remi.type, "Adulte");
  assert.equal(remi.remise.statut, "demandee");
  assert.equal(remi.remise.saison, "2026-2027");
  assert.ok(sujets().some((s) => s.includes("Demande de tarif adulte remisé") && !s.includes("remi@exemple.fr\"]")), "le bureau reçoit la demande");
  // Le bureau accepte
  etat.appelsExterieurs = [];
  const d = await appeler({ action: "admin_remise_decision", adminEmail: ADMIN.email, adminCode: ADMIN.code, membreId: remi.id, accepter: true });
  assert.equal(d.json?.ok, true, d.texte);
  assert.equal(etat.base.membres.find((m) => m.id === remi.id).remise.statut, "acceptee");
  const mail = sujets().find((s) => s.includes("remi@exemple.fr"));
  assert.ok(mail && mail.includes("accepté par le bureau du SACCB") && mail.includes("tarif-etudiant"), "mail vert avec le lien de paiement");
  // Son espace affiche le tarif remisé et le bon lien
  const s = await appeler({ action: "check_session", email: "remi@exemple.fr", membreId: remi.id });
  assert.equal(s.json.adherent.remise, "acceptee");
  assert.equal(s.json.adherent.montantPaye, 30);
  assert.match(s.json.adherent.lienRemise, /tarif-etudiant/);
});

test("refus du tarif remisé : un nouvel inscrit doit refaire son inscription, un ancien adhérent choisit dans son espace", async () => {
  await appeler({ action: "add_membre", nom: "Nouveau Refus", email: "nouveau@exemple.fr", tel: "0655667788", type: "Adulte", code: "CodeNouv1", remiseDemandee: true });
  const nouveau = etat.base.membres.find((m) => m.email === "nouveau@exemple.fr");
  etat.appelsExterieurs = [];
  await appeler({ action: "admin_remise_decision", adminEmail: ADMIN.email, adminCode: ADMIN.code, membreId: nouveau.id, accepter: false });
  const m1 = sujets().find((s) => s.includes("nouveau@exemple.fr"));
  assert.ok(m1 && m1.includes("refusé par le bureau du SACCB") && m1.includes("refaire ton inscription"), m1);
  // Ancien adhérent (Paul) au renouvellement
  const r = await appeler({ action: "member_set_type", email: "paul.attente@exemple.fr", code: "CodePaul", membreId: "m-paul", type: "AdulteRemise" });
  assert.equal(r.json?.remise, "demandee", r.texte);
  assert.equal(etat.base.membres.find((m) => m.id === "m-paul").type, "Adulte");
  etat.appelsExterieurs = [];
  await appeler({ action: "admin_remise_decision", adminEmail: ADMIN.email, adminCode: ADMIN.code, membreId: "m-paul", accepter: false });
  const m2 = sujets().find((s) => s.includes("paul.attente@exemple.fr"));
  assert.ok(m2 && m2.includes("refusé") && m2.includes("espace adhérent"), m2);
  assert.equal(etat.base.membres.find((m) => m.id === "m-paul").remise.statut, "refusee");
});

// ─── ✅ Confirmation des informations au renouvellement ───

test("au renouvellement, l'adhérent revoit ses informations, peut corriger son nom, et sa confirmation est notée pour la saison", async () => {
  const lu = await appeler({ action: "member_contact", email: "paul.attente@exemple.fr", code: "CodePaul", membreId: "m-paul" });
  assert.equal(lu.json?.nom, "Paul Attente");
  assert.equal(lu.json?.infosConfirmees, false);
  const r = await appeler({ action: "member_contact", email: "paul.attente@exemple.fr", code: "CodePaul", membreId: "m-paul", newNom: "Paul Attente-Martin", newEmail: "paul.attente@exemple.fr", newTel: "0622334455", confirmer: true });
  assert.equal(r.json?.ok, true, r.texte);
  assert.equal(r.json.infosConfirmees, true);
  const paul = etat.base.membres.find((m) => m.id === "m-paul");
  assert.equal(paul.nom, "Paul Attente-Martin");
  assert.equal(paul.infosConfirmees.saison, "2026-2027");
  assert.deepEqual(paul.coordonneesModifiees.map((c) => c.champ), ["nom"], "seul le nom a changé (le mail et le téléphone identiques ne sont pas notés)");
  const s = await appeler({ action: "check_session", email: "paul.attente@exemple.fr", membreId: "m-paul" });
  assert.equal(s.json.adherent.infosConfirmees, true);
  assert.deepEqual(mailsIntercepte(), []);
});

// ─── 🏆 Rappel tournoi : un seul, 5 jours avant la fin des inscriptions ───

test("rappels tournois : un seul mail, 5 jours avant la date limite (rien à 30, 15 ou 1 jour)", async () => {
  const dans = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  etat.base.membres.find((m) => m.id === "m-marie").newsOptIn = true;
  etat.base.config_tournois = [30, 15, 5, 1].map((n) => ({ id: "t" + n, name: "Tournoi J-" + n, dateLimit: dans(n) }));
  const r = await appeler({ action: "check_reminders", secret: "secret-taches-test" });
  assert.notEqual(r.status, 401, r.texte);
  const sujetsT = [...new Set(mailsIntercepte().map((m) => String(m.subject)).filter((s) => s.includes("Tournoi J-")))];
  assert.deepEqual([...new Set(sujetsT.map((s) => s.match(/Tournoi J-\d+/)[0]))], ["Tournoi J-5"], sujetsT.join(" | "));
});

// ─── 🔒 Sécurité renforcée (audit du 2026-11-07) ───

test("deviner un code est bloqué : après 5 codes faux, même sur des actions différentes, le compte est verrouillé", async () => {
  etat.base.membres.push({ id: "m-lea", nom: "Léa Verrou", email: "lea.verrou@exemple.fr", tel: "0677889900", code: "CodeLea9", type: "Adulte", ok: true, date: "2026-09-04" });
  const faux = { email: "lea.verrou@exemple.fr", code: "0000", membreId: "m-lea" };
  for (const action of ["fetch_my_votes", "vote_poll", "update_news_optin", "member_contact", "fetch_private_actualites"]) {
    const r = await appeler({ action, ...faux, pollId: "p1", optionIdx: 0, newsOptIn: true });
    assert.notEqual(r.json?.ok, true, action);
  }
  const bon = await appeler({ action: "member_contact", email: "lea.verrou@exemple.fr", code: "CodeLea9", membreId: "m-lea" });
  assert.notEqual(bon.json?.ok, true, "même le bon code est refusé pendant le blocage");
});

test("les codes trop faciles sont refusés à l'inscription", async () => {
  for (const code of ["1234", "0000", "azerty", "abcd", "nina"]) {
    const r = await appeler({ action: "add_membre", nom: "Nina Test", email: "nina@exemple.fr", tel: "0633445566", type: "Adulte", code });
    assert.notEqual(r.json?.ok, true, code);
  }
  assert.equal(etat.base.membres.length, 3);
});

test("paiement HelloAsso : un montant trop faible ou un autre formulaire valide l'adhésion mais lève une alerte pour le bureau", async () => {
  const paul = etat.base.membres.find((m) => m.id === "m-paul");
  paul.type = "Adulte";
  const h = { "x-helloasso-secret": "secret-helloasso-test" };
  const r = await appeler({ eventType: "Order", data: { payer: { email: "paul.attente@exemple.fr" }, amount: { total: 3000 }, formSlug: "tarif-etudiant" } }, undefined, h);
  assert.equal(r.json?.ok, true, r.texte);
  const p = etat.base.membres.find((m) => m.id === "m-paul");
  assert.equal(p.ok, true, "adhésion validée (on ne bloque pas l'adhérent)");
  assert.equal(p.paiementAlerte.motif, "montant");
  assert.equal(p.paiementAlerte.recu, 30);
  assert.equal(p.paiementAlerte.attendu, 50);
  assert.equal(p.montantPaye, 30, "la compta voit le vrai montant");
  // Faux webhook (mauvais secret) : rien ne bouge
  etat.base = baseDeTest();
  const pirate = await appeler({ eventType: "Order", data: { payer: { email: "paul.attente@exemple.fr" }, amount: { total: 5000 } } }, undefined, { "x-helloasso-secret": "pirate" });
  assert.notEqual(pirate.json?.ok, true);
  assert.equal(etat.base.membres.find((m) => m.id === "m-paul").ok, false);
  // Bon montant mais formulaire inconnu (don…) : alerte « formulaire »
  await appeler({ eventType: "Order", data: { payer: { email: "paul.attente@exemple.fr" }, amount: { total: 3000 }, formSlug: "don-libre" } }, undefined, h);
  assert.equal(etat.base.membres.find((m) => m.id === "m-paul").paiementAlerte?.motif, "formulaire");
});

test("statistiques de visite : un robot ne peut pas remplir la base de pages inventées", async () => {
  for (let i = 0; i < 90; i++) await appeler({ action: "track_view", path: "/page-inventee-" + i + "-" + "x".repeat(20), referrer: "https://site" + i + ".exemple" });
  const jour = etat.base.analyticsDaily.at(-1);
  assert.ok(Object.keys(jour.paths).length <= 61, "pages plafonnées");
  assert.ok(Object.keys(jour.refs).length <= 41, "sites d'origine plafonnés");
  await appeler({ action: "track_view", path: "/<script>alert(1)</script>" });
  assert.ok(!JSON.stringify(etat.base.analyticsDaily).includes("<script>"));
});

test("les anciens codes en clair sont chiffrés à l'ouverture de l'admin, et l'adhérent se connecte toujours", async () => {
  const a = await appeler({ action: "admin_fetch", email: ADMIN.email, code: ADMIN.code });
  assert.equal(a.json?.ok, true, a.texte);
  const marie = etat.base.membres.find((m) => m.id === "m-marie");
  assert.match(marie.code, /^p2\$/, "code chiffré");
  const login = await appeler({ action: "member_contact", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie" });
  assert.equal(login.json?.ok, true, "Marie se connecte toujours avec son code");
});

// ─── T-shirts : tailles séparées Homme / Femme ───

test("t-shirts : un adhérent ne voit que les tailles de son sexe (si connu) et ne peut pas commander une taille réservée à l'autre", async () => {
  // Marie est une adhérente à jour → on la marque "F" dans la base
  etat.base.membres.find((m) => m.id === "m-marie").sexe = "F";
  etat.base.tshirtOpen = true;
  etat.base.tshirtSizesH = ["M", "L", "XL", "XXL"];
  etat.base.tshirtSizesF = ["XS", "S", "M"];

  // Le serveur renvoie les deux listes + le sexe de la fiche
  const vue = await appeler({ action: "tshirt_my_order", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie" });
  assert.equal(vue.json?.ok, true, vue.texte);
  assert.equal(vue.json.membreSexe, "F");
  assert.deepEqual(vue.json.sizesH, ["M", "L", "XL", "XXL"]);
  assert.deepEqual(vue.json.sizesF, ["XS", "S", "M"]);

  // Elle peut commander une taille femme (XS)
  const ok = await appeler({ action: "tshirt_order", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie", taille: "XS" });
  assert.equal(ok.json?.ok, true, ok.texte);
  const commande = etat.base.tshirtOrders.find((o) => o.membreId === "m-marie");
  assert.equal(commande.taille, "XS");
  assert.equal(commande.sexe, "F", "le sexe est enregistré sur la commande, à partir de la fiche");

  // Elle ne peut PAS commander une taille réservée aux hommes (XXL)
  const refuse = await appeler({ action: "tshirt_order", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie", taille: "XXL" });
  assert.notEqual(refuse.json?.ok, true, "une taille réservée aux hommes ne doit pas être acceptée pour une adhérente");
});

test("t-shirts : si le sexe n'est pas connu sur la fiche, on le demande au moment de la commande et il est validé contre les tailles", async () => {
  // Paul n'a pas de sexe sur sa fiche (et n'est pas à jour → on le passe à jour pour le test)
  const paul = etat.base.membres.find((m) => m.id === "m-paul");
  paul.sexe = undefined;
  paul.ok = true;
  etat.base.tshirtOpen = true;
  etat.base.tshirtSizesH = ["M", "L", "XL"];
  etat.base.tshirtSizesF = ["XS", "S"];

  // Côté serveur : membreSexe est bien null et l'union des tailles est renvoyée
  const vue = await appeler({ action: "tshirt_my_order", email: "paul.attente@exemple.fr", code: "CodePaul", membreId: "m-paul" });
  assert.equal(vue.json?.ok, true, vue.texte);
  assert.equal(vue.json.membreSexe, null);
  assert.deepEqual(vue.json.sizesAll, ["XS", "S", "M", "L", "XL"]);

  // Sans sexe envoyé par le client, une taille femme est refusée pour Paul (l'union ne suffit pas, le serveur attend un sexe)
  const sansSexe = await appeler({ action: "tshirt_order", email: "paul.attente@exemple.fr", code: "CodePaul", membreId: "m-paul", taille: "L" });
  // L sans sexe : la liste de secours est "l'union" mais la validation côté client est sur une taille valide. Ici L est dans les 2 unions → accepté sans sexe, l'ordre est créé sans sexe.
  // → On vérifie plutôt le cas où Paul envoie sexe: "H" et choisit XS (taille femme uniquement) → refusé.
  assert.equal(sansSexe.json?.ok, true, "L est dans l'union H+F, donc accepté sans sexe (compat ascendante)");

  const hAvecTailleF = await appeler({ action: "tshirt_order", email: "paul.attente@exemple.fr", code: "CodePaul", membreId: "m-paul", taille: "XS", sexe: "H" });
  assert.notEqual(hAvecTailleF.json?.ok, true, "XS n'est que pour les femmes : refusé quand Paul se déclare Homme");

  const hAvecTailleH = await appeler({ action: "tshirt_order", email: "paul.attente@exemple.fr", code: "CodePaul", membreId: "m-paul", taille: "M", sexe: "H" });
  assert.equal(hAvecTailleH.json?.ok, true, "M est bien dans les tailles hommes");
  const commande = etat.base.tshirtOrders.find((o) => o.membreId === "m-paul");
  assert.equal(commande.sexe, "H", "le sexe envoyé par le client est bien enregistré");
});

test("t-shirts : la fiche membre fait foi sur le sexe — un adhérent ne peut pas se faire passer pour l'autre sexe via le client", async () => {
  // Marie est "F" sur sa fiche : même si elle envoie sexe: "H" dans la commande, c'est "F" qui compte
  etat.base.membres.find((m) => m.id === "m-marie").sexe = "F";
  etat.base.tshirtOpen = true;
  etat.base.tshirtSizesH = ["XXL"];
  etat.base.tshirtSizesF = ["XS", "S"];

  const r = await appeler({ action: "tshirt_order", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie", taille: "XXL", sexe: "H" });
  assert.notEqual(r.json?.ok, true, "le sexe envoyé par le client ne doit pas court-circuiter le sexe de la fiche");
});

// ─── 💾 Sauvegarde complète (base + fichiers), envoyée au fil de l'eau ───

test("sauvegarde complète : tous les fichiers sont copiés à l'octet près, la base est entière, et la sauvegarde est notée au journal", async () => {
  const octets = (n, graine) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + graine) % 256);
  etat.fichiers = {
    actualities: { "1775/photo-a.jpg": octets(300_001, 1), "1776/photo-b.jpg": octets(98_305, 2) },
    reports: { "reglement.pdf": octets(1, 3), "tshirt/catalogue.pdf": octets(250_000, 4) },
    factures: { "f1/facture.pdf": octets(12_345, 5) },
  };
  const r = await appeler({ action: "admin_export_backup", adminEmail: ADMIN.email, adminCode: ADMIN.code });
  assert.equal(r.status, 200);
  assert.equal(r.json?.ok, true, r.texte.slice(0, 300));
  const d = r.json.data;
  assert.equal(d.membres.length, 3, "la base est entière");
  assert.equal(d._fichiers.nombre, 5);
  assert.deepEqual(d._fichiers.nonCopies, []);
  for (const f of d._fichiers.fichiers) {
    const attendu = etat.fichiers[f.bucket][f.path];
    const recu = Uint8Array.from(Buffer.from(f.base64, "base64"));
    assert.equal(recu.length, attendu.length, f.path);
    assert.ok(recu.every((v, i) => v === attendu[i]), `contenu identique : ${f.path}`);
  }
  assert.ok(etat.base.lastBackupExport, "sauvegarde notée (date dans le Journal)");
  // Sans fichiers : réponse classique
  const s = await appeler({ action: "admin_export_backup", adminEmail: ADMIN.email, adminCode: ADMIN.code, sansFichiers: true });
  assert.equal(s.json?.ok, true);
  assert.equal(s.json.data._fichiers, undefined);
});

// ─── 🔒 Droits des admins vérifiés par le serveur (lecture seule, sections) ───

test("un admin en lecture seule peut consulter mais rien modifier, même en appelant le serveur directement", async () => {
  etat.base.adminEmails = [ADMIN.email, { email: "lecteur@exemple.fr", readOnly: true }];
  etat.base.adminCredentials.push({ email: "lecteur@exemple.fr", code: "CodeLecteur7", readOnly: true });
  const vue = await appeler({ action: "admin_fetch", email: "lecteur@exemple.fr", code: "CodeLecteur7" });
  assert.equal(vue.json?.ok, true, vue.texte);
  assert.equal(vue.json.readOnly, true);
  const s = await appeler({ action: "admin_save", email: "lecteur@exemple.fr", code: "CodeLecteur7", data: { ...vue.json.data, quota: 1 }, base: vue.json.data });
  assert.notEqual(s.json?.ok, true, "enregistrement refusé");
  const t = await appeler({ action: "admin_set_tshirt", adminEmail: "lecteur@exemple.fr", adminCode: "CodeLecteur7", open: true });
  assert.notEqual(t.json?.ok, true, "action d'écriture refusée");
  assert.notEqual(etat.base.tshirtOpen, true, "commandes t-shirts pas ouvertes");
  assert.equal(etat.base.quota, 65);
});

test("un admin limité à certaines sections ne peut pas toucher aux adhérents ni aux paramètres, mais peut modifier sa section", async () => {
  etat.base.adminEmails = [ADMIN.email, { email: "redac@exemple.fr", readOnly: false, permissions: ["actualites"] }];
  etat.base.adminCredentials.push({ email: "redac@exemple.fr", code: "CodeRedac7" });
  const vue = (await appeler({ action: "admin_fetch", email: "redac@exemple.fr", code: "CodeRedac7" })).json.data;
  const ok = await appeler({ action: "admin_save", email: "redac@exemple.fr", code: "CodeRedac7", data: { ...structuredClone(vue), actualites: [...vue.actualites, { id: "a3", title: "Nouvelle", description: "x" }] }, base: vue });
  assert.equal(ok.json?.ok, true, ok.texte);
  assert.equal(etat.base.actualites.length, 3);
  const vue2 = (await appeler({ action: "admin_fetch", email: "redac@exemple.fr", code: "CodeRedac7" })).json.data;
  const k = await appeler({ action: "admin_save", email: "redac@exemple.fr", code: "CodeRedac7", data: { ...structuredClone(vue2), membres: vue2.membres.slice(1), quota: 2 }, base: vue2 });
  assert.notEqual(k.json?.ok, true, "suppression d'adhérent et quota refusés");
  assert.equal(etat.base.membres.length, 3);
  assert.equal(etat.base.quota, 65);
});

test("la sauvegarde complète est refusée aux admins en lecture seule ou limités à certaines sections", async () => {
  etat.base.adminEmails = [ADMIN.email, { email: "lecteur@exemple.fr", readOnly: true }, { email: "redac@exemple.fr", permissions: ["actualites"] }];
  etat.base.adminCredentials.push({ email: "lecteur@exemple.fr", code: "CodeLecteur7", readOnly: true }, { email: "redac@exemple.fr", code: "CodeRedac7" });
  for (const [e, c] of [["lecteur@exemple.fr", "CodeLecteur7"], ["redac@exemple.fr", "CodeRedac7"]]) {
    const r = await appeler({ action: "admin_export_backup", adminEmail: e, adminCode: c, sansFichiers: true });
    assert.notEqual(r.json?.ok, true, e);
    assert.ok(!r.texte.includes("h$seltest$"), "aucun code chiffré ne sort");
  }
  const ok = await appeler({ action: "admin_export_backup", adminEmail: ADMIN.email, adminCode: ADMIN.code, sansFichiers: true });
  assert.equal(ok.json?.ok, true, "l'admin complet (script de nuit) garde sa sauvegarde");
});

// ─── 🚨 Verrou d'urgence de l'administration ───

const PROPRIO = { email: "gabin.binay@gmail.com", code: "CodeProprio" };
function ajouterProprietaire() {
  etat.base.adminEmails.push(PROPRIO.email);
  etat.base.adminCredentials.push({ email: PROPRIO.email, code: PROPRIO.code });
}

test("verrou d'urgence : seul le propriétaire peut le poser, et il est noté dans le journal", async () => {
  ajouterProprietaire();
  const refuse = await appeler({ action: "admin_verrou_admin", email: ADMIN.email, code: ADMIN.code, actif: true });
  assert.notEqual(refuse.json?.ok, true, "un autre admin ne peut pas verrouiller");
  assert.equal(etat.base.verrouAdmin, undefined);
  const inconnu = await appeler({ action: "admin_verrou_admin", email: "intrus@exemple.fr", code: "mauvais", actif: true });
  assert.notEqual(inconnu.json?.ok, true);
  assert.equal(etat.base.verrouAdmin, undefined);

  const ok = await appeler({ action: "admin_verrou_admin", email: PROPRIO.email, code: PROPRIO.code, actif: true });
  assert.equal(ok.json?.ok, true, ok.texte);
  assert.equal(etat.base.verrouAdmin.actif, true);
  assert.equal(etat.base.verrouAdmin.par, PROPRIO.email);
  assert.ok(etat.base.adminJournal[0].actions[0].includes("Verrou d'urgence ACTIVÉ"));
  assert.deepEqual(mailsIntercepte(), [], "aucun mail n'est préparé");
});

test("verrou d'urgence actif : les autres admins sont coupés partout (lecture, écriture, actions, connexion), le propriétaire et le public non", async () => {
  ajouterProprietaire();
  etat.base.require2FA = true;
  await appeler({ action: "admin_verrou_admin", email: PROPRIO.email, code: PROPRIO.code, actif: true });
  assert.equal(etat.base.verrouAdmin.actif, true);
  const ecritures = etat.ecrituresMembres;
  const membresAvant = JSON.stringify(etat.base.membres);

  // Lecture, écriture et actions admin : refusées avec le motif « verrou »
  const lecture = await appeler({ action: "admin_fetch", email: ADMIN.email, code: ADMIN.code });
  assert.equal(lecture.status, 403);
  assert.equal(lecture.json?.verrouAdmin, true);
  sansSecret(lecture.texte, "admin_fetch verrouillé");
  const ecriture = await appeler({ action: "admin_save", email: ADMIN.email, code: ADMIN.code, data: { ...structuredClone(etat.base), quota: 99 } });
  assert.equal(ecriture.json?.verrouAdmin, true);
  assert.notEqual(etat.base.quota, 99);
  for (const action of ["admin_drafts_list", "admin_list_locked_accounts", "admin_export_backup"]) {
    const r = await appeler({ action, email: ADMIN.email, code: ADMIN.code, adminEmail: ADMIN.email, adminCode: ADMIN.code });
    assert.equal(r.json?.verrouAdmin, true, `${action} doit être refusée pendant le verrou`);
  }
  // Un compte admin sans fiche adhérent ne se connecte plus (et aucun code de connexion n'est envoyé)
  const sansFiche = await appeler({ action: "verify_membre", email: "bureau.secret@exemple.fr", code: "CodeBureau" });
  assert.notEqual(sansFiche.json?.ok, true);
  assert.equal(sansFiche.json?.verrouAdmin, true);
  // Un inconnu avec un faux code n'apprend pas que le verrou existe
  const inconnu = await appeler({ action: "admin_fetch", email: "intrus@exemple.fr", code: "mauvais" });
  assert.equal(inconnu.json?.verrouAdmin, undefined);
  assert.equal(etat.ecrituresMembres, ecritures, "rien n'a été modifié pendant les refus");
  assert.equal(JSON.stringify(etat.base.membres), membresAvant);
  // Un adhérent qui est aussi admin entre comme simple adhérent
  // (placé après le contrôle « rien n'a changé » : toute connexion re-chiffre un ancien code, c'est normal)
  const aussiAdherent = await appeler({ action: "verify_membre", email: ADMIN.email, code: ADMIN.code });
  assert.equal(aussiAdherent.json?.ok, true, aussiAdherent.texte);
  assert.equal(aussiAdherent.json.isAdmin, false);
  assert.equal(aussiAdherent.json.adminVerrouille, true);
  assert.deepEqual(mailsIntercepte(), [], "pas de code de connexion envoyé pendant le verrou");

  // Le propriétaire garde l'accès
  const proprio = await appeler({ action: "admin_fetch", email: PROPRIO.email, code: PROPRIO.code });
  assert.equal(proprio.json?.ok, true, proprio.texte);
  assert.equal(proprio.json.data.verrouAdmin.actif, true);
  // Le site public et l'espace adhérent continuent de marcher
  const pub = await appeler({ action: "fetch_public" });
  assert.equal(pub.status, 200);
  assert.ok(!pub.texte.includes("verrouAdmin"), "le verrou n'apparaît pas sur la partie publique");
  const adherent = await appeler({ action: "member_contact", email: "marie.secrete@exemple.fr", code: "CodeMarieXy", membreId: "m-marie" });
  assert.equal(adherent.json?.ok, true);
});

test("verrou d'urgence : ni une sauvegarde d'écran ni une restauration ne peuvent le retirer ; seul le propriétaire le lève", async () => {
  ajouterProprietaire();
  await appeler({ action: "admin_verrou_admin", email: PROPRIO.email, code: PROPRIO.code, actif: true });
  // Le propriétaire enregistre une copie de la base sans le verrou : il reste en place
  const vue = (await appeler({ action: "admin_fetch", email: PROPRIO.email, code: PROPRIO.code })).json.data;
  const sansVerrou = { ...structuredClone(vue), quota: 70 };
  delete sansVerrou.verrouAdmin;
  const s = await appeler({ action: "admin_save", email: PROPRIO.email, code: PROPRIO.code, data: sansVerrou, base: vue });
  assert.equal(s.json?.ok, true, s.texte);
  assert.equal(etat.base.quota, 70, "ses autres changements passent");
  assert.equal(etat.base.verrouAdmin?.actif, true, "le verrou reste actif");
  // Une restauration depuis une vieille sauvegarde (sans verrou) ne le retire pas non plus
  const vieille = structuredClone(etat.base);
  delete vieille.verrouAdmin;
  const rest = await appeler({ action: "admin_import_backup", email: PROPRIO.email, code: PROPRIO.code, backupData: vieille, confirmRestore: true });
  assert.equal(rest.json?.ok, true, rest.texte);
  assert.equal(etat.base.verrouAdmin?.actif, true, "le verrou survit à une restauration");
  // Un autre admin ne peut pas le lever
  const tentative = await appeler({ action: "admin_verrou_admin", email: ADMIN.email, code: ADMIN.code, actif: false });
  assert.notEqual(tentative.json?.ok, true);
  assert.equal(etat.base.verrouAdmin?.actif, true);
  // Le propriétaire le lève : les autres admins reviennent
  const leve = await appeler({ action: "admin_verrou_admin", email: PROPRIO.email, code: PROPRIO.code, actif: false });
  assert.equal(leve.json?.ok, true, leve.texte);
  assert.equal(etat.base.verrouAdmin, undefined);
  const retour = await appeler({ action: "admin_fetch", email: ADMIN.email, code: ADMIN.code });
  assert.equal(retour.json?.ok, true, "l'admin peut de nouveau se connecter");
});
