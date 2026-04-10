"use client";

import { motion } from "framer-motion";
import { ChevronDown, MapPin, Trophy } from "lucide-react";

export default function Hero({
  seasonY1,
  seasonY2,
  inscOpen,
}: {
  seasonY1: number;
  seasonY2: number;
  inscOpen: boolean;
}) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
      {/* Particules / orbes flottants */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md mb-8 ${
            inscOpen
              ? "bg-emerald-500/10 border-emerald-400/30"
              : "bg-red-500/10 border-red-400/30"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full animate-pulse ${
              inscOpen ? "bg-emerald-400" : "bg-red-400"
            }`}
          />
          <span className="text-xs uppercase tracking-widest text-white/80">
            Saison {seasonY1}–{seasonY2} {inscOpen ? "ouverte" : "fermée"}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-6xl md:text-8xl lg:text-9xl tracking-wider mb-6"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-200 to-emerald-300 drop-shadow-2xl">
            SACCB
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-lg md:text-2xl text-white/80 max-w-2xl mx-auto mb-3 font-light"
        >
          Le club de badminton de Sainte-Adresse
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-sm md:text-base text-white/50 max-w-xl mx-auto mb-12"
        >
          Esprit convivial, jeu pour tous les niveaux, et tournois tout au long de l&apos;année.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <a href="#inscription" className="btn-primary">
            <Trophy className="w-5 h-5" /> Adhérer au club
          </a>
          <a href="#tournois" className="btn-ghost">
            <MapPin className="w-5 h-5" /> Voir les tournois
          </a>
        </motion.div>

        <motion.a
          href="#presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="inline-block text-white/40 hover:text-white transition"
        >
          <ChevronDown className="w-8 h-8 animate-bounce mx-auto" />
        </motion.a>
      </div>
    </section>
  );
}
