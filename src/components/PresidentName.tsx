"use client";

import { useEffect, useState } from "react";
import { fetchPublicDB } from "@/lib/db";

/**
 * Composant client qui affiche le nom du président depuis la DB.
 * Fallback affiché pendant le chargement et si aucun nom n'est configuré.
 */
export default function PresidentName({ fallback = "Le/La Président(e) en exercice" }: { fallback?: string }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicDB()
      .then((db) => {
        if (db.presidentName?.trim()) setName(db.presidentName.trim());
      })
      .catch(() => {});
  }, []);

  return <>{name || fallback}</>;
}
