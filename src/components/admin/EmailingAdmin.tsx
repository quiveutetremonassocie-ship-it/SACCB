"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Send, Paperclip, X, Users, CheckCircle2, Clock, Bell, UserCheck, Search, History, Trash2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { DB } from "@/lib/types";
import { adminSendEmail, adminDeleteEmailLog, adminClearEmailHistory } from "@/lib/db";

type TargetMode = "" | "all" | "paid" | "unpaid" | "news" | "custom";

type Attachment = {
  filename: string;
  content: string; // base64
  contentType: string;
  size: number;
};

const MAX_ATTACHMENT_TOTAL = 25 * 1024 * 1024; // 25 Mo total

export default function EmailingAdmin({
  db,
  adminEmail,
  adminCode,
  onRefresh,
  readOnly,
}: {
  db: DB;
  adminEmail?: string;
  adminCode?: string;
  onRefresh?: () => Promise<void>;
  readOnly?: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // 🎨 Type d'email (visuel + sujet préfixé)
  const [variant, setVariant] = useState<"urgent" | "annonce" | "bonne_nouvelle" | "info" | "default">("default");
  // Volontairement vide au démarrage : on force l'admin à cliquer explicitement
  // sur un mode pour éviter d'envoyer à "tous les payés" par inadvertance.
  const [targetMode, setTargetMode] = useState<TargetMode>("");
  const [selectedMembreIds, setSelectedMembreIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [extraEmails, setExtraEmails] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [historyManualOpen, setHistoryManualOpen] = useState(false);
  const [historyAutoOpen, setHistoryAutoOpen] = useState(false);
  const [openLogId, setOpenLogId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 📩 Réponse à un message reçu : on récupère le contexte depuis sessionStorage
  // (déposé par MessagesAdmin quand on clique sur l'enveloppe "Répondre")
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("saccb_pending_reply");
      if (!raw) return;
      sessionStorage.removeItem("saccb_pending_reply");
      const reply = JSON.parse(raw) as { email: string; name: string; subject: string; quote: string };
      setSubject(reply.subject || "");
      setBody(`Bonjour ${reply.name},\n\n\n\n--- Votre message ---\n${reply.quote}`);
      setTargetMode("custom"); // mode "sélection manuelle" requis pour utiliser extraEmails seul
      setExtraEmails(reply.email);
      // Défile vers le formulaire après un court délai (le temps que tout se rende)
      setTimeout(() => {
        document.getElementById("emailing-form-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch {}
  }, []);

  const history = (db.emailHistory || []).slice().reverse(); // plus récent en premier
  // Sépare manuels (admin) vs automatiques (système). Logs sans 'type' = legacy admin envoyés via la zone manuelle.
  const isManualLog = (l: typeof history[number]) => !l.type || l.type === "manual";
  const manualHistory = history.filter(isManualLog);
  const autoHistory = history.filter((l) => !isManualLog(l));

  // 🔍 Helper : résoudre une adresse email vers UN PRÉNOM uniquement
  // (1er mot du nom complet de l'adhérent, sinon partie locale de l'email)
  function resolveName(email?: string): string {
    if (!email) return "—";
    if (email === "system") return "Automatique (système)";
    const lower = email.toLowerCase();
    const membre = (db.membres ?? []).find((m) => (m.email || "").toLowerCase() === lower);
    if (membre?.nom) {
      // On prend uniquement le PRÉNOM (1er mot du nom complet)
      return membre.nom.trim().split(/\s+/)[0];
    }
    const localPart = lower.split("@")[0];
    if (localPart) {
      // 1er mot avant un . ou _ pour rester compact
      const firstToken = localPart.split(/[._-]/)[0];
      return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
    }
    return email;
  }

  async function deleteLog(logId: string) {
    if (!adminEmail || !adminCode) return;
    if (!confirm("Supprimer cette entrée de l'historique ?\n\n(L'email envoyé reste dans la boîte des destinataires, on supprime juste la trace ici.)")) return;
    const r = await adminDeleteEmailLog(adminEmail, adminCode, logId);
    if (r.ok && onRefresh) await onRefresh();
    else if (!r.ok) alert("Erreur : " + (r.reason || "Inconnue"));
  }

  async function clearHistory() {
    if (!adminEmail || !adminCode) return;
    if (!confirm(`Vider TOUT l'historique (${history.length} entrées) ?\n\nCette action est irréversible.`)) return;
    const r = await adminClearEmailHistory(adminEmail, adminCode);
    if (r.ok && onRefresh) await onRefresh();
    else if (!r.ok) alert("Erreur : " + (r.reason || "Inconnue"));
  }

  function reuseLog(log: typeof history[number]) {
    setSubject(log.subject);
    setBody(log.body || "");
    setHistoryManualOpen(false);
    setHistoryAutoOpen(false);
    // Scroll vers le haut du formulaire
    setTimeout(() => {
      document.getElementById("emailing-form-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  const membres = db.membres || [];

  // Parse les emails externes saisis (séparés par virgule, point-virgule ou saut de ligne)
  const parsedExtraEmails = useMemo(() => {
    return extraEmails
      .split(/[,;\n\r\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  }, [extraEmails]);

  // Calcul des destinataires selon le mode
  const recipientCount = useMemo(() => {
    let baseCount = 0;
    if (targetMode === "all") baseCount = membres.length;
    else if (targetMode === "paid") baseCount = membres.filter((m) => m.ok === true).length;
    else if (targetMode === "unpaid") baseCount = membres.filter((m) => m.ok !== true).length;
    else if (targetMode === "news") baseCount = membres.filter((m) => m.ok === true && m.newsOptIn !== false).length;
    else if (targetMode === "custom") baseCount = selectedMembreIds.size;
    // Ajouter les emails externes uniques (non déjà présents dans la base)
    return baseCount + parsedExtraEmails.length;
  }, [targetMode, membres, selectedMembreIds, parsedExtraEmails]);

  // Liste filtrée pour la sélection custom
  const filteredMembres = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return membres;
    return membres.filter((m) => m.nom.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q));
  }, [membres, search]);

  function toggleMembre(id: string) {
    setSelectedMembreIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedMembreIds((prev) => {
      const next = new Set(prev);
      filteredMembres.forEach((m) => next.add(m.id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedMembreIds(new Set());
  }

  async function fileToBase64(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }

  async function handleAddFiles(files: FileList | null) {
    if (!files) return;
    const currentTotal = attachments.reduce((s, a) => s + a.size, 0);
    let newTotal = currentTotal;
    const added: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (newTotal + file.size > MAX_ATTACHMENT_TOTAL) {
        alert(`Limite totale 25 Mo atteinte. "${file.name}" non ajouté.`);
        break;
      }
      const content = await fileToBase64(file);
      added.push({
        filename: file.name,
        content,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      newTotal += file.size;
    }
    setAttachments((prev) => [...prev, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  async function handleSend() {
    if (readOnly) return;
    if (!subject.trim() || subject.trim().length < 3) {
      setResult({ ok: false, text: "Le sujet doit faire au moins 3 caractères." });
      return;
    }
    if (!body.trim() || body.trim().length < 5) {
      setResult({ ok: false, text: "Le corps de l'email doit faire au moins 5 caractères." });
      return;
    }
    if (!targetMode) {
      setResult({ ok: false, text: "⚠️ Veuillez sélectionner à qui vous voulez envoyer le mail (Tous, Payés, Non-payés, News, ou Sélection)." });
      return;
    }
    if (recipientCount === 0) {
      setResult({ ok: false, text: "Aucun destinataire sélectionné." });
      return;
    }
    if (!adminEmail || !adminCode) {
      setResult({ ok: false, text: "Identifiants admin manquants. Reconnectez-vous." });
      return;
    }
    // Labels lisibles pour la confirmation
    const targetLabels: Record<string, string> = {
      all: "TOUS les adhérents (payés et non-payés)",
      paid: "tous les adhérents PAYÉS",
      unpaid: "tous les adhérents NON-PAYÉS",
      news: "tous les adhérents PAYÉS abonnés aux news",
      custom: "votre sélection manuelle",
    };
    const targetDesc = targetLabels[targetMode] || targetMode;
    if (!confirm(
      `⚠️ CONFIRMATION D'ENVOI\n\n` +
      `Destinataires : ${recipientCount} personne${recipientCount > 1 ? "s" : ""}\n` +
      `(${targetDesc})\n\n` +
      `Sujet : ${subject}\n\n` +
      `Confirmer l'envoi ?`
    )) return;

    setSending(true);
    setResult(null);

    // Construire la liste custom (sélection manuelle d'adhérents) — uniquement en mode custom
    let customEmails: string[] = [];
    if (targetMode === "custom") {
      customEmails = Array.from(selectedMembreIds)
        .map((id) => membres.find((m) => m.id === id)?.email || "")
        .filter(Boolean);
    }

    const r = await adminSendEmail({
      adminEmail,
      adminCode,
      subject: subject.trim(),
      htmlBody: body.trim(),
      targetMode,
      customEmails,
      extraEmails: parsedExtraEmails, // emails externes (ajoutés en plus dans tous les modes)
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
      variant,
    });
    setSending(false);

    if (r.ok) {
      setResult({
        ok: true,
        text: `✅ Email envoyé à ${r.sent} destinataire${(r.sent ?? 0) > 1 ? "s" : ""}${r.total && r.total !== r.sent ? ` (sur ${r.total} prévus)` : ""}!`,
      });
      // Reset le formulaire
      setSubject("");
      setBody("");
      setAttachments([]);
      setSelectedMembreIds(new Set());
      setExtraEmails("");
      // Rafraîchir l'historique
      if (onRefresh) await onRefresh();
    } else {
      setResult({ ok: false, text: "❌ " + (r.reason || "Erreur lors de l'envoi.") });
    }
  }

  const totalAttachmentSize = attachments.reduce((s, a) => s + a.size, 0);

  return (
    <div className="glass p-4 md:p-6" id="emailing-form-top">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-display text-2xl tracking-wider text-slate-800">Envoyer un email</h3>
          <p className="text-xs text-slate-400">
            Envoie un email aux adhérents avec pièces jointes optionnelles. Expéditeur : <code className="bg-slate-100 px-1 rounded text-[10px]">contact@saccb.fr</code>
          </p>
        </div>
      </div>

      {/* Modèles d'emails pré-écrits */}
      {!readOnly && (
        <div className="mb-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-2 font-semibold">Modeles rapides</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <TemplateButton
              emoji="💳"
              label="Rappel paiement"
              onClick={() => {
                setSubject("Rappel — Adhesion SACCB a renouveler");
                setBody("Bonjour,\n\nNous vous rappelons que votre adhesion pour la saison en cours n'a pas encore ete reglee.\n\nPour finaliser votre inscription, rendez-vous sur votre espace membre : https://saccb.fr/?member=1\n\nVous pouvez payer en ligne via HelloAsso ou par virement en contactant Hernan.\n\nN'hesitez pas a nous contacter si vous avez des questions.\n\nSportivement,\nLe bureau du SACCB");
                setVariant("urgent");
                setTargetMode("unpaid");
              }}
            />
            <TemplateButton
              emoji="🏸"
              label="Info tournoi"
              onClick={() => {
                setSubject("Prochain tournoi SACCB");
                setBody("Bonjour a tous,\n\nNous vous informons qu'un tournoi approche !\n\n📅 Date : [A COMPLETER]\n📍 Lieu : [A COMPLETER]\n⏰ Date limite d'inscription : [A COMPLETER]\n\nPour vous inscrire, rendez-vous dans la section Tournois de votre espace membre : https://saccb.fr/tournois\n\nN'oubliez pas de trouver votre binome !\n\nSportivement,\nLe bureau du SACCB");
                setVariant("annonce");
                setTargetMode("paid");
              }}
            />
            <TemplateButton
              emoji="📋"
              label="Info generale"
              onClick={() => {
                setSubject("Information SACCB");
                setBody("Bonjour a tous,\n\n[VOTRE MESSAGE ICI]\n\nN'hesitez pas a nous contacter pour toute question.\n\nSportivement,\nLe bureau du SACCB");
                setVariant("info");
                setTargetMode("news");
              }}
            />
            <TemplateButton
              emoji="🎉"
              label="Bonne nouvelle"
              onClick={() => {
                setSubject("Bonne nouvelle au SACCB !");
                setBody("Bonjour a tous,\n\nNous avons le plaisir de vous annoncer :\n\n[VOTRE BONNE NOUVELLE ICI]\n\nMerci a tous pour votre engagement et votre bonne humeur !\n\nSportivement,\nLe bureau du SACCB");
                setVariant("bonne_nouvelle");
                setTargetMode("paid");
              }}
            />
          </div>
        </div>
      )}

      {/* Sélection des destinataires */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-2 font-semibold">
          Destinataires <span className="text-red-500 normal-case font-bold">*</span>
          {!targetMode && (
            <span className="ml-2 text-amber-600 font-bold normal-case tracking-normal text-xs">
              ⚠️ Choisis un groupe avant d&apos;envoyer
            </span>
          )}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          <TargetButton active={targetMode === "all"} onClick={() => setTargetMode("all")} icon={<Users className="w-4 h-4" />} label="Tous" count={membres.length} />
          <TargetButton active={targetMode === "paid"} onClick={() => setTargetMode("paid")} icon={<CheckCircle2 className="w-4 h-4" />} label="Payés" count={membres.filter((m) => m.ok === true).length} color="emerald" />
          <TargetButton active={targetMode === "unpaid"} onClick={() => setTargetMode("unpaid")} icon={<Clock className="w-4 h-4" />} label="Non-payés" count={membres.filter((m) => m.ok !== true).length} color="amber" />
          <TargetButton active={targetMode === "news"} onClick={() => setTargetMode("news")} icon={<Bell className="w-4 h-4" />} label="Newsletter" count={membres.filter((m) => m.ok === true && m.newsOptIn !== false).length} color="purple" />
          <TargetButton active={targetMode === "custom"} onClick={() => setTargetMode("custom")} icon={<UserCheck className="w-4 h-4" />} label="Sélection" count={selectedMembreIds.size} color="blue" />
        </div>

        {/* Sélection custom */}
        {targetMode === "custom" && (
          <div className="border border-slate-200 rounded-xl bg-slate-50 p-3 mb-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input !text-sm w-full pl-9"
                  placeholder="Rechercher un adhérent..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button onClick={selectAllFiltered} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-medium whitespace-nowrap">
                Tout sélect.
              </button>
              {selectedMembreIds.size > 0 && (
                <button onClick={clearSelection} className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 font-medium whitespace-nowrap">
                  Effacer
                </button>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredMembres.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-3">Aucun adhérent trouvé.</p>
              )}
              {filteredMembres.map((m) => {
                const checked = selectedMembreIds.has(m.id);
                return (
                  <label key={m.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition ${checked ? "bg-blue-100" : "hover:bg-white"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMembre(m.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 flex-1 truncate">{m.nom}</span>
                    <span className="text-xs text-slate-400 truncate">{m.email}</span>
                    {m.ok === true ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Emails externes additionnels */}
        <div className="mt-3 border border-slate-200 rounded-xl bg-slate-50 p-3">
          <label className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-1.5 block">
            ➕ Emails supplémentaires (externes au site)
          </label>
          <textarea
            className="input w-full !text-sm resize-y min-h-[60px]"
            placeholder="exemple1@gmail.com, exemple2@hotmail.com, ...
(séparés par virgule, point-virgule ou saut de ligne)"
            value={extraEmails}
            onChange={(e) => setExtraEmails(e.target.value)}
            disabled={readOnly}
          />
          {parsedExtraEmails.length > 0 && (
            <p className="text-xs text-emerald-600 mt-1.5">
              ✅ {parsedExtraEmails.length} email{parsedExtraEmails.length > 1 ? "s" : ""} valide{parsedExtraEmails.length > 1 ? "s" : ""} ajouté{parsedExtraEmails.length > 1 ? "s" : ""}
            </p>
          )}
          {extraEmails.trim() && parsedExtraEmails.length === 0 && (
            <p className="text-xs text-amber-600 mt-1.5">
              ⚠️ Aucun email valide détecté
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            Ces emails s'ajoutent à la sélection ci-dessus. Permet d'envoyer à des personnes hors association (parents, partenaires, etc.).
          </p>
        </div>

        <p className="text-sm text-slate-600 font-medium mt-3">
          📧 <strong>{recipientCount}</strong> destinataire{recipientCount > 1 ? "s" : ""} {recipientCount > 1 ? "seront" : "sera"} contacté{recipientCount > 1 ? "s" : ""}
        </p>
      </div>

      {/* 🎨 Type d'email — sélecteur visuel */}
      <div className="mb-4">
        <label className="text-xs uppercase tracking-widest text-slate-500 mb-2 block font-semibold">Type d&apos;email</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <VariantButton current={variant} value="default" label="Standard" emoji="✉️" colorClass="from-slate-400 to-slate-500" onSelect={setVariant} disabled={readOnly} />
          <VariantButton current={variant} value="annonce" label="Annonce" emoji="📢" colorClass="from-blue-500 to-blue-700" onSelect={setVariant} disabled={readOnly} />
          <VariantButton current={variant} value="urgent" label="Urgent" emoji="🚨" colorClass="from-red-500 to-red-700" onSelect={setVariant} disabled={readOnly} />
          <VariantButton current={variant} value="bonne_nouvelle" label="Bonne nouvelle" emoji="🎉" colorClass="from-emerald-500 to-emerald-700" onSelect={setVariant} disabled={readOnly} />
          <VariantButton current={variant} value="info" label="Info" emoji="ℹ️" colorClass="from-slate-500 to-slate-700" onSelect={setVariant} disabled={readOnly} />
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          {variant === "urgent" && "🚨 En-tête rouge, badge URGENT, sujet préfixé « 🚨 URGENT — »"}
          {variant === "annonce" && "📢 En-tête bleu, badge ANNONCE, sujet préfixé « 📢 »"}
          {variant === "bonne_nouvelle" && "🎉 En-tête vert, badge BONNE NOUVELLE, sujet préfixé « 🎉 »"}
          {variant === "info" && "ℹ️ En-tête gris discret, badge INFO, sujet préfixé « ℹ️ »"}
          {variant === "default" && "✉️ Design standard SACCB (sans badge, sans préfixe au sujet)"}
        </p>
      </div>

      {/* Sujet */}
      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-500 mb-1 block font-semibold">Sujet</label>
        <input
          className="input w-full"
          placeholder="Sujet de l'email"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={300}
          disabled={readOnly}
        />
      </div>

      {/* Corps */}
      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-500 mb-1 block font-semibold">Message</label>
        <textarea
          className="input w-full min-h-[200px] resize-y"
          placeholder="Écrivez votre message... (les retours à la ligne seront préservés)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={100000}
          disabled={readOnly}
        />
        <p className="text-xs text-slate-400 mt-1">{body.length} caractères</p>
      </div>

      {/* Pièces jointes */}
      <div className="mb-4 border border-slate-200 rounded-xl p-3 bg-white">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
          Pièces jointes (max 25 Mo au total)
        </p>
        {attachments.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{att.filename}</span>
                  <span className="text-xs text-slate-400 shrink-0">({formatSize(att.size)})</span>
                </div>
                <button onClick={() => removeAttachment(i)} className="text-red-500 hover:text-red-700 p-0.5 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-500 mt-1">
              Total : {formatSize(totalAttachmentSize)} / 25 Mo
            </p>
          </div>
        )}
        {!readOnly && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-400 rounded-lg py-2 transition"
          >
            <Paperclip className="w-4 h-4" />
            Ajouter une pièce jointe
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleAddFiles(e.target.files)}
        />
      </div>

      {/* Résultat */}
      {result && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-medium ${result.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {result.text}
        </div>
      )}

      {/* Bouton envoyer */}
      {!readOnly && (
        <button
          onClick={handleSend}
          disabled={sending || recipientCount === 0 || !subject.trim() || !body.trim()}
          className="btn-primary w-full"
        >
          <Send className="w-4 h-4" />
          {sending ? "Envoi en cours..." : `Envoyer à ${recipientCount} destinataire${recipientCount > 1 ? "s" : ""}`}
        </button>
      )}

      {/* ─── HISTORIQUE DES EMAILS — SCISSION : MANUELS vs AUTOMATIQUES ─── */}
      {history.length > 0 && !readOnly && (
        <div className="mt-6 border-t border-slate-200 pt-4 flex justify-end">
          <button
            onClick={clearHistory}
            className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1 px-2 py-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Vider tout l&apos;historique
          </button>
        </div>
      )}

      {/* 👤 Manuels — emails écrits et envoyés par un admin */}
      {manualHistory.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setHistoryManualOpen(!historyManualOpen)}
            className="w-full flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl px-4 py-3 transition"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <Mail className="w-4 h-4 text-emerald-600" />
              👤 Emails envoyés manuellement ({manualHistory.length})
            </span>
            {historyManualOpen ? <ChevronUp className="w-4 h-4 text-emerald-700" /> : <ChevronDown className="w-4 h-4 text-emerald-700" />}
          </button>
          {historyManualOpen && (
            <div className="mt-3 space-y-2">
              {manualHistory.map((log) => renderLogItem(log))}
            </div>
          )}
        </div>
      )}

      {/* 🤖 Automatiques — emails envoyés par le système */}
      {autoHistory.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setHistoryAutoOpen(!historyAutoOpen)}
            className="w-full flex items-center justify-between bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl px-4 py-3 transition"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-sky-800">
              <History className="w-4 h-4 text-sky-600" />
              🤖 Emails envoyés automatiquement ({autoHistory.length})
            </span>
            {historyAutoOpen ? <ChevronUp className="w-4 h-4 text-sky-700" /> : <ChevronDown className="w-4 h-4 text-sky-700" />}
          </button>
          {historyAutoOpen && (
            <div className="mt-3 space-y-2">
              {autoHistory.map((log) => renderLogItem(log))}
            </div>
          )}
        </div>
      )}

    </div>
  );

  // 🧩 Helper : rendu d'une ligne d'historique (utilisé par les 2 sections manuels/auto)
  function renderLogItem(log: typeof history[number]) {
    const date = new Date(log.date);
    const isOpen = openLogId === log.id;
    return (
      <div key={log.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 p-3">
          <button
            onClick={() => setOpenLogId(isOpen ? null : log.id)}
            className="flex-1 flex items-center gap-3 min-w-0 text-left"
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === "sent" ? "bg-emerald-500" : log.status === "partial" ? "bg-amber-500" : "bg-red-500"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{log.subject}</p>
              <p className="text-xs text-slate-400">
                {date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                <strong>{log.sentCount ?? log.recipientCount}</strong> destinataire{(log.sentCount ?? log.recipientCount) > 1 ? "s" : ""}
                {log.status === "partial" && <span className="text-amber-600"> (partiel)</span>}
                {log.status === "failed" && <span className="text-red-600"> (échec)</span>}
              </p>
            </div>
            {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>
          {!readOnly && (
            <button
              onClick={() => deleteLog(log.id)}
              className="text-red-400 hover:text-red-600 p-1.5 rounded shrink-0"
              title="Supprimer cette entrée"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {isOpen && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 space-y-2">
            <div className="text-xs text-slate-500">
              <strong>Mode :</strong> {labelTargetMode(log.targetMode)}
              {log.sentBy && (
                <>
                  {" · "}
                  <strong>Envoyé par :</strong>{" "}
                  <span title={`Email enregistré : ${log.sentBy}`}>{resolveName(log.sentBy)}</span>
                </>
              )}
            </div>
            {log.recipientsPreview && log.recipientsPreview.length > 0 && (
              <div className="text-xs text-slate-500">
                <strong>Aperçu destinataires :</strong> {log.recipientsPreview.join(", ")}
                {log.recipientCount > log.recipientsPreview.length && ` … (+${log.recipientCount - log.recipientsPreview.length} autres)`}
              </div>
            )}
            {log.attachmentNames && log.attachmentNames.length > 0 && (
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {log.attachmentNames.join(", ")}
              </div>
            )}
            {log.body && (
              <div className="bg-white border border-slate-200 rounded-lg p-3 mt-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Contenu</p>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                  {log.body}
                </p>
              </div>
            )}
            {!readOnly && (
              <button
                onClick={() => reuseLog(log)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-2"
              >
                ↻ Ré-utiliser ce contenu (sujet + message)
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
}

function labelTargetMode(mode: string): string {
  switch (mode) {
    case "all": return "Tous les adhérents";
    case "paid": return "Adhérents payés";
    case "unpaid": return "Adhérents non-payés";
    case "news": return "Newsletter";
    case "custom": return "Sélection manuelle";
    default: return mode;
  }
}

function TargetButton({
  active,
  onClick,
  icon,
  label,
  count,
  color = "slate",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  color?: "slate" | "emerald" | "amber" | "purple" | "blue";
}) {
  const colors: Record<string, string> = {
    slate: active ? "bg-slate-700 text-white border-slate-700" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
    emerald: active ? "bg-emerald-600 text-white border-emerald-600" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    amber: active ? "bg-amber-600 text-white border-amber-600" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    purple: active ? "bg-purple-600 text-white border-purple-600" : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
    blue: active ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl border transition ${colors[color]}`}
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-[10px] opacity-80">{count}</span>
    </button>
  );
}

// 📝 Bouton de modèle d'email
function TemplateButton({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-400 transition text-left"
    >
      <span className="text-lg">{emoji}</span>
      <span className="text-xs font-semibold text-slate-700">{label}</span>
    </button>
  );
}

// 🎨 Bouton de sélection du type d'email (urgent / annonce / bonne nouvelle / info / standard)
function VariantButton({
  current,
  value,
  label,
  emoji,
  colorClass,
  onSelect,
  disabled,
}: {
  current: string;
  value: "urgent" | "annonce" | "bonne_nouvelle" | "info" | "default";
  label: string;
  emoji: string;
  colorClass: string;
  onSelect: (v: "urgent" | "annonce" | "bonne_nouvelle" | "info" | "default") => void;
  disabled?: boolean;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl border-2 transition text-center ${
        active
          ? `border-transparent bg-gradient-to-br ${colorClass} text-white shadow-md scale-[1.02]`
          : "border-slate-200 bg-white hover:border-slate-400 text-slate-700"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span className="text-lg leading-none">{emoji}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider leading-tight">{label}</span>
    </button>
  );
}
