"use client";

import { useState } from "react";
import { Users, Plus, Trash2, Pencil, X, Check, ChevronUp, ChevronDown } from "lucide-react";
import { DB, BureauMember } from "@/lib/types";

export default function BureauAdmin({
  db,
  onPersist,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  readOnly?: boolean;
}) {
  const members = db.bureauMembers ?? [];
  const [editing, setEditing] = useState<BureauMember | null>(null);
  const [isNew, setIsNew] = useState(false);

  function startNew() {
    setEditing({ id: Date.now().toString(), prenom: "", nom: "", role: "", description: "" });
    setIsNew(true);
  }
  function startEdit(m: BureauMember) {
    setEditing({ ...m });
    setIsNew(false);
  }
  function cancel() {
    setEditing(null);
    setIsNew(false);
  }

  async function save() {
    if (!editing) return;
    if (!editing.prenom.trim() || !editing.nom.trim() || !editing.role.trim()) {
      alert("Prénom, nom et rôle sont obligatoires.");
      return;
    }
    const cleaned: BureauMember = {
      id: editing.id,
      prenom: editing.prenom.trim(),
      nom: editing.nom.trim(),
      role: editing.role.trim(),
      description: (editing.description || "").trim() || undefined,
    };
    const next = isNew
      ? [...members, cleaned]
      : members.map((m) => (m.id === cleaned.id ? cleaned : m));
    await onPersist({ ...db, bureauMembers: next });
    cancel();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce membre du bureau ?")) return;
    await onPersist({ ...db, bureauMembers: members.filter((m) => m.id !== id) });
  }

  // ⬆️⬇️ Déplace un membre vers le haut (-1) ou vers le bas (+1) dans la liste
  async function move(id: string, direction: -1 | 1) {
    if (readOnly) return;
    const idx = members.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= members.length) return;
    const reordered = [...members];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    await onPersist({ ...db, bureauMembers: reordered });
  }

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display text-xl tracking-wider text-slate-800">Membres du bureau</h3>
            <p className="text-xs text-slate-400">Visibles par les adhérents connectés</p>
          </div>
        </div>
        {!readOnly && !editing && (
          <button onClick={startNew} className="btn-accent !text-xs inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
      </div>

      {/* Formulaire d'édition */}
      {editing && (
        <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 mb-1 block">Prénom *</label>
              <input className="input w-full" value={editing.prenom} onChange={(e) => setEditing({ ...editing, prenom: e.target.value })} placeholder="Hernan" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 mb-1 block">Nom *</label>
              <input className="input w-full" value={editing.nom} onChange={(e) => setEditing({ ...editing, nom: e.target.value })} placeholder="Camara" />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 mb-1 block">Rôle *</label>
            <input className="input w-full" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} placeholder="Président" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 mb-1 block">Petit mot / mission (optionnel)</label>
            <textarea className="input w-full min-h-[70px] resize-y" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Gère les inscriptions et la trésorerie, disponible le mardi soir…" maxLength={400} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={cancel} className="btn-ghost !text-xs inline-flex items-center gap-1"><X className="w-4 h-4" /> Annuler</button>
            <button onClick={save} className="btn-accent !text-xs inline-flex items-center gap-1"><Check className="w-4 h-4" /> Enregistrer</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {members.length === 0 && !editing ? (
        <p className="text-sm text-slate-400 italic text-center py-6">Aucun membre du bureau ajouté pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m, idx) => (
            <li key={m.id} className="flex items-start gap-2 bg-white border border-slate-200 rounded-xl p-3">
              {/* ⬆️⬇️ Flèches de réorganisation (mobile-friendly, peu encombrant) */}
              {!readOnly && members.length > 1 && (
                <div className="flex flex-col shrink-0 -my-1">
                  <button
                    onClick={() => move(m.id, -1)}
                    disabled={idx === 0}
                    className="text-slate-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                    title="Monter"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(m.id, 1)}
                    disabled={idx === members.length - 1}
                    className="text-slate-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                    title="Descendre"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold shrink-0">
                {m.prenom.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{m.prenom} {m.nom}</p>
                <p className="text-xs text-indigo-600 font-medium">{m.role}</p>
                {m.description && <p className="text-xs text-slate-500 mt-1">{m.description}</p>}
              </div>
              {!readOnly && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(m)} className="text-slate-400 hover:text-indigo-600 p-1.5" title="Modifier"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(m.id)} className="text-slate-400 hover:text-red-600 p-1.5" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
