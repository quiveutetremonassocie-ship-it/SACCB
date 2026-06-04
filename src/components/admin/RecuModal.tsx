"use client";

import { Printer, X } from "lucide-react";
import { DB, Membre, getEffectivePrix } from "@/lib/types";

export default function RecuModal({
  membre,
  db,
  onClose,
  // 👇 Quand fourni, ces valeurs surchargent celles de db (utile côté espace
  // membre où on n'a pas la DB complète — on injecte juste y1/y2/presidentName/prix)
  overrides,
}: {
  membre: Membre;
  db?: DB;
  onClose: () => void;
  overrides?: {
    y1: number;
    y2: number;
    presidentName?: string;
    montantAdulte: number;
    montantEtudiant: number;
  };
}) {
  let y1: number, y2: number, presidentName: string | undefined, montant: number;
  if (overrides) {
    y1 = overrides.y1;
    y2 = overrides.y2;
    presidentName = overrides.presidentName;
    montant = membre.type === "Etudiant" ? overrides.montantEtudiant : overrides.montantAdulte;
  } else if (db) {
    const effectivePrix = getEffectivePrix(db);
    montant = membre.type === "Etudiant" ? effectivePrix.Etudiant : effectivePrix.Adulte;
    y1 = db.y1;
    y2 = db.y2;
    presidentName = db.presidentName;
  } else {
    return null;
  }
  const date = new Date().toLocaleDateString("fr-FR");

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 p-4 overflow-y-auto">
      <div className="printable bg-white text-black rounded-md max-w-2xl w-full p-10 shadow-2xl my-8">
        <div className="flex items-center gap-4 border-b-2 border-blue-500 pb-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo SACCB" className="w-20 h-20 object-contain shrink-0" />
          <div className="text-center flex-1">
            <h1 className="text-2xl text-blue-600 font-bold">SACCB - SAINTE ADRESSE</h1>
            <p className="text-xs">Association de Badminton — Salle Paul Vatine</p>
          </div>
        </div>
        <h2 className="text-center underline font-bold text-lg mb-8">REÇU DE COTISATION</h2>
        <p className="mb-4">
          Je soussigné, <strong>{presidentName?.trim() || "Le/La Président(e)"}</strong>,
          Président de l&apos;association SACCB, certifie avoir reçu la somme de :
        </p>
        <p className="text-center text-3xl font-bold mb-8">{montant} €</p>
        <p className="mb-2">
          De la part de : <strong>{membre.nom}</strong>
        </p>
        <p className="mb-8">
          Au titre de la cotisation annuelle pour la saison{" "}
          <strong>
            {y1}-{y2}
          </strong>
          .
        </p>
        <div className="flex justify-between mt-12">
          <p>
            Fait à Sainte-Adresse,
            <br />
            Le {date}
          </p>
          <div className="text-center">
            <p>Signature (Président)</p>
            <div className="mt-2 font-bold text-blue-600 border border-blue-600 px-2 py-1 inline-block">
              SACCB ST-ADRESSE
            </div>
          </div>
        </div>

        <div className="no-print mt-10 flex gap-3">
          <button onClick={() => window.print()} className="btn-primary flex-1">
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          <button onClick={onClose} className="btn-ghost flex-1">
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
