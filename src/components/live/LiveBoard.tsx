"use client";

import { useState } from "react";
import { Check, Clock, Trophy, Loader2 } from "lucide-react";
import { LiveFormat, LiveMatch, LivePhase, LivePoule } from "@/lib/types";
import { classementPoule, classementFinal, erreurScore, formatTexte, matchJoue, vainqueur, phaseTerminee } from "@/lib/interclubLive";

export type EquipesMap = Record<string, { joueur1: string; joueur2: string; niveau?: string; club: string; mine?: boolean }>;

const NIVEAU_COULEUR: Record<string, string> = {
  "Très confirmé": "bg-amber-100 text-amber-800",
  Confirmé: "bg-emerald-100 text-emerald-800",
  Intermédiaire: "bg-slate-200 text-slate-700",
  Débutant: "bg-sky-100 text-sky-800",
};

export function NomEquipe({ id, equipes, compact, grand }: { id: string; equipes: EquipesMap; compact?: boolean; grand?: boolean }) {
  const e = equipes[id];
  if (!e) return <span className="text-slate-400 italic">Équipe retirée</span>;
  return (
    <span className="min-w-0">
      <span className={`block truncate font-semibold ${grand ? "text-lg" : "text-sm"} ${e.mine ? "text-emerald-700" : "text-slate-800"}`}>
        {e.joueur1} / {e.joueur2}
      </span>
      {!compact && (
        <span className={`block truncate ${grand ? "text-sm" : "text-[11px]"} text-slate-500`}>
          {e.club}
          {e.niveau && <span className={`ml-1.5 px-1.5 rounded ${NIVEAU_COULEUR[e.niveau] || "bg-slate-100 text-slate-600"}`}>{e.niveau}</span>}
        </span>
      )}
    </span>
  );
}

/** Score affiché « 12-8 » ou « 14-10 · 8-14 · 14-12 », du point de vue de l'équipe a */
export function texteScore(m: LiveMatch): string {
  if (!matchJoue(m)) return "";
  return m.sa!.map((v, i) => `${v}-${m.sb![i]}`).join(" · ");
}

export function EtatMatch({ m, clubs }: { m: LiveMatch; clubs?: Record<string, string> }) {
  if (!matchJoue(m)) return <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> à jouer</span>;
  if (m.etat === "valide" || m.par === "admin") return <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> validé</span>;
  return (
    <span className="text-[10px] text-amber-600 font-semibold" title="Le score doit être confirmé par l'adversaire ou l'organisation">
      ⏳ à confirmer{clubs && m.par && clubs[m.par] ? ` · saisi par ${clubs[m.par]}` : ""}
    </span>
  );
}

/** Saisie d'un score set par set */
export function ScoreForm({
  m, format, equipes, initialA, initialB, onSubmit, labelBouton = "Enregistrer le score",
}: {
  m: LiveMatch; format: LiveFormat; equipes: EquipesMap;
  initialA?: number[]; initialB?: number[];
  onSubmit: (sa: number[], sb: number[]) => Promise<string | null>;
  labelBouton?: string;
}) {
  const nbSets = format.sets === 1 ? 1 : 3;
  const init = (v?: number[]) => Array.from({ length: nbSets }, (_, i) => (v && v[i] !== undefined ? String(v[i]) : ""));
  const [a, setA] = useState<string[]>(init(initialA ?? m.sa));
  const [b, setB] = useState<string[]>(init(initialB ?? m.sb));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function envoyer() {
    const sa: number[] = [], sb: number[] = [];
    for (let i = 0; i < nbSets; i++) {
      if (a[i] === "" && b[i] === "") continue;
      if (a[i] === "" || b[i] === "") { setErr(`Set ${i + 1} : remplissez les deux scores.`); return; }
      sa.push(Number(a[i])); sb.push(Number(b[i]));
    }
    const e = erreurScore(sa, sb, format);
    if (e) { setErr(e); return; }
    setBusy(true);
    setErr(null);
    const r = await onSubmit(sa, sb);
    setBusy(false);
    if (r) setErr(r);
  }

  const ligne = (id: string, vals: string[], set: (v: string[]) => void) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0"><NomEquipe id={id} equipes={equipes} compact /></div>
      {vals.map((v, i) => (
        <input
          key={i}
          inputMode="numeric"
          className="w-12 h-10 rounded-lg border border-slate-300 text-center text-lg font-bold focus:border-[#1e3a5f] focus:outline-none"
          value={v}
          placeholder={nbSets > 1 && i === 2 ? "–" : "0"}
          onChange={(e) => { const c = [...vals]; c[i] = e.target.value.replace(/\D/g, "").slice(0, 2); set(c); setErr(null); }}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-2 bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] text-slate-500">{formatTexte(format)}{nbSets > 1 ? " — 3ᵉ set seulement à 1 set partout" : ""}</p>
      {ligne(m.a, a, setA)}
      {ligne(m.b, b, setB)}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button onClick={envoyer} disabled={busy} className="btn-primary w-full !py-2 !text-xs">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {labelBouton}
      </button>
    </div>
  );
}

/** Carte d'une poule : classement + matchs */
export function PouleCard({
  poule, phase, equipes, grand, clubs, renderAction,
}: {
  poule: LivePoule; phase: LivePhase; equipes: EquipesMap; grand?: boolean;
  clubs?: Record<string, string>;
  renderAction?: (m: LiveMatch) => React.ReactNode;
}) {
  const cl = classementPoule(poule);
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#1e3a5f] to-[#2a5285] text-white flex items-center justify-between">
        <p className={`font-bold tracking-wide ${grand ? "text-xl" : ""}`}>{poule.nom}</p>
        <p className="text-[11px] text-white/70">{poule.matchs.filter(matchJoue).length}/{poule.matchs.length} matchs</p>
      </div>
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
            <th className="text-left pl-3 py-1.5 w-10">#</th>
            <th className="text-left py-1.5">Équipe</th>
            <th className="py-1.5 w-8" title="Matchs joués">J</th>
            <th className="py-1.5 w-8" title="Victoires">V</th>
            <th className="py-1.5 w-14 pr-3" title="Différence de points">+/-</th>
          </tr>
        </thead>
        <tbody>
          {cl.map((l, i) => {
            const mine = equipes[l.id]?.mine;
            return (
              <tr key={l.id} className={`border-b border-slate-50 ${mine ? "bg-emerald-50" : ""}`}>
                <td className="pl-3 py-1.5">
                  <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[11px] font-bold ${i === 0 && l.joues > 0 ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                </td>
                <td className="py-1.5 pr-2 overflow-hidden"><NomEquipe id={l.id} equipes={equipes} grand={grand} /></td>
                <td className={`text-center text-slate-500 ${grand ? "text-base" : ""}`}>{l.joues}</td>
                <td className={`text-center font-bold text-[#1e3a5f] ${grand ? "text-lg" : ""}`}>{l.v}</td>
                <td className={`text-center pr-3 text-slate-500 ${grand ? "text-base" : ""}`}>{l.ptsPour - l.ptsContre > 0 ? "+" : ""}{l.ptsPour - l.ptsContre}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="divide-y divide-slate-100 bg-slate-50/60">
        {poule.matchs.map((m) => {
          const w = vainqueur(m);
          return (
            <div key={m.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <div className={`flex-1 min-w-0 text-right ${w === m.a ? "" : w ? "opacity-60" : ""}`}><NomEquipe id={m.a} equipes={equipes} compact grand={grand} /></div>
                <div className={`shrink-0 text-center font-mono font-bold ${grand ? "text-lg min-w-[6rem]" : "text-xs min-w-[4.5rem]"} ${matchJoue(m) ? "text-[#1e3a5f]" : "text-slate-300"}`}>
                  {matchJoue(m) ? texteScore(m) : "vs"}
                </div>
                <div className={`flex-1 min-w-0 ${w === m.b ? "" : w ? "opacity-60" : ""}`}><NomEquipe id={m.b} equipes={equipes} compact grand={grand} /></div>
              </div>
              <div className="flex justify-center mt-0.5"><EtatMatch m={m} clubs={clubs} /></div>
              {renderAction?.(m)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Classement final (après la dernière phase) */
export function ClassementFinal({ phase, equipes, grand }: { phase: LivePhase; equipes: EquipesMap; grand?: boolean }) {
  const ordre = classementFinal(phase);
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-amber-200 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center gap-2">
        <Trophy className="w-5 h-5" /> <p className={`font-bold ${grand ? "text-xl" : ""}`}>Classement final</p>
      </div>
      <ol className="divide-y divide-slate-100">
        {ordre.map((id, i) => (
          <li key={id} className={`flex items-center gap-3 px-4 py-2 ${equipes[id]?.mine ? "bg-emerald-50" : ""}`}>
            <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${
              i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-300 text-white" : i === 2 ? "bg-orange-300 text-white" : "bg-slate-100 text-slate-500"
            }`}>
              {i + 1}
            </span>
            <NomEquipe id={id} equipes={equipes} grand={grand} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Tableau complet : onglets de phases + poules (+ classement final) */
export function LiveBoard({
  phases, equipes, termine, grand, clubs, renderAction, phaseInitiale,
}: {
  phases: LivePhase[]; equipes: EquipesMap; termine?: boolean; grand?: boolean;
  clubs?: Record<string, string>;
  renderAction?: (m: LiveMatch, ph: LivePhase) => React.ReactNode;
  phaseInitiale?: number;
}) {
  const derniere = phases.length - 1;
  const [choix, setChoix] = useState<number | null>(phaseInitiale ?? null);
  const idx = choix === null || choix > derniere ? derniere : choix;
  const ph = phases[idx];
  if (!ph) return null;
  return (
    <div className="space-y-4">
      {phases.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {phases.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setChoix(i)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition ${
                i === idx ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white/90 text-slate-600 border-slate-200 hover:border-[#1e3a5f]"
              }`}
            >
              {p.nom}{phaseTerminee(p) ? " ✓" : i === derniere && !termine ? " · en cours" : ""}
            </button>
          ))}
        </div>
      )}
      <p className={`text-center ${grand ? "text-base" : "text-xs"} text-white/70`}>{ph.nom} — {formatTexte(ph.format)}</p>
      {termine && idx === derniere && <ClassementFinal phase={ph} equipes={equipes} grand={grand} />}
      <div className={`grid gap-4 ${grand ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2"}`}>
        {ph.poules.map((p) => (
          <PouleCard key={p.id} poule={p} phase={ph} equipes={equipes} grand={grand} clubs={clubs} renderAction={renderAction ? (m) => renderAction(m, ph) : undefined} />
        ))}
      </div>
    </div>
  );
}
