"use client";

import { motion } from "framer-motion";
import { Users2, Heart, Flame } from "lucide-react";

const VALUES = [
  {
    icon: Heart,
    title: "Convivial",
    text: "Un club avant tout humain, où chaque adhérent trouve sa place.",
  },
  {
    icon: Users2,
    title: "Tous niveaux",
    text: "Des débutants aux compétiteurs, le jeu se partage sans barrière.",
  },
  {
    icon: Flame,
    title: "Compétitif",
    text: "Tournois internes, rencontres et défis tout au long de la saison.",
  },
];

export default function Presentation() {
  return (
    <section id="presentation" className="bg-section-wrap">
      <div className="section-pad">
        <header className="section-head">
          <div>
            <span className="section-index">01 — Le club</span>
            <h2 className="h-title text-5xl md:text-7xl lg:text-8xl mt-4 max-w-3xl">
              Un club de quartier<br />
              <span className="font-editorial italic font-normal">à l&apos;esprit grand.</span>
            </h2>
          </div>
        </header>

        <div className="grid md:grid-cols-12 gap-10 md:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-5"
          >
            <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)] font-semibold mb-5" style={{ fontFamily: "Oswald, sans-serif" }}>
              Notre histoire
            </p>
            <p className="text-lg md:text-xl leading-relaxed text-[color:var(--ink)]/85">
              Le <strong className="font-semibold">SACCB</strong> fait vivre le badminton à{" "}
              <em className="font-editorial italic text-[color:var(--gold)]">Sainte-Adresse</em>{" "}
              depuis plus de quinze saisons. Un club à taille humaine, installé à la Salle Paul Vatine, qui réunit étudiants, familles et compétiteurs autour du volant.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-7"
          >
            <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)] font-semibold mb-5" style={{ fontFamily: "Oswald, sans-serif" }}>
              Ce qui nous anime
            </p>
            <ul className="divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {VALUES.map((v, i) => (
                <motion.li
                  key={v.title}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="py-6 flex items-start gap-6 group"
                >
                  <span className="text-[10px] tracking-[0.28em] text-[color:var(--muted)] font-semibold pt-1 w-8 shrink-0" style={{ fontFamily: "Oswald, sans-serif" }}>
                    0{i + 1}
                  </span>
                  <v.icon className="w-5 h-5 text-[color:var(--gold)] mt-1 shrink-0 transition-transform duration-500 group-hover:rotate-12" />
                  <div className="flex-1">
                    <h3 className="font-display text-2xl md:text-3xl tracking-tight text-[color:var(--ink)]">
                      {v.title}
                    </h3>
                    <p className="text-[color:var(--ink)]/70 mt-1 leading-relaxed">
                      {v.text}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
