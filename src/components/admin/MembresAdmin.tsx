"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2, Receipt, Mail, Search, Users } from "lucide-react";
import { DB, Membre } from "@/lib/types";

export default function MembresAdmin({
  db,
  onPersist,
  onEdit,
  onRecu,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  onEdit: (m: Membre) => void;
  onRecu: (m: Membre) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return [...db.membres]
      .filter(
        (m) =>
          m.nom.toLowerCase().includes(s) ||
          m.email.toLowerCase().includes(s) ||
          (m.tel && m.tel.includes(s))
      )
      .sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? 1 : -1));
  }, [db.membres, search]);

  async function togglePaiement(id: string, val: boolean) {
    const next = {
      ...db,
      membres: db.membres.map((m) => (m.id === id ? { ...m, ok: val } : m)),
    };
    await onPersist(next);
  }

  async function del(id: string) {
    if (!confirm("Supprimer cet adhérent ?")) return;
    const next = { ...db, membres: db.membres.filter((m) => m.id !== id) };
    await onPersist(next);
  }

  function copyEmails() {
    const emails = db.membres.map((m) => m.email).join(", ");
    navigator.clipboard.writeText(emails).then(() => alert("Emails copiés !"));
  }

  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-display text-2xl tracking-wider text-white">Adhérents Club</h3>
        </div>
        <span className="px-4 py-2 rounded-full bg-blue-500/20 text-blue-300 text-sm font-bold">
          {db.membres.length} adhérent{db.membres.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            className="input !pl-10"
            placeholder="Recherche..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={copyEmails} className="btn-primary whitespace-nowrap">
          <Mail className="w-4 h-4" /> Emails
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left text-xs uppercase tracking-widest text-white/60">
              <th className="p-3">Nom</th>
              <th className="p-3">Email</th>
              <th className="p-3">Tel</th>
              <th className="p-3">Type</th>
              <th className="p-3">Mode</th>
              <th className="p-3">Paiement</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr
                key={m.id}
                className={`border-t border-white/5 ${!m.ok ? "opacity-70" : ""}`}
              >
                <td className="p-3 text-white">{m.nom}</td>
                <td className="p-3 text-white/70 break-all">{m.email}</td>
                <td className="p-3 text-white/60">{m.tel || "-"}</td>
                <td className="p-3 text-white/70">{m.type}</td>
                <td className="p-3">
                  {m.paymentMethod === "online" ? (
                    <span className="text-blue-400 text-xs">En ligne</span>
                  ) : m.paymentMethod === "virement" ? (
                    <span className="text-amber-400 text-xs">Virement</span>
                  ) : (
                    <span className="text-white/40 text-xs">–</span>
                  )}
                </td>
                <td className="p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!m.ok}
                      onChange={(e) => togglePaiement(m.id, e.target.checked)}
                    />
                    {m.ok ? (
                      <span className="text-emerald-400 text-xs">Payé</span>
                    ) : (
                      <span className="text-red-400 text-xs">En attente</span>
                    )}
                  </label>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => onRecu(m)} className="btn-primary !px-2 !py-1 !text-xs" title="Reçu">
                      <Receipt className="w-3 h-3" />
                    </button>
                    <button onClick={() => onEdit(m)} className="btn-primary !px-2 !py-1 !text-xs" title="Modifier">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => del(m.id)} className="btn-danger !px-2 !py-1 !text-xs" title="Supprimer">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-white/40">
                  Aucun adhérent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
