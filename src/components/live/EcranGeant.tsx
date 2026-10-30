"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, Radio, AlertTriangle, Trophy } from "lucide-react";
import { interclubLive } from "@/lib/db";
import { LivePhase, LivePoule } from "@/lib/types";
import { classementPoule, classementFinal, formatTexte, matchJoue, vainqueur } from "@/lib/interclubLive";
import type { EquipesMap } from "./LiveBoard";

type Donnees = Awaited<ReturnType<typeof interclubLive>>;

// Le tableau est dessiné sur une largeur fixe puis réduit pour tenir dans l'écran,
// quel que soit le nombre d'équipes : jamais besoin de faire défiler.
const LARGEUR = 1920;

/** 📺 Écran géant pour la salle : tableau en lecture seule, actualisé toutes les 5 s */
export default function EcranGeant({ liveToken }: { liveToken: string }) {
  const [d, setD] = useState<Donnees | null>(null);
  const [maj, setMaj] = useState<Date | null>(null);

  useEffect(() => {
    let actif = true;
    let enCours = false;
    const charger = () => {
      if (enCours) return;
      enCours = true;
      // Une coupure réseau passagère ne doit pas effacer le tableau déjà affiché
      interclubLive(liveToken).then((r) => { if (!actif) return; setD((prev) => (r.ok || !prev ? r : prev)); if (r.ok) setMaj(new Date()); }).finally(() => { enCours = false; });
    };
    charger();
    const iv = setInterval(charger, 5000);
    return () => { actif = false; clearInterval(iv); };
  }, [liveToken]);

  if (!d) {
    return <Fond><div className="flex flex-col items-center gap-3 py-40 text-white/70"><Loader2 className="w-10 h-10 animate-spin" /> Chargement…</div></Fond>;
  }
  if (!d.ok || !d.live) {
    return (
      <Fond>
        <div className="max-w-md mx-auto text-center py-40 text-white">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-lg">{d.reason || "Le tournoi n'a pas encore commencé."}</p>
        </div>
      </Fond>
    );
  }

  const live = d.live;
  const phase = live.phases[live.phases.length - 1];
  return (
    <AjusteEcran>
      <header className="flex items-center justify-between gap-6 mb-5">
        <div className="flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SACCB" className="w-20 h-20 rounded-2xl bg-white/10 p-2" />
          <div>
            <p className="text-base uppercase tracking-[0.35em] text-emerald-300">Tournoi inter-clubs</p>
            <h1 className="text-6xl font-bold leading-none" style={{ fontFamily: "'Bebas Neue', Oswald, sans-serif", letterSpacing: "0.04em" }}>
              {d.tournoi?.name}
            </h1>
          </div>
        </div>
        {phase && (
          <div className="text-center">
            <p className="text-4xl font-bold">{live.termine ? "Classement final" : phase.nom}</p>
            {!live.termine && <p className="text-lg text-white/60">{formatTexte(phase.format)}</p>}
          </div>
        )}
        <div className="text-right">
          <p className="flex items-center gap-2 justify-end text-3xl font-bold">
            <Radio className={`w-8 h-8 ${live.termine ? "" : "text-red-400 animate-pulse"}`} /> {live.termine ? "Résultats" : "En direct"}
          </p>
          {maj && <p className="text-base text-white/50">Mis à jour à {maj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>}
        </div>
      </header>

      {phase && (live.termine
        ? <PodiumFinal phase={phase} equipes={live.equipes} />
        : <GrillePoules phase={phase} equipes={live.equipes} />)}
    </AjusteEcran>
  );
}

/** Réduit le contenu (dessiné en 1920 px de large) pour qu'il tienne en entier dans la fenêtre */
function AjusteEcran({ children }: { children: React.ReactNode }) {
  const contenu = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(1);
  const [hauteur, setHauteur] = useState(0);

  useLayoutEffect(() => {
    const el = contenu.current;
    if (!el) return;
    const calcul = () => {
      const h = el.scrollHeight;
      setHauteur(h);
      setEchelle(Math.min(window.innerWidth / LARGEUR, window.innerHeight / h));
    };
    calcul();
    const ro = new ResizeObserver(calcul);
    ro.observe(el);
    window.addEventListener("resize", calcul);
    return () => { ro.disconnect(); window.removeEventListener("resize", calcul); };
  }, []);

  return (
    <Fond plein>
      <div
        style={{
          width: LARGEUR,
          transform: `scale(${echelle})`,
          transformOrigin: "top left",
          position: "absolute",
          top: Math.max(0, (typeof window !== "undefined" ? window.innerHeight : 0) - hauteur * echelle) / 2,
          left: Math.max(0, (typeof window !== "undefined" ? window.innerWidth : 0) - LARGEUR * echelle) / 2,
        }}
      >
        <div ref={contenu} className="px-8 py-6 text-white">{children}</div>
      </div>
    </Fond>
  );
}

function Fond({ children, plein }: { children: React.ReactNode; plein?: boolean }) {
  return (
    <div className={`bg-gradient-to-br from-[#0f2440] via-[#1e3a5f] to-[#0f2440] ${plein ? "fixed inset-0 overflow-hidden" : "min-h-screen"}`}>
      {children}
    </div>
  );
}

/** Nombre de colonnes adapté à un écran 16/9 */
function colonnes(n: number): number {
  if (n <= 4) return n;
  if (n <= 6) return 3;
  if (n <= 8) return 4;
  return 5;
}

function GrillePoules({ phase, equipes }: { phase: LivePhase; equipes: EquipesMap }) {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${colonnes(phase.poules.length)}, minmax(0, 1fr))` }}>
      {phase.poules.map((p) => <PouleTV key={p.id} poule={p} equipes={equipes} />)}
    </div>
  );
}

const nom = (equipes: EquipesMap, id: string) => {
  const e = equipes[id];
  return e ? `${e.joueur1} / ${e.joueur2}` : "—";
};

function PouleTV({ poule, equipes }: { poule: LivePoule; equipes: EquipesMap }) {
  const cl = classementPoule(poule);
  const joues = poule.matchs.filter(matchJoue).length;
  return (
    <div className="bg-white text-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="px-4 py-2 bg-gradient-to-r from-[#1e3a5f] to-[#2a5285] text-white flex items-center justify-between">
        <p className="text-2xl font-bold">{poule.nom}</p>
        <p className="text-base text-white/70">{joues}/{poule.matchs.length} matchs</p>
      </div>
      {/* Classement */}
      <table className="w-full table-fixed">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-slate-400">
            <th className="w-10 py-1" />
            <th className="text-left py-1">Équipe</th>
            <th className="w-10 py-1">V</th>
            <th className="w-14 py-1 pr-3">+/-</th>
          </tr>
        </thead>
        <tbody>
          {cl.map((l, i) => (
            <tr key={l.id} className={`border-t border-slate-100 ${l.retiree ? "opacity-40 line-through" : ""}`}>
              <td className="pl-3 py-1.5">
                <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-sm font-bold ${i === 0 && l.joues > 0 ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
              </td>
              <td className="py-1.5 pr-2 overflow-hidden">
                <p className="text-lg font-semibold leading-tight truncate">{nom(equipes, l.id)}</p>
                <p className="text-sm text-slate-500 leading-tight truncate">{equipes[l.id]?.club}</p>
              </td>
              <td className="text-center text-2xl font-bold text-[#1e3a5f]">{l.v}</td>
              <td className="text-center pr-3 text-base text-slate-500">{l.ptsPour - l.ptsContre > 0 ? "+" : ""}{l.ptsPour - l.ptsContre}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Matchs (compacts, sur deux colonnes) */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2 bg-slate-50 border-t border-slate-200">
        {poule.matchs.map((m) => {
          const w = vainqueur(m);
          const e1 = equipes[m.a], e2 = equipes[m.b];
          const court = (e?: { joueur1: string; joueur2: string }) => (e ? `${e.joueur1.split(" ")[0]}/${e.joueur2.split(" ")[0]}` : "—");
          return (
            <div key={m.id} className="flex items-center gap-1.5 text-sm leading-tight min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${m.forfait ? "bg-red-500" : m.conteste && m.etat !== "valide" ? "bg-violet-500" : !matchJoue(m) ? "bg-slate-300" : m.etat === "valide" || m.par === "admin" ? "bg-emerald-500" : "bg-amber-400"}`} />
              <span className={`truncate ${w === m.a ? "font-bold" : w ? "text-slate-400" : ""}`}>{court(e1)}</span>
              <span className="shrink-0 font-mono font-bold text-[#1e3a5f]">{matchJoue(m) ? m.sa!.map((v, i) => `${v}-${m.sb![i]}`).join(" ") : "–"}</span>
              <span className={`truncate ${w === m.b ? "font-bold" : w ? "text-slate-400" : ""}`}>{court(e2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PodiumFinal({ phase, equipes }: { phase: LivePhase; equipes: EquipesMap }) {
  const ordre = classementFinal(phase);
  const podium = ordre.slice(0, 3);
  const reste = ordre.slice(3);
  const cols = reste.length > 24 ? 4 : 3;
  const parCol = Math.ceil(reste.length / cols);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-5 items-end">
        {[1, 0, 2].map((rang) => podium[rang] && (
          <div key={rang} className={`rounded-3xl text-center p-6 shadow-2xl ${rang === 0 ? "bg-gradient-to-b from-amber-300 to-amber-500 pb-12" : rang === 1 ? "bg-gradient-to-b from-slate-200 to-slate-400" : "bg-gradient-to-b from-orange-200 to-orange-400"} text-slate-900`}>
            <Trophy className="w-12 h-12 mx-auto mb-2" />
            <p className="text-5xl font-black">{rang + 1}</p>
            <p className="text-3xl font-bold mt-2">{nom(equipes, podium[rang])}</p>
            <p className="text-xl opacity-70">{equipes[podium[rang]]?.club}</p>
          </div>
        ))}
      </div>
      {reste.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, c) => (
            <ol key={c} className="bg-white text-slate-800 rounded-2xl overflow-hidden shadow-xl divide-y divide-slate-100">
              {reste.slice(c * parCol, (c + 1) * parCol).map((id, i) => (
                <li key={id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center">{4 + c * parCol + i}</span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold truncate">{nom(equipes, id)}</span>
                    <span className="block text-sm text-slate-500 truncate">{equipes[id]?.club}</span>
                  </span>
                </li>
              ))}
            </ol>
          ))}
        </div>
      )}
    </div>
  );
}
