export type Membre = {
  id: string;
  nom: string;
  email: string;
  tel?: string;
  type: "Adulte" | "Etudiant";
  ok?: boolean;
  paymentMethod?: "online" | "virement";
  paymentDate?: string;
  code?: string; // code personnel (4+ chiffres) pour l'espace membre
  newsOptIn?: boolean; // accepte de recevoir les infos tournois & rappels
  photoConsent?: boolean; // autorise l'utilisation de photos prises lors des événements
};

export type FactureFile = {
  path: string;
  name: string;
  type: string;
  size: number;
};

export type Facture = {
  id: string;
  date: string;
  desc: string;
  montant: number;
  files?: FactureFile[];
};

export type Tournoi = {
  id: string;
  name: string;
  date: string;
  dateLimit?: string | null; // date limite d'inscription (format YYYY-MM-DD ou DD/MM/YYYY)
  type?: string | null;
  quota?: number | null;
  saison?: string; // ex: "2024-2025", auto-renseigné à la création
  closed?: boolean; // fermé automatiquement quand la date limite est dépassée
};

export type InscritTournoi = {
  id: string;
  tournoiId: string;
  joueurs: string;
  resultat?: string | null; // ex: "3/25" (3ème sur 25 équipes)
};

export type ActualiteImage = {
  url: string;
  path?: string; // chemin Supabase Storage (pour suppression)
};

export type Actualite = {
  id: string;
  title: string;
  description: string;
  images?: ActualiteImage[]; // galerie complète, [0] = image principale affichée dans le carrousel
  // Champs legacy (compat ascendante pour anciennes actus)
  imageUrl?: string;
  imagePath?: string;
  createdAt: string;
  private?: boolean;
};

// Helper pour récupérer la liste normalisée des images d'une actualité
export function actualiteImages(a: Actualite): ActualiteImage[] {
  if (a.images && a.images.length > 0) return a.images;
  if (a.imageUrl) return [{ url: a.imageUrl, path: a.imagePath }];
  return [];
}

// ─── Engagement adhérents : sondages, questions AG, comptes-rendus ───

export type Poll = {
  id: string;
  question: string;
  options: string[]; // ex: ["Oui", "Non", "Peut-être"] ou dates ["20 sept", "27 sept"]
  votes: { membreId: string; optionIdx: number; date: string }[]; // 1 vote par membre
  createdAt: string;
  closed?: boolean;
  multipleChoice?: boolean; // si true, le membre peut voter pour plusieurs options
  saison?: string; // pour archivage
};

export type AGItem = {
  id: string;
  type: "question" | "amelioration"; // question à l'AG ou idée d'amélioration
  text: string;
  anonymous: boolean;
  authorMembreId?: string | null;
  authorNom?: string | null;
  createdAt: string;
  saison?: string;
  reponse?: string | null; // réponse du bureau
  reponseDate?: string;
  resolved?: boolean;
};

export type ReunionReport = {
  id: string;
  title: string;
  type: "debut_saison" | "fin_saison" | "ag" | "autre";
  date: string; // YYYY-MM-DD
  content: string; // texte libre, supporte les retours à la ligne
  pdfUrl?: string; // PDF du compte-rendu (optionnel)
  pdfPath?: string; // chemin Supabase Storage pour suppression
  pdfName?: string; // nom du fichier original
  saison?: string;
  createdAt: string;
};

export type SeasonArchive = {
  y1: number;
  y2: number;
  membresCount: number;
  config_tournois: Tournoi[];
  inscrits_tournoi: InscritTournoi[];
  // Engagement archivé avec la saison
  polls?: Poll[];
  agItems?: AGItem[];
  reunionReports?: ReunionReport[];
};

export type DB = {
  membres: Membre[];
  factures: Facture[];
  inscrits_tournoi: InscritTournoi[];
  config_tournois: Tournoi[];
  actualites: Actualite[];
  y1: number;
  y2: number;
  insc_open: boolean;
  quota?: number;
  whatsappLink?: string; // lien d'invitation groupe WhatsApp
  insc_close_date?: string; // date de fermeture des inscriptions (YYYY-MM-DD) pour les rappels
  archives?: SeasonArchive[]; // historique des saisons précédentes
  adminEmails?: { email: string; readOnly?: boolean; permissions?: string[] }[]; // emails ayant accès au panneau admin via l'espace membre
  adminCredentials?: { email: string; code: string; readOnly?: boolean; permissions?: string[] }[]; // codes admin indépendants des adhérents
  contactEmails?: string[]; // emails recevant les messages du formulaire de contact
  reportPrecedent?: number; // report de trésorerie des saisons précédentes
  // Si true, les rappels saison J-30/15/5/1 ne sont PAS envoyés (utile lors d'une
  // réouverture temporaire des inscriptions pour un nouvel adhérent — pas la peine
  // de spammer tous les adhérents avec des rappels qui ne les concernent pas)
  seasonRemindersDisabled?: boolean;
  // Engagement adhérents (saison courante, archivés dans SeasonArchive lors du changement de saison)
  polls?: Poll[];
  agItems?: AGItem[];
  reunionReports?: ReunionReport[];
  // Toggle global (deprecated, gardé pour rétrocompat — équivaut à pollsOpen + agOpen tous les 2)
  engagementOpen?: boolean;
  // Toggles séparés pour activer/désactiver indépendamment chaque sous-section
  pollsOpen?: boolean;   // Sondages visibles côté public
  agOpen?: boolean;      // Section AG (questions + idées) visible côté public
  reportsOpen?: boolean; // Comptes-rendus de réunion visibles côté public (dissocié des sondages)
  // Règles de l'association (texte libre + PDF optionnel, NON archivé avec les saisons — reste permanent)
  clubRules?: string;
  clubRulesPdfUrl?: string;
  clubRulesPdfPath?: string;
  clubRulesPdfName?: string;
  // Historique des emails envoyés manuellement par l'admin
  emailHistory?: EmailLog[];
  // Messages reçus via le formulaire de contact public (boîte de réception partagée)
  contactMessages?: ContactMessage[];
  // Nom du président (utilisé dans les reçus, signatures, etc.)
  presidentName?: string;
  // 👁️ Toggles de visibilité des sections publiques côté site (admin → "Visibilité sections")
  // undefined = visible (comportement par défaut, rétrocompat). false = caché.
  sectionsVisible?: {
    actualites?: boolean;
    tournois?: boolean;
    horaires?: boolean;
    palmares?: boolean;
    rules?: boolean;
    presentation?: boolean;
    inscription?: boolean;
  };
  // 📊 Analytics : compteurs journaliers (limite 90 jours, plus anciens auto-supprimés)
  analyticsDaily?: AnalyticsDay[];
  // 🔐 Log des connexions admin réussies (50 dernières max)
  adminLoginLog?: { email: string; date: string; ip?: string }[];
  // 🔑 Activer la double authentification par email pour les admins
  require2FA?: boolean;
  // 🔑 Codes 2FA en attente (purgés auto à l'expiration). Stockés en DB
  // car les Edge Functions sont stateless.
  twoFAPending?: { email: string; codeHash: string; expires: number }[];
};

export type AnalyticsDay = {
  date: string; // YYYY-MM-DD
  views: number;
  paths?: Record<string, number>;
  refs?: Record<string, number>;
  devices?: Record<string, number>;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string; // ISO timestamp
  respondedBy?: string;  // email de l'admin qui a marqué "répondu"
  respondedAt?: string;  // ISO timestamp
  archived?: boolean;    // masqué dans la liste principale
};

export type EmailLog = {
  id: string;
  date: string; // ISO timestamp
  subject: string;
  body: string; // corps de l'email (pour ré-utilisation/consultation)
  recipientCount: number;
  recipientsPreview: string[]; // 3 premiers destinataires pour aperçu
  targetMode: string; // all | paid | unpaid | news | custom
  sentBy: string; // email de l'admin qui a envoyé OU "system" si automatique
  attachmentNames?: string[]; // noms des PJ (pas le contenu, pour économiser)
  status: "sent" | "partial" | "failed";
  sentCount?: number;
  totalCount?: number;
  // Type d'email pour le filtrage : manual / welcome / payment_confirmation /
  // payment_reminder / code_reset / code_forgot / contact_form / report_sent /
  // engagement_notification / poll_notification / tournament_notification /
  // season_reminder / tournament_reminder / new_season / cleanup_admin
  type?: string;
  // 🎨 Variante visuelle (urgent / annonce / bonne_nouvelle / info / default)
  variant?: string;
};

export const PRIX = { Adulte: 50, Etudiant: 30 } as const;
export const QUOTA_DEFAULT = 65;

export const ADMIN_SECTIONS = [
  { key: "membres",      label: "Membres",             emoji: "👥" },
  { key: "comptabilite", label: "Comptabilité",         emoji: "💰" },
  { key: "tournois",     label: "Tournois",             emoji: "🏸" },
  { key: "actualites",   label: "Actualités",           emoji: "📰" },
  { key: "inscriptions", label: "Inscriptions tournoi", emoji: "📋" },
  { key: "engagement",   label: "Sondages & AG",        emoji: "📣" },
  { key: "rules",        label: "Règles de l'association",       emoji: "📜" },
  { key: "emailing",     label: "Envoi d'emails",       emoji: "📧" },
  { key: "saison",       label: "Paramètres saison",    emoji: "⚙️" },
] as const;
