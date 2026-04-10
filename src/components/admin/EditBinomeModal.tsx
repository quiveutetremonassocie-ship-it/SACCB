"use client";

import { useState } from "react";

export default function EditBinomeModal({
  bin,
  onClose,
  onSave,
}: {
  bin: { id: string; joueurs: string };
  onClose: () => void;
  onSave: (b: { id: string; joueurs: string }) => Promise<void>;
}) {
  const [joueurs, setJoueurs] = useState(bin.joueurs);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/90 p-4">
      <div className="glass-strong p-7 w-full max-w-md">
        <h3 className="font-display text-2xl tracking-wider text-white mb-5">Modifier le binôme</h3>
        <input
          className="input mb-3"
          value={joueurs}
          onChange={(e) => setJoueurs(e.target.value)}
          placeholder="Noms des joueurs"
        />
        <button onClick={() => onSave({ id: bin.id, joueurs })} className="btn-primary w-full mb-2">
          Enregistrer
        </button>
        <button onClick={onClose} className="btn-ghost w-full">
          Annuler
        </button>
      </div>
    </div>
  );
}
