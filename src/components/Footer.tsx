"use client";

import { Mail, Phone, User } from "lucide-react";

export default function Footer({ year }: { year: number }) {
  return (
    <footer id="contact" className="bg-black/60 backdrop-blur-xl border-t border-white/10 mt-20">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-3">Équipe</p>
          <h2 className="font-display text-5xl h-display">Contactez-nous</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <ContactCard
            role="Président"
            name="Hernan Camara"
            phone="07 77 06 18 75"
            email="hernancm68@hotmail.com"
          />
          <ContactCard
            role="Président adjoint"
            name="Matthieu Demare"
            phone="06 52 48 62 28"
            email="demare.matthieu@outlook.fr"
          />
        </div>

        <p className="text-center mt-16 text-xs text-white/40">
          © {year} SACCB — Sainte-Adresse · Salle Paul Vatine
        </p>
      </div>
    </footer>
  );
}

function ContactCard({
  role,
  name,
  phone,
  email,
}: {
  role: string;
  name: string;
  phone: string;
  email: string;
}) {
  return (
    <div className="glass p-7 hover:bg-white/[0.06] transition group">
      <p className="text-xs uppercase tracking-widest text-blue-400 font-bold mb-3">{role}</p>
      <div className="flex items-center gap-2 mb-3">
        <User className="w-5 h-5 text-white/50" />
        <span className="text-xl text-white font-semibold">{name}</span>
      </div>
      <a
        href={`tel:${phone.replace(/\s/g, "")}`}
        className="flex items-center gap-2 text-white/70 hover:text-white py-1 transition"
      >
        <Phone className="w-4 h-4" /> {phone}
      </a>
      <a
        href={`mailto:${email}`}
        className="flex items-center gap-2 text-white/60 hover:text-white py-1 text-sm transition break-all"
      >
        <Mail className="w-4 h-4 shrink-0" /> {email}
      </a>
    </div>
  );
}
