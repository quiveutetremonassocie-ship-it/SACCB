"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, MapPin, ArrowDown } from "lucide-react";
import Shuttlecock from "./Shuttlecock";

type Props = {
  seasonY1: number;
  seasonY2: number;
  inscOpen: boolean;
};

export default function Hero({ seasonY1, seasonY2, inscOpen }: Props) {
  return (
    <section className="relative min-h-[100svh] overflow-hidden pt-6 md:pt-24">
      {/* Subtle decorative shuttlecock, very discreet */}
      <Shuttlecock
        className="absolute top-[22%] right-[8%] w-20 h-20 text-[color:var(--ink)]/10 animate-float hidden md:block"
        color="currentColor"
      />

      {/* Meta rail — top-left */}
      <div
        className="absolute top-24 md:top-28 left-6 md:left-10 z-10 hidden md:flex items-center gap-3 text-[10px] uppercase text-[color:var(--ink)]/70"
        style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.3em" }}
      >
        <span className="w-6 h-px bg-[color:var(--ink)]/40" />
        <span>EST. 2008</span>
        <span className="w-px h-3 bg-[color:var(--ink)]/30" />
        <span>Badminton Club</span>
      </div>

      {/* Meta rail — top-right */}
      <div
        className="absolute top-24 md:top-28 right-6 md:right-10 z-10 hidden md:flex items-center gap-3 text-[10px] uppercase text-[color:var(--ink)]/70"
        style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.3em" }}
      >
        <span>Salle Paul Vatine · 76310</span>
        <span className="w-6 h-px bg-[color:var(--ink)]/40" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-24 md:pt-40 pb-24">
        <div className="grid md:grid-cols-12 gap-10 items-end">
          <div className="md:col-span-8">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col md:items-center md:gap-3 text-[11px] uppercase mb-8"
              style={{
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.32em",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${
                    inscOpen
                      ? "bg-[color:var(--forest)]"
                      : "bg-[color:var(--danger)]"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-[color:var(--ink)]/80 font-semibold">
                  Saison {seasonY1}–{seasonY2}
                </span>
              </div>
              <span className="w-px h-3 bg-[color:var(--ink)]/25" />
              <span
                className={`font-semibold ${inscOpen ? "text-[color:var(--forest)]" : "text-[color:var(--danger)]"}`}
              >
                {inscOpen ? "Adhésions ouvertes" : "Adhésions closes"}
              </span>
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.9,
                delay: 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="font-display text-[12vw] md:text-[10rem] lg:text-[12rem] leading-[0.82] tracking-[-0.02em] text-[color:var(--ink)]"
            >
              Sainte<span className="text-[color:var(--gold)]">·</span>Adresse
              <span className="block mt-2 md:mt-4 font-editorial italic font-normal text-[10vw] md:text-[8rem] lg:text-[10rem] text-[color:var(--ink)]/90">
                badminton.
              </span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="mt-10 grid md:grid-cols-12 gap-8 max-w-5xl"
            >
              <p className="md:col-span-7 text-lg md:text-xl text-[color:var(--ink)]/80 leading-relaxed max-w-xl">
                Club convivial de la côte normande. Trois créneaux par semaine à
                la Salle Paul Vatine, des tournois toute l&apos;année, tous
                niveaux bienvenus.
              </p>

              <div className="md:col-span-5 flex flex-col gap-3">
                <a
                  href="#inscription"
                  className="btn-primary group inline-flex justify-between w-full"
                >
                  <span>Rejoindre le club</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </a>
                <a
                  href="#presentation"
                  className="btn-ghost group inline-flex justify-between w-full"
                >
                  <span>Découvrir</span>
                  <ArrowDown className="w-4 h-4 transition-transform group-hover:translate-y-1" />
                </a>
              </div>
            </motion.div>
          </div>

          {/* Right rail with address */}
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.6 }}
            className="md:col-span-4 hidden md:block"
            aria-label="Adresse du club"
          >
            <div className="pl-8 border-l border-[color:var(--line-strong)]">
              <p
                className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--muted)] font-semibold mb-3"
                style={{ fontFamily: "Oswald, sans-serif" }}
              >
                Gymnase
              </p>
              <p className="font-editorial italic text-2xl text-[color:var(--ink)] leading-snug">
                Salle Paul Vatine
              </p>
              <p className="text-sm text-[color:var(--muted)] mt-2">
                30bis Rue Georges Boissaye
                <br />
                du Bocage, 76310 Sainte-Adresse
              </p>
              <a
                href="https://maps.google.com/?q=Salle+Paul+Vatine+Sainte-Adresse"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-xs uppercase font-semibold text-[color:var(--ink)] link-reveal"
                style={{
                  fontFamily: "Oswald, sans-serif",
                  letterSpacing: "0.22em",
                }}
              >
                <MapPin className="w-3.5 h-3.5" />
                Itinéraire
              </a>
            </div>
          </motion.aside>
        </div>

        {/* Bottom stat strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 md:mt-28 pt-8 border-t border-[color:var(--line-strong)] grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12"
        >
          <StatItem num="65" label="Adhérents" />
          <StatItem num="03" label="Créneaux / sem." />
          <StatItem num="17" label="Années d'existence" />
        </motion.div>
      </div>
    </section>
  );
}

function StatItem({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-display text-5xl md:text-7xl leading-none text-[color:var(--ink)] tracking-tight">
        {num}
      </span>
      <span
        className="text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)] font-semibold"
        style={{ fontFamily: "Oswald, sans-serif" }}
      >
        {label}
      </span>
    </div>
  );
}
