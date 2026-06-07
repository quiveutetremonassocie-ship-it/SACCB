"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, BarChart3, MessageSquare, Lightbulb, FileText, Lock, Unlock, Send, X, Check, Calendar, Eye, EyeOff, ChevronDown, ChevronUp, Upload, FileDown, Mail, Bell, Paperclip } from "lucide-react";
import { DB, Poll, AGItem, ReunionReport } from "@/lib/types";
import { supabaseClient, REPORTS_BUCKET, EDGE_FUNCTION_URL, SUPA_KEY } from "@/lib/supabase";
import { adminNotifyEngagementOpen, adminNotifyNewPoll, adminSendReport } from "@/lib/db";

// Échappe le HTML pour insertion sûre dans des templates générés
function escapeHtmlClient(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function EngagementAdmin({
  db,
  onPersist,
  adminEmail,
  adminCode,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
}) {
  // Toggle granulaire géré juste après (besoin d'un state pour le bouton notifier)
  // Note : le hook useState pour notifying est défini plus bas (à côté des togglers)
  const [tab, setTab] = useState<"sondages" | "ag" | "reports">("sondages");

  // Migration douce : engagementOpen ancien équivaut aux 2 toggles
  // reportsOpen est nouveau : si non défini mais pollsOpen est true => on prend l'ancien comportement (groupé)
  const pollsOpen = db.pollsOpen === true || db.engagementOpen === true;
  const agOpen = db.agOpen === true || db.engagementOpen === true;
  const reportsOpen =
    db.reportsOpen === true ||
    (db.reportsOpen === undefined && (db.pollsOpen === true || db.engagementOpen === true));
  const [notifying, setNotifying] = useState(false);

  async function togglePolls() {
    if (readOnly) return;
    await onPersist({ ...db, pollsOpen: !pollsOpen, engagementOpen: undefined });
  }
  async function toggleAG() {
    if (readOnly) return;
    await onPersist({ ...db, agOpen: !agOpen, engagementOpen: undefined });
  }
  async function toggleReports() {
    if (readOnly) return;
    await onPersist({ ...db, reportsOpen: !reportsOpen, engagementOpen: undefined });
  }

  async function notifyAdherents() {
    if (readOnly || !adminEmail || !adminCode) return;
    if (!pollsOpen && !agOpen && !reportsOpen) {
      alert("Activez au moins une section (Sondages, AG ou Documents officiels) avant de notifier les adhérents.");
      return;
    }
    const sections: string[] = [];
    if (pollsOpen) sections.push("Sondages");
    if (agOpen) sections.push("Questions & idées AG");
    if (reportsOpen) sections.push("Documents officiels");
    const label = sections.join(" + ");
    if (!confirm(`Envoyer un email à tous les adhérents (payés + news activées) pour leur dire que "${label}" est maintenant disponible ?`)) return;
    setNotifying(true);
    const r = await adminNotifyEngagementOpen(adminEmail, adminCode, pollsOpen, agOpen, reportsOpen);
    setNotifying(false);
    if (r.ok) alert(`✅ Email envoyé à ${r.sent} adhérent${(r.sent ?? 0) > 1 ? "s" : ""} !`);
    else alert("Erreur : " + (r.reason || "Inconnue"));
  }

  return (
    <div className="glass p-4 md:p-6">
      <h3 className="font-display text-lg md:text-xl tracking-wider text-slate-800 mb-4 flex items-center gap-2">
        📣 Sondages, AG & Documents officiels
      </h3>

      {/* 2 toggles séparés visibilité côté site public */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-2">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
          Visibilité côté site public
        </p>
        {/* Toggle Sondages */}
        <button
          onClick={togglePolls}
          disabled={readOnly}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
            pollsOpen
              ? "bg-purple-50 border-purple-300 text-purple-800 hover:bg-purple-100"
              : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Sondages
          </span>
          <span className={`relative inline-block w-10 h-5 rounded-full transition-colors ${pollsOpen ? "bg-purple-500" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${pollsOpen ? "translate-x-5" : ""}`} />
          </span>
        </button>
        {/* Toggle AG */}
        <button
          onClick={toggleAG}
          disabled={readOnly}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
            agOpen
              ? "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
              : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Questions & idées AG
          </span>
          <span className={`relative inline-block w-10 h-5 rounded-full transition-colors ${agOpen ? "bg-amber-500" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${agOpen ? "translate-x-5" : ""}`} />
          </span>
        </button>
        {/* Toggle Documents officiels (comptes-rendus + rapports + charte) */}
        <button
          onClick={toggleReports}
          disabled={readOnly}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
            reportsOpen
              ? "bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100"
              : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Documents officiels
          </span>
          <span className={`relative inline-block w-10 h-5 rounded-full transition-colors ${reportsOpen ? "bg-blue-500" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${reportsOpen ? "translate-x-5" : ""}`} />
          </span>
        </button>

        {/* Bandeau d'info quand caché */}
        {!pollsOpen && !agOpen && !reportsOpen && (
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600 mt-1">
            🔒 Aucune section visible sur le site public.
          </div>
        )}

        {/* Bouton notifier les adhérents (visible si au moins 1 toggle activé) */}
        {(pollsOpen || agOpen || reportsOpen) && !readOnly && (
          <button
            onClick={notifyAdherents}
            disabled={notifying}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-blue-50 border-2 border-blue-300 text-blue-800 hover:bg-blue-100 transition disabled:opacity-50"
          >
            <Mail className="w-4 h-4" />
            {notifying ? "Envoi en cours..." : "📣 Notifier les adhérents par email"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-slate-200">
        <button
          onClick={() => setTab("sondages")}
          className={`px-3 py-2 text-sm font-medium transition border-b-2 -mb-[1px] ${tab === "sondages" ? "border-purple-500 text-purple-700" : "border-transparent text-slate-400 hover:text-slate-700"}`}
        >
          <BarChart3 className="w-4 h-4 inline mr-1.5" />
          Sondages ({(db.polls ?? []).length})
        </button>
        <button
          onClick={() => setTab("ag")}
          className={`px-3 py-2 text-sm font-medium transition border-b-2 -mb-[1px] ${tab === "ag" ? "border-amber-500 text-amber-700" : "border-transparent text-slate-400 hover:text-slate-700"}`}
        >
          <MessageSquare className="w-4 h-4 inline mr-1.5" />
          Questions AG ({(db.agItems ?? []).length})
        </button>
        <button
          onClick={() => setTab("reports")}
          className={`px-3 py-2 text-sm font-medium transition border-b-2 -mb-[1px] ${tab === "reports" ? "border-blue-500 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-700"}`}
        >
          <FileText className="w-4 h-4 inline mr-1.5" />
          Documents officiels ({(db.reunionReports ?? []).length})
        </button>
      </div>

      {tab === "sondages" && <PollsTab db={db} onPersist={onPersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={readOnly} />}
      {tab === "ag" && <AGTab db={db} onPersist={onPersist} readOnly={readOnly} />}
      {tab === "reports" && <ReportsTab db={db} onPersist={onPersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={readOnly} />}
    </div>
  );
}

// ─── Onglet sondages ───
function PollsTab({ db, onPersist, adminEmail, adminCode, readOnly }: { db: DB; onPersist: (db: DB) => Promise<void>; adminEmail?: string; adminCode?: string; readOnly?: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [notifyingPollId, setNotifyingPollId] = useState<string | null>(null);
  const polls = db.polls ?? [];

  async function notifyPoll(pollId: string, question: string) {
    if (!adminEmail || !adminCode) {
      alert("Identifiants admin manquants pour notifier.");
      return;
    }
    if (!confirm(`Envoyer un email à tous les adhérents (payés + news activées) pour leur dire qu'un nouveau sondage est disponible ?\n\n"${question}"`)) return;
    setNotifyingPollId(pollId);
    const r = await adminNotifyNewPoll(adminEmail, adminCode, pollId);
    setNotifyingPollId(null);
    if (r.ok) alert(`✅ Email envoyé à ${r.sent} adhérent${(r.sent ?? 0) > 1 ? "s" : ""} !`);
    else alert("Erreur : " + (r.reason || "Inconnue"));
  }

  async function createPoll() {
    if (readOnly) return;
    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOpts.length < 2) {
      alert("Question + au moins 2 options requises.");
      return;
    }
    const newPoll: Poll = {
      id: Date.now().toString(),
      question: question.trim(),
      options: cleanOpts,
      votes: [],
      createdAt: new Date().toISOString(),
      multipleChoice,
      closed: false,
      saison: `${db.y1}-${db.y2}`,
    };
    await onPersist({ ...db, polls: [...polls, newPoll] });
    setQuestion("");
    setOptions(["", ""]);
    setMultipleChoice(false);
    setShowForm(false);
  }

  async function toggleClose(id: string) {
    if (readOnly) return;
    await onPersist({ ...db, polls: polls.map((p) => (p.id === id ? { ...p, closed: !p.closed } : p)) });
  }

  async function deletePoll(id: string) {
    if (readOnly) return;
    if (!confirm("Supprimer ce sondage et tous ses votes ?")) return;
    await onPersist({ ...db, polls: polls.filter((p) => p.id !== id) });
  }

  return (
    <div className="space-y-3">
      {!readOnly && (
        <>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-primary !text-sm w-full">
              <Plus className="w-4 h-4" /> Créer un sondage
            </button>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-slate-700">Nouveau sondage</p>
                <button onClick={() => { setShowForm(false); setQuestion(""); setOptions(["", ""]); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                className="input w-full"
                placeholder="Question (ex: Quelle date pour le repas de fin de saison ?)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={300}
              />
              <div>
                <p className="text-xs text-slate-500 mb-1.5">Options de réponse :</p>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input flex-1 !text-sm"
                        placeholder={`Option ${i + 1} (ex: 20 septembre)`}
                        value={opt}
                        onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                        maxLength={150}
                      />
                      {options.length > 2 && (
                        <button
                          onClick={() => setOptions(options.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600 px-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setOptions([...options, ""])}
                  className="text-xs text-purple-600 hover:text-purple-800 mt-2 font-medium"
                >
                  + Ajouter une option
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={multipleChoice} onChange={(e) => setMultipleChoice(e.target.checked)} className="w-4 h-4" />
                Choix multiples (les adhérents peuvent voter pour plusieurs options)
              </label>
              <button onClick={createPoll} className="btn-primary w-full !text-sm">
                <Send className="w-4 h-4" /> Publier le sondage
              </button>
            </div>
          )}
        </>
      )}

      <div className="space-y-2 mt-3">
        {polls.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">Aucun sondage pour cette saison.</p>
        )}
        {polls.slice().reverse().map((poll) => {
          const votes = poll.votes ?? [];
          const total = votes.length;
          return (
            <div key={poll.id} className={`bg-white rounded-xl border p-4 ${poll.closed ? "border-slate-200 opacity-75" : "border-purple-200"}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <h4 className="font-semibold text-slate-800 text-sm">{poll.question}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {total} vote{total > 1 ? "s" : ""} {poll.closed && "· FERMÉ"} {poll.multipleChoice && "· Multi-choix"}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => notifyPoll(poll.id, poll.question)}
                      disabled={notifyingPollId === poll.id || poll.closed === true}
                      className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={poll.closed ? "Sondage fermé — pas de notification" : "Notifier les adhérents par email"}
                    >
                      <Bell className={`w-4 h-4 ${notifyingPollId === poll.id ? "animate-pulse" : ""}`} />
                    </button>
                    <button
                      onClick={() => toggleClose(poll.id)}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                      title={poll.closed ? "Rouvrir" : "Fermer"}
                    >
                      {poll.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deletePoll(poll.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-700"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 mt-2">
                {poll.options.map((opt, i) => {
                  const count = votes.filter((v) => v.optionIdx === i).length;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={i} className="relative bg-slate-50 rounded-lg overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-purple-100" style={{ width: `${pct}%` }} />
                      <div className="relative flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="font-medium text-slate-700">{opt}</span>
                        <span className="text-slate-500">{count} · {pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Onglet Questions AG ───
function AGTab({ db, onPersist, readOnly }: { db: DB; onPersist: (db: DB) => Promise<void>; readOnly?: boolean }) {
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const items = db.agItems ?? [];

  function exportPdf() {
    const questions = items.filter((i) => i.type === "question");
    const ameliorations = items.filter((i) => i.type === "amelioration");
    const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const renderItem = (item: typeof items[number]) => `
      <div class="item ${item.resolved ? "resolved" : ""}">
        <div class="item-header">
          <span class="item-author">${item.anonymous ? "Anonyme" : escapeHtmlClient(item.authorNom || "?")}</span>
          <span class="item-date">${new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
          ${item.resolved ? '<span class="badge-traite">Traité</span>' : ""}
        </div>
        <p class="item-text">${escapeHtmlClient(item.text)}</p>
        ${item.reponse ? `
          <div class="item-reponse">
            <p class="item-reponse-label">Réponse du bureau ${item.reponseDate ? `(${new Date(item.reponseDate).toLocaleDateString("fr-FR")})` : ""}</p>
            <p>${escapeHtmlClient(item.reponse)}</p>
          </div>
        ` : ""}
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Questions et idées AG — Saison ${db.y1}–${db.y2}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1e293b; }
  .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 24px; }
  .header img { width: 70px; height: 70px; object-fit: contain; }
  h1 { color: #1e3a5f; font-size: 22px; margin: 0; }
  .subtitle { font-size: 12px; color: #64748b; margin: 4px 0 0; }
  h2 { color: #1e3a5f; font-size: 16px; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin: 28px 0 12px; }
  .empty { color: #94a3b8; font-style: italic; padding: 12px 0; }
  .item { background: #f8fafc; border-left: 3px solid #f59e0b; padding: 12px 16px; margin-bottom: 12px; border-radius: 4px; page-break-inside: avoid; }
  .item.resolved { border-left-color: #3b82f6; background: #eff6ff; }
  .item-header { display: flex; gap: 12px; align-items: center; font-size: 11px; color: #64748b; margin-bottom: 6px; }
  .item-author { font-weight: 600; color: #1e293b; }
  .badge-traite { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .item-text { font-size: 13px; line-height: 1.5; margin: 0; white-space: pre-wrap; }
  .item-reponse { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; background: white; padding: 8px 12px; border-radius: 4px; }
  .item-reponse-label { text-transform: uppercase; font-size: 10px; font-weight: 700; color: #1e3a5f; margin: 0 0 4px; letter-spacing: 0.05em; }
  .item-reponse p { font-size: 12px; line-height: 1.5; margin: 0; white-space: pre-wrap; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <div class="header">
    <img src="/logo.png" alt="Logo SACCB" />
    <div>
      <h1>Questions & idées des adhérents</h1>
      <p class="subtitle">Saison ${db.y1}–${db.y2} &nbsp;|&nbsp; Document généré le ${today}</p>
    </div>
  </div>

  <h2>Questions à l'assemblée (${questions.length})</h2>
  ${questions.length === 0 ? '<p class="empty">Aucune question soumise pour cette saison.</p>' : questions.slice().reverse().map(renderItem).join("")}

  <h2>Idées d'améliorations (${ameliorations.length})</h2>
  ${ameliorations.length === 0 ? `<p class="empty">Aucune idée d'amélioration soumise pour cette saison.</p>` : ameliorations.slice().reverse().map(renderItem).join("")}

  <div class="footer">
    SACCB — Sainte-Adresse Club de Compétition de Badminton<br>
    contact@saccb.fr · saccb.fr
  </div>

  <script>window.onload = () => window.print();</script>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      alert("Le navigateur a bloqué l'ouverture du PDF. Autorisez les popups pour ce site.");
    }
  }

  async function saveResponse(id: string) {
    if (readOnly) return;
    if (responseText.trim().length < 2) return;
    await onPersist({
      ...db,
      agItems: items.map((i) => i.id === id ? {
        ...i,
        reponse: responseText.trim(),
        reponseDate: new Date().toISOString(),
        resolved: true,
      } : i),
    });
    setRespondingTo(null);
    setResponseText("");
  }

  async function toggleResolved(id: string) {
    if (readOnly) return;
    await onPersist({
      ...db,
      agItems: items.map((i) => i.id === id ? { ...i, resolved: !i.resolved } : i),
    });
  }

  async function deleteItem(id: string) {
    if (readOnly) return;
    if (!confirm("Supprimer ce message ?")) return;
    await onPersist({ ...db, agItems: items.filter((i) => i.id !== id) });
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Aucune question ou idée pour le moment. Les adhérents peuvent en soumettre depuis la section « Sondages & AG » du site.
      </div>
    );
  }

  const questionsCount = items.filter((i) => i.type === "question").length;
  const ameliorationsCount = items.filter((i) => i.type === "amelioration").length;

  return (
    <div className="space-y-2">
      {/* Bouton export PDF */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3 pb-3 border-b border-slate-200">
        <p className="text-xs text-slate-500">
          <strong>{questionsCount}</strong> question{questionsCount > 1 ? "s" : ""} · <strong>{ameliorationsCount}</strong> idée{ameliorationsCount > 1 ? "s" : ""}
        </p>
        <button
          onClick={exportPdf}
          className="btn-ghost !text-xs !px-3 !py-1.5 flex items-center gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50"
          title="Télécharger un PDF de toutes les questions et idées"
        >
          <FileDown className="w-3.5 h-3.5" /> Exporter en PDF
        </button>
      </div>
      {items.slice().reverse().map((item) => {
        const isQ = item.type === "question";
        return (
          <div key={item.id} className={`border rounded-xl p-4 ${isQ ? "bg-amber-50/50 border-amber-200" : "bg-emerald-50/50 border-emerald-200"}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {isQ ? <MessageSquare className="w-4 h-4 text-amber-600" /> : <Lightbulb className="w-4 h-4 text-emerald-600" />}
                <span className={`text-[10px] uppercase tracking-widest font-bold ${isQ ? "text-amber-700" : "text-emerald-700"}`}>
                  {isQ ? "Question" : "Idée"}
                </span>
                <span className="text-xs text-slate-500">
                  {item.anonymous ? <><EyeOff className="w-3 h-3 inline" /> Anonyme</> : `de ${item.authorNom || "?"}`}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                {item.resolved && (
                  <span className="text-[10px] uppercase tracking-widest bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                    Traitée
                  </span>
                )}
              </div>
              {!readOnly && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggleResolved(item.id)} className="p-1 rounded hover:bg-white/60 text-slate-500" title={item.resolved ? "Marquer non traité" : "Marquer traité"}>
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="p-1 rounded hover:bg-red-50 text-red-500" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.text}</p>

            {item.reponse && respondingTo !== item.id && (
              <div className="mt-3 pt-3 border-t border-white/60 bg-white/40 -mx-4 -mb-4 px-4 pb-3 pt-3 rounded-b-xl">
                <p className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-1">Réponse du bureau</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.reponse}</p>
                {!readOnly && (
                  <button
                    onClick={() => { setRespondingTo(item.id); setResponseText(item.reponse || ""); }}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1.5 font-medium"
                  >
                    Modifier la réponse
                  </button>
                )}
              </div>
            )}

            {!readOnly && respondingTo === item.id && (
              <div className="mt-3 space-y-2">
                <textarea
                  className="input w-full min-h-[80px]"
                  placeholder="Réponse du bureau…"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => saveResponse(item.id)} className="btn-primary !text-xs flex-1">
                    <Send className="w-3.5 h-3.5" /> Enregistrer
                  </button>
                  <button onClick={() => { setRespondingTo(null); setResponseText(""); }} className="text-xs text-slate-500 px-3">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {!readOnly && !item.reponse && respondingTo !== item.id && (
              <button
                onClick={() => { setRespondingTo(item.id); setResponseText(""); }}
                className="text-xs text-blue-600 hover:text-blue-800 mt-2 font-medium"
              >
                + Répondre
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Onglet Comptes-rendus ───
function ReportsTab({
  db,
  onPersist,
  adminEmail,
  adminCode,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    title: string;
    type: ReunionReport["type"];
    date: string;
    content: string;
    pdfUrl?: string;
    pdfPath?: string;
    pdfName?: string;
  }>({
    title: "", type: "ag", date: new Date().toISOString().slice(0, 10), content: "",
  });
  const [uploading, setUploading] = useState(false);
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const reports = db.reunionReports ?? [];

  async function emailReport(r: ReunionReport) {
    if (readOnly) return;
    if (!adminEmail || !adminCode) {
      alert("Identifiants admin manquants.");
      return;
    }
    if (!confirm(
      `Envoyer ce compte-rendu par email à tous les adhérents (payés + news activées) ?\n\n` +
      `📋 ${r.title}\n` +
      `📅 ${new Date(r.date).toLocaleDateString("fr-FR")}\n` +
      (r.pdfUrl ? `📎 Avec PDF joint\n` : `(pas de PDF, le contenu texte sera dans l'email)\n`)
    )) return;
    setSendingReportId(r.id);
    const res = await adminSendReport(r.id, adminEmail, adminCode);
    setSendingReportId(null);
    if (res.ok) alert(`✅ Compte-rendu envoyé à ${res.sent} adhérent${(res.sent ?? 0) > 1 ? "s" : ""} !`);
    else alert("Erreur : " + (res.reason || "Inconnue"));
  }

  // 🗑️ Supprimer un compte-rendu spécifique d'une archive
  async function deleteArchivedReport(archiveIdx: number, reportId: string) {
    if (readOnly) return;
    const archive = (db.archives ?? [])[archiveIdx];
    const report = (archive?.reunionReports ?? []).find((r) => r.id === reportId);
    if (!report) return;
    if (!confirm(
      `Supprimer définitivement ce compte-rendu archivé ?\n\n` +
      `📋 ${report.title}\n` +
      `📅 ${new Date(report.date).toLocaleDateString("fr-FR")}\n` +
      `📦 Archive saison ${archive.y1}–${archive.y2}\n\n` +
      `Action irréversible.`
    )) return;
    const newArchives = (db.archives ?? []).map((a, i) =>
      i === archiveIdx
        ? { ...a, reunionReports: (a.reunionReports ?? []).filter((r) => r.id !== reportId) }
        : a
    );
    await onPersist({ ...db, archives: newArchives });
  }

  function startNew() {
    setEditingId(null);
    setForm({ title: "", type: "ag", date: new Date().toISOString().slice(0, 10), content: "" });
    setShowForm(true);
  }

  function startEdit(r: ReunionReport) {
    setEditingId(r.id);
    setForm({
      title: r.title,
      type: r.type,
      date: r.date,
      content: r.content,
      pdfUrl: r.pdfUrl,
      pdfPath: r.pdfPath,
      pdfName: r.pdfName,
    });
    setShowForm(true);
  }

  async function uploadPdf(file: File) {
    if (file.type !== "application/pdf") {
      alert("Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (file.size > 20_000_000) {
      alert("Le fichier dépasse 20 Mo.");
      return;
    }
    setUploading(true);
    try {
      // Admin via espace membre (pas de JWT) → via Edge Function
      if (adminEmail && adminCode) {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const res = await fetch(EDGE_FUNCTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
          body: JSON.stringify({
            action: "upload_image",
            email: adminEmail,
            code: adminCode,
            fileData: base64,
            fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
            contentType: "application/pdf",
            bucket: REPORTS_BUCKET, // bucket dédié aux comptes-rendus (public)
            pathPrefix: "",
          }),
        });
        const result = await res.json();
        if (!result.ok) {
          alert("Erreur upload PDF : " + (result.reason || "Erreur inconnue"));
          return;
        }
        setForm((f) => ({ ...f, pdfUrl: result.url, pdfPath: result.path, pdfName: file.name }));
      } else {
        // Admin Supabase Auth direct
        const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabaseClient.storage
          .from(REPORTS_BUCKET)
          .upload(path, file, { upsert: false, contentType: "application/pdf" });
        if (error) {
          alert("Erreur upload PDF : " + error.message);
          return;
        }
        const { data } = supabaseClient.storage.from(REPORTS_BUCKET).getPublicUrl(path);
        setForm((f) => ({ ...f, pdfUrl: data.publicUrl, pdfPath: path, pdfName: file.name }));
      }
    } finally {
      setUploading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  async function removePdf() {
    if (!form.pdfPath) {
      setForm((f) => ({ ...f, pdfUrl: undefined, pdfPath: undefined, pdfName: undefined }));
      return;
    }
    // Supprimer du storage si admin Supabase Auth (RLS), sinon on laisse le fichier orphelin
    if (!adminEmail || !adminCode) {
      await supabaseClient.storage.from(REPORTS_BUCKET).remove([form.pdfPath]).catch(() => {});
    }
    setForm((f) => ({ ...f, pdfUrl: undefined, pdfPath: undefined, pdfName: undefined }));
  }

  async function save() {
    if (readOnly) return;
    // 🔧 Seul le titre est obligatoire. Le contenu texte est facultatif si un PDF
    // est joint (ou même sans PDF, l'admin peut juste vouloir un document avec
    // un titre comme placeholder).
    if (!form.title.trim()) {
      alert("Le titre est obligatoire.");
      return;
    }
    if (editingId) {
      await onPersist({
        ...db,
        reunionReports: reports.map((r) => r.id === editingId ? { ...r, ...form } : r),
      });
    } else {
      const newReport: ReunionReport = {
        id: Date.now().toString(),
        ...form,
        saison: `${db.y1}-${db.y2}`,
        createdAt: new Date().toISOString(),
      };
      await onPersist({ ...db, reunionReports: [...reports, newReport] });
    }
    setShowForm(false);
    setEditingId(null);
  }

  async function deleteReport(id: string) {
    if (readOnly) return;
    if (!confirm("Supprimer ce compte-rendu ?")) return;
    const report = reports.find((r) => r.id === id);
    // Supprimer le PDF du storage si présent (mode admin Supabase direct)
    if (report?.pdfPath && (!adminEmail || !adminCode)) {
      await supabaseClient.storage.from(REPORTS_BUCKET).remove([report.pdfPath]).catch(() => {});
    }
    await onPersist({ ...db, reunionReports: reports.filter((r) => r.id !== id) });
  }

  // 👁️ Toggle visible/masqué pour un document précis
  async function toggleVisibility(id: string) {
    if (readOnly) return;
    const updated = reports.map((r) => {
      if (r.id !== id) return r;
      const current = r.visible !== false; // default true
      return { ...r, visible: !current };
    });
    await onPersist({ ...db, reunionReports: updated });
  }

  // 📎 Toggle "joindre au mail de bienvenue" pour un document
  async function toggleAttachWelcome(id: string) {
    if (readOnly) return;
    const updated = reports.map((r) => {
      if (r.id !== id) return r;
      return { ...r, attachToWelcome: !r.attachToWelcome };
    });
    await onPersist({ ...db, reunionReports: updated });
  }

  return (
    <div className="space-y-3">
      {!readOnly && !showForm && (
        <button onClick={startNew} className="btn-primary !text-sm w-full">
          <Plus className="w-4 h-4" /> Nouveau document
        </button>
      )}

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              {editingId ? "Modifier le document" : "Nouveau document"}
            </p>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            className="input w-full"
            placeholder="Titre (ex: AG 2026 — bilan saison)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={150}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="input w-full"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ReunionReport["type"] })}
            >
              <optgroup label="Comptes-rendus de réunions">
                <option value="ag">Assemblée Générale</option>
                <option value="debut_saison">Début de saison</option>
                <option value="fin_saison">Fin de saison</option>
              </optgroup>
              <optgroup label="Documents officiels (publiés après AG)">
                <option value="rapport_financier">Rapport financier</option>
                <option value="rapport_moral">Rapport moral</option>
                <option value="charte">Charte de l&apos;association</option>
              </optgroup>
              <option value="autre">Autre document</option>
            </select>
            <input
              type="date"
              className="input w-full"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <textarea
            className="input w-full min-h-[200px] resize-y"
            placeholder="Contenu / résumé du document (optionnel — texte libre, retours à la ligne préservés)…"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />

          {/* Upload PDF (optionnel) */}
          <div className="border border-slate-200 rounded-xl p-3 bg-white">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
              Fichier PDF (optionnel — 20 Mo max)
            </p>
            {form.pdfUrl ? (
              <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <a
                  href={form.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 min-w-0 truncate"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{form.pdfName || "Voir le PDF"}</span>
                </a>
                <button
                  type="button"
                  onClick={removePdf}
                  className="text-red-500 hover:text-red-700 p-1 rounded shrink-0"
                  title="Retirer le PDF"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-400 rounded-lg py-3 transition disabled:opacity-50"
              >
                {uploading ? (
                  <>Envoi en cours...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Ajouter un PDF (compte-rendu signé, etc.)
                  </>
                )}
              </button>
            )}
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPdf(f);
              }}
            />
          </div>

          <button onClick={save} disabled={uploading} className="btn-primary !text-sm w-full">
            <Send className="w-4 h-4" /> {editingId ? "Mettre à jour" : "Publier"}
          </button>
        </div>
      )}

      <div className="space-y-2 mt-2">
        {reports.length === 0 && !showForm && (
          <p className="text-sm text-slate-400 text-center py-4">
            Aucun compte-rendu pour cette saison.
          </p>
        )}
        {reports.slice().reverse().map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between gap-2 p-3">
              <button
                onClick={() => setOpenReport(openReport === r.id ? null : r.id)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{r.title}</p>
                  <p className="text-xs text-slate-400">
                    {labelType(r.type)} · {new Date(r.date).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                {openReport === r.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {!readOnly && (
                <div className="flex gap-1 shrink-0 items-center">
                  {/* 👁️ Toggle visible / masqué côté adhérent */}
                  <button
                    onClick={() => toggleVisibility(r.id)}
                    className={`p-1.5 rounded transition ${
                      r.visible === false
                        ? "text-slate-400 hover:bg-slate-100"
                        : "text-emerald-600 hover:bg-emerald-50"
                    }`}
                    title={r.visible === false ? "Masqué pour les adhérents — clic pour afficher" : "Visible pour les adhérents — clic pour masquer"}
                  >
                    {r.visible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {/* 📎 Toggle "joindre au mail de bienvenue / confirmation de paiement" */}
                  {r.pdfUrl && (
                    <button
                      onClick={() => toggleAttachWelcome(r.id)}
                      className={`p-1.5 rounded transition ${
                        r.attachToWelcome
                          ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                          : "text-slate-400 hover:bg-slate-100"
                      }`}
                      title={
                        r.attachToWelcome
                          ? "PDF joint aux mails de paiement/bienvenue — clic pour ne plus le joindre"
                          : "Cliquer pour joindre ce PDF aux mails de confirmation de paiement / bienvenue"
                      }
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => emailReport(r)}
                    disabled={sendingReportId === r.id}
                    className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-50"
                    title="Envoyer ce document par email à tous les adhérents"
                  >
                    {sendingReportId === r.id ? <span className="text-xs">…</span> : <Mail className="w-4 h-4" />}
                  </button>
                  <button onClick={() => startEdit(r)} className="text-xs text-blue-600 hover:text-blue-800 px-2 font-medium">
                    Modifier
                  </button>
                  <button onClick={() => deleteReport(r.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {openReport === r.id && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                {r.pdfUrl && (
                  <a
                    href={r.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-3 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-sm font-medium transition"
                  >
                    <FileDown className="w-4 h-4" />
                    {r.pdfName || "Télécharger le PDF"}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 📦 Archives — comptes-rendus des saisons précédentes */}
      {(() => {
        const archivesWithReports = (db.archives ?? [])
          .map((a, i) => ({ archive: a, idx: i }))
          .filter(({ archive }) => (archive.reunionReports ?? []).length > 0)
          .reverse(); // plus récent en premier
        if (archivesWithReports.length === 0) return null;
        return (
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3 flex items-center gap-2">
              📦 Archives des saisons précédentes
            </p>
            <div className="space-y-3">
              {archivesWithReports.map(({ archive, idx }) => (
                <ArchivedReportsBlock
                  key={`${archive.y1}-${archive.y2}-${idx}`}
                  archive={archive}
                  archiveIdx={idx}
                  readOnly={readOnly}
                  onDelete={deleteArchivedReport}
                />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Bloc d'archives dépliable affichant les compte-rendus d'une saison passée
function ArchivedReportsBlock({
  archive,
  archiveIdx,
  readOnly,
  onDelete,
}: {
  archive: import("@/lib/types").SeasonArchive;
  archiveIdx: number;
  readOnly?: boolean;
  onDelete: (archiveIdx: number, reportId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [openReport, setOpenReport] = useState<string | null>(null);
  const reports = archive.reunionReports ?? [];
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-slate-100 transition text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">Saison {archive.y1}–{archive.y2}</p>
          <p className="text-xs text-slate-400">
            {reports.length} compte-rendu{reports.length > 1 ? "s" : ""}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="divide-y divide-slate-200">
          {reports.slice().reverse().map((r) => (
            <div key={r.id} className="bg-white">
              <div className="flex items-center justify-between gap-2 p-3">
                <button
                  onClick={() => setOpenReport(openReport === r.id ? null : r.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{r.title}</p>
                    <p className="text-xs text-slate-400">
                      {labelType(r.type)} · {new Date(r.date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  {openReport === r.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {!readOnly && (
                  <button
                    onClick={() => onDelete(archiveIdx, r.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500 shrink-0"
                    title="Supprimer ce compte-rendu archivé"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {openReport === r.id && (
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                  {r.pdfUrl && (
                    <a
                      href={r.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-sm font-medium transition"
                    >
                      <FileDown className="w-4 h-4" />
                      {r.pdfName || "Télécharger le PDF"}
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function labelType(t: ReunionReport["type"]): string {
  switch (t) {
    case "ag": return "Assemblée Générale";
    case "debut_saison": return "Début de saison";
    case "fin_saison": return "Fin de saison";
    case "rapport_financier": return "Rapport financier";
    case "charte": return "Charte de l'association";
    case "rapport_moral": return "Rapport moral";
    default: return "Autre document";
  }
}
