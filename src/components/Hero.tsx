"use client";

import { motion } from "framer-motion";
import { ChevronDown, MapPin, Trophy, Flame, Users2, Calendar } from "lucide-react";
import Shuttlecock from "./Shuttlecock";

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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      {/* Image badminton avec overlay clair */}
      <div className="absolute inset-0 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/salle.png"
          alt="Salle Paul Vatine — Sainte-Adresse"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/55 to-[#f8fafc]" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-transparent to-white/60" />
      </div>

      {/* Orbes lumineux */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-yellow-200/15 rounded-full blur-3xl animate-pulse-glow"
        />
      </div>

      {/* Volants flottants en décor */}
      <Shuttlecock
        className="absolute top-[18%] left-[8%] w-16 h-16 text-[#1e3a5f]/20 animate-float"
        color="#1e3a5f"
      />
      <Shuttlecock
        className="absolute bottom-[22%] right-[10%] w-20 h-20 text-amber-500/30 animate-float-rev"
        color="#f59e0b"
      />
      <Shuttlecock
        className="absolute top-[30%] right-[18%] w-10 h-10 text-blue-600/20 animate-float"
        color="#2563eb"
      />

      {/* CONTENU */}
      <div className="relative max-w-5xl mx-auto px-6 text-center z-10">
        {/* Badge saison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md mb-8 ${
            inscOpen
              ? "bg-emerald-50 border-emerald-300"
              : "bg-red-50 border-red-300"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full animate-pulse ${
              inscOpen ? "bg-emerald-400" : "bg-red-400"
            }`}
          />
          <span
            className={`text-[10px] uppercase tracking-[0.25em] font-bold ${
              inscOpen ? "text-emerald-700" : "text-red-700"
            }`}
            style={{ fontFamily: "Oswald, sans-serif" }}
          >
            Saison {seasonY1}–{seasonY2} · {inscOpen ? "Ouverte" : "Fermée"}
          </span>
        </motion.div>

        {/* Label sport */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="flex items-center justify-center gap-3 mb-4"
        >
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-amber-400/50" />
          <span
            className="text-[11px] uppercase tracking-[0.35em] text-amber-600 font-bold"
            style={{ fontFamily: "Oswald, sans-serif" }}
          >
            Club de Badminton · Sainte-Adresse
          </span>
          <span className="h-px w-12 bg-gradient-to-l from-transparent to-amber-400/50" />
        </motion.div>

        {/* TITRE */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="font-display text-7xl md:text-[10rem] lg:text-[12rem] leading-[0.85] tracking-wider mb-6"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8e] to-emerald-600">
            SACCB
          </span>
        </motion.h1>

        {/* Baseline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-xl md:text-3xl text-[#1e3a5f] font-light max-w-2xl mx-auto mb-2"
          style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em" }}
        >
          SMASH · PASSION · CONVIVIALITÉ
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-sm md:text-base text-slate-500 max-w-xl mx-auto mb-12"
        >
          Esprit convivial, jeu pour tous les niveaux et tournois tout au long de l&apos;année.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <a href="#inscription" className="btn-sport">
            <Trophy className="w-5 h-5" /> Adhérer au club
          </a>
          <a href="#tournois" className="btn-ghost">
            <MapPin className="w-5 h-5" /> Voir les tournois
          </a>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="grid grid-cols-3 gap-3 md:gap-6 max-w-3xl mx-auto"
        >
          <StatCard icon={<Users2 className="w-4 h-4" />} value="65" label="Adhérents" />
          <StatCard icon={<Calendar className="w-4 h-4" />} value="3" label="Créneaux / sem." />
          <StatCard icon={<Flame className="w-4 h-4" />} value="∞" label="Smashs" />
        </motion.div>

        <motion.a
          href="#presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="inline-block mt-16 text-slate-400 hover:text-slate-600 transition"
        >
          <ChevronDown className="w-8 h-8 animate-bounce mx-auto" />
        </motion.a>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="stat-box text-left">
      <div className="flex items-center gap-2 text-amber-500 mb-1">
        {icon}
        <span
          className="text-[9px] uppercase tracking-[0.2em] font-bold text-slate-500"
          style={{ fontFamily: "Oswald, sans-serif" }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-4xl md:text-5xl font-display text-transparent bg-clip-text bg-gradient-to-b from-[#1e3a5f] to-[#2d5a8e]"
      >
        {value}
      </div>
    </div>
  );
}
