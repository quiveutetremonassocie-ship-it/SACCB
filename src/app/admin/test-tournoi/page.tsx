"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Trash2, Plus, Shuffle, RotateCcw, Save, AlertTriangle, Users } from "lucide-react";

// 🏆 PAGE TEST — Mini-tournoi prototype
// ────────────────────────────────────────────────────────────────
// Accessible via /admin/test-tournoi. Sert à valider l'UX du système
// de mini-tournois avant intégration finale. Stockage en localStorage
// pour rester simple (pas de DB) — sera migré vers Supabase ensuite.

type Level = "TC" | "C" | "Debr" | "Débu";

type Team = {
  id: string;
  player1: string;
  player2: string;
  club: string;
  level: Level;
};

type Match = {
  id: string;
  teamAId: string;
  teamBId: string;
  // 2 sets de 21 points
  set1A?: number;
  set1B?: number;
  set2A?: number;
  set2B?: number;
  locked: boolean;
};

type Pool = {
  id: string; // "A", "B", "C"...
  teamIds: string[];
  matches: Match[];
};

type Tournament = {
  id: string;
  name: string;
  numTeams: number;
  teamsPerPool: number;
  teams: Team[];
  pools: Pool[];
  phase: "setup" | "teams" | "pools";
  createdAt: number;
};

const STORAGE_KEY = "saccb_test_tournoi_v1";
const LEVEL_OPTIONS: Level[] = ["TC", "C", "Debr", "Débu"];
const LEVEL_LABELS: Record<Level, string> = {
  TC: "TC (Très Confirmé)",
  C: "C (Confirmé)",
  Debr: "Debr (Débrouillé)",
  "Débu": "Débu (Débutant)",
};
const POOL_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// 🎲 Shuffle Fisher-Yates immuable
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 🎯 Répartition équilibrée par niveau + club (Option A choisie)
// Stratégie : on trie par niveau puis on distribue en serpentin
// (snake draft) dans les poules pour que chaque poule ait un mix.
function balancedDistribute(teams: Team[], numPools: number): string[][] {
  // 1) Grouper par niveau
  const byLevel: Record<Level, Team[]> = { TC: [], C: [], Debr: [], "Débu": [] };
  for (const t of teams) byLevel[t.level].push(t);
  // 2) Shuffle dans chaque niveau pour la part d'aléatoire
  for (const l of LEVEL_OPTIONS) byLevel[l] = shuffle(byLevel[l]);
  // 3) Préparer un ordre serpentin : 0,1,2,3,3,2,1,0,0,1,2,3,...
  const pools: string[][] = Array.from({ length: numPools }, () => []);
  // Construire la liste plate dans l'ordre TC → C → Debr → Débu
  const flat = [...byLevel.TC, ...byLevel.C, ...byLevel.Debr, ...byLevel["Débu"]];
  let dir = 1;
  let p = 0;
  for (const t of flat) {
    pools[p].push(t.id);
    p += dir;
    if (p === numPools) { dir = -1; p = numPools - 1; }
    else if (p === -1) { dir = 1; p = 0; }
  }
  return pools;
}

// 🎯 Génère tous les matchs d'une poule (chaque équipe vs chaque équipe)
function generatePoolMatches(poolLetter: string, teamIds: string[]): Match[] {
  const matches: Match[] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matches.push({
        id: `M-${poolLetter}-${i}-${j}`,
        teamAId: teamIds[i],
        teamBId: teamIds[j],
        locked: false,
      });
    }
  }
  return matches;
}

// 🏅 Calcule le classement d'une poule selon les matchs joués
function computePoolStanding(pool: Pool, teams: Team[]): {
  team: Team;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsScored: number;
  pointsConceded: number;
}[] {
  const stats = new Map<string, { wins: number; losses: number; setsWon: number; setsLost: number; pointsScored: number; pointsConceded: number }>();
  for (const id of pool.teamIds) stats.set(id, { wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsScored: 0, pointsConceded: 0 });
  for (const m of pool.matches) {
    if (m.set1A === undefined || m.set1B === undefined) continue;
    const a = stats.get(m.teamAId)!;
    const b = stats.get(m.teamBId)!;
    // Set 1
    a.pointsScored += m.set1A; a.pointsConceded += m.set1B;
    b.pointsScored += m.set1B; b.pointsConceded += m.set1A;
    if (m.set1A > m.set1B) { a.setsWon++; b.setsLost++; } else { b.setsWon++; a.setsLost++; }
    // Set 2 (optionnel — si renseigné)
    if (m.set2A !== undefined && m.set2B !== undefined) {
      a.pointsScored += m.set2A; a.pointsConceded += m.set2B;
      b.pointsScored += m.set2B; b.pointsConceded += m.set2A;
      if (m.set2A > m.set2B) { a.setsWon++; b.setsLost++; } else { b.setsWon++; a.setsLost++; }
    }
    // Détermine le vainqueur du match (au meilleur des 2 sets)
    const aSets = (m.set1A > m.set1B ? 1 : 0) + (m.set2A !== undefined && m.set2B !== undefined && m.set2A > m.set2B ? 1 : 0);
    const bSets = (m.set1B > m.set1A ? 1 : 0) + (m.set2A !== undefined && m.set2B !== undefined && m.set2B > m.set2A ? 1 : 0);
    if (aSets > bSets) { a.wins++; b.losses++; } else if (bSets > aSets) { b.wins++; a.losses++; }
  }
  const rows = pool.teamIds.map((id) => ({
    team: teams.find((t) => t.id === id)!,
    ...stats.get(id)!,
  }));
  // Tri : victoires desc, puis diff sets, puis diff points
  rows.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    const dx = x.setsWon - x.setsLost;
    const dy = y.setsWon - y.setsLost;
    if (dy !== dx) return dy - dx;
    return (y.pointsScored - y.pointsConceded) - (x.pointsScored - x.pointsConceded);
  });
  return rows;
}

export default function TestTournoiPage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 🔄 Chargement initial depuis localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTournament(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  // 💾 Sauvegarde auto à chaque changement
  useEffect(() => {
    if (!loaded) return;
    if (tournament) localStorage.setItem(STORAGE_KEY, JSON.stringify(tournament));
    else localStorage.removeItem(STORAGE_KEY);
  }, [tournament, loaded]);

  if (!loaded) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400">Chargement…</p></div>;
  }

  function startNew() {
    if (tournament && !confirm("Un tournoi est déjà en cours. Le remplacer ?")) return;
    setTournament({
      id: Date.now().toString(),
      name: "",
      numTeams: 8,
      teamsPerPool: 4,
      teams: [],
      pools: [],
      phase: "setup",
      createdAt: Date.now(),
    });
  }

  function reset() {
    if (!confirm("Effacer complètement ce tournoi et revenir à l'accueil ?")) return;
    setTournament(null);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition">
              <ArrowLeft className="w-4 h-4" /> Retour admin
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-amber-700 bg-amber-100 border border-amber-300 px-2 py-1 rounded-full font-bold">
              🧪 Mode test — Prototype
            </span>
          </div>
        </div>

        {/* Titre */}
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#0f2440] rounded-2xl p-6 md:p-8 mb-6 text-white shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center shrink-0">
              <Trophy className="w-7 h-7 text-amber-900" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl md:text-3xl tracking-wider">Mini-tournoi SACCB</h1>
              <p className="text-blue-200 text-sm mt-1">
                Prototype de gestion d&apos;un tournoi en doubles. Tu peux saisir les équipes, générer les poules
                automatiquement (avec équilibrage par niveau), et entrer les scores des matchs.
              </p>
            </div>
          </div>
        </div>

        {/* Contenu */}
        {!tournament ? (
          <EmptyState onStart={startNew} />
        ) : tournament.phase === "setup" ? (
          <SetupPhase t={tournament} setT={setTournament} onReset={reset} />
        ) : tournament.phase === "teams" ? (
          <TeamsPhase t={tournament} setT={setTournament} onReset={reset} />
        ) : (
          <PoolsPhase t={tournament} setT={setTournament} onReset={reset} />
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// État vide : invitation à créer un tournoi
// ───────────────────────────────────────────────────────────
function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-12 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 mx-auto mb-4 flex items-center justify-center">
        <Trophy className="w-10 h-10 text-white" />
      </div>
      <h2 className="font-display text-xl md:text-2xl tracking-wider text-slate-800 mb-2">Aucun tournoi en cours</h2>
      <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
        Clique sur le bouton ci-dessous pour démarrer un nouveau mini-tournoi.
        Tu pourras choisir le nombre d&apos;équipes et le format des poules.
      </p>
      <button onClick={onStart} className="btn-primary inline-flex items-center gap-2">
        <Plus className="w-4 h-4" /> Démarrer un tournoi
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// PHASE 1 — Configuration du tournoi
// ───────────────────────────────────────────────────────────
function SetupPhase({ t, setT, onReset }: { t: Tournament; setT: (t: Tournament) => void; onReset: () => void }) {
  const numPools = Math.ceil(t.numTeams / t.teamsPerPool);
  const lastPoolSize = t.numTeams - (numPools - 1) * t.teamsPerPool;
  const isClean = lastPoolSize === t.teamsPerPool;

  function next() {
    if (!t.name.trim()) { alert("Donne un nom à ton tournoi."); return; }
    if (t.numTeams < 2 || t.numTeams > 32) { alert("Entre 2 et 32 équipes."); return; }
    if (t.teamsPerPool < 2 || t.teamsPerPool > 8) { alert("Entre 2 et 8 équipes par poule."); return; }
    // Crée les slots d'équipes vides
    const teams: Team[] = Array.from({ length: t.numTeams }, (_, i) => ({
      id: `T${Date.now()}-${i}`,
      player1: "",
      player2: "",
      club: "",
      level: "C" as Level,
    }));
    setT({ ...t, teams, phase: "teams" });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
      <h2 className="font-display text-xl tracking-wider text-slate-800 mb-1">⚙️ Configuration</h2>
      <p className="text-sm text-slate-500 mb-6">Définis le format du tournoi avant d&apos;ajouter les équipes.</p>

      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">Nom du tournoi</label>
          <input
            className="input w-full"
            placeholder="Ex: Tournoi interne du 15 mars"
            value={t.name}
            onChange={(e) => setT({ ...t, name: e.target.value })}
            maxLength={80}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">Nombre de doubles (équipes)</label>
            <input
              type="number"
              className="input w-full"
              min={2} max={32}
              value={t.numTeams}
              onChange={(e) => setT({ ...t, numTeams: Math.max(2, Math.min(32, Number(e.target.value) || 0)) })}
            />
            <p className="text-[11px] text-slate-400 mt-1">Entre 2 et 32</p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">Doubles par poule</label>
            <input
              type="number"
              className="input w-full"
              min={2} max={8}
              value={t.teamsPerPool}
              onChange={(e) => setT({ ...t, teamsPerPool: Math.max(2, Math.min(8, Number(e.target.value) || 0)) })}
            />
            <p className="text-[11px] text-slate-400 mt-1">Entre 2 et 8 (4 recommandé)</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-900">
            <strong>📊 Aperçu</strong> : {numPools} poule{numPools > 1 ? "s" : ""}{" "}
            {isClean ? `de ${t.teamsPerPool} équipes` : `(dont une de ${lastPoolSize} équipe${lastPoolSize > 1 ? "s" : ""})`}
            {" "}— chaque équipe joue {t.teamsPerPool - 1} match{t.teamsPerPool - 1 > 1 ? "s" : ""} dans sa poule.
          </p>
          {!isClean && (
            <p className="text-xs text-amber-700 mt-2 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Le nombre d&apos;équipes ne se divise pas parfaitement : la dernière poule aura {lastPoolSize} équipe{lastPoolSize > 1 ? "s" : ""}.</span>
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onReset} className="btn-secondary inline-flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Annuler
          </button>
          <button onClick={next} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">
            <Users className="w-4 h-4" /> Ajouter les équipes →
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// PHASE 2 — Saisie des équipes
// ───────────────────────────────────────────────────────────
function TeamsPhase({ t, setT, onReset }: { t: Tournament; setT: (t: Tournament) => void; onReset: () => void }) {
  function updateTeam(idx: number, patch: Partial<Team>) {
    const teams = t.teams.map((x, i) => (i === idx ? { ...x, ...patch } : x));
    setT({ ...t, teams });
  }

  function backToSetup() {
    setT({ ...t, phase: "setup", teams: [] });
  }

  function generatePools() {
    // Vérification : toutes les équipes ont au moins 1 joueur
    const incompletes = t.teams.filter((x) => !x.player1.trim());
    if (incompletes.length > 0) {
      if (!confirm(`${incompletes.length} équipe(s) n'ont pas de premier joueur saisi. Continuer quand même ?`)) return;
    }
    const numPools = Math.ceil(t.numTeams / t.teamsPerPool);
    const distribution = balancedDistribute(t.teams, numPools);
    const pools: Pool[] = distribution.map((teamIds, idx) => ({
      id: POOL_LETTERS[idx] || `P${idx + 1}`,
      teamIds,
      matches: generatePoolMatches(POOL_LETTERS[idx] || `P${idx + 1}`, teamIds),
    }));
    setT({ ...t, pools, phase: "pools" });
  }

  const numFilled = t.teams.filter((x) => x.player1.trim()).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-display text-xl tracking-wider text-slate-800">👥 Équipes — {t.name}</h2>
          <span className="text-xs text-slate-500">{numFilled} / {t.numTeams} renseignées</span>
        </div>
        <p className="text-sm text-slate-500 mb-6">Saisis les deux joueurs de chaque équipe, leur club et leur niveau.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {t.teams.map((team, idx) => (
            <div key={team.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xs">
                  {idx + 1}
                </span>
                <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Équipe {idx + 1}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input className="input !text-sm" placeholder="Joueur 1" value={team.player1} onChange={(e) => updateTeam(idx, { player1: e.target.value })} />
                <input className="input !text-sm" placeholder="Joueur 2" value={team.player2} onChange={(e) => updateTeam(idx, { player2: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="input !text-sm" placeholder="Club" value={team.club} onChange={(e) => updateTeam(idx, { club: e.target.value })} />
                <select className="input !text-sm" value={team.level} onChange={(e) => updateTeam(idx, { level: e.target.value as Level })}>
                  {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={backToSetup} className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Configuration
        </button>
        <button onClick={onReset} className="btn-secondary inline-flex items-center gap-2 !text-red-600">
          <Trash2 className="w-4 h-4" /> Tout annuler
        </button>
        <button onClick={generatePools} className="btn-primary flex-1 inline-flex items-center justify-center gap-2">
          <Shuffle className="w-4 h-4" /> Générer les poules →
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// PHASE 3 — Poules + saisie des scores
// ───────────────────────────────────────────────────────────
function PoolsPhase({ t, setT, onReset }: { t: Tournament; setT: (t: Tournament) => void; onReset: () => void }) {
  function updateMatch(poolId: string, matchId: string, patch: Partial<Match>) {
    const pools = t.pools.map((p) => p.id === poolId
      ? { ...p, matches: p.matches.map((m) => m.id === matchId ? { ...m, ...patch } : m) }
      : p);
    setT({ ...t, pools });
  }

  function backToTeams() {
    if (!confirm("Revenir à la saisie des équipes ? Les poules et scores seront perdus.")) return;
    setT({ ...t, phase: "teams", pools: [] });
  }

  function regenerate() {
    if (!confirm("Re-tirer les poules au sort ? Les scores actuels seront perdus.")) return;
    const numPools = Math.ceil(t.numTeams / t.teamsPerPool);
    const distribution = balancedDistribute(t.teams, numPools);
    const pools: Pool[] = distribution.map((teamIds, idx) => ({
      id: POOL_LETTERS[idx] || `P${idx + 1}`,
      teamIds,
      matches: generatePoolMatches(POOL_LETTERS[idx] || `P${idx + 1}`, teamIds),
    }));
    setT({ ...t, pools });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl tracking-wider text-slate-800">🏆 {t.name}</h2>
          <p className="text-xs text-slate-500">{t.pools.length} poule{t.pools.length > 1 ? "s" : ""} · {t.numTeams} équipes</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={backToTeams} className="btn-secondary !text-xs inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Équipes
          </button>
          <button onClick={regenerate} className="btn-secondary !text-xs inline-flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Re-tirer
          </button>
          <button onClick={onReset} className="btn-secondary !text-xs !text-red-600 inline-flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Tout effacer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {t.pools.map((pool) => (
          <PoolCard
            key={pool.id}
            pool={pool}
            teams={t.teams}
            onUpdateMatch={(matchId, patch) => updateMatch(pool.id, matchId, patch)}
          />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Carte d'une poule
// ───────────────────────────────────────────────────────────
function PoolCard({ pool, teams, onUpdateMatch }: {
  pool: Pool;
  teams: Team[];
  onUpdateMatch: (matchId: string, patch: Partial<Match>) => void;
}) {
  const standing = useMemo(() => computePoolStanding(pool, teams), [pool, teams]);

  function teamLabel(id: string): string {
    const t = teams.find((x) => x.id === id);
    if (!t) return "?";
    const main = `${t.player1.trim()}${t.player2.trim() ? " / " + t.player2.trim() : ""}` || "Équipe sans nom";
    return main;
  }
  function teamSubtitle(id: string): string {
    const t = teams.find((x) => x.id === id);
    if (!t) return "";
    return [t.club, t.level].filter(Boolean).join(" · ");
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#0f2440] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center font-display font-bold text-amber-900">
            {pool.id}
          </span>
          <span className="text-white font-display tracking-wider">Poule {pool.id}</span>
        </div>
      </div>

      {/* Équipes + classement */}
      <div className="p-3 border-b border-slate-100">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Classement actuel</p>
        <div className="space-y-1">
          {standing.map((row, idx) => (
            <div key={row.team.id} className="flex items-center gap-2 text-sm">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                idx === 0 ? "bg-amber-100 text-amber-700"
                : idx === 1 ? "bg-slate-100 text-slate-700"
                : "bg-slate-50 text-slate-500"
              }`}>{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-slate-800">{teamLabel(row.team.id)}</p>
                <p className="text-[10px] text-slate-400 truncate">{teamSubtitle(row.team.id)}</p>
              </div>
              <div className="text-xs text-slate-500 shrink-0 tabular-nums">
                {row.wins}V · {row.losses}D
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matchs */}
      <div className="p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Matchs</p>
        {pool.matches.map((m) => (
          <MatchRow
            key={m.id}
            match={m}
            teamALabel={teamLabel(m.teamAId)}
            teamBLabel={teamLabel(m.teamBId)}
            onUpdate={(patch) => onUpdateMatch(m.id, patch)}
          />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Saisie d'un match (2 sets de 21 pts)
// ───────────────────────────────────────────────────────────
function MatchRow({ match, teamALabel, teamBLabel, onUpdate }: {
  match: Match;
  teamALabel: string;
  teamBLabel: string;
  onUpdate: (patch: Partial<Match>) => void;
}) {
  function setScore(key: keyof Match, val: string) {
    if (match.locked) return;
    const n = val === "" ? undefined : Math.max(0, Math.min(30, Number(val) || 0));
    onUpdate({ [key]: n });
  }
  const filled = match.set1A !== undefined && match.set1B !== undefined;

  return (
    <div className={`rounded-lg border p-2 ${match.locked ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
        <span className="text-slate-700 truncate text-right">{teamALabel}</span>
        <span className="text-slate-300 text-[10px]">vs</span>
        <span className="text-slate-700 truncate">{teamBLabel}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-2">
        <div className="flex justify-end gap-1">
          <input type="number" inputMode="numeric" min={0} max={30}
            className="input !text-sm w-12 text-center !px-1 !py-1 tabular-nums"
            placeholder="-" disabled={match.locked}
            value={match.set1A ?? ""} onChange={(e) => setScore("set1A", e.target.value)} />
          <input type="number" inputMode="numeric" min={0} max={30}
            className="input !text-sm w-12 text-center !px-1 !py-1 tabular-nums"
            placeholder="-" disabled={match.locked}
            value={match.set2A ?? ""} onChange={(e) => setScore("set2A", e.target.value)} />
        </div>
        <span className="text-slate-300 text-[10px]">-</span>
        <div className="flex gap-1">
          <input type="number" inputMode="numeric" min={0} max={30}
            className="input !text-sm w-12 text-center !px-1 !py-1 tabular-nums"
            placeholder="-" disabled={match.locked}
            value={match.set1B ?? ""} onChange={(e) => setScore("set1B", e.target.value)} />
          <input type="number" inputMode="numeric" min={0} max={30}
            className="input !text-sm w-12 text-center !px-1 !py-1 tabular-nums"
            placeholder="-" disabled={match.locked}
            value={match.set2B ?? ""} onChange={(e) => setScore("set2B", e.target.value)} />
        </div>
      </div>
      {filled && (
        <div className="flex justify-end mt-1.5">
          {match.locked ? (
            <button onClick={() => onUpdate({ locked: false })} className="text-[10px] text-emerald-700 hover:text-emerald-900 underline">
              🔓 Déverrouiller (admin)
            </button>
          ) : (
            <button onClick={() => onUpdate({ locked: true })} className="text-[10px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
              <Save className="w-3 h-3" /> Verrouiller le score
            </button>
          )}
        </div>
      )}
    </div>
  );
}
