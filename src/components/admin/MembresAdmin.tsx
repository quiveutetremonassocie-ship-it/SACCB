"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2, Receipt, Mail, Search, Users, CheckCircle2, Clock, Send, Bell, BellOff, UserPlus, X } from "lucide-react";
import { DB, Membre } from "@/lib/types";
import { adminSendConfirmation } from "@/lib/db";

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
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    nom: "", email: "", tel: "", type: "Adulte" as "Adulte" | "Etudiant",
    paymentMethod: "virement" as "online" | "virement", code: "", ok: false,
  });
  const [addLoading, setAddLoading] = useState(false);

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
    // Marque payé sans envoyer d'email — utilise le bouton ✉️ pour envoyer manuellement
    const next = {
      ...db,
      membres: db.membres.map((m) => (m.id === id ? { ...m, ok: val } : m)),
    };
    await onPersist(next);
  }

  async function sendEmail(m: Membre) {
    setSendingEmail(m.id);
    await adminSendConfirmation(m.id);
    setSendingEmail(null);
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

  async function handleAddMembre() {
    if (!addForm.nom || !addForm.email) return;
    setAddLoading(true);
    const newMembre: Membre = {
      id: Date.now().toString(),
      nom: addForm.nom.trim(),
      email: addForm.email.trim().toLowerCase(),
      tel: addForm.tel.trim(),
      type: addForm.type,
      paymentMethod: addForm.paymentMethod,
      code: addForm.code.trim() || undefined,
      ok: addForm.ok,
      newsOptIn: false,
    };
    await onPersist({ ...db, membres: [...db.membres, newMembre] });
    setAddForm({ nom: "", email: "", tel: "", type: "Adulte", paymentMethod: "virement", code: "", ok: false });
    setShowAddForm(false);
    setAddLoading(false);
  }

  const newsCount = db.membres.filter((m) => m.newsOptIn === true).length;

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display text-xl md:text-2xl tracking-wider text-slate-800">Adhérents</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Bell className="w-3 h-3" /> {newsCount} abonné{newsCount > 1 ? "s" : ""} aux news
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
            {db.membres.length} adhérent{db.membres.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={copyEmails} className="btn-primary !px-3 shrink-0" title="Copier les emails">
          <Mail className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Emails</span>
        </button>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-accent !px-3 shrink-0" title="Ajouter un adhérent">
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Ajouter</span>
        </button>
      </div>

      {/* Formulaire ajout manuel */}
      {showAddForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-slate-700">Ajouter un adhérent manuellement</p>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className="input !text-sm" placeholder="Nom et prénom *" value={addForm.nom} onChange={(e) => setAddForm({ ...addForm, nom: e.target.value })} />
            <input className="input !text-sm" type="email" placeholder="Email *" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
            <input className="input !text-sm" placeholder="Téléphone" value={addForm.tel} onChange={(e) => setAddForm({ ...addForm, tel: e.target.value })} />
            <input className="input !text-sm" placeholder="Code personnel (optionnel)" value={addForm.code} onChange={(e) => setAddForm({ ...addForm, code: e.target.value })} />
            <select className="input !text-sm" value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value as any })}>
              <option value="Adulte">Adulte</option>
              <option value="Etudiant">Étudiant</option>
            </select>
            <select className="input !text-sm" value={addForm.paymentMethod} onChange={(e) => setAddForm({ ...addForm, paymentMethod: e.target.value as any })}>
              <option value="virement">Virement</option>
              <option value="online">En ligne</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
            <input type="checkbox" checked={addForm.ok} onChange={(e) => setAddForm({ ...addForm, ok: e.target.checked })} className="w-4 h-4" />
            Paiement déjà reçu
          </label>
          <button onClick={handleAddMembre} className="btn-primary !text-sm" disabled={addLoading || !addForm.nom || !addForm.email}>
            {addLoading ? "Ajout..." : "Ajouter l'adhérent"}
          </button>
        </div>
      )}

      {/* Mobile : cartes */}
      <div className="md:hidden space-y-3">
        {filtered.map((m) => (
          <div
            key={m.id}
            className={`bg-slate-50 rounded-xl p-3 border ${m.ok ? "border-emerald-200" : "border-red-100"}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-slate-800 truncate">{m.nom}</p>
                  {m.newsOptIn === true ? (
                    <Bell className="w-3 h-3 text-emerald-500 shrink-0" aria-label="Abonné aux news" />
                  ) : (
                    <BellOff className="w-3 h-3 text-slate-300 shrink-0" aria-label="Non abonné aux news" />
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{m.email}</p>
                {m.tel && <p className="text-xs text-slate-400">{m.tel}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs text-slate-400">{m.type}</span>
                {m.paymentMethod === "online" ? (
                  <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">En ligne</span>
                ) : m.paymentMethod === "virement" ? (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Virement</span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!m.ok}
                  onChange={(e) => togglePaiement(m.id, e.target.checked)}
                  className="w-4 h-4"
                />
                {m.ok ? (
                  <span className="text-emerald-600 text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Payé
                  </span>
                ) : (
                  <span className="text-red-500 text-xs flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> En attente
                  </span>
                )}
              </label>
              <div className="flex gap-1">
                {m.ok && (
                  <button
                    onClick={() => sendEmail(m)}
                    disabled={sendingEmail === m.id}
                    className="btn-primary !px-2 !py-1 !text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500"
                    title="Envoyer l'email de confirmation"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => onRecu(m)} className="btn-primary !px-2 !py-1 !text-xs" title="Reçu">
                  <Receipt className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onEdit(m)} className="btn-primary !px-2 !py-1 !text-xs" title="Modifier">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => del(m.id)} className="btn-danger !px-2 !py-1 !text-xs" title="Supprimer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 py-6 text-sm">Aucun adhérent.</p>
        )}
      </div>

      {/* Desktop : tableau */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="p-3">Nom</th>
              <th className="p-3">Email</th>
              <th className="p-3">Tel</th>
              <th className="p-3">Type</th>
              <th className="p-3">Mode</th>
              <th className="p-3">News</th>
              <th className="p-3">Paiement</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className={`border-t border-slate-100 ${!m.ok ? "opacity-70" : ""}`}>
                <td className="p-3 text-slate-800">{m.nom}</td>
                <td className="p-3 text-slate-500 break-all">{m.email}</td>
                <td className="p-3 text-slate-400">{m.tel || "-"}</td>
                <td className="p-3 text-slate-500">{m.type}</td>
                <td className="p-3">
                  {m.paymentMethod === "online" ? (
                    <span className="text-blue-600 text-xs">En ligne</span>
                  ) : m.paymentMethod === "virement" ? (
                    <span className="text-amber-600 text-xs">Virement</span>
                  ) : (
                    <span className="text-slate-300 text-xs">–</span>
                  )}
                </td>
                <td className="p-3">
                  {m.newsOptIn === true ? (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs"><Bell className="w-3 h-3" /> Oui</span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-300 text-xs"><BellOff className="w-3 h-3" /> Non</span>
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
                      <span className="text-emerald-600 text-xs">Payé</span>
                    ) : (
                      <span className="text-red-500 text-xs">En attente</span>
                    )}
                  </label>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {m.ok && (
                      <button
                        onClick={() => sendEmail(m)}
                        disabled={sendingEmail === m.id}
                        className="btn-primary !px-2 !py-1 !text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500"
                        title="Envoyer l'email de confirmation"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    )}
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
                <td colSpan={8} className="p-6 text-center text-slate-400">Aucun adhérent.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
