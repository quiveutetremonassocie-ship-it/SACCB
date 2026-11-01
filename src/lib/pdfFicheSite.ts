// 📘 PDF « Fiche du site pour Claude » : description du site + état actuel + historique des modifications.
// À donner à Claude au début d'une nouvelle conversation pour qu'il comprenne tout le site.
import { DB } from "./types";
import { FICHE_MAJ_LE, FICHE_SITE } from "./ficheSite";
import historique from "./historiqueSite.json";
import type { EspaceServeur } from "./db";

// Police standard du PDF : pas d'emoji ni de symboles hors Latin-1
const propre = (x: string) =>
  x.replace(/→/g, "->").replace(/←/g, "<-").replace(/↩/g, "").replace(/≈/g, "~").replace(/[  ]/g, " ")
    .replace(/ᵉ/g, "e").replace(/ʳ/g, "r")
    .replace(/[^\u0000-ÿŒœ–—‘’“”…€•]/g, "")
    .replace(/ {2,}/g, " ").trim();

const dateFr = (iso?: string) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const mo = (o: number) => `${(o / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

/** Chiffres et réglages du site au moment du téléchargement (aucun email, téléphone ni code) */
function etatDuSite(db: DB, espace?: EspaceServeur | null): [string, string][] {
  const membres = db.membres || [];
  const ics = db.interclubs || [];
  const v = (db.sectionsVisible || {}) as Record<string, boolean | undefined>;
  const rubriques = ["presentation", "actualites", "horaires", "tournois", "palmares", "inscription", "agenda", "rules"]
    .map((k) => `${k} ${v[k] === false ? "(masquée)" : "(visible)"}`).join(", ");
  const semaine = Date.now() - 7 * 86_400_000;
  const bloques = (db.securiteBlocages || []).filter((b) => new Date(b.fin).getTime() > semaine).reduce((s, b) => s + b.n, 0);
  const lignes: [string, string][] = [
    ["Saison", `${db.y1}-${db.y2} · inscriptions ${db.insc_open === false ? "fermées" : "ouvertes"} · quota ${db.quota ?? "—"}`],
    ["Adhérents", `${membres.length} fiches dont ${membres.filter((m) => m.ok).length} à jour de paiement`],
    ["Tournois (palmarès / inscriptions)", `${(db.config_tournois || []).length} tournois · ${(db.inscrits_tournoi || []).length} inscriptions/résultats`],
    ["Tournois inter-clubs / internes", `${ics.length} au total : ${ics.filter((t) => t.live && !t.live.termine).length} en cours, ${ics.filter((t) => t.live?.termine).length} terminés, ${ics.filter((t) => !t.live).length} pas encore lancés`],
    ["Actualités", `${(db.actualites || []).length} (dont ${(db.actualites || []).filter((a) => (a as { private?: boolean }).private).length} réservées aux adhérents)`],
    ["Agenda", `${(db.agendaEvents || []).length} événement(s) ajouté(s), ${(db.agendaMasques || []).length} tournoi(s) masqué(s)`],
    ["Sondages / AG", `${(db.polls || []).length} sondage(s), ${(db.agItems || []).length} question(s) d'AG`],
    ["Compta", `${(db.factures || []).length} facture(s)`],
    ["Admins", `${(db.adminEmails || []).length} admin(s) adhérent(s) + ${(db.adminCredentials || []).length} accès admin séparé(s)`],
    ["Modes", `maintenance ${db.maintenanceMode ? "ACTIVÉ" : "désactivé"} · présentation ${db.presentationMode ? "ACTIVÉ" : "désactivé"}`],
    ["Rubriques", rubriques],
    ["Dernière sauvegarde complète", dateFr(db.lastBackupExport)],
    ["Requêtes bloquées (7 jours)", String(bloques)],
    ["Journal", `${(db.adminJournal || []).length} action(s) enregistrée(s)`],
  ];
  if (espace?.ok && espace.limites) {
    const fichiers = Object.values(espace.dossiers || {}).reduce((s, d) => s + d.octets, 0);
    lignes.push(["Place serveur", `base ${mo(espace.base || 0)} / ${mo(espace.limites.base)} · fichiers ${mo(fichiers)} / ${mo(espace.limites.fichiers)}`]);
  }
  return lignes;
}

export async function telechargerFicheSite(db: DB, espace?: EspaceServeur | null, apercu = false): Promise<ArrayBuffer | void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const BLEU: [number, number, number] = [30, 58, 95];
  const finY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const h = historique as { genereLe: string; version: string; nbModifications: number; modifications: { hash: string; date: string; message: string }[]; pointsDeRetour: { nom: string; date: string }[] };

  // En-tête
  doc.setFontSize(18);
  doc.setTextColor(...BLEU);
  doc.text("SACCB - Fiche du site pour Claude", 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(propre(`Téléchargée le ${dateFr(new Date().toISOString())} · version en ligne ${h.version || "?"} (${dateFr(h.genereLe)}) · description mise à jour le ${FICHE_MAJ_LE}`), 14, 24);
  doc.setTextColor(40);
  doc.setFontSize(9.5);
  const intro = doc.splitTextToSize(propre("À donner à Claude au début d'une nouvelle conversation : ce document décrit le site saccb.fr, comment il est construit, les services utilisés, les règles de travail, l'état actuel du site et l'historique de toutes les modifications."), 182);
  doc.text(intro, 14, 31);
  let y = 31 + intro.length * 4.5 + 3;

  // 1. Description (maintenue par Claude)
  for (const s of FICHE_SITE) {
    autoTable(doc, {
      startY: y,
      head: [[propre(s.titre)]],
      body: s.lignes.map((l) => [propre("• " + l)]),
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: { top: 0.8, bottom: 0.8, left: 2, right: 2 }, textColor: 40 },
      headStyles: { fillColor: BLEU, textColor: 255, fontSize: 10, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    y = finY() + 4;
  }

  // 2. État actuel (automatique)
  autoTable(doc, {
    startY: y,
    head: [["État du site au moment du téléchargement", ""]],
    body: etatDuSite(db, espace).map(([a, b]) => [propre(a), propre(b)]),
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 1.5 },
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 10 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });
  y = finY() + 4;

  // 3. Dernières actions des admins (sans adresse email)
  const actions = (db.adminJournal || []).slice(0, 30).map((e) => [dateFr(e.at), propre((e.actions || []).slice(0, 4).join(" ; ")).slice(0, 220)]);
  if (actions.length) {
    autoTable(doc, {
      startY: y,
      head: [["Dernières actions dans l'admin", ""]],
      body: actions,
      theme: "striped",
      styles: { fontSize: 7.5, cellPadding: 1.2 },
      headStyles: { fillColor: [100, 116, 139], textColor: 255, fontSize: 10 },
      columnStyles: { 0: { cellWidth: 28 } },
      margin: { left: 14, right: 14 },
    });
    y = finY() + 4;
  }

  // 4. Points de retour + historique (automatique, généré à chaque mise en ligne)
  autoTable(doc, {
    startY: y,
    head: [["Points de retour (tags git)", "Créé le"]],
    body: h.pointsDeRetour.length ? h.pointsDeRetour.map((p) => [p.nom, p.date]) : [["(aucun)", ""]],
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 1.2 },
    headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 10 },
    margin: { left: 14, right: 14 },
  });
  y = finY() + 4;
  autoTable(doc, {
    startY: y,
    head: [[`Historique des modifications (${h.modifications.length} plus récentes sur ${h.nbModifications})`, "", ""]],
    body: h.modifications.map((c) => [c.date, c.hash, propre(c.message)]),
    theme: "striped",
    styles: { fontSize: 7.5, cellPadding: 1.1 },
    headStyles: { fillColor: BLEU, textColor: 255, fontSize: 10 },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 15, font: "courier" } },
    margin: { left: 14, right: 14 },
  });

  // Numéros de page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text(`SACCB - fiche du site · page ${i}/${n}`, 105, 290, { align: "center" });
  }

  doc.setProperties({ title: "SACCB - Fiche du site pour Claude" });
  if (apercu) return doc.output("arraybuffer");
  doc.save(`saccb_fiche_du_site_${new Date().toISOString().slice(0, 10)}.pdf`);
}
