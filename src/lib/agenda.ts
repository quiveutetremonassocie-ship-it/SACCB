import type { AgendaEvent, DB } from "./types";

/** 📅 Un événement affiché dans l'agenda (tournoi, tournoi inter-clubs/interne ou événement ajouté à la main) */
export type EvenementAgenda = {
  id: string;
  titre: string;
  date: string; // YYYY-MM-DD
  heureDebut?: string; // HH:MM
  heureFin?: string;
  lieu?: string;
  description?: string;
  genre: "tournoi" | "interclub" | "interne" | "club";
  modifiable: boolean; // seuls les événements ajouté(s) à la main se modifient depuis l'agenda
  masque?: boolean; // tournoi retiré de l'agenda (visible seulement dans l'admin, grisé)
};

const MOIS: Record<string, string> = {
  janvier: "01", fevrier: "02", février: "02", mars: "03", avril: "04", mai: "05", juin: "06",
  juillet: "07", aout: "08", août: "08", septembre: "09", octobre: "10", novembre: "11", decembre: "12", décembre: "12",
};

/** Date de tournoi (texte libre : 2026-11-15, 15/11/2026, « samedi 15 novembre 2026 ») → YYYY-MM-DD */
export function dateISO(s: string | null | undefined): string {
  const t = (s || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  const fr = t.match(/(\d{1,2})(?:er)?\s+([a-zéûî]+)\s+(\d{4})/i);
  if (fr) { const m = MOIS[fr[2].toLowerCase()]; if (m) return `${fr[3]}-${m}-${fr[1].padStart(2, "0")}`; }
  return "";
}

/** Tous les événements de l'agenda, triés par date (la DATE DU TOURNOI, jamais la date limite d'inscription) */
type TournoiAgenda = { id: string; name: string; date: string; interne?: boolean; visible?: boolean; salleNom?: string; salleAdresse?: string };

export function evenementsAgenda(db: Partial<DB> & { agendaTournois?: TournoiAgenda[] }, avecMasques = false): EvenementAgenda[] {
  const out: EvenementAgenda[] = [];
  for (const t of db.config_tournois || []) {
    const date = dateISO(t.date);
    if (date) out.push({ id: "t-" + t.id, titre: `🏸 ${t.name}`, date, description: t.description || undefined, genre: "tournoi", modifiable: false });
  }
  // Admin : la liste complète ; site public : la version allégée renvoyée par le serveur
  const tournois: TournoiAgenda[] = db.interclubs || db.agendaTournois || [];
  for (const t of tournois) {
    if (t.interne && db.interclubs && t.visible !== true) continue; // tournoi interne encore en préparation
    const date = dateISO(t.date);
    if (!date) continue;
    out.push({
      id: "ic-" + t.id,
      titre: `${t.interne ? "🏠" : "🤝"} ${t.name}`,
      date,
      lieu: [t.salleNom, t.salleAdresse].filter(Boolean).join(", ") || undefined,
      genre: t.interne ? "interne" : "interclub",
      modifiable: false,
    });
  }
  for (const e of db.agendaEvents || []) {
    if (e.date) out.push({ ...e, genre: "club", modifiable: true });
  }
  // 🙈 Tournois retirés de l'agenda par le bureau : cachés (ou grisés dans l'admin)
  const masques = new Set(db.agendaMasques || []);
  const visibles = out
    .map((e) => (masques.has(e.id) ? { ...e, masque: true } : e))
    .filter((e) => avecMasques || !e.masque);
  return visibles.sort((a, b) => (a.date + (a.heureDebut || "")).localeCompare(b.date + (b.heureDebut || "")));
}

// ─── Ajout à l'agenda du téléphone / de l'ordinateur ───

const compacte = (d: string) => d.replace(/-/g, "");
function jourSuivant(d: string) {
  const x = new Date(d + "T12:00:00");
  x.setDate(x.getDate() + 1);
  return x.toISOString().slice(0, 10);
}
function bornes(e: EvenementAgenda): { debut: string; fin: string; journee: boolean } {
  if (!e.heureDebut) return { debut: compacte(e.date), fin: compacte(jourSuivant(e.date)), journee: true };
  const h = (x: string) => x.replace(":", "") + "00";
  const fin = e.heureFin || `${String(Math.min(23, Number(e.heureDebut.slice(0, 2)) + 2)).padStart(2, "0")}:${e.heureDebut.slice(3, 5)}`;
  return { debut: `${compacte(e.date)}T${h(e.heureDebut)}`, fin: `${compacte(e.date)}T${h(fin)}`, journee: false };
}

/** Lien « Ajouter à Google Agenda » */
export function lienGoogle(e: EvenementAgenda): string {
  const { debut, fin } = bornes(e);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.titre.replace(/^\p{Extended_Pictographic}\s*/u, "") + " — SACCB",
    dates: `${debut}/${fin}`,
    details: (e.description || "") + "\n\nhttps://saccb.fr",
    location: e.lieu || "",
    ctz: "Europe/Paris",
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

const echap = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Fichier .ics (iPhone, Outlook, agenda Samsung…) */
export function fichierIcs(e: EvenementAgenda): string {
  const { debut, fin, journee } = bornes(e);
  const lignes = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SACCB//Agenda//FR", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${e.id}@saccb.fr`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    journee ? `DTSTART;VALUE=DATE:${debut}` : `DTSTART;TZID=Europe/Paris:${debut}`,
    journee ? `DTEND;VALUE=DATE:${fin}` : `DTEND;TZID=Europe/Paris:${fin}`,
    `SUMMARY:${echap(e.titre.replace(/^\p{Extended_Pictographic}\s*/u, "") + " — SACCB")}`,
    e.lieu ? `LOCATION:${echap(e.lieu)}` : "",
    `DESCRIPTION:${echap((e.description || "") + "\n\nhttps://saccb.fr")}`,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  return lignes.join("\r\n");
}

export function telechargerIcs(e: EvenementAgenda) {
  const blob = new Blob([fichierIcs(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (e.titre.replace(/^\p{Extended_Pictographic}\s*/u, "").replace(/[^\p{L}\p{N} -]/gu, "").trim() || "evenement") + ".ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type { AgendaEvent };
