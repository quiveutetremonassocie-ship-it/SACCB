// 🏸 Classement mondial BWF (top 3 par discipline), lu dans la page Wikipédia « BWF World Ranking ».
// La BWF refuse les accès automatiques à son propre site : Wikipédia recopie son classement chaque semaine
// (avec la date et un renvoi vers la source officielle). Source reprise sous licence CC BY-SA → toujours la citer.
//
// Ce lecteur est volontairement prudent : au moindre doute (rangs manquants, points qui ne descendent pas,
// date introuvable), la discipline concernée est REFUSÉE avec une erreur, jamais remplie à moitié.

export type Discipline = "SH" | "SD" | "DH" | "DD" | "DM";

export const DISCIPLINES: { id: Discipline; titre: string; section: string; paire: boolean }[] = [
  { id: "SH", titre: "Simple hommes", section: "Men's singles", paire: false },
  { id: "SD", titre: "Simple dames", section: "Women's singles", paire: false },
  { id: "DH", titre: "Double hommes", section: "Men's doubles", paire: true },
  { id: "DD", titre: "Double dames", section: "Women's doubles", paire: true },
  { id: "DM", titre: "Double mixte", section: "Mixed doubles", paire: true },
];

export const SOURCE_WIKIPEDIA = "https://en.wikipedia.org/wiki/BWF_World_Ranking";
export const SOURCE_BWF = "https://bwfbadminton.com/rankings/";
export const API_WIKIPEDIA = "https://en.wikipedia.org/w/api.php?action=parse&page=BWF_World_Ranking&prop=wikitext&format=json&formatversion=2";

// pages = titre de la page Wikipédia de chaque joueur (sert à retrouver sa photo)
export type LigneClassement = { rang: number; joueurs: string[]; pages: string[]; pays: string[]; points: number };
export type ClassementDiscipline = { date: string; lignes: LigneClassement[] };
/** Ce que le serveur range dans la base (action cron_classement_bwf) et envoie à la page d'accueil */
export type ClassementStocke = {
  maj: string; // date et heure de la dernière modification des données
  disciplines: Partial<Record<Discipline, ClassementDiscipline>>;
  erreurs?: Partial<Record<Discipline, string>>;
  calendrier: import("./calendrierBwf").TournoiBwf[];
  photos: Record<string, import("./photosBwf").PhotoJoueur>;
};
export type LectureClassement = {
  disciplines: Partial<Record<Discipline, ClassementDiscipline>>;
  erreurs: Partial<Record<Discipline, string>>;
};

/** Âge d'un classement en jours (date AAAA-MM-JJ) */
export function ageEnJours(date: string, maintenant = new Date()): number {
  const d = new Date(date + "T12:00:00");
  return Math.floor((maintenant.getTime() - d.getTime()) / 86_400_000);
}

// Noms de pays en français pour les codes les plus courants (sinon on affiche le code tel quel)
const NOMS_PAYS: Record<string, string> = {
  FRA: "France", CHN: "Chine", KOR: "Corée du Sud", JPN: "Japon", THA: "Thaïlande", DEN: "Danemark", INA: "Indonésie",
  MAS: "Malaisie", IND: "Inde", TPE: "Taïwan", CAN: "Canada", HKG: "Hong Kong", SGP: "Singapour", ENG: "Angleterre",
  GER: "Allemagne", ESP: "Espagne", NED: "Pays-Bas", USA: "États-Unis", TUR: "Turquie", VIE: "Vietnam", SCO: "Écosse",
  BUL: "Bulgarie", ITA: "Italie", POL: "Pologne", SUI: "Suisse", SWE: "Suède", UKR: "Ukraine", IRL: "Irlande",
  AUS: "Australie", NZL: "Nouvelle-Zélande", BRA: "Brésil", EGY: "Égypte", MEX: "Mexique", PER: "Pérou", FIN: "Finlande",
  RUS: "Russie", BEL: "Belgique", AUT: "Autriche", CZE: "Tchéquie", SLO: "Slovénie", ISR: "Israël", PHI: "Philippines",
};
/** « France » pour FRA ; pour un double de la même nation, une seule mention */
export function nomsDePays(codes: string[]): string {
  return [...new Set(codes)].map((c) => NOMS_PAYS[c] || c).join(" / ");
}
