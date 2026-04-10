"use client";

import { motion } from "framer-motion";

export default function Presentation() {
  return (
    <section id="presentation" className="section-pad">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <p className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-3">
          Le club
        </p>
        <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Qui sommes-nous ?</h2>
        <p className="text-white/60 max-w-2xl mx-auto">
          Le SACCB est le club de badminton de Sainte-Adresse. Un esprit convivial, du jeu pour tous
          les niveaux, et une équipe accueillante.
        </p>
      </motion.div>
    </section>
  );
}
