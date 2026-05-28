import type { Metadata } from "next";
import Site from "@/components/Site";

export const metadata: Metadata = {
  title: "Contact — SACCB Badminton Sainte-Adresse",
  description:
    "Contactez l'association de badminton de Sainte-Adresse (SACCB). Questions sur les entraînements, l'adhésion, les tournois — Salle Paul Vatine, Sainte-Adresse.",
  alternates: { canonical: "https://saccb.fr/contact" },
  openGraph: {
    title: "Contact — SACCB Badminton Sainte-Adresse",
    description: "Contactez l'association de badminton de Sainte-Adresse.",
    url: "https://saccb.fr/contact",
    type: "website",
  },
};

export default function ContactPage() {
  return <Site mode="contact" />;
}
