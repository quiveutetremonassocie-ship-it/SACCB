import LegalLayout from "@/components/LegalLayout";

export const metadata = {
  title: "Mentions légales — SACCB",
};

export default function Page() {
  return (
    <LegalLayout
      title="Mentions légales"
      subtitle="Conformément à la loi pour la confiance dans l'économie numérique (LCEN)"
    >
      <section>
        <h2>1. Éditeur du site</h2>
        <p>
          Le présent site <strong>saccb.fr</strong> est édité par l'association{" "}
          <strong>Sainte-Adresse Côte Caux Badminton (SACCB)</strong>, association loi 1901 à but
          non lucratif.
        </p>
        <ul>
          <li>
            <strong>Siège social :</strong> Salle Paul Vatine, 30bis Rue Georges Boissaye du Bocage,
            76310 Sainte-Adresse
          </li>
          <li>
            <strong>Numéro RNA / W :</strong> <em>[à compléter]</em>
          </li>
          <li>
            <strong>Numéro SIRET :</strong> <em>[à compléter]</em>
          </li>
          <li>
            <strong>Numéro de TVA intracommunautaire :</strong>{" "}
            <em>[à compléter si applicable]</em>
          </li>
          <li>
            <strong>Directeur de la publication :</strong> Hernan Camara, Président
          </li>
          <li>
            <strong>Contact :</strong>{" "}
            <a href="mailto:hernancm68@hotmail.com">hernancm68@hotmail.com</a> — 07 77 06 18 75
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Hébergement</h2>
        <p>
          Le site est hébergé par <strong>GitHub, Inc.</strong>
          <br />
          88 Colin P Kelly Jr St, San Francisco, CA 94107, États-Unis
          <br />
          Site web : <a href="https://github.com">https://github.com</a>
        </p>
        <p>
          La base de données et les services d'authentification sont fournis par{" "}
          <strong>Supabase Inc.</strong>
          <br />
          970 Toa Payoh North #07-04, Singapore 318992
          <br />
          Site web : <a href="https://supabase.com">https://supabase.com</a>
        </p>
      </section>

      <section>
        <h2>3. Propriété intellectuelle</h2>
        <p>
          L'ensemble des contenus présents sur le site saccb.fr (textes, images, logos, graphismes,
          vidéos, icônes) sont la propriété exclusive de l'association SACCB ou de leurs
          titulaires respectifs. Toute reproduction, représentation, modification, publication,
          adaptation totale ou partielle des éléments du site, quel que soit le moyen ou le procédé
          utilisé, est interdite sans autorisation écrite préalable.
        </p>
      </section>

      <section>
        <h2>4. Responsabilité</h2>
        <p>
          L'association SACCB s'efforce de fournir sur le site saccb.fr des informations aussi
          précises que possible. Toutefois, elle ne pourra être tenue responsable des omissions,
          des inexactitudes et des carences dans la mise à jour, qu'elles soient de son fait ou du
          fait des tiers partenaires qui lui fournissent ces informations.
        </p>
      </section>

      <section>
        <h2>5. Liens hypertextes</h2>
        <p>
          Le site saccb.fr peut contenir des liens hypertextes vers d'autres sites. L'association
          SACCB n'exerce aucun contrôle sur ces sites et n'assume aucune responsabilité quant à
          leur contenu.
        </p>
      </section>

      <section>
        <h2>6. Droit applicable</h2>
        <p>
          Tout litige en relation avec l'utilisation du site saccb.fr est soumis au droit français.
          Il est fait attribution exclusive de juridiction aux tribunaux compétents du ressort de
          la Cour d'appel de Rouen.
        </p>
      </section>
    </LegalLayout>
  );
}
