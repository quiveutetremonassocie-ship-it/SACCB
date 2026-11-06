// 📘 Fiche du site pour Claude : description du site, de son fonctionnement et des règles de travail.
// ⚠️ À METTRE À JOUR à chaque modification importante (nouvelle rubrique, nouvelle fonction, nouvelle règle).
// L'historique des modifications et l'état du site sont ajoutés automatiquement dans le PDF.

export const FICHE_MAJ_LE = "2026-11-06";

export type SectionFiche = { titre: string; lignes: string[] };

export const FICHE_SITE: SectionFiche[] = [
  {
    titre: "Le site en bref",
    lignes: [
      "saccb.fr : site de l'association de badminton SACCB (Sainte-Adresse). Vitrine publique + espace adhérent + administration complète + tournois en direct.",
      "Propriétaire : Gabin (gabin.binay@gmail.com), seul à voir le Journal admin et les outils sensibles.",
      "Toutes les modifications sont faites avec Claude (Claude Code) dans le dossier Desktop/SACCB, puis mises en ligne directement.",
    ],
  },
  {
    titre: "Règles de travail (à respecter à chaque modification)",
    lignes: [
      "Ne jamais perdre de données (adhérents, tournois, tout). Ne jamais supprimer soi-même des données : c'est le propriétaire qui supprime.",
      "Mettre en ligne directement (push sur main), mais poser AVANT chaque gros changement un tag git « sauvegarde-AAAA-MM-JJ-avant-... » pour pouvoir revenir en arrière.",
      "Toujours demander confirmation avant d'envoyer un mail aux adhérents.",
      "Améliorer sans changer la forme/l'apparence actuelle du site ; pour une refonte visuelle, montrer un aperçu avant.",
      "Tests sur le site en ligne : lecture seule uniquement (aucune écriture de test dans la vraie base).",
      "Tournois = loisir : personne n'est éliminé.",
      "Expliquer en français simple, sans jargon technique.",
    ],
  },
  {
    titre: "Comment le site est construit",
    lignes: [
      "Site : Next.js 14 (React, TypeScript, Tailwind) exporté en pages statiques et hébergé gratuitement sur GitHub Pages (dépôt quiveutetremonassocie-ship-it/SACCB, branche main).",
      "Serveur : une seule fonction Supabase « public-api » (supabase/functions/public-api/index.ts, ~6 700 lignes) qui reçoit toutes les actions ({ action: \"...\" }).",
      "Base de données : UNE seule ligne JSON (table saccb_db, id = 1) qui contient tout : adhérents, tournois, compta, réglages, journal... Écritures protégées par un numéro de version (_rev) et une fusion à 3 voies (merge3) : deux modifications simultanées ne s'écrasent pas.",
      "Fichiers (Supabase Storage) : « actualities » (photos des actus, public), « reports » (PDF règlements/documents, public), « factures » (privé).",
      "Mails : Brevo (clé API, pas la clé SMTP). Paiements : HelloAsso.",
      "Mise en ligne : un push sur main déclenche GitHub Actions → build du site (Pages) + déploiement de la fonction Supabase si elle a changé.",
      "Tests automatiques (dossier tests/, commande npm test, ~2 s) : lancés par GitHub Actions avant chaque mise en ligne ; s'ils échouent, rien n'est mis en ligne et GitHub prévient par mail. Ils font tourner le vrai code du serveur dans Node avec une FAUSSE base en mémoire (tests/outils/fauxServeur.mjs) : tout appel réseau (Brevo, Resend, HelloAsso…) est intercepté, jamais envoyé. Couvrent : rien de privé sur la partie publique, toutes les actions admin_* refusées sans connexion ou avec un faux code (liste lue automatiquement dans le code), actions réservées sans secret, enregistrement admin qui garde codes/journal/blocages, deux admins en même temps (merge3), inscription (code chiffré, mail au seul destinataire), anti-rafales, moteur des tournois (scores, poules, personne éliminé). À chaque nouvelle fonctionnalité, ajouter ses tests.",
      "Tâches automatiques GitHub : rappels quotidiens (9 h) + sauvegarde mensuelle par mail, nettoyage des adhésions expirées, « keepalive » tous les 3 jours (empêche Supabase de se mettre en pause).",
      "Secrets (Supabase → Edge Functions → Secrets, non relisibles) : BREVO_API_KEY, BREVO_INBOUND_SECRET, INBOUND_REPLY_ADDRESS, RESEND_API_KEY, HELLOASSO_WEBHOOK_SECRET, SHEETS_WEBHOOK, CRON_SECRET (tâches automatiques, aussi dans les secrets GitHub), PRESENTATION_SECRET. Secrets GitHub : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY, CRON_SECRET, SUPABASE_ACCESS_TOKEN et SUPABASE_PROJECT_REF (déploiement de la fonction serveur).",
    ],
  },
  {
    titre: "Services et comptes utilisés",
    lignes: [
      "Claude Code (application Claude, onglet Code) : toutes les modifications du site. Claude in Chrome : quand Claude doit agir dans le navigateur du propriétaire.",
      "GitHub (github.com/quiveutetremonassocie-ship-it/SACCB, dépôt public) : le code, l'historique, l'hébergement du site (GitHub Pages) et les tâches automatiques (GitHub Actions + secrets « Actions secrets »). Gratuit (dépôt public = minutes illimitées).",
      "Nom de domaine saccb.fr : pointe vers GitHub Pages (fichier CNAME). Redirection http → https active.",
      "Supabase (projet jsceiujlopxgsjlxbvyu) : base de données, fichiers (photos, factures, PDF), fonction serveur « public-api », secrets (Edge Functions → Secrets). Offre gratuite : 500 Mo de base, 1 Go de fichiers, ~500 000 appels/mois ; « Usage » pour la consommation, « Edge Functions → Logs » pour le détail (≈ 1 jour).",
      "Brevo (compte saccb) : envoi de tous les mails du site via clé API (BREVO_API_KEY) ; réception des réponses des adhérents (Brevo Inbound → admin « Messages reçus », protégé par BREVO_INBOUND_SECRET, adresse INBOUND_REPLY_ADDRESS). Les clés SMTP Brevo ne servent pas (le mail « clé SMTP inactive » n'a aucun impact).",
      "Resend : deuxième service d'envoi, utilisé automatiquement mail par mail quand Brevo refuse (quota/crédits épuisés, clé refusée, compte bloqué, panne : codes 400, 401, 402, 403, 429, 5xx ou réseau). Même expéditeur contact@saccb.fr. Nécessite RESEND_API_KEY dans les secrets Supabase et le domaine saccb.fr vérifié sur Resend. Quotas gratuits indicatifs : Brevo ~300 mails/jour, Resend ~100/jour.",
      "HelloAsso : paiement des adhésions et des t-shirts ; HelloAsso prévient le site par webhook (HELLOASSO_WEBHOOK_SECRET) pour marquer le paiement ; QR code de paiement dans l'admin.",
      "Google Sheets : copie des inscriptions vers un tableur via SHEETS_WEBHOOK (optionnel).",
      "Google Agenda / Google Maps : boutons « Ajouter à mon agenda » et plan d'accès à la salle (liens, pas de compte nécessaire).",
      "UptimeRobot : surveillance que saccb.fr reste en ligne (alerte si le site tombe).",
      "WhatsApp : groupe des adhérents (lien donné seulement aux adhérents à jour). Smash (smash.saccb.fr) : appli de mini-tournois d'entraînement, lien réglable dans Paramètres saison.",
      "Liens externes affichés : FFBaD (fédération), partage Facebook.",
    ],
  },
  {
    titre: "Partie publique",
    lignes: [
      "Accueil (photo de la salle, horaires, tarifs, prochain tournoi), Présentation, Actualités (publiques ou réservées), Horaires, Tournois, Palmarès, Adhésion (inscription en ligne + HelloAsso), FAQ, Contact, Règlement, Bureau, pages légales (CGU, CGV, mentions, confidentialité).",
      "Mode maintenance : simple interrupteur dans l'admin (Réglages → Sauvegarde & export), sans code ; l'admin reste accessible (bouton discret « Administration » et saccb.fr/admin).",
      "Mode présentation : protégé par le code PRESENTATION_SECRET.",
      "La réponse publique (fetch_public) est mémorisée par le serveur tant que la base ne change pas (plus rapide, protège des rafales de requêtes).",
    ],
  },
  {
    titre: "Espace adhérent (connexion email + code)",
    lignes: [
      "✅ Renouvellement depuis l'espace adhérent : d'abord « Vérifiez vos informations » (prénom et nom, mail, téléphone, modifiables) puis « Mes informations sont correctes » (member_contact confirmer → membre.infosConfirmees {saison, le}) ; ensuite seulement le choix de catégorie et le paiement. Les changements (dont le nom) sont notés dans coordonneesModifiees.",
      "💶 Tarif adulte remisé (membre.remise {statut demandee|acceptee|refusee, saison, origine inscription|renouvellement}) : choix « Adulte — tarif réduit (sur accord du bureau) » dans le formulaire d'inscription et le bandeau de renouvellement, SANS prix affiché ; pas de paiement tant que le bureau n'a pas répondu. Mail au bureau (contactEmails, sinon super-admins). Admin → Adhérents : bandeau « demandes de tarif remisé » avec ✅ Accepter / ❌ Refuser (action admin_remise_decision, confirmation avant mail) → mail vert « accepté par le bureau du SACCB » + lien de paiement, ou rouge « refusé » (nouvel inscrit : refaire l'inscription ; ancien : choisir dans son espace). Badge « 💶 Adulte remisé ». Prix (clubConfig.prixRemise, défaut prix étudiant) et lien (helloassoUrls.remise, défaut lien étudiant) dans Paramètres saison. À redemander chaque saison (effacé au changement de saison). Compta / reçu / mail de paiement utilisent le prix remisé ; le webhook HelloAsso note montantPaye.",
      "Renouvellement (bandeau « Adhésion à renouveler », adhérent pas encore payé) : « Cette saison, vous êtes : Adulte / Étudiant(e) » (action member_set_type, refusée si déjà payé). Le lien HelloAsso suit la catégorie choisie ; passer étudiant fait demander le justificatif. Le changement est noté sur la fiche (coordonneesModifiees champ « type ») et apparaît dans le bandeau orange de l'admin + pastille sous la catégorie.",
      "Procuration AG (ProcurationModal, adhérents à jour) : document imprimable / PDF ; sous « Signature (mandant) » : « Bon pour pouvoir » + nom et prénom du mandant écrits en écriture manuscrite.",
      "👀 Dernière visite (membre.vuLe = jour AAAA-MM-JJ, sans heure ni historique ; suivi commencé le 2026-11-02) : notée par check_session (une écriture par jour et par adhérent au plus). Envoyée par admin_fetch au PROPRIÉTAIRE SEUL, protégée dans admin_save (un client ne peut ni l'effacer ni l'inventer). Admin → Adhérents : « 👀 vu le … » sous le nom + bandeau « N cette semaine · N ce mois-ci · N pas venus » (clic = filtre). Mentionnée dans la politique de confidentialité.",
      "Mon compte → « Changer mon adresse mail ou mon téléphone » (action serveur member_contact) : l'email change sur toutes les fiches du même compte (même email + même code), le téléphone sur la fiche connectée. Refusé si l'adresse est celle d'un autre adhérent ou d'un admin. Chaque changement est noté sur la fiche (coordonneesModifiees : date, avant, après) ; dans l'admin → Adhérents : bandeau orange « N adhérents ont mis à jour leurs informations cette saison » (sans bouton « vu » : reste affiché toute la saison, effacé au changement de saison avec infosConfirmees) et pastille « ✏️ modifié le … » sous l'email / le téléphone (historique au survol). Aucun mail envoyé.",
      "Mon espace : fiche, reçu d'adhésion, justificatif étudiant, lien WhatsApp (adhérents à jour), inscriptions aux tournois, « Mes tournois » (parcours, meilleure place, partenaire favori), t-shirts, sondages/AG, documents officiels.",
      "Agenda du club (réservé aux adhérents) : tournois + événements ajoutés par le bureau, ajout à Google Agenda / fichier .ics. Seul le prochain événement est affiché, les suivants sont dans un menu déroulant « Voir les N autres événements » (pour ne pas répéter la rubrique Tournois).",
      "Les noms des adhérents (choix du partenaire) ne sont envoyés qu'aux adhérents connectés.",
    ],
  },
  {
    titre: "Administration (saccb.fr/admin)",
    lignes: [
      "Adhérents : Adhérents, Bureau.",
      "Tournois : Tournois, Inscriptions aux tournois, Tournois inter-clubs (et internes).",
      "Communication : Messages reçus, Envoyer un mail, Agenda, Actualités, Sondages & AG, FAQ adhérents.",
      "Trésorerie : Comptabilité (factures), T-shirts (tailles, couleurs, catalogue PDF montré aux adhérents, prix, paiement HelloAsso, export PDF pour le fabricant), HelloAsso · QR code.",
      "Réglages : Paramètres saison, Règlement intérieur, Statistiques (dont rapport d'AG), Sauvegarde & export, Bloc-notes partagé, Journal (privé), Guide admin.",
      "Admins multiples avec droits (lecture seule, permissions par rubrique) ; double vérification par mail à la connexion admin.",
      "Mode hors connexion : si le réseau coupe, les modifications sont gardées sur l'appareil (bandeau rouge) et envoyées au retour du réseau.",
    ],
  },
  {
    titre: "Journal (propriétaire uniquement)",
    lignes: [
      "Liste de toutes les actions des admins (1000 dernières), annulation d'une action précise (↩, 150 dernières) sans toucher à ce qui a été fait après.",
      "Date de la dernière sauvegarde complète (vert < 24 h).",
      "Place sur le serveur (jauges base 500 Mo / fichiers 1 Go) + bouton « Libérer de l'espace » (compression des photos, fichiers inutilisés à supprimer après validation, factures jamais cochées d'office).",
      "Requêtes bloquées (trop de requêtes, essais de codes) avec bouton « Copier pour Claude ».",
      "Bouton « Fiche du site pour Claude » : ce PDF.",
    ],
  },
  {
    titre: "Tournois inter-clubs / internes (jour J)",
    lignes: [
      "Chaque club invité a un lien unique + un code d'accès (gardé 2 jours sur chaque téléphone ; plusieurs personnes peuvent utiliser le même lien).",
      "Table de marque : poules, tours (brassage, 2e tour, finale...), scores saisis par les clubs (confirmation / correction / contestation), écran géant, QR codes à imprimer.",
      "Tout reste modifiable à tout moment : refaire un tour, revenir au tour précédent, corriger après la fin, déplacer un binôme, changer nom/format d'un tour, binôme arrivé en retard, équipe qui abandonne.",
      "PDF « Classement » et « Tous les scores » ; ce dernier contient une copie cachée du tournoi (poules + binômes) pour « Restaurer depuis le PDF ». Un PDF d'un autre tournoi est refusé ; une restauration peut être annulée.",
      "Sauvegarde par mail toutes les 5 min pendant le tournoi (PDF restaurable envoyé au propriétaire, seulement si quelque chose a changé) + une finale à la fin.",
      "Liens des clubs utilisables sans réseau (scores gardés sur le téléphone puis envoyés).",
      "Fin du tournoi : message « Tournoi terminé, merci... » + félicitations aux clubs sur le podium ; classement envoyé au palmarès ; le tournoi passe dans « Tournois finis » (replié, rien n'est supprimé).",
      "« Arrêter et réinitialiser » garde la version effacée et propose de la remettre.",
    ],
  },
  {
    titre: "Sauvegardes et sécurité",
    lignes: [
      "Sauvegarde complète (bouton dans Sauvegarde & export, et sauvegarde de nuit) : toute la base + journal (propriétaire) + photos, factures et PDF ; à la restauration, seuls les fichiers manquants sont remis.",
      "Sauvegarde mensuelle automatique par mail (base seule).",
      "Base fermée au public (accès direct refusé), codes chiffrés (PBKDF2), blocage après 5 erreurs (connexion ET accès admin directs), limites de requêtes par adresse IP.",
      "Aucun email, téléphone ni code dans les données publiques ; votes des sondages anonymes.",
    ],
  },
  {
    titre: "Pièges connus (pour Claude)",
    lignes: [
      "Rappels tournois automatiques (check_reminders, chaque jour à 9h) : UN SEUL rappel par tournoi, 5 jours avant la date limite d'inscription (depuis le 2026-11-06 ; avant : J-30/J-15/J-5/J-1, des adhérents se plaignaient d'environ 14 mails par mois). Ne pas en rajouter sans l'accord du propriétaire. Les rappels de cotisation (saison) restent à J-30/J-15/J-5/J-1.",
      "Déploiement de la fonction serveur : le workflow installe la DERNIÈRE version de l'outil Supabase (setup-cli version latest). Le 2026-11-02 une nouvelle version a cassé le déploiement : il a fallu renommer [inbucket] en [local_smtp] dans supabase/config.toml et ajouter --yes à « supabase functions deploy ». Si le déploiement Supabase échoue sans raison dans le code, lire le journal de l'action GitHub (gh run view <id> --log-failed) : c'est souvent un changement de l'outil. Rappel : tant que la fonction n'est pas déployée, le site en ligne peut appeler des actions serveur qui n'existent pas encore.",
      "Tests (npm test) : une note de requêtes bloquées peut s'écrire en arrière-plan pendant un autre test ; pour vérifier « rien n'a changé », compter etat.ecrituresMembres (écritures qui touchent les adhérents) plutôt que etat.ecritures.",
      "gh CLI : /c/gh-cli/bin/gh.exe. Avant un push : git checkout -- tsconfig.tsbuildinfo puis git pull --rebase (bot keepalive).",
      "Pas de Deno ni de Python sur le PC : vérifier la syntaxe de la fonction serveur avec typescript.transpileModule (node).",
      "Après npm run build, le serveur de dev casse : l'arrêter, supprimer .next, relancer. Supprimer .next/types après avoir retiré une page de test (pages de test : src/app/test-*, marquées TEMP-APERCU).",
      "L'antivirus Kaspersky du PC injecte ~900 Ko de scripts dans les pages : il fausse les tests de vitesse locaux.",
      "jsPDF (police standard) : pas d'emoji ni de caractères spéciaux dans les PDF (les nettoyer).",
    ],
  },
];
