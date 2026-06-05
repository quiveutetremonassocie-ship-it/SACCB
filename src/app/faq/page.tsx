import type { Metadata } from "next";
import Site from "@/components/Site";

export const metadata: Metadata = {
  title: "FAQ — SACCB Badminton Sainte-Adresse | Questions fréquentes",
  description:
    "Toutes les réponses aux questions fréquentes sur le SACCB : inscription, paiement HelloAsso, tournois, espace membre, installation de l'app, code oublié.",
  keywords: [
    "FAQ SACCB",
    "questions badminton Sainte-Adresse",
    "aide adhésion SACCB",
    "code oublié SACCB",
    "comment s'inscrire badminton",
  ],
  alternates: { canonical: "https://saccb.fr/faq" },
  openGraph: {
    title: "FAQ — SACCB Badminton Sainte-Adresse",
    description: "Réponses aux questions fréquentes des adhérents SACCB.",
    url: "https://saccb.fr/faq",
    type: "website",
  },
};

export default function FaqPage() {
  return <Site mode="faq" />;
}
