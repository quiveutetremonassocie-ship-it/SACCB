"use client";

import { useState } from "react";
import { Pencil, Trash2, Users, Plus } from "lucide-react";
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
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  async function del(id: string) {
    const next = { ...db, inscrits_tournoi: db.inscrits_tournoi.filter((i) => i.id !== id) };
    await onPersist(next);
  }

  async function setResultat(id: string, resultat: string) {
    const next = {
      ...db,
      inscrits_tournoi: db.inscrits_tournoi.map((i) =>
        i.id === id ? { ...i, resultat: resultat.trim() || null } : i
      ),
    };
    await onPersist(next);
  }

  async function addBinome(tournoiId: string) {
    if (!p1.trim() || !p2.trim()) {
      alert("Les deux noms sont requis.");
      return;
    }
    const newInscrit = {
      id: Date.now().toString(),
      tournoiId,
      joueurs: `${p1.trim()} / ${p2.trim()}`,
    };
    const next = {
      ...db,
      inscrits_tournoi: [...db.inscrits_tournoi, newInscrit],
    };
    await onPersist(next);
    setP1("");
    setP2("");
    setAddingFor(null);
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
        return (
          <div key={t.id} className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="bg-blue-100 text-blue-700 px-3 py-2 rounded-xl font-semibold flex-1 mr-2">
                {t.name}
                <span className="ml-2 font-normal text-blue-500 text-xs">({inscrits.length} binôme{inscrits.length > 1 ? "s" : ""})</span>
              </p>
              <button
                onClick={() => {
                  setAddingFor(addingFor === t.id ? null : t.id);
                  setP1("");
                  setP2("");
                }}
                className="btn-primary !px-3 !py-1.5 !text-xs shrink-0"
                title="Ajouter un binôme"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>

            {/* Formulaire d'ajout manuel */}
            {addingFor === t.id && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2 space-y-2">
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-widest">Ajouter un binôme manuellement</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input !text-sm"
                    placeholder="Joueur 1"
                    value={p1}
                    onChange={(e) => setP1(e.target.value)}
                  />
                  <input
                    className="input !text-sm"
                    placeholder="Joueur 2"
                    value={p2}
                    onChange={(e) => setP2(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addBinome(t.id)} className="btn-primary !px-3 !py-1.5 !text-xs flex-1">
                    <Plus className="w-3 h-3" /> Enregistrer
                  </button>
                  <button onClick={() => setAddingFor(null)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {inscrits.length === 0 ? (
              <p className="text-slate-400 text-sm px-1">Aucun binôme inscrit.</p>
            ) : (
              <div className="space-y-1">
                {inscrits.map((i) => (
                  <div
                    key={i.id}
                    className="bg-slate-50 rounded-xl px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700 text-sm font-medium">{i.joueurs}</span>
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
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 shrink-0">Résultat :</span>
                      <input
                        className="input !text-xs !py-0.5 !px-2 flex-1"
                        placeholder='ex: 3/25 (3ème sur 25)'
                        defaultValue={i.resultat || ""}
                        onBlur={(e) => setResultat(i.id, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && setResultat(i.id, (e.target as HTMLInputElement).value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {(!db.config_tournois || db.config_tournois.length === 0) && (
        <p className="text-slate-400 text-sm">Aucun tournoi configuré.</p>
      )}
    </div>
  );
}
