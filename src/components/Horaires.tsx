"use client";

import { motion } from "framer-motion";
import { Clock, Wallet, MapPin } from "lucide-react";
import Shuttlecock from "./Shuttlecock";

export default function Horaires() {
  return (
    <section id="horaires" className="bg-section-wrap bg-schedule relative">
      <div className="section-pad relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 relative"
        >
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-blue-300">Infos pratiques</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Horaires & Tarifs</h2>
          <p className="text-white/60 max-w-xl mx-auto">
            Trois créneaux par semaine, pour tous les niveaux.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card
            icon={<Clock className="w-6 h-6" />}
            title="Horaires"
            accent="from-blue-500 to-cyan-500"
          >
            <div className="space-y-3">
              <ScheduleRow days="Lundi" time="18h30 → Fermeture" />
              <ScheduleRow days="Jeudi" time="18h30 → Fermeture" />
              <ScheduleRow days="Samedi" time="17h30 → Fermeture" />
            </div>
          </Card>

          <Card
            icon={<Wallet className="w-6 h-6" />}
            title="Tarifs annuels"
            accent="from-emerald-500 to-teal-500"
          >
            <PriceRow label="Adulte" price="50" />
            <PriceRow label="Étudiant" price="30" last />
          </Card>
        </div>

        <Card
          icon={<MapPin className="w-6 h-6" />}
          title="Où nous trouver"
          accent="from-purple-500 to-pink-500"
        >
          <p className="text-white text-lg font-semibold">Salle Paul Vatine</p>
          <p className="text-white/60 text-sm mt-1">
            30bis Rue Georges Boissaye du Bocage, 76310 Sainte-Adresse
          </p>
        </Card>
      </div>
    </section>
  );
}

function ScheduleRow({ days, time }: { days: string; time: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span
        className="text-white font-bold text-sm uppercase tracking-widest"
        style={{ fontFamily: "Oswald, sans-serif" }}
      >
        {days}
      </span>
      <span className="text-white/70 text-sm">{time}</span>
    </div>
  );
}

function PriceRow({ label, price, last }: { label: string; price: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-3 ${
        last ? "" : "border-b border-white/5"
      }`}
    >
      <span
        className="text-white/80 uppercase tracking-widest text-sm"
        style={{ fontFamily: "Oswald, sans-serif" }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-4xl text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
          {price}
        </span>
        <span className="text-lg text-white/50">€</span>
      </div>
    </div>
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
      className="glass-sport p-7 hover:bg-white/[0.06] transition group relative"
    >
      <Shuttlecock
        className="absolute -top-2 -right-2 w-16 h-16 opacity-[0.04] group-hover:opacity-10 transition"
        color="white"
      />
      <div className="flex items-center gap-4 mb-5 relative">
        <div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${accent} flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:rotate-3 transition`}
        >
          {icon}
        </div>
        <h3
          className="font-display text-2xl tracking-widest text-white uppercase"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {title}
        </h3>
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  );
}
