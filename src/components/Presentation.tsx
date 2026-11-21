"use client";

const POINTS = [
  { titre: "Convivialité", texte: "On vient pour jouer, rire et partager un bon moment entre amis." },
  { titre: "Tous niveaux", texte: "Débutant ou confirmé, chacun trouve sa place et ses partenaires." },
  { titre: "Des tournois", texte: "Tournois du club et entre clubs tout au long de l'année." },
  { titre: "Une équipe", texte: "Un bureau de bénévoles qui fait vivre l'association." },
];

/** 🏸 L'association : qui on est, en quelques mots et en chiffres réels */
export default function Presentation({ membresCount = 0, creneaux = 0 }: { membresCount?: number; creneaux?: number }) {
  return (
    <section id="presentation" className="bg-[#F2F6F9] scroll-mt-20" aria-labelledby="titre-asso">
      <div className="max-w-6xl mx-auto px-5 py-16 grid lg:grid-cols-[1.3fr_1fr] gap-12 items-start">
        <div className="space-y-5">
          <h2 id="titre-asso" className="font-display text-4xl md:text-5xl text-[#0F1B26] leading-[0.95]">Un club où chacun trouve sa place</h2>
          <p className="text-lg text-slate-700 max-w-[62ch]">
            Le SACCB est l&apos;une des associations de badminton de Sainte-Adresse. Débutant qui découvre le volant ou joueur
            qui enchaîne les tournois, tout le monde joue ensemble, surtout en double, dans une ambiance détendue.
          </p>
          {(membresCount > 0 || creneaux > 0) && (
            <div className="flex flex-wrap gap-x-10 gap-y-4 pt-2">
              {membresCount > 0 && (
                <p className="flex items-baseline gap-2"><b className="font-display text-6xl text-[#007DB0] leading-none tabular-nums">{membresCount}</b><span className="text-lg">adhérents<br />cette saison</span></p>
              )}
              {creneaux > 0 && (
                <p className="flex items-baseline gap-2"><b className="font-display text-6xl text-[#007DB0] leading-none tabular-nums">{creneaux}</b><span className="text-lg">créneaux<br />par semaine</span></p>
              )}
            </div>
          )}
        </div>

        <dl className="border-t-[3px] border-[#0F1B26]">
          {POINTS.map((p) => (
            <div key={p.titre} className="py-4 border-b border-[#D3DEE6] grid sm:grid-cols-[9rem_1fr] gap-x-4 gap-y-1">
              <dt className="font-display font-bold text-2xl text-[#0F1B26]">{p.titre}</dt>
              <dd className="text-slate-700">{p.texte}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
