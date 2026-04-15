"use client";

import { Pencil, Trash2, Users } from "lucide-react";
import { DB } from "@/lib/types";

export default function InscriptionsAdmin({
  db,
  onPersist,
  onEditBin,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  onEditBin: (b: { id: string; joueurs: string }) => void;
}) {
  async function del(id: string) {
    const next = { ...db, inscrits_tournoi: db.inscrits_tournoi.filter((i) => i.id !== id) };
    await onPersist(next);
  }

  return (
    <div className="glass p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-slate-800">Inscriptions tournois</h3>
      </div>
      {(db.config_tournois || []).map((t) => {
        const inscrits = db.inscrits_tournoi.filter((i) => i.tournoiId === t.id);
        if (inscrits.length === 0) return null;
        return (
          <div key={t.id} className="mb-5">
            <p className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl font-semibold mb-2">
              {t.name}
            </p>
            <div className="space-y-1">
              {inscrits.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2"
                >
                  <span className="text-slate-700 text-sm">{i.joueurs}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditBin({ id: i.id, joueurs: i.joueurs })}
                      className="btn-primary !px-2 !py-1 !text-xs"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => del(i.id)} className="btn-danger !px-2 !py-1 !text-xs">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
