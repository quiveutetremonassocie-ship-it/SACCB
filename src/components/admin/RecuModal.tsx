"use client";

import { Printer, X } from "lucide-react";
import { DB, Membre, PRIX } from "@/lib/types";

export default function RecuModal({
  membre,
  db,
  onClose,
}: {
  membre: Membre;
  db: DB;
  onClose: () => void;
}) {
  const montant = membre.type === "Etudiant" ? PRIX.Etudiant : PRIX.Adulte;
  const date = new Date().toLocaleDateString("fr-FR");

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 p-4 overflow-y-auto">
      <div className="printable bg-white text-black rounded-md max-w-2xl w-full p-10 shadow-2xl my-8">
        <div className="text-center border-b-2 border-blue-500 pb-3 mb-6">
          <h1 className="text-2xl text-blue-600 font-bold">SACCB - SAINTE ADRESSE</h1>
          <p className="text-xs">Club de Badminton — Salle Paul Vatine</p>
        </div>
        <h2 className="text-center underline font-bold text-lg mb-8">REÇU DE COTISATION</h2>
        <p className="mb-4">
          Je soussigné, <strong>Hernan Camara</strong>, Président de l&apos;association SACCB,
          certifie avoir reçu la somme de :
        </p>
        <p className="text-center text-3xl font-bold mb-8">{montant} €</p>
        <p className="mb-2">
          De la part de : <strong>{membre.nom}</strong>
        </p>
        <p className="mb-8">
          Au titre de la cotisation annuelle pour la saison{" "}
          <strong>
            {db.y1}-{db.y2}
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
