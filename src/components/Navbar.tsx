"use client";

import { useEffect, useState } from "react";
import { Menu, X, UserCircle2, ShieldCheck } from "lucide-react";
import Shuttlecock from "./Shuttlecock";

export default function Navbar({
  onMember,
  isMember,
  isAdmin,
  onAdmin,
}: {
  onMember: () => void;
  isMember: boolean;
  isAdmin?: boolean;
  onAdmin?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#presentation", label: "L'Asso" },
    { href: "#actualites", label: "Actus" },
    { href: "#horaires", label: "Horaires" },
    { href: "#tournois", label: "Tournois" },
    { href: "#palmares", label: "Palmarès" },
    { href: "#inscription", label: "Adhésion" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 group">
          <span className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center shadow-lg shadow-[#1e3a5f]/40 group-hover:scale-110 group-hover:rotate-3 transition">
            <Shuttlecock className="w-6 h-6 text-white" color="white" />
          </span>
          <span className="font-display text-2xl tracking-widest text-[#1e3a5f]">
            SACCB
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-xs font-semibold uppercase tracking-widest text-slate-600 hover:text-[#1e3a5f] transition relative group"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-[#1e3a5f] to-emerald-500 group-hover:w-full transition-all" />
            </a>
          ))}
          {isAdmin && onAdmin && (
            <button
              onClick={onAdmin}
              className="btn-ghost !px-4 !py-2.5 !text-xs flex items-center gap-1.5 !border-amber-400 !text-amber-700 hover:!bg-amber-50"
            >
              <ShieldCheck className="w-4 h-4" />
              Admin
            </button>
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
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-slate-700 hover:text-[#1e3a5f] py-2 text-sm uppercase tracking-widest font-semibold"
            >
              {l.label}
            </a>
          ))}
          {isAdmin && onAdmin && (
            <button
              onClick={() => { setOpen(false); onAdmin(); }}
              className="btn-ghost w-full !border-amber-400 !text-amber-700"
            >
              <ShieldCheck className="w-4 h-4" />
              Panneau Admin
            </button>
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
