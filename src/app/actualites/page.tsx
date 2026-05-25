import type { Metadata } from "next";
import Site from "@/components/Site";

export const metadata: Metadata = {
  title: "Actualités du SACCB — Badminton Sainte-Adresse",
  description:
    "Toutes les actualités de l'association de badminton de Sainte-Adresse (SACCB) : événements, photos, résultats de tournois, vie du club.",
  alternates: { canonical: "https://saccb.fr/actualites" },
  openGraph: {
    title: "Actualités — SACCB Badminton Sainte-Adresse",
    description: "Les dernières actualités de l'association de badminton de Sainte-Adresse.",
    url: "https://saccb.fr/actualites",
    type: "website",
  },
};

export default function ActualitesPage() {
  return <Site mode="actualites" />;
}
