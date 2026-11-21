"use client";

/** 🏸 Bloc « Rejoindre le club » (photo du volant) : le bouton fait défiler jusqu'au formulaire d'inscription */
export default function RejoindreClub({
  inscOpen,
  formulaireSurLaPage,
}: {
  inscOpen: boolean;
  formulaireSurLaPage: boolean; // la section Inscription est affichée plus bas sur l'accueil
}) {
  return (
    <section className="bg-[#F2F6F9]" aria-labelledby="titre-rejoindre">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <div className="relative overflow-hidden rounded-xl text-white min-h-[300px] flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/photos/volant-terrain.webp"
            alt=""
            width={1000}
            height={750}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover object-[30%_50%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06181A]/90 via-[#06181A]/65 to-[#06181A]/10" />
          <div className="relative p-6 sm:p-10 flex flex-col justify-center gap-4 max-w-xl">
            <h2 id="titre-rejoindre" className="font-display text-5xl sm:text-6xl leading-[0.9]">Rejoindre le club</h2>
            {inscOpen ? (
              <>
                <p className="text-lg text-[#E6EEF4]">Inscription en ligne en quelques minutes. Paiement avec HelloAsso ou par virement.</p>
                <a href={formulaireSurLaPage ? "#inscription" : "/inscription"} className="btn bg-white text-[#0F1B26] hover:bg-[#E6EEF4] !text-base !px-6 self-start">
                  Commencer mon inscription
                </a>
              </>
            ) : (
              <>
                <p className="text-lg text-[#E6EEF4]">Les inscriptions sont fermées pour le moment. Écrivez-nous pour savoir quand elles rouvrent ou pour venir essayer.</p>
                <a href="/contact" className="btn bg-white text-[#0F1B26] hover:bg-[#E6EEF4] !text-base !px-6 self-start">
                  Nous contacter
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
