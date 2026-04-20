"use client";

import { useEffect, useState } from "react";
import { Menu, X, UserCircle2, ShieldCheck, MapPin } from "lucide-react";
import Shuttlecock from "./Shuttlecock";

type Props = {
  onMember: () => void;
  isMember: boolean;
  isAdmin?: boolean;
  onAdmin?: () => void;
};

const LINKS = [
  { href: "#presentation", label: "Le club", num: "01" },
  { href: "#actualites", label: "Actualités", num: "02" },
  { href: "#horaires", label: "Horaires", num: "03" },
  { href: "#tournois", label: "Tournois", num: "04" },
  { href: "#palmares", label: "Palmarès", num: "05" },
  { href: "#inscription", label: "Adhésion", num: "06" },
  { href: "#contact", label: "Contact", num: "07" },
];

export default function Navbar({
  onMember,
  isMember,
  isAdmin,
  onAdmin,
}: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[color:var(--bone)]/92 backdrop-blur-md border-b border-[color:var(--line)]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 md:h-20 flex items-center justify-between gap-6">
          <a
            href="#"
            className="flex items-center gap-3 group"
            aria-label="SACCB — Accueil"
          >
            <span className="relative w-9 h-9 flex items-center justify-center border border-[color:var(--ink)] group-hover:bg-[color:var(--ink)] transition-colors duration-500">
              <Shuttlecock
                className="w-5 h-5 transition-colors duration-500 text-[color:var(--ink)] group-hover:text-[color:var(--bone)]"
                color="currentColor"
              />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-2xl tracking-[0.15em] text-[color:var(--ink)]">
                SACCB
              </span>
              <span
                className="text-[9px] tracking-[0.3em] uppercase text-[color:var(--muted)] font-semibold mt-0.5"
                style={{ fontFamily: "Oswald, sans-serif" }}
              >
                Sainte-Adresse
              </span>
            </span>
          </a>

          <nav
            aria-label="Navigation principale"
            className="hidden lg:flex items-center gap-8"
          >
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="group relative flex items-center gap-2 text-xs uppercase font-semibold text-[color:var(--ink)] transition-opacity hover:opacity-100 opacity-75"
                style={{
                  fontFamily: "Oswald, sans-serif",
                  letterSpacing: "0.18em",
                }}
              >
                {/* <span className="text-[9px] text-[color:var(--muted)] group-hover:text-[color:var(--gold)] transition-colors">
                  {l.num}
                </span> */}
                <span>{l.label}</span>
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAdmin && onAdmin && (
              <button
                onClick={onAdmin}
                className="inline-flex items-center gap-2 px-4 py-2 border border-[color:var(--gold)] text-[color:var(--gold)] text-[11px] uppercase font-semibold hover:bg-[color:var(--gold)] hover:text-white transition-colors"
                style={{
                  fontFamily: "Oswald, sans-serif",
                  letterSpacing: "0.2em",
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin
              </button>
            )}
            <button
              onClick={onMember}
              className={`inline-flex items-center gap-2 px-4 py-2 border text-[11px] uppercase font-semibold transition-colors ${
                isMember
                  ? "border-[color:var(--forest)] text-[color:var(--forest)] hover:bg-[color:var(--forest)] hover:text-white"
                  : "border-[color:var(--ink)] text-[color:var(--ink)] hover:bg-[color:var(--ink)] hover:text-[color:var(--bone)]"
              }`}
              style={{
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.2em",
              }}
            >
              <UserCircle2 className="w-3.5 h-3.5" />
              {isMember ? "Mon espace" : "Connexion"}
            </button>
          </div>

          <button
            className="lg:hidden p-2 -mr-2 text-[color:var(--ink)]"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile overlay menu */}
      <div
        className={`fixed inset-0 z-40 bg-[color:var(--bone)] transition-all duration-500 lg:hidden ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="h-full flex flex-col pt-24 pb-10 px-6 md:px-10 overflow-y-auto">
          <nav
            aria-label="Navigation mobile"
            className="flex-1 flex flex-col justify-center"
          >
            <ul className="space-y-3">
              {LINKS.map((l, i) => (
                <li
                  key={l.href}
                  className="border-b border-[color:var(--line)]"
                  style={{
                    animation: open
                      ? `fadeUp 0.6s ${i * 0.04 + 0.1}s both cubic-bezier(0.22,1,0.36,1)`
                      : "none",
                  }}
                >
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-baseline justify-between py-5 group"
                  >
                    <span className="flex items-baseline gap-4">
                      <span
                        className="text-[10px] tracking-[0.3em] text-[color:var(--muted)] font-semibold"
                        style={{ fontFamily: "Oswald, sans-serif" }}
                      >
                        {l.num}
                      </span>
                      <span className="font-display text-3xl tracking-tight text-[color:var(--ink)] group-hover:text-[color:var(--gold)] transition-colors">
                        {l.label}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="pt-8 flex flex-col gap-3">
            {isAdmin && onAdmin && (
              <button
                onClick={() => {
                  setOpen(false);
                  onAdmin();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-[color:var(--gold)] text-[color:var(--gold)] text-[11px] uppercase font-semibold hover:bg-[color:var(--gold)] hover:text-white transition-colors"
                style={{
                  fontFamily: "Oswald, sans-serif",
                  letterSpacing: "0.22em",
                }}
              >
                <ShieldCheck className="w-4 h-4" />
                Panneau admin
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                onMember();
              }}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 border text-[11px] uppercase font-semibold transition-colors ${
                isMember
                  ? "border-[color:var(--forest)] text-[color:var(--forest)] hover:bg-[color:var(--forest)] hover:text-white"
                  : "border-[color:var(--ink)] text-[color:var(--ink)] hover:bg-[color:var(--ink)] hover:text-[color:var(--bone)]"
              }`}
              style={{
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.22em",
              }}
            >
              <UserCircle2 className="w-4 h-4" />
              {isMember ? "Mon espace" : "Espace membre"}
            </button>

            <div
              className="mt-6 flex items-center gap-2 text-[11px] uppercase text-[color:var(--muted)]"
              style={{
                fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.22em",
              }}
            >
              <MapPin className="w-3.5 h-3.5" />
              Salle Paul Vatine — Sainte-Adresse
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
