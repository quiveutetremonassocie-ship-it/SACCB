"use client";

import { useState } from "react";
import { Bell, BellOff, Camera, CameraOff } from "lucide-react";
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
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(m);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-7 w-full max-w-md">
        <h3 className="font-display text-2xl tracking-wider text-slate-800 mb-5">Modifier l&apos;adhérent</h3>
        <div className="space-y-3">
          <input className="input" value={m.nom} onChange={(e) => setM({ ...m, nom: e.target.value })} placeholder="Nom" />
          <input className="input" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} placeholder="Email" />
          <input className="input" value={m.tel || ""} onChange={(e) => setM({ ...m, tel: e.target.value })} placeholder="Téléphone" />
          <select className="input" value={m.type} onChange={(e) => setM({ ...m, type: e.target.value as "Adulte" | "Etudiant" })}>
            <option value="Adulte">Adulte</option>
            <option value="Etudiant">Etudiant</option>
          </select>

          {/* 👫 Fille / Garçon — pour les mails des tournois Femmes / Hommes */}
          <select className="input" value={m.sexe ?? ""} onChange={(e) => setM({ ...m, sexe: e.target.value === "F" || e.target.value === "H" ? e.target.value : undefined })}>
            <option value="">Fille ou garçon ? (non renseigné)</option>
            <option value="F">👧 Fille</option>
            <option value="H">👦 Garçon</option>
          </select>

          {/* 💶 Montant réellement payé (réduction) */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Montant réellement payé (€) — en cas de réduction</label>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={typeof m.montantPaye === "number" ? m.montantPaye : ""}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".");
                setM({ ...m, montantPaye: v === "" ? undefined : Math.max(0, Number(v)) });
              }}
              placeholder="Vide = tarif normal"
            />
          </div>

          {/* Préférences */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Préférences</p>

            <label className="flex items-center justify-between cursor-pointer gap-3">
              <span className="flex items-center gap-2 text-sm text-slate-700">
                {m.newsOptIn !== false
                  ? <Bell className="w-4 h-4 text-emerald-500" />
                  : <BellOff className="w-4 h-4 text-slate-400" />}
                News de l’association
              </span>
              <button
                type="button"
                onClick={() => setM({ ...m, newsOptIn: !(m.newsOptIn !== false) })}
                className={`relative w-11 h-6 rounded-full transition-colors ${m.newsOptIn !== false ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${m.newsOptIn !== false ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </label>

            <label className="flex items-center justify-between cursor-pointer gap-3">
              <span className="flex items-center gap-2 text-sm text-slate-700">
                {m.photoConsent === true
                  ? <Camera className="w-4 h-4 text-violet-500" />
                  : <CameraOff className="w-4 h-4 text-orange-400" />}
                Droit à l&apos;image
              </span>
              <button
                type="button"
                onClick={() => setM({ ...m, photoConsent: !m.photoConsent })}
                className={`relative w-11 h-6 rounded-full transition-colors ${m.photoConsent ? "bg-violet-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${m.photoConsent ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </label>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button onClick={onClose} className="btn-ghost w-full">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
