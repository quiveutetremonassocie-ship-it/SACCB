"use client";

import { MapPin, Mail, Clock, MessageCircle } from "lucide-react";
import ContactForm from "./ContactForm";

export default function ContactSection({ whatsappLink }: { whatsappLink?: string | null }) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-widest text-emerald-600 font-semibold mb-3">Contact</p>
        <h1 className="font-display text-5xl md:text-6xl h-display text-[#1e3a5f] mb-4">Contactez-nous</h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Une question sur l&apos;association, les entraînements ou l&apos;adhésion ? Écrivez-nous, on vous répond rapidement.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Infos pratiques */}
        <div className="space-y-4">
          <InfoCard
            icon={<MapPin className="w-5 h-5 text-emerald-600" />}
            title="Où nous trouver"
            lines={["Salle Paul Vatine", "Sainte-Adresse (76310)", "Normandie"]}
          />
          <InfoCard
            icon={<Mail className="w-5 h-5 text-blue-600" />}
            title="Email"
            lines={["contact@saccb.fr"]}
          />
          <InfoCard
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            title="Créneaux"
            lines={["Plusieurs créneaux par semaine", "Voir la page Horaires"]}
          />
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-4 hover:bg-green-100 transition"
            >
              <MessageCircle className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Groupe WhatsApp</p>
                <p className="text-xs text-slate-500">Rejoignez la communauté SACCB</p>
              </div>
            </a>
          )}
        </div>

        {/* Formulaire */}
        <div>
          <ContactForm theme="light" />
        </div>
      </div>
    </section>
  );
}

function InfoCard({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div className="flex items-start gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="font-semibold text-slate-800 text-sm mb-0.5">{title}</p>
        {lines.map((l, i) => (
          <p key={i} className="text-sm text-slate-500">{l}</p>
        ))}
      </div>
    </div>
  );
}
