"use client";

type Props = {
  seasonY1: number;
  seasonY2: number;
  inscOpen: boolean;
  isMember?: boolean;
  membresCount?: number;
  nextTournoi?: { name: string; date: string } | null;
  horaires?: { jour: string; heure: string }[];
  prixAdulte?: number;
  prixEtudiant?: number;
  salleNom?: string;
  salleAdresse?: string;
  onMember?: () => void;
  // Rubriques désactivées dans l'admin (false) : pas de lien vers elles
  rubriques?: Partial<Record<"actualites" | "horaires" | "tournois", boolean>>;
};

/** « 18h30 → Fermeture » → { debut: "18:30", fin: "jusqu'à la fermeture" } */
function lireCreneau(heure: string): { debut: string; fin: string } {
  const [avant, apres = ""] = heure.split(/→|->|–|-/).map((x) => x.trim());
  const h = avant.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  const debut = h ? `${h[1]}:${h[2] || "00"}` : avant;
  const hf = apres.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  const fin = /ferm/i.test(apres) ? "jusqu'à la fermeture" : hf ? `jusqu'à ${hf[1]}:${hf[2] || "00"}` : apres;
  return { debut, fin };
}

/** Date d'un tournoi lisible : « 2026-11-28 » ou « 28/11/2026 » → « 28 novembre » */
function jourMois(dateStr: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}/.test(dateStr) ? dateStr.slice(0, 10) : (() => {
    const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  })();
  if (!iso) return dateStr;
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/** 🏸 Accueil : grande photo de jeu, puis le « tableau de marque » des créneaux (horaires réglés dans l'admin) */
export default function AccueilHero({
  seasonY1, seasonY2, inscOpen, isMember = false, nextTournoi,
  horaires = [], salleNom, onMember, rubriques = {},
}: Props) {
  const voir = (r: "actualites" | "horaires" | "tournois") => rubriques[r] !== false;

  return (
    <>
      <section className="relative bg-[#0F1B26] text-white pt-[80px] overflow-hidden" aria-labelledby="titre-accueil">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/photos/accueil-smash.webp"
            alt="Un joueur saute pour frapper le volant dans une salle de badminton"
            width={1600}
            height={1067}
            className="w-full h-[560px] sm:h-[600px] lg:h-[640px] object-cover object-[70%_35%] lg:object-[62%_40%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#031A2C]/95 via-[#031A2C]/70 to-[#031A2C]/15 lg:bg-gradient-to-r lg:from-[#031A2C]/90 lg:via-[#031A2C]/60 lg:to-transparent" />
          <div className="absolute inset-0">
            <div className="max-w-6xl h-full mx-auto px-5 flex flex-col justify-end lg:justify-center gap-5 pb-10 lg:pb-0">
              {/* Statut des inscriptions : bien visible, couleur + texte (pas seulement la couleur) */}
              <p className={`self-start inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-base sm:text-lg font-bold ${inscOpen ? "bg-[#157A55] text-white" : "bg-[#C62828] text-white"}`}>
                <span className={`w-3 h-3 rounded-full ${inscOpen ? "bg-[#7FE0B4]" : "bg-[#FFB3B3]"}`} aria-hidden="true" />
                {inscOpen ? "Inscriptions ouvertes" : "Inscriptions fermées"} pour la saison {seasonY1}-{seasonY2}
              </p>
              <h1 id="titre-accueil" className="font-display text-[2.6rem] sm:text-6xl lg:text-[5.2rem] leading-[0.92] max-w-[14ch]">
                Le badminton à Sainte-Adresse, pour tous les niveaux
              </h1>
              <p className="text-lg text-[#E6EEF4] max-w-[38ch]">
                {horaires.length > 0 ? `${horaires.length === 3 ? "Trois" : horaires.length} soirs par semaine` : "Plusieurs soirs par semaine"} à la {salleNom || "salle Paul Vatine"}. On vient pour se dépenser, progresser et partir ensemble en tournoi.
              </p>
              <div className="flex flex-wrap gap-3 mt-1">
                {inscOpen && !isMember && (
                  <a href="/inscription" className="btn-primary !text-base !px-6">S&apos;inscrire pour la saison</a>
                )}
                {onMember && (
                  <button onClick={onMember} className={inscOpen && !isMember ? "btn !text-base !px-6 text-white border-2 border-white/80 hover:bg-white/10" : "btn-primary !text-base !px-6"}>
                    {isMember ? "Mon espace adhérent" : "Espace adhérent"}
                  </button>
                )}
              </div>
              {nextTournoi && voir("tournois") && (
                <a href="/tournois" className="text-[#E6EEF4] underline underline-offset-4 decoration-[#5CCBF7] hover:text-white self-start">
                  Prochain tournoi : {nextTournoi.name}, le {jourMois(nextTournoi.date)}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 🟦 Tableau de marque : les créneaux de jeu */}
      {horaires.length > 0 && (
        <section className="bg-[#00B0F0] text-[#04202E]" aria-label="Créneaux de jeu">
          <div className="max-w-6xl mx-auto px-5 grid grid-cols-3 lg:grid-cols-[auto_repeat(3,1fr)]">
            <div className="col-span-3 lg:col-span-1 py-5 lg:pr-8 border-b lg:border-b-0 lg:border-r border-[#04202E]/20 flex flex-col justify-center">
              <p className="font-display text-3xl leading-none">On joue</p>
              <p className="text-sm text-[#04202E]/75 mt-1">{salleNom || "Salle Paul Vatine"}, jeu libre tous niveaux</p>
            </div>
            {horaires.slice(0, 3).map((h, i) => {
              const c = lireCreneau(h.heure);
              return (
                <div key={i} className={`py-5 lg:px-6 ${i < Math.min(horaires.length, 3) - 1 ? "border-r border-[#04202E]/20 pr-3" : ""} ${i > 0 ? "pl-3 lg:pl-6" : ""}`}>
                  <p className="font-display font-bold text-xl lg:text-2xl">{h.jour}</p>
                  <p className="font-display text-[1.85rem] min-[400px]:text-[2.2rem] sm:text-6xl lg:text-7xl leading-[0.9] tabular-nums">{c.debut}</p>
                  {c.fin && <p className="text-sm text-[#04202E]/75 mt-1">{c.fin}</p>}
                </div>
              );
            })}
          </div>
          {horaires.length > 3 && (
            <p className="max-w-6xl mx-auto px-5 pb-4 text-sm">
              Aussi : {horaires.slice(3).map((h) => `${h.jour} ${h.heure}`).join(", ")}.
            </p>
          )}
        </section>
      )}

    </>
  );
}
