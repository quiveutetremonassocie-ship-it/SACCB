// 🧪 Tests du classement mondial BWF + calendrier : lecture de Wikipédia (extraits réels), garde-fous, photos, tâche quotidienne.
// Aucune connexion réelle : la « Wikipédia » et le stockage sont simulés (tests/outils/fauxServeur.mjs).
import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { demarrer, appeler, etat } from "./outils/fauxServeur.mjs";
import { RACINE } from "./outils/compiler.mjs";
import { baseDeTest } from "./outils/donnees.mjs";

let serveur;
before(async () => { serveur = await demarrer(); });
beforeEach(() => { etat.base = baseDeTest(); etat.ecritures = 0; etat.appelsExterieurs = []; etat.fichiers = {}; etat.externe = null; });

const lireFixture = (nom) => fs.readFileSync(path.join(RACINE, "tests/fixtures", nom), "utf8");
const CLASSEMENT = lireFixture("bwf-classement.wiki");
const CALENDRIER_2026 = lireFixture("bwf-calendrier-2026.wiki");
const AUJOURDHUI = new Date("2026-11-24T08:00:00Z");

// ─── Lecture du classement ───

test("classement : les 5 disciplines sont lues (date, rangs 1-2-3, points qui descendent, 2 joueurs en double)", () => {
  const l = serveur.lireClassementBwf(CLASSEMENT);
  assert.deepEqual(l.erreurs, {});
  assert.deepEqual(Object.keys(l.disciplines).sort(), ["DD", "DH", "DM", "SD", "SH"]);
  for (const [id, d] of Object.entries(l.disciplines)) {
    assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/, `${id} : date`);
    assert.deepEqual(d.lignes.map((x) => x.rang), [1, 2, 3], `${id} : rangs`);
    assert.ok(d.lignes[0].points >= d.lignes[1].points && d.lignes[1].points >= d.lignes[2].points, `${id} : points décroissants`);
    const attendu = id.startsWith("S") ? 1 : 2;
    for (const x of d.lignes) {
      assert.equal(x.joueurs.length, attendu, `${id} : ${attendu} joueur(s) par ligne`);
      assert.equal(x.pages.length, attendu);
      assert.equal(x.pays.length, attendu);
    }
  }
  assert.equal(l.disciplines.SH.lignes[0].joueurs[0], "Christo Popov");
});

test("classement : une discipline douteuse est refusée sans abîmer les autres", () => {
  // date supprimée en simple hommes
  const sansDate = CLASSEMENT.replace(/\{\{as of\|2026\|11\|17[^}]*\}\}/, "");
  let l = serveur.lireClassementBwf(sansDate);
  assert.match(l.erreurs.SH, /date/);
  assert.ok(l.disciplines.SD, "les autres disciplines restent lues");

  // points qui remontent : 2e plus fort que le 1er
  const pts = [...CLASSEMENT.matchAll(/align="right"[^|\n]*\|\s*(\d{1,3}(?:,\d{3})+)/g)].map((m) => m[1]);
  const truque = CLASSEMENT.replace(pts[0], "1,000").replace(/^(.*)$/m, "$1");
  l = serveur.lireClassementBwf(truque);
  assert.match(l.erreurs.SH, /points/);
  assert.ok(l.disciplines.SD && l.disciplines.DM);

  // page entièrement différente
  l = serveur.lireClassementBwf("Page vide ou refaite");
  assert.equal(Object.keys(l.disciplines).length, 0);
  assert.equal(Object.keys(l.erreurs).length, 5);
});

// ─── Lecture du calendrier ───

test("calendrier : dates, lieu, niveau, dotation, taille des tableaux et finales des tournois terminés", () => {
  const t = serveur.lireCalendrierBwf(CALENDRIER_2026, 2026);
  assert.ok(t.length >= 8);
  assert.ok(t.every((x, i) => i === 0 || t[i - 1].debut <= x.debut), "classés par date");
  assert.ok(t.every((x) => x.fin >= x.debut));
  const hk = t.find((x) => x.nom === "Hong Kong Open");
  assert.deepEqual([hk.debut, hk.fin, hk.niveau], ["2026-11-17", "2026-11-22", "Super 500"]);
  assert.equal(hk.dotation, "500 000 $");
  assert.deepEqual(hk.tableaux, { SH: 32, SD: 32, DH: 32, DD: 32, DM: 32 });
  assert.deepEqual(hk.finales.SH.champions, ["Anders Antonsen"]);
  assert.deepEqual(hk.finales.SH.finalistes, ["Kunlavut Vitidsarn"]);
  assert.equal(hk.finales.DH.champions.length, 2, "un double = deux noms");
  const prochain = t.find((x) => x.nom === "Syed Modi International");
  assert.equal(prochain.finales, undefined, "pas de finales pour un tournoi pas encore joué");
  assert.equal(prochain.pays, "Inde");
});

test("calendrier : des finales incomplètes sont ignorées, jamais affichées à moitié", () => {
  // on supprime la ligne du score de la dernière finale (double mixte) du Hong Kong Open
  const debut = CALENDRIER_2026.indexOf("[[Hong Kong Open (badminton)|Hong Kong Open]]");
  assert.ok(debut > 0, "le tournoi est dans l'extrait");
  const suite = CALENDRIER_2026.indexOf("'''[[", debut + 10);
  const morceau = CALENDRIER_2026.slice(debut, suite);
  const dernier = morceau.lastIndexOf("'''Score:'''");
  const finLigne = morceau.indexOf("\n", dernier);
  const abime = CALENDRIER_2026.slice(0, debut) + morceau.slice(0, dernier) + morceau.slice(finLigne) + CALENDRIER_2026.slice(suite);
  assert.notEqual(abime, CALENDRIER_2026, "l'extrait a bien été abîmé");
  const hk = serveur.lireCalendrierBwf(abime, 2026).find((x) => x.nom === "Hong Kong Open");
  assert.ok(hk, "le tournoi lui-même reste affiché");
  assert.equal(hk.finales, undefined, "aucune finale plutôt que 4 sur 5");
  assert.equal(hk.niveau, "Super 500");
});

// ─── Mise à jour (Wikipédia simulée) ───

const PHOTOS = {
  "Christo Popov": { fichier: "Popov.jpg", licence: "CC BY-SA 4.0", auteur: "<a href=\"x\">Jean Photographe</a>" },
  "Anders Antonsen": { fichier: "Antonsen.jpg", licence: "CC BY 3.0", auteur: "Marie Cliché" },
  "Kunlavut Vitidsarn": { fichier: "Kunlavut.jpg", licence: "Fair use", auteur: "Agence" }, // non libre : doit être refusée
};

function fausseWikipedia({ ranking = CLASSEMENT, cal2026 = CALENDRIER_2026, panne = false } = {}) {
  etat.externe = async (href) => {
    const u = new URL(href);
    if (u.hostname === "upload.wikimedia.org") return new Response(new Uint8Array([255, 216, 255, 224, 1, 2, 3]), { status: 200, headers: { "Content-Type": "image/jpeg" } });
    if (u.hostname !== "en.wikipedia.org") return null;
    if (panne) return new Response("down", { status: 503 });
    const q = u.searchParams;
    const json = (v) => new Response(JSON.stringify(v), { status: 200, headers: { "Content-Type": "application/json" } });
    if (q.get("action") === "parse") {
      const page = q.get("page");
      if (page === "BWF_World_Ranking") return json({ parse: { wikitext: ranking } });
      if (page === "2026_BWF_World_Tour") return json({ parse: { wikitext: cal2026 } });
      return json({ error: { code: "missingtitle" } }); // 2027 pas encore publiée
    }
    if (q.get("prop") === "pageimages") {
      const pages = q.get("titles").split("|").filter((t) => PHOTOS[t]).map((t) => ({ title: t, thumbnail: { source: "https://upload.wikimedia.org/" + PHOTOS[t].fichier }, pageimage: PHOTOS[t].fichier }));
      return json({ query: { pages } });
    }
    if (q.get("prop") === "imageinfo") {
      const pages = q.get("titles").split("|").map((t) => {
        const p = Object.values(PHOTOS).find((x) => "File:" + x.fichier === t);
        return { title: t, imageinfo: [{ descriptionurl: "https://commons.wikimedia.org/wiki/" + t, extmetadata: { Artist: { value: p.auteur }, LicenseShortName: { value: p.licence } } }] };
      });
      return json({ query: { pages } });
    }
    return json({});
  };
}

test("mise à jour (via le serveur) : refus sans le bon secret", async () => {
  const r = await appeler({ action: "cron_classement_bwf", secret: "mauvais" });
  assert.equal(r.status, 401);
  assert.equal(etat.base.classementBwf, undefined);
  assert.equal(etat.appelsExterieurs.length, 0, "aucune lecture de Wikipédia sans autorisation");
});

test("mise à jour (via le serveur) : les données arrivent dans la base, sont publiques, les photos libres sont copiées, les non libres refusées", async () => {
  fausseWikipedia();
  const r = await appeler({ action: "cron_classement_bwf", secret: "secret-taches-test" });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.change, true);

  const c = etat.base.classementBwf;
  assert.equal(Object.keys(c.disciplines).length, 5);
  assert.deepEqual(Object.keys(c.photos).sort(), ["Anders Antonsen", "Christo Popov"], "photo non libre refusée, joueurs sans photo ignorés");
  assert.equal(c.photos["Christo Popov"].auteur, "Jean Photographe", "auteur en texte brut");
  assert.equal(c.photos["Christo Popov"].licence, "CC BY-SA 4.0");
  assert.match(c.photos["Christo Popov"].url, /classement\/christo-popov-/, "la photo est dans notre stockage, plus chez Wikimedia");
  assert.ok(!c.photos["Christo Popov"].url.includes("wikimedia"));
  assert.equal(Object.keys(etat.fichiers.actualities).length, 2);
  assert.ok(Object.keys(etat.fichiers.actualities).every((f) => f.startsWith("classement/")));

  // Visible par tout le monde, et seulement des données publiques de toute façon
  const pub = await appeler({ action: "fetch_public" });
  assert.equal(Object.keys(pub.json.classementBwf.disciplines).length, 5);

  // Les seuls appels extérieurs sont vers Wikipédia / Wikimedia
  assert.ok(etat.appelsExterieurs.every((a) => /wikipedia\.org|wikimedia\.org/.test(a.url)), "aucun autre service contacté");
});

test("mise à jour : rien de neuf → rien n'est écrit dans la base ni recopié", async () => {
  fausseWikipedia();
  await appeler({ action: "cron_classement_bwf", secret: "secret-taches-test" });
  const ecrituresAvant = etat.ecritures;
  const fichiersAvant = Object.keys(etat.fichiers.actualities).length;
  etat.appelsExterieurs = [];
  const r = await appeler({ action: "cron_classement_bwf", secret: "secret-taches-test" });
  assert.equal(r.json.change, false);
  assert.equal(etat.ecritures, ecrituresAvant, "pas de nouvelle version de la base pour rien");
  assert.equal(Object.keys(etat.fichiers.actualities).length, fichiersAvant);
  assert.ok(!etat.appelsExterieurs.some((a) => /upload\.wikimedia\.org/.test(a.url)), "les photos déjà copiées ne sont pas retéléchargées");
});

test("mise à jour : Wikipédia en panne → l'ancien classement valide est conservé tel quel", async () => {
  fausseWikipedia();
  await appeler({ action: "cron_classement_bwf", secret: "secret-taches-test" });
  const avant = JSON.stringify(etat.base.classementBwf);
  fausseWikipedia({ panne: true });
  const r = await appeler({ action: "cron_classement_bwf", secret: "secret-taches-test" });
  assert.equal(r.json.ok, true);
  assert.equal(r.json.change, false);
  assert.equal(JSON.stringify(etat.base.classementBwf), avant);
});

test("mise à jour : une page Wikipédia abîmée ne remplace pas un bon classement ; une discipline à la fois", async () => {
  fausseWikipedia();
  await appeler({ action: "cron_classement_bwf", secret: "secret-taches-test" });
  const avant = structuredClone(etat.base.classementBwf);
  // Vandalisme : le simple hommes perd sa date, les autres restent bons
  fausseWikipedia({ ranking: CLASSEMENT.replace(/\{\{as of\|2026\|11\|17[^}]*\}\}/, "") });
  const r = await appeler({ action: "cron_classement_bwf", secret: "secret-taches-test" });
  assert.equal(r.json.ok, true);
  assert.deepEqual(etat.base.classementBwf.disciplines.SH, avant.disciplines.SH, "ancien simple hommes conservé");
  assert.match(etat.base.classementBwf.erreurs.SH, /date/);
  assert.ok(etat.base.classementBwf.disciplines.SD);
});

test("mise à jour : un grand saut de points (modification douteuse) est refusé, un classement plus ancien aussi", async () => {
  fausseWikipedia();
  const { nouveau } = await actualiser(undefined);
  // 1) points très différents de ceux connus : on garde l'ancien
  const douteux = structuredClone(nouveau);
  douteux.disciplines.SH.lignes[0].points = 20000;
  const r1 = await actualiser(douteux);
  assert.match(r1.nouveau.erreurs.SH, /suspecte/);
  assert.equal(r1.nouveau.disciplines.SH.lignes[0].points, 20000, "l'ancien est gardé");
  // 2) on a déjà un classement plus récent que la source : on ne recule pas
  const recent = structuredClone(nouveau);
  recent.disciplines.SD.date = "2026-11-24";
  recent.disciplines.SD.lignes[0].joueurs = ["Quelqu'un de plus récent"];
  const r2 = await actualiser(recent);
  assert.equal(r2.nouveau.disciplines.SD.lignes[0].joueurs[0], "Quelqu'un de plus récent");
});

async function actualiser(ancien) {
  const faux = { storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: "https://stockage.test/" + p } }) }) } };
  return serveur.actualiserClassementBwf(faux, ancien, AUJOURDHUI);
}

test("mise à jour : le calendrier ne garde que de 4 mois avant à 10 mois après, finales seulement pour les tournois terminés", async () => {
  fausseWikipedia();
  const { nouveau } = await actualiser(undefined);
  const jours = (n) => new Date(AUJOURDHUI.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  assert.ok(nouveau.calendrier.length >= 8);
  assert.ok(nouveau.calendrier.every((t) => t.fin >= jours(-120) && t.debut <= jours(300)));
  assert.ok(nouveau.calendrier.filter((t) => t.fin >= "2026-11-24").every((t) => !t.finales), "pas de finales à venir");
  assert.ok(nouveau.calendrier.filter((t) => t.fin < "2026-11-24").some((t) => t.finales), "finales des tournois passés");
});

test("mise à jour : la photo non libre ou introuvable ne casse rien (initiales côté site)", async () => {
  fausseWikipedia();
  const { nouveau } = await actualiser(undefined);
  assert.equal(nouveau.photos["Kunlavut Vitidsarn"], undefined);
  assert.equal(Object.keys(nouveau.photos).length, 2);
});
