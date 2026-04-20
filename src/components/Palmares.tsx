"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, Star, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { DB, InscritTournoi, Tournoi } from "@/lib/types";

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

function buildResults(config_tournois: Tournoi[], inscrits_tournoi: InscritTournoi[]): TournoiResult[] {
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
    const players = r.joueurs.split("/").map((p) => p.trim()).filter(Boolean);
    for (const nom of players) {
      const existing = map.get(nom);
      if (!existing) {
        map.set(nom, { nom, tournaments: 1, bestRank: r.rank, bestTotal: r.total, podiums: r.rank <= 3 ? 1 : 0 });
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
    <div className="border-b border-[color:var(--line)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="flex items-baseline gap-4">
          <Trophy className="w-5 h-5 text-[color:var(--gold)] self-center" />
          <span className="font-display text-2xl md:text-3xl tracking-tight text-[color:var(--ink)]">{label}</span>
          <span className="text-xs text-[color:var(--muted)]" style={{ fontFamily: "Oswald, sans-serif" }}>
            {results.length} résultat{results.length > 1 ? "s" : ""}
          </span>
        </span>
        {open ? <ChevronUp className="w-5 h-5 text-[color:var(--muted)] group-hover:text-[color:var(--ink)]" /> : <ChevronDown className="w-5 h-5 text-[color:var(--muted)] group-hover:text-[color:var(--ink)]" />}
      </button>

      {open && (
        <div className="pb-10 space-y-10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)] mb-5 font-semibold flex items-center gap-2" style={{ fontFamily: "Oswald, sans-serif" }}>
              <Medal className="w-3.5 h-3.5" /> Résultats par tournoi
            </p>
            <div className="overflow-x-auto border-t border-[color:var(--line)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-3 py-3 text-[10px] uppercase tracking-[0.22em] font-semibold text-[color:var(--muted)]" style={{ fontFamily: "Oswald, sans-serif" }}>Tournoi</th>
                    <th className="px-3 py-3 text-[10px] uppercase tracking-[0.22em] font-semibold text-[color:var(--muted)]" style={{ fontFamily: "Oswald, sans-serif" }}>Binôme</th>
                    <th className="px-3 py-3 text-[10px] uppercase tracking-[0.22em] font-semibold text-[color:var(--muted)] text-right" style={{ fontFamily: "Oswald, sans-serif" }}>Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const medal = getMedal(r.rank);
                    return (
                      <tr key={i} className="border-t border-[color:var(--line)]">
                        <td className="px-3 py-3">
                          <p className="text-[color:var(--ink)] font-medium">{r.tournoiName}</p>
                          {r.tournoiDate && <p className="text-xs text-[color:var(--muted)]">{r.tournoiDate}</p>}
                        </td>
                        <td className="px-3 py-3 text-[color:var(--ink)]/80">{r.joueurs}</td>
                        <td className="px-3 py-3 text-right">
                          <span className="inline-flex items-center gap-1.5 tabular-nums" style={{ fontFamily: "Oswald, sans-serif" }}>
                            {medal && <span>{medal}</span>}
                            <span className={`text-sm font-semibold ${r.rank <= 3 ? "text-[color:var(--gold)]" : "text-[color:var(--ink)]/70"}`}>
                              {r.rank} / {r.total}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {stats.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)] mb-5 font-semibold flex items-center gap-2" style={{ fontFamily: "Oswald, sans-serif" }}>
                <Star className="w-3.5 h-3.5" /> Stats par joueur
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[color:var(--line)] border border-[color:var(--line)]">
                {stats.map((s) => (
                  <div key={s.nom} className="bg-[color:var(--bone)] p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[color:var(--ink)] font-semibold">{s.nom}</p>
                      <p className="text-xs text-[color:var(--muted)] mt-0.5">
                        {s.tournaments} tournoi{s.tournaments > 1 ? "s" : ""}
                        {s.podiums > 0 && ` · ${s.podiums} podium${s.podiums > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] uppercase tracking-[0.22em] text-[color:var(--muted)] font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>Meilleur</p>
                      <span className={`text-sm font-bold ${s.bestRank <= 3 ? "text-[color:var(--gold)]" : "text-[color:var(--ink)]"}`}>
                        {getMedal(s.bestRank) || ""} {s.bestRank}/{s.bestTotal}
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

export default function Palmares({ db }: { db: DB }) {
  const currentResults = buildResults(db.config_tournois ?? [], db.inscrits_tournoi ?? []);
  const archives = db.archives ?? [];

  const hasAnyData =
    currentResults.length > 0 ||
    archives.some((a) => buildResults(a.config_tournois, a.inscrits_tournoi).length > 0);

  if (!hasAnyData) return null;

  return (
    <section id="palmares" className="bg-section-wrap">
      <div className="section-pad">
        <header className="section-head">
          <div>
            <span className="section-index">05 — Archives</span>
            <h2 className="h-title text-5xl md:text-7xl lg:text-8xl mt-4">
              Palmarès <span className="font-editorial italic font-normal">du club.</span>
            </h2>
          </div>
          <p className="hidden md:block text-[color:var(--muted)] max-w-xs text-right text-sm leading-relaxed">
            Les résultats en tournois extérieurs, saison par saison.
          </p>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="border-t border-[color:var(--line)]"
        >
          {currentResults.length > 0 && (
            <SeasonBlock
              label={`Saison ${db.y1}–${db.y2} (en cours)`}
              config_tournois={db.config_tournois ?? []}
              inscrits_tournoi={db.inscrits_tournoi ?? []}
              defaultOpen
            />
          )}

          {[...archives].reverse().map((archive, i) => (
            <SeasonBlock
              key={i}
              label={`Saison ${archive.y1}–${archive.y2}`}
              config_tournois={archive.config_tournois}
              inscrits_tournoi={archive.inscrits_tournoi}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
