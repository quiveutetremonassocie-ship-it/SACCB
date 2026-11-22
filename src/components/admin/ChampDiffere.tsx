"use client";

import { useEffect, useRef, useState } from "react";

// ✍️ Champ de texte qui garde la frappe sur place et n'enregistre qu'après une courte pause
// (ou quand on quitte le champ). Évite un envoi au serveur à chaque lettre.
export default function ChampDiffere({
  valeur,
  onSave,
  multiligne,
  delai = 900,
  className,
  ...reste
}: {
  valeur: string;
  onSave: (v: string) => void | Promise<void>;
  multiligne?: boolean;
  delai?: number;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  list?: string;
  "aria-label"?: string;
}) {
  const [texte, setTexte] = useState(valeur);
  const enCours = useRef(false); // l'utilisateur est en train d'écrire dans ce champ
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernierEnvoye = useRef(valeur);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  // Valeur changée ailleurs (autre admin, rechargement) : on la reprend si on n'est pas en train d'écrire
  useEffect(() => {
    if (!enCours.current) { setTexte(valeur); dernierEnvoye.current = valeur; }
  }, [valeur]);

  const envoyer = (v: string) => {
    if (minuteur.current) { clearTimeout(minuteur.current); minuteur.current = null; }
    if (v === dernierEnvoye.current) return;
    dernierEnvoye.current = v;
    void saveRef.current(v);
  };
  // Enregistre ce qui reste si le champ disparaît (actu repliée…)
  useEffect(() => () => { if (minuteur.current) { clearTimeout(minuteur.current); void saveRef.current(textePourDemontage.current); } }, []);
  const textePourDemontage = useRef(texte);
  textePourDemontage.current = texte;

  const props = {
    className,
    value: texte,
    onFocus: () => { enCours.current = true; },
    onBlur: () => { enCours.current = false; envoyer(texte); },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      setTexte(v);
      if (minuteur.current) clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => envoyer(v), delai);
    },
    ...reste,
  };
  return multiligne ? <textarea {...props} /> : <input {...props} />;
}
