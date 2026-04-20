"use client";

import { motion } from "framer-motion";
import { Clock, MapPin, ArrowUpRight } from "lucide-react";

const SCHEDULE = [
  { day: "Lundi", time: "18h30 → Fermeture" },
  { day: "Jeudi", time: "18h30 → Fermeture" },
  { day: "Samedi", time: "17h30 → Fermeture" },
];

const PRICES = [
  { label: "Adulte", price: 50 },
  { label: "Étudiant", price: 30 },
];

export default function Horaires() {
  return (
    <section id="horaires" className="bg-section-wrap">
      <div className="section-pad">
        <header className="section-head">
          <div>
            <span className="section-index">03 — Pratique</span>
            <h2 className="h-title text-5xl md:text-7xl lg:text-8xl mt-4">
              Horaires <span className="font-editorial italic font-normal">&amp; tarifs.</span>
            </h2>
          </div>
          <p className="hidden md:block text-[color:var(--muted)] max-w-xs text-right text-sm leading-relaxed">
            Trois créneaux hebdomadaires, un gymnase, toutes les saisons.
          </p>
        </header>

        <div className="grid md:grid-cols-12 gap-0 md:gap-0 border-y border-[color:var(--line-strong)]">
          {/* Horaires */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-6 py-10 md:py-14 md:pr-12 md:border-r border-[color:var(--line)]"
          >
            <div className="flex items-center gap-3 mb-8">
              <Clock className="w-5 h-5 text-[color:var(--gold)]" />
              <span className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)] font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
                Créneaux
              </span>
            </div>

            <ul>
              {SCHEDULE.map((s, i) => (
                <motion.li
                  key={s.day}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="flex items-baseline justify-between gap-4 py-5 border-b border-[color:var(--line)] last:border-0 group"
                >
                  <span className="font-display text-3xl md:text-4xl tracking-tight text-[color:var(--ink)]">
                    {s.day}
                  </span>
                  <span
                    className="text-sm md:text-base text-[color:var(--ink)]/70 tabular-nums tracking-wider"
                    style={{ fontFamily: "Oswald, sans-serif" }}
                  >
                    {s.time}
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Tarifs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-6 py-10 md:py-14 md:pl-12"
          >
            <div className="flex items-center gap-3 mb-8">
              <span className="w-5 h-5 flex items-center justify-center text-[color:var(--gold)]">€</span>
              <span className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)] font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
                Cotisation annuelle
              </span>
            </div>

            <ul>
              {PRICES.map((p, i) => (
                <motion.li
                  key={p.label}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="flex items-baseline justify-between gap-4 py-5 border-b border-[color:var(--line)] last:border-0"
                >
                  <span className="font-display text-3xl md:text-4xl tracking-tight text-[color:var(--ink)]">
                    {p.label}
                  </span>
                  <span className="flex items-baseline gap-1">
                    <span className="font-display text-5xl md:text-6xl text-[color:var(--ink)] leading-none">
                      {p.price}
                    </span>
                    <span className="text-lg text-[color:var(--muted)]">€ / an</span>
                  </span>
                </motion.li>
              ))}
            </ul>

            <p className="mt-6 text-xs text-[color:var(--muted)] leading-relaxed">
              Paiement en ligne ou virement. Adhésion valable pour toute la saison sportive.
            </p>
          </motion.div>
        </div>

        {/* Address block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-20 grid md:grid-cols-12 gap-10 items-end"
        >
          <div className="md:col-span-7">
            <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)] font-semibold mb-4 flex items-center gap-3" style={{ fontFamily: "Oswald, sans-serif" }}>
              <MapPin className="w-4 h-4 text-[color:var(--gold)]" />
              Où nous trouver
            </p>
            <h3 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-[color:var(--ink)]">
              Salle <span className="font-editorial italic font-normal">Paul Vatine.</span>
            </h3>
            <p className="mt-4 text-lg text-[color:var(--ink)]/75 max-w-md leading-relaxed">
              30bis Rue Georges Boissaye du Bocage,<br />
              76310 Sainte-Adresse
            </p>
          </div>

          <div className="md:col-span-5 flex md:justify-end">
            <a
              href="https://maps.google.com/?q=Salle+Paul+Vatine+Sainte-Adresse"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost group inline-flex items-center gap-2"
            >
              <span>Ouvrir dans Maps</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
