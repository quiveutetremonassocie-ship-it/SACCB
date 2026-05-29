"use client";

import { useState } from "react";
import { StickyNote, Plus, Trash2, Clock, Pencil } from "lucide-react";
import { DB, AdminNote } from "@/lib/types";

export default function AdminNotes({
  db,
  onPersist,
  adminEmail,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  adminEmail?: string;
  readOnly?: boolean;
}) {
  const notes = db.adminNotes ?? [];
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  async function addNote() {
    if (!newContent.trim() || readOnly) return;
    setSaving(true);
    const note: AdminNote = {
      id: crypto.randomUUID(),
      content: newContent.trim(),
      author: adminEmail || "Admin",
      createdAt: new Date().toISOString(),
    };
    await onPersist({ ...db, adminNotes: [note, ...notes] });
    setNewContent("");
    setSaving(false);
  }

  async function deleteNote(id: string) {
    if (readOnly) return;
    if (!confirm("Supprimer cette note ?")) return;
    await onPersist({ ...db, adminNotes: notes.filter((n) => n.id !== id) });
  }

  async function saveEdit(id: string) {
    if (readOnly || !editContent.trim()) return;
    setSaving(true);
    await onPersist({
      ...db,
      adminNotes: notes.map((n) =>
        n.id === id ? { ...n, content: editContent.trim(), updatedAt: new Date().toISOString() } : n
      ),
    });
    setEditingId(null);
    setEditContent("");
    setSaving(false);
  }

  function startEdit(note: AdminNote) {
    setEditingId(note.id);
    setEditContent(note.content);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-200 px-6 py-4">
        <h3 className="font-display text-lg tracking-wider text-slate-800 flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-amber-600" />
          Bloc-notes
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Notes partagees entre admins (numeros, contacts, rappels...)
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Ajouter une note */}
        {!readOnly && (
          <div className="flex gap-2">
            <textarea
              className="input flex-1 !text-sm resize-none"
              rows={2}
              placeholder="Ecrire une note..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote();
              }}
            />
            <button
              onClick={addNote}
              disabled={saving || !newContent.trim()}
              className="btn-primary !px-4 shrink-0 self-end"
              title="Ajouter (Ctrl+Entree)"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Liste des notes */}
        {notes.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-6">
            Aucune note pour le moment.
          </p>
        )}

        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 group"
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    className="input w-full !text-sm resize-none"
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => saveEdit(note.id)}
                      disabled={saving}
                      className="btn-primary !text-xs !px-3 !py-1.5"
                    >
                      {saving ? "..." : "Sauver"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p
                    className="text-sm text-slate-700 whitespace-pre-wrap cursor-pointer hover:bg-amber-100/50 rounded-lg p-1 -m-1 transition"
                    onClick={() => !readOnly && startEdit(note)}
                    title={readOnly ? undefined : "Cliquer pour modifier"}
                  >
                    {note.content}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{note.author}</span>
                      <span>·</span>
                      <span>{formatDate(note.updatedAt || note.createdAt)}</span>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => startEdit(note)}
                          className="text-blue-400 hover:text-blue-600 transition p-1"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="text-red-400 hover:text-red-600 transition p-1"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
