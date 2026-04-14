export type Membre = {
  id: string;
  nom: string;
  email: string;
  tel?: string;
  type: "Adulte" | "Etudiant";
  ok?: boolean;
  paymentMethod?: "online" | "virement";
  paymentDate?: string;
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
  type?: string | null;
  quota?: number | null;
};

export type InscritTournoi = {
  id: string;
  tournoiId: string;
  joueurs: string;
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
};

export const PRIX = { Adulte: 50, Etudiant: 30 } as const;
export const QUOTA_DEFAULT = 65;
