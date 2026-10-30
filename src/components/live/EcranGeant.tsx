"use client";

import { useEffect, useState } from "react";
import { Loader2, Radio, AlertTriangle } from "lucide-react";
import { interclubLive } from "@/lib/db";
import { LiveBoard } from "./LiveBoard";

type Donnees = Awaited<ReturnType<typeof interclubLive>>;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2440] via-[#1e3a5f] to-[#0f2440] text-white">
      {!d ? (
        <div className="flex flex-col items-center gap-3 py-40 text-white/70"><Loader2 className="w-10 h-10 animate-spin" /> Chargement…</div>
      ) : !d.ok || !d.live ? (
        <div className="max-w-md mx-auto text-center py-40">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-lg">{d.reason || "Le tournoi n'a pas encore commencé."}</p>
        </div>
      ) : (
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <header className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="SACCB" className="w-16 h-16 rounded-2xl bg-white/10 p-1.5" />
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Tournoi inter-clubs</p>
                <h1 className="text-4xl md:text-5xl font-bold" style={{ fontFamily: "'Bebas Neue', Oswald, sans-serif", letterSpacing: "0.04em" }}>
                  {d.tournoi?.name}
                </h1>
              </div>
            </div>
            <div className="text-right">
              <p className="flex items-center gap-2 justify-end text-lg font-bold">
                <Radio className={`w-5 h-5 ${d.live.termine ? "" : "text-red-400 animate-pulse"}`} /> {d.live.termine ? "Résultats" : "En direct"}
              </p>
              {maj && <p className="text-xs text-white/50">Mis à jour à {maj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>}
            </div>
          </header>
          <LiveBoard phases={d.live.phases} equipes={d.live.equipes} termine={d.live.termine} clubs={d.live.clubs} grand />
        </div>
      )}
    </div>
  );
}
