import LegalLayout from "@/components/LegalLayout";

export const metadata = {
  title: "CGV — SACCB",
};

export default function Page() {
  return (
    <LegalLayout
      title="Conditions Générales de Vente"
      subtitle="Adhésion à l'association SACCB"
    >
      <section>
        <h2>Article 1 — Objet</h2>
        <p>
          Les présentes Conditions Générales de Vente (ci-après « CGV ») s'appliquent à toute
          adhésion souscrite auprès de l'association <strong>Sainte-Adresse Côte Caux Badminton
          (SACCB)</strong>, association loi 1901 à but non lucratif.
        </p>
        <p>
          L'adhésion à l'association donne accès aux créneaux de pratique, aux équipements mis à
          disposition et aux événements organisés par le club, dans les conditions décrites
          ci-après.
        </p>
      </section>

      <section>
        <h2>Article 2 — Tarifs</h2>
        <p>Les tarifs en vigueur pour la saison sont les suivants :</p>
        <ul>
          <li>
            <strong>Adulte :</strong> 50 € pour la saison complète
          </li>
          <li>
            <strong>Étudiant :</strong> 30 € pour la saison complète (sur justificatif)
          </li>
        </ul>
        <p>
          Les tarifs s'entendent toutes taxes comprises (l'association n'étant pas assujettie à la
          TVA). Ils peuvent être révisés chaque saison par décision du bureau.
        </p>
      </section>

      <section>
        <h2>Article 3 — Modalités d'inscription</h2>
        <p>L'inscription s'effectue via le formulaire en ligne disponible sur saccb.fr. Elle est considérée comme définitive après :</p>
        <ul>
          <li>validation du formulaire d'inscription ;</li>
          <li>paiement intégral de la cotisation auprès du bureau ;</li>
          <li>
            le cas échéant, fourniture des pièces justificatives demandées (certificat médical,
            carte étudiante, etc.).
          </li>
        </ul>
      </section>

      <section>
        <h2>Article 4 — Modalités de paiement</h2>
        <p>
          Le paiement de la cotisation peut être effectué en espèces, par chèque à l'ordre de
          « SACCB » ou par virement bancaire. Le règlement est à remettre au bureau lors de la
          finalisation de l'adhésion.
        </p>
      </section>

      <section>
        <h2>Article 5 — Droit de rétractation</h2>
        <p>
          Conformément à l'article L.221-28 du Code de la consommation, le droit de rétractation ne
          s'applique pas aux services liés à des activités de loisirs fournis à une date ou une
          période déterminée. Toutefois, l'association peut, à titre exceptionnel et sur décision
          du bureau, procéder au remboursement de la cotisation en cas de force majeure dûment
          justifiée (déménagement, raisons médicales, etc.).
        </p>
      </section>

      <section>
        <h2>Article 6 — Obligations de l'adhérent</h2>
        <p>En adhérant, le membre s'engage à :</p>
        <ul>
          <li>respecter le règlement intérieur du club et de la salle ;</li>
          <li>respecter les autres adhérents et l'encadrement ;</li>
          <li>prendre soin du matériel mis à disposition ;</li>
          <li>
            fournir un certificat médical de non contre-indication à la pratique du badminton si
            celui-ci est demandé.
          </li>
        </ul>
      </section>

      <section>
        <h2>Article 7 — Responsabilité et assurance</h2>
        <p>
          L'association est couverte par une assurance responsabilité civile. Il est fortement
          recommandé à chaque adhérent de disposer d'une assurance individuelle accident couvrant
          la pratique sportive. L'association décline toute responsabilité en cas de vol ou de
          perte d'effets personnels dans l'enceinte de la salle.
        </p>
      </section>

      <section>
        <h2>Article 8 — Exclusion</h2>
        <p>
          Le bureau de l'association se réserve le droit d'exclure, sans remboursement, tout
          adhérent dont le comportement serait contraire au règlement intérieur, aux valeurs du
          club ou qui mettrait en danger la sécurité des autres membres.
        </p>
      </section>

      <section>
        <h2>Article 9 — Droit applicable</h2>
        <p>
          Les présentes CGV sont régies par le droit français. En cas de litige, une solution
          amiable sera recherchée avant toute action judiciaire.
        </p>
      </section>
    </LegalLayout>
  );
}
