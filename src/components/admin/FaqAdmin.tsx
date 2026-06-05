"use client";

import { useEffect, useState, useCallback } from "react";
import { HelpCircle, Plus, Trash2, Pencil, Save, ChevronDown, ChevronUp, MessageCircleQuestion, Check, X, Mail } from "lucide-react";
import type { DB, FaqItem, FaqPendingQuestion } from "@/lib/types";
import { adminFaqPendingList, adminFaqAnswer, adminFaqReject } from "@/lib/db";

const SUGGESTED_CATEGORIES = ["Inscription", "Paiement", "Mon compte", "Tournois", "Application", "Communication"];

export default function FaqAdmin({
  db,
  onPersist,
  readOnly,
  adminEmail,
  adminCode,
  onRefresh,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  readOnly?: boolean;
  adminEmail?: string;
  adminCode?: string;
  onRefresh?: () => Promise<void>;
}) {
  const items = (db.faqItems ?? []).slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const open = db.faqOpen === true;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [formCategory, setFormCategory] = useState("");

  // 📥 Questions en attente posées par les adhérents
  const [pending, setPending] = useState<FaqPendingQuestion[]>([]);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [pendingAnswer, setPendingAnswer] = useState("");
  const [pendingCategory, setPendingCategory] = useState("");

  const refreshPending = useCallback(async () => {
    if (!adminEmail || !adminCode) return;
    const r = await adminFaqPendingList(adminEmail, adminCode);
    if (r.ok && r.pending) setPending(r.pending);
  }, [adminEmail, adminCode]);

  useEffect(() => { refreshPending(); }, [refreshPending]);

  async function answerPending(id: string) {
    if (!adminEmail || !adminCode) return;
    if (pendingAnswer.trim().length < 5) {
      alert("Réponse trop courte.");
      return;
    }
    const r = await adminFaqAnswer(adminEmail, adminCode, id, pendingAnswer.trim(), pendingCategory.trim() || undefined);
    if (!r.ok) {
      alert("Erreur : " + (r.reason || "inconnue"));
      return;
    }
    setAnsweringId(null);
    setPendingAnswer("");
    setPendingCategory("");
    await refreshPending();
    if (onRefresh) await onRefresh();
  }

  async function rejectPending(id: string) {
    if (!adminEmail || !adminCode) return;
    if (!confirm("Supprimer cette question sans y répondre ?\n\nL'adhérent ne sera pas notifié.")) return;
    const r = await adminFaqReject(adminEmail, adminCode, id);
    if (!r.ok) {
      alert("Erreur : " + (r.reason || "inconnue"));
      return;
    }
    await refreshPending();
  }

  function resetForm() {
    setFormQuestion(""); setFormAnswer(""); setFormCategory("");
    setEditingId(null); setAddingNew(false);
  }

  function startEdit(item: FaqItem) {
    setEditingId(item.id);
    setAddingNew(false);
    setOpenId(null);
    setFormQuestion(item.question);
    setFormAnswer(item.answer);
    setFormCategory(item.category || "");
  }

  function startAdd() {
    resetForm();
    setAddingNew(true);
  }

  async function toggleOpen() {
    if (readOnly) return;
    setSaving(true);
    await onPersist({ ...db, faqOpen: !open });
    setSaving(false);
  }

  async function saveItem() {
    if (readOnly) return;
    if (!formQuestion.trim() || !formAnswer.trim()) {
      alert("Question et réponse sont obligatoires.");
      return;
    }
    setSaving(true);
    const trimmed: FaqItem = {
      id: editingId || `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      question: formQuestion.trim(),
      answer: formAnswer.trim(),
      category: formCategory.trim() || undefined,
      order: editingId
        ? (items.find((i) => i.id === editingId)?.order ?? items.length)
        : items.length,
    };
    const next = editingId
      ? items.map((i) => (i.id === editingId ? trimmed : i))
      : [...items, trimmed];
    await onPersist({ ...db, faqItems: next });
    setSaving(false);
    resetForm();
  }

  async function deleteItem(id: string) {
    if (readOnly) return;
    if (!confirm("Supprimer cette question ?")) return;
    await onPersist({ ...db, faqItems: items.filter((i) => i.id !== id) });
  }

  async function moveItem(id: string, direction: -1 | 1) {
    if (readOnly) return;
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= items.length) return;
    const reordered = [...items];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    // Recalculer les order
    const updated = reordered.map((i, n) => ({ ...i, order: n }));
    await onPersist({ ...db, faqItems: updated });
  }

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display text-xl tracking-wider text-slate-800">FAQ adhérents</h3>
            <p className="text-xs text-slate-500">{items.length} question{items.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={startAdd}
                disabled={addingNew || editingId !== null}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
              <button
                onClick={toggleOpen}
                disabled={saving}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  open
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                }`}
              >
                {open ? "✓ FAQ visible" : "✗ FAQ masquée"}
              </button>
            </>
          )}
        </div>
      </div>

      {!open && items.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-slate-600">
            ℹ️ La FAQ est <strong>masquée</strong> côté public. Clique sur le bouton ci-dessus pour la rendre visible (section sur la home + page /faq).
          </p>
        </div>
      )}

      {/* 📥 Questions en attente posées par les adhérents */}
      {pending.length > 0 && (
        <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircleQuestion className="w-5 h-5 text-amber-700" />
            <h4 className="text-sm font-bold text-amber-900">
              {pending.length} question{pending.length > 1 ? "s" : ""} en attente de réponse
            </h4>
          </div>
          <ul className="space-y-3">
            {pending.map((p) => {
              const isAnswering = answeringId === p.id;
              return (
                <li key={p.id} className="bg-white border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-slate-800 font-medium mb-1.5">« {p.question} »</p>
                  <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1.5 flex-wrap">
                    <span><strong>{p.membreNom}</strong></span>
                    <span className="text-slate-300">·</span>
                    <a href={`mailto:${p.membreEmail}`} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" />{p.membreEmail}
                    </a>
                    <span className="text-slate-300">·</span>
                    <span>{new Date(p.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </p>

                  {!isAnswering && !readOnly && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setAnsweringId(p.id); setPendingAnswer(""); setPendingCategory(""); }}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Répondre & publier
                      </button>
                      <button
                        onClick={() => rejectPending(p.id)}
                        className="text-xs bg-white border border-red-300 text-red-700 hover:bg-red-50 font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Rejeter
                      </button>
                    </div>
                  )}

                  {isAnswering && (
                    <div className="space-y-2 mt-2">
                      <textarea
                        value={pendingAnswer}
                        onChange={(e) => setPendingAnswer(e.target.value)}
                        rows={4}
                        placeholder="Votre réponse à publier dans la FAQ…"
                        className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white"
                        maxLength={2000}
                      />
                      <input
                        type="text"
                        value={pendingCategory}
                        onChange={(e) => setPendingCategory(e.target.value)}
                        placeholder="Catégorie (optionnel) : Inscription, Tournois, Mon compte…"
                        className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 bg-white"
                        maxLength={40}
                        list="faq-pending-cat-suggestions"
                      />
                      <datalist id="faq-pending-cat-suggestions">
                        {["Inscription", "Paiement", "Mon compte", "Tournois", "Application", "Communication"].map((c) => <option key={c} value={c} />)}
                      </datalist>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setAnsweringId(null); setPendingAnswer(""); setPendingCategory(""); }}
                          className="flex-1 text-xs border border-slate-300 text-slate-600 rounded-lg py-2 hover:bg-slate-50"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => answerPending(p.id)}
                          disabled={pendingAnswer.trim().length < 5}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg py-2 inline-flex items-center justify-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" /> Publier dans la FAQ
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-700">
                        💡 L&apos;adhérent recevra automatiquement un email avec ta réponse.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Formulaire ajout/édition */}
      {(addingNew || editingId) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-xs uppercase tracking-widest text-blue-700 font-semibold mb-3">
            {editingId ? "Modifier la question" : "Nouvelle question"}
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold block mb-1">Question</label>
              <input
                type="text"
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                placeholder="Ex: Comment payer mon adhésion ?"
                className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold block mb-1">Réponse</label>
              <textarea
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
                placeholder="Ta réponse claire et détaillée…"
                rows={5}
                className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
                maxLength={2000}
              />
              <p className="text-[10px] text-slate-500 mt-0.5">{formAnswer.length}/2000</p>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold block mb-1">Catégorie (optionnel)</label>
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="Ex: Paiement, Inscription, Tournois…"
                className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white mb-1"
                maxLength={40}
                list="faq-cat-suggestions"
              />
              <datalist id="faq-cat-suggestions">
                {SUGGESTED_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetForm}
                className="flex-1 text-xs border border-slate-300 text-slate-600 rounded-lg py-2 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={saveItem}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg py-2 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Enregistrement…" : (editingId ? "Enregistrer" : "Ajouter")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des questions existantes */}
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-6">
          Aucune question pour le moment. Clique sur « Ajouter » pour créer ta première FAQ.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => {
            const isOpen = openId === item.id;
            return (
              <li key={item.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  {!readOnly && (
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveItem(item.id, -1)}
                        disabled={idx === 0}
                        className="text-slate-300 hover:text-slate-700 disabled:opacity-30"
                        title="Monter"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveItem(item.id, 1)}
                        disabled={idx === items.length - 1}
                        className="text-slate-300 hover:text-slate-700 disabled:opacity-30"
                        title="Descendre"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.question}</p>
                    {item.category && (
                      <span className="inline-block mt-0.5 text-[10px] uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-1.5 py-0.5 font-semibold">
                        {item.category}
                      </span>
                    )}
                  </button>
                  {!readOnly && (
                    <>
                      <button
                        onClick={() => startEdit(item)}
                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-400 hover:text-red-600 p-1.5 rounded"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
                {isOpen && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50">
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
