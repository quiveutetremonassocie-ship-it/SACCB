"use client";

import ClassementBwf, { ClassementApercu } from "./ClassementBwf";
import { ageEnJours, type ClassementStocke } from "@/lib/classementBwf";

/**
 * 🏸 Classement mondial sur la page d'accueil. Les données viennent de la base (relevées chaque jour par le serveur).
 * - haut : petit podium du simple hommes + bouton qui descend vers le bloc complet
 * - sinon : le bloc complet (5 disciplines, dernières finales, prochains tournois)
 * Tout est masqué si on n'a rien, ou si TOUS les classements ont plus de 4 semaines (source Wikipédia en panne) :
 * mieux vaut ne rien afficher qu'un classement périmé.
 */
export default function ClassementAccueil({ data, haut = false }: { data?: ClassementStocke | null; haut?: boolean }) {
  if (!data) return null;
  const dates = Object.values(data.disciplines).map((d) => d?.date).filter((d): d is string => !!d);
  if (dates.length === 0 || dates.every((d) => ageEnJours(d) > 28)) return null;
  if (haut) return <ClassementApercu disciplines={data.disciplines} photos={data.photos ?? {}} />;
  return <ClassementBwf disciplines={data.disciplines} erreurs={data.erreurs} photos={data.photos ?? {}} calendrier={data.calendrier ?? []} />;
}
