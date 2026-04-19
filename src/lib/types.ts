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
};

// Helper pour récupérer la liste normalisée des images d'une actualité
export function actualiteImages(a: Actualite): ActualiteImage[] {
  if (a.images && a.images.length > 0) return a.images;
  if (a.imageUrl) return [{ url: a.imageUrl, path: a.imagePath }];
  return [];
}

export type SeasonArchive = {
  y1: number;
  y2: number;
  membresCount: number;
  config_tournois: Tournoi[];
  inscrits_tournoi: InscritTournoi[];
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
  adminEmails?: string[]; // emails ayant accès au panneau admin via l'espace membre
  adminCredentials?: { email: string; code: string }[]; // codes admin indépendants des adhérents
  contactEmails?: string[]; // emails recevant les messages du formulaire de contact
};

export const PRIX = { Adulte: 50, Etudiant: 30 } as const;
export const QUOTA_DEFAULT = 65;
