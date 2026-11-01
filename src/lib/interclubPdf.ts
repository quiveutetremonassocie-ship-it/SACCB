// 📄 Résultat final d'un tournoi inter-clubs en PDF (classement de toutes les équipes)
import { InterClub } from "./types";
import { classementFinal, equipesDuTournoi, formatTexte } from "./interclubLive";

const BLEU: [number, number, number] = [30, 58, 95];
// La police standard du PDF ne connaît pas les lettres en exposant (2ᵉ, 1ʳᵉ) ni les emojis
const pdfTexte = (x: string) => x.replace(/\u1D49/g, "e").replace(/\u02B3/g, "r").replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, "").trim();

export async function exporterResultatsPdf(t: InterClub) {
  const live = t.live;
  if (!live) return;
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const eq = equipesDuTournoi(t);
  const nom = (id: string) => (eq[id] ? `${eq[id].joueur1} / ${eq[id].joueur2}` : "Équipe retirée");
  const club = (id: string) => eq[id]?.club || "";
  const finY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // En-tête
  doc.setFontSize(18);
  doc.setTextColor(...BLEU);
  doc.text(t.name, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(90);
  const date = t.date ? new Date(t.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  doc.text([date, t.salleNom].filter(Boolean).join(" · "), 14, 25);
  doc.text(`${Object.keys(eq).length} équipes · ${t.clubs.length} clubs · ${live.termine ? "résultats définitifs" : "résultats provisoires"}`, 14, 30);
  let y = 36;

  // Classement final
  const derniere = live.phases[live.phases.length - 1];
  if (derniere) {
    doc.setFontSize(13);
    doc.setTextColor(...BLEU);
    doc.text(live.termine ? "Classement final" : "Classement provisoire (tournoi en cours)", 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Place", "Équipe", "Club"]],
      body: classementFinal(derniere).map((id, i) => [String(i + 1), nom(id), club(id)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: BLEU },
      columnStyles: { 0: { cellWidth: 16, halign: "center", fontStyle: "bold" } },
      didParseCell: (d) => {
        if (d.section === "body" && d.row.index < 3) d.cell.styles.fillColor = [[255, 236, 179], [226, 232, 240], [254, 215, 170]][d.row.index] as [number, number, number];
      },
    });

  }

  // Pied de page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`SACCB — Sainte-Adresse Club Compétition Badminton · généré le ${new Date().toLocaleString("fr-FR")} · page ${i}/${n}`, 14, 290);
  }
  const fichier = t.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  doc.save(`resultats_${fichier || "tournoi"}.pdf`);
}

// 📋 Tous les scores de chaque match (tour par tour, poule par poule) : de quoi tout ressaisir si on doit relancer le tournoi
export async function exporterScoresPdf(t: InterClub, apercu = false): Promise<ArrayBuffer | void> {
  const live = t.live;
  if (!live) return;
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const eq = equipesDuTournoi(t);
  const nom = (id: string) => (eq[id] ? `${eq[id].joueur1} / ${eq[id].joueur2}` : "Équipe retirée");
  const club = (id: string) => eq[id]?.club || "";
  const finY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFontSize(18);
  doc.setTextColor(...BLEU);
  doc.text(pdfTexte(`${t.name} — tous les scores`), 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Relevé du ${new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })} · ${live.phases.length} tour(s) · ${live.termine ? "tournoi terminé" : "tournoi en cours"}`, 14, 25);
  let y = 32;

  for (const ph of live.phases) {
    if (y > 250) { doc.addPage(); y = 18; }
    doc.setFontSize(14);
    doc.setTextColor(...BLEU);
    doc.text(pdfTexte(`${ph.nom} — ${formatTexte(ph.format)}`), 14, y);
    y += 4;
    for (const p of ph.poules) {
      const lignes = p.matchs.map((m, i) => {
        const score = m.forfait
          ? `Forfait de ${eq[m.forfait]?.joueur1 || "?"} / ${eq[m.forfait]?.joueur2 || "?"}`
          : m.sa && m.sb && m.sa.length ? m.sa.map((v, k) => `${v}-${m.sb![k]}`).join("  ") : "";
        const etat = m.forfait ? "forfait" : !m.sa?.length ? "à jouer" : m.etat === "valide" || m.par === "admin" ? "validé" : m.conteste ? "contesté" : "à confirmer";
        return [String(i + 1), `${nom(m.a)}\n${club(m.a)}`, score, `${nom(m.b)}\n${club(m.b)}`, etat];
      });
      autoTable(doc, {
        startY: y + 2,
        head: [[{ content: p.nom + ((p.retirees || []).length ? `  (abandon : ${(p.retirees || []).map(nom).join(", ")})` : "") + (p.ordreManuel?.length ? "  (classement ajusté à la main)" : ""), colSpan: 5 }], ["#", "Équipe 1", "Score", "Équipe 2", "État"]],
        body: lignes,
        styles: { fontSize: 9, cellPadding: 1.8, valign: "middle" },
        headStyles: { fillColor: BLEU },
        columnStyles: { 0: { cellWidth: 8, halign: "center" }, 2: { cellWidth: 34, halign: "center", fontStyle: "bold" }, 4: { cellWidth: 22, halign: "center" } },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index === 4 && d.cell.raw === "à jouer") d.cell.styles.textColor = [150, 150, 150];
          if (d.section === "body" && d.column.index === 4 && d.cell.raw === "contesté") d.cell.styles.textColor = [200, 30, 30];
        },
        margin: { left: 14, right: 14 },
      });
      y = finY() + 5;
    }
    y += 4;
  }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`SACCB — relevé des scores · ${t.name} · page ${i}/${n}`, 14, 290);
  }
  const fichier = t.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  if (apercu) return doc.output("arraybuffer");
  doc.save(`scores_${fichier || "tournoi"}.pdf`);
}
