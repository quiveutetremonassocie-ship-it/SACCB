"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Zap, Bell, Clock, Shield, Mail as MailIcon, Database, Compass, Trophy, Sparkles, Camera, Eye } from "lucide-react";

export default function GuideAdmin() {
  const [ouvert, setOuvert] = useState<string | null>("nouveautes");
  const basculer = (id: string) => setOuvert((o) => (o === id ? null : id));

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

      {/* 🆕 Nouveautés */}
      <Section
        title="🆕 Les nouveautés"
        subtitle="Ce qui a changé récemment dans l'admin et sur le site"
        icon={<Sparkles className="w-4 h-4 text-violet-500" />}
        open={ouvert === "nouveautes"}
        onToggle={() => basculer("nouveautes")}
        accent="violet"
      >
        <div className="space-y-3 text-sm">
          <AutoItem icon={<Compass className="w-4 h-4 text-indigo-600" />} title="🧭 Nouvelle admin : un menu, une page à la fois"
            desc="Le menu à gauche (ou ☰ sur téléphone) range tout par thème : Adhérents, Tournois, Communication, Trésorerie, Réglages. On voit une seule page à la fois et l'admin se rouvre sur la dernière page utilisée." />
          <AutoItem icon={<Sparkles className="w-4 h-4 text-amber-600" />} title="🏠 Tableau de bord"
            desc="La page d'accueil de l'admin résume l'essentiel (adhérents payés, trésorerie, messages, prochain tournoi) et liste automatiquement ce qu'il reste « À faire » : messages sans réponse, adhérents non payés, justificatifs étudiants manquants, inscriptions mises de côté, t-shirts non payés… Un clic sur une ligne ouvre la bonne page." />
          <AutoItem icon={<Trophy className="w-4 h-4 text-emerald-600" />} title="🏆 Tournois inter-clubs avec jour J en direct"
            desc="Lien + code par club, inscriptions en ligne, programme de la journée prévu à l'avance, poules générées automatiquement, scores saisis par les clubs, écran géant pour la salle, classement final et podium. Voir la section « Tournois inter-clubs » ci-dessous." />
          <AutoItem icon={<Camera className="w-4 h-4 text-rose-600" />} title="📸 Qui est sur les photos"
            desc="Dans Actualités, le bouton « 👥 Qui ? » sous chaque photo permet de cocher les adhérents présents. Ceux qui n'ont pas donné leur accord pour apparaître sur le site sont signalés en rouge." />
          <AutoItem icon={<Eye className="w-4 h-4 text-slate-600" />} title="🕵️ Journal des actions (propriétaire du site uniquement)"
            desc="Toutes les modifications faites dans l'admin (adhérents, factures, tournois, réglages, droits admin…), les connexions admin et les sauvegardes téléchargées sont notées avec la date et l'auteur. Visible seulement par le propriétaire du site." />
          <AutoItem icon={<MailIcon className="w-4 h-4 text-blue-600" />} title="✉️ Mails : le site demande avant d'envoyer"
            desc="Quand une action peut envoyer un mail aux adhérents (ouverture des t-shirts, confirmation de paiement…), une question te demande si tu veux l'envoyer ou non." />
        </div>
      </Section>

      {/* 🏆 Tournois inter-clubs */}
      <Section
        title="🏆 Tournois inter-clubs, pas à pas"
        subtitle="De la création du tournoi au podium"
        icon={<Trophy className="w-4 h-4 text-emerald-500" />}
        open={ouvert === "interclubs"}
        onToggle={() => basculer("interclubs")}
        accent="emerald"
      >
        <ol className="space-y-3 text-sm text-slate-700 list-decimal list-inside">
          <li><strong>Créer le tournoi</strong> (Tournois → Tournois inter-clubs → « Nouveau tournoi inter-clubs ») : nom, type (obligatoire), date, date limite d&apos;inscription, niveaux, salle et photo (reprises du tournoi précédent), déroulement (modèle à compléter).</li>
          <li><strong>Préparer le programme de la journée</strong> : les tours prévus (Brassage, 2ᵉ tour, Finale…), le nombre de poules et le format de chaque tour. Le site affiche le nombre de matchs par équipe. Le règlement du tournoi s&apos;écrit tout seul à partir de ce programme.</li>
          <li><strong>Ajouter les clubs invités</strong> : nom, nombre maximum de binômes, contact. Chaque club reçoit un <strong>lien + un code d&apos;accès</strong>. Bouton « Message » pour copier le texte à envoyer, et « 🖨 QR codes à imprimer » pour les fiches papier.</li>
          <li><strong>Les clubs inscrivent leurs binômes</strong> sur leur page jusqu&apos;à la date limite (fermeture automatique à minuit le jour limite).</li>
          <li><strong>Le jour J</strong> : bouton rouge « 🏁 Jour J » → « Générer les poules » (niveaux mélangés, clubs séparés), vérifier, puis « C&apos;est parti ». Les inscriptions se ferment automatiquement.</li>
          <li><strong>Pendant les matchs</strong> : les clubs entrent leurs scores, l&apos;équipe adverse confirme ou corrige ; si la 1ʳᵉ équipe conteste la correction, un bandeau rouge « ❓ score contesté » te demande d&apos;aller au terrain. Tu peux saisir, corriger, effacer, déclarer un forfait ou retirer une équipe qui arrête. Chaque match a son 🕘 historique.</li>
          <li><strong>Tour suivant</strong> : quand tous les matchs sont joués, le bouton vert « Lancer « 2ᵉ tour » » apparaît, réglages déjà prêts. Pareil pour la finale, puis « Terminer le tournoi » → podium.</li>
          <li><strong>Écran géant</strong> : lien dans la table de marque, à ouvrir sur la télé (F11 pour le plein écran). Tout tient sur un écran, mis à jour toutes les 5 secondes.</li>
          <li><strong>Après</strong> : « 📄 Classement en PDF » pour imprimer ou envoyer le classement final.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">💡 Pour t&apos;entraîner : bouton « 🧪 Tournoi de démonstration » (20 équipes fictives, 4 clubs), à supprimer ensuite.</p>
      </Section>

      {/* ⚡ Automatismes du site */}
      <Section
        title="⚡ Ce qui se fait tout seul"
        subtitle="Tu n'as RIEN à faire pour ces actions, elles tournent en automatique"
        icon={<Zap className="w-4 h-4 text-amber-500" />}
        open={ouvert === "auto"}
        onToggle={() => basculer("auto")}
        accent="amber"
      >
        <div className="space-y-3 text-sm">
          <AutoItem icon={<MailIcon className="w-4 h-4 text-blue-600" />} title="📝 Email de confirmation d'inscription"
            desc="Envoyé automatiquement dès qu'une personne s'inscrit sur le site (avant paiement). Elle reçoit la confirmation que son inscription est bien enregistrée + les explications pour payer (HelloAsso ou virement)." />
          <AutoItem icon={<MailIcon className="w-4 h-4 text-emerald-600" />} title="📧 Email de bienvenue"
            desc="Envoyé automatiquement à chaque nouvel adhérent après son paiement (en ligne ou validation virement). Il contient son code d'accès personnel et la présentation du site. Les PDF marqués « 📎 Joindre » dans Documents officiels sont aussi attachés." />
          <AutoItem icon={<MailIcon className="w-4 h-4 text-emerald-600" />} title="✅ Email de confirmation de paiement"
            desc="Envoyé quand un paiement HelloAsso aboutit OU quand un admin valide un virement (bouton « Marquer payé »). Les PDF marqués « 📎 Joindre » sont aussi attachés." />
          <AutoItem icon={<MailIcon className="w-4 h-4 text-amber-600" />} title="👕 T-shirt payé sur HelloAsso"
            desc="Quand un adhérent paie son t-shirt sur la campagne HelloAsso, sa commande passe toute seule en « payée » et il reçoit un mail de confirmation. L'argent des t-shirts ne compte pas dans la comptabilité des adhésions." />
          <AutoItem icon={<Bell className="w-4 h-4 text-rose-600" />} title="🚨 Rappels de cotisation J-30 / J-15 / J-5 / J-1"
            desc="Envoyés aux adhérents NON PAYÉS quand la date limite d'inscription approche (Paramètres saison). Exclus : ceux qui ont coché « Je ne souhaite pas reconduire » dans leur espace membre." />
          <AutoItem icon={<Bell className="w-4 h-4 text-amber-600" />} title="🏆 Rappels tournois J-30 / J-15 / J-5 / J-1"
            desc="Envoyés aux adhérents payés (news activées) quand la date limite d'un tournoi approche. Les tournois Dames / Hommes ne sont envoyés qu'aux filles / garçons (d'où l'intérêt de remplir fille/garçon sur chaque fiche). Exclus : déjà inscrits et « Pas intéressé(e) »." />
          <AutoItem icon={<Clock className="w-4 h-4 text-blue-600" />} title="🗓️ Suppression auto des non-payés après la date limite"
            desc="Après la date de fermeture des inscriptions, les comptes non payés sont supprimés automatiquement — sauf ceux « mis de côté » (⏸), qui ne sont jamais supprimés ni relancés." />
          <AutoItem icon={<MailIcon className="w-4 h-4 text-blue-600" />} title="📨 Formulaire de contact"
            desc="Le visiteur reçoit une confirmation automatique. Toi, tu vois le message dans Communication → Messages reçus (et dans « À faire » du tableau de bord)." />
          <AutoItem icon={<MailIcon className="w-4 h-4 text-blue-600" />} title="❓ Nouvelle question FAQ"
            desc="Quand un adhérent pose une question sur la page /faq, les admins reçoivent un mail pour y répondre depuis FAQ adhérents → « Questions en attente »." />
          <AutoItem icon={<Database className="w-4 h-4 text-slate-600" />} title="💾 Sauvegarde de la base"
            desc="Une sauvegarde complète est téléchargée chaque nuit sur le PC du club, et une sauvegarde par mail est envoyée chaque mois. Le journal privé indique l'heure de la dernière sauvegarde." />
          <AutoItem icon={<Database className="w-4 h-4 text-slate-600" />} title="🔄 Actualisation des données"
            desc="L'admin se rafraîchit tout seul toutes les 60 secondes (toutes les 5 secondes dans la table de marque d'un tournoi). Le bouton ⟳ en haut force une mise à jour immédiate." />
          <AutoItem icon={<Shield className="w-4 h-4 text-red-600" />} title="🔒 Verrouillage après 5 mauvais essais"
            desc="Après 5 codes faux en 15 min, le compte est bloqué 30 min. Tu peux débloquer depuis Réglages → Statistiques → Comptes bloqués." />
          <AutoItem icon={<Shield className="w-4 h-4 text-red-600" />} title="🔐 Double vérification (2FA)"
            desc="Les admins confirment un code reçu par mail tous les 14 jours. Entre-temps, seul le code personnel est demandé." />
        </div>
      </Section>

      {/* 🎯 Raccourcis utiles */}
      <Section
        title="🎯 Raccourcis utiles"
        subtitle="Pour aller plus vite au quotidien"
        icon={<Zap className="w-4 h-4 text-blue-500" />}
        open={ouvert === "raccourcis"}
        onToggle={() => basculer("raccourcis")}
        accent="blue"
      >
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-start gap-2"><kbd className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-xs shrink-0">Ctrl+K</kbd><span>Recherche globale (adhérents, factures, inscriptions tournois, messages, emails) : un clic ouvre directement la bonne page</span></li>
          <li className="flex items-start gap-2"><kbd className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-xs shrink-0">Échap</kbd><span>Fermer une fenêtre ouverte</span></li>
          <li className="flex items-start gap-2 mt-3 pt-3 border-t border-slate-200"><span className="text-base">🏠</span><span>Le tableau de bord (en haut du menu) liste ce qu&apos;il reste à faire : clique sur une ligne pour y aller directement</span></li>
          <li className="flex items-start gap-2"><span className="text-base">✉️</span><span>Sur un message reçu, l&apos;enveloppe ouvre l&apos;envoi d&apos;email pré-rempli (destinataire et sujet « Re: »)</span></li>
          <li className="flex items-start gap-2"><span className="text-base">📥</span><span>Exports : CSV des adhérents et émargement (Réglages → Sauvegarde &amp; export), PDF des t-shirts pour le fabricant, PDF du classement d&apos;un tournoi inter-clubs</span></li>
          <li className="flex items-start gap-2"><span className="text-base">📋</span><span>Inscriptions aux tournois : bouton pour copier la liste des binômes</span></li>
          <li className="flex items-start gap-2"><span className="text-base">📎</span><span>Sur un document officiel, le trombone le joint automatiquement aux mails de bienvenue + paiement confirmé ; l&apos;œil le masque aux adhérents sans le supprimer</span></li>
          <li className="flex items-start gap-2"><span className="text-base">✍️</span><span>Signature commune des mails : Réglages → Paramètres saison</span></li>
          <li className="flex items-start gap-2"><span className="text-base">📝</span><span>Brouillons d&apos;emails partagés entre admins : « Enregistrer comme brouillon » dans Envoyer un mail</span></li>
        </ul>
      </Section>

      {/* ✅ Bonnes pratiques */}
      <Section
        title="✅ Bonnes pratiques"
        subtitle="Pour éviter les erreurs"
        icon={<Shield className="w-4 h-4 text-emerald-500" />}
        open={ouvert === "pratiques"}
        onToggle={() => basculer("pratiques")}
        accent="emerald"
      >
        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
          <li><strong>Ne jamais</strong> envoyer à la main les mails de confirmation d&apos;inscription, de bienvenue, de paiement confirmé ni les rappels J-30/15/5/1 : c&apos;est automatique.</li>
          <li>Avant un mail à <strong>tous les adhérents</strong>, vérifier 2 fois la cible (Tous / Payés / Non-payés / Newsletter / Sélection).</li>
          <li>Quand on rouvre temporairement les inscriptions (pour un retardataire), cocher <strong>« Pas de rappels J-X »</strong>.</li>
          <li>Avant de marquer un adhérent « Payé » (virement), vérifier la trace bancaire : le mail de confirmation part tout de suite.</li>
          <li>Une inscription d&apos;une personne inconnue ? La <strong>mettre de côté (⏸)</strong> plutôt que la supprimer : elle n&apos;est ni relancée ni supprimée automatiquement.</li>
          <li>Remplir <strong>fille / garçon</strong> sur chaque fiche : sinon la personne ne reçoit pas les mails des tournois Dames / Hommes.</li>
          <li>Pour un tournoi inter-clubs, préparer le <strong>programme de la journée</strong> à l&apos;avance et imprimer les <strong>QR codes</strong> : le jour J, tout se lance en un clic.</li>
          <li>Permissions d&apos;un nouvel admin : Réglages → Paramètres saison → Comptes admin, cocher uniquement les sections utiles.</li>
          <li>Avant une grosse opération (nouvelle saison, gros nettoyage), faire une sauvegarde : Réglages → Sauvegarde &amp; export → « Sauvegarde JSON ».</li>
          <li>Ne PAS supprimer un adhérent qui a peut-être déjà payé.</li>
          <li>Chaque admin doit avoir un email valide auquel il a accès (code de double vérification) et un code personnel qui ne sert nulle part ailleurs.</li>
        </ul>
      </Section>

      <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-900">
          💡 <strong>Tu as une astuce à partager avec les autres admins ?</strong>
        </p>
        <p className="text-xs text-indigo-700 mt-1">
          Utilise le <strong>Bloc-notes partagé</strong> (Réglages → Bloc-notes) pour laisser un message daté et signé, visible par tous les admins.
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
  accent: "amber" | "blue" | "emerald" | "violet";
  children: React.ReactNode;
}) {
  const colors = {
    amber: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    blue: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    emerald: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    violet: "bg-violet-50 border-violet-200 hover:bg-violet-100",
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
