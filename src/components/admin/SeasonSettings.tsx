"use client";

import { useState } from "react";
import { CalendarCog, RefreshCw, Lock, Unlock, UserPlus } from "lucide-react";
import { DB, QUOTA_DEFAULT } from "@/lib/types";

export default function SeasonSettings({
  db,
  onPersist,
  onRefresh,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [y1, setY1] = useState(db.y1);
  const [y2, setY2] = useState(db.y2);
  const currentQuota = db.quota ?? QUOTA_DEFAULT;
  const [quota, setQuota] = useState(currentQuota);

  async function update() {
    await onPersist({ ...db, y1: Number(y1), y2: Number(y2), quota: Number(quota) });
    alert("Paramètres mis à jour !");
  }

  async function toggle() {
    await onPersist({ ...db, insc_open: !db.insc_open });
  }

  async function reset() {
    if (!confirm("Supprimer TOUS les adhérents ? Action irréversible.")) return;
    await onPersist({ ...db, membres: [] });
  }

  return (
    <div className="glass p-6 border border-emerald-200">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <CalendarCog className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-slate-800">Paramètres saison</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input
          type="number"
          className="input"
          value={y1}
          onChange={(e) => setY1(Number(e.target.value))}
          placeholder="Année 1"
        />
        <input
          type="number"
          className="input"
          value={y2}
          onChange={(e) => setY2(Number(e.target.value))}
          placeholder="Année 2"
        />
      </div>

      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 block">
          Places disponibles
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            className="input flex-1"
            value={quota}
            min={db.membres.length}
            onChange={(e) => setQuota(Number(e.target.value))}
          />
          <span className="text-slate-400 text-sm whitespace-nowrap">
            {db.membres.length} / {quota} inscrits
          </span>
        </div>
        {db.membres.length >= currentQuota && (
          <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
            <UserPlus className="w-3 h-3" />
            Club complet — augmentez le quota pour accepter de nouveaux membres
          </p>
        )}
      </div>

      <div className="space-y-3">
        <button
          onClick={toggle}
          className={db.insc_open ? "btn-danger w-full" : "btn-accent w-full"}
        >
          {db.insc_open ? (
            <>
              <Lock className="w-4 h-4" /> Fermer les inscriptions
            </>
          ) : (
            <>
              <Unlock className="w-4 h-4" /> Ouvrir les inscriptions
            </>
          )}
        </button>
        <button onClick={update} className="btn-accent w-full">
          <RefreshCw className="w-4 h-4" /> Mettre à jour les paramètres
        </button>
        <button onClick={reset} className="btn-danger w-full">
          Réinitialiser les adhérents
        </button>
      </div>
    </div>
  );
}
