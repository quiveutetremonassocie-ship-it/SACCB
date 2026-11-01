"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { LivePhase, LivePoule } from "@/lib/types";
import { classementPoule, uidLive } from "@/lib/interclubLive";
import { EquipesMap } from "../live/LiveBoard";

/** ✋ Prendre la main : ajuster un classement à la main, ou déplacer un binôme dans une autre poule */
export default function ReglageManuel({
  phase, equipes, onSave, busy, tours, onTour,
}: {
  phase: LivePhase;
  equipes: EquipesMap;
  onSave: (ph: LivePhase) => Promise<void>;
  busy?: boolean;
  tours?: { id: string; nom: string }[]; // tous les tours lancés (pour corriger un tour précédent)
  onTour?: (id: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  // ✏️ Nom et format du tour (modifiables à tout moment)
  const [nomTour, setNomTour] = useState(phase.nom);
  const [sets, setSets] = useState<1 | 3>(phase.format.sets);
  const [points, setPoints] = useState(phase.format.points);
  const [cassant, setCassant] = useState(phase.format.cassant);
  useEffect(() => {
    setNomTour(phase.nom); setSets(phase.format.sets); setPoints(phase.format.points); setCassant(phase.format.cassant);
  }, [phase.id, phase.nom, phase.format.sets, phase.format.points, phase.format.cassant]);
  const formatChange = nomTour.trim() !== phase.nom || sets !== phase.format.sets || points !== phase.format.points || cassant !== phase.format.cassant;
  const [pouleId, setPouleId] = useState(phase.poules[0]?.id || "");
  const poule = phase.poules.find((p) => p.id === pouleId) || phase.poules[0];
  if (!poule) return null;
  const ordre = classementPoule(poule).map((l) => l.id);
  const nom = (id: string) => (equipes[id] ? `${equipes[id].joueur1} / ${equipes[id].joueur2}` : "?");

  const majPoule = (p: LivePoule) => onSave({ ...phase, poules: phase.poules.map((x) => (x.id === p.id ? p : x)) });

  function bouger(i: number, d: -1 | 1) {
    const o = [...ordre];
    [o[i], o[i + d]] = [o[i + d], o[i]];
    majPoule({ ...poule, ordreManuel: o });
  }

  function deplacer(id: string, versId: string) {
    const vers = phase.poules.find((p) => p.id === versId);
    if (!vers) return;
    const joues = poule.matchs.filter((m) => (m.a === id || m.b === id) && m.sa && m.sa.length > 0).length;
    if (!confirm(`Déplacer ${nom(id)} de la ${poule.nom} vers la ${vers.nom} ?\n\n${joues > 0 ? `⚠️ Ses ${joues} match(s) déjà joué(s) dans la ${poule.nom} seront retirés. ` : ""}De nouveaux matchs sont créés contre les équipes de la ${vers.nom}.`)) return;
    const depart: LivePoule = {
      ...poule,
      equipes: poule.equipes.filter((x) => x !== id),
      matchs: poule.matchs.filter((m) => m.a !== id && m.b !== id),
      ordreManuel: poule.ordreManuel?.filter((x) => x !== id),
      retirees: poule.retirees?.filter((x) => x !== id),
    };
    const arrivee: LivePoule = {
      ...vers,
      equipes: [...vers.equipes, id],
      matchs: [...vers.matchs, ...vers.equipes.map((autre, k) => (k % 2 ? { id: uidLive(), a: autre, b: id } : { id: uidLive(), a: id, b: autre }))],
    };
    onSave({ ...phase, poules: phase.poules.map((x) => (x.id === depart.id ? depart : x.id === arrivee.id ? arrivee : x)) });
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3">
      <button onClick={() => setOuvert(!ouvert)} className="w-full text-left flex items-center justify-between gap-2">
        <span>
          <span className="block text-sm font-bold text-slate-800">✋ Prendre la main (erreur, cas particulier)</span>
          <span className="block text-xs text-slate-600">Changer le nom ou le format d&apos;un tour, l&apos;ordre d&apos;un classement, ou déplacer un binôme dans une autre poule — à tout moment, même pour un tour déjà joué.</span>
        </span>
        <span className="text-slate-500 text-sm">{ouvert ? "▲" : "▼"}</span>
      </button>

      {ouvert && (
        <>
          {tours && tours.length > 1 && onTour && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Tour :</span>
              {tours.map((t) => (
                <button key={t.id} onClick={() => onTour(t.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${t.id === phase.id ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-600 border-slate-300"}`}>
                  {t.nom}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-600">Nom et format de « {phase.nom} »</p>
            <div className="flex flex-wrap items-center gap-2">
              <input className="input !py-1.5 !text-sm w-40" value={nomTour} onChange={(e) => setNomTour(e.target.value)} maxLength={40} />
              <select className="input !py-1.5 !text-sm w-auto" value={sets} onChange={(e) => setSets(Number(e.target.value) === 3 ? 3 : 1)}>
                <option value={1}>1 set</option>
                <option value={3}>2 sets gagnants</option>
              </select>
              <label className="text-sm text-slate-600 flex items-center gap-1">
                en <input type="number" min={5} max={30} className="input !py-1.5 !text-sm w-16" value={points} onChange={(e) => setPoints(Math.max(5, Math.min(30, Number(e.target.value) || 0)))} /> points
              </label>
              <label className="text-sm text-slate-600 flex items-center gap-1.5">
                <input type="checkbox" checked={cassant} onChange={(e) => setCassant(e.target.checked)} /> point cassant
              </label>
              <button
                onClick={() => onSave({ ...phase, nom: nomTour.trim() || phase.nom, format: { sets, points, cassant } })}
                disabled={busy || !formatChange}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white disabled:opacity-40"
              >
                Enregistrer
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Les scores déjà saisis sont gardés ; le nouveau format s&apos;applique aux prochaines saisies.</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {phase.poules.map((p) => (
              <button key={p.id} onClick={() => setPouleId(p.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${p.id === poule.id ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white text-slate-600 border-slate-300"}`}>
                {p.nom}{p.ordreManuel?.length ? " ✋" : ""}
              </button>
            ))}
          </div>

          <ol className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {ordre.map((id, i) => (
              <li key={id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="w-6 text-xs font-bold text-slate-400">{i + 1}.</span>
                <span className="flex-1 min-w-0 truncate">{nom(id)} <span className="text-[11px] text-slate-400">{equipes[id]?.club}</span></span>
                <button onClick={() => bouger(i, -1)} disabled={busy || i === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30" title="Monter"><ArrowUp className="w-4 h-4" /></button>
                <button onClick={() => bouger(i, 1)} disabled={busy || i === ordre.length - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30" title="Descendre"><ArrowDown className="w-4 h-4" /></button>
                {phase.poules.length > 1 && (
                  <select value="" disabled={busy} onChange={(e) => e.target.value && deplacer(id, e.target.value)}
                    className="text-[11px] border border-slate-200 rounded px-1 py-0.5 text-slate-500" title="Déplacer dans une autre poule">
                    <option value="">Poule…</option>
                    {phase.poules.filter((p) => p.id !== poule.id).map((p) => <option key={p.id} value={p.id}>→ {p.nom}</option>)}
                  </select>
                )}
              </li>
            ))}
          </ol>

          {poule.ordreManuel?.length ? (
            <button onClick={() => majPoule({ ...poule, ordreManuel: undefined })} disabled={busy}
              className="text-xs font-semibold text-blue-700 hover:underline flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Revenir au classement calculé automatiquement
            </button>
          ) : (
            <p className="text-[11px] text-slate-500">Classement calculé automatiquement (victoires, match entre eux, sets, points). Les flèches le remplacent par ton ordre.</p>
          )}
          <p className="text-[11px] text-slate-500">L&apos;ordre ajusté sert pour le tour suivant, le classement final et le palmarès. La poule affiche « ✋ ajusté » pour tout le monde.</p>
        </>
      )}
    </div>
  );
}
