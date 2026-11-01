"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Medal } from "lucide-react";
import { InscritTournoi, Tournoi, nomCourt } from "@/lib/types";
import { dateISO } from "@/lib/agenda";

type Saison = { y1: number; y2: number; config_tournois?: Tournoi[]; inscrits_tournoi?: InscritTournoi[] };
type Ligne = { id: string; tournoi: string; date: string; dateTexte: string; partenaires: string[]; rank?: number; total?: number };

const medaille = (r?: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "");
const place = (r: number) => (r === 1 ? "1er" : `${r}e`);

/** 🏅 Mon parcours : tous les tournois joués par l'adhérent, saison par saison, avec partenaire et place */
export default function MonParcours({ nom, saisons }: { nom: string; saisons: Saison[] }) {
  const [ouvert, setOuvert] = useState(false);
  const moi = nom.trim().toLowerCase();

  const { parSaison, meilleure, partenaireFavori, total } = useMemo(() => {
    const parSaison: { label: string; lignes: Ligne[] }[] = [];
    const compteur = new Map<string, number>();
    let meilleure: (Ligne & { rank: number; total: number }) | null = null;
    let total = 0;
    for (const s of saisons) {
      const lignes: Ligne[] = [];
      for (const i of s.inscrits_tournoi || []) {
        if (!moi || !i.joueurs.toLowerCase().includes(moi)) continue;
        const t = (s.config_tournois || []).find((x) => x.id === i.tournoiId);
        if (!t) continue;
        const partenaires = i.joueurs.split(/[\/&,+]/).map((x) => x.trim()).filter((x) => x && !x.toLowerCase().includes(moi));
        const m = (i.resultat || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
        const l: Ligne = { id: i.id, tournoi: t.name, date: dateISO(t.date), dateTexte: t.date, partenaires, ...(m ? { rank: +m[1], total: +m[2] } : {}) };
        lignes.push(l);
        partenaires.forEach((p) => compteur.set(p, (compteur.get(p) || 0) + 1));
        if (l.rank && l.total && (!meilleure || l.rank < meilleure.rank || (l.rank === meilleure.rank && l.total > meilleure.total))) {
          meilleure = l as Ligne & { rank: number; total: number };
        }
      }
      if (lignes.length) {
        lignes.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        parSaison.push({ label: `${s.y1}-${s.y2}`, lignes });
        total += lignes.length;
      }
    }
    parSaison.sort((a, b) => b.label.localeCompare(a.label));
    const fav = [...compteur.entries()].sort((a, b) => b[1] - a[1])[0];
    return { parSaison, meilleure, partenaireFavori: fav && fav[1] > 1 ? { nom: fav[0], n: fav[1] } : null, total };
  }, [saisons, moi]);

  if (total === 0) return null;
  const best = meilleure as (Ligne & { rank: number; total: number }) | null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setOuvert(!ouvert)}
        className="flex items-center justify-between w-full text-sm font-medium text-slate-700 border border-slate-200 rounded-xl px-4 py-2.5 hover:bg-slate-50 transition"
      >
        <span className="flex items-center gap-2">
          <Medal className="w-4 h-4 text-emerald-600" />
          Mon parcours
          <span className="text-xs text-slate-400 font-normal">{total} tournoi{total > 1 ? "s" : ""}</span>
        </span>
        {ouvert ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {ouvert && (
        <div className="mt-2 space-y-3">
          {(best || partenaireFavori) && (
            <div className="grid sm:grid-cols-2 gap-2">
              {best && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold">Meilleure place</p>
                  <p className="text-sm font-bold text-slate-800">{medaille(best.rank)} {place(best.rank)} / {best.total}</p>
                  <p className="text-xs text-slate-500 truncate">{best.tournoi}</p>
                </div>
              )}
              {partenaireFavori && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">Partenaire favori</p>
                  <p className="text-sm font-bold text-slate-800">{nomCourt(partenaireFavori.nom)}</p>
                  <p className="text-xs text-slate-500">{partenaireFavori.n} tournois ensemble</p>
                </div>
              )}
            </div>
          )}

          {parSaison.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 overflow-hidden">
              <p className="px-3 py-1.5 bg-slate-100 text-[11px] uppercase tracking-widest font-semibold text-slate-600">Saison {s.label}</p>
              <ul className="divide-y divide-slate-100 bg-white">
                {s.lignes.map((l) => (
                  <li key={l.id} className="px-3 py-2 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{l.tournoi}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {l.date ? new Date(l.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : l.dateTexte}
                        {l.partenaires.length > 0 && <> · avec {l.partenaires.map(nomCourt).join(", ")}</>}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${l.rank && l.rank <= 3 ? "bg-amber-100 text-amber-800" : l.rank ? "bg-slate-100 text-slate-700" : "text-slate-400"}`}>
                      {l.rank ? `${medaille(l.rank)} ${place(l.rank)} / ${l.total}`.trim() : l.date && l.date >= new Date().toISOString().slice(0, 10) ? "À venir" : "Inscrit"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
