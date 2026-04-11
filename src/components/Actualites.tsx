"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Newspaper, Images } from "lucide-react";
import { Actualite, actualiteImages } from "@/lib/types";

export default function Actualites({ actualites }: { actualites: Actualite[] }) {
  const [index, setIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const n = actualites.length;

  // Auto-rotation toutes les 5 secondes
  useEffect(() => {
    if (n < 2 || paused || modalIndex !== null) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, 5000);
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
            <span className="sport-label-text text-amber-300">En ce moment</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Actualités</h2>
          <p className="text-white/60 max-w-2xl mx-auto">
            Retrouvez ici les dernières nouvelles du club, événements et moments forts.
          </p>
        </motion.div>

        <div
          className="relative max-w-4xl mx-auto"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <button
            onClick={() => openModal(index)}
            className="relative block w-full aspect-[16/9] rounded-3xl overflow-hidden group shadow-2xl shadow-black/60 border border-white/10"
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute left-0 right-0 bottom-0 p-6 md:p-10 text-left">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 backdrop-blur">
                      <Newspaper className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-[10px] uppercase tracking-widest text-amber-200 font-semibold">
                        Actualité
                      </span>
                    </div>
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

          {/* Indicateurs */}
          {n > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              {actualites.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-8 bg-amber-400" : "w-2 bg-white/20 hover:bg-white/40"
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
              className="fixed inset-0 z-[1800] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
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
                className="max-w-5xl w-full max-h-[92vh] overflow-y-auto bg-bgdark border border-white/10 rounded-3xl shadow-2xl"
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
                  <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/5 bg-black/40">
                    {currentModalImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setGalleryIndex(i)}
                        className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition ${
                          i === galleryIndex
                            ? "border-amber-400 ring-2 ring-amber-400/30"
                            : "border-white/10 hover:border-white/30"
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
                    <span className="text-[10px] uppercase tracking-widest text-amber-200 font-semibold">
                      Actualité {modalIndex + 1} / {n}
                    </span>
                  </div>
                  <h3 className="font-display text-3xl md:text-4xl text-white mb-4 tracking-wide">
                    {actualites[modalIndex].title}
                  </h3>
                  <p className="text-white/80 text-base md:text-lg whitespace-pre-wrap leading-relaxed">
                    {actualites[modalIndex].description}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
