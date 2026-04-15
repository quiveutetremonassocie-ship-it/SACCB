"use client";

import { useState } from "react";
import { Plus, Trophy, Trash2 } from "lucide-react";
import { DB } from "@/lib/types";

export default function TournoisAdmin({
  db,
  onPersist,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
}) {
  const [n, setN] = useState("");
  const [d, setD] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");

  async function add() {
    if (!n || !d) {
      alert("Nom et date requis.");
      return;
    }
    const next = {
      ...db,
      config_tournois: [
        ...(db.config_tournois || []),
        {
          id: Date.now().toString(),
          name: n,
          date: d,
          type: type || null,
          quota: q ? parseInt(q) : null,
        },
      ],
    };
    await onPersist(next);
    setN("");
    setD("");
    setType("");
    setQ("");
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

  return (
    <div className="glass p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-slate-800" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-slate-800">Liste des tournois</h3>
      </div>

      <div className="space-y-2 mb-6">
        {(db.config_tournois || []).map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3"
          >
            <div>
              <p className="text-slate-800 font-semibold">{t.name}</p>
              <p className="text-xs text-slate-400">{t.date}</p>
            </div>
            <button onClick={() => del(t.id)} className="btn-danger !px-3 !py-1.5 !text-xs">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {(!db.config_tournois || db.config_tournois.length === 0) && (
          <p className="text-slate-400 text-sm">Aucun tournoi.</p>
        )}
      </div>

      <h4 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-widest">
        Nouveau tournoi
      </h4>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <input className="input" value={n} onChange={(e) => setN(e.target.value)} placeholder="Nom du tournoi" />
        <input className="input" value={d} onChange={(e) => setD(e.target.value)} placeholder="Date" />
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
