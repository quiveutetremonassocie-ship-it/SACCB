import type { Metadata } from "next";
import Site from "@/components/Site";

export const metadata: Metadata = {
  title: "Inscription — SACCB Badminton Sainte-Adresse",
  description:
    "Inscription à l'association de badminton de Sainte-Adresse (SACCB). Adhésion adulte 50€, étudiant 30€. Paiement en ligne ou virement.",
  alternates: { canonical: "https://saccb.fr/inscription" },
  openGraph: {
    title: "Inscription — SACCB Badminton Sainte-Adresse",
    description: "Adhérez à l'association de badminton de Sainte-Adresse.",
    url: "https://saccb.fr/inscription",
    type: "website",
  },
};

export default function InscriptionPage() {
  return <Site mode="inscription" />;
}
