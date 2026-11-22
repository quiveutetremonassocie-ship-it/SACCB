"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Images, Lock, Download } from "lucide-react";
import { Actualite, actualiteImages } from "@/lib/types";
import { MemberSession } from "@/lib/useMemberSession";

// 📰 Actualités en colonnes (style « journal ») : photo principale en haut si l'actu en a une,
// petite catégorie, puis le titre. Un clic ouvre le détail avec toute la galerie.
// Sur l'accueil on montre les 3 plus récentes (`limite`) ; la page /actualites montre tout.

function dateCourte(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function Actualites({
  actualites,
  memberSession,
  limite,
}: {
  actualites: Actualite[];
  memberSession?: MemberSession | null;
  limite?: number;
}) {
  // La dernière actu ajoutée (en bas de la liste de l'admin) passe en premier.
  const toutes = useMemo(() => [...actualites].reverse(), [actualites]);
  const liste = limite ? toutes.slice(0, limite) : toutes;
  const n = liste.length;

  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const openModal = useCallback((i: number) => {
    setModalIndex(i);
    setGalleryIndex(0);
  }, []);
  const closeModal = useCallback(() => setModalIndex(null), []);

  const currentModalImages = useMemo(
    () => (modalIndex !== null && liste[modalIndex] ? actualiteImages(liste[modalIndex]) : []),
    [modalIndex, liste]
  );

  const galleryNext = useCallback(() => {
    if (currentModalImages.length === 0) return;
    setGalleryIndex((i) => (i + 1) % currentModalImages.length);
  }, [currentModalImages.length]);
  const galleryPrev = useCallback(() => {
    if (currentModalImages.length === 0) return;
    setGalleryIndex((i) => (i - 1 + currentModalImages.length) % currentModalImages.length);
  }, [currentModalImages.length]);

  const modalNext = useCallback(() => {
    setModalIndex((i) => (i === null ? i : (i + 1) % n));
    setGalleryIndex(0);
  }, [n]);
  const modalPrev = useCallback(() => {
    setModalIndex((i) => (i === null ? i : (i - 1 + n) % n));
    setGalleryIndex(0);
  }, [n]);

  // Télécharger la photo affichée (adhérents connectés uniquement)
  const downloadCurrentPhoto = useCallback(async () => {
    if (modalIndex === null) return;
    const img = currentModalImages[galleryIndex];
    if (!img?.url) return;
    try {
      const res = await fetch(img.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = img.url.split(".").pop()?.split("?")[0] || "jpg";
      a.download = `saccb-${liste[modalIndex].title.replace(/[^a-zA-Z0-9]/g, "-")}-${galleryIndex + 1}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(img.url, "_blank");
    }
  }, [modalIndex, galleryIndex, currentModalImages, liste]);

  // Clavier dans le détail : Échap ferme, flèches = photos
  useEffect(() => {
    if (modalIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
      else if (e.key === "ArrowRight") galleryNext();
      else if (e.key === "ArrowLeft") galleryPrev();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalIndex, closeModal, galleryNext, galleryPrev]);

  const plusQueLimite = !!limite && toutes.length > limite;
  const ouverte = modalIndex !== null ? liste[modalIndex] : null;

  return (
    <section id="actualites" className="bg-white scroll-mt-20" aria-labelledby="titre-actualites">
      <div className="max-w-6xl mx-auto px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-6">
          <h2 id="titre-actualites" className="font-display text-4xl md:text-5xl text-[#0F1B26] leading-[0.95]">
            Actualités du club
          </h2>
          {plusQueLimite && (
            <a
              href="/actualites/"
              className="font-bold text-[#007DB0] underline underline-offset-4 min-h-[48px] inline-flex items-center"
            >
              Toutes les actualités ({toutes.length})
            </a>
          )}
        </div>

        {n === 0 ? (
          <div className="border-t-[3px] border-[#0F1B26] py-10 text-slate-600 text-lg">
            Aucune actualité pour le moment. Revenez bientôt !
          </div>
        ) : (
          <ul className="border-t-[3px] border-[#0F1B26] grid md:grid-cols-3">
            {liste.map((a, i) => {
              const imgs = actualiteImages(a);
              const photo = imgs[0];
              const debutLigne = i % 3 === 0;
              return (
                <li
                  key={a.id}
                  className={`border-b border-[#D3DEE6] ${debutLigne ? "" : "md:border-l md:pl-5"} ${i % 3 === 2 ? "" : "md:pr-5"}`}
                >
                  <button
                    onClick={() => openModal(i)}
                    className="group w-full text-left py-5 grid gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD23F] rounded-sm"
                  >
                    {photo && (
                      <span className="relative block aspect-[16/10] overflow-hidden rounded-lg bg-[#F2F6F9]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                        {imgs.length > 1 && (
                          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0F1B26]/85 text-white text-sm font-bold">
                            <Images className="w-4 h-4" aria-hidden="true" />
                            {imgs.length} photos
                          </span>
                        )}
                      </span>
                    )}
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] font-bold text-slate-500">
                      {a.categorie && <span>{a.categorie}</span>}
                      {!a.categorie && dateCourte(a.createdAt) && <span>{dateCourte(a.createdAt)}</span>}
                      {a.private && (
                        <span className="inline-flex items-center gap-1 text-[#7A3EB1]">
                          <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Adhérents
                        </span>
                      )}
                    </span>
                    <span className="block text-[1.15rem] leading-snug font-bold text-[#0F1B26] group-hover:text-[#007DB0] group-hover:underline underline-offset-4">
                      {a.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Détail d'une actualité (avec toute la galerie) ── */}
      {ouverte && modalIndex !== null && (
        <div
          className="fixed inset-0 z-[1800] bg-[#0F1B26]/85 flex items-center justify-center p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label={ouverte.title}
        >
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white text-[#0F1B26] flex items-center justify-center z-20"
            aria-label="Fermer"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl w-full max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
          >
            {currentModalImages.length > 0 && (
              <>
                <div className="relative aspect-[16/10] w-full bg-[#0F1B26] rounded-t-2xl overflow-hidden">
                  {currentModalImages[galleryIndex] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${ouverte.id}-${galleryIndex}`}
                      src={currentModalImages[galleryIndex].url}
                      alt={`${ouverte.title} — photo ${galleryIndex + 1}`}
                      className="w-full h-full object-contain"
                    />
                  )}

                  {memberSession && (
                    <button
                      onClick={downloadCurrentPhoto}
                      className="absolute top-3 left-3 h-11 px-3 rounded-full bg-white/90 hover:bg-white text-[#0F1B26] text-sm font-bold flex items-center gap-1.5"
                      title="Télécharger cette photo"
                    >
                      <Download className="w-4 h-4" /> Télécharger
                    </button>
                  )}

                  {currentModalImages.length > 1 && (
                    <>
                      <button
                        onClick={galleryPrev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 hover:bg-white text-[#0F1B26] flex items-center justify-center"
                        aria-label="Photo précédente"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={galleryNext}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 hover:bg-white text-[#0F1B26] flex items-center justify-center"
                        aria-label="Photo suivante"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-[#0F1B26]/85 text-white text-sm font-bold">
                        {galleryIndex + 1} / {currentModalImages.length}
                      </div>
                    </>
                  )}
                </div>

                {currentModalImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-[#D3DEE6] bg-[#F2F6F9]">
                    {currentModalImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setGalleryIndex(i)}
                        aria-label={`Voir la photo ${i + 1}`}
                        className={`shrink-0 w-20 h-14 rounded-md overflow-hidden border-2 ${
                          i === galleryIndex ? "border-[#00B0F0]" : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="p-6 md:p-10">
              <p className="flex flex-wrap items-center gap-x-3 text-[0.95rem] font-bold text-slate-500 mb-2">
                {ouverte.categorie && <span>{ouverte.categorie}</span>}
                {dateCourte(ouverte.createdAt) && <span>{dateCourte(ouverte.createdAt)}</span>}
                {ouverte.private && (
                  <span className="inline-flex items-center gap-1 text-[#7A3EB1]">
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Réservé aux adhérents
                  </span>
                )}
              </p>
              <h3 className="font-display text-3xl md:text-4xl text-[#0F1B26] mb-4 leading-tight">
                {ouverte.title}
              </h3>
              <p className="text-slate-700 text-lg whitespace-pre-wrap leading-relaxed">
                {ouverte.description}
              </p>

              {n > 1 && (
                <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-[#D3DEE6]">
                  <button onClick={modalPrev} className="btn-ghost min-h-[48px] inline-flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Précédente
                  </button>
                  <span className="text-sm text-slate-500 font-bold">
                    {modalIndex + 1} / {n}
                  </span>
                  <button onClick={modalNext} className="btn-ghost min-h-[48px] inline-flex items-center gap-2">
                    Suivante <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
