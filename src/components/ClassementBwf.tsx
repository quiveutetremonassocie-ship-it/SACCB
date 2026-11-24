"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  DISCIPLINES, SOURCE_BWF, SOURCE_WIKIPEDIA, ageEnJours, nomsDePays,
  type ClassementDiscipline, type Discipline, type LigneClassement,
} from "@/lib/classementBwf";
import type { PhotoJoueur } from "@/lib/photosBwf";
import { derniersResultats, prochainsTournois, urlCalendrierWikipedia, type TournoiBwf } from "@/lib/calendrierBwf";

// 🏸 Classement mondial BWF : le top 3 de chaque discipline, sous forme de podium.
// Composant d'affichage uniquement : les données (et les photos) lui sont données.
// Podium dès 480 px de large (portraits réduits), plus grand dès 768 px ; en dessous (téléphone) : liste 1, 2, 3.

type Props = {
  disciplines: Partial<Record<Discipline, ClassementDiscipline>>;
  erreurs?: Partial<Record<Discipline, string>>;
  photos: Record<string, PhotoJoueur>;
  calendrier?: TournoiBwf[];
  chargement?: boolean;
};

// Chaque marche du podium a sa couleur de médaille et sa hauteur
const MARCHES: Record<number, { anneau: string; fond: string; marche: string; hauteur: string; delai: number }> = {
  1: { anneau: "ring-amber-400", fond: "from-amber-50 to-white", marche: "from-amber-400 to-amber-500", hauteur: "min-[480px]:h-24 md:h-28", delai: 0.25 },
  2: { anneau: "ring-slate-300", fond: "from-slate-100 to-white", marche: "from-slate-300 to-slate-400", hauteur: "min-[480px]:h-16 md:h-20", delai: 0.1 },
  3: { anneau: "ring-orange-300", fond: "from-orange-50 to-white", marche: "from-orange-300 to-orange-400", hauteur: "min-[480px]:h-10 md:h-14", delai: 0 },
};

const dateLongue = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const initiales = (nom: string) => nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join("").toUpperCase();

function Portrait({ nom, photo, taille, anneau, chevauche }: { nom: string; photo?: PhotoJoueur; taille: string; anneau: string; chevauche?: boolean }) {
  return (
    <div className={`${taille} shrink-0 rounded-full ring-4 ${anneau} ring-offset-2 ring-offset-white overflow-hidden bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] shadow-lg`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url} alt={nom} className="w-full h-full object-cover object-top" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        // Le 1er portrait d'un double est recouvert à droite par le 2e : on décale ses initiales pour qu'elles restent lisibles
        <div className={`w-full h-full flex items-center justify-center font-display text-xl md:text-2xl text-white/90 tracking-wider ${chevauche ? "pr-5 min-[480px]:pr-4 md:pr-7" : ""}`} aria-hidden="true">{initiales(nom)}</div>
      )}
    </div>
  );
}

function Colonne({ ligne, photos, sansAnimation }: { ligne: LigneClassement; photos: Record<string, PhotoJoueur>; sansAnimation: boolean }) {
  const m = MARCHES[ligne.rang];
  const double = ligne.joueurs.length > 1;
  const premier = ligne.rang === 1;
  // Podium : 2e à gauche, 1er au milieu, 3e à droite. Liste (téléphone) : 1, 2, 3 de haut en bas.
  const ordre = ligne.rang === 1 ? "min-[480px]:order-2" : ligne.rang === 2 ? "min-[480px]:order-1" : "min-[480px]:order-3";
  const tailleUnique = premier
    ? "w-36 h-36 min-[480px]:w-24 min-[480px]:h-24 md:w-44 md:h-44"
    : "w-28 h-28 min-[480px]:w-20 min-[480px]:h-20 md:w-36 md:h-36";
  const tailleDouble = premier
    ? "w-24 h-24 min-[480px]:w-16 min-[480px]:h-16 md:w-32 md:h-32"
    : "w-20 h-20 min-[480px]:w-14 min-[480px]:h-14 md:w-28 md:h-28";
  return (
    <div className={`${ordre} flex min-[480px]:flex-col items-center min-[480px]:items-stretch gap-4 min-[480px]:gap-0 min-[480px]:flex-1 min-[480px]:min-w-0 min-[480px]:max-w-[17rem] w-full`}>
      <div className={`flex-1 min-[480px]:flex-none rounded-2xl bg-gradient-to-b ${m.fond} border border-slate-200/80 px-4 min-[480px]:px-2 md:px-4 pt-5 pb-4 flex min-[480px]:flex-col items-center gap-4 min-[480px]:gap-3 shadow-sm`}>
        <div className="flex items-center justify-center shrink-0">
          {ligne.joueurs.map((nom, i) => (
            <div key={nom} className={i > 0 ? "-ml-5 min-[480px]:-ml-4 md:-ml-7" : ""}>
              <Portrait nom={nom} photo={photos[ligne.pages[i]]} taille={double ? tailleDouble : tailleUnique} anneau={m.anneau} chevauche={double && i === 0} />
            </div>
          ))}
        </div>
        <div className="min-w-0 min-[480px]:text-center">
          <p className="min-[480px]:hidden text-xs font-semibold text-slate-400 mb-0.5">{ligne.rang === 1 ? "1re place" : `${ligne.rang}e place`}</p>
          {ligne.joueurs.map((nom) => (
            <p key={nom} className="font-display text-lg min-[480px]:text-sm md:text-xl tracking-wide text-slate-800 leading-tight break-words">{nom}</p>
          ))}
          <p className="text-sm min-[480px]:text-xs md:text-sm text-slate-500 mt-1">{nomsDePays(ligne.pays)}</p>
          <p className="mt-2 text-slate-700">
            <span className="font-display text-2xl min-[480px]:text-lg md:text-2xl tabular-nums">{ligne.points.toLocaleString("fr-FR")}</span>
            <span className="text-xs text-slate-400 ml-1.5">points</span>
          </p>
        </div>
      </div>
      {/* La marche du podium : elle se redresse quand on change de discipline */}
      <motion.div
        aria-hidden="true"
        className={`hidden min-[480px]:flex ${m.hauteur} mt-2 rounded-t-xl bg-gradient-to-b ${m.marche} items-start justify-center pt-2 origin-bottom shadow-inner`}
        initial={sansAnimation ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.55, delay: m.delai, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <span className="font-display text-3xl md:text-4xl text-white/90 drop-shadow">{ligne.rang}</span>
      </motion.div>
    </div>
  );
}

// Couleur du badge selon le niveau du tournoi (Super 1000 = le plus prestigieux)
const COULEURS_NIVEAU: [RegExp, string][] = [
  [/1000/, "bg-amber-100 text-amber-800 border-amber-300"],
  [/750/, "bg-violet-100 text-violet-800 border-violet-300"],
  [/500/, "bg-sky-100 text-sky-800 border-sky-300"],
  [/300/, "bg-teal-100 text-teal-800 border-teal-300"],
  [/100/, "bg-slate-100 text-slate-700 border-slate-300"],
  [/final/i, "bg-rose-100 text-rose-800 border-rose-300"],
];
const couleurNiveau = (niveau: string) => COULEURS_NIVEAU.find(([re]) => re.test(niveau))?.[1] ?? "bg-slate-100 text-slate-700 border-slate-300";

/** « 3–8 novembre » ou « 28 novembre – 3 décembre » */
function periode(debut: string, fin: string): string {
  const d = new Date(debut + "T12:00:00");
  const f = new Date(fin + "T12:00:00");
  const mois = (x: Date) => x.toLocaleDateString("fr-FR", { month: "long" });
  return d.getMonth() === f.getMonth() ? `${d.getDate()}–${f.getDate()} ${mois(f)}` : `${d.getDate()} ${mois(d)} – ${f.getDate()} ${mois(f)}`;
}

function ProchainsTournois({ calendrier, discipline, titre }: { calendrier: TournoiBwf[]; discipline: Discipline; titre: string }) {
  const maintenant = new Date();
  const aujourdhui = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`;
  const prochains = prochainsTournois(calendrier, aujourdhui, 6, discipline);
  if (prochains.length === 0) return null;
  const annees = [...new Set(prochains.map((t) => Number(t.debut.slice(0, 4))))];
  return (
    <div className="mt-14">
      <div className="text-center mb-8">
        <h3 className="font-display text-2xl text-slate-800 mb-1">Les prochains tournois</h3>
        <p className="text-sm text-slate-500">{titre} : les compétitions où cette discipline est jouée.</p>
      </div>
      <ul className="grid gap-3 min-[560px]:grid-cols-2 lg:grid-cols-3">
        {prochains.map((t) => {
          const enCours = t.debut <= aujourdhui && aujourdhui <= t.fin;
          return (
            <li key={t.nom + t.debut} className="rounded-2xl bg-white/80 border border-slate-200/80 p-4 flex flex-col gap-2 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-xl text-slate-800 tracking-wide leading-tight">{periode(t.debut, t.fin)}</p>
                {enCours && (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    En cours
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 leading-snug">{t.nom}</p>
                <p className="text-sm text-slate-500">{[t.ville, t.pays].filter(Boolean).join(", ")}</p>
              </div>
              <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold rounded-full border px-2.5 py-0.5 ${couleurNiveau(t.niveau)}`}>{t.niveau}</span>
                {t.tableaux?.[discipline] && (
                  <span className="text-xs text-slate-500">{t.tableaux[discipline]} {DISCIPLINES.find((d) => d.id === discipline)?.paire ? "paires" : "joueurs"}</span>
                )}
              </div>
              {t.tableaux && (
                <div className="flex flex-wrap gap-1 pt-1" aria-label="Disciplines jouées">
                  {DISCIPLINES.filter((d) => t.tableaux![d.id]).map((d) => (
                    <span
                      key={d.id}
                      className={`text-[11px] rounded-md px-1.5 py-0.5 border ${d.id === discipline ? "bg-[#1e3a5f] text-white border-[#1e3a5f] font-semibold" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                    >
                      {d.titre}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-center text-xs text-slate-500 mt-4">
        Calendrier des tournois du BWF World Tour publié par la BWF, relevé via{" "}
        {annees.map((a, i) => (
          <span key={a}>
            {i > 0 && " et "}
            <a href={urlCalendrierWikipedia(a)} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700">Wikipédia {a}</a>
          </span>
        ))}
        . Les dates peuvent encore être modifiées par les organisateurs.
      </p>
    </div>
  );
}

/** « 17–22 novembre » → « 22 novembre » : on n'indique que la fin du tournoi */
const jourFin = (fin: string) => new Date(fin + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/** « 13–21, 21–18, 21–14 » (du point de vue du vainqueur) → [[13,21],[21,18],[21,14]] ; null si ce n'est pas une suite de manches */
function lireManches(score: string): [number, number][] | null {
  const manches = score.split(/\s*,\s*/).map((m) => m.match(/^(\d{1,2})\s*[–-]\s*(\d{1,2})$/));
  if (manches.length === 0 || manches.some((m) => !m)) return null;
  return manches.map((m) => [Number(m![1]), Number(m![2])]);
}

function LigneJoueurs({ noms, top3, vainqueur, manches }: { noms: string[]; top3: Map<string, number>; vainqueur: boolean; manches: number[] | null }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 ${vainqueur ? "bg-emerald-50/80" : ""}`}>
      <span className="w-5 shrink-0 text-center" aria-hidden="true">{vainqueur ? "🏆" : ""}</span>
      <div className="min-w-0 flex-1">
        <p className={`leading-snug ${vainqueur ? "font-semibold text-slate-900" : "text-slate-600"}`}>
          <span className="sr-only">{vainqueur ? "Vainqueur : " : "Perdant de la finale : "}</span>
          {noms.map((n, i) => (
            <span key={n}>
              {i > 0 && " / "}
              {n}
              {top3.get(n) && <span className="ml-1.5 align-middle text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-px whitespace-nowrap">n°{top3.get(n)} mondial</span>}
            </span>
          ))}
        </p>
      </div>
      {manches && (
        <div className="flex gap-1.5 shrink-0">
          {manches.map((pts, i) => (
            <span key={i} className={`w-8 text-center tabular-nums rounded-md py-0.5 ${vainqueur ? "bg-emerald-600 text-white font-bold" : "bg-slate-100 text-slate-600"}`}>{pts}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function DerniersVainqueurs({ calendrier, discipline, titre, top3 }: { calendrier: TournoiBwf[]; discipline: Discipline; titre: string; top3: Map<string, number> }) {
  const maintenant = new Date();
  const aujourdhui = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`;
  const lignes = derniersResultats(calendrier, discipline, aujourdhui, 4);
  if (lignes.length === 0) return null;
  return (
    <div className="mt-10">
      <h3 className="font-display text-2xl text-center text-slate-800 mb-1">Les dernières finales</h3>
      <p className="text-center text-sm text-slate-500 mb-4">{titre} : le vainqueur est en vert, avec le score de chaque manche.</p>
      <ul className="space-y-3">
        {lignes.map((t) => {
          const manches = lireManches(t.finale.score);
          const forfait = /walkover|retired|w\/o/i.test(t.finale.score);
          return (
            <li key={t.nom + t.debut} className="rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 px-3 pt-3 pb-1.5">
                <p className="font-semibold text-slate-800 leading-snug">{t.nom}</p>
                <p className="text-xs text-slate-500 shrink-0">{t.niveau} · {jourFin(t.fin)}</p>
              </div>
              <div className="divide-y divide-slate-100 text-sm">
                <LigneJoueurs noms={t.finale.champions} top3={top3} vainqueur manches={manches ? manches.map((m) => m[0]) : null} />
                <LigneJoueurs noms={t.finale.finalistes} top3={top3} vainqueur={false} manches={manches ? manches.map((m) => m[1]) : null} />
              </div>
              {!manches && <p className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50">{forfait ? "Finale non jouée jusqu'au bout (forfait ou abandon)." : `Score : ${t.finale.score}`}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ClassementBwf({ disciplines, erreurs = {}, photos, calendrier = [], chargement }: Props) {
  const [actif, setActif] = useState<Discipline>("SH");
  const sansAnimation = !!useReducedMotion();
  const courant = disciplines[actif];
  const age = courant ? ageEnJours(courant.date) : 0;
  const defini = DISCIPLINES.find((d) => d.id === actif)!;
  const top3 = new Map<string, number>();
  courant?.lignes.forEach((l) => l.joueurs.forEach((n) => top3.set(n, l.rang)));
  const credits = courant
    ? courant.lignes.flatMap((l) => l.pages.map((p, i) => ({ cle: p, nom: l.joueurs[i], photo: photos[p] }))).filter((c) => c.photo)
    : [];

  return (
    <section id="classement-mondial" className="bg-section-wrap relative scroll-mt-16">
      <div className="section-pad relative">
        <div className="text-center mb-10">
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-cyan-600">Le badminton dans le monde</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl h-display mb-3">Classement mondial</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">Les trois meilleurs de chaque discipline, mis à jour chaque semaine.</p>
        </div>

        <div role="tablist" aria-label="Discipline" className="flex flex-wrap justify-center gap-2 mb-10">
          {DISCIPLINES.map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={actif === d.id}
              onClick={() => setActif(d.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${
                actif === d.id
                  ? "bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8e] text-white shadow-md"
                  : "bg-white/80 text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              {d.titre}
            </button>
          ))}
        </div>

        <div role="tabpanel" aria-label={defini.titre} className="max-w-4xl mx-auto min-h-[24rem]">
          {chargement && !courant ? (
            <div className="flex flex-col min-[480px]:flex-row min-[480px]:items-end min-[480px]:justify-center gap-4 animate-pulse" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className={`rounded-2xl bg-slate-200/70 w-full min-[480px]:flex-1 min-[480px]:max-w-[17rem] ${i === 1 ? "h-72" : "h-60"}`} />)}
            </div>
          ) : !courant ? (
            <div className="glass-strong p-8 text-center max-w-md mx-auto">
              <p className="font-display text-lg text-slate-700 tracking-wider mb-1">Classement indisponible pour le moment</p>
              <p className="text-sm text-slate-500">Cette catégorie n&apos;a pas pu être lue. Elle reviendra à la prochaine mise à jour.</p>
              {erreurs[actif] && <p className="text-[11px] text-slate-400 mt-2">({erreurs[actif]})</p>}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={actif} initial={sansAnimation ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <div className="flex flex-col min-[480px]:flex-row min-[480px]:items-end min-[480px]:justify-center gap-3 md:gap-5">
                  {courant.lignes.map((l) => <Colonne key={l.rang} ligne={l} photos={photos} sansAnimation={sansAnimation} />)}
                </div>
                <p className="text-center text-sm text-slate-500 mt-6">
                  Classement du {dateLongue(courant.date)}
                  {age > 28 && <span className="block text-amber-600 text-xs mt-1">Ce classement date de plus de 4 semaines : il n&apos;a pas été mis à jour récemment.</span>}
                </p>
                <DerniersVainqueurs calendrier={calendrier} discipline={actif} titre={defini.titre} top3={top3} />
                <ProchainsTournois calendrier={calendrier} discipline={actif} titre={defini.titre} />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <div className="max-w-2xl mx-auto mt-8 text-center text-xs text-slate-500 leading-relaxed">
          <p>
            Source : classement mondial officiel de la BWF (
            <a href={SOURCE_BWF} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700">bwfbadminton.com/rankings</a>
            ), relevé chaque semaine via{" "}
            <a href={SOURCE_WIKIPEDIA} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700">Wikipédia</a>
            {" "}(licence CC BY-SA). Photos : Wikimedia Commons.
          </p>
          {credits.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer hover:text-slate-700">Crédits des photos</summary>
              <ul className="mt-2 space-y-1 text-left inline-block">
                {credits.map((c) => (
                  <li key={c.cle}>
                    {c.nom} : {c.photo!.auteur},{" "}
                    {c.photo!.licenceUrl
                      ? <a href={c.photo!.licenceUrl} target="_blank" rel="noopener noreferrer" className="underline">{c.photo!.licence}</a>
                      : c.photo!.licence}
                    {" "}(<a href={c.photo!.fichierUrl} target="_blank" rel="noopener noreferrer" className="underline">voir la photo</a>)
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

/** Petit aperçu pour le haut de la page d'accueil : le top 3 du simple hommes + un bouton qui descend vers tous les podiums. */
export function ClassementApercu({ disciplines, photos }: { disciplines: Partial<Record<Discipline, ClassementDiscipline>>; photos: Record<string, PhotoJoueur> }) {
  const sansAnimation = !!useReducedMotion();
  const sh = disciplines.SH;
  if (!sh) return null;
  const descendre = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const cible = document.getElementById("classement-mondial");
    if (!cible) return; // le lien #classement-mondial fait le travail
    e.preventDefault();
    cible.scrollIntoView({ behavior: sansAnimation ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", "#classement-mondial");
  };
  return (
    <section aria-label="Classement mondial, aperçu" className="px-4 py-8">
      <div className="max-w-3xl mx-auto rounded-3xl bg-white/90 border border-slate-200/80 shadow-sm px-4 sm:px-8 py-6">
        <p className="text-center font-display text-xl sm:text-2xl text-slate-800 tracking-wide">Classement mondial</p>
        <p className="text-center text-sm text-slate-500 mb-5">Les 3 meilleurs joueurs du monde en simple hommes</p>
        {/* Podium : le 1er au milieu, plus haut ; le 2e à gauche, le 3e à droite */}
        <ol className="grid grid-cols-3 items-end gap-2 sm:gap-5 max-w-xl mx-auto">
          {sh.lignes.map((l) => {
            const m = MARCHES[l.rang];
            const premier = l.rang === 1;
            const ordre = l.rang === 1 ? "order-2" : l.rang === 2 ? "order-1" : "order-3";
            const marche = l.rang === 1 ? "h-16 sm:h-20" : l.rang === 2 ? "h-11 sm:h-14" : "h-8 sm:h-10";
            return (
              <li key={l.rang} className={`${ordre} flex flex-col items-center text-center min-w-0`}>
                <Portrait nom={l.joueurs[0]} photo={photos[l.pages[0]]} taille={premier ? "w-20 h-20 sm:w-28 sm:h-28" : "w-14 h-14 sm:w-20 sm:h-20"} anneau={m.anneau} />
                <p className="mt-3 font-display text-sm sm:text-lg text-slate-800 leading-tight break-words">{l.joueurs[0]}</p>
                <p className="text-[11px] sm:text-xs text-slate-500 tabular-nums mb-2">{l.points.toLocaleString("fr-FR")} points</p>
                <div aria-hidden="true" className={`w-full ${marche} rounded-t-lg bg-gradient-to-b ${m.marche} flex items-start justify-center pt-1 shadow-inner`}>
                  <span className="font-display text-xl sm:text-3xl text-white/90 drop-shadow">{l.rang}</span>
                </div>
                <span className="sr-only">{l.rang === 1 ? "1re place" : `${l.rang}e place`}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 text-center">
          <a
            href="#classement-mondial"
            onClick={descendre}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8e] text-white text-sm font-semibold px-5 py-2.5 shadow-md hover:shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
          >
            Voir les podiums des 5 disciplines
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        </div>
      </div>
    </section>
  );
}
