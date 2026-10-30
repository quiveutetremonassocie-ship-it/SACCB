"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { LivePhase } from "@/lib/types";
import { formatTexte } from "@/lib/interclubLive";

// Texte officiel : Règlement Général des Compétitions FFBaD (chap. 03.01), publié dans L'Officiel du Badminton n°88
export const LIEN_RGC_FFBAD = "https://lob.ffbad.org/PDF/L_Officiel_du_Badminton_-_v88.pdf";

/** 📖 Règlement épinglé sur la page de chaque tournoi inter-clubs */
export default function ReglementTournoi({ phases, ouvertParDefaut }: { phases?: LivePhase[]; ouvertParDefaut?: boolean }) {
  const [ouvert, setOuvert] = useState(!!ouvertParDefaut);
  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
      <button onClick={() => setOuvert(!ouvert)} className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-slate-50">
        <BookOpen className="w-5 h-5 text-[#1e3a5f]" />
        <span className="flex-1">
          <span className="block font-bold text-[#1e3a5f]">📌 Règlement du tournoi</span>
          <span className="block text-[11px] text-slate-500">Règles officielles de la Fédération Française de Badminton</span>
        </span>
        {ouvert ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      {ouvert && (
        <div className="px-5 pb-5 text-sm text-slate-700 space-y-4 border-t border-slate-100 pt-4">
          <Bloc titre="🏸 Format des matchs">
            {phases && phases.length > 0 ? (
              <ul className="list-disc pl-5 space-y-0.5">
                {phases.map((p) => <li key={p.id}><strong>{p.nom}</strong> : {formatTexte(p.format)}</li>)}
              </ul>
            ) : (
              <p>Le format de chaque phase est indiqué dans le déroulement et sur cette page le jour du tournoi.</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              « Points cassants » : le premier à atteindre le score gagne le set, sans 2 points d&apos;écart. Sinon, il faut 2 points d&apos;écart (maximum 30 en 21 points).
            </p>
          </Bloc>

          <Bloc titre="📊 Classement dans une poule">
            <p>Chaque équipe rencontre toutes les autres de sa poule. Barème : victoire <strong>+1</strong>, défaite <strong>0</strong>, forfait <strong>−1</strong>.</p>
          </Bloc>

          <Bloc titre="⚖️ En cas d'égalité">
            <ul className="list-disc pl-5 space-y-0.5">
              <li><strong>2 équipes</strong> : celle qui a gagné leur match passe devant.</li>
              <li><strong>3 équipes ou plus</strong> : meilleure différence de sets gagnés/perdus, puis meilleure différence de points gagnés/perdus.</li>
              <li>Dès qu&apos;il ne reste que 2 équipes à égalité, c&apos;est leur match qui décide.</li>
              <li>En dernier ressort : tirage au sort.</li>
            </ul>
          </Bloc>

          <Bloc titre="🏳 Forfait, abandon, arrêt">
            <ul className="list-disc pl-5 space-y-0.5">
              <li><strong>Forfait</strong> : le match est perdu 0-21 à chaque set (selon le format) et compte −1 point.</li>
              <li><strong>Abandon en cours de match</strong> : l&apos;équipe garde les points gagnés, l&apos;adversaire reçoit ceux qui lui manquaient pour gagner.</li>
              <li><strong>Équipe qui arrête le tournoi</strong> : ses résultats dans la poule ne comptent plus, elle est classée dernière.</li>
            </ul>
          </Bloc>

          <Bloc titre="✍️ Saisie des scores">
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Après chaque match, une des deux équipes entre le score sur sa page.</li>
              <li>L&apos;équipe adverse le <strong>confirme</strong> (ou le corrige). La table de marque peut aussi le valider.</li>
              <li>Un score entré par erreur peut être supprimé tant qu&apos;il n&apos;est pas validé. En cas de désaccord, la table de marque tranche.</li>
            </ul>
          </Bloc>

          <a href={LIEN_RGC_FFBAD} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /> Texte officiel : Règlement Général des Compétitions FFBaD (art. 3.4)
          </a>
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
