import type { Metadata } from "next";
import Site from "@/components/Site";

export const metadata: Metadata = {
  title: "Tournois de badminton — SACCB Sainte-Adresse",
  description:
    "Tournois de badminton de l'association SACCB de Sainte-Adresse : inscriptions, dates, résultats. Doubles mixtes, hommes, dames.",
  alternates: { canonical: "https://saccb.fr/tournois" },
  openGraph: {
    title: "Tournois — SACCB Badminton Sainte-Adresse",
    description: "Inscriptions et résultats des tournois de badminton du SACCB.",
    url: "https://saccb.fr/tournois",
    type: "website",
  },
};

export default function TournoisPage() {
  return <Site mode="tournois" />;
}
