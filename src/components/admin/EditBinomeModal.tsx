"use client";

import { useState } from "react";
import { Membre } from "@/lib/types";
import { ChampsBinome, binomePropre } from "../ChampAdherent";

export default function EditBinomeModal({
  bin,
  membres,
  onClose,
  onSave,
}: {
  bin: { id: string; joueurs: string };
  membres: Membre[];
  onClose: () => void;
  onSave: (b: { id: string; joueurs: string }) => Promise<void>;
}) {
  const [joueurs, setJoueurs] = useState(bin.joueurs);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-7 w-full max-w-md">
        <h3 className="font-display text-2xl tracking-wider text-slate-800 mb-5">Modifier le binôme</h3>
        <div className="mb-3">
          <ChampsBinome noms={membres.map((m) => m.nom)} value={joueurs} onChange={setJoueurs} />
        </div>
        <button
          onClick={() => {
            const propre = binomePropre(joueurs);
            if (!propre) { alert("Le nom des joueurs est requis."); return; }
            onSave({ id: bin.id, joueurs: propre });
          }}
          className="btn-primary w-full mb-2"
        >
          Enregistrer
        </button>
        <button onClick={onClose} className="btn-ghost w-full">
          Annuler
        </button>
      </div>
    </div>
  );
}
