// 🧪 Fausse base du club : uniquement des personnes et des valeurs inventées
import crypto from "node:crypto";

// Code chiffré au format du serveur ("h$sel$sha256(sel+code)")
export const chiffrer = (code, sel = "seltest") => `h$${sel}$${crypto.createHash("sha256").update(sel + code).digest("hex")}`;

export const ADMIN = { email: "admin.test@exemple.fr", code: "CodeAdmin42" };

// Textes qui ne doivent JAMAIS apparaître sur la partie publique
export const SECRETS = [
  "marie.secrete@exemple.fr",
  "0611223344",
  "CodeMarieXy",
  "FACTURE-SECRETE",
  "JOURNAL-SECRET",
  "BLOCAGE-SECRET",
  "LIEN-WHATSAPP-SECRET",
  "bureau.secret@exemple.fr",
  "h$seltest$",
];

// Chaque base de test a son propre numéro de version : une écriture en retard d'un test précédent
// (envoi de mail en arrière-plan…) est alors refusée comme sur le vrai serveur, au lieu d'écraser la base.
let version = 1000;
export function baseDeTest() {
  return {
    _rev: ++version,
    y1: 2026, y2: 2027, insc_open: true, quota: 65,
    adminEmails: [ADMIN.email],
    adminCredentials: [{ email: "bureau.secret@exemple.fr", code: chiffrer("CodeBureau") }],
    membres: [
      { id: "m-admin", nom: "Alex Admin", email: ADMIN.email, tel: "0600000001", code: chiffrer(ADMIN.code), type: "Adulte", ok: true, date: "2026-09-01" },
      { id: "m-marie", nom: "Marie Secrète", email: "marie.secrete@exemple.fr", tel: "0611223344", code: "CodeMarieXy", type: "Adulte", ok: true, date: "2026-09-02" },
      { id: "m-paul", nom: "Paul Attente", email: "paul.attente@exemple.fr", tel: "0622334455", code: chiffrer("CodePaul"), type: "Etudiant", ok: false, date: "2026-09-03" },
    ],
    factures: [{ id: "f1", libelle: "FACTURE-SECRETE", montant: 42 }],
    adminJournal: [{ at: "2026-10-01T10:00:00Z", email: ADMIN.email, actions: ["JOURNAL-SECRET"] }],
    securiteBlocages: [{ ip: "1.2.3.x", action: "fetch_public", motif: "BLOCAGE-SECRET", n: 3, debut: "2026-10-01T10:00:00Z", fin: "2026-10-01T10:01:00Z" }],
    whatsappLink: "https://chat.whatsapp.com/LIEN-WHATSAPP-SECRET",
    actualites: [
      { id: "a1", title: "Actu publique", description: "Bonjour à tous", private: false },
      { id: "a2", title: "Actu réservée", description: "Réservé aux adhérents", private: true },
    ],
    config_tournois: [],
    inscrits_tournoi: [],
    interclubs: [],
    agItems: [{ id: "q1", question: "Budget ?", authorMembreId: "m-marie", authorNom: "Marie Secrète", anonymous: false }],
    polls: [{ id: "p1", question: "Soirée ?", options: ["Oui", "Non"], votes: [{ membreId: "m-marie", optionIdx: 0 }] }],
  };
}
