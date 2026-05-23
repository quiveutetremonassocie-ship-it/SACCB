"use client";

import { motion } from "framer-motion";
import Shuttlecock from "./Shuttlecock";

export default function Presentation() {
  return (
    <section id="presentation" className="bg-section-wrap bg-schedule relative">
      <div className="section-pad relative">
        {/* Décor shuttlecocks */}
        <Shuttlecock
          className="absolute top-10 -left-4 w-24 h-24 text-blue-200/30 animate-float-rev hidden md:block"
          color="#93c5fd"
        />
        <Shuttlecock
          className="absolute bottom-10 -right-4 w-28 h-28 text-emerald-200/30 animate-float hidden md:block"
          color="#6ee7b7"
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto relative"
        >
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-emerald-600">Le club</span>
          </div>
          <h2 className="font-display text-6xl md:text-7xl h-display mb-6">Qui sommes-nous ?</h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            Le <span className="text-[#1e3a5f] font-semibold">SACCB</span> est le club de badminton
            du <span className="text-[#1e3a5f] font-semibold">Havre</span>, basé à{" "}
            <span className="text-[#1e3a5f] font-semibold">Sainte-Adresse</span> à la salle Paul Vatine.
            Un esprit convivial, du jeu pour tous les niveaux et une équipe accueillante qui vit
            au rythme du volant depuis plusieurs saisons.
          </p>
          <p className="text-slate-500 text-sm leading-relaxed mt-4 max-w-2xl mx-auto">
            Située en plein cœur de l&apos;agglomération havraise, notre association loi 1901
            accueille adultes et étudiants de tout niveau, du loisir à la compétition.
            Tournois doubles toute la saison, créneaux libres, ambiance sportive et conviviale.
            Que tu habites Le Havre, Sainte-Adresse, Octeville-sur-Mer ou Montivilliers,
            rejoins-nous !
          </p>

          {/* Séparateur "court" */}
          <div className="flex items-center justify-center gap-4 mt-10">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-yellow-400/50" />
            <Shuttlecock className="w-6 h-6 text-amber-500" color="#f59e0b" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-yellow-400/50" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
