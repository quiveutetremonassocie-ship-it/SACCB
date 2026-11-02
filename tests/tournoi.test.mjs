// 🧪 Tests du moteur des tournois (scores, poules, classements) avec des équipes inventées
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { compiler } from "./outils/compiler.mjs";

let T;
before(async () => { T = await import(compiler("src/lib/interclubLive.ts", "interclubLive.mjs")); });

const F12 = { sets: 1, points: 12, cassant: true };
const F21 = { sets: 3, points: 21, cassant: false };

/** Tournoi fictif : 4 clubs × 3 équipes, 3 niveaux */
function tournoiFictif(nbClubs = 4, parClub = 3) {
  const niveaux = ["Fort", "Moyen", "Débutant"];
  return {
    id: "t1", nom: "Tournoi test", niveaux,
    clubs: Array.from({ length: nbClubs }, (_, c) => ({
      id: "c" + c, nom: "Club " + c,
      binomes: Array.from({ length: parClub }, (_, b) => ({ id: `e${c}-${b}`, joueur1: `J${c}${b}a`, joueur2: `J${c}${b}b`, niveau: niveaux[b % 3] })),
    })),
  };
}

/** Joue tous les matchs d'une phase : l'équipe la plus « forte » (selon `force`) gagne */
function jouer(phase, force) {
  for (const p of phase.poules) for (const m of p.matchs) {
    const aGagne = force(m.a) >= force(m.b);
    m.sa = [aGagne ? 12 : 7]; m.sb = [aGagne ? 7 : 12];
  }
}

test("scores : les scores possibles sont acceptés, les impossibles refusés", () => {
  assert.equal(T.setValide(21, 19, F21), true);
  assert.equal(T.setValide(21, 20, F21), false, "il faut 2 points d'écart");
  assert.equal(T.setValide(23, 21, F21), true);
  assert.equal(T.setValide(30, 29, F21), true, "plafond à 30");
  assert.equal(T.setValide(31, 29, F21), false);
  assert.equal(T.setValide(12, 11, F12), true, "points cassants");
  assert.equal(T.setValide(13, 11, F12), false);
  assert.equal(T.erreurScore([21, 21], [15, 10], F21), null);
  assert.match(T.erreurScore([21, 15], [15, 21], F21), /3ᵉ set/);
  assert.equal(T.erreurScore([21, 15, 21], [15, 21, 18], F21), null);
  assert.match(T.erreurScore([12, 12], [5, 5], F12), /1 seul set/);
});

test("poule : tout le monde se rencontre exactement une fois", () => {
  for (const n of [3, 4, 5, 6]) {
    const ids = Array.from({ length: n }, (_, i) => "e" + i);
    const matchs = T.matchsPoule(ids);
    assert.equal(matchs.length, (n * (n - 1)) / 2);
    const paires = new Set(matchs.map((m) => [m.a, m.b].sort().join("-")));
    assert.equal(paires.size, matchs.length, "aucun match en double");
  }
});

test("brassage : chaque équipe est dans une seule poule, les poules sont équilibrées", () => {
  const t = tournoiFictif();
  const ph = T.genererBrassage(t, 3, F12);
  const toutes = ph.poules.flatMap((p) => p.equipes);
  assert.equal(toutes.length, 12);
  assert.equal(new Set(toutes).size, 12);
  assert.deepEqual(ph.poules.map((p) => p.equipes.length), [4, 4, 4]);
});

test("classement de poule : celle qui gagne tout est 1ʳᵉ", () => {
  const p = { id: "p", nom: "Poule A", equipes: ["a", "b", "c"], matchs: T.matchsPoule(["a", "b", "c"]) };
  const force = { a: 3, b: 2, c: 1 };
  jouer({ poules: [p] }, (id) => force[id]);
  assert.deepEqual(T.classementPoule(p).map((l) => l.id), ["a", "b", "c"]);
  assert.equal(T.pouleTerminee(p), true);
});

test("tournoi complet (brassage → 2ᵉ tour → finale) : personne n'est éliminé et le podium est logique", () => {
  const t = tournoiFictif();
  const force = (id) => { const [c, b] = id.slice(1).split("-").map(Number); return (3 - b) * 10 + c; };
  let ph = T.genererBrassage(t, 3, F12);
  jouer(ph, force);
  assert.equal(T.phaseTerminee(ph), true);
  for (const nom of ["2ᵉ tour", "Finale"]) {
    ph = T.genererPhaseSuivante(ph, 3, F12, nom);
    assert.equal(ph.poules.flatMap((p) => p.equipes).length, 12, `${nom} : les 12 équipes jouent encore`);
    jouer(ph, force);
  }
  const final = T.classementFinal(ph);
  assert.equal(final.length, 12, "les 12 équipes sont classées");
  assert.equal(new Set(final).size, 12);
  assert.equal(final[0], "e3-0", "la meilleure équipe gagne");
});

test("une équipe qui arrête en cours de tournoi ne bloque pas la suite", () => {
  const t = tournoiFictif();
  const ph = T.genererBrassage(t, 3, F12);
  const partie = ph.poules[0].equipes[0];
  ph.poules[0].retirees = [partie];
  jouer({ poules: ph.poules.map((p) => ({ ...p, matchs: p.matchs.filter((m) => m.a !== partie && m.b !== partie) })) }, () => 1);
  assert.equal(T.phaseTerminee(ph), true, "la poule est terminée même sans les matchs de l'équipe partie");
  const suite = T.genererPhaseSuivante(ph, 3, F12, "2ᵉ tour");
  const eq = suite.poules.flatMap((p) => p.equipes);
  assert.equal(eq.length, 11);
  assert.ok(!eq.includes(partie));
});
