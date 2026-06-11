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
  // 🔕 Ids de tournois pour lesquels le membre a explicitement dit "pas intéressé".
  // Le système n'enverra pas les rappels J-30/J-15/J-5/J-1 pour ces tournois.
  tournoisIgnored?: string[];
  // 🚪 Le membre a indiqué qu'il ne souhaite PAS renouveler son adhésion pour
  // cette saison-là (format "y1-y2", ex: "2024-2025"). Le système n'envoie plus
  // les rappels J-30/J-15/J-5/J-1 de cotisation pour cette saison.
  // À la saison suivante, la valeur ne matche plus → les rappels reprennent.
  renewalSkippedFor?: string;
  // 💳 Historique des envois du mail « Rappel virement » avec le RIB en PJ.
  // Chaque entrée = date ISO de l'envoi. Permet d'afficher en admin combien
  // de fois et quand on a relancé le membre par virement.
  virementRemindersSent?: string[];
  // 💸 Historique des envois du mail « Rappel paiement » (bouton AlarmClock).
  // Chaque entrée = date ISO de l'envoi. Permet d'éviter d'envoyer plusieurs
  // rappels rapprochés au même adhérent.
  paymentRemindersSent?: string[];
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
  covoiturage?: {
    seats: number; // nombre de places proposées (0 = ne propose pas)
    depart?: string; // lieu de départ approximatif
    contact?: string; // moyen de contact (tel ou "via WhatsApp")
  } | null;
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

// 📝 Brouillon d'email partagé entre admins
export type EmailDraft = {
  id: string;
  subject: string;
  body: string;
  targetMode: "all" | "paid" | "unpaid" | "news" | "custom" | "";
  customMembreIds?: string[]; // ids des adhérents sélectionnés si targetMode === "custom"
  extraEmails?: string[];     // emails externes ajoutés
  variant?: "default" | "urgent" | "annonce" | "bonne_nouvelle" | "info";
  // Programmation : si scheduledAt est défini, le brouillon sera envoyé automatiquement
  // par le cron à cette date/heure (ISO timestamp). Sinon c'est juste un brouillon manuel.
  scheduledAt?: string;
  createdAt: string;          // ISO timestamp
  updatedAt: string;          // ISO timestamp
  createdBy?: string;         // email de l'admin créateur
  updatedBy?: string;         // email de l'admin qui a modifié en dernier
};

// 📑 Document officiel partagé avec les adhérents (rapport financier, charte, etc.)
export type OfficialDoc = {
  id: string;
  title: string;
  type: "rapport_financier" | "charte" | "rapport_moral" | "autre";
  content?: string;      // texte libre (résumé / aperçu), optionnel si PDF
  pdfUrl?: string;       // lien public Supabase Storage
  pdfPath?: string;      // chemin Supabase Storage (pour suppression)
  pdfName?: string;      // nom du fichier original
  saison?: string;       // ex: "2025-2026" pour traçabilité
  createdAt: string;
  order?: number;        // pour trier (asc), définit l'ordre d'affichage
};

// ❓ Question/réponse de la FAQ adhérents
export type FaqItem = {
  id: string;
  question: string;
  answer: string;     // texte libre, retours à la ligne préservés
  category?: string;  // ex: "Inscription", "Paiement", "Tournois", "Mon compte"
  order?: number;     // pour trier (asc)
};

// ❓ Question posée par un adhérent, en attente de réponse admin
export type FaqPendingQuestion = {
  id: string;
  question: string;
  membreId: string;
  membreNom: string;   // capturé au moment de la soumission
  membreEmail: string;
  createdAt: string;   // ISO timestamp
};

// 👕 Commande de t-shirt par un adhérent
export type TshirtOrder = {
  id: string;
  membreId?: string;       // si commandé depuis l'espace membre (lien avec l'adhérent)
  nom: string;
  prenom: string;
  taille: "XS" | "S" | "M" | "L" | "XL";
  nomFloque?: string;      // nom/surnom à floquer sur le t-shirt (optionnel)
  createdAt: string;       // ISO timestamp
  status?: "pending" | "ordered" | "delivered"; // pour suivi admin
  notes?: string;          // note admin libre
  saison?: string;
};

export type ReunionReport = {
  id: string;
  title: string;
  // 📑 Types unifiés "Documents officiels" : comptes-rendus + rapports +
  // charte. Tout passe désormais par cette même structure.
  type: "debut_saison" | "fin_saison" | "ag" | "rapport_financier" | "charte" | "rapport_moral" | "autre";
  date: string; // YYYY-MM-DD
  content: string; // texte libre, supporte les retours à la ligne
  pdfUrl?: string; // PDF du compte-rendu (optionnel)
  pdfPath?: string; // chemin Supabase Storage pour suppression
  pdfName?: string; // nom du fichier original
  saison?: string;
  createdAt: string;
  // 👁️ Visibilité côté adhérent. Undefined ou true = visible. False = masqué
  // (le document reste en DB mais n'apparaît pas dans la modale Documents officiels).
  visible?: boolean;
  // 📎 Si true, le PDF de ce document est joint automatiquement au mail de
  // confirmation de paiement / bienvenue (utile pour la charte, le rapport
  // moral, etc. que les nouveaux adhérents doivent connaître dès l'inscription).
  attachToWelcome?: boolean;
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
  // 💰 Comptabilité de la saison : factures/dépenses archivées au changement
  // de saison pour ne pas polluer la nouvelle saison avec les dépenses passées.
  // Permet de garder un historique consultable saison par saison.
  factures?: Facture[];
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
  // 👕 Commande de t-shirts (membres connectés uniquement)
  tshirtOpen?: boolean; // Section commande t-shirt visible/ouverte dans l'espace membre
  tshirtPrice?: number; // Prix unitaire du t-shirt (€) — optionnel, affiché côté membre
  tshirtOrders?: TshirtOrder[]; // Commandes reçues (centralisées dans l'admin)
  // ❓ FAQ adhérents : visible sur la home + page /faq
  faqOpen?: boolean; // Affiche/cache la section FAQ côté public
  faqItems?: FaqItem[];
  faqPending?: FaqPendingQuestion[]; // Questions soumises par adhérents en attente de réponse admin
  // 📝 Brouillons d'emails partagés entre admins (préparés à l'avance, envoyés plus tard
  // ou programmés à une date/heure précise)
  emailDrafts?: EmailDraft[];
  // ✍️ Signature commune ajoutée automatiquement à la fin de chaque nouveau mail manuel
  // (texte libre, retours à la ligne préservés). Modifiable par l'admin dans Paramètres
  // saison. Pré-remplie dans le formulaire, l'admin peut la modifier ou la retirer.
  emailSignature?: string;
  // 💳 RIB de l'association pour les rappels de paiement par virement.
  // Stocké dans Supabase Storage (bucket REPORTS_BUCKET), joint au mail
  // « Rappel virement » envoyé depuis MembresAdmin.
  ribPdfUrl?: string;
  ribPdfPath?: string;
  ribPdfName?: string;
  // 🏆 URL de l'appli partenaire « Smash » pour gérer les mini-tournois entre
  // adhérents pendant les entraînements. Lien permanent partagé : tout adhérent
  // connecté peut l'ouvrir, créer/consulter/réinitialiser un mini-tournoi.
  // Si vide, le bouton n'apparaît pas dans Mon espace.
  smashUrl?: string;
  // 📑 Documents officiels (rapport financier, charte, rapport moral, etc.) visibles
  // par les adhérents connectés via une modale dans Mon espace. Toggle d'activation
  // global officialDocsOpen pour contrôler la visibilité (typiquement activé après AG).
  officialDocs?: OfficialDoc[];
  officialDocsOpen?: boolean;
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
  // 👔 Membres du bureau (visibles par les adhérents connectés)
  bureauMembers?: BureauMember[];
  // 🔑 Activer la double authentification par email pour les admins
  require2FA?: boolean;
  // 🔑 Codes 2FA en attente (purgés auto à l'expiration). Stockés en DB
  // car les Edge Functions sont stateless.
  twoFAPending?: { email: string; codeHash: string; expires: number }[];
  // 💾 Backup email automatique mensuel
  backupEmailConfig?: {
    enabled: boolean;
    email: string; // email de destination
    lastSentAt?: string; // ISO timestamp du dernier envoi
  };
  // 🎤 Mode présentation : toutes les sections visibles pour tout le monde
  presentationMode?: boolean;
  presentationModeRemoved?: boolean;
  // 👋 Anciens membres supprimés (non-payés après date limite)
  formerMembers?: FormerMember[];
  // 🔧 Mode maintenance : bloque l'accès au site public
  maintenanceMode?: boolean;
  // 📝 Bloc-notes partagé entre admins
  adminNotes?: AdminNote[];
  // ⚙️ Configuration dynamique du club (modifiable dans l'admin)
  clubConfig?: ClubConfig;
};

export type ScheduleSlot = {
  jour: string;  // ex: "Lundi", "Jeudi", "Samedi"
  heure: string; // ex: "18h30 → Fermeture"
};

export type ClubConfig = {
  prixAdulte?: number;      // default 50
  prixEtudiant?: number;    // default 30
  horaires?: ScheduleSlot[];// default: Lundi/Jeudi/Samedi
  salleName?: string;       // default "Salle Paul Vatine"
  salleAdresse?: string;    // default "30bis Rue Georges Boissaye du Bocage, 76310 Sainte-Adresse"
  foundedYear?: number;     // default 2022
  helloassoUrls?: {
    page?: string;     // page principale de l'asso sur HelloAsso
    mixte?: string;
    adulte?: string;
    etudiant?: string;
  };
};

export type FormerMember = {
  nom: string;
  email: string;
  type: "Adulte" | "Etudiant";
  removedAt: string;   // ISO date de suppression
  saison: string;      // ex: "2025-2026"
};

export type AdminNote = {
  id: string;
  content: string;
  author: string; // nom ou email de l'admin
  createdAt: string;
  updatedAt?: string;
};

export type BureauMember = {
  id: string;
  prenom: string;
  nom: string;
  role: string; // ex: "Président", "Trésorier", "Secrétaire"
  description?: string; // petit mot / mission de la personne
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
  // 📨 Provenance du message : "form" = via formulaire contact du site (défaut),
  // "email_reply" = réponse par email à un mail envoyé par l'admin, captée
  // automatiquement via Brevo Inbound Parsing.
  source?: "form" | "email_reply";
  subject?: string; // utilisé pour les réponses email (sujet du fil)
  threadKey?: string; // permet de regrouper les réponses d'un même fil
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

// Retourne les prix effectifs (DB ou défaut)
export function getEffectivePrix(db: DB): { Adulte: number; Etudiant: number } {
  return {
    Adulte: db.clubConfig?.prixAdulte ?? PRIX.Adulte,
    Etudiant: db.clubConfig?.prixEtudiant ?? PRIX.Etudiant,
  };
}

// Retourne les horaires effectifs (DB ou défaut)
export const DEFAULT_HORAIRES: ScheduleSlot[] = [
  { jour: "Lundi", heure: "18h30 → Fermeture" },
  { jour: "Jeudi", heure: "18h30 → Fermeture" },
  { jour: "Samedi", heure: "17h30 → Fermeture" },
];

export function getEffectiveHoraires(db: DB): ScheduleSlot[] {
  const h = db.clubConfig?.horaires;
  return h && h.length > 0 ? h : DEFAULT_HORAIRES;
}

export function getEffectiveConfig(db: DB) {
  return {
    prix: getEffectivePrix(db),
    horaires: getEffectiveHoraires(db),
    creneauxCount: (db.clubConfig?.horaires?.length ?? DEFAULT_HORAIRES.length),
    salleName: db.clubConfig?.salleName || "Salle Paul Vatine",
    salleAdresse: db.clubConfig?.salleAdresse || "30bis Rue Georges Boissaye du Bocage, 76310 Sainte-Adresse",
    foundedYear: db.clubConfig?.foundedYear ?? 2022,
    helloassoUrls: db.clubConfig?.helloassoUrls ?? {},
  };
}

// 🔐 Sections qu'on peut accorder via le système de permissions.
// Chaque clé peut couvrir plusieurs sous-sections de l'admin (voir hint).
export const ADMIN_SECTIONS = [
  { key: "membres",      label: "Adhérents",                       emoji: "👥", hint: "Liste des adhérents, fiches, mots de passe, validation paiement" },
  { key: "comptabilite", label: "Comptabilité",                    emoji: "💰", hint: "Recettes, dépenses, factures, bilan financier" },
  { key: "tournois",     label: "Tournois",                        emoji: "🏸", hint: "Création/édition des tournois (dates, lieux, quotas)" },
  { key: "actualites",   label: "Actualités",                      emoji: "📰", hint: "Publication d'articles + photos sur la page d'accueil" },
  { key: "inscriptions", label: "Inscriptions tournois",           emoji: "📋", hint: "Voir et gérer les binômes inscrits aux tournois" },
  { key: "engagement",   label: "Sondages, AG, Documents, FAQ, T-shirts", emoji: "📣", hint: "Sondages, questions AG, documents officiels, FAQ adhérents, commandes t-shirts" },
  { key: "rules",        label: "Règlement de l'association",      emoji: "📜", hint: "Règles du club + PDF du règlement" },
  { key: "bureau",       label: "Membres du bureau",               emoji: "👔", hint: "Composition du bureau visible par les adhérents connectés" },
  { key: "emailing",     label: "Emails & Messages",               emoji: "📧", hint: "Envoyer des mails, boîte de réception, historique" },
  { key: "saison",       label: "Paramètres saison & Statistiques", emoji: "⚙️", hint: "Saison en cours, quotas, dates, présidents, signature, analytics" },
] as const;
