"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { LivePhase, PhaseProgramme } from "@/lib/types";
import { formatTexte } from "@/lib/interclubLive";

/** 📖 Règlement du tournoi, écrit automatiquement à partir du programme (tournoi loisir entre clubs) */
export default function ReglementTournoi({
  programme, phases, ouvertParDefaut,
}: {
  programme?: PhaseProgramme[];
  phases?: LivePhase[];
  ouvertParDefaut?: boolean;
}) {
  const [ouvert, setOuvert] = useState(!!ouvertParDefaut);
  // Le programme prévu fait foi ; à défaut, les phases déjà lancées
  const etapes: { nom: string; poules?: number; texte: string }[] =
    programme && programme.length > 0
      ? programme.map((p) => ({ nom: p.nom, poules: p.poules, texte: formatTexte(p.format) }))
      : (phases || []).map((p) => ({ nom: p.nom, poules: p.poules.length, texte: formatTexte(p.format) }));
  const cassant = (programme || []).some((p) => p.format.cassant) || (phases || []).some((p) => p.format.cassant);

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
      <button onClick={() => setOuvert(!ouvert)} className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-slate-50">
        <BookOpen className="w-5 h-5 text-[#1e3a5f]" />
        <span className="flex-1">
          <span className="block font-bold text-[#1e3a5f]">📌 Règlement du tournoi</span>
          <span className="block text-[11px] text-slate-500">Déroulement, poules, points et saisie des scores</span>
        </span>
        {ouvert ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      {ouvert && (
        <div className="px-5 pb-5 text-sm text-slate-700 space-y-4 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500 italic">
            Tournoi loisir entre clubs : le but est de jouer et de passer une bonne journée. Personne n&apos;est éliminé, toutes les équipes jouent jusqu&apos;au bout.
          </p>

          <Bloc titre="🗓 Déroulement de la journée">
            {etapes.length > 0 ? (
              <ol className="space-y-1">
                {etapes.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span><strong>{e.nom}</strong>{e.poules ? ` — ${e.poules} poule${e.poules > 1 ? "s" : ""}` : ""} · {e.texte}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Le programme de la journée sera affiché ici.</p>
            )}
            {cassant && (
              <p className="text-xs text-slate-500 mt-1">« Points cassants » : la première équipe qui atteint le score gagne le set, pas besoin de 2 points d&apos;écart.</p>
            )}
          </Bloc>

          <Bloc titre="🏸 Les poules">
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Au premier tour, les poules sont tirées au sort en mélangeant les niveaux et en séparant au maximum les équipes d&apos;un même club.</li>
              <li>Dans une poule, chaque équipe rencontre toutes les autres.</li>
            </ul>
          </Bloc>

          <Bloc titre="📊 Les points">
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Victoire : <strong>1 point</strong> · Défaite : <strong>0 point</strong> · Forfait : <strong>−1 point</strong>.</li>
              <li>L&apos;équipe qui a le plus de points finit 1ʳᵉ de sa poule.</li>
            </ul>
          </Bloc>

          <Bloc titre="⚖️ En cas d'égalité">
            <ul className="list-disc pl-5 space-y-0.5">
              <li><strong>2 équipes</strong> à égalité : celle qui a gagné leur match passe devant.</li>
              <li><strong>3 équipes ou plus</strong> : meilleure différence de sets (gagnés − perdus), puis meilleure différence de points.</li>
              <li>S&apos;il n&apos;en reste plus que 2 à égalité, c&apos;est leur match qui décide.</li>
            </ul>
          </Bloc>

          {etapes.length > 1 && (
            <Bloc titre="🔁 Passage au tour suivant">
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Quand tous les matchs d&apos;un tour sont joués, les équipes sont regroupées selon leur classement : les mieux classées ensemble dans la poule A, les suivantes dans la poule B, etc.</li>
                <li>Ainsi, à chaque tour, on joue contre des équipes de son niveau.</li>
                <li>Le classement de la dernière phase donne le classement final : la poule A pour les premières places, puis la poule B…</li>
              </ul>
            </Bloc>
          )}

          <Bloc titre="✍️ Les scores">
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Après chaque match, une des deux équipes entre le score sur la page de son club.</li>
              <li>L&apos;autre équipe le <strong>confirme</strong>, ou le <strong>corrige</strong> si elle n&apos;est pas d&apos;accord.</li>
              <li>Si le score a été corrigé, la première équipe le confirme ou le <strong>conteste</strong> : la table de marque vient alors au terrain pour régler le match.</li>
              <li>Un score entré par erreur peut être supprimé tant qu&apos;il n&apos;est pas validé.</li>
            </ul>
          </Bloc>

          <Bloc titre="🏳 Forfait et abandon">
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Une équipe absente pour un match est déclarée <strong>forfait</strong> : le match est perdu et compte −1 point.</li>
              <li>Si une équipe doit arrêter la journée (blessure…), ses résultats sont retirés de sa poule et elle est classée dernière.</li>
            </ul>
          </Bloc>
        </div>
      )}
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-[#1e3a5f] mb-1">{titre}</p>
      {children}
    </div>
  );
}
