import LegalLayout from "@/components/LegalLayout";

export const metadata = {
  title: "Politique de confidentialité — SACCB",
};

export default function Page() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      subtitle="Protection de vos données personnelles — Conforme RGPD"
    >
      <section>
        <h2>1. Responsable du traitement</h2>
        <p>
          Le responsable du traitement des données personnelles collectées sur le site saccb.fr
          est l'association <strong>Sainte-Adresse Côte Caux Badminton (SACCB)</strong>,
          représentée par son Président, Hernan Camara.
        </p>
        <p>
          <strong>Contact :</strong>{" "}
          <a href="mailto:hernancm68@hotmail.com">hernancm68@hotmail.com</a>
        </p>
      </section>

      <section>
        <h2>2. Données collectées</h2>
        <p>Dans le cadre de l'adhésion à l'association, nous collectons les données suivantes :</p>
        <ul>
          <li>Nom et prénom</li>
          <li>Adresse e-mail</li>
          <li>Numéro de téléphone</li>
          <li>Catégorie d'adhésion (adulte / étudiant)</li>
          <li>Statut du paiement de la cotisation</li>
        </ul>
        <p>
          Aucune donnée sensible (santé, origine, opinions) n'est collectée via ce site. Un
          certificat médical peut vous être demandé séparément, mais n'est pas stocké
          numériquement sur le site.
        </p>
      </section>

      <section>
        <h2>3. Finalités du traitement</h2>
        <p>Vos données sont collectées et traitées pour les finalités suivantes :</p>
        <ul>
          <li>Gestion administrative des adhérents de l'association</li>
          <li>Communication relative à la vie du club (créneaux, tournois, événements)</li>
          <li>Établissement des listes d'émargement et reçus de cotisation</li>
          <li>Inscription aux tournois organisés par le club</li>
          <li>Tenue de la comptabilité et des obligations légales de l'association</li>
        </ul>
      </section>

      <section>
        <h2>4. Base légale du traitement</h2>
        <p>Le traitement de vos données repose sur :</p>
        <ul>
          <li>
            <strong>L'exécution du contrat d'adhésion</strong> entre vous et l'association (art.
            6.1.b du RGPD) ;
          </li>
          <li>
            <strong>Le respect des obligations légales</strong> pesant sur l'association (art.
            6.1.c du RGPD), notamment comptables.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Durée de conservation</h2>
        <ul>
          <li>
            <strong>Données d'adhésion :</strong> conservées pendant la durée de l'adhésion, puis
            archivées pour une durée de 3 ans après la fin de la saison à des fins de suivi.
          </li>
          <li>
            <strong>Données comptables :</strong> conservées 10 ans conformément aux obligations
            légales.
          </li>
          <li>
            <strong>Données de session admin :</strong> stockées dans le navigateur (localStorage)
            et effacées lors de la déconnexion.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Destinataires des données</h2>
        <p>Vos données sont accessibles uniquement aux personnes suivantes :</p>
        <ul>
          <li>Les membres du bureau de l'association habilités à la gestion des adhérents ;</li>
          <li>
            <strong>Supabase Inc.</strong> en qualité de sous-traitant hébergeant la base de
            données (serveurs situés en Union Européenne) ;
          </li>
          <li>
            <strong>GitHub, Inc.</strong> pour l'hébergement du site statique.
          </li>
        </ul>
        <p>
          Aucune donnée n'est cédée, vendue ou partagée à des fins commerciales avec des tiers.
        </p>
      </section>

      <section>
        <h2>7. Vos droits</h2>
        <p>
          Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
          Informatique et Libertés, vous disposez des droits suivants :
        </p>
        <ul>
          <li>
            <strong>Droit d'accès</strong> à vos données personnelles ;
          </li>
          <li>
            <strong>Droit de rectification</strong> des données inexactes ;
          </li>
          <li>
            <strong>Droit à l'effacement</strong> (« droit à l'oubli ») ;
          </li>
          <li>
            <strong>Droit à la limitation</strong> du traitement ;
          </li>
          <li>
            <strong>Droit à la portabilité</strong> de vos données ;
          </li>
          <li>
            <strong>Droit d'opposition</strong> au traitement ;
          </li>
          <li>
            <strong>Droit de définir des directives</strong> relatives au sort de vos données après
            votre décès.
          </li>
        </ul>
        <p>
          Pour exercer ces droits, adressez votre demande par e-mail à{" "}
          <a href="mailto:hernancm68@hotmail.com">hernancm68@hotmail.com</a>. Une réponse vous sera
          apportée dans un délai maximum d'un mois.
        </p>
        <p>
          En cas de désaccord sur la réponse apportée, vous pouvez introduire une réclamation
          auprès de la <strong>CNIL</strong> (Commission Nationale de l'Informatique et des
          Libertés) :{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
            www.cnil.fr
          </a>
          .
        </p>
      </section>

      <section>
        <h2>8. Cookies et traceurs</h2>
        <p>
          Le site saccb.fr n'utilise <strong>aucun cookie publicitaire ni traceur tiers</strong>.
          Seul le stockage local du navigateur (localStorage) est utilisé pour maintenir la session
          d'administration active, ce qui ne nécessite pas de consentement préalable selon les
          lignes directrices de la CNIL.
        </p>
      </section>

      <section>
        <h2>9. Sécurité</h2>
        <p>
          L'association met en œuvre des mesures techniques et organisationnelles pour protéger
          vos données contre la perte, l'accès non autorisé ou la divulgation : authentification
          forte pour l'accès administrateur, chiffrement des connexions (HTTPS), hébergement
          sécurisé.
        </p>
      </section>

      <section>
        <h2>10. Modification de la politique</h2>
        <p>
          La présente politique peut être modifiée à tout moment pour s'adapter aux évolutions
          légales ou techniques. La date de dernière mise à jour est indiquée en bas de page.
        </p>
      </section>
    </LegalLayout>
  );
}
