"use client";

import { useMemo, useState } from "react";
import { Inbox, CheckCircle2, Circle, Mail, Trash2, Archive, ArchiveRestore, ChevronDown, ChevronUp, User } from "lucide-react";
import { DB, ContactMessage } from "@/lib/types";
import { adminMarkMessageResponded, adminArchiveMessage } from "@/lib/db";

export default function MessagesAdmin({
  db,
  onRefresh,
  adminEmail,
  adminCode,
  readOnly,
}: {
  db: DB;
  onRefresh: () => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
}) {
  const allMessages = (db.contactMessages ?? []) as ContactMessage[];
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 🔍 Helper : résoudre une adresse email vers un prénom (lookup dans les membres + admins)
  function resolveName(email?: string): string {
    if (!email) return "";
    const lower = email.toLowerCase();
    // 1) Adhérent avec cet email
    const membre = (db.membres ?? []).find((m) => (m.email || "").toLowerCase() === lower);
    if (membre?.nom) {
      // On prend juste le prénom (1er mot du nom complet) pour l'affichage compact
      return membre.nom.trim().split(/\s+/)[0];
    }
    // 2) Admin credential (identifié par email seulement, pas de nom)
    // → on affiche la partie locale de l'email (avant @) avec une capitale
    const localPart = lower.split("@")[0];
    if (localPart) {
      const cleaned = localPart.replace(/[._-]+/g, " ").trim();
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return email;
  }

  const { unrespondedCount, respondedCount, archivedCount, visible } = useMemo(() => {
    const visibleMessages = allMessages.filter((m) => showArchived || !m.archived);
    // Trier : non-répondus en premier, puis par date desc
    visibleMessages.sort((a, b) => {
      if (!!a.respondedBy !== !!b.respondedBy) return a.respondedBy ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return {
      unrespondedCount: allMessages.filter((m) => !m.archived && !m.respondedBy).length,
      respondedCount: allMessages.filter((m) => !m.archived && m.respondedBy).length,
      archivedCount: allMessages.filter((m) => m.archived).length,
      visible: visibleMessages,
    };
  }, [allMessages, showArchived]);

  async function toggleResponded(m: ContactMessage) {
    if (readOnly || !adminEmail || !adminCode) return;
    setBusyId(m.id);
    const r = await adminMarkMessageResponded(m.id, adminEmail, adminCode, !!m.respondedBy);
    setBusyId(null);
    if (!r.ok) {
      alert("Erreur : " + (r.reason || "inconnue"));
      return;
    }
    await onRefresh();
  }

  async function archiveMsg(m: ContactMessage) {
    if (readOnly || !adminEmail || !adminCode) return;
    setBusyId(m.id);
    const r = await adminArchiveMessage(m.id, adminEmail, adminCode, { archived: !m.archived });
    setBusyId(null);
    if (!r.ok) { alert("Erreur : " + (r.reason || "inconnue")); return; }
    await onRefresh();
  }

  async function deleteMsg(m: ContactMessage) {
    if (readOnly || !adminEmail || !adminCode) return;
    if (!confirm(`Supprimer définitivement le message de ${m.name} ?\n\nAction irréversible.`)) return;
    setBusyId(m.id);
    const r = await adminArchiveMessage(m.id, adminEmail, adminCode, { delete: true });
    setBusyId(null);
    if (!r.ok) { alert("Erreur : " + (r.reason || "inconnue")); return; }
    await onRefresh();
  }

  function replyMailto(m: ContactMessage) {
    // 📩 Pré-remplit le formulaire d'envoi d'email (section "Envoi d'emails")
    // avec destinataire + sujet + le message original cité, puis y défile.
    try {
      sessionStorage.setItem("saccb_pending_reply", JSON.stringify({
        email: m.email,
        name: m.name,
        subject: `Re: votre message au SACCB`,
        quote: `Votre message du ${new Date(m.createdAt).toLocaleDateString("fr-FR")} :\n${m.message}`,
        messageId: m.id,
      }));
    } catch {}
    // Défile vers la section emailing (ancre #admin-emailing existante dans AdminPanel)
    setTimeout(() => {
      const target = document.getElementById("admin-emailing");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display text-xl md:text-2xl tracking-wider text-slate-800">Boîte de réception</h3>
            <p className="text-xs text-slate-400">
              Messages reçus via le formulaire de contact public
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {unrespondedCount > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              {unrespondedCount} à traiter
            </span>
          )}
          {respondedCount > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              {respondedCount} traité{respondedCount > 1 ? "s" : ""}
            </span>
          )}
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                showArchived ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
              title="Afficher / masquer les messages archivés"
            >
              {showArchived ? "✓" : ""} {archivedCount} archivé{archivedCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* 💡 Notice explicative : les réponses email n'arrivent PAS ici */}
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <span className="text-base">💡</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-blue-900 font-semibold">À savoir sur les réponses email</p>
          <p className="text-xs text-blue-800 leading-relaxed mt-1">
            Les <strong>réponses aux mails</strong> que vous envoyez depuis l&apos;admin
            (rappels, infos, mails de masse…) <strong>n&apos;arrivent PAS ici</strong>.
            Elles arrivent dans la boîte mail <a
              href="mailto:saccb76310@gmail.com"
              className="font-mono font-bold underline hover:no-underline"
            >saccb76310@gmail.com</a>.
            <br />
            Ici vous voyez <strong>uniquement</strong> les messages envoyés via le
            formulaire contact du site (<a
              href="/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >saccb.fr/contact</a>).
          </p>
        </div>
      </div>

      {visible.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="text-sm">
            {allMessages.length === 0
              ? "Aucun message reçu pour le moment."
              : showArchived
              ? "Aucun message à afficher."
              : "Aucun message en cours — tout est traité 🎉"}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((m) => {
          const isOpen = openId === m.id;
          const isResponded = !!m.respondedBy;
          const isMine = adminEmail && m.respondedBy === adminEmail.toLowerCase();
          return (
            <div
              key={m.id}
              className={`rounded-xl border overflow-hidden transition ${
                m.archived
                  ? "bg-slate-50 border-slate-200 opacity-70"
                  : isResponded
                  ? "bg-emerald-50/50 border-emerald-200"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-2 p-3">
                {/* Statut */}
                <button
                  onClick={() => toggleResponded(m)}
                  disabled={readOnly || busyId === m.id}
                  className="shrink-0 mt-0.5"
                  title={isResponded ? `Répondu par ${m.respondedBy}` : "Marquer comme répondu"}
                >
                  {isResponded
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500 hover:scale-110 transition" />
                    : <Circle className="w-5 h-5 text-slate-300 hover:text-emerald-400 hover:scale-110 transition" />}
                </button>

                {/* Contenu principal cliquable */}
                <button
                  onClick={() => setOpenId(isOpen ? null : m.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{m.name}</p>
                      {m.source === "email_reply" && (
                        <span
                          className="text-[9px] uppercase tracking-widest text-violet-700 bg-violet-100 border border-violet-200 px-1.5 py-0.5 rounded-full font-bold shrink-0"
                          title="Réponse par email à un mail envoyé par l'admin"
                        >
                          ✉ Réponse
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">
                      {new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{m.email}</p>
                  {m.subject && (
                    <p className="text-xs text-slate-600 italic truncate mt-0.5">
                      🏷️ {m.subject}
                    </p>
                  )}
                  {!isOpen && (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{m.message}</p>
                  )}
                  {isResponded && (
                    <p
                      className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1"
                      title={`Email enregistré : ${m.respondedBy}`}
                    >
                      <User className="w-3 h-3" />
                      Répondu par <strong>{isMine ? "vous" : resolveName(m.respondedBy)}</strong>
                      {m.respondedAt && ` le ${new Date(m.respondedAt).toLocaleDateString("fr-FR")}`}
                    </p>
                  )}
                </button>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  {!readOnly && (
                    <button
                      onClick={() => replyMailto(m)}
                      className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                      title="Répondre par email"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => archiveMsg(m)}
                      disabled={busyId === m.id}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                      title={m.archived ? "Désarchiver" : "Archiver"}
                    >
                      {m.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => deleteMsg(m)}
                      disabled={busyId === m.id}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setOpenId(isOpen ? null : m.id)}
                    className="p-1.5 text-slate-400"
                  >
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-slate-50">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 mt-4 italic">
        💡 Cliquez sur le rond à gauche d&apos;un message pour le marquer comme répondu — tous les autres admins verront que vous l&apos;avez traité.
      </p>
    </div>
  );
}
