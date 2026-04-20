"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Images, ArrowUpRight } from "lucide-react";
import { Actualite, actualiteImages } from "@/lib/types";

export default function Actualites({ actualites }: { actualites: Actualite[] }) {
  const [index, setIndex] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const n = actualites.length;

  useEffect(() => {
    if (n < 2 || paused || modalIndex !== null) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % n), 6500);
    return () => clearInterval(id);
  }, [n, paused, modalIndex]);

  useEffect(() => { if (index >= n && n > 0) setIndex(0); }, [index, n]);

  const openModal = useCallback((i: number) => { setModalIndex(i); setGalleryIndex(0); }, []);
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
  const imageCount = actualiteImages(current).length;

  return (
    <section id="actualites" className="bg-section-wrap">
      <div className="section-pad">
        <header className="section-head">
          <div>
            <span className="section-index">02 — Journal</span>
            <h2 className="h-title text-5xl md:text-7xl lg:text-8xl mt-4">
              Actualités <span className="font-editorial italic font-normal">du club</span>
            </h2>
          </div>
          <p className="hidden md:block text-[color:var(--muted)] max-w-sm text-right text-sm leading-relaxed">
            Les moments forts, événements et nouvelles de la saison.
          </p>
        </header>

        <div
          className="grid md:grid-cols-12 gap-8 md:gap-12"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Featured slide */}
          <div className="md:col-span-8">
            <button
              onClick={() => openModal(index)}
              className="group block w-full text-left"
              aria-label={`Lire l'actualité : ${current.title}`}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[color:var(--bone-2)]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    {currentMain && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentMain.url}
                        alt={current.title}
                        className="w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {imageCount > 1 && (
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[color:var(--bone)]/95 text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink)] font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
                    <Images className="w-3 h-3" />
                    {imageCount}
                  </span>
                )}
              </div>

              <div className="mt-6 flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--gold)] font-semibold mb-3" style={{ fontFamily: "Oswald, sans-serif" }}>
                    Édition {String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
                  </p>
                  <h3 className="font-display text-4xl md:text-5xl tracking-tight text-[color:var(--ink)] leading-[0.95]">
                    {current.title}
                  </h3>
                  <p className="text-[color:var(--ink)]/75 mt-3 line-clamp-2 max-w-2xl leading-relaxed">
                    {current.description}
                  </p>
                </div>
                <span className="shrink-0 w-12 h-12 border border-[color:var(--ink)] flex items-center justify-center text-[color:var(--ink)] group-hover:bg-[color:var(--ink)] group-hover:text-[color:var(--bone)] transition-colors duration-500">
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:rotate-45 duration-500" />
                </span>
              </div>
            </button>

            {n > 1 && (
              <div className="mt-8 flex items-center gap-3">
                {actualites.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setIndex(i)}
                    aria-label={`Voir l'actualité ${i + 1}`}
                    className="group py-2"
                  >
                    <span
                      className={`block h-[2px] transition-all duration-500 ${
                        i === index ? "w-16 bg-[color:var(--ink)]" : "w-8 bg-[color:var(--line-strong)] group-hover:bg-[color:var(--ink)]/60"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Side list of other news */}
          <aside className="md:col-span-4 md:border-l md:border-[color:var(--line)] md:pl-8">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)] font-semibold mb-5" style={{ fontFamily: "Oswald, sans-serif" }}>
              Au sommaire
            </p>
            <ul className="divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {actualites.map((a, i) => (
                <li key={a.id}>
                  <button
                    onClick={() => { setIndex(i); openModal(i); }}
                    className={`w-full text-left py-4 flex items-start gap-4 transition-colors group ${
                      i === index ? "opacity-100" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className="text-[10px] tracking-[0.28em] text-[color:var(--muted)] font-semibold pt-1" style={{ fontFamily: "Oswald, sans-serif" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-display text-xl tracking-tight text-[color:var(--ink)] leading-tight truncate">
                        {a.title}
                      </span>
                      <span className="block text-sm text-[color:var(--muted)] line-clamp-1 mt-1">
                        {a.description}
                      </span>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[color:var(--muted)] shrink-0 mt-1.5 transition-transform group-hover:rotate-45" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {/* MODAL */}
        <AnimatePresence>
          {modalIndex !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1800] bg-[color:var(--ink)]/95 backdrop-blur-md flex items-center justify-center p-4"
              onClick={closeModal}
            >
              <button
                onClick={closeModal}
                className="absolute top-6 right-6 w-11 h-11 border border-[color:var(--bone)]/30 flex items-center justify-center text-[color:var(--bone)] hover:bg-[color:var(--bone)] hover:text-[color:var(--ink)] transition-colors z-20"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>

              <motion.article
                key={actualites[modalIndex].id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-5xl w-full max-h-[92vh] overflow-y-auto bg-[color:var(--bone)]"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
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
                        onClick={(e) => { e.stopPropagation(); galleryPrev(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-[color:var(--bone)]/95 hover:bg-[color:var(--bone)] text-[color:var(--ink)] flex items-center justify-center transition-colors"
                        aria-label="Image précédente"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); galleryNext(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-[color:var(--bone)]/95 hover:bg-[color:var(--bone)] text-[color:var(--ink)] flex items-center justify-center transition-colors"
                        aria-label="Image suivante"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute top-4 right-4 px-3 py-1.5 bg-[color:var(--bone)]/95 text-[10px] uppercase tracking-[0.22em] font-semibold text-[color:var(--ink)]" style={{ fontFamily: "Oswald, sans-serif" }}>
                        {galleryIndex + 1} / {currentModalImages.length}
                      </div>
                    </>
                  )}
                </div>

                {currentModalImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto px-6 py-4 border-b border-[color:var(--line)]">
                    {currentModalImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setGalleryIndex(i)}
                        className={`shrink-0 w-20 h-14 overflow-hidden transition-all ${
                          i === galleryIndex ? "ring-2 ring-[color:var(--ink)] ring-offset-2 ring-offset-[color:var(--bone)]" : "opacity-60 hover:opacity-100"
                        }`}
                        aria-label={`Aller à l'image ${i + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-8 md:p-12 max-w-3xl">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--gold)] font-semibold mb-4" style={{ fontFamily: "Oswald, sans-serif" }}>
                    Actualité {modalIndex + 1} / {n}
                  </p>
                  <h3 className="font-display text-4xl md:text-6xl tracking-tight text-[color:var(--ink)] leading-[0.95] mb-6">
                    {actualites[modalIndex].title}
                  </h3>
                  <p className="text-[color:var(--ink)]/80 text-lg whitespace-pre-wrap leading-relaxed">
                    {actualites[modalIndex].description}
                  </p>
                </div>
              </motion.article>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
