export type Membre = {
  id: string;
  nom: string;
  email: string;
  tel?: string;
  type: "Adulte" | "Etudiant";
  ok?: boolean;
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

export type Actualite = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imagePath?: string; // chemin dans Supabase Storage (pour pouvoir supprimer)
  createdAt: string;
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
};

export const PRIX = { Adulte: 50, Etudiant: 30 } as const;
export const QUOTA_CLUB = 65;
