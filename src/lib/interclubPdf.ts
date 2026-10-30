// 📄 Résultat final d'un tournoi inter-clubs en PDF (classement de toutes les équipes)
import { InterClub } from "./types";
import { classementFinal, equipesDuTournoi } from "./interclubLive";

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
