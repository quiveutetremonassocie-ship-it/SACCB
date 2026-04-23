"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, Star, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { useState } from "react";
import { DB, SeasonArchive, InscritTournoi, Tournoi } from "@/lib/types";
import { MemberSession } from "@/lib/useMemberSession";

// ─── Helpers ────────────────────────────────────────────

function parseResultat(r: string): { rank: number; total: number } | null {
  const m = r.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  return { rank: parseInt(m[1]), total: parseInt(m[2]) };
}

function getMedal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

type TournoiResult = {
  tournoiId: string;
  tournoiName: string;
  tournoiDate: string;
  joueurs: string;
  resultat: string;
  rank: number;
  total: number;
};

type PlayerStat = {
  nom: string;
  tournaments: number;
  bestRank: number;
  bestTotal: number;
  podiums: number;
};

function buildResults(
  config_tournois: Tournoi[],
  inscrits_tournoi: InscritTournoi[]
): TournoiResult[] {
  const results: TournoiResult[] = [];
  for (const insc of inscrits_tournoi) {
    if (!insc.resultat) continue;
    const parsed = parseResultat(insc.resultat);
    if (!parsed) continue;
    const tournoi = config_tournois.find((t) => t.id === insc.tournoiId);
    results.push({
      tournoiId: insc.tournoiId,
      tournoiName: tournoi?.name ?? "Tournoi inconnu",
      tournoiDate: tournoi?.date ?? "",
      joueurs: insc.joueurs,
      resultat: insc.resultat,
      rank: parsed.rank,
      total: parsed.total,
    });
  }
  return results.sort((a, b) => a.rank - b.rank);
}

function buildPlayerStats(results: TournoiResult[]): PlayerStat[] {
  const map = new Map<string, PlayerStat>();
  for (const r of results) {
    // "Joueur1 / Joueur2" → deux joueurs
    const players = r.joueurs.split("/").map((p) => p.trim()).filter(Boolean);
    for (const nom of players) {
      const existing = map.get(nom);
      if (!existing) {
        map.set(nom, {
          nom,
          tournaments: 1,
          bestRank: r.rank,
          bestTotal: r.total,
          podiums: r.rank <= 3 ? 1 : 0,
        });
      } else {
        existing.tournaments++;
        if (r.rank < existing.bestRank || (r.rank === existing.bestRank && r.total > existing.bestTotal)) {
          existing.bestRank = r.rank;
          existing.bestTotal = r.total;
        }
        if (r.rank <= 3) existing.podiums++;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.bestRank - b.bestRank || b.podiums - a.podiums);
}

// ─── Composants ─────────────────────────────────────────

function SeasonBlock({
  label,
  config_tournois,
  inscrits_tournoi,
  defaultOpen,
}: {
  label: string;
  config_tournois: Tournoi[];
  inscrits_tournoi: InscritTournoi[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const results = buildResults(config_tournois, inscrits_tournoi);
  const stats = buildPlayerStats(results);
  const hasData = results.length > 0;

  if (!hasData) return null;

  return (
    <div className="glass-sport overflow-hidden mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="font-display text-xl text-slate-800 tracking-wider">{label}</span>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {results.length} résultat{results.length > 1 ? "s" : ""}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-6">
          {/* Tableau des résultats */}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1">
              <Medal className="w-3.5 h-3.5" /> Résultats par tournoi
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500 rounded-l-lg">Tournoi</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500">Binôme</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-center rounded-r-lg">Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const medal = getMedal(r.rank);
                    return (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <p className="text-slate-800 font-medium">{r.tournoiName}</p>
                          {r.tournoiDate && (
                            <p className="text-xs text-slate-400">{r.tournoiDate}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.joueurs}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                            r.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                            r.rank === 2 ? "bg-slate-100 text-slate-600" :
                            r.rank === 3 ? "bg-amber-100 text-amber-700" :
                            "bg-slate-50 text-slate-500"
                          }`}>
                            {medal && <span>{medal}</span>}
                            {r.rank}e / {r.total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stats par joueur */}
          {stats.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1">
                <Star className="w-3.5 h-3.5" /> Stats par joueur
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {stats.map((s) => (
                  <div key={s.nom} className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-slate-800 font-semibold text-sm">{s.nom}</p>
                      <p className="text-xs text-slate-400">
                        {s.tournaments} tournoi{s.tournaments > 1 ? "s" : ""} joué{s.tournaments > 1 ? "s" : ""}
                        {s.podiums > 0 && ` · ${s.podiums} podium${s.podiums > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Meilleur</p>
                      <span className={`text-sm font-bold ${s.bestRank <= 3 ? "text-amber-600" : "text-slate-600"}`}>
                        {getMedal(s.bestRank) || ""} {s.bestRank}e/{s.bestTotal}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────

export default function Palmares({ db, memberSession, onLoginRequest }: {
  db: DB;
  memberSession: MemberSession | null;
  onLoginRequest?: () => void;
}) {
  const currentResults = buildResults(db.config_tournois ?? [], db.inscrits_tournoi ?? []);
  const archives = db.archives ?? [];

  const hasAnyData = currentResults.length > 0 || archives.some((a) =>
    buildResults(a.config_tournois, a.inscrits_tournoi).length > 0
  );

  if (!hasAnyData) return null;

  return (
    <section id="palmares" className="bg-section-wrap relative">
      <div className="section-pad relative">
        <div className="text-center mb-14">
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-amber-600">Historique</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Palmarès</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Les résultats du club en tournois extérieurs.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {!memberSession ? (
            <div className="glass-strong p-10 text-center max-w-md mx-auto">
              <Lock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-display text-xl text-slate-700 tracking-wider mb-2">Réservé aux membres</h3>
              <p className="text-slate-500 text-sm mb-6">
                Le palmarès et les classements sont accessibles aux adhérents connectés uniquement.
              </p>
              {onLoginRequest && (
                <button onClick={onLoginRequest} className="btn-primary !px-8">
                  Se connecter
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Saison en cours */}
              {currentResults.length > 0 && (
                <SeasonBlock
                  label={`Saison ${db.y1}–${db.y2} (en cours)`}
                  config_tournois={db.config_tournois ?? []}
                  inscrits_tournoi={db.inscrits_tournoi ?? []}
                  defaultOpen={true}
                />
              )}

              {/* Saisons archivées */}
              {[...archives].reverse().map((archive, i) => (
                <SeasonBlock
                  key={i}
                  label={`Saison ${archive.y1}–${archive.y2}`}
                  config_tournois={archive.config_tournois}
                  inscrits_tournoi={archive.inscrits_tournoi}
                  defaultOpen={false}
                />
              ))}
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
