"use client";

import { useState, useEffect } from "react";
import { ScrollText, Save, Check } from "lucide-react";
import { DB } from "@/lib/types";

export default function RulesAdmin({
  db,
  onPersist,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  readOnly?: boolean;
}) {
  const [text, setText] = useState(db.clubRules || "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
              {saving ? "Sauvegarde..." : "Enregistrer les règles"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
