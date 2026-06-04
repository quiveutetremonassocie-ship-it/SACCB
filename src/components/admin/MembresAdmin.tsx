"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2, Receipt, Mail, Search, Users, CheckCircle2, Clock, Send, Bell, BellOff, UserPlus, X, Camera, CameraOff, KeyRound, AlarmClock } from "lucide-react";
import { DB, Membre, FormerMember } from "@/lib/types";
import { adminSendConfirmation, adminSendWelcome, adminResetMemberCode, adminSendPaymentReminder } from "@/lib/db";

export default function MembresAdmin({
  db,
  onPersist,
  onEdit,
  onRecu,
  adminEmail,
  adminCode,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  onEdit: (m: Membre) => void;
  onRecu: (m: Membre) => void;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
}) {
  const [autoSendEmail, setAutoSendEmail] = useState(true);
  const [search, setSearch] = useState("");
  const [filterNoPhoto, setFilterNoPhoto] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "Adulte" | "Etudiant">("all");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    nom: "", email: "", tel: "", type: "Adulte" as "Adulte" | "Etudiant",
    paymentMethod: "virement" as "online" | "virement", code: "", ok: false,
    sendWelcome: true,
  });
  const [addLoading, setAddLoading] = useState(false);

  function genCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function openAddForm() {
    setAddForm({
      nom: "", email: "", tel: "", type: "Adulte", paymentMethod: "virement",
      code: genCode(), ok: true, sendWelcome: true,
    });
    setShowAddForm(true);
  }

  const noPhotoCount = db.membres.filter((m) => m.photoConsent !== true).length;
  const adultesCount = db.membres.filter((m) => m.type === "Adulte").length;
  const etudiantsCount = db.membres.filter((m) => m.type === "Etudiant").length;

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return [...db.membres]
      .filter(
        (m) =>
          (m.nom.toLowerCase().includes(s) ||
          m.email.toLowerCase().includes(s) ||
          (m.tel && m.tel.includes(s))) &&
          (!filterNoPhoto || m.photoConsent !== true) &&
          (filterType === "all" || m.type === filterType)
      )
      .sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? 1 : -1));
  }, [db.membres, search, filterNoPhoto, filterType]);

  async function togglePaiement(id: string, val: boolean) {
    const next = { ...db, membres: db.membres.map((m) => (m.id === id ? { ...m, ok: val } : m)) };
    await onPersist(next);
    if (val && autoSendEmail && adminEmail && adminCode) {
      adminSendConfirmation(id, adminEmail, adminCode).catch(() => {});
    }
  }

  async function sendEmail(m: Membre) {
    if (!adminEmail || !adminCode) {
      alert("Identifiants admin manquants pour envoyer l'email.");
      return;
    }
    setSendingEmail(m.id);
    await adminSendConfirmation(m.id, adminEmail, adminCode);
    setSendingEmail(null);
  }

  async function del(id: string) {
    if (!confirm("Supprimer cet adhérent ?")) return;
    const next = { ...db, membres: db.membres.filter((m) => m.id !== id) };
    await onPersist(next);
  }

  // 💸 Envoyer un rappel de paiement à un adhérent
  const [reminderId, setReminderId] = useState<string | null>(null);
  async function sendPaymentReminder(m: Membre) {
    if (!adminEmail || !adminCode) { alert("Identifiants admin manquants."); return; }
    if (!confirm(`Envoyer un rappel de paiement par email à ${m.nom} ?\n\nL'email sera envoyé à : ${m.email}`)) return;
    setReminderId(m.id);
    const r = await adminSendPaymentReminder(m.id, adminEmail, adminCode);
    setReminderId(null);
    if (r.ok) alert(`✅ Rappel envoyé à ${m.nom}.`);
    else alert(`❌ Échec : ${r.reason || "erreur inconnue"}`);
  }

  // 🔑 Réinitialiser le code d'un adhérent (avec DOUBLE confirmation pour éviter le clic accidentel)
  const [resettingId, setResettingId] = useState<string | null>(null);
  async function resetCode(m: Membre) {
    if (!adminEmail || !adminCode) {
      alert("Identifiants admin manquants.");
      return;
    }
    // 1ère confirmation : alerte forte
    const ok1 = confirm(
      `⚠️ RÉINITIALISER LE CODE de ${m.nom} ?\n\n` +
      `Un NOUVEAU code aléatoire sera généré et envoyé par email à :\n${m.email}\n\n` +
      `L'ancien code ne fonctionnera plus.`
    );
    if (!ok1) return;
    // 2e confirmation : il faut taper le nom pour valider
    const typed = prompt(
      `Pour confirmer, tapez le NOM EXACT de l'adhérent ci-dessous :\n\n${m.nom}`
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== m.nom.trim().toLowerCase()) {
      alert("Le nom saisi ne correspond pas. Réinitialisation annulée.");
      return;
    }
    setResettingId(m.id);
    const r = await adminResetMemberCode(m.id, adminEmail, adminCode);
    setResettingId(null);
    if (r.ok) {
      alert(`✅ Code réinitialisé. Un email avec le nouveau code a été envoyé à ${m.email}.`);
    } else {
      alert(`❌ Échec : ${r.reason || "erreur inconnue"}`);
    }
  }

  function copyEmails() {
    const emails = db.membres.map((m) => m.email).join(", ");
    navigator.clipboard.writeText(emails).then(() => alert("Emails copiés !"));
  }

  async function handleAddMembre() {
    if (!addForm.nom || !addForm.email) return;
    setAddLoading(true);
    const finalCode = addForm.code.trim() || genCode();
    const newMembre: Membre = {
      id: Date.now().toString(),
      nom: addForm.nom.trim(),
      email: addForm.email.trim().toLowerCase(),
      tel: addForm.tel.trim(),
      type: addForm.type,
      paymentMethod: addForm.paymentMethod,
      code: finalCode,
      ok: addForm.ok,
      newsOptIn: false,
    };
    await onPersist({ ...db, membres: [...db.membres, newMembre] });

    // Envoyer l'email de bienvenue si demandé
    if (addForm.sendWelcome && adminEmail && adminCode) {
      adminSendWelcome(newMembre.id, adminEmail, adminCode).catch(() => {});
    }

    setAddForm({ nom: "", email: "", tel: "", type: "Adulte", paymentMethod: "virement", code: genCode(), ok: true, sendWelcome: true });
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
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Bell className="w-3 h-3" /> {newsCount} aux news
              <span className="text-slate-300">·</span>
              <CameraOff className="w-3 h-3 text-orange-400" /> {noPhotoCount} sans droit photo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
            {db.membres.length} adhérent{db.membres.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center justify-between mb-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <Send className="w-3.5 h-3.5 text-emerald-500" />
            Envoyer l'email de confirmation lors de la validation
          </span>
          <button
            onClick={() => setAutoSendEmail(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${autoSendEmail ? "bg-emerald-500" : "bg-slate-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSendEmail ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      )}

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
        {/* Filtre type adhérent (Tous / Adultes / Étudiants) - cycle au clic */}
        <button
          onClick={() => setFilterType((v) => v === "all" ? "Adulte" : v === "Adulte" ? "Etudiant" : "all")}
          className={`btn-primary !px-3 shrink-0 ${
            filterType === "Adulte" ? "!bg-gradient-to-r !from-blue-500 !to-cyan-500"
            : filterType === "Etudiant" ? "!bg-gradient-to-r !from-emerald-500 !to-green-500"
            : "!bg-gradient-to-r !from-slate-400 !to-slate-500"
          }`}
          title={
            filterType === "all" ? `Filtrer (actuel : tous)`
            : filterType === "Adulte" ? `Filtre Adultes — clique pour voir Étudiants`
            : `Filtre Étudiants — clique pour tout afficher`
          }
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">
            {filterType === "all" ? "Tous"
              : filterType === "Adulte" ? `Adultes (${adultesCount})`
              : `Étudiants (${etudiantsCount})`}
          </span>
        </button>
        <button
          onClick={() => setFilterNoPhoto((v) => !v)}
          className={`btn-primary !px-3 shrink-0 ${filterNoPhoto ? "!bg-gradient-to-r !from-orange-500 !to-amber-500" : "!bg-gradient-to-r !from-slate-400 !to-slate-500"}`}
          title={filterNoPhoto ? "Afficher tous les adhérents" : "Voir uniquement sans droit à l'image"}
        >
          <CameraOff className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">{filterNoPhoto ? `Sans photo (${noPhotoCount})` : "Sans photo"}</span>
        </button>
        <button onClick={copyEmails} className="btn-primary !px-3 shrink-0" title="Copier les emails">
          <Mail className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Emails</span>
        </button>
        {!readOnly && (
          <button onClick={openAddForm} className="btn-accent !px-3 shrink-0" title="Ajouter un adhérent">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Ajouter</span>
          </button>
        )}
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
            <div className="relative">
              <input
                className="input !text-sm pr-10 font-mono"
                placeholder="Code provisoire"
                value={addForm.code}
                onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setAddForm({ ...addForm, code: genCode() })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-1.5 py-0.5"
                title="Regénérer"
              >↺</button>
            </div>
            <select className="input !text-sm" value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value as any })}>
              <option value="Adulte">Adulte</option>
              <option value="Etudiant">Étudiant</option>
            </select>
            <select className="input !text-sm" value={addForm.paymentMethod} onChange={(e) => setAddForm({ ...addForm, paymentMethod: e.target.value as any })}>
              <option value="virement">Virement</option>
              <option value="online">En ligne</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input type="checkbox" checked={addForm.ok} onChange={(e) => setAddForm({ ...addForm, ok: e.target.checked })} className="w-4 h-4" />
              Paiement déjà reçu
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input type="checkbox" checked={addForm.sendWelcome} onChange={(e) => setAddForm({ ...addForm, sendWelcome: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
              <span>Envoyer un email de bienvenue avec le code provisoire</span>
            </label>
          </div>
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
                  {m.photoConsent === true ? (
                    <Camera className="w-3 h-3 text-violet-500 shrink-0" aria-label="Droit à l'image accordé" />
                  ) : (
                    <CameraOff className="w-3 h-3 text-orange-400 shrink-0" aria-label="Pas de droit à l'image" />
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
              {!readOnly ? (
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
              ) : (
                <span className={`text-xs flex items-center gap-1 ${m.ok ? "text-emerald-600" : "text-red-500"}`}>
                  {m.ok ? <><CheckCircle2 className="w-3.5 h-3.5" /> Payé</> : <><Clock className="w-3.5 h-3.5" /> En attente</>}
                </span>
              )}
              <div className="flex gap-1">
                {!readOnly && m.ok && (
                  <button
                    onClick={() => sendEmail(m)}
                    disabled={sendingEmail === m.id}
                    className="btn-primary !px-2 !py-1 !text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500"
                    title="Envoyer l'email de confirmation"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
                {!readOnly && !m.ok && (
                  <button
                    onClick={() => sendPaymentReminder(m)}
                    disabled={reminderId === m.id}
                    className="btn-primary !px-2 !py-1 !text-xs !bg-gradient-to-r !from-purple-500 !to-pink-500"
                    title="Envoyer un rappel de paiement par email"
                  >
                    <AlarmClock className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => onRecu(m)} className="btn-primary !px-2 !py-1 !text-xs" title="Reçu">
                  <Receipt className="w-3.5 h-3.5" />
                </button>
                {!readOnly && (
                  <button onClick={() => onEdit(m)} className="btn-primary !px-2 !py-1 !text-xs" title="Modifier">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {!readOnly && (
                  <button
                    onClick={() => resetCode(m)}
                    disabled={resettingId === m.id}
                    className="btn-primary !px-2 !py-1 !text-xs !bg-gradient-to-r !from-amber-500 !to-orange-500"
                    title="Réinitialiser le code (envoie un nouveau code par email)"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                )}
                {!readOnly && (
                  <button onClick={() => del(m.id)} className="btn-danger !px-2 !py-1 !text-xs" title="Supprimer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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
              <th className="p-3">Photo</th>
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
                  {m.photoConsent === true ? (
                    <span className="flex items-center gap-1 text-violet-600 text-xs"><Camera className="w-3 h-3" /> Oui</span>
                  ) : (
                    <span className="flex items-center gap-1 text-orange-400 text-xs"><CameraOff className="w-3 h-3" /> Non</span>
                  )}
                </td>
                <td className="p-3">
                  {!readOnly ? (
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
                  ) : (
                    <span className={`text-xs ${m.ok ? "text-emerald-600" : "text-red-500"}`}>
                      {m.ok ? "Payé" : "En attente"}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {!readOnly && m.ok && (
                      <button
                        onClick={() => sendEmail(m)}
                        disabled={sendingEmail === m.id}
                        className="btn-primary !px-2 !py-1 !text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500"
                        title="Envoyer l'email de confirmation"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    )}
                    {!readOnly && !m.ok && (
                      <button
                        onClick={() => sendPaymentReminder(m)}
                        disabled={reminderId === m.id}
                        className="btn-primary !px-2 !py-1 !text-xs !bg-gradient-to-r !from-purple-500 !to-pink-500"
                        title="Envoyer un rappel de paiement par email"
                      >
                        <AlarmClock className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={() => onRecu(m)} className="btn-primary !px-2 !py-1 !text-xs" title="Reçu">
                      <Receipt className="w-3 h-3" />
                    </button>
                    {!readOnly && (
                      <button onClick={() => onEdit(m)} className="btn-primary !px-2 !py-1 !text-xs" title="Modifier">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    {!readOnly && (
                      <button
                        onClick={() => resetCode(m)}
                        disabled={resettingId === m.id}
                        className="btn-primary !px-2 !py-1 !text-xs !bg-gradient-to-r !from-amber-500 !to-orange-500"
                        title="Réinitialiser le code (envoie un nouveau code par email)"
                      >
                        <KeyRound className="w-3 h-3" />
                      </button>
                    )}
                    {!readOnly && (
                      <button onClick={() => del(m.id)} className="btn-danger !px-2 !py-1 !text-xs" title="Supprimer">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-400">Aucun adhérent.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 👋 Anciens membres (non réadhérés) */}
      {(db.formerMembers ?? []).length > 0 && (
        <FormerMembersSection formerMembers={db.formerMembers!} db={db} onPersist={onPersist} readOnly={readOnly} />
      )}
    </div>
  );
}

function FormerMembersSection({
  formerMembers,
  db,
  onPersist,
  readOnly,
}: {
  formerMembers: FormerMember[];
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Grouper par saison
  const bySaison = useMemo(() => {
    const map = new Map<string, FormerMember[]>();
    for (const fm of formerMembers) {
      const key = fm.saison || "Inconnue";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(fm);
    }
    return Array.from(map.entries()).reverse();
  }, [formerMembers]);

  return (
    <div className="mt-6 pt-5 border-t border-red-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">👋</span>
          <div>
            <p className="text-sm font-semibold text-red-700">
              Anciens membres non réadhérés ({formerMembers.length})
            </p>
            <p className="text-xs text-red-400">Personnes supprimées après date limite — à retirer du groupe WhatsApp</p>
          </div>
        </div>
        <span className={`text-red-400 transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {bySaison.map(([saison, members]) => (
            <div key={saison}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Saison {saison}
              </p>
              <div className="space-y-1">
                {members.map((fm, i) => (
                  <div
                    key={`${fm.email}-${i}`}
                    className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{fm.nom}</p>
                      <p className="text-xs text-slate-400">{fm.email} · {fm.type}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <p className="text-[10px] text-red-400">
                        {new Date(fm.removedAt).toLocaleDateString("fr-FR")}
                      </p>
                      {!readOnly && (
                        <button
                          onClick={async () => {
                            const updated = (db.formerMembers ?? []).filter((_, j) => {
                              // Trouver l'index global de cet élément
                              const globalIdx = formerMembers.indexOf(fm);
                              return j !== globalIdx;
                            });
                            await onPersist({ ...db, formerMembers: updated });
                          }}
                          className="text-red-400 hover:text-red-600 transition p-0.5"
                          title="Retirer de la liste"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!readOnly && (
            <button
              onClick={async () => {
                if (!confirm(
                  `Vider la liste des ${formerMembers.length} ancien(s) membre(s) ?\n\n` +
                  `Faites-le uniquement après les avoir retirés du groupe WhatsApp.`
                )) return;
                await onPersist({ ...db, formerMembers: [] });
              }}
              className="btn-danger !text-xs w-full"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vider la liste (après nettoyage WhatsApp)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
