"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { nomsCourtsUniques } from "@/lib/types";

const simple = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * 👤 Champ « joueur » (admin et inscription des adhérents) : propose les adhérents (affichés « Prénom N. ») pendant la saisie,
 * en cherchant dans le prénom comme dans le nom. La valeur gardée reste le nom COMPLET (indispensable
 * pour les rappels et « Mes tournois »). On peut aussi taper librement quelqu'un d'extérieur au club.
 * La liste s'ouvre sous le champ (sans flotter) pour fonctionner partout, y compris sur téléphone.
 */
export default function ChampAdherent({ value, onChange, noms: tousLesNoms, placeholder, autoFocus, className = "input !text-sm w-full" }: {
  value: string;
  onChange: (v: string) => void;
  noms: string[]; // noms complets des adhérents
  placeholder: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const idListe = useId();

  const courts = useMemo(() => nomsCourtsUniques(tousLesNoms), [tousLesNoms]);
  const noms = useMemo(() => [...courts.keys()].sort((a, b) => a.localeCompare(b, "fr")), [courts]);
  const choisi = courts.has(value.trim());
  // Champ vide ou adhérent déjà choisi : toute la liste. Sinon : chaque mot tapé doit débuter un prénom ou un nom
  const mots = choisi ? [] : simple(value).replace(/\./g, "").split(/\s+/).filter(Boolean);
  const propositions = noms.filter((n) => {
    const parties = simple(n).split(/[\s-]+/);
    return mots.every((m) => simple(n).startsWith(m) || parties.some((p) => p.startsWith(m)));
  });
  const visible = ouvert && propositions.length > 0;

  // En revenant sur un adhérent déjà choisi, tout est sélectionné : taper le remplace.
  // Uniquement à l'ouverture de la liste, jamais pendant la frappe.
  useEffect(() => {
    if (ouvert && courts.has(value.trim())) champ.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  function choisir(nom: string) {
    onChange(nom);
    setOuvert(false);
    champ.current?.blur();
  }

  return (
    <div className="min-w-0">
      <input
        ref={champ}
        className={className}
        placeholder={placeholder}
        aria-label={placeholder}
        // Pendant la saisie on voit ce qu'on tape ; ensuite « Prénom N. »
        value={ouvert ? value : courts.get(value.trim()) ?? value}
        onChange={(e) => { onChange(e.target.value); setOuvert(true); setActif(0); }}
        onFocus={() => { setOuvert(true); setActif(0); }}
        onMouseUp={(e) => { if (choisi) e.preventDefault(); }}
        onBlur={() => setOuvert(false)}
        onKeyDown={(e) => {
          if (!visible) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActif((a) => Math.min(a + 1, propositions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActif((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); choisir(propositions[actif] ?? propositions[0]); }
          else if (e.key === "Escape") { e.preventDefault(); setOuvert(false); }
        }}
        role="combobox"
        aria-expanded={visible}
        aria-controls={idListe}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {visible && (
        <ul id={idListe} role="listbox" className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-md">
          {propositions.map((n, i) => (
            <li key={n} role="option" aria-selected={i === actif}>
              <button
                type="button"
                tabIndex={-1}
                // empêche le champ de perdre le focus avant le clic
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(n)}
                onMouseEnter={() => setActif(i)}
                ref={i === actif ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                className={`block w-full text-left px-3 py-2 text-sm ${i === actif ? "bg-blue-50 text-blue-800" : "text-slate-700"}`}
              >
                {courts.get(n)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Les deux joueurs d'un binôme enregistré sous la forme « Joueur 1 / Joueur 2 » */
export function ChampsBinome({ value, onChange, noms }: { value: string; onChange: (v: string) => void; noms: string[] }) {
  const coupe = value.indexOf("/");
  const j1 = coupe < 0 ? value : value.slice(0, coupe).replace(/ $/, "");
  const j2 = coupe < 0 ? "" : value.slice(coupe + 1).replace(/^ /, "");
  return (
    <div className="grid grid-cols-2 gap-2 items-start">
      <ChampAdherent noms={noms} placeholder="Joueur 1" value={j1} onChange={(v) => onChange(`${v} / ${j2}`)} />
      <ChampAdherent noms={noms} placeholder="Joueur 2" value={j2} onChange={(v) => onChange(`${j1} / ${v}`)} />
    </div>
  );
}

/** « A /  » → « A » : retire les espaces et la barre en trop avant d'enregistrer */
export const binomePropre = (v: string) => v.split("/").map((x) => x.trim()).filter(Boolean).join(" / ");
