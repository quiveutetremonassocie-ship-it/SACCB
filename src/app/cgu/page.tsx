import LegalLayout from "@/components/LegalLayout";

export const metadata = {
  title: "CGU — SACCB",
};

export default function Page() {
  return (
    <LegalLayout
      title="Conditions Générales d'Utilisation"
      subtitle="Règles d'utilisation du site saccb.fr"
    >
      <section>
        <h2>Article 1 — Objet</h2>
        <p>
          Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») ont pour objet de
          définir les modalités et conditions d'utilisation du site <strong>saccb.fr</strong>{" "}
          édité par l'association Sainte-Adresse Côte Caux Badminton (SACCB).
        </p>
        <p>
          L'utilisation du site implique l'acceptation pleine et entière des présentes CGU par
          l'utilisateur.
        </p>
      </section>

      <section>
        <h2>Article 2 — Accès au site</h2>
        <p>
          Le site saccb.fr est accessible gratuitement à tout utilisateur disposant d'un accès à
          Internet. Tous les frais afférents à l'accès au site (matériel, connexion Internet, etc.)
          restent à la charge de l'utilisateur.
        </p>
        <p>
          L'association SACCB met en œuvre tous les moyens raisonnables à sa disposition pour
          assurer un accès continu au site, sans pour autant y être tenue de quelque obligation
          que ce soit. Elle pourra en outre interrompre l'accès, notamment pour des raisons de
          maintenance ou de mise à jour.
        </p>
      </section>

      <section>
        <h2>Article 3 — Inscription en ligne</h2>
        <p>
          Le site permet aux utilisateurs de s'inscrire en ligne en tant que membre de
          l'association. Les informations collectées lors de l'inscription sont nécessaires à la
          gestion de l'adhésion (voir la Politique de confidentialité).
        </p>
        <p>
          L'utilisateur s'engage à fournir des informations exactes et à jour. Toute fausse
          déclaration est susceptible d'entraîner la résiliation de l'adhésion.
        </p>
      </section>

      <section>
        <h2>Article 4 — Comportement de l'utilisateur</h2>
        <p>L'utilisateur s'engage à :</p>
        <ul>
          <li>ne pas utiliser le site à des fins illicites ou contraires aux présentes CGU ;</li>
          <li>ne pas tenter de porter atteinte à la sécurité ou à l'intégrité du site ;</li>
          <li>respecter les droits de propriété intellectuelle de l'association et des tiers ;</li>
          <li>
            ne pas collecter ou stocker de manière automatisée les données personnelles d'autres
            utilisateurs.
          </li>
        </ul>
      </section>

      <section>
        <h2>Article 5 — Propriété intellectuelle</h2>
        <p>
          L'ensemble des éléments figurant sur le site (textes, graphismes, logos, icônes, images,
          photographies, vidéos, mise en page) est la propriété exclusive de l'association SACCB ou
          de ses partenaires, et est protégé par le droit d'auteur, le droit des marques et les
          autres droits de propriété intellectuelle.
        </p>
      </section>

      <section>
        <h2>Article 6 — Cookies et données</h2>
        <p>
          Le site utilise le stockage local du navigateur (localStorage) pour conserver la session
          d'administration. Aucun cookie publicitaire ou de traçage tiers n'est utilisé. Pour plus
          d'informations, consultez la{" "}
          <a href="/politique-confidentialite">Politique de confidentialité</a>.
        </p>
      </section>

      <section>
        <h2>Article 7 — Modification des CGU</h2>
        <p>
          L'association SACCB se réserve le droit de modifier les présentes CGU à tout moment. Les
          modifications entreront en vigueur dès leur publication sur le site.
        </p>
      </section>

      <section>
        <h2>Article 8 — Droit applicable</h2>
        <p>
          Les présentes CGU sont soumises au droit français. Tout litige relatif à leur
          interprétation ou leur exécution relève des tribunaux compétents.
        </p>
      </section>
    </LegalLayout>
  );
}
