"use client";

import { ScheduleSlot } from "@/lib/types";

/** 📍 La salle et les tarifs (horaires, tarifs et adresse réglés dans l'admin → Paramètres saison) */
export default function Horaires({
  horaires,
  prixAdulte = 50,
  prixEtudiant = 30,
  salleName = "Salle Paul Vatine",
  salleAdresse = "30bis Rue Georges Boissaye du Bocage, 76310 Sainte-Adresse",
}: {
  horaires?: ScheduleSlot[];
  prixAdulte?: number;
  prixEtudiant?: number;
  salleName?: string;
  salleAdresse?: string;
}) {
  const slots = horaires && horaires.length > 0
    ? horaires
    : [
        { jour: "Lundi", heure: "18h30 → Fermeture" },
        { jour: "Jeudi", heure: "18h30 → Fermeture" },
        { jour: "Samedi", heure: "17h30 → Fermeture" },
      ];
  const plan = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([salleName, salleAdresse].filter(Boolean).join(", "))}`;

  return (
    <section id="horaires" className="bg-white border-y border-[#D3DEE6] scroll-mt-20" aria-labelledby="titre-salle">
      <div className="max-w-6xl mx-auto px-5 py-16 grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/photos/salle-paul-vatine.webp"
          alt={`${salleName} vue de la rue`}
          width={974}
          height={599}
          loading="lazy"
          className="w-full aspect-[16/10] object-cover rounded-md"
        />
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 id="titre-salle" className="font-display text-4xl md:text-5xl text-[#0F1B26] leading-[0.95]">{salleName}</h2>
            <address className="not-italic text-lg text-slate-700">{salleAdresse}</address>
            <a href={plan} target="_blank" rel="noopener noreferrer" className="font-bold text-[#007DB0] underline underline-offset-4 min-h-[48px] inline-flex items-center">
              Voir l&apos;itinéraire
            </a>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-2">Horaires</h3>
            <ul className="border-t-2 border-[#0F1B26]">
              {slots.map((s, i) => (
                <li key={i} className="flex justify-between gap-4 py-2.5 border-b border-[#D3DEE6]">
                  <span className="font-bold">{s.jour}</span>
                  <span className="text-slate-700 tabular-nums">{s.heure}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-2">Adhésion pour la saison</h3>
            <div className="grid grid-cols-2 gap-4">
              <p><span className="block font-display text-6xl text-[#007DB0] leading-none tabular-nums">{prixAdulte} €</span><span className="text-slate-700">adulte</span></p>
              <p><span className="block font-display text-6xl text-[#007DB0] leading-none tabular-nums">{prixEtudiant} €</span><span className="text-slate-700">étudiant, sur justificatif</span></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
