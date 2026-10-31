"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { InterClub, InterClubBinome, Membre } from "@/lib/types";

const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));

/** 🏠 Tournoi interne : les binômes sont composés d'adhérents (choisis dans la liste) */
export default function BinomesInternes({
  t, membres, quota, setQuota, onSave, readOnly,
}: {
  t: InterClub; // version enregistrée (les adhérents peuvent aussi s'inscrire eux-mêmes)
  membres: Membre[];
  quota: number;
  setQuota: (n: number) => void;
  onSave: (binomes: InterClubBinome[]) => Promise<void>;
  readOnly?: boolean;
}) {
  const binomes = t.clubs.flatMap((c) => c.binomes);
  const [j1, setJ1] = useState("");
  const [j2, setJ2] = useState("");
  const [niveau, setNiveau] = useState(t.niveaux.length === 1 ? t.niveaux[0] : "");
  const [busy, setBusy] = useState(false);

  const pris = useMemo(() => new Set(binomes.flatMap((b) => b.membres || [])), [binomes]);
  const dispo = useMemo(
    () => [...membres].filter((m) => !pris.has(m.id) && !m.enAttente).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    [membres, pris]
  );
  const nom = (id: string) => membres.find((m) => m.id === id)?.nom || "";

  async function ajouter() {
    if (!j1 || !j2 || j1 === j2) { alert("Choisis deux adhérents différents."); return; }
    if (t.niveaux.length > 0 && !niveau) { alert("Choisis un niveau."); return; }
    if (binomes.length >= quota) { alert(`Le tournoi est limité à ${quota} binômes.`); return; }
    setBusy(true);
    try {
      await onSave([...binomes, { id: uid(), joueur1: nom(j1), joueur2: nom(j2), niveau: t.niveaux.length ? niveau : "", membres: [j1, j2], createdAt: new Date().toISOString() }]);
      setJ1(""); setJ2("");
    } finally { setBusy(false); }
  }

  async function retirer(b: InterClubBinome) {
    if (!confirm(`Retirer le binôme ${b.joueur1} / ${b.joueur2} ?`)) return;
    setBusy(true);
    try { await onSave(binomes.filter((x) => x.id !== b.id)); } finally { setBusy(false); }
  }

  return (
    <div className="border-t border-slate-200 pt-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Binômes inscrits ({binomes.length}/{quota})</p>
        <label className="text-xs text-slate-600 flex items-center gap-2">
          Binômes max
          <input type="number" min={2} max={99} className="input !py-1 !px-2 !text-sm w-20" value={quota} disabled={readOnly}
            onChange={(e) => setQuota(Math.max(2, Math.min(99, Number(e.target.value) || 2)))} />
        </label>
      </div>
      <p className="text-[11px] text-slate-500">
        Les adhérents peuvent aussi s&apos;inscrire eux-mêmes depuis leur espace adhérent (onglet « Mes tournois ») tant que les inscriptions sont ouvertes.
      </p>

      {!readOnly && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <select className="input !text-sm" value={j1} onChange={(e) => setJ1(e.target.value)}>
              <option value="">— Joueur 1 —</option>
              {dispo.filter((m) => m.id !== j2).map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
            <select className="input !text-sm" value={j2} onChange={(e) => setJ2(e.target.value)}>
              <option value="">— Joueur 2 —</option>
              {dispo.filter((m) => m.id !== j1).map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </div>
          {t.niveaux.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {t.niveaux.map((n) => (
                <button key={n} type="button" onClick={() => setNiveau(n)}
                  className={`text-xs px-3 py-1 rounded-full border font-semibold ${niveau === n ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white text-slate-600 border-slate-300"}`}>
                  {n}
                </button>
              ))}
            </div>
          )}
          <button onClick={ajouter} disabled={busy || !j1 || !j2} className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 flex items-center gap-1 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Ajouter ce binôme
          </button>
        </div>
      )}

      {binomes.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-3">Aucun binôme pour l&apos;instant</p>
      ) : (
        <ol className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
          {binomes.map((b, i) => (
            <li key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="w-6 text-[11px] text-slate-400 font-semibold">{i + 1}.</span>
              <span className="flex-1 min-w-0 truncate">{b.joueur1} / {b.joueur2}</span>
              {b.niveau && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{b.niveau}</span>}
              {!readOnly && !t.live && (
                <button onClick={() => retirer(b)} disabled={busy} className="p-1 text-slate-400 hover:text-red-500" title="Retirer"><Trash2 className="w-4 h-4" /></button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
