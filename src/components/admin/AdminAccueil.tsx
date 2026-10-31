"use client";

import { Users, Wallet, Inbox, Shirt, Trophy, GraduationCap, PauseCircle, ChevronRight, Radio, CheckCircle2 } from "lucide-react";
import { DB } from "@/lib/types";

type Totaux = { totalRecolte: number; reste: number; aPayes: number; aTotal: number; ePayes: number; eTotal: number; totalDepenses: number; solde: number };

/** 🏠 Tableau de bord de l'admin : l'essentiel en un coup d'œil + ce qu'il reste à faire */
export default function AdminAccueil({
  db, totals, aller, prenom, peutVoir,
}: {
  db: DB;
  totals: Totaux;
  aller: (section: string) => void;
  prenom?: string;
  peutVoir: (section: string) => boolean;
}) {
  const saison = `${db.y1}-${db.y2}`;
  const membres = db.membres || [];
  const payes = membres.filter((m) => m.ok).length;
  const nonPayes = membres.filter((m) => !m.ok && !m.enAttente);
  const enAttente = membres.filter((m) => m.enAttente);
  const justifManquants = membres.filter((m) => m.type === "Etudiant" && m.justificatif?.saison !== saison);
  const sansSexe = membres.filter((m) => !m.sexe);
  const messages = (db.contactMessages || []).filter((m) => !m.archived && !m.respondedBy);
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
  const prochains = (db.config_tournois || [])
    .map((t) => ({ t, d: lireDate(t.date) }))
    .filter((x) => x.d && x.d >= aujourdhui)
    .sort((a, b) => a.d!.getTime() - b.d!.getTime());
  const prochain = prochains[0];
  const inscritsProchain = prochain ? (db.inscrits_tournoi || []).filter((i) => i.tournoiId === prochain.t.id).length : 0;

  // ✅ À faire, du plus urgent au moins urgent
  const aFaire: { texte: string; detail?: string; section: string; couleur: string; visible: boolean }[] = [
    { texte: `${messages.length} message${messages.length > 1 ? "s" : ""} sans réponse`, section: "admin-messages", couleur: "bg-blue-500", visible: messages.length > 0 && peutVoir("emailing") },
    { texte: `Tournoi inter-clubs en cours : ${interclubEnCours?.name}`, detail: "Ouvrir la table de marque", section: "admin-interclubs", couleur: "bg-red-500", visible: !!interclubEnCours && peutVoir("tournois") },
    { texte: `${nonPayes.length} adhérent${nonPayes.length > 1 ? "s" : ""} pas encore payé${nonPayes.length > 1 ? "s" : ""}`, detail: `${totals.reste} € à encaisser`, section: "admin-membres", couleur: "bg-amber-500", visible: nonPayes.length > 0 && peutVoir("membres") },
    { texte: `${justifManquants.length} étudiant${justifManquants.length > 1 ? "s" : ""} sans justificatif`, section: "admin-membres", couleur: "bg-violet-500", visible: justifManquants.length > 0 && peutVoir("membres") },
    { texte: `${enAttente.length} inscription${enAttente.length > 1 ? "s" : ""} mise${enAttente.length > 1 ? "s" : ""} de côté à vérifier`, section: "admin-membres", couleur: "bg-slate-500", visible: enAttente.length > 0 && peutVoir("membres") },
    { texte: `${tshirtsNonPayes.length} t-shirt${tshirtsNonPayes.length > 1 ? "s" : ""} pas encore payé${tshirtsNonPayes.length > 1 ? "s" : ""}`, section: "admin-tshirts", couleur: "bg-orange-500", visible: tshirtsNonPayes.length > 0 && peutVoir("engagement") },
    { texte: `${sansSexe.length} adhérent${sansSexe.length > 1 ? "s" : ""} sans fille/garçon renseigné`, detail: "Utile pour les mails des tournois Dames / Hommes", section: "admin-membres", couleur: "bg-pink-500", visible: sansSexe.length > 0 && peutVoir("membres") },
  ].filter((x) => x.visible);

  const heure = new Date().getHours();
  const salut = heure < 18 ? "Bonjour" : "Bonsoir";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{salut}{prenom ? ` ${prenom}` : ""} 👋</h1>
        <p className="text-slate-500 text-sm">Saison {saison} · voici l&apos;essentiel du moment.</p>
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {peutVoir("membres") && (
          <Carte icone={<Users className="w-5 h-5" />} couleur="from-cyan-500 to-blue-600" titre="Adhérents" onClick={() => aller("admin-membres")}
            valeur={`${payes}`} sous={`payés sur ${membres.length} inscrits`} />
        )}
        {peutVoir("comptabilite") && (
          <Carte icone={<Wallet className="w-5 h-5" />} couleur="from-emerald-500 to-green-600" titre="Trésorerie" onClick={() => aller("admin-comptabilite")}
            valeur={`${totals.solde.toLocaleString("fr-FR")} €`} sous={`${totals.totalRecolte} € reçus · ${totals.totalDepenses} € dépensés`} />
        )}
        {peutVoir("emailing") && (
          <Carte icone={<Inbox className="w-5 h-5" />} couleur="from-indigo-500 to-blue-500" titre="Messages" onClick={() => aller("admin-messages")}
            valeur={`${messages.length}`} sous={messages.length ? "sans réponse" : "tout est répondu"} alerte={messages.length > 0} />
        )}
        {peutVoir("tournois") && (
          <Carte icone={<Trophy className="w-5 h-5" />} couleur="from-amber-500 to-orange-500" titre="Prochain tournoi" onClick={() => aller("admin-tournois")}
            valeur={prochain ? prochain.d!.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—"}
            sous={prochain ? `${prochain.t.name} · ${inscritsProchain}${prochain.t.quota ? `/${prochain.t.quota}` : ""} binômes` : "aucun de prévu"} />
        )}
      </div>

      {interclubEnCours && peutVoir("tournois") && (
        <button onClick={() => aller("admin-interclubs")} className="w-full text-left rounded-2xl p-4 bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg flex items-center gap-3 hover:opacity-95">
          <Radio className="w-6 h-6 animate-pulse" />
          <span className="flex-1">
            <span className="block font-bold">Tournoi inter-clubs en cours</span>
            <span className="block text-sm text-white/85">{interclubEnCours.name} — ouvrir la table de marque</span>
          </span>
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* À faire */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <p className="px-5 py-3 border-b border-slate-100 font-bold text-slate-800">✅ À faire</p>
        {aFaire.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Rien d&apos;urgent, tout est à jour !</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {aFaire.map((x, i) => (
              <li key={i}>
                <button onClick={() => aller(x.section)} className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${x.couleur}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-700">{x.texte}</span>
                    {x.detail && <span className="block text-xs text-slate-500">{x.detail}</span>}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Petits indicateurs */}
      <div className="grid sm:grid-cols-3 gap-3">
        {peutVoir("membres") && (
          <Mini icone={<GraduationCap className="w-4 h-4" />} texte={`${totals.ePayes}/${totals.eTotal} étudiants payés · ${totals.aPayes}/${totals.aTotal} adultes`} onClick={() => aller("admin-membres")} />
        )}
        {peutVoir("engagement") && (
          <Mini icone={<Shirt className="w-4 h-4" />} texte={`${tshirts.length} t-shirt${tshirts.length > 1 ? "s" : ""} commandé${tshirts.length > 1 ? "s" : ""} · ${tshirts.length - tshirtsNonPayes.length} payé${tshirts.length - tshirtsNonPayes.length > 1 ? "s" : ""}`} onClick={() => aller("admin-tshirts")} />
        )}
        {peutVoir("membres") && (
          <Mini icone={<PauseCircle className="w-4 h-4" />} texte={`${enAttente.length} inscription${enAttente.length > 1 ? "s" : ""} mise${enAttente.length > 1 ? "s" : ""} de côté`} onClick={() => aller("admin-membres")} />
        )}
      </div>
    </div>
  );
}

function Carte({ icone, couleur, titre, valeur, sous, onClick, alerte }: { icone: React.ReactNode; couleur: string; titre: string; valeur: string; sous: string; onClick: () => void; alerte?: boolean }) {
  return (
    <button onClick={onClick} className="text-left bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition relative">
      <span className={`inline-flex w-9 h-9 rounded-xl bg-gradient-to-br ${couleur} text-white items-center justify-center mb-2`}>{icone}</span>
      {alerte && <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{titre}</p>
      <p className="text-2xl font-bold text-slate-800 leading-tight">{valeur}</p>
      <p className="text-xs text-slate-500 truncate">{sous}</p>
    </button>
  );
}

function Mini({ icone, texte, onClick }: { icone: React.ReactNode; texte: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-600 flex items-center gap-2 hover:bg-slate-50">
      <span className="text-slate-400">{icone}</span> {texte}
    </button>
  );
}
