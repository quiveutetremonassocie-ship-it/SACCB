"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, UserCircle2, ShieldCheck } from "lucide-react";

export default function Navbar({
  onMember,
  isMember,
  isAdmin,
  rubriques = {},
}: {
  onMember: () => void;
  isMember: boolean;
  isAdmin?: boolean;
  onAdmin?: () => void;
  onAdminLogin?: () => void;
  // Rubriques désactivées dans l'admin (false) : leur lien disparaît du menu
  rubriques?: Partial<Record<"presentation" | "actualites" | "horaires" | "tournois" | "palmares" | "inscription" | "agenda", boolean>>;
}) {
  const [open, setOpen] = useState(false);

  // Liens : « /… » = page dédiée ; « /#… » = rubrique de la page d'accueil
  const allLinks: { href: string; label: string; hideIfMember?: boolean; rubrique?: keyof typeof rubriques }[] = [
    { href: "/#presentation", label: "L'asso", rubrique: "presentation" },
    { href: "/actualites", label: "Actualités", rubrique: "actualites" },
    { href: "/#agenda", label: "Agenda", rubrique: "agenda" },
    { href: "/#horaires", label: "Horaires", rubrique: "horaires" },
    { href: "/tournois", label: "Tournois", rubrique: "tournois" },
    { href: "/#palmares", label: "Palmarès", rubrique: "palmares" },
    { href: "/inscription", label: "Adhésion", hideIfMember: true, rubrique: "inscription" },
    { href: "/faq", label: "Aide" },
    { href: "/contact", label: "Contact" },
  ];
  // Le lien "Adhésion" est caché pour les membres connectés (ils sont déjà adhérents)
  const links = allLinks.filter((l) => !(l.hideIfMember && isMember) && !(l.rubrique && rubriques[l.rubrique] === false));

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white border-b border-[#D3DEE6]" aria-label="Menu principal">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[80px] flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="SACCB, retour à l'accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SACCB, Badminton Sainte-Adresse" width={64} height={64} className="w-16 h-16 object-contain" />
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 min-h-[48px] inline-flex items-center rounded-lg font-bold text-[0.95rem] text-[#0F1B26] hover:bg-[#F2F6F9] hover:text-[#007DB0] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin" className="btn-ghost !px-4">
              <ShieldCheck className="w-4 h-4" />
              Admin
            </Link>
          )}
          {!isAdmin && isMember && (
            <Link href="/admin" className="text-slate-400 hover:text-[#0F1B26] p-3 rounded-lg" title="Accès admin" aria-label="Accès admin">
              <ShieldCheck className="w-5 h-5" />
            </Link>
          )}
          <button onClick={onMember} className="btn-primary !px-5">
            <UserCircle2 className="w-5 h-5" />
            {isMember ? "Mon espace" : "Espace membre"}
          </button>
        </div>

        <button
          className="lg:hidden text-[#0F1B26] p-3 rounded-lg hover:bg-[#F2F6F9]"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
        >
          {open ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-white border-t border-[#D3DEE6] px-4 py-3 max-h-[calc(100vh-80px)] overflow-y-auto">
          <div className="grid">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3 min-h-[52px] flex items-center text-lg font-bold text-[#0F1B26] border-b border-[#EEF3F7] last:border-0"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="grid gap-2 pt-3">
            <button onClick={() => { setOpen(false); onMember(); }} className="btn-primary w-full !text-base">
              <UserCircle2 className="w-5 h-5" />
              {isMember ? "Mon espace" : "Espace membre"}
            </button>
            {(isAdmin || isMember) && (
              <Link href="/admin" onClick={() => setOpen(false)} className="btn-ghost w-full">
                <ShieldCheck className="w-4 h-4" />
                {isAdmin ? "Panneau admin" : "Connexion admin"}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
