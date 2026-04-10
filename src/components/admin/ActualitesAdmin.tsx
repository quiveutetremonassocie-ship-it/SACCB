"use client";

import { useRef, useState } from "react";
import { Newspaper, Plus, Trash2, Upload, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { DB, Actualite } from "@/lib/types";
import { supabaseClient, ACTU_BUCKET } from "@/lib/supabase";
import Actualites from "../Actualites";

export default function ActualitesAdmin({
  db,
  onPersist,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const list = db.actualites || [];

  async function uploadImage(id: string, file: File) {
    const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabaseClient.storage
      .from(ACTU_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      alert("Erreur upload image : " + error.message);
      return null;
    }
    const { data } = supabaseClient.storage.from(ACTU_BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function addActualite() {
    if (!title || !description || !pendingFile) {
      alert("Titre, description et image requis.");
      return;
    }
    setBusy(true);
    const id = Date.now().toString();
    const uploaded = await uploadImage(id, pendingFile);
    if (!uploaded) {
      setBusy(false);
      return;
    }
    const a: Actualite = {
      id,
      title,
      description,
      imageUrl: uploaded.url,
      imagePath: uploaded.path,
      createdAt: new Date().toISOString(),
    };
    const next = { ...db, actualites: [...list, a] };
    await onPersist(next);
    setTitle("");
    setDescription("");
    setPendingFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setBusy(false);
  }

  async function delActualite(id: string) {
    if (!confirm("Supprimer cette actualité ?")) return;
    const a = list.find((x) => x.id === id);
    if (a?.imagePath) {
      await supabaseClient.storage.from(ACTU_BUCKET).remove([a.imagePath]).catch(() => {});
    }
    const next = { ...db, actualites: list.filter((x) => x.id !== id) };
    await onPersist(next);
  }

  async function updateField(id: string, field: "title" | "description", value: string) {
    const next = {
      ...db,
      actualites: list.map((x) => (x.id === id ? { ...x, [field]: value } : x)),
    };
    await onPersist(next);
  }

  async function replaceImage(id: string, file: File) {
    setBusy(true);
    const old = list.find((x) => x.id === id);
    if (old?.imagePath) {
      await supabaseClient.storage.from(ACTU_BUCKET).remove([old.imagePath]).catch(() => {});
    }
    const uploaded = await uploadImage(id, file);
    if (!uploaded) {
      setBusy(false);
      return;
    }
    const next = {
      ...db,
      actualites: list.map((x) =>
        x.id === id ? { ...x, imageUrl: uploaded.url, imagePath: uploaded.path } : x
      ),
    };
    await onPersist(next);
    setBusy(false);
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const copy = [...list];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    await onPersist({ ...db, actualites: copy });
  }

  return (
    <div className="glass p-6 border border-amber-500/30">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-display text-2xl tracking-wider text-white">Actualités</h3>
        </div>
        <button
          onClick={() => setShowPreview((s) => !s)}
          className="btn-primary !bg-gradient-to-r !from-slate-600 !to-slate-700 !px-4 !py-2 !text-xs"
        >
          <Eye className="w-4 h-4" /> {showPreview ? "Masquer" : "Afficher"} l'aperçu
        </button>
      </div>

      {/* AJOUT */}
      <div className="bg-black/30 rounded-2xl p-5 mb-5 border border-white/5">
        <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-widest">
          Nouvelle actualité
        </h4>
        <div className="space-y-3">
          <input
            className="input w-full"
            placeholder="Titre de l'actualité"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input w-full min-h-[100px] resize-y"
            placeholder="Description (visible en dessous de l'image)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="flex items-center gap-3 text-sm text-white/60 cursor-pointer hover:text-white transition">
            <Upload className="w-4 h-4" />
            <span>
              {pendingFile ? (
                <span className="text-amber-400 font-semibold">{pendingFile.name}</span>
              ) : (
                "Choisir une image"
              )}
            </span>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            onClick={addActualite}
            disabled={busy}
            className="btn-primary w-full !bg-gradient-to-r !from-amber-500 !to-orange-500"
          >
            <Plus className="w-4 h-4" /> Ajouter l'actualité
          </button>
        </div>
      </div>

      {/* LISTE */}
      <div className="space-y-3 mb-5">
        {list.length === 0 && (
          <p className="text-center text-white/40 py-6 text-sm">Aucune actualité pour le moment</p>
        )}
        {list.map((a, i) => (
          <div key={a.id} className="bg-black/30 rounded-2xl p-4 border border-white/5 flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.imageUrl}
              alt={a.title}
              className="w-28 h-28 object-cover rounded-xl shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-2">
              <input
                className="input w-full !text-sm"
                value={a.title}
                onChange={(e) => updateField(a.id, "title", e.target.value)}
              />
              <textarea
                className="input w-full !text-xs min-h-[60px] resize-y"
                value={a.description}
                onChange={(e) => updateField(a.id, "description", e.target.value)}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                  <Upload className="w-3 h-3" /> Remplacer l'image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) replaceImage(a.id, f);
                    }}
                  />
                </label>
                <button
                  onClick={() => move(a.id, -1)}
                  disabled={i === 0}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Monter"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => move(a.id, 1)}
                  disabled={i === list.length - 1}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Descendre"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => delActualite(a.id)}
                  className="btn-danger !px-3 !py-1.5 !text-xs ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* APERCU LIVE */}
      {showPreview && list.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs uppercase tracking-widest text-amber-400 font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" /> Aperçu du rendu côté site (temps réel, rotation 5s)
          </p>
          <div className="rounded-3xl overflow-hidden bg-bgdark/60 p-4 border border-white/5">
            <div className="pointer-events-auto">
              <Actualites actualites={list} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
