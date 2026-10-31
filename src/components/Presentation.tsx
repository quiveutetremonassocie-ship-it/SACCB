"use client";

import { motion } from "framer-motion";
import { Heart, Users2, Trophy, Smile } from "lucide-react";

const POINTS = [
  { icone: Smile, couleur: "from-amber-400 to-orange-500", titre: "Convivialité", texte: "On vient pour jouer, rire et partager un bon moment entre amis." },
  { icone: Users2, couleur: "from-sky-500 to-blue-600", titre: "Tous niveaux", texte: "Débutant ou confirmé, chacun trouve sa place et ses partenaires." },
  { icone: Trophy, couleur: "from-emerald-500 to-teal-600", titre: "Des tournois", texte: "Tournois du club et entre clubs tout au long de l'année." },
  { icone: Heart, couleur: "from-rose-400 to-pink-500", titre: "Une équipe", texte: "Un bureau de bénévoles qui fait vivre l'association." },
];

export default function Presentation() {
  return (
    <section id="presentation" className="bg-section-wrap relative">
      <div className="section-pad grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center lg:text-left"
        >
          <div className="sport-label mb-4">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-emerald-700">L&apos;association</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl h-display mb-4">Qui sommes-nous ?</h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            Le <span className="text-[#1e3a5f] font-semibold">SACCB</span> est l&apos;une des associations de badminton de
            Sainte-Adresse. Un esprit convivial, du jeu pour tous les niveaux et une équipe accueillante qui vit au rythme
            du volant depuis plusieurs saisons.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4">
          {POINTS.map((p, i) => {
            const Icone = p.icone;
            return (
              <motion.div
                key={p.titre}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
              >
                <span className={`inline-flex w-10 h-10 rounded-xl bg-gradient-to-br ${p.couleur} text-white items-center justify-center mb-3`}>
                  <Icone className="w-5 h-5" />
                </span>
                <p className="font-bold text-slate-800">{p.titre}</p>
                <p className="text-sm text-slate-500">{p.texte}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
