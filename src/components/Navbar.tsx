"use client";

import { useEffect, useState } from "react";
import { Menu, X, Shield } from "lucide-react";

export default function Navbar({ onAdmin }: { onAdmin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#presentation", label: "L'Asso" },
    { href: "#tournois", label: "Tournois" },
    { href: "#inscription", label: "Adhésion" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-bgdark/85 backdrop-blur-xl border-b border-white/10 py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 group">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition">
            <span className="text-white font-display text-lg">S</span>
          </span>
          <span className="font-display text-2xl tracking-widest text-white">SACCB</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white transition relative group"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-emerald-400 group-hover:w-full transition-all" />
            </a>
          ))}
          <button onClick={onAdmin} className="btn-primary !px-5 !py-2.5">
            <Shield className="w-4 h-4" /> Admin
          </button>
        </div>

        <button
          className="md:hidden text-white p-2"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-bgdark/95 backdrop-blur-xl border-t border-white/10 px-6 py-4 space-y-3">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block text-white/80 hover:text-white py-2 text-sm uppercase tracking-widest font-semibold"
            >
              {l.label}
            </a>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              onAdmin();
            }}
            className="btn-primary w-full"
          >
            <Shield className="w-4 h-4" /> Admin
          </button>
        </div>
      )}
    </nav>
  );
}
