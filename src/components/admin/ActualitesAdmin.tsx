"use client";

import { useRef, useState } from "react";
import {
  Newspaper,
  Plus,
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
  Eye,
  X,
} from "lucide-react";
import { DB, Actualite, ActualiteImage, actualiteImages } from "@/lib/types";
import { supabaseClient, ACTU_BUCKET, EDGE_FUNCTION_URL, SUPA_KEY } from "@/lib/supabase";
import Actualites from "../Actualites";

export default function ActualitesAdmin({
  db,
  onPersist,
  adminEmail,
  adminCode,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const list = db.actualites || [];

  async function uploadOne(id: string, file: File): Promise<ActualiteImage | null> {
    // Si admin via espace membre (pas de JWT Supabase), on passe par l'Edge Function
    if (adminEmail && adminCode) {
      return uploadOneViaEdge(id, file);
    }
    // Admin Supabase Auth : upload direct (JWT valide)
    const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabaseClient.storage
      .from(ACTU_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      alert("Erreur upload image : " + error.message);
      return null;
    }
    const { data } = supabaseClient.storage.from(ACTU_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  async function uploadOneViaEdge(id: string, file: File): Promise<ActualiteImage | null> {
    // Convertir le fichier en base64
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
        contentType: file.type || "image/jpeg",
        bucket: ACTU_BUCKET,
        pathPrefix: id,
      }),
    });

    const result = await res.json();
    if (!result.ok) {
      alert("Erreur upload image : " + (result.reason || "Erreur inconnue"));
      return null;
    }
    return { url: result.url, path: result.path };
  }

  async function uploadMany(id: string, files: File[]): Promise<ActualiteImage[]> {
    const out: ActualiteImage[] = [];
    for (const f of files) {
      const r = await uploadOne(id, f);
      if (r) out.push(r);
    }
    return out;
  }

  async function addActualite() {
    if (!title || !description || pendingFiles.length === 0) {
      alert("Titre, description et au moins une image requis.");
      return;
    }
    setBusy(true);
    const id = Date.now().toString();
    const images = await uploadMany(id, pendingFiles);
    if (images.length === 0) {
      setBusy(false);
      return;
    }
    const a: Actualite = {
      id,
      title,
      description,
      images,
      createdAt: new Date().toISOString(),
    };
    const next = { ...db, actualites: [...list, a] };
    await onPersist(next);
    setTitle("");
    setDescription("");
    setPendingFiles([]);
    if (fileInput.current) fileInput.current.value = "";
    setBusy(false);
  }

  async function delActualite(id: string) {
    if (!confirm("Supprimer cette actualité ?")) return;
    const a = list.find((x) => x.id === id);
    if (a) {
      const imgs = actualiteImages(a);
      const paths = imgs.map((i) => i.path).filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabaseClient.storage.from(ACTU_BUCKET).remove(paths).catch(() => {});
      }
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

  async function addImagesTo(id: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const uploaded = await uploadMany(id, Array.from(files));
    const next = {
      ...db,
      actualites: list.map((x) => {
        if (x.id !== id) return x;
        const existing = actualiteImages(x);
        return {
          ...x,
          images: [...existing, ...uploaded],
          // on retire les anciens champs legacy une fois migré
          imageUrl: undefined,
          imagePath: undefined,
        };
      }),
    };
    await onPersist(next);
    setBusy(false);
  }

  async function removeImage(actuId: string, imgIndex: number) {
    if (!confirm("Supprimer cette image ?")) return;
    const a = list.find((x) => x.id === actuId);
    if (!a) return;
    const imgs = actualiteImages(a);
    const target = imgs[imgIndex];
    if (!target) return;
    if (imgs.length === 1) {
      alert("Impossible de supprimer la dernière image. Supprime plutôt l'actualité entière.");
      return;
    }
    if (target.path) {
      await supabaseClient.storage.from(ACTU_BUCKET).remove([target.path]).catch(() => {});
    }
    const remaining = imgs.filter((_, i) => i !== imgIndex);
    const next = {
      ...db,
      actualites: list.map((x) =>
        x.id === actuId
          ? { ...x, images: remaining, imageUrl: undefined, imagePath: undefined }
          : x
      ),
    };
    await onPersist(next);
  }

  async function setMainImage(actuId: string, imgIndex: number) {
    const a = list.find((x) => x.id === actuId);
    if (!a) return;
    const imgs = actualiteImages(a);
    if (imgIndex === 0) return;
    const reordered = [imgs[imgIndex], ...imgs.filter((_, i) => i !== imgIndex)];
    const next = {
      ...db,
      actualites: list.map((x) =>
        x.id === actuId
          ? { ...x, images: reordered, imageUrl: undefined, imagePath: undefined }
          : x
      ),
    };
    await onPersist(next);
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
    <div className="glass p-6 border border-amber-200">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-display text-2xl tracking-wider text-slate-800">Actualités</h3>
        </div>
        <button
          onClick={() => setShowPreview((s) => !s)}
          className="btn-primary !bg-gradient-to-r !from-slate-600 !to-slate-700 !px-4 !py-2 !text-xs"
        >
          <Eye className="w-4 h-4" /> {showPreview ? "Masquer" : "Afficher"} l'aperçu
        </button>
      </div>

      {/* AJOUT */}
      <div className="bg-slate-50 rounded-2xl p-5 mb-5 border border-slate-200">
        <h4 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-widest">
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
            placeholder="Description (visible en dessous des images)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="flex items-center gap-3 text-sm text-slate-500 cursor-pointer hover:text-slate-700 transition">
            <Upload className="w-4 h-4" />
            <span>
              {pendingFiles.length > 0 ? (
                <span className="text-amber-400 font-semibold">
                  {pendingFiles.length} image{pendingFiles.length > 1 ? "s" : ""} sélectionnée
                  {pendingFiles.length > 1 ? "s" : ""}
                </span>
              ) : (
                "Choisir une ou plusieurs images (la 1ère sera l'image principale)"
              )}
            </span>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
            />
          </label>
          {pendingFiles.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {pendingFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700"
                >
                  {i === 0 && <span className="text-yellow-300">★</span>}
                  <span className="truncate max-w-[140px]">{f.name}</span>
                  <button
                    onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                    className="text-amber-400/60 hover:text-amber-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
      <div className="space-y-4 mb-5">
        {list.length === 0 && (
          <p className="text-center text-slate-400 py-6 text-sm">Aucune actualité pour le moment</p>
        )}
        {list.map((a, i) => {
          const imgs = actualiteImages(a);
          return (
            <div key={a.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <div className="flex gap-4 mb-3">
                <div className="relative w-32 h-32 shrink-0 rounded-xl overflow-hidden bg-slate-200">
                  {imgs[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgs[0].url}
                      alt={a.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {imgs.length > 1 && (
                    <div className="absolute bottom-1 right-1 px-2 py-0.5 rounded-full bg-black/70 text-[10px] text-white font-semibold">
                      +{imgs.length - 1}
                    </div>
                  )}
                </div>
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
                    <button
                      onClick={() => move(a.id, -1)}
                      disabled={i === 0}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Monter"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => move(a.id, 1)}
                      disabled={i === list.length - 1}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
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

              {/* Galerie d'images */}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                    Galerie ({imgs.length})
                  </p>
                  <label className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                    <Upload className="w-3 h-3" /> Ajouter des images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => addImagesTo(a.id, e.target.files)}
                    />
                  </label>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {imgs.map((img, idx) => (
                    <div key={idx} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt=""
                        className={`w-20 h-20 object-cover rounded-lg border-2 ${
                          idx === 0
                            ? "border-yellow-400 ring-2 ring-yellow-400/20"
                            : "border-slate-200"
                        }`}
                      />
                      {idx === 0 && (
                        <div className="absolute top-0.5 left-0.5 px-1.5 py-0.5 rounded bg-yellow-400 text-black text-[9px] font-bold uppercase">
                          Principale
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1">
                        {idx !== 0 && (
                          <button
                            onClick={() => setMainImage(a.id, idx)}
                            className="text-[9px] uppercase tracking-wider text-yellow-300 hover:text-yellow-200 font-bold"
                          >
                            ★ Définir principale
                          </button>
                        )}
                        <button
                          onClick={() => removeImage(a.id, idx)}
                          className="text-red-400 hover:text-red-300"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* APERCU LIVE */}
      {showPreview && list.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" /> Aperçu du rendu côté site (temps réel, rotation 5s)
          </p>
          <div className="rounded-3xl overflow-hidden bg-slate-50 p-4 border border-slate-200">
            <Actualites actualites={list} />
          </div>
        </div>
      )}
    </div>
  );
}
