// 📄 Résultats d'un tournoi inter-clubs en PDF (classement final + chaque phase, poule par poule)
import { InterClub } from "./types";
import { classementPoule, classementFinal, equipesDuTournoi, formatTexte, matchJoue } from "./interclubLive";

const BLEU: [number, number, number] = [30, 58, 95];

export async function exporterResultatsPdf(t: InterClub) {
  const live = t.live;
  if (!live) return;
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const eq = equipesDuTournoi(t);
  const nom = (id: string) => (eq[id] ? `${eq[id].joueur1} / ${eq[id].joueur2}` : "Équipe retirée");
  const club = (id: string) => eq[id]?.club || "";
  const score = (sa?: number[], sb?: number[]) => (sa && sb ? sa.map((v, i) => `${v}-${sb[i]}`).join("  ") : "");
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
  if (live.termine && derniere) {
    doc.setFontSize(13);
    doc.setTextColor(...BLEU);
    doc.text("Classement final", 14, y);
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
    y = finY() + 10;
  }

  // Chaque phase, poule par poule
  for (const ph of live.phases) {
    if (y > 250) { doc.addPage(); y = 18; }
    doc.setFontSize(13);
    doc.setTextColor(...BLEU);
    doc.text(`${ph.nom} — ${formatTexte(ph.format)}`, 14, y);
    y += 3;
    for (const p of ph.poules) {
      if (y > 240) { doc.addPage(); y = 18; }
      const retirees = new Set(p.retirees || []);
      autoTable(doc, {
        startY: y + 2,
        head: [[{ content: p.nom, colSpan: 7, styles: { halign: "left", fillColor: BLEU } }], ["#", "Équipe", "Club", "J", "V", "Sets", "Points"]],
        body: classementPoule(p).map((l, i) => [
          String(i + 1),
          nom(l.id) + (retirees.has(l.id) ? " (a arrêté)" : ""),
          club(l.id),
          String(l.joues),
          String(l.v),
          `${l.setsPour - l.setsContre > 0 ? "+" : ""}${l.setsPour - l.setsContre}`,
          `${l.ptsPour - l.ptsContre > 0 ? "+" : ""}${l.ptsPour - l.ptsContre}`,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [71, 85, 105] },
        columnStyles: { 0: { cellWidth: 9, halign: "center" }, 3: { cellWidth: 10, halign: "center" }, 4: { cellWidth: 10, halign: "center", fontStyle: "bold" }, 5: { cellWidth: 14, halign: "center" }, 6: { cellWidth: 16, halign: "center" } },
      });
      autoTable(doc, {
        startY: finY() + 1,
        body: p.matchs.map((m) => [
          nom(m.a),
          matchJoue(m) ? score(m.sa, m.sb) : "à jouer",
          nom(m.b),
          m.forfait ? `forfait ${nom(m.forfait)}` : m.etat === "valide" || m.par === "admin" ? "validé" : matchJoue(m) ? "non validé" : "",
        ]),
        styles: { fontSize: 8, textColor: 70 },
        columnStyles: { 0: { halign: "right" }, 1: { halign: "center", fontStyle: "bold", cellWidth: 30 }, 3: { cellWidth: 28, textColor: 130 } },
        theme: "plain",
      });
      y = finY() + 6;
    }
    y += 4;
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
