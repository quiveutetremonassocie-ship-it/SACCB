// 🏁 Moteur du jour J d'un tournoi inter-clubs : validation des scores,
// classements de poule, génération des poules et des phases suivantes.
import { InterClub, LiveFormat, LiveMatch, LivePhase, LivePoule } from "./types";

export type Equipe = { id: string; joueur1: string; joueur2: string; niveau: string; clubId: string; club: string };

export const nomEquipe = (e?: { joueur1: string; joueur2: string }) => (e ? `${e.joueur1} / ${e.joueur2}` : "Équipe retirée");
export const lettre = (i: number) => String.fromCharCode(65 + i);

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));

export function jetonAleatoire(n = 18): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...Array.from(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function formatTexte(f: LiveFormat): string {
  return `${f.sets === 1 ? "1 set" : "2 sets gagnants"} de ${f.points} pts${f.cassant ? " cassants" : ""}`;
}

/** Toutes les équipes inscrites (binômes de tous les clubs) */
export function equipesDuTournoi(t: InterClub): Record<string, Equipe> {
  const out: Record<string, Equipe> = {};
  for (const c of t.clubs) for (const b of c.binomes) out[b.id] = { ...b, clubId: c.id, club: c.nom };
  return out;
}

// ─── Scores ───

/** Un set est-il cohérent avec le format ? (x et y = points des deux équipes) */
export function setValide(x: number, y: number, f: LiveFormat): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return false;
  const hi = Math.max(x, y), lo = Math.min(x, y), n = f.points;
  if (f.cassant) return hi === n && lo < n;
  const plafond = n + 9; // 21 → 30
  return (hi === n && lo <= n - 2) || (hi > n && hi < plafond && hi - lo === 2) || (hi === plafond && lo === plafond - 1);
}

/** Vérifie un score complet ; renvoie un message d'erreur ou null */
export function erreurScore(sa: number[], sb: number[], f: LiveFormat): string | null {
  if (sa.length !== sb.length || sa.length === 0) return "Score incomplet.";
  for (let i = 0; i < sa.length; i++) {
    if (!setValide(sa[i], sb[i], f)) {
      return `Set ${i + 1} : score impossible en ${f.points} points${f.cassant ? " cassants" : ""}.`;
    }
  }
  if (f.sets === 1) return sa.length === 1 ? null : "Ce match se joue en 1 seul set.";
  if (sa.length < 2 || sa.length > 3) return "Ce match se joue en 2 sets gagnants (2 ou 3 sets).";
  const ga = sa.filter((v, i) => v > sb[i]).length;
  const gb = sa.length - ga;
  if (sa.length === 2 && ga !== 2 && gb !== 2) return "À 1 set partout, il faut jouer le 3ᵉ set.";
  if (sa.length === 3 && !((ga === 2 && sa[2] > sb[2]) || (gb === 2 && sb[2] > sa[2]))) return "Le 3ᵉ set n'est joué qu'à 1 set partout.";
  return null;
}

export const matchJoue = (m: LiveMatch) => !!(m.sa && m.sb && m.sa.length > 0);

export function vainqueur(m: LiveMatch): string | null {
  if (!matchJoue(m)) return null;
  const ga = m.sa!.filter((v, i) => v > m.sb![i]).length;
  return ga > m.sa!.length - ga ? m.a : m.b;
}

// ─── Classement d'une poule ───

export type Ligne = { id: string; joues: number; v: number; d: number; forfaits: number; points: number; retiree: boolean; setsPour: number; setsContre: number; ptsPour: number; ptsContre: number };

export function classementPoule(p: LivePoule): Ligne[] {
  const t: Record<string, Ligne> = {};
  // Règlement FFBaD (RGC 3.4.1) : victoire +1, défaite 0, forfait -1.
  // Une équipe qui a arrêté (3.4.4) : ses matchs ne comptent pour personne, elle finit dernière.
  const retirees = new Set(p.retirees || []);
  for (const id of p.equipes) t[id] = { id, joues: 0, v: 0, d: 0, forfaits: 0, points: 0, retiree: retirees.has(id), setsPour: 0, setsContre: 0, ptsPour: 0, ptsContre: 0 };
  for (const m of p.matchs) {
    if (!matchJoue(m) || !t[m.a] || !t[m.b]) continue;
    if (retirees.has(m.a) || retirees.has(m.b)) continue;
    const A = t[m.a], B = t[m.b];
    A.joues++; B.joues++;
    m.sa!.forEach((pa, i) => {
      const pb = m.sb![i];
      A.ptsPour += pa; A.ptsContre += pb; B.ptsPour += pb; B.ptsContre += pa;
      if (pa > pb) { A.setsPour++; B.setsContre++; } else { B.setsPour++; A.setsContre++; }
    });
    if (vainqueur(m) === m.a) { A.v++; B.d++; } else { B.v++; A.d++; }
    if (m.forfait === m.a) A.forfaits++;
    if (m.forfait === m.b) B.forfaits++;
  }
  const ordre = new Map(p.equipes.map((id, i) => [id, i]));
  const duel = (x: string, y: string) => {
    const m = p.matchs.find((k) => matchJoue(k) && ((k.a === x && k.b === y) || (k.a === y && k.b === x)));
    const w = m ? vainqueur(m) : null;
    return w === x ? -1 : w === y ? 1 : 0;
  };
  // Départage selon le Règlement Général des Compétitions FFBaD (art. 3.4.1), à égalité de points :
  //  • 2 équipes → le vainqueur de leur match ;
  //  • 3 équipes ou plus → différence de sets, puis différence de points ; dès qu'il n'en
  //    reste que 2 à égalité, on revient à leur match ;
  //  • en dernier ressort (tirage au sort) : l'ordre du tirage des poules.
  const criteres: ((l: Ligne) => number)[] = [
    (l) => l.setsPour - l.setsContre,
    (l) => l.ptsPour - l.ptsContre,
  ];
  const departage = (groupe: Ligne[], k: number): Ligne[] => {
    if (groupe.length <= 1) return groupe;
    if (groupe.length === 2) {
      const d = duel(groupe[0].id, groupe[1].id);
      if (d !== 0) return d < 0 ? groupe : [groupe[1], groupe[0]];
    }
    if (k >= criteres.length) return [...groupe].sort((x, y) => ordre.get(x.id)! - ordre.get(y.id)!);
    const c = criteres[k];
    const tries = [...groupe].sort((x, y) => c(y) - c(x));
    const out: Ligne[] = [];
    for (let i = 0; i < tries.length; ) {
      let j = i;
      while (j < tries.length && c(tries[j]) === c(tries[i])) j++;
      out.push(...departage(tries.slice(i, j), k + 1));
      i = j;
    }
    return out;
  };
  for (const l of Object.values(t)) l.points = l.v - l.forfaits;
  // Équipes retirées à la fin ; les autres par points (victoires − forfaits)
  const parVictoires = Object.values(t).sort((x, y) => Number(x.retiree) - Number(y.retiree) || y.points - x.points);
  const res: Ligne[] = [];
  for (let i = 0; i < parVictoires.length; ) {
    let j = i;
    while (j < parVictoires.length && parVictoires[j].points === parVictoires[i].points && parVictoires[j].retiree === parVictoires[i].retiree) j++;
    res.push(...departage(parVictoires.slice(i, j), 0));
    i = j;
  }
  return res;
}

export const pouleTerminee = (p: LivePoule) => {
  const r = new Set(p.retirees || []);
  return p.matchs.every((m) => matchJoue(m) || r.has(m.a) || r.has(m.b));
};
export const phaseTerminee = (ph: LivePhase) => ph.poules.every(pouleTerminee);

// ─── Génération ───

/** Matchs « tout le monde se rencontre », dans un ordre qui fait tourner les équipes (méthode du cercle) */
export function matchsPoule(equipes: string[]): LiveMatch[] {
  const ids: (string | null)[] = [...equipes];
  if (ids.length % 2) ids.push(null);
  const n = ids.length, out: LiveMatch[] = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i], b = ids[n - 1 - i];
      if (a && b) out.push({ id: uid(), a: r % 2 ? b : a, b: r % 2 ? a : b });
    }
    ids.splice(1, 0, ids.pop()!);
  }
  return out;
}

function taillesPoules(nb: number, nbPoules: number): number[] {
  const base = Math.floor(nb / nbPoules), reste = nb % nbPoules;
  return Array.from({ length: nbPoules }, (_, i) => base + (i < reste ? 1 : 0));
}

/** 1ʳᵉ phase : poules équilibrées en niveau, en évitant deux équipes du même club dans une poule */
export function genererBrassage(t: InterClub, nbPoules: number, format: LiveFormat, nom = "Brassage"): LivePhase {
  const eq = Object.values(equipesDuTournoi(t));
  const rangNiveau = (n: string) => { const i = t.niveaux.indexOf(n); return i < 0 ? 99 : -i; }; // plus fort d'abord
  // Mélange puis tri par niveau → serpentin dans les poules
  const melange = eq.map((e) => ({ e, r: Math.random() })).sort((x, y) => rangNiveau(x.e.niveau) - rangNiveau(y.e.niveau) || x.r - y.r).map((x) => x.e);
  const tailles = taillesPoules(melange.length, nbPoules);
  const poules: Equipe[][] = Array.from({ length: nbPoules }, () => []);
  // Ordre serpentin : A B C D D C B A A B…
  const seq: number[] = [];
  while (seq.length < melange.length * 2 + nbPoules * 2) {
    for (let k = 0; k < nbPoules; k++) seq.push(k);
    for (let k = nbPoules - 1; k >= 0; k--) seq.push(k);
  }
  let s = 0;
  for (const e of melange) {
    while (poules[seq[s]].length >= tailles[seq[s]]) s++;
    poules[seq[s]].push(e);
    s++;
  }
  // Échanges entre équipes de même niveau pour séparer les clubs
  const doublons = (lst: Equipe[]) => lst.length - new Set(lst.map((x) => x.clubId)).size;
  for (let tour = 0; tour < 200; tour++) {
    let ameliore = false;
    for (let a = 0; a < nbPoules && !ameliore; a++) for (let b = a + 1; b < nbPoules && !ameliore; b++) {
      for (let x = 0; x < poules[a].length && !ameliore; x++) for (let y = 0; y < poules[b].length && !ameliore; y++) {
        const ea = poules[a][x], eb = poules[b][y];
        if (ea.niveau !== eb.niveau || ea.clubId === eb.clubId) continue;
        const avant = doublons(poules[a]) + doublons(poules[b]);
        poules[a][x] = eb; poules[b][y] = ea;
        if (doublons(poules[a]) + doublons(poules[b]) < avant) ameliore = true;
        else { poules[a][x] = ea; poules[b][y] = eb; }
      }
    }
    if (!ameliore) break;
  }
  return {
    id: uid(), nom, mode: "brassage", format,
    poules: poules.map((lst, k) => ({ id: uid(), nom: `Poule ${lettre(k)}`, equipes: lst.map((e) => e.id), matchs: matchsPoule(lst.map((e) => e.id)) })),
  };
}

/** Ordre global des équipes à la fin d'une phase (sert à composer la suivante) */
export function ordreSortie(ph: LivePhase): string[] {
  const cl = ph.poules.map((p) => classementPoule(p).map((l) => l.id));
  const entrelace = (groupes: string[][]) => {
    const out: string[] = [];
    const max = Math.max(0, ...groupes.map((g) => g.length));
    for (let r = 0; r < max; r++) for (const g of groupes) if (g[r]) out.push(g[r]);
    return out;
  };
  // Brassage : 1ers de chaque poule, puis les 2es… ; par niveau : on mélange les poules deux à deux
  if (ph.mode === "brassage") return entrelace(cl);
  const out: string[] = [];
  for (let k = 0; k < cl.length; k += 2) out.push(...entrelace(cl.slice(k, k + 2)));
  return out;
}

/** Phase suivante : poule 1 = les meilleures équipes de la phase précédente, etc. */
export function genererPhaseSuivante(prec: LivePhase, nbPoules: number, format: LiveFormat, nom: string): LivePhase {
  // Les équipes qui ont arrêté ne passent pas à la phase suivante
  const parties = new Set(prec.poules.flatMap((p) => p.retirees || []));
  const ordre = ordreSortie(prec).filter((id) => !parties.has(id));
  const tailles = taillesPoules(ordre.length, nbPoules);
  let k = 0;
  const poules: LivePoule[] = tailles.map((n, i) => {
    const eq = ordre.slice(k, k + n);
    k += n;
    return { id: uid(), nom: `Poule ${lettre(i)}`, equipes: eq, matchs: matchsPoule(eq) };
  });
  return { id: uid(), nom, mode: "niveau", format, poules };
}

/** 🏅 Classement général provisoire d'une phase (place de chaque équipe dans tout le tournoi).
 *  Brassage : rang dans la poule, puis victoires, sets, points ;
 *  phases par niveau : la poule A d'abord (les meilleures), puis B… */
export function classementGeneral(ph: LivePhase): string[] {
  if (ph.mode === "niveau") return ph.poules.flatMap((p) => classementPoule(p).map((l) => l.id));
  const lignes = ph.poules.flatMap((p) => classementPoule(p).map((l, rang) => ({ ...l, rang })));
  return lignes
    .sort((x, y) =>
      x.rang - y.rang ||
      y.points - x.points ||
      (y.setsPour - y.setsContre) - (x.setsPour - x.setsContre) ||
      (y.ptsPour - y.ptsContre) - (x.ptsPour - x.ptsContre) ||
      y.ptsPour - x.ptsPour)
    .map((l) => l.id);
}

/** Classement final : poules de la dernière phase dans l'ordre (par niveau) */
export function classementFinal(ph: LivePhase): string[] {
  if (ph.mode === "brassage") return ordreSortie(ph);
  return ph.poules.flatMap((p) => classementPoule(p).map((l) => l.id));
}

export const uidLive = uid;
