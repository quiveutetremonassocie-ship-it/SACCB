"use client";

import { motion } from "framer-motion";
import { Clock, Wallet, MapPin } from "lucide-react";

export default function Horaires() {
  return (
    <section id="horaires" className="section-pad">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-14"
      >
        <p className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-3">
          Infos pratiques
        </p>
        <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Horaires & Tarifs</h2>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card icon={<Clock className="w-6 h-6" />} title="Horaires" accent="from-blue-500 to-cyan-500">
          <p className="text-white/80">
            <span className="text-white font-semibold">Lundi & Jeudi</span> — 18h30 → Fermeture
          </p>
          <p className="text-white/80 mt-2">
            <span className="text-white font-semibold">Samedi</span> — 17h30 → Fermeture
          </p>
        </Card>

        <Card icon={<Wallet className="w-6 h-6" />} title="Tarifs annuels" accent="from-emerald-500 to-teal-500">
          <div className="flex items-center justify-between py-2 border-b border-white/5">
            <span className="text-white/70">Adulte</span>
            <span className="text-2xl font-display text-white">50€</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-white/70">Étudiant</span>
            <span className="text-2xl font-display text-white">30€</span>
          </div>
        </Card>
      </div>

      <Card icon={<MapPin className="w-6 h-6" />} title="Où nous trouver" accent="from-purple-500 to-pink-500">
        <p className="text-white/80">Salle Paul Vatine</p>
        <p className="text-white/60 text-sm">30bis Rue Georges Boissaye du Bocage, 76310 Sainte-Adresse</p>
      </Card>
    </section>
  );
}

function Card({
  icon,
  title,
  children,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass p-7 hover:bg-white/[0.06] transition group"
    >
      <div className="flex items-center gap-4 mb-4">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition`}
        >
          {icon}
        </div>
        <h3 className="font-display text-2xl tracking-wider text-white">{title}</h3>
      </div>
      <div>{children}</div>
    </motion.div>
  );
}
