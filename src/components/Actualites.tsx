"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Newspaper, Images, Lock } from "lucide-react";
import { Actualite, actualiteImages } from "@/lib/types";
import { MemberSession } from "@/lib/useMemberSession";

export default function Actualites({ actualites, memberSession }: { actualites: Actualite[]; memberSession?: MemberSession | null }) {
  const [index, setIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const n = actualites.length;

  // Auto-rotation toutes les 2,5 secondes
  useEffect(() => {
    if (n < 2 || paused || modalIndex !== null) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, 2500);
    return () => clearInterval(id);
  }, [n, paused, modalIndex]);

  useEffect(() => {
    if (index >= n && n > 0) setIndex(0);
  }, [index, n]);

  const openModal = useCallback((i: number) => {
    setModalIndex(i);
    setGalleryIndex(0);
  }, []);
  const closeModal = useCallback(() => setModalIndex(null), []);

  const currentModalImages = useMemo(
    () => (modalIndex !== null ? actualiteImages(actualites[modalIndex]) : []),
    [modalIndex, actualites]
  );

  const galleryNext = useCallback(() => {
    if (currentModalImages.length === 0) return;
    setGalleryIndex((i) => (i + 1) % currentModalImages.length);
  }, [currentModalImages.length]);
  const galleryPrev = useCallback(() => {
    if (currentModalImages.length === 0) return;
    setGalleryIndex((i) => (i - 1 + currentModalImages.length) % currentModalImages.length);
  }, [currentModalImages.length]);

  // Navigation entre actualités dans le modal
  const modalNext = useCallback(() => {
    if (modalIndex === null) return;
    setModalIndex((i) => ((i as number) + 1) % n);
    setGalleryIndex(0);
  }, [modalIndex, n]);
  const modalPrev = useCallback(() => {
    if (modalIndex === null) return;
    setModalIndex((i) => ((i as number) - 1 + n) % n);
    setGalleryIndex(0);
  }, [modalIndex, n]);

  // Navigation clavier dans le modal (galerie)
  useEffect(() => {
    if (modalIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
      else if (e.key === "ArrowRight") galleryNext();
      else if (e.key === "ArrowLeft") galleryPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalIndex, closeModal, galleryNext, galleryPrev]);

  // Navigation carrousel (flèches)
  const carouselPrev = useCallback(() => {
    setIndex((i) => (i - 1 + n) % n);
    setPaused(true);
    setTimeout(() => setPaused(false), 3000);
  }, [n]);
  const carouselNext = useCallback(() => {
    setIndex((i) => (i + 1) % n);
    setPaused(true);
    setTimeout(() => setPaused(false), 3000);
  }, [n]);

  if (n === 0) return null;

  const current = actualites[index];
  const currentMain = actualiteImages(current)[0];

  return (
    <section id="actualites" className="bg-section-wrap bg-news relative">
      <div className="section-pad relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-amber-600">En ce moment</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Actualités</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Retrouvez ici les dernières nouvelles du club, événements et moments forts.
          </p>
        </motion.div>

        <div
          className="relative max-w-4xl mx-auto group/carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Flèche gauche */}
          {n > 1 && (
            <button
              onClick={carouselPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/50 hover:bg-black/75 flex items-center justify-center text-white transition opacity-0 group-hover/carousel:opacity-100 shadow-lg"
              aria-label="Actualité précédente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => openModal(index)}
            className="relative block w-full aspect-[16/9] rounded-3xl overflow-hidden group shadow-2xl shadow-slate-300/40 border border-slate-200"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {currentMain && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentMain.url}
                    alt={current.title}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute left-0 right-0 bottom-0 p-6 md:p-10 text-left">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 backdrop-blur">
                      <Newspaper className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-[10px] uppercase tracking-widest text-amber-200 font-semibold">
                        Actualité
                      </span>
                    </div>
                    {current.private && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 backdrop-blur">
                        <Lock className="w-3.5 h-3.5 text-purple-300" />
                        <span className="text-[10px] uppercase tracking-widest text-purple-200 font-semibold">
                          Membres
                        </span>
                      </div>
                    )}
                    {actualiteImages(current).length > 1 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur">
                        <Images className="w-3.5 h-3.5 text-blue-300" />
                        <span className="text-[10px] uppercase tracking-widest text-blue-200 font-semibold">
                          {actualiteImages(current).length} photos
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-display text-2xl md:text-4xl text-white mb-2 tracking-wide">
                    {current.title}
                  </h3>
                  <p className="text-white/80 text-sm md:text-base max-w-2xl line-clamp-2">
                    {current.description}
                  </p>
                  <p className="text-xs text-white/50 mt-3 uppercase tracking-widest">
                    Cliquer pour voir le détail
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </button>

          {/* Flèche droite */}
          {n > 1 && (
            <button
              onClick={carouselNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/50 hover:bg-black/75 flex items-center justify-center text-white transition opacity-0 group-hover/carousel:opacity-100 shadow-lg"
              aria-label="Actualité suivante"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Indicateurs */}
          {n > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              {actualites.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-8 bg-amber-500" : "w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                  aria-label={`Actualité ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* MODAL DETAIL avec galerie */}
        <AnimatePresence>
          {modalIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1800] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
              onClick={closeModal}
            >
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition z-20"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>

              <motion.div
                key={actualites[modalIndex].id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-5xl w-full max-h-[92vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl shadow-2xl"
              >
                {/* Image principale + flèches galerie */}
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-3xl bg-black">
                  <AnimatePresence mode="wait">
                    {currentModalImages[galleryIndex] && (
                      <motion.img
                        key={`${actualites[modalIndex].id}-${galleryIndex}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        src={currentModalImages[galleryIndex].url}
                        alt={actualites[modalIndex].title}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </AnimatePresence>

                  {currentModalImages.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          galleryPrev();
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition"
                        aria-label="Image précédente"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          galleryNext();
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition"
                        aria-label="Image suivante"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur text-white text-xs font-semibold">
                        {galleryIndex + 1} / {currentModalImages.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Bande de miniatures */}
                {currentModalImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-slate-200 bg-slate-100">
                    {currentModalImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setGalleryIndex(i)}
                        className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition ${
                          i === galleryIndex
                            ? "border-amber-400 ring-2 ring-amber-400/30"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-6 md:p-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 mb-4">
                    <Newspaper className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-[10px] uppercase tracking-widest text-amber-600 font-semibold">
                      Actualité {modalIndex + 1} / {n}
                    </span>
                  </div>
                  <h3 className="font-display text-3xl md:text-4xl text-slate-800 mb-4 tracking-wide">
                    {actualites[modalIndex].title}
                  </h3>
                  <p className="text-slate-600 text-base md:text-lg whitespace-pre-wrap leading-relaxed">
                    {actualites[modalIndex].description}
                  </p>

                  {/* Navigation entre actualités */}
                  {n > 1 && (
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); modalPrev(); }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-sm font-medium transition"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Actu précédente
                      </button>
                      <span className="text-xs text-slate-400 font-medium">
                        {modalIndex + 1} / {n}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); modalNext(); }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 text-sm font-medium transition"
                      >
                        Actu suivante
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
