"use client";

import { useState } from "react";
import { Membre } from "@/lib/types";

export default function EditMembreModal({
  membre,
  onClose,
  onSave,
}: {
  membre: Membre;
  onClose: () => void;
  onSave: (m: Membre) => Promise<void>;
}) {
  const [m, setM] = useState<Membre>(membre);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/90 p-4">
      <div className="glass-strong p-7 w-full max-w-md">
        <h3 className="font-display text-2xl tracking-wider text-white mb-5">Modifier l&apos;adhérent</h3>
        <div className="space-y-3">
          <input className="input" value={m.nom} onChange={(e) => setM({ ...m, nom: e.target.value })} placeholder="Nom" />
          <input className="input" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} placeholder="Email" />
          <input className="input" value={m.tel || ""} onChange={(e) => setM({ ...m, tel: e.target.value })} placeholder="Téléphone" />
          <select className="input" value={m.type} onChange={(e) => setM({ ...m, type: e.target.value as any })}>
            <option value="Adulte">Adulte</option>
            <option value="Etudiant">Etudiant</option>
          </select>
          <button onClick={() => onSave(m)} className="btn-primary w-full">
            Enregistrer
          </button>
          <button onClick={onClose} className="btn-ghost w-full">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
