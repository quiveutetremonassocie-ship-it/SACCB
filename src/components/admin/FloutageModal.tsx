"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Undo2, Plus, Check, RotateCcw, Loader2, Trash2 } from "lucide-react";
import type { ZoneFlou } from "@/lib/types";

// 🫥 Floutage d'une photo : pour chaque personne sans accord photo, on trace un rectangle sur elle.
// Les personnes sont demandées l'une après l'autre ; on ne peut pas enregistrer tant que chacune
// n'a pas au moins une zone. Le flou est calculé dans le navigateur et « cuit » dans l'image
// (impossible à retirer de la version publiée) ; l'original est gardé à part, côté admin.

type Personne = { id: string; nom: string };

const COTE_MAX_EXPORT = 2560; // taille max de la photo publiée (plus grand côté)
const COTE_MAX_ECRAN = 1600;

// Flou fort et irréversible : on réduit la zone à une poignée de pixels puis on l'agrandit en lissant
function flouterZone(ctx: CanvasRenderingContext2D, img: HTMLImageElement, z: ZoneFlou, W: number, H: number) {
  const x = Math.max(0, Math.round(z.x * W));
  const y = Math.max(0, Math.round(z.y * H));
  const w = Math.min(W - x, Math.round(z.w * W));
  const h = Math.min(H - y, Math.round(z.h * H));
  if (w < 2 || h < 2) return;
  const cellules = 7; // ~7 « taches » sur le plus grand côté : visage méconnaissable
  const k = Math.max(w, h) / cellules;
  const pw = Math.max(1, Math.round(w / k));
  const ph = Math.max(1, Math.round(h / k));
  const petit = document.createElement("canvas");
  petit.width = pw;
  petit.height = ph;
  const pc = petit.getContext("2d");
  if (!pc) return;
  pc.imageSmoothingEnabled = true;
  const sx = img.naturalWidth / W;
  const sy = img.naturalHeight / H;
  pc.drawImage(img, x * sx, y * sy, w * sx, h * sy, 0, 0, pw, ph);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(petit, 0, 0, pw, ph, x, y, w, h);
  ctx.restore();
}

function dessiner(canvas: HTMLCanvasElement, img: HTMLImageElement, zones: ZoneFlou[], coteMax: number) {
  const r = Math.min(1, coteMax / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * r);
  const H = Math.round(img.naturalHeight * r);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, W, H);
  for (const z of zones) flouterZone(ctx, img, z, W, H);
  return { ctx, W, H };
}

export default function FloutageModal({
  src,
  personnes,
  zonesInitiales,
  onSave,
  onRestaurer,
  onClose,
}: {
  src: string;
  personnes: Personne[];
  zonesInitiales?: ZoneFlou[];
  onSave: (jpegDataUrl: string, zones: ZoneFlou[], floutes: string[]) => Promise<void>;
  onRestaurer?: () => Promise<void>;
  onClose: () => void;
}) {
  const [zones, setZones] = useState<ZoneFlou[]>(() => zonesInitiales || []);
  const aZone = useCallback((id: string, zs: ZoneFlou[]) => zs.some((z) => z.membreId === id), []);
  // Personne en cours : la première qui n'a pas encore de zone (null = zone « en plus », sans nom)
  const [courant, setCourant] = useState<string | null>(() => {
    const p = personnes.find((x) => !(zonesInitiales || []).some((z) => z.membreId === x.id));
    return p ? p.id : null;
  });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "restore">("");
  const [brouillon, setBrouillon] = useState<ZoneFlou | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Chargement de la photo (crossOrigin pour pouvoir réexporter l'image floutée)
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setErreur("Impossible de charger la photo.");
    img.src = src;
  }, [src]);

  // Rendu : photo + flou en direct + contours des zones (contours seulement à l'écran)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !image) return;
    const r = dessiner(c, image, zones, COTE_MAX_ECRAN);
    if (!r) return;
    const { ctx, W, H } = r;
    const contour = (z: ZoneFlou, couleur: string, pointille: boolean, texte?: string) => {
      ctx.save();
      ctx.strokeStyle = couleur;
      ctx.lineWidth = Math.max(2, W / 400);
      if (pointille) ctx.setLineDash([8, 6]);
      ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.h * H);
      if (texte) {
        const t = Math.max(12, Math.round(W / 70));
        ctx.font = `bold ${t}px system-ui, sans-serif`;
        const largeur = ctx.measureText(texte).width + 10;
        const ty = Math.max(0, z.y * H - t - 8);
        ctx.fillStyle = couleur;
        ctx.fillRect(z.x * W, ty, largeur, t + 8);
        ctx.fillStyle = "#0F1B26";
        ctx.fillText(texte, z.x * W + 5, ty + t);
      }
      ctx.restore();
    };
    for (const z of zones) {
      const p = personnes.find((x) => x.id === z.membreId);
      contour(z, "#00B0F0", false, p ? p.nom : "Zone en plus");
    }
    if (brouillon) contour(brouillon, "#FFD23F", true);
  }, [image, zones, brouillon, personnes]);

  const point = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const onDown = (e: React.PointerEvent) => {
    if (busy) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    depart.current = point(e);
    setBrouillon({ ...depart.current, w: 0, h: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!depart.current) return;
    const p = point(e);
    const d = depart.current;
    setBrouillon({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) });
  };
  const onUp = () => {
    const b = brouillon;
    depart.current = null;
    setBrouillon(null);
    if (!b || b.w < 0.015 || b.h < 0.015) return; // simple clic : ignoré
    const nouvelle: ZoneFlou = { ...b, ...(courant ? { membreId: courant } : {}) };
    const suivantes = [...zones, nouvelle];
    setZones(suivantes);
    // On passe tout seul à la personne suivante qui n'a pas encore de zone
    const prochaine = personnes.find((p) => !aZone(p.id, suivantes));
    setCourant(prochaine ? prochaine.id : null);
  };

  const manquantes = personnes.filter((p) => !aZone(p.id, zones));
  const peutEnregistrer = !!image && manquantes.length === 0 && zones.length > 0 && !busy;
  const pCourante = personnes.find((p) => p.id === courant);
  const rang = pCourante ? personnes.indexOf(pCourante) + 1 : 0;

  async function enregistrer() {
    if (!image || !peutEnregistrer) return;
    setBusy("save");
    setErreur("");
    try {
      const c = document.createElement("canvas");
      dessiner(c, image, zones, COTE_MAX_EXPORT);
      const dataUrl = c.toDataURL("image/jpeg", 0.88);
      await onSave(dataUrl, zones, personnes.filter((p) => aZone(p.id, zones)).map((p) => p.id));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      setBusy("");
    }
  }

  async function restaurer() {
    if (!onRestaurer) return;
    if (!confirm("Remettre la photo d'origine, sans flou, sur le site ?")) return;
    setBusy("restore");
    setErreur("");
    try {
      await onRestaurer();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de remettre l'original.");
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-[5100] bg-[#0F1B26]/90 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Flouter la photo">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <p className="font-bold text-[#0F1B26]">Flouter des personnes sur la photo</p>
          <button onClick={onClose} disabled={!!busy} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Consigne du moment */}
        <div className={`px-5 py-3 text-[0.95rem] font-semibold ${pCourante ? "bg-[#FFF6CC] text-[#5C4A00]" : manquantes.length === 0 ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700"}`}>
          {pCourante ? (
            <>
              Floutez <strong>{pCourante.nom}</strong>
              {personnes.length > 1 && <> ({rang}/{personnes.length})</>} : tracez un rectangle sur son visage avec la souris ou le doigt.
            </>
          ) : manquantes.length === 0 ? (
            <>✓ Tout le monde est flouté. Vous pouvez ajouter une zone en plus, ou enregistrer.</>
          ) : (
            <>Zone en plus : tracez un rectangle n&apos;importe où sur la photo.</>
          )}
        </div>

        <div className="flex-1 overflow-y-auto grid md:grid-cols-[1fr_16rem] gap-4 p-4">
          <div className="flex items-start justify-center bg-slate-100 rounded-xl overflow-hidden min-h-[12rem]">
            {!image && !erreur && (
              <p className="m-auto py-16 text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement de la photo…</p>
            )}
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className={`max-w-full max-h-[64vh] w-auto h-auto cursor-crosshair select-none ${image ? "" : "hidden"}`}
              style={{ touchAction: "none" }}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-slate-700 mb-2">À flouter</p>
              <ul className="space-y-1.5">
                {personnes.map((p, i) => {
                  const ok = aZone(p.id, zones);
                  const actif = courant === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setCourant(p.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm font-semibold min-h-[44px] ${
                          actif ? "border-[#E0B400] bg-[#FFF6CC] text-[#5C4A00]" : ok ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-700"
                        }`}
                      >
                        <span className="w-6 text-center">{ok ? <Check className="w-4 h-4 inline" /> : `${i + 1}.`}</span>
                        <span className="flex-1 truncate">{p.nom}</span>
                        {ok && (
                          <span
                            role="button"
                            tabIndex={0}
                            title="Effacer sa zone"
                            onClick={(e) => { e.stopPropagation(); setZones((zs) => zs.filter((z) => z.membreId !== p.id)); setCourant(p.id); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setZones((zs) => zs.filter((z) => z.membreId !== p.id)); setCourant(p.id); } }}
                            className="p-1 rounded hover:bg-white/70"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => setCourant(null)} className="btn-ghost min-h-[44px] justify-center">
                <Plus className="w-4 h-4" /> Zone en plus
              </button>
              <button
                onClick={() => {
                  const reste = zones.slice(0, -1);
                  setZones(reste);
                  const p = personnes.find((x) => !aZone(x.id, reste));
                  setCourant(p ? p.id : null);
                }}
                disabled={zones.length === 0}
                className="btn-ghost min-h-[44px] justify-center disabled:opacity-40"
              >
                <Undo2 className="w-4 h-4" /> Annuler la dernière zone
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              La photo publiée sur le site sera floutée pour de bon. L&apos;original est gardé à part, visible seulement dans l&apos;admin.
            </p>

            {erreur && <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{erreur}</p>}

            <div className="mt-auto flex flex-col gap-2">
              <button onClick={enregistrer} disabled={!peutEnregistrer} className="btn-primary min-h-[48px] justify-center disabled:opacity-50">
                {busy === "save" ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : manquantes.length > 0 ? `Encore ${manquantes.length} personne${manquantes.length > 1 ? "s" : ""} à flouter` : "Enregistrer la photo floutée"}
              </button>
              {onRestaurer && (
                <button onClick={restaurer} disabled={!!busy} className="text-sm font-semibold text-slate-600 underline underline-offset-4 min-h-[44px] inline-flex items-center justify-center gap-1.5">
                  {busy === "restore" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Remettre la photo d&apos;origine
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
