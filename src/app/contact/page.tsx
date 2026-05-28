import type { Metadata } from "next";
import Site from "@/components/Site";

export const metadata: Metadata = {
  title: "Contact — SACCB Badminton Sainte-Adresse | Salle Paul Vatine",
  description:
    "Contactez le SACCB, association de badminton de Sainte-Adresse. Salle Paul Vatine, 76310. Questions sur les entrainements, adhesion, tournois. Reponse rapide par email.",
  keywords: [
    "contact SACCB",
    "badminton Sainte-Adresse contact",
    "Salle Paul Vatine",
    "association badminton 76310",
    "SACCB email",
    "club badminton Normandie",
  ],
  alternates: { canonical: "https://saccb.fr/contact" },
  openGraph: {
    title: "Contact — SACCB Badminton Sainte-Adresse",
    description: "Contactez l'association de badminton de Sainte-Adresse. Salle Paul Vatine, 76310.",
    url: "https://saccb.fr/contact",
    type: "website",
  },
};

export default function ContactPage() {
  return <Site mode="contact" />;
}
