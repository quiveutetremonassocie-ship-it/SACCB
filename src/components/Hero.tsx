"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, MapPin, Trophy, Users2, Calendar, Megaphone, Newspaper, Clock, Mail, Award } from "lucide-react";
import Shuttlecock from "./Shuttlecock";

function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started || target === 0) return;
    const steps = 50;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [started, target, duration]);

  return { count, ref };
}

export default function Hero({
  seasonY1,
  seasonY2,
  inscOpen,
  isMember = false,
  engagementOpen = false,
  membresCount = 0,
  creneauxCount = 3,
  foundedYear = 2022,
}: {
  seasonY1: number;
  seasonY2: number;
  inscOpen: boolean;
  isMember?: boolean;
  engagementOpen?: boolean; // true si au moins un des 2 toggles (pollsOpen ou agOpen) est activé
  membresCount?: number;
  creneauxCount?: number;
  foundedYear?: number;
}) {
  const anneesExistence = new Date().getFullYear() - foundedYear;

  // Parallax : l'image bouge plus lentement que le scroll
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    function onScroll() { setScrollY(window.scrollY); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      {/* Image badminton avec overlay clair + parallaxe */}
      <div className="absolute inset-0 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/salle.png"
          alt="Salle Paul Vatine — Sainte-Adresse"
          className="w-full h-[120%] object-cover opacity-60 will-change-transform"
          style={{ transform: `translateY(${scrollY * -0.2}px)` }}
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

      {/* 🎯 H1 SEO (visuellement masqué mais lu par Google + lecteurs d'écran) */}
      <h1 className="sr-only">
        Badminton Sainte-Adresse — SACCB, l&apos;association de badminton de Sainte-Adresse
      </h1>

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
            Association de Badminton · Sainte-Adresse
          </span>
          <span className="h-px w-12 bg-gradient-to-l from-transparent to-amber-400/50" />
        </motion.div>

        {/* TITRE (h2 car le vrai h1 SEO est masqué au-dessus) */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="font-display text-7xl md:text-[10rem] lg:text-[12rem] leading-[0.85] tracking-wider mb-6"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8e] to-emerald-600">
            SACCB
          </span>
        </motion.h2>

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

        {/* CTA principal (1 seul gros bouton selon contexte) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-6"
        >
          {/* Adhérer à l'association : visible uniquement si inscriptions ouvertes ET visiteur non connecté */}
          {inscOpen && !isMember && (
            <a href="/inscription" className="btn-sport">
              <Trophy className="w-5 h-5" /> Adhérer à l&apos;association
            </a>
          )}
          {/* Sondages & AG : visible uniquement si membre connecté ET section engagement activée */}
          {isMember && engagementOpen && (
            <a
              href="#engagement"
              className="btn-sport !bg-gradient-to-r !from-purple-600 !to-amber-500"
              style={{ animation: "pulse 2s ease-in-out infinite" }}
            >
              <Megaphone className="w-5 h-5" /> Sondages & AG
            </a>
          )}
        </motion.div>

        {/* Menu rapide (raccourcis vers les sections principales) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 max-w-2xl mx-auto mb-16"
        >
          <a href="/actualites" className="quick-link group">
            <Newspaper className="w-4 h-4 text-amber-500 group-hover:scale-110 transition" />
            <span>Actus</span>
          </a>
          <a href="/tournois" className="quick-link group">
            <MapPin className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition" />
            <span>Tournois</span>
          </a>
          <a href="/#horaires" className="quick-link group">
            <Clock className="w-4 h-4 text-blue-500 group-hover:scale-110 transition" />
            <span>Horaires</span>
          </a>
          <a href="/#palmares" className="quick-link group">
            <Award className="w-4 h-4 text-yellow-600 group-hover:scale-110 transition" />
            <span>Palmarès</span>
          </a>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="grid grid-cols-3 gap-3 md:gap-5 max-w-2xl mx-auto"
        >
          <AnimatedStatCard icon={<Users2 className="w-4 h-4" />} target={membresCount} label="Adhérents" />
          <AnimatedStatCard icon={<Calendar className="w-4 h-4" />} target={creneauxCount} label="Créneaux / sem." />
          <AnimatedStatCard icon={<Trophy className="w-4 h-4" />} target={anneesExistence} suffix=" ans" label="D'existence" />
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

function AnimatedStatCard({
  icon,
  target,
  suffix = "",
  label,
}: {
  icon: React.ReactNode;
  target: number;
  suffix?: string;
  label: string;
}) {
  const { count, ref } = useCountUp(target);
  return (
    <div className="stat-box text-left" ref={ref}>
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
        {target > 0 ? `${count}${suffix}` : "—"}
      </div>
    </div>
  );
}
