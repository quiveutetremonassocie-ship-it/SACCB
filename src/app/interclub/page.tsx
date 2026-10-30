import type { Metadata } from "next";
import InterclubPage from "@/components/InterclubPage";

export const metadata: Metadata = {
  title: "Tournoi inter-clubs — SACCB Sainte-Adresse",
  description: "Inscription des équipes au tournoi inter-clubs organisé par le SACCB.",
  // Page accessible uniquement par lien privé : pas d'indexation
  robots: { index: false, follow: false },
};

export default function Page() {
  return <InterclubPage />;
}
