"use client";

import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { PhaseProgramme } from "@/lib/types";
import { matchsParEquipe, PROGRAMME_DEFAUT } from "@/lib/interclubLive";

const POINTS = [11, 12, 14, 15, 18, 21];

/** 📋 Programme du tournoi : les phases prévues à l'avance (utilisées telles quelles le jour J) */
export default function ProgrammeEditor({
  programme, nbEquipes, onChange, readOnly, verrouille,
}: {
  programme: PhaseProgramme[];
  nbEquipes: number;
  onChange: (p: PhaseProgramme[]) => void;
  readOnly?: boolean;
  verrouille?: number; // nombre de phases déjà jouées (non modifiables)
}) {
  const maj = (i: number, patch: Partial<PhaseProgramme>) => onChange(programme.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const deplacer = (i: number, d: -1 | 1) => {
    const c = [...programme];
    [c[i], c[i + d]] = [c[i + d], c[i]];
    onChange(c);
  };
  const totalMin = programme.reduce((s, p) => s + matchsParEquipe(nbEquipes, p.poules)[0], 0);
  const totalMax = programme.reduce((s, p) => s + matchsParEquipe(nbEquipes, p.poules)[1], 0);
  const fourchette = (a: number, b: number) => (a === b ? `${a}` : `${a} à ${b}`);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-bold text-[#1e3a5f] text-sm">📋 Programme de la journée</p>
          <p className="text-[11px] text-slate-500">
            Prévu à l&apos;avance : le jour J, chaque tour se lance en un clic avec ces réglages. Le règlement du tournoi s&apos;écrit tout seul à partir de ce programme.
          </p>
        </div>
        {nbEquipes > 1 && programme.length > 0 && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            ≈ {fourchette(totalMin, totalMax)} matchs par équipe sur la journée
          </span>
        )}
      </div>
      {!readOnly && (verrouille ?? 0) > 0 && (
        <p className="px-4 py-2 text-[11px] text-amber-800 bg-amber-50 border-b border-amber-200">
          🔒 Les tours déjà lancés le jour J ne peuvent plus être modifiés (les poules et les matchs sont créés). Les tours suivants restent modifiables.
          Pour tout recommencer : bouton « 🏁 Jour J » → « Réinitialiser le jour J » en bas de la table de marque.
        </p>
      )}
      <div className="divide-y divide-slate-100">
        {programme.map((p, i) => {
          const bloque = readOnly || (verrouille ?? 0) > i;
          const [mn, mx] = matchsParEquipe(nbEquipes, p.poules);
          return (
            <div key={i} className={`px-4 py-3 flex flex-wrap items-center gap-2 ${bloque ? "bg-slate-50/70" : ""}`}>
              <span className="w-7 h-7 shrink-0 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <input
                className="input !py-1.5 !text-sm w-32"
                value={p.nom}
                disabled={bloque}
                placeholder="Nom du tour"
                onChange={(e) => maj(i, { nom: e.target.value })}
              />
              <select className="input !py-1.5 !text-sm w-auto" value={p.poules} disabled={bloque} onChange={(e) => maj(i, { poules: Number(e.target.value) })}>
                {Array.from({ length: 12 }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n} poule{n > 1 ? "s" : ""}</option>)}
              </select>
              <select className="input !py-1.5 !text-sm w-auto" value={p.format.sets} disabled={bloque} onChange={(e) => maj(i, { format: { ...p.format, sets: Number(e.target.value) === 1 ? 1 : 3 } })}>
                <option value={1}>1 set</option>
                <option value={3}>2 sets gagnants</option>
              </select>
              <select className="input !py-1.5 !text-sm w-auto" value={p.format.points} disabled={bloque} onChange={(e) => maj(i, { format: { ...p.format, points: Number(e.target.value) } })}>
                {POINTS.map((n) => <option key={n} value={n}>{n} pts</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={p.format.cassant} disabled={bloque} onChange={(e) => maj(i, { format: { ...p.format, cassant: e.target.checked } })} />
                cassants
              </label>
              {nbEquipes > 1 && <span className="text-[11px] text-slate-500">≈ {fourchette(mn, mx)} match{mx > 1 ? "s" : ""}/équipe</span>}
              {bloque && !readOnly && <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">🔒 déjà lancé le jour J</span>}
              {!bloque && (
                <span className="ml-auto flex items-center gap-1">
                  <button onClick={() => deplacer(i, -1)} disabled={i === 0 || (verrouille ?? 0) > i - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Monter"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deplacer(i, 1)} disabled={i === programme.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Descendre"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onChange(programme.filter((_, k) => k !== i))} disabled={programme.length <= 1} className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30" title="Retirer ce tour"><Trash2 className="w-3.5 h-3.5" /></button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <div className="px-4 py-2 border-t border-slate-100 flex gap-3">
          <button
            onClick={() => {
              const der = programme[programme.length - 1] || PROGRAMME_DEFAUT[0];
              onChange([...programme, { nom: `Tour ${programme.length + 1}`, poules: der.poules, format: { ...der.format } }]);
            }}
            className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter un tour
          </button>
          {programme.length === 0 && (
            <button onClick={() => onChange(PROGRAMME_DEFAUT.map((p) => ({ ...p, format: { ...p.format } })))} className="text-xs font-semibold text-blue-600 hover:underline">
              Utiliser le programme habituel (brassage, 2ᵉ tour, finale)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
