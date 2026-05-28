"use client";

import { MapPin, Mail, Clock, MessageCircle, ExternalLink, Phone } from "lucide-react";
import ContactForm from "./ContactForm";

export default function ContactSection({ whatsappLink }: { whatsappLink?: string | null }) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <p className="text-xs uppercase tracking-widest text-emerald-600 font-semibold mb-3">Contact</p>
        <h1 className="font-display text-5xl md:text-6xl h-display text-[#1e3a5f] mb-4">Contactez-nous</h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Une question sur l&apos;association, les entra&icirc;nements ou l&apos;adh&eacute;sion ? &Eacute;crivez-nous, on vous r&eacute;pond rapidement.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Infos pratiques */}
        <div className="space-y-4">
          <InfoCard
            icon={<MapPin className="w-5 h-5 text-emerald-600" />}
            title="Ou nous trouver"
            lines={["Salle Paul Vatine", "Sainte-Adresse (76310)", "Normandie"]}
          />
          <InfoCard
            icon={<Mail className="w-5 h-5 text-blue-600" />}
            title="Email"
            lines={["contact@saccb.fr"]}
          />
          <InfoCard
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            title="Creneaux"
            lines={["Plusieurs creneaux par semaine", "Voir la page Horaires"]}
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
                <p className="text-xs text-slate-500">Rejoignez la communaute SACCB</p>
              </div>
            </a>
          )}

          {/* Carte Google Maps */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="aspect-[4/3] w-full bg-slate-100 relative">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2594.5!2d0.0833!3d49.5083!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sSainte-Adresse!5e0!3m2!1sfr!2sfr!4v1"
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localisation SACCB - Salle Paul Vatine, Sainte-Adresse"
              />
            </div>
            <a
              href="https://www.google.com/maps/search/Salle+Paul+Vatine+Sainte-Adresse"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-semibold py-3 hover:bg-blue-50 transition"
            >
              <ExternalLink className="w-4 h-4" />
              Ouvrir dans Google Maps
            </a>
          </div>
        </div>

        {/* Formulaire */}
        <div className="space-y-4">
          <ContactForm theme="light" />
          {/* Info complementaire */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-2">Vous souhaitez nous rejoindre ?</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              L&apos;inscription se fait directement en ligne. Rendez-vous sur la page d&apos;adhesion pour remplir le formulaire et choisir votre mode de paiement.
            </p>
            <a
              href="/inscription"
              className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm"
            >
              S&apos;inscrire en ligne
            </a>
          </div>
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
