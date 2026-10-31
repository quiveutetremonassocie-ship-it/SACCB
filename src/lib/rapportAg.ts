// 📄 Rapport d'activité de la saison pour l'assemblée générale (PDF prêt à présenter)
import { DB, getMontantMembre } from "./types";
import { dateISO } from "./agenda";

const BLEU: [number, number, number] = [30, 58, 95];
const VERT: [number, number, number] = [16, 185, 129];
const GRIS: [number, number, number] = [100, 116, 139];

export type OptionsRapport = { finances: boolean; detailDepenses: boolean; palmares: boolean; tournois: boolean };

// Espaces insécables du format français → espaces simples (sinon jsPDF affiche « / »)
const euros = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0]/g, " ") + " €";
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) + " %" : "-");
// jsPDF (police standard) n'affiche pas les emojis : on les retire des textes saisis
const propre = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();
const joliDate = (iso: string) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");

function rang(r: string | null | undefined): { rank: number; total: number } | null {
  const m = (r || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  return m ? { rank: parseInt(m[1]), total: parseInt(m[2]) } : null;
}
const place = (n: number) => (n === 1 ? "1er" : `${n}e`);

async function logo(): Promise<string | null> {
  try {
    const blob = await (await fetch("/logo.png")).blob();
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(null); r.readAsDataURL(blob); });
  } catch { return null; }
}

/** Chiffres de la saison (utilisés aussi pour l'aperçu à l'écran) */
export function chiffresSaison(db: DB) {
  const debut = `${db.y1}-09-01`, fin = `${db.y2}-08-31`;
  const payes = db.membres.filter((m) => m.ok);
  const adultes = payes.filter((m) => m.type === "Adulte").length;
  const etudiants = payes.length - adultes;
  const femmes = payes.filter((m) => m.sexe === "F").length;
  const hommes = payes.filter((m) => m.sexe === "H").length;
  const recetteAdultes = payes.filter((m) => m.type === "Adulte").reduce((s, m) => s + getMontantMembre(db, m), 0);
  const recetteEtudiants = payes.filter((m) => m.type !== "Adulte").reduce((s, m) => s + getMontantMembre(db, m), 0);
  const report = db.reportPrecedent || 0;
  const depenses = (db.factures || []).reduce((s, f) => s + f.montant, 0);
  const tshirts = (db.tshirtOrders || []).length;

  // 📦 Tournois de la saison : ceux en cours + ceux déjà archivés pour CETTE saison
  const archiveSaison = (db.archives || []).find((a) => a.y1 === db.y1 && a.y2 === db.y2);
  const tousTournois = [...(db.config_tournois || []), ...(archiveSaison?.config_tournois || [])]
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);
  const tousInscrits = [...(db.inscrits_tournoi || []), ...(archiveSaison?.inscrits_tournoi || [])]
    .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i);

  // Tournois extérieurs (fiches « Tournois » + leurs inscriptions SACCB)
  const tournois = tousTournois.filter((t) => !t.id.startsWith("ic-")).map((t) => {
    const insc = tousInscrits.filter((i) => i.tournoiId === t.id);
    // Binôme le mieux classé du tournoi
    const meilleur = insc
      .map((i) => { const r = rang(i.resultat); return r ? { ...r, joueurs: propre(i.joueurs) } : null; })
      .filter(Boolean)
      .sort((a, b) => a!.rank - b!.rank)[0] || null;
    return { nom: propre(t.name), date: dateISO(t.date), dateTexte: t.date, equipes: insc.length, meilleur };
  }).sort((a, b) => (a.date || "9").localeCompare(b.date || "9"));
  const participations = tournois.reduce((s, t) => s + t.equipes, 0);

  // Tournois organisés par le club (inter-clubs et internes) dans la saison
  const organises = (db.interclubs || []).filter((t) => t.date >= debut && t.date <= fin && !/d[ée]mo/i.test(t.name)).map((t) => ({
    nom: propre(t.name),
    date: t.date,
    interne: t.interne === true,
    clubs: t.interne ? 1 : t.clubs.length,
    equipes: t.clubs.reduce((s, c) => s + c.binomes.length, 0),
    termine: !!t.live?.termine,
  })).sort((a, b) => a.date.localeCompare(b.date));

  // Palmarès : podiums de la saison
  const podiums = tousInscrits.map((i) => {
    const r = rang(i.resultat);
    const t = tousTournois.find((x) => x.id === i.tournoiId);
    return r && r.rank <= 3 && t ? { joueurs: propre(i.joueurs), tournoi: propre(t.name), date: dateISO(t.date), ...r } : null;
  }).filter(Boolean) as { joueurs: string; tournoi: string; date: string; rank: number; total: number }[];
  podiums.sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date));

  // Évolution du nombre d'adhérents (saisons archivées + saison en cours)
  const evolution = [...(db.archives || []).filter((a) => a !== archiveSaison).map((a) => ({ saison: `${a.y1}-${a.y2}`, n: a.membresCount })), { saison: `${db.y1}-${db.y2}`, n: payes.length }]
    .filter((x, i, arr) => arr.findIndex((y) => y.saison === x.saison) === i)
    .sort((a, b) => a.saison.localeCompare(b.saison))
    .slice(-6);

  const vieClub = {
    actualites: (db.actualites || []).length,
    sondages: (db.polls || []).length,
    evenements: (db.agendaEvents || []).filter((e) => e.date >= debut && e.date <= fin).length,
  };

  return { payes: payes.length, adultes, etudiants, femmes, hommes, recetteAdultes, recetteEtudiants, report, depenses, tshirts, tournois, participations, organises, podiums, evolution, vieClub };
}

export async function telechargerRapportAg(db: DB, opt: OptionsRapport, apercu = false): Promise<ArrayBuffer | void> {
  const c = chiffresSaison(db);
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const L = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const finY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let y = 0;
  const place_ = (h: number) => { if (y + h > H - 20) { doc.addPage(); y = 20; } };
  const titre = (t: string) => {
    place_(24);
    doc.setFillColor(...BLEU);
    doc.rect(14, y, 3, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...BLEU);
    doc.text(t, 20, y + 6.5);
    doc.setFont("helvetica", "normal");
    y += 13;
  };
  const tableau = (head: string[][], body: (string | number)[][], extra: Record<string, unknown> = {}) => {
    autoTable(doc, { startY: y, head, body: body.map((r) => r.map(String)), styles: { fontSize: 10, cellPadding: 2 }, headStyles: { fillColor: BLEU }, margin: { left: 14, right: 14 }, ...extra });
    y = finY() + 8;
  };

  // ── Couverture ──
  doc.setFillColor(...BLEU);
  doc.rect(0, 0, L, 52, "F");
  const img = await logo();
  if (img) { try { doc.addImage(img, "PNG", 14, 10, 32, 32); } catch { /* ignore */ } }
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("Rapport d'activité", img ? 52 : 14, 24);
  doc.setFont("helvetica", "normal"); doc.setFontSize(13);
  doc.text(`Saison ${db.y1}-${db.y2} · Badminton Sainte-Adresse (SACCB)`, img ? 52 : 14, 33);
  doc.setFontSize(10);
  doc.text(`Assemblée générale · document généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, img ? 52 : 14, 41);
  y = 64;

  // ── Chiffres clés (4 tuiles) ──
  const tuiles: [string, string][] = [
    [String(c.payes), "adhérents"],
    [String(c.participations), "participations en tournoi"],
    [String(c.organises.length), "tournois organisés"],
    [String(c.podiums.length), "podiums"],
  ];
  const w = (L - 28 - 9) / 4;
  tuiles.forEach(([v, l], i) => {
    const x = 14 + i * (w + 3);
    doc.setFillColor(241, 245, 249); doc.roundedRect(x, y, w, 26, 3, 3, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...BLEU);
    doc.text(v, x + w / 2, y + 12, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
    doc.text(doc.splitTextToSize(l, w - 4), x + w / 2, y + 19, { align: "center" });
  });
  y += 36;

  // ── 1. Adhérents ──
  titre("1. Les adhérents");
  tableau([["", "Nombre", "Part"]], [
    ["Adhérents à jour de cotisation", c.payes, "100 %"],
    ["Adultes", c.adultes, pct(c.adultes, c.payes)],
    ["Étudiants", c.etudiants, pct(c.etudiants, c.payes)],
    ...(c.femmes + c.hommes > 0 ? [["Femmes", c.femmes, pct(c.femmes, c.payes)], ["Hommes", c.hommes, pct(c.hommes, c.payes)]] : []),
  ], { columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } } });

  // Graphique : évolution sur les dernières saisons
  if (c.evolution.length > 1) {
    place_(62);
    doc.setFontSize(10); doc.setTextColor(...GRIS);
    doc.text("Évolution du nombre d'adhérents", 14, y);
    y += 4;
    const max = Math.max(...c.evolution.map((e) => e.n), 1);
    const hMax = 38, bw = Math.min(24, (L - 28) / c.evolution.length - 6);
    c.evolution.forEach((e, i) => {
      const x = 14 + i * (bw + 6) + 2;
      const h = (e.n / max) * hMax;
      const derniere = i === c.evolution.length - 1;
      doc.setFillColor(...(derniere ? VERT : BLEU));
      doc.rect(x, y + hMax - h, bw, h, "F");
      doc.setFontSize(9); doc.setTextColor(30);
      doc.text(String(e.n), x + bw / 2, y + hMax - h - 1.5, { align: "center" });
      doc.setFontSize(7.5); doc.setTextColor(...GRIS);
      doc.text(e.saison, x + bw / 2, y + hMax + 5, { align: "center" });
    });
    y += hMax + 14;
  }

  // ── 2. Tournois ──
  if (opt.tournois) {
    titre("2. Les tournois");
    if (c.tournois.length) {
      doc.setFontSize(10); doc.setTextColor(60);
      doc.text(`${c.tournois.length} tournoi(s) extérieur(s), ${c.participations} équipe(s) SACCB engagée(s).`, 14, y); y += 5;
      tableau([["Tournoi", "Date", "Équipes SACCB", "Meilleur binôme", "Place"]], c.tournois.map((t) => [
        t.nom, t.date ? joliDate(t.date) : t.dateTexte, t.equipes, t.meilleur ? t.meilleur.joueurs : "-", t.meilleur ? `${place(t.meilleur.rank)} / ${t.meilleur.total}` : "-",
      ]), { columnStyles: { 2: { halign: "center", cellWidth: 22 }, 4: { halign: "center", fontStyle: "bold", cellWidth: 20 } } });
    }
    if (c.organises.length) {
      doc.setFontSize(10); doc.setTextColor(60); place_(10);
      doc.text("Tournois organisés par le club :", 14, y); y += 5;
      tableau([["Tournoi", "Date", "Type", "Clubs", "Équipes"]], c.organises.map((t) => [
        t.nom, joliDate(t.date), t.interne ? "Entre adhérents" : "Inter-clubs", t.clubs, t.equipes,
      ]), { columnStyles: { 3: { halign: "center" }, 4: { halign: "center" } } });
    }
    if (!c.tournois.length && !c.organises.length) { doc.setFontSize(10); doc.setTextColor(...GRIS); doc.text("Aucun tournoi enregistré cette saison.", 14, y); y += 10; }
  }

  // ── 3. Palmarès ──
  if (opt.palmares && c.podiums.length) {
    titre(`${opt.tournois ? 3 : 2}. Le palmarès`);
    tableau([["Place", "Joueurs", "Tournoi", "Date"]], c.podiums.map((p) => [`${place(p.rank)} / ${p.total}`, p.joueurs, p.tournoi, joliDate(p.date)]),
      { columnStyles: { 0: { halign: "center", fontStyle: "bold" } } });
  }

  // ── Vie du club ──
  let n = 1 + (opt.tournois ? 1 : 0) + (opt.palmares && c.podiums.length ? 1 : 0) + 1;
  titre(`${n}. La vie du club`);
  tableau([["", "Nombre"]], [
    ["Actualités publiées", c.vieClub.actualites],
    ["Sondages proposés aux adhérents", c.vieClub.sondages],
    ["Événements du club dans l'agenda", c.vieClub.evenements],
    ["T-shirts du club commandés", c.tshirts],
  ], { columnStyles: { 1: { halign: "center" } } });

  // ── Bilan financier ──
  if (opt.finances) {
    n++;
    titre(`${n}. Le bilan financier`);
    const recettes = c.recetteAdultes + c.recetteEtudiants;
    tableau([["", "Montant"]], [
      ["Report de la saison précédente", euros(c.report)],
      [`Cotisations adultes (${c.adultes})`, euros(c.recetteAdultes)],
      [`Cotisations étudiants (${c.etudiants})`, euros(c.recetteEtudiants)],
      ["Total des recettes", euros(recettes + c.report)],
      ["Total des dépenses", euros(c.depenses)],
      ["Solde", euros(recettes + c.report - c.depenses)],
    ], {
      columnStyles: { 1: { halign: "right" } },
      didParseCell: (d: { section: string; row: { index: number }; cell: { styles: { fontStyle: string; fillColor?: number[] } } }) => {
        if (d.section === "body" && d.row.index >= 3) d.cell.styles.fontStyle = "bold";
        if (d.section === "body" && d.row.index === 5) d.cell.styles.fillColor = [220, 252, 231];
      },
    });
    if (opt.detailDepenses && (db.factures || []).length) {
      doc.setFontSize(10); doc.setTextColor(60); place_(10);
      doc.text("Détail des dépenses :", 14, y); y += 5;
      tableau([["Date", "Dépense", "Montant"]], [...db.factures].sort((a, b) => dateISO(a.date).localeCompare(dateISO(b.date))).map((f) => [
        dateISO(f.date) ? joliDate(dateISO(f.date)) : f.date, propre(f.desc), euros(f.montant),
      ]), { columnStyles: { 2: { halign: "right" } } });
    }
  }

  // ── Signature + pieds de page ──
  place_(8);
  doc.setFontSize(10); doc.setTextColor(60);
  doc.text(`Pour le bureau${db.presidentName ? `, ${propre(db.presidentName)}, président(e)` : ""}.`, 14, y + 4);
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(...GRIS);
    doc.text(`SACCB · Rapport d'activité ${db.y1}-${db.y2}`, 14, H - 8);
    doc.text(`${p} / ${pages}`, L - 14, H - 8, { align: "right" });
  }
  if (apercu) return doc.output("arraybuffer");
  doc.save(`Rapport-activite-SACCB-${db.y1}-${db.y2}.pdf`);
}
