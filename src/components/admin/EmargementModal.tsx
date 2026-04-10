"use client";

import { Printer, X } from "lucide-react";
import { DB } from "@/lib/types";

export default function EmargementModal({ db, onClose }: { db: DB; onClose: () => void }) {
  const sorted = [...db.membres].sort((a, b) => a.nom.localeCompare(b.nom));

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 p-4 overflow-y-auto">
      <div className="printable bg-white text-black rounded-md max-w-3xl w-full p-10 shadow-2xl my-8">
        <div className="text-center border-b-2 border-blue-500 pb-3 mb-6">
          <h1 className="text-2xl text-blue-600 font-bold">SACCB - LISTE D&apos;ÉMARGEMENT</h1>
          <p className="text-xs">
            Saison {db.y1}-{db.y2} — Salle Paul Vatine
          </p>
        </div>
        <table className="w-full text-sm border border-black">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-black p-2 text-left">NOM / PRÉNOM</th>
              <th className="border border-black p-2 text-left w-28">TYPE</th>
              <th className="border border-black p-2 text-left w-44">SIGNATURE</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id}>
                <td className="border border-black p-2">{m.nom}</td>
                <td className="border border-black p-2">{m.type}</td>
                <td className="border border-black p-2 h-10"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="no-print mt-10 flex gap-3">
          <button onClick={() => window.print()} className="btn-primary flex-1">
            <Printer className="w-4 h-4" /> Imprimer la liste
          </button>
          <button onClick={onClose} className="btn-ghost flex-1">
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
