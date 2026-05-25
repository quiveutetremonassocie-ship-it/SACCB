"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, UserCircle2, ShieldCheck } from "lucide-react";
import Shuttlecock from "./Shuttlecock";

export default function Navbar({
  onMember,
  isMember,
  isAdmin,
  onAdmin,
  onAdminLogin,
}: {
  onMember: () => void;
  isMember: boolean;
  isAdmin?: boolean;
  onAdmin?: () => void;
  onAdminLogin?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Liens : si href commence par "/" ou est une URL absolue → page dédiée (Next Link)
  // Si href commence par "#" → ancre sur la home (scroll). Sur les pages dédiées, on préfixe avec "/" pour revenir à la home.
  const allLinks = [
    { href: "/#presentation", label: "L'Asso" },
    { href: "/actualites", label: "Actus" },
    { href: "/#horaires", label: "Horaires" },
    { href: "/tournois", label: "Tournois" },
    { href: "/#palmares", label: "Palmarès" },
    { href: "/inscription", label: "Adhésion", hideIfMember: true },
    { href: "/#contact", label: "Contact" },
  ];
  // Le lien "Adhésion" est caché pour les membres connectés (ils sont déjà adhérents)
  const links = allLinks.filter((l) => !(l.hideIfMember && isMember));

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="relative w-12 h-12 rounded-xl bg-white shadow-lg shadow-slate-300/40 group-hover:scale-110 transition overflow-hidden border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo SACCB" className="w-full h-full object-contain" />
          </span>
          <span className="font-display text-2xl tracking-widest text-[#1e3a5f]">
            SACCB
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-xs font-semibold uppercase tracking-widest text-slate-600 hover:text-[#1e3a5f] transition relative group"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-[#1e3a5f] to-emerald-500 group-hover:w-full transition-all" />
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="btn-ghost !px-4 !py-2.5 !text-xs flex items-center gap-1.5 !border-amber-400 !text-amber-700 hover:!bg-amber-50"
            >
              <ShieldCheck className="w-4 h-4" />
              Admin
            </Link>
          )}
          {!isAdmin && isMember && (
            <Link
              href="/admin"
              className="text-slate-300 hover:text-amber-500 transition p-1"
              title="Accès admin"
            >
              <ShieldCheck className="w-4 h-4" />
            </Link>
          )}
          <button
            onClick={onMember}
            className={`btn-ghost !px-4 !py-2.5 !text-xs flex items-center gap-1.5 ${isMember ? "!border-emerald-400 !text-emerald-700" : ""}`}
          >
            <UserCircle2 className="w-4 h-4" />
            {isMember ? "Mon espace" : "Espace membre"}
          </button>
        </div>

        <button
          className="md:hidden text-[#1e3a5f] p-2"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200 px-6 py-4 space-y-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-slate-700 hover:text-[#1e3a5f] py-2 text-sm uppercase tracking-widest font-semibold"
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="btn-ghost w-full !border-amber-400 !text-amber-700"
            >
              <ShieldCheck className="w-4 h-4" />
              Panneau Admin
            </Link>
          )}
          {!isAdmin && isMember && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="btn-ghost w-full !border-slate-200 !text-slate-400"
            >
              <ShieldCheck className="w-4 h-4" />
              Connexion Admin
            </Link>
          )}
          <button
            onClick={() => { setOpen(false); onMember(); }}
            className={`btn-ghost w-full ${isMember ? "!border-emerald-400 !text-emerald-700" : ""}`}
          >
            <UserCircle2 className="w-4 h-4" />
            {isMember ? "Mon espace" : "Espace membre"}
          </button>
        </div>
      )}
    </nav>
  );
}
