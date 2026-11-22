"use client";

import { useEffect, useState } from "react";
import { ChevronRight, CheckCircle2, Circle, Radio } from "lucide-react";
import { DB, remiseSaison } from "@/lib/types";

/** 🕒 Date et heure actuelles, rafraîchies à chaque minute (pour éviter de consommer pour rien). */
function MaintenantFR() {
  // Côté serveur / avant hydratation : on affiche rien (évite le mismatch SSR/CSR)
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  useEffect(() => {
    setMaintenant(new Date());
    // Alignement sur la prochaine minute pleine pour que l'heure change pile à :00s
    const now = new Date();
    const msJusquaProchaineMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    // (Avant : l'intervalle était rangé sur le numéro du minuteur, ce qui plantait au bout d'une minute)
    let intervalle: ReturnType<typeof setInterval> | undefined;
    const t0 = setTimeout(() => {
      setMaintenant(new Date());
      intervalle = setInterval(() => setMaintenant(new Date()), 60_000);
    }, msJusquaProchaineMinute);
    return () => {
      clearTimeout(t0);
      if (intervalle) clearInterval(intervalle);
    };
  }, []);
  if (!maintenant) return null;
  const date = maintenant.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const heure = maintenant.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="text-right" aria-live="off">
      <div className="text-sm font-bold text-slate-600 capitalize tabular-nums">{date}</div>
      <div className="font-display text-3xl text-[#0F1B26] tabular-nums leading-none">{heure}</div>
    </div>
  );
}

type Totaux = { totalRecolte: number; reste: number; aPayes: number; aTotal: number; ePayes: number; eTotal: number; totalDepenses: number; solde: number };

// ✅ Liste « début de saison » : certaines lignes se cochent toutes seules (constat), les autres à la main
const ETAPES_RENTREE: { id: string; texte: string; section: string; auto?: (db: DB) => boolean }[] = [
  {
    id: "saison", texte: "Passer à la nouvelle saison", section: "admin-saison",
    auto: (db) => { const d = new Date(); const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return db.y1 >= y; },
  },
  { id: "tarifs", texte: "Vérifier les tarifs et les liens de paiement HelloAsso", section: "admin-saison" },
  { id: "horaires", texte: "Mettre à jour les horaires et la salle", section: "admin-saison" },
  { id: "inscriptions", texte: "Ouvrir les inscriptions", section: "admin-saison", auto: (db) => db.insc_open === true },
  { id: "bureau", texte: "Mettre à jour la composition du bureau", section: "admin-bureau" },
  { id: "mail", texte: "Envoyer le mail de rentrée aux anciens adhérents", section: "admin-emailing" },
];

/** 🏠 Tableau de bord de l'admin : ce qui attend une action, puis les chiffres clés */
export default function AdminAccueil({
  db, totals, aller, prenom, peutVoir, onPersist, lectureSeule = false,
}: {
  db: DB;
  totals: Totaux;
  aller: (section: string) => void;
  prenom?: string;
  peutVoir: (section: string) => boolean;
  onPersist?: (db: DB) => Promise<void>;
  lectureSeule?: boolean;
}) {
  const saison = `${db.y1}-${db.y2}`;
  const membres = db.membres || [];
  const payes = membres.filter((m) => m.ok).length;
  const nonPayes = membres.filter((m) => !m.ok && !m.enAttente);
  const virements = nonPayes.filter((m) => m.paymentMethod === "virement");
  const enAttente = membres.filter((m) => m.enAttente);
  const justifManquants = membres.filter((m) => m.type === "Etudiant" && m.justificatif?.saison !== saison);
  const sansSexe = membres.filter((m) => !m.sexe);
  const remises = membres.filter((m) => remiseSaison(db, m)?.statut === "demandee");
  const alertesPaiement = membres.filter((m) => m.paiementAlerte);
  const coordonnees = membres.filter((m) => m.coordonneesModifiees?.length);
  const messages = (db.contactMessages || []).filter((m) => !m.archived && !m.respondedBy);
  const faq = db.faqPending || [];
  const tshirts = db.tshirtOrders || [];
  const tshirtsNonPayes = tshirts.filter((o) => !o.paid);
  const interclubEnCours = (db.interclubs || []).find((t) => t.live && !t.live.termine);

  // Prochain tournoi (dates au format AAAA-MM-JJ ou JJ/MM/AAAA)
  const lireDate = (s?: string | null) => {
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
    const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (fr) return new Date(+fr[3], +fr[2] - 1, +fr[1]);
    return null;
  };
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  const prochain = (db.config_tournois || [])
    .map((t) => ({ t, d: lireDate(t.date) }))
    .filter((x) => x.d && x.d >= aujourdhui)
    .sort((a, b) => a.d!.getTime() - b.d!.getTime())[0];
  const inscritsProchain = prochain ? (db.inscrits_tournoi || []).filter((i) => i.tournoiId === prochain.t.id).length : 0;

  const pluriel = (n: number, s: string, p = s + "s") => `${n} ${n > 1 ? p : s}`;

  // ✅ À faire, du plus urgent au moins urgent (urgent = rouge, à traiter = orange, à surveiller = gris)
  type Tache = { texte: string; detail?: string; section: string; niveau: "urgent" | "traiter" | "info"; visible: boolean };
  const taches: Tache[] = [
    { texte: `Tournoi inter-clubs en cours : ${interclubEnCours?.name}`, detail: "Ouvrir la table de marque", section: "admin-interclubs", niveau: "urgent", visible: !!interclubEnCours && peutVoir("tournois") },
    { texte: `${pluriel(remises.length, "demande")} de tarif adulte remisé`, detail: "À accepter ou refuser, un mail part à l'adhérent", section: "admin-membres", niveau: "urgent", visible: remises.length > 0 && peutVoir("membres") },
    { texte: `${pluriel(alertesPaiement.length, "paiement")} HelloAsso à vérifier`, detail: "Montant trop faible ou autre formulaire", section: "admin-membres", niveau: "urgent", visible: alertesPaiement.length > 0 && peutVoir("membres") },
    { texte: `${pluriel(messages.length, "message")} sans réponse`, section: "admin-messages", niveau: "traiter", visible: messages.length > 0 && peutVoir("emailing") },
    { texte: `${pluriel(faq.length, "question")} FAQ en attente de réponse`, section: "admin-faq", niveau: "traiter", visible: faq.length > 0 && peutVoir("engagement") },
    { texte: `${pluriel(virements.length, "virement")} à valider`, detail: "Adhérents qui ont choisi le paiement par virement", section: "admin-membres", niveau: "traiter", visible: virements.length > 0 && peutVoir("membres") },
    { texte: `${pluriel(nonPayes.length - virements.length, "adhérent")} pas encore payé${nonPayes.length - virements.length > 1 ? "s" : ""} en ligne`, detail: `${totals.reste} € restent à encaisser au total`, section: "admin-membres", niveau: "traiter", visible: nonPayes.length - virements.length > 0 && peutVoir("membres") },
    { texte: `${pluriel(justifManquants.length, "étudiant")} sans justificatif`, section: "admin-membres", niveau: "traiter", visible: justifManquants.length > 0 && peutVoir("membres") },
    { texte: `${pluriel(tshirtsNonPayes.length, "t-shirt")} pas encore payé${tshirtsNonPayes.length > 1 ? "s" : ""}`, section: "admin-tshirts", niveau: "traiter", visible: tshirtsNonPayes.length > 0 && peutVoir("engagement") },
    { texte: `${pluriel(enAttente.length, "inscription")} mise${enAttente.length > 1 ? "s" : ""} de côté à vérifier`, section: "admin-membres", niveau: "info", visible: enAttente.length > 0 && peutVoir("membres") },
    { texte: coordonnees.length > 1 ? `${coordonnees.length} adhérents ont mis à jour leurs informations` : "1 adhérent a mis à jour ses informations", detail: "Mail, téléphone, nom ou catégorie changés cette saison", section: "admin-membres", niveau: "info", visible: coordonnees.length > 0 && peutVoir("membres") },
    { texte: `${pluriel(sansSexe.length, "adhérent")} sans fille/garçon renseigné`, detail: "Utile pour les mails des tournois Dames / Hommes", section: "admin-membres", niveau: "info", visible: sansSexe.length > 0 && peutVoir("membres") },
  ];
  const aFaire = taches.filter((x) => x.visible);

  // Liste « début de saison » (repart à zéro à chaque saison)
  const faits = db.checklistRentree?.saison === saison ? db.checklistRentree.faits : [];
  const etapes = ETAPES_RENTREE.map((e) => ({ ...e, fait: e.auto ? e.auto(db) : faits.includes(e.id) }));
  const nbFaits = etapes.filter((e) => e.fait).length;
  const [rentreeOuverte, setRentreeOuverte] = useState(nbFaits < etapes.length);
  async function cocher(id: string) {
    if (!onPersist || lectureSeule) return;
    const suivants = faits.includes(id) ? faits.filter((f) => f !== id) : [...faits, id];
    await onPersist({ ...db, checklistRentree: { saison, faits: suivants } });
  }

  const heure = new Date().getHours();
  const salut = heure < 18 ? "Bonjour" : "Bonsoir";
  const pastille = { urgent: "bg-[#C62828]", traiter: "bg-[#E8890C]", info: "bg-slate-400" } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl md:text-5xl text-[#0F1B26] leading-none">{salut}{prenom ? ` ${prenom}` : ""}</h1>
          <p className="text-slate-600 mt-1">Saison {saison}. Voici ce qui attend une action.</p>
        </div>
        <MaintenantFR />
      </div>

      {/* 🚨 Rappel visible tant que le verrou d'urgence est actif (seul le propriétaire peut voir cette page dans ce cas) */}
      {db.verrouAdmin?.actif && (
        <button onClick={() => aller("admin-journal")} className="w-full text-left rounded-xl border-2 border-[#C62828] bg-red-50 px-4 py-3 hover:bg-red-100 transition-colors">
          <p className="font-bold text-red-800">Verrou d&apos;urgence actif : les autres admins sont bloqués</p>
          <p className="text-sm text-red-700 mt-0.5">Clique ici pour aller le retirer (Journal).</p>
        </button>
      )}

      {interclubEnCours && peutVoir("tournois") && (
        <button onClick={() => aller("admin-interclubs")} className="w-full text-left rounded-xl p-4 bg-[#C62828] text-white flex items-center gap-3 hover:bg-[#A91F1F] transition-colors">
          <Radio className="w-6 h-6" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-bold text-lg">Tournoi inter-clubs en cours</span>
            <span className="block text-white/90">{interclubEnCours.name} : ouvrir la table de marque</span>
          </span>
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {/* ✅ À faire */}
      <section className="bg-white rounded-xl border border-[#D3DEE6]" aria-labelledby="titre-afaire">
        <div className="px-5 py-4 border-b border-[#D3DEE6] flex items-baseline justify-between gap-3">
          <h2 id="titre-afaire" className="font-display text-3xl text-[#0F1B26] leading-none">À faire</h2>
          {aFaire.length > 0 && <span className="text-slate-600 font-bold">{pluriel(aFaire.length, "point")}</span>}
        </div>
        {aFaire.length === 0 ? (
          <p className="px-5 py-6 text-lg text-slate-700 flex items-center gap-3"><CheckCircle2 className="w-6 h-6 text-[#157A55]" aria-hidden="true" /> Tout est à jour.</p>
        ) : (
          <ul className="divide-y divide-[#E3EBF1]">
            {aFaire.map((x, i) => (
              <li key={i}>
                <button onClick={() => aller(x.section)} className="w-full text-left px-5 min-h-[60px] py-3 flex items-center gap-4 hover:bg-[#F2F6F9] transition-colors">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${pastille[x.niveau]}`} aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-[#0F1B26]">{x.texte}</span>
                    {x.detail && <span className="block text-sm text-slate-600">{x.detail}</span>}
                  </span>
                  <span className="text-sm font-bold text-[#007DB0] shrink-0 hidden sm:inline">Ouvrir</span>
                  <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {peutVoir("membres") && (
          <Chiffre titre="Adhérents payés" valeur={`${payes}`} sous={`sur ${membres.length} inscrits`} onClick={() => aller("admin-membres")} />
        )}
        {peutVoir("comptabilite") && (
          <Chiffre titre="Trésorerie" valeur={`${totals.solde.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`} sous={`${totals.totalRecolte.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € reçus, ${totals.totalDepenses.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € dépensés`} onClick={() => aller("admin-comptabilite")} />
        )}
        {peutVoir("membres") && (
          <Chiffre titre="Étudiants / adultes" valeur={`${totals.ePayes} / ${totals.aPayes}`} sous={`payés sur ${totals.eTotal} et ${totals.aTotal}`} onClick={() => aller("admin-membres")} />
        )}
        {peutVoir("tournois") && (
          <Chiffre titre="Prochain tournoi" valeur={prochain ? prochain.d!.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "Aucun"}
            sous={prochain ? `${prochain.t.name}, ${inscritsProchain}${prochain.t.quota ? `/${prochain.t.quota}` : ""} binômes` : "pas de tournoi prévu"} onClick={() => aller("admin-tournois")} />
        )}
      </div>

      {/* ✅ Début de saison */}
      <section className="bg-white rounded-xl border border-[#D3DEE6]" aria-labelledby="titre-rentree">
        <button onClick={() => setRentreeOuverte((o) => !o)} aria-expanded={rentreeOuverte} className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left">
          <span>
            <span id="titre-rentree" className="block font-display text-3xl text-[#0F1B26] leading-none">Début de saison</span>
            <span className="block text-slate-600 mt-1">{nbFaits === etapes.length ? "Tout est prêt pour la saison." : `${nbFaits} étape${nbFaits > 1 ? "s" : ""} sur ${etapes.length} faite${nbFaits > 1 ? "s" : ""}`}</span>
          </span>
          <span className="font-bold text-[#007DB0]">{rentreeOuverte ? "Masquer" : "Afficher"}</span>
        </button>
        {rentreeOuverte && (
          <ul className="border-t border-[#D3DEE6] divide-y divide-[#E3EBF1]">
            {etapes.map((e) => (
              <li key={e.id} className="px-5 min-h-[56px] py-2 flex items-center gap-3">
                {e.auto ? (
                  <span className="shrink-0" title="Coché automatiquement d'après les réglages">
                    {e.fait ? <CheckCircle2 className="w-6 h-6 text-[#157A55]" aria-label="Fait" /> : <Circle className="w-6 h-6 text-slate-400" aria-label="À faire" />}
                  </span>
                ) : (
                  <button onClick={() => cocher(e.id)} disabled={lectureSeule} className="shrink-0 p-1 -m-1 rounded" aria-label={e.fait ? `Décocher : ${e.texte}` : `Cocher : ${e.texte}`}>
                    {e.fait ? <CheckCircle2 className="w-6 h-6 text-[#157A55]" /> : <Circle className="w-6 h-6 text-slate-400" />}
                  </button>
                )}
                <span className={`flex-1 ${e.fait ? "text-slate-500 line-through" : "text-[#0F1B26] font-bold"}`}>{e.texte}</span>
                <button onClick={() => aller(e.section)} className="text-sm font-bold text-[#007DB0] underline underline-offset-4 shrink-0 min-h-[44px]">Y aller</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Chiffre({ titre, valeur, sous, onClick }: { titre: string; valeur: string; sous: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border border-[#D3DEE6] p-4 hover:border-[#0F1B26] transition-colors min-w-0">
      <p className="text-sm font-bold text-slate-600">{titre}</p>
      <p className="font-display text-4xl text-[#0F1B26] leading-tight tabular-nums truncate">{valeur}</p>
      <p className="text-sm text-slate-600 truncate">{sous}</p>
    </button>
  );
}
