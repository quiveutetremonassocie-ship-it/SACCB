"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Ne s'affiche qu'une fois par session
    if (sessionStorage.getItem("saccb_splash_done")) return;
    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
      sessionStorage.setItem("saccb_splash_done", "1");
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-[#1e3a5f] via-[#0f2440] to-[#1e3a5f]"
        >
          {/* Orbes lumineux */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/3 right-1/4 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
          </div>

          <div className="relative flex flex-col items-center gap-6">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl flex items-center justify-center overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="SACCB" className="w-20 h-20 object-contain" />
            </motion.div>

            {/* Texte SACCB */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
              className="text-center"
            >
              <h1
                className="font-display text-5xl md:text-6xl tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-emerald-300"
              >
                SACCB
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.7 }}
                className="text-xs uppercase tracking-[0.35em] text-white/50 mt-2"
                style={{ fontFamily: "Oswald, sans-serif" }}
              >
                Badminton &middot; Sainte-Adresse
              </motion.p>
            </motion.div>

            {/* Barre de chargement */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden mt-4"
            >
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
                className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full"
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
