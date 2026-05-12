"use client";

import { useMemo, useRef, useState } from "react";
import { Mail, Send, Paperclip, X, Users, CheckCircle2, Clock, Bell, UserCheck, Search } from "lucide-react";
import { DB } from "@/lib/types";
import { adminSendEmail } from "@/lib/db";

type TargetMode = "all" | "paid" | "unpaid" | "news" | "custom";

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
  readOnly,
}: {
  db: DB;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [targetMode, setTargetMode] = useState<TargetMode>("paid");
  const [selectedMembreIds, setSelectedMembreIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const membres = db.membres || [];

  // Calcul des destinataires selon le mode
  const recipientCount = useMemo(() => {
    if (targetMode === "all") return membres.length;
    if (targetMode === "paid") return membres.filter((m) => m.ok === true).length;
    if (targetMode === "unpaid") return membres.filter((m) => m.ok !== true).length;
    if (targetMode === "news") return membres.filter((m) => m.ok === true && m.newsOptIn !== false).length;
    if (targetMode === "custom") return selectedMembreIds.size;
    return 0;
  }, [targetMode, membres, selectedMembreIds]);

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
    if (recipientCount === 0) {
      setResult({ ok: false, text: "Aucun destinataire sélectionné." });
      return;
    }
    if (!adminEmail || !adminCode) {
      setResult({ ok: false, text: "Identifiants admin manquants. Reconnectez-vous." });
      return;
    }
    if (!confirm(`Envoyer cet email à ${recipientCount} adhérent${recipientCount > 1 ? "s" : ""} ?\n\nSujet : ${subject}`)) return;

    setSending(true);
    setResult(null);

    // Construire la liste custom
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
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    setSending(false);

    if (r.ok) {
      setResult({
        ok: true,
        text: `✅ Email envoyé à ${r.sent} adhérent${(r.sent ?? 0) > 1 ? "s" : ""}${r.total && r.total !== r.sent ? ` (sur ${r.total} prévus)` : ""}!`,
      });
      // Reset le formulaire
      setSubject("");
      setBody("");
      setAttachments([]);
      setSelectedMembreIds(new Set());
    } else {
      setResult({ ok: false, text: "❌ " + (r.reason || "Erreur lors de l'envoi.") });
    }
  }

  const totalAttachmentSize = attachments.reduce((s, a) => s + a.size, 0);

  return (
    <div className="glass p-4 md:p-6">
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

      {/* Sélection des destinataires */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-2 font-semibold">Destinataires</p>
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

        <p className="text-sm text-slate-600 font-medium">
          📧 <strong>{recipientCount}</strong> destinataire{recipientCount > 1 ? "s" : ""} sera{recipientCount > 1 ? "ont" : ""} contacté{recipientCount > 1 ? "s" : ""}
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
    </div>
  );
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
