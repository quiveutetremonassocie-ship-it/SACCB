"use client";

import { useState } from "react";
import { Plus, Trophy, Trash2, Bell, Pencil, Check, X } from "lucide-react";
import { DB, Tournoi } from "@/lib/types";
import { notifyMembres } from "@/lib/db";

export default function TournoisAdmin({
  db,
  onPersist,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
}) {
  // Formulaire nouveau tournoi
  const [n, setN] = useState("");
  const [d, setD] = useState("");
  const [dateLimit, setDateLimit] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");

  // Edition en ligne
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Tournoi>>({});

  const [notifying, setNotifying] = useState<string | null>(null);

  async function add() {
    if (!n || !d) { alert("Nom et date requis."); return; }
    const next = {
      ...db,
      config_tournois: [
        ...(db.config_tournois || []),
        {
          id: Date.now().toString(),
          name: n,
          date: d,
          dateLimit: dateLimit || null,
          type: type || null,
          quota: q ? parseInt(q) : null,
        },
      ],
    };
    await onPersist(next);
    setN(""); setD(""); setDateLimit(""); setType(""); setQ("");
  }

  function startEdit(t: Tournoi) {
    setEditingId(t.id);
    setEditData({ name: t.name, date: t.date, dateLimit: t.dateLimit || "", type: t.type || "", quota: t.quota ?? undefined });
  }

  async function saveEdit(id: string) {
    const next = {
      ...db,
      config_tournois: db.config_tournois.map((t) =>
        t.id === id
          ? {
              ...t,
              name: editData.name || t.name,
              date: editData.date || t.date,
              dateLimit: (editData.dateLimit as string) || null,
              type: (editData.type as string) || null,
              quota: editData.quota ? Number(editData.quota) : null,
            }
          : t
      ),
    };
    await onPersist(next);
    setEditingId(null);
    setEditData({});
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce tournoi et toutes ses inscriptions ?")) return;
    const next = {
      ...db,
      config_tournois: db.config_tournois.filter((t) => t.id !== id),
      inscrits_tournoi: db.inscrits_tournoi.filter((i) => i.tournoiId !== id),
    };
    await onPersist(next);
  }

  async function notify(id: string, name: string) {
    if (!confirm(`Envoyer un email à tous les adhérents pour le tournoi "${name}" ?`)) return;
    setNotifying(id);
    const r = await notifyMembres(id, name);
    setNotifying(null);
    if (r.ok) {
      alert(`✅ Email envoyé à ${r.sent} adhérent(s) !`);
    } else {
      alert("Erreur : " + (r.reason || "Inconnue"));
    }
  }

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-slate-800" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-slate-800">Liste des tournois</h3>
      </div>

      <div className="space-y-2 mb-6">
        {(db.config_tournois || []).map((t) => (
          <div key={t.id} className="bg-slate-50 rounded-xl border border-slate-200">
            {editingId === t.id ? (
              /* Mode édition */
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className="input !text-sm"
                    value={editData.name || ""}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    placeholder="Nom du tournoi"
                  />
                  <input
                    className="input !text-sm"
                    value={editData.date || ""}
                    onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                    placeholder="Date (ex: 25 mai 2025)"
                  />
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Date limite</label>
                    <input
                      className="input !text-sm"
                      type="date"
                      value={(editData.dateLimit as string) || ""}
                      onChange={(e) => setEditData({ ...editData, dateLimit: e.target.value })}
                    />
                  </div>
                  <select
                    className="input !text-sm"
                    value={(editData.type as string) || ""}
                    onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                  >
                    <option value="">Type (optionnel)</option>
                    <option value="Mixte">👫 Mixte</option>
                    <option value="Hommes">👬 Hommes</option>
                    <option value="Femmes">👭 Femmes</option>
                  </select>
                  <input
                    className="input !text-sm"
                    type="number"
                    value={editData.quota ?? ""}
                    onChange={(e) => setEditData({ ...editData, quota: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="Quota max"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(t.id)} className="btn-primary !px-3 !py-1.5 !text-xs flex-1">
                    <Check className="w-3.5 h-3.5" /> Enregistrer
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                    <X className="w-3.5 h-3.5" /> Annuler
                  </button>
                </div>
              </div>
            ) : (
              /* Mode affichage */
              <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
                <div>
                  <p className="text-slate-800 font-semibold">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.date}</p>
                  {t.dateLimit && <p className="text-xs text-amber-600">Limite : {t.dateLimit}</p>}
                  {t.type && <p className="text-xs text-blue-500">{t.type}</p>}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => startEdit(t)}
                    className="btn-primary !px-2.5 !py-1.5 !text-xs"
                    title="Modifier"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => notify(t.id, t.name)}
                    disabled={notifying === t.id}
                    className="btn-primary !px-2.5 !py-1.5 !text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500"
                    title="Prévenir les adhérents"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline ml-1">{notifying === t.id ? "Envoi..." : "Prévenir"}</span>
                  </button>
                  <button onClick={() => del(t.id)} className="btn-danger !px-2.5 !py-1.5 !text-xs">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {(!db.config_tournois || db.config_tournois.length === 0) && (
          <p className="text-slate-400 text-sm">Aucun tournoi.</p>
        )}
      </div>

      <h4 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-widest">
        Nouveau tournoi
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input className="input" value={n} onChange={(e) => setN(e.target.value)} placeholder="Nom du tournoi" />
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Date du tournoi</label>
          <input className="input" value={d} onChange={(e) => setD(e.target.value)} placeholder="ex: 25 mai 2025" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Date limite d&apos;inscription</label>
          <input className="input" type="date" value={dateLimit} onChange={(e) => setDateLimit(e.target.value)} />
        </div>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Type de double (optionnel)</option>
          <option value="Mixte">👫 Double Mixte</option>
          <option value="Hommes">👬 Double Hommes</option>
          <option value="Femmes">👭 Double Femmes</option>
        </select>
        <input
          className="input"
          type="number"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Quota max doubles (vide = illimité)"
        />
      </div>
      <button onClick={add} className="btn-primary w-full">
        <Plus className="w-4 h-4" /> Publier
      </button>
    </div>
  );
}
