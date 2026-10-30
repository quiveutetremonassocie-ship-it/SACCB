"use client";

import { useMemo, useState } from "react";
import { X, Search, Users, AlertTriangle, Check } from "lucide-react";
import { Membre } from "@/lib/types";

// 📸 Personnes présentes sur une photo : on coche les adhérents, ceux qui n'ont
// pas accepté d'apparaître sur le site (droit à l'image) ressortent en rouge.
export function sansAccordPhoto(ids: string[] | undefined, membres: Membre[]): Membre[] {
  if (!ids || ids.length === 0) return [];
  return membres.filter((m) => ids.includes(m.id) && m.photoConsent !== true);
}

export default function PhotoPeopleModal({
  imageUrl,
  initial,
  membres,
  onSave,
  onClose,
  readOnly,
}: {
  imageUrl: string;
  initial: string[];
  membres: Membre[];
  onSave: (ids: string[]) => Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const tries = useMemo(
    () => [...membres].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [membres]
  );
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtres = q.trim() ? tries.filter((m) => norm(m.nom).includes(norm(q.trim()))) : tries;
  const choisis = tries.filter((m) => selected.includes(m.id));
  // Personnes taguées dont la fiche a été supprimée depuis
  const inconnus = selected.filter((id) => !membres.some((m) => m.id === id)).length;
  const refus = choisis.filter((m) => m.photoConsent !== true);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function save() {
    setBusy(true);
    try {
      await onSave(selected.filter((id) => membres.some((m) => m.id === id)));
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <p className="font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" /> Personnes sur la photo
          </p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid md:grid-cols-2 gap-5">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-full max-h-[50vh] object-contain rounded-xl bg-slate-100" />

            {refus.length > 0 ? (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  {refus.length} personne{refus.length > 1 ? "s n'ont" : " n'a"} pas accepté d&apos;apparaître sur le site
                </p>
                <p>Floute-la ou retire cette photo avant de la publier.</p>
              </div>
            ) : choisis.length > 0 ? (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Tout le monde a donné son accord photo
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {choisis.map((m) => (
                <span
                  key={m.id}
                  className={`text-xs px-2 py-1 rounded-full border font-semibold flex items-center gap-1 ${
                    m.photoConsent === true
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-red-100 text-red-700 border-red-400"
                  }`}
                >
                  {m.photoConsent !== true && "⚠ "}
                  {m.nom}
                  {!readOnly && (
                    <button onClick={() => toggle(m.id)} className="opacity-60 hover:opacity-100" title="Retirer">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {inconnus > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                  +{inconnus} fiche{inconnus > 1 ? "s" : ""} supprimée{inconnus > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col min-h-0">
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input w-full !pl-9 !text-sm"
                placeholder="Rechercher un adhérent…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto max-h-[50vh] border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filtres.length === 0 && <p className="text-center text-slate-400 text-sm py-6">Aucun adhérent trouvé</p>}
              {filtres.map((m) => {
                const on = selected.includes(m.id);
                const ok = m.photoConsent === true;
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition ${
                      on ? (ok ? "bg-emerald-50" : "bg-red-50") : "hover:bg-slate-50"
                    } ${readOnly ? "pointer-events-none" : ""}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(m.id)} disabled={readOnly} />
                    <span className={`flex-1 ${!ok ? "text-red-600 font-semibold" : "text-slate-700"}`}>{m.nom}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {ok ? "📸 Accord" : "🚫 Pas d'accord"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost !px-4 !py-2 !text-xs">Annuler</button>
          {!readOnly && (
            <button onClick={save} disabled={busy} className="btn-primary !px-4 !py-2 !text-xs">
              {busy ? "Enregistrement…" : `Enregistrer (${choisis.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
