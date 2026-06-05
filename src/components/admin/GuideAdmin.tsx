"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Zap, Bell, Clock, Shield, Mail as MailIcon, Database } from "lucide-react";

export default function GuideAdmin() {
  const [autoOpen, setAutoOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [practicesOpen, setPracticesOpen] = useState(false);

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-display text-xl tracking-wider text-slate-800">Guide admin</h3>
          <p className="text-xs text-slate-500">Tout ce que tu dois savoir pour gérer le site sans rien casser</p>
        </div>
      </div>

      {/* ⚡ Automatismes du site */}
      <Section
        title="⚡ Ce qui se fait tout seul"
        subtitle="Tu n'as RIEN à faire pour ces actions, elles tournent en automatique"
        icon={<Zap className="w-4 h-4 text-amber-500" />}
        open={autoOpen}
        onToggle={() => setAutoOpen(!autoOpen)}
        accent="amber"
      >
        <div className="space-y-3 text-sm">
          <AutoItem
            icon={<MailIcon className="w-4 h-4 text-emerald-600" />}
            title="📧 Email de bienvenue"
            desc="Envoyé automatiquement à chaque nouvel adhérent après son paiement (en ligne ou validation virement). Il contient son code d'accès personnel et la présentation du site."
          />
          <AutoItem
            icon={<MailIcon className="w-4 h-4 text-emerald-600" />}
            title="✅ Email de confirmation de paiement"
            desc="Envoyé automatiquement quand un paiement HelloAsso aboutit OU quand un admin valide un virement (bouton « Marquer payé » sur la fiche adhérent)."
          />
          <AutoItem
            icon={<Bell className="w-4 h-4 text-rose-600" />}
            title="🚨 Rappels de cotisation J-30 / J-15 / J-5 / J-1"
            desc="Envoyés automatiquement aux adhérents NON PAYÉS quand la date limite d'inscription approche (configurée dans Paramètres saison). À J-5 et J-1, le mail passe en rouge urgent."
          />
          <AutoItem
            icon={<Clock className="w-4 h-4 text-blue-600" />}
            title="🗓️ Suppression auto des non-payés après la date limite"
            desc="Si la date de fermeture des inscriptions est dépassée, les comptes non-payés sont supprimés automatiquement. Configurable dans Paramètres saison."
          />
          <AutoItem
            icon={<MailIcon className="w-4 h-4 text-blue-600" />}
            title="📨 Email contact-form"
            desc="Quand un visiteur envoie un message via la page Contact, il reçoit une confirmation automatique. Toi tu vois le message dans la section « Messages reçus »."
          />
          <AutoItem
            icon={<Bell className="w-4 h-4 text-violet-600" />}
            title="🗳️ Notification de nouveau sondage / nouvelle annonce AG"
            desc="Quand tu crées un nouveau sondage ou un nouveau compte-rendu, un mail est automatiquement envoyé à tous les adhérents qui ont activé la newsletter."
          />
          <AutoItem
            icon={<Database className="w-4 h-4 text-slate-600" />}
            title="🔄 Auto-refresh des données admin"
            desc="Le panneau admin se rafraîchit tout seul toutes les 60 secondes. Pas besoin de cliquer « Recharger » sauf si tu veux forcer une mise à jour immédiate."
          />
          <AutoItem
            icon={<Shield className="w-4 h-4 text-red-600" />}
            title="🔒 Verrouillage compte après 5 mauvais essais"
            desc="Si quelqu'un rate son mot de passe 5 fois en 15 min, son compte est bloqué 30 min automatiquement. Tu peux débloquer manuellement depuis Paramètres saison → Comptes bloqués."
          />
          <AutoItem
            icon={<Shield className="w-4 h-4 text-red-600" />}
            title="🔐 2FA toutes les 14 jours"
            desc="Les admins doivent re-confirmer un code 2FA reçu par email tous les 14 jours. Entre temps, seul le mot de passe est demandé pour entrer dans l'admin."
          />
        </div>
      </Section>

      {/* 🎯 Raccourcis utiles */}
      <Section
        title="🎯 Raccourcis utiles"
        subtitle="Pour aller plus vite au quotidien"
        icon={<Zap className="w-4 h-4 text-blue-500" />}
        open={shortcutsOpen}
        onToggle={() => setShortcutsOpen(!shortcutsOpen)}
        accent="blue"
      >
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2"><kbd className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-xs shrink-0">Ctrl+K</kbd><span>Recherche globale (membres, factures, inscriptions tournois, messages, emails)</span></li>
          <li className="flex items-start gap-2"><kbd className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-xs shrink-0">Ctrl+Shift+A</kbd><span>Ouvrir le login admin Supabase (legacy)</span></li>
          <li className="flex items-start gap-2"><kbd className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-xs shrink-0">Échap</kbd><span>Fermer une modale ouverte</span></li>
          <li className="flex items-start gap-2 mt-3 pt-3 border-t border-slate-200"><span className="text-base">✉️</span><span>Sur un message reçu (page Messages), cliquer sur l&apos;enveloppe ouvre directement le formulaire d&apos;envoi d&apos;email pré-rempli avec le destinataire et le sujet « Re: »</span></li>
          <li className="flex items-start gap-2"><span className="text-base">🔍</span><span>Tous les boutons de la barre du haut (Membres, Comptes, Tournois...) défilent vers la section concernée</span></li>
          <li className="flex items-start gap-2"><span className="text-base">📥</span><span>Export CSV disponible sur : Membres, T-shirts (commandes), Inscriptions tournois</span></li>
        </ul>
      </Section>

      {/* ✅ Bonnes pratiques */}
      <Section
        title="✅ Bonnes pratiques"
        subtitle="Pour éviter les erreurs"
        icon={<Shield className="w-4 h-4 text-emerald-500" />}
        open={practicesOpen}
        onToggle={() => setPracticesOpen(!practicesOpen)}
        accent="emerald"
      >
        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
          <li><strong>Ne jamais</strong> envoyer un mail manuel pour la bienvenue ou le paiement confirmé : c&apos;est déjà automatique.</li>
          <li><strong>Ne jamais</strong> envoyer un mail manuel de rappel de cotisation J-30/15/5/1 : c&apos;est automatique aussi.</li>
          <li>Avant d&apos;envoyer un mail à <strong>tous les adhérents</strong>, vérifier 2 fois la cible dans le sélecteur (Tous / Payés / Non-payés / Newsletter / Sélection).</li>
          <li>Quand on rouvre temporairement les inscriptions (pour un retardataire), cocher <strong>« Pas de rappels J-X »</strong> sinon les autres adhérents reçoivent à nouveau les rappels.</li>
          <li>Avant de marquer un adhérent « Payé » manuellement (virement), bien vérifier la trace bancaire — l&apos;email de confirmation part automatiquement.</li>
          <li>Sauvegarder régulièrement la base avec le bouton <strong>« Export JSON »</strong> en haut. La sauvegarde quotidienne sur le PC tourne déjà, mais une copie supplémentaire avant une grosse opération c&apos;est mieux.</li>
          <li>Ne PAS supprimer un adhérent qui a peut-être déjà payé : marquer plutôt comme « Non actif » ou le déplacer en archive.</li>
          <li>Les comptes admin doivent absolument avoir un email valide auquel ils ont accès — sinon ils ne peuvent plus se connecter (à cause du 2FA tous les 14 jours).</li>
        </ul>
      </Section>

      {/* 💡 Renvoi vers les Notes admin existantes */}
      <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-900">
          💡 <strong>Tu as une astuce à partager avec les autres admins ?</strong>
        </p>
        <p className="text-xs text-indigo-700 mt-1">
          Utilise les <strong>Notes admin</strong> (section dédiée plus haut) pour laisser un message daté et signé qui restera visible pour tous les admins.
        </p>
      </div>
    </div>
  );
}

function Section({
  title, subtitle, icon, open, onToggle, accent, children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  accent: "amber" | "blue" | "emerald";
  children: React.ReactNode;
}) {
  const colors = {
    amber: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    blue: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    emerald: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
  }[accent];
  return (
    <div className="mb-3">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between border rounded-xl px-4 py-3 transition ${colors}`}
      >
        <div className="flex items-center gap-3 text-left">
          {icon}
          <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="mt-2 bg-white border border-slate-200 rounded-xl p-4">
          {children}
        </div>
      )}
    </div>
  );
}

function AutoItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 mb-0.5">{title}</p>
        <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
