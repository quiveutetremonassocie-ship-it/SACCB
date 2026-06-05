"use client";

import { useState } from "react";
import { FileText, Plus, Trash2, Pencil, Save, X, ChevronUp, ChevronDown, Download, Upload } from "lucide-react";
import type { DB, OfficialDoc } from "@/lib/types";
import { adminOfficialDocSave, adminOfficialDocDelete, adminOfficialDocReorder } from "@/lib/db";
import { supabaseClient, REPORTS_BUCKET, EDGE_FUNCTION_URL, SUPA_KEY } from "@/lib/supabase";

const TYPE_LABELS: Record<string, string> = {
  rapport_financier: "📊 Rapport financier",
  charte: "📜 Charte",
  rapport_moral: "📝 Rapport moral",
  autre: "📄 Autre",
};

const TYPE_COLORS: Record<string, string> = {
  rapport_financier: "bg-emerald-100 text-emerald-700 border-emerald-200",
  charte: "bg-purple-100 text-purple-700 border-purple-200",
  rapport_moral: "bg-blue-100 text-blue-700 border-blue-200",
  autre: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function OfficialDocsAdmin({
  db,
  onPersist,
  onRefresh,
  adminEmail,
  adminCode,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  onRefresh?: () => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
}) {
  const docs = ((db.officialDocs ?? []) as OfficialDoc[]).slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const open = db.officialDocsOpen === true;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form
  const [form, setForm] = useState<Partial<OfficialDoc>>({
    title: "", type: "autre", content: "", pdfUrl: "", pdfPath: "", pdfName: "",
  });

  function reset() {
    setForm({ title: "", type: "autre", content: "", pdfUrl: "", pdfPath: "", pdfName: "" });
    setEditingId(null); setAdding(false);
  }

  function startAdd() {
    reset();
    setAdding(true);
  }

  function startEdit(doc: OfficialDoc) {
    setForm({
      title: doc.title,
      type: doc.type,
      content: doc.content || "",
      pdfUrl: doc.pdfUrl || "",
      pdfPath: doc.pdfPath || "",
      pdfName: doc.pdfName || "",
    });
    setEditingId(doc.id);
    setAdding(false);
  }

  async function toggleOpen() {
    if (readOnly) return;
    await onPersist({ ...db, officialDocsOpen: !open });
  }

  async function uploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Format PDF uniquement.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Le fichier ne doit pas dépasser 10 Mo.");
      return;
    }
    setUploading(true);
    try {
      if (adminEmail && adminCode) {
        // Upload via Edge Function (admin via membre)
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) {
          const chunk = bytes.subarray(i, i + 8192);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
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
            bucket: REPORTS_BUCKET,
            pathPrefix: "official-docs/",
          }),
        });
        const result = await res.json();
        if (!result.ok) {
          alert("Erreur upload : " + (result.reason || "Inconnue"));
          return;
        }
        setForm((f) => ({ ...f, pdfUrl: result.url, pdfPath: result.path, pdfName: file.name }));
      } else {
        // Upload direct (admin Supabase Auth)
        const path = `official-docs/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabaseClient.storage
          .from(REPORTS_BUCKET)
          .upload(path, file, { upsert: false, contentType: "application/pdf" });
        if (error) {
          alert("Erreur upload : " + error.message);
          return;
        }
        const { data } = supabaseClient.storage.from(REPORTS_BUCKET).getPublicUrl(path);
        setForm((f) => ({ ...f, pdfUrl: data.publicUrl, pdfPath: path, pdfName: file.name }));
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removePdfFromForm() {
    setForm((f) => ({ ...f, pdfUrl: "", pdfPath: "", pdfName: "" }));
  }

  async function save() {
    if (readOnly || !adminEmail || !adminCode) return;
    if (!form.title?.trim()) {
      alert("Le titre est obligatoire.");
      return;
    }
    if (!form.content?.trim() && !form.pdfUrl) {
      alert("Ajoute au moins un contenu (texte) ou un PDF.");
      return;
    }
    setSaving(true);
    const r = await adminOfficialDocSave({
      adminEmail, adminCode,
      docId: editingId || undefined,
      title: form.title.trim(),
      type: (form.type as OfficialDoc["type"]) || "autre",
      content: form.content?.trim() || undefined,
      pdfUrl: form.pdfUrl || undefined,
      pdfPath: form.pdfPath || undefined,
      pdfName: form.pdfName || undefined,
    });
    setSaving(false);
    if (r.ok) {
      reset();
      if (onRefresh) await onRefresh();
    } else {
      alert("Erreur : " + (r.reason || "Inconnue"));
    }
  }

  async function deleteDoc(id: string) {
    if (readOnly || !adminEmail || !adminCode) return;
    if (!confirm("Supprimer ce document ? Le PDF associé sera aussi supprimé.")) return;
    const r = await adminOfficialDocDelete(adminEmail, adminCode, id);
    if (r.ok) {
      if (onRefresh) await onRefresh();
    } else {
      alert("Erreur : " + (r.reason || "Inconnue"));
    }
  }

  async function move(id: string, direction: "up" | "down") {
    if (readOnly || !adminEmail || !adminCode) return;
    const r = await adminOfficialDocReorder(adminEmail, adminCode, id, direction);
    if (r.ok && onRefresh) await onRefresh();
  }

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display text-xl tracking-wider text-slate-800">Documents officiels</h3>
            <p className="text-xs text-slate-500">
              {docs.length} document{docs.length > 1 ? "s" : ""} • Saison {db.y1}-{db.y2}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && !adding && !editingId && (
            <button onClick={startAdd} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          )}
          {!readOnly && (
            <button
              onClick={toggleOpen}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                open
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
              }`}
            >
              {open ? "✓ Documents visibles" : "✗ Documents masqués"}
            </button>
          )}
        </div>
      </div>

      {!open && docs.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-slate-600">
            ℹ️ Les documents sont <strong>masqués</strong> pour les adhérents. Active le toggle pour les rendre visibles dans Mon espace.
          </p>
        </div>
      )}

      {/* Formulaire ajout/édition */}
      {(adding || editingId) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-blue-700 font-semibold">
            {editingId ? "Modifier le document" : "Nouveau document"}
          </p>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold block mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as OfficialDoc["type"] }))}
              className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
            >
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold block mb-1">Titre *</label>
            <input
              type="text"
              value={form.title || ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Rapport financier 2025-2026"
              className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
              maxLength={200}
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold block mb-1">
              Contenu / résumé (optionnel)
            </label>
            <textarea
              value={form.content || ""}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={5}
              placeholder="Texte libre affiché aux adhérents. Optionnel si tu as joint un PDF."
              className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
              maxLength={10000}
            />
          </div>

          {/* Upload PDF */}
          <div>
            <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold block mb-1">
              Fichier PDF (optionnel, max 10 Mo)
            </label>
            {form.pdfUrl ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                <a href={form.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700 hover:text-emerald-900 truncate flex-1">
                  {form.pdfName || "Document PDF"}
                </a>
                <button onClick={removePdfFromForm} className="text-red-400 hover:text-red-600 shrink-0" title="Retirer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 bg-white border-2 border-dashed border-blue-300 hover:border-blue-500 text-blue-700 hover:text-blue-900 text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Upload en cours..." : "Choisir un fichier PDF"}
                <input type="file" accept="application/pdf" onChange={uploadPdf} className="hidden" disabled={uploading} />
              </label>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={reset} className="flex-1 text-xs border border-slate-300 text-slate-600 rounded-lg py-2 hover:bg-slate-50">
              Annuler
            </button>
            <button
              onClick={save}
              disabled={saving || uploading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg py-2 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {docs.length === 0 && !adding ? (
        <p className="text-sm text-slate-400 italic text-center py-6">
          Aucun document pour le moment. Clique sur « Ajouter » pour créer le premier.
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc, idx) => {
            const typeColor = TYPE_COLORS[doc.type] || TYPE_COLORS.autre;
            const typeLabel = TYPE_LABELS[doc.type] || doc.type;
            return (
              <li key={doc.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-2">
                {!readOnly && docs.length > 1 && (
                  <div className="flex flex-col shrink-0 -my-1">
                    <button onClick={() => move(doc.id, "up")} disabled={idx === 0} className="text-slate-300 hover:text-slate-700 disabled:opacity-30 p-0.5">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => move(doc.id, "down")} disabled={idx === docs.length - 1} className="text-slate-300 hover:text-slate-700 disabled:opacity-30 p-0.5">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${typeColor}`}>
                      {typeLabel}
                    </span>
                    {doc.pdfUrl && (
                      <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                        <Download className="w-3 h-3" /> PDF
                      </a>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{doc.title}</p>
                  {doc.content && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{doc.content}</p>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(doc)} className="text-slate-400 hover:text-blue-600 p-1.5" title="Modifier">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteDoc(doc.id)} className="text-red-400 hover:text-red-600 p-1.5" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
