"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, BarChart3, MessageSquare, Lightbulb, FileText, Lock, Unlock, Send, X, Check, Calendar, EyeOff, ChevronDown, ChevronUp, Upload, FileDown } from "lucide-react";
import { DB, Poll, AGItem, ReunionReport } from "@/lib/types";
import { supabaseClient, FACTURE_BUCKET, EDGE_FUNCTION_URL, SUPA_KEY } from "@/lib/supabase";

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
  const [tab, setTab] = useState<"sondages" | "ag" | "reports">("sondages");

  return (
    <div className="glass p-4 md:p-6">
      <h3 className="font-display text-lg md:text-xl tracking-wider text-slate-800 mb-4 flex items-center gap-2">
        📣 Sondages, AG & Comptes-rendus
      </h3>

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
          Comptes-rendus ({(db.reunionReports ?? []).length})
        </button>
      </div>

      {tab === "sondages" && <PollsTab db={db} onPersist={onPersist} readOnly={readOnly} />}
      {tab === "ag" && <AGTab db={db} onPersist={onPersist} readOnly={readOnly} />}
      {tab === "reports" && <ReportsTab db={db} onPersist={onPersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={readOnly} />}
    </div>
  );
}

// ─── Onglet sondages ───
function PollsTab({ db, onPersist, readOnly }: { db: DB; onPersist: (db: DB) => Promise<void>; readOnly?: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const polls = db.polls ?? [];

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

  return (
    <div className="space-y-2">
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
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const reports = db.reunionReports ?? [];

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
    if (file.size > 5_000_000) {
      alert("Le fichier dépasse 5 Mo.");
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
            bucket: FACTURE_BUCKET, // bucket "factures" accepte les PDF
            pathPrefix: "reports",
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
        const path = `reports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabaseClient.storage
          .from(FACTURE_BUCKET)
          .upload(path, file, { upsert: false, contentType: "application/pdf" });
        if (error) {
          alert("Erreur upload PDF : " + error.message);
          return;
        }
        const { data } = supabaseClient.storage.from(FACTURE_BUCKET).getPublicUrl(path);
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
      await supabaseClient.storage.from(FACTURE_BUCKET).remove([form.pdfPath]).catch(() => {});
    }
    setForm((f) => ({ ...f, pdfUrl: undefined, pdfPath: undefined, pdfName: undefined }));
  }

  async function save() {
    if (readOnly) return;
    if (!form.title.trim() || !form.content.trim()) {
      alert("Titre et contenu requis.");
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
      await supabaseClient.storage.from(FACTURE_BUCKET).remove([report.pdfPath]).catch(() => {});
    }
    await onPersist({ ...db, reunionReports: reports.filter((r) => r.id !== id) });
  }

  return (
    <div className="space-y-3">
      {!readOnly && !showForm && (
        <button onClick={startNew} className="btn-primary !text-sm w-full">
          <Plus className="w-4 h-4" /> Nouveau compte-rendu
        </button>
      )}

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              {editingId ? "Modifier le compte-rendu" : "Nouveau compte-rendu"}
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
              <option value="ag">Assemblée Générale</option>
              <option value="debut_saison">Début de saison</option>
              <option value="fin_saison">Fin de saison</option>
              <option value="autre">Autre réunion</option>
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
            placeholder="Contenu du compte-rendu (texte libre, retours à la ligne préservés)…"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />

          {/* Upload PDF (optionnel) */}
          <div className="border border-slate-200 rounded-xl p-3 bg-white">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
              Fichier PDF (optionnel — 5 Mo max)
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
                <div className="flex gap-1 shrink-0">
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
    </div>
  );
}

function labelType(t: ReunionReport["type"]): string {
  switch (t) {
    case "ag": return "Assemblée Générale";
    case "debut_saison": return "Début de saison";
    case "fin_saison": return "Fin de saison";
    default: return "Réunion";
  }
}
