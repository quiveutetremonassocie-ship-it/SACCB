// 🔗 Destinations possibles du bouton d'une actualité (« Bouton vers le site »).
// `espace` = endroit de l'espace adhérent à ouvrir (connexion demandée si besoin) ; sinon simple lien.

export type DestinationEspace = "coordonnees" | "reinscription" | "tshirt" | "tournois" | "code" | "procuration";

export type LienActu = {
  cle: string;
  libelle: string; // texte dans la liste de l'admin
  bouton: string; // texte du bouton sur le site (modifiable dans l'admin)
  href: string;
  espace?: DestinationEspace;
};

export const LIENS_ACTU: LienActu[] = [
  { cle: "coordonnees", libelle: "Espace adhérent → changer mail / téléphone", bouton: "Changer mon mail ou mon téléphone", href: "/?member=1&ouvrir=coordonnees", espace: "coordonnees" },
  { cle: "reinscription", libelle: "Espace adhérent → réinscription", bouton: "Me réinscrire", href: "/?member=1&ouvrir=reinscription", espace: "reinscription" },
  { cle: "tshirt", libelle: "Espace adhérent → commander un t-shirt", bouton: "Commander mon t-shirt", href: "/?member=1&ouvrir=tshirt", espace: "tshirt" },
  { cle: "tournois-membre", libelle: "Espace adhérent → mes tournois", bouton: "Voir mes tournois", href: "/?member=1&ouvrir=tournois", espace: "tournois" },
  { cle: "procuration", libelle: "Espace adhérent → procuration pour l'AG", bouton: "Faire ma procuration", href: "/?member=1&ouvrir=procuration", espace: "procuration" },
  { cle: "code", libelle: "Espace adhérent → changer mon code", bouton: "Changer mon code", href: "/?member=1&ouvrir=code", espace: "code" },
  { cle: "inscription", libelle: "Page Adhésion (inscription au club)", bouton: "M'inscrire au club", href: "/inscription/" },
  { cle: "tournois", libelle: "Page Tournois", bouton: "Voir les tournois", href: "/tournois/" },
  { cle: "horaires", libelle: "Horaires et tarifs", bouton: "Voir les horaires", href: "/#horaires" },
  { cle: "faq", libelle: "Page Aide (questions fréquentes)", bouton: "Voir l'aide", href: "/faq/" },
  { cle: "contact", libelle: "Page Contact", bouton: "Nous contacter", href: "/contact/" },
];

export const lienActu = (cle?: string) => (cle ? LIENS_ACTU.find((l) => l.cle === cle) : undefined);

const DESTINATIONS: DestinationEspace[] = ["coordonnees", "reinscription", "tshirt", "tournois", "code", "procuration"];
export const estDestinationEspace = (v: string | null | undefined): v is DestinationEspace => !!v && (DESTINATIONS as string[]).includes(v);
