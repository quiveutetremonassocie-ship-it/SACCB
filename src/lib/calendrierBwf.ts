// 📅 Calendrier des tournois internationaux (BWF World Tour), lu dans les pages Wikipédia « 20XX BWF World Tour ».
// Wikipédia recopie le calendrier publié par la BWF. On lit les tournois (dates, lieu, niveau, dotation) et,
// pour ceux qui sont terminés, les finales de chaque discipline. Le programme match par match n'est pas
// publié à l'avance sur une source gratuite et fiable.
// Même prudence que pour le classement : un tournoi mal lu est ignoré, jamais rempli à moitié.

/** Finale d'une discipline : vainqueur(s), finaliste(s) et score */
export type FinaleBwf = { champions: string[]; finalistes: string[]; score: string };
/** Ordre des finales dans le tableau de Wikipédia : SH, SD, DH, DD, DM */
export const ORDRE_FINALES = ["SH", "SD", "DH", "DD", "DM"] as const;

export type TournoiBwf = {
  nom: string;
  debut: string; // AAAA-MM-JJ
  fin: string;   // AAAA-MM-JJ
  ville: string;
  pays: string;  // en français quand on le connaît
  niveau: string; // « Super 1000 », « Super 750 », « Super 500 », « Super 300 », « Super 100 », « Finals »…
  dotation?: string; // ex. « 500 000 $ »
  tableaux?: Record<string, number>; // joueurs (ou paires) au départ, par discipline : SH, SD, DH, DD, DM
  finales?: Record<string, FinaleBwf>; // seulement pour un tournoi terminé dont les 5 finales sont lisibles
};

export const urlCalendrierWikipedia = (annee: number) => `https://en.wikipedia.org/wiki/${annee}_BWF_World_Tour`;
export const apiCalendrier = (annee: number) =>
  `https://en.wikipedia.org/w/api.php?action=parse&page=${annee}_BWF_World_Tour&prop=wikitext&format=json&formatversion=2&redirects=1`;

/** Les prochains tournois : ceux qui ne sont pas terminés à la date donnée */
export function prochainsTournois(tous: TournoiBwf[], aujourdhui: string, combien = 6, discipline?: string): TournoiBwf[] {
  // Si la discipline est précisée, on ne garde que les tournois qui la proposent (format connu et discipline présente)
  return tous.filter((t) => t.fin >= aujourdhui && (!discipline || !t.tableaux || t.tableaux[discipline])).slice(0, combien);
}

/** Les derniers tournois terminés dont on connaît la finale de la discipline, du plus récent au plus ancien */
export function derniersResultats(tous: TournoiBwf[], discipline: string, aujourdhui: string, combien = 4): (TournoiBwf & { finale: FinaleBwf })[] {
  return tous
    .filter((t) => t.fin < aujourdhui && t.finales?.[discipline])
    .reverse()
    .slice(0, combien)
    .map((t) => ({ ...t, finale: t.finales![discipline] }));
}
