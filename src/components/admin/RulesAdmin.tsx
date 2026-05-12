"use client";

import { useState, useEffect, useRef } from "react";
import { ScrollText, Save, Check, Upload, FileText, X } from "lucide-react";
import { DB } from "@/lib/types";
import { supabaseClient, REPORTS_BUCKET, EDGE_FUNCTION_URL, SUPA_KEY } from "@/lib/supabase";

export default function RulesAdmin({
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
  const [text, setText] = useState(db.clubRules || "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Re-sync si la DB change (ex: refresh)
  useEffect(() => {
    setText(db.clubRules || "");
  }, [db.clubRules]);

  const isDirty = text !== (db.clubRules || "");

  async function save() {
    if (readOnly) return;
    setSaving(true);
    await onPersist({ ...db, clubRules: text });
    setSaving(false);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2500);
  }

  async function uploadPdf(file: File) {
    if (readOnly) return;
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
      let url = "";
      let path = "";

      if (adminEmail && adminCode) {
        // Via Edge Function (admin via espace membre)
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
            bucket: REPORTS_BUCKET,
            pathPrefix: "",
          }),
        });
        const result = await res.json();
        if (!result.ok) {
          alert("Erreur upload PDF : " + (result.reason || "Erreur inconnue"));
          return;
        }
        url = result.url;
        path = result.path;
      } else {
        // Admin Supabase Auth direct
        path = `rules-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabaseClient.storage
          .from(REPORTS_BUCKET)
          .upload(path, file, { upsert: false, contentType: "application/pdf" });
        if (error) {
          alert("Erreur upload PDF : " + error.message);
          return;
        }
        const { data } = supabaseClient.storage.from(REPORTS_BUCKET).getPublicUrl(path);
        url = data.publicUrl;
      }

      // Sauvegarde immédiate en DB (sans toucher au texte)
      await onPersist({
        ...db,
        clubRules: text, // au cas où il y avait des modifs non sauvegardées
        clubRulesPdfUrl: url,
        clubRulesPdfPath: path,
        clubRulesPdfName: file.name,
      });
    } finally {
      setUploading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  async function removePdf() {
    if (readOnly) return;
    if (!confirm("Retirer le PDF des règles ?")) return;
    // On essaie de supprimer du storage si on a accès direct
    if (db.clubRulesPdfPath && (!adminEmail || !adminCode)) {
      await supabaseClient.storage.from(REPORTS_BUCKET).remove([db.clubRulesPdfPath]).catch(() => {});
    }
    await onPersist({
      ...db,
      clubRules: text,
      clubRulesPdfUrl: undefined,
      clubRulesPdfPath: undefined,
      clubRulesPdfName: undefined,
    });
  }

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-display text-2xl tracking-wider text-slate-800">Règles du club</h3>
          <p className="text-xs text-slate-400">
            Visibles par tous les adhérents connectés. Restent permanentes (non archivées avec les saisons).
          </p>
        </div>
      </div>

      <textarea
        className="input w-full min-h-[300px] resize-y font-mono text-sm leading-relaxed"
        placeholder={`Exemple :

📋 Règles du SACCB

1. Horaires
   - Mardi 20h-22h
   - Jeudi 20h-22h

2. Matériel
   - Apporter ses raquettes
   - Volants fournis par le club

3. Tournois
   - Inscription obligatoire avant la date limite
   - Présence obligatoire le jour J

...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={readOnly}
      />

      {/* PDF du règlement (optionnel) */}
      <div className="mt-3 border border-slate-200 rounded-xl p-3 bg-white">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
          Fichier PDF du règlement (optionnel — 20 Mo max)
        </p>
        {db.clubRulesPdfUrl ? (
          <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <a
              href={db.clubRulesPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 min-w-0 truncate"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">{db.clubRulesPdfName || "Voir le PDF"}</span>
            </a>
            {!readOnly && (
              <button
                type="button"
                onClick={removePdf}
                className="text-red-500 hover:text-red-700 p-1 rounded shrink-0"
                title="Retirer le PDF"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={uploading || readOnly}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-400 rounded-lg py-3 transition disabled:opacity-50"
          >
            {uploading ? (
              <>Envoi en cours...</>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Ajouter un PDF du règlement
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

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-slate-400">
          {text.length} caractère{text.length > 1 ? "s" : ""}
          {isDirty && !savedAt && <span className="text-amber-600 ml-2">• modifications non sauvegardées</span>}
        </p>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Enregistré
            </span>
          )}
          {!readOnly && (
            <button
              onClick={save}
              disabled={!isDirty || saving}
              className="btn-primary !text-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? "Sauvegarde..." : "Enregistrer le texte"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
