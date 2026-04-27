"use client";

import { LogOut, MessageCircle, UserCircle2, Trophy, KeyRound, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp, X, Star, Bell, BellOff } from "lucide-react";
import { useState, useMemo } from "react";
import { MemberSession, clearMemberSession, setMemberSession } from "@/lib/useMemberSession";
import { memberChangeCode, memberUpdateNewsOptIn } from "@/lib/db";
import { Tournoi, InscritTournoi, SeasonArchive } from "@/lib/types";

export default function MemberPanel({
  session,
  y1,
  y2,
  whatsappLink,
  inscCloseDate,
  configTournois = [],
  inscritsTournoi = [],
  archives = [],
  onClose,
  onBack,
}: {
  session: MemberSession;
  y1: number;
  y2: number;
  whatsappLink?: string | null;
  inscCloseDate?: string;
  configTournois?: Tournoi[];
  inscritsTournoi?: InscritTournoi[];
  archives?: SeasonArchive[];
  onClose: () => void;
  onBack?: () => void;
}) {
  const [histOpen, setHistOpen] = useState(false);
  const [classementOpen, setClassementOpen] = useState(false);
  const [openTournois, setOpenTournois] = useState<Set<string>>(new Set());

  function toggleTournoi(id: string) {
    setOpenTournois(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [oldCode, setOldCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  // Préférence news
  const [newsOptIn, setNewsOptIn] = useState(session.newsOptIn !== false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsMsg, setNewsMsg] = useState<string | null>(null);

  async function toggleNews() {
    const next = !newsOptIn;
    setNewsLoading(true);
    setNewsMsg(null);
    // On a besoin du code — stocké dans adminCode pour les admins, sinon via sessionStorage
    const code = session.adminCode || sessionStorage.getItem("saccb_member_code") || "";
    const r = await memberUpdateNewsOptIn(session.email, code, session.membreId, next);
    setNewsLoading(false);
    if (r.ok) {
      setNewsOptIn(next);
      // Mettre à jour la session en localStorage
      setMemberSession({ ...session, newsOptIn: next });
      setNewsMsg(next ? "Vous recevrez les news du club." : "Vous ne recevrez plus les news.");
      setTimeout(() => setNewsMsg(null), 3000);
    } else {
      setNewsMsg("Erreur, réessayez.");
    }
  }

  // Historique : fusionner saison courante + archives, garder tournois passés
  const today = new Date().toISOString().slice(0, 10);

  function isDatePast(dateStr: string): boolean {
    if (!dateStr) return false;
    // Format ISO YYYY-MM-DD : comparaison lexicographique fiable
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr <= today;
    // Autre format : on tente un parsing natif
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10) <= today;
    // Date en texte libre non parsable → on l'inclut dans l'historique par défaut
    return true;
  }

  const allSeasons = useMemo(() => {
    const current = {
      y1, y2,
      config_tournois: configTournois,
      inscrits_tournoi: inscritsTournoi,
      membresCount: 0,
    };
    return [...(archives ?? []), current]
      .map((s) => {
        const past = (s.config_tournois ?? []).filter((t) => isDatePast(t.date));
        if (past.length === 0) return null;
        return {
          label: `${s.y1}–${s.y2}`,
          tournois: past.map((t) => {
            const inscrits = (s.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
            const myEntry = inscrits.find((i) =>
              i.joueurs.toLowerCase().includes(session.nom.toLowerCase())
            );
            return { tournoi: t, myEntry, totalEquipes: inscrits.length };
          }),
        };
      })
      .filter(Boolean)
      .reverse() as { label: string; tournois: { tournoi: Tournoi; myEntry: InscritTournoi | undefined; totalEquipes: number }[] }[];
  }, [archives, configTournois, inscritsTournoi, y1, y2, today, session.nom]);

  const totalPast = allSeasons.reduce((s, a) => s + a.tournois.length, 0);

  // Classement binômes saison courante
  const classement = useMemo(() => {
    const withResults = inscritsTournoi.filter((i) => i.resultat && /^\d+\/\d+$/.test(i.resultat.trim()));
    if (withResults.length === 0) return null;

    // Par tournoi
    const parTournoi = configTournois
      .map((t) => {
        const inscrits = withResults
          .filter((i) => i.tournoiId === t.id)
          .map((i) => {
            const [r, tot] = i.resultat!.trim().split("/").map(Number);
            return { joueurs: i.joueurs, rank: r, total: tot };
          })
          .sort((a, b) => a.rank - b.rank);
        return inscrits.length > 0 ? { tournoi: t, inscrits } : null;
      })
      .filter(Boolean) as { tournoi: Tournoi; inscrits: { joueurs: string; rank: number; total: number }[] }[];

    // Stats globales par binôme
    const duoMap = new Map<string, { joueurs: string; participations: number; podiums: number; scoreTotal: number }>();
    for (const t of parTournoi) {
      for (const i of t.inscrits) {
        const key = i.joueurs;
        const existing = duoMap.get(key);
        // Score : plus le rang est bas et le total élevé, meilleur c'est
        const score = i.total - i.rank + 1;
        if (!existing) {
          duoMap.set(key, { joueurs: key, participations: 1, podiums: i.rank <= 3 ? 1 : 0, scoreTotal: score });
        } else {
          existing.participations++;
          if (i.rank <= 3) existing.podiums++;
          existing.scoreTotal += score;
        }
      }
    }
    const duos = Array.from(duoMap.values()).sort((a, b) =>
      b.podiums - a.podiums || b.scoreTotal - a.scoreTotal || b.participations - a.participations
    );

    return { parTournoi, duos };
  }, [inscritsTournoi, configTournois]);

  // Calcul du nombre de jours avant la date limite d'inscription (uniquement si non payé)
  const deadlineBanner = useMemo(() => {
    if (session.paid === true || !inscCloseDate) return null;
    const closeTs = new Date(inscCloseDate).getTime();
    const todayTs = new Date(new Date().toISOString().slice(0, 10)).getTime();
    const daysLeft = Math.round((closeTs - todayTs) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0 || daysLeft > 30) return null;
    const dateFormatted = new Date(inscCloseDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    return { daysLeft, dateFormatted, urgent: daysLeft <= 5 };
  }, [session.paid, inscCloseDate]);

  function logout() {
    clearMemberSession();
    onClose();
  }

  async function handleChangeCode(e: React.FormEvent) {
    e.preventDefault();
    if (newCode !== confirmCode) {
      setCodeMsg({ ok: false, text: "Les deux nouveaux codes ne correspondent pas." });
      return;
    }
    setCodeLoading(true);
    setCodeMsg(null);
    const r = await memberChangeCode(session.email, oldCode, newCode);
    setCodeLoading(false);
    if (r.ok) {
      setCodeMsg({ ok: true, text: "Code modifié avec succès !" });
      setOldCode(""); setNewCode(""); setConfirmCode("");
      setTimeout(() => setShowCodeForm(false), 1500);
    } else {
      setCodeMsg({ ok: false, text: r.reason || "Erreur." });
    }
  }

  return (
    <div className="fixed inset-0 z-[4500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center">
              <UserCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-xl tracking-wider text-slate-800">Espace membre</h3>
              <p className="text-xs text-slate-400">Saison {y1}–{y2}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
              Déco
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="text-slate-400 hover:text-slate-600 transition"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Renouvellement si non payé pour cette saison */}
        {session.paid === false && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-800 font-semibold text-sm mb-1">⏳ Adhésion à renouveler</p>
            <p className="text-amber-700 text-xs mb-3">
              Votre adhésion pour la saison {y1}–{y2} n&apos;est pas encore réglée.
              Renouvelez-la pour conserver votre accès.
            </p>
            <a
              href="https://www.helloasso.com/associations/sainte-adresse-club-de-competition-du-badminton-s-a-c-c-b/evenements/tarif-adulte"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2.5 rounded-xl transition text-sm w-full"
            >
              <RefreshCw className="w-4 h-4" />
              Renouveler mon adhésion
            </a>
          </div>
        )}

        {/* Bandeau deadline — uniquement si non payé et deadline dans les 30 jours */}
        {deadlineBanner && (
          <div className={`mb-4 rounded-xl p-4 border ${deadlineBanner.urgent ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"}`}>
            <p className={`font-semibold text-sm mb-1 ${deadlineBanner.urgent ? "text-red-800" : "text-orange-800"}`}>
              {deadlineBanner.daysLeft === 1 ? "🚨 Dernière chance — plus que 24h !" : `⏰ Plus que ${deadlineBanner.daysLeft} jour${deadlineBanner.daysLeft > 1 ? "s" : ""} !`}
            </p>
            <p className={`text-xs ${deadlineBanner.urgent ? "text-red-700" : "text-orange-700"}`}>
              Votre adhésion doit être finalisée avant le <strong>{deadlineBanner.dateFormatted}</strong>.
              Passé cette date, votre inscription sera annulée.
            </p>
          </div>
        )}

        {/* Badge membre */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" /> Votre carte membre
          </p>
          <Badge nom={session.nom} type={session.type} y1={y1} y2={y2} />
          <p className="text-xs text-slate-400 text-center mt-2">
            Faites une capture d&apos;écran pour la conserver.
          </p>
        </div>

        {/* Changer le code */}
        <div className="mb-4">
          <button
            onClick={() => { setShowCodeForm(!showCodeForm); setCodeMsg(null); }}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition w-full justify-center border border-slate-200 rounded-xl py-2 hover:bg-slate-50"
          >
            <KeyRound className="w-4 h-4" />
            Changer mon code personnel
          </button>
          {showCodeForm && (
            <form onSubmit={handleChangeCode} className="mt-3 space-y-2">
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showOld ? "text" : "password"}
                  inputMode="numeric"
                  placeholder="Code actuel"
                  value={oldCode}
                  onChange={(e) => setOldCode(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showNew ? "text" : "password"}
                  inputMode="numeric"
                  placeholder="Nouveau code (min. 4 chiffres)"
                  pattern="\d{4,}"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                placeholder="Confirmer le nouveau code"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                required
              />
              {codeMsg && (
                <p className={`text-xs text-center font-semibold ${codeMsg.ok ? "text-emerald-600" : "text-red-500"}`}>
                  {codeMsg.text}
                </p>
              )}
              <button type="submit" className="btn-primary w-full !text-sm" disabled={codeLoading}>
                {codeLoading ? "Enregistrement..." : "Enregistrer le nouveau code"}
              </button>
            </form>
          )}
        </div>

        {/* Préférences news */}
        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {newsOptIn
                ? <Bell className="w-4 h-4 text-emerald-500 shrink-0" />
                : <BellOff className="w-4 h-4 text-slate-400 shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">News du club</p>
                <p className="text-xs text-slate-400 truncate">
                  {newsOptIn ? "Activées — tournois, rappels, infos" : "Désactivées"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleNews}
              disabled={newsLoading}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${newsOptIn ? "bg-emerald-500" : "bg-slate-300"}`}
              title={newsOptIn ? "Désactiver les news" : "Activer les news"}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${newsOptIn ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          {newsMsg && (
            <p className="text-xs text-slate-500 mt-2 text-center">{newsMsg}</p>
          )}
        </div>

        {/* Classement de la saison */}
        {classement && (
          <div className="mb-4">
            <button
              onClick={() => setClassementOpen(!classementOpen)}
              className="flex items-center justify-between w-full text-sm font-medium text-slate-700 border border-slate-200 rounded-xl px-4 py-2.5 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Classement de la saison
              </span>
              {classementOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {classementOpen && (
              <div className="mt-2 space-y-4">
                {/* Meilleur binôme */}
                {classement.duos.length > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-3 flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" /> Meilleur binôme de la saison
                    </p>
                    <div className="space-y-2">
                      {classement.duos.slice(0, 3).map((duo, i) => (
                        <div key={duo.joueurs} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{duo.joueurs}</p>
                              <p className="text-xs text-slate-400">
                                {duo.participations} tournoi{duo.participations > 1 ? "s" : ""}
                                {duo.podiums > 0 && ` · ${duo.podiums} podium${duo.podiums > 1 ? "s" : ""}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Résultats par tournoi (accordéon) */}
                {classement.parTournoi.map(({ tournoi, inscrits }) => {
                  const isOpen = openTournois.has(tournoi.id);
                  return (
                    <div key={tournoi.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => toggleTournoi(tournoi.id)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-100 hover:bg-slate-200 transition text-left"
                      >
                        <span className="text-xs font-semibold text-slate-600 uppercase tracking-widest">
                          🏸 {tournoi.name}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                          {inscrits.length} équipe{inscrits.length > 1 ? "s" : ""}
                          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="divide-y divide-slate-100">
                          {inscrits.map((insc) => (
                            <div key={insc.joueurs} className="flex items-center justify-between px-3 py-2">
                              <span className="text-sm text-slate-700 flex items-center gap-2">
                                <span className="text-slate-400 font-mono text-xs w-5 text-right">{insc.rank}.</span>
                                {insc.joueurs}
                              </span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                insc.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                                insc.rank === 2 ? "bg-slate-200 text-slate-600" :
                                insc.rank === 3 ? "bg-amber-100 text-amber-700" :
                                "bg-slate-100 text-slate-500"
                              }`}>
                                {insc.rank === 1 ? "🥇" : insc.rank === 2 ? "🥈" : insc.rank === 3 ? "🥉" : ""} {insc.rank}e/{insc.total}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Historique des tournois */}
        {totalPast > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setHistOpen(!histOpen)}
              className="flex items-center justify-between w-full text-sm font-medium text-slate-700 border border-slate-200 rounded-xl px-4 py-2.5 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Historique des tournois ({totalPast})
              </span>
              {histOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {histOpen && (
              <div className="mt-2 space-y-3">
                {allSeasons.map((season) => (
                  <div key={season.label}>
                    <p className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 px-1">Saison {season.label}</p>
                    <div className="space-y-1.5">
                      {season.tournois.map(({ tournoi, myEntry, totalEquipes }) => (
                        <div key={tournoi.id} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{tournoi.name}</p>
                              <p className="text-xs text-slate-400">{tournoi.date}</p>
                              {myEntry && (
                                <p className="text-xs text-slate-500 mt-0.5 truncate">
                                  🎾 {myEntry.joueurs}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              {myEntry?.resultat ? (
                                <ResultBadge resultat={myEntry.resultat} total={totalEquipes} />
                              ) : myEntry ? (
                                <span className="text-xs text-slate-400">Participé</span>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WhatsApp — uniquement pour les membres ayant payé */}
        {whatsappLink && session.paid === true ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold px-5 py-3 rounded-xl transition w-full"
          >
            <MessageCircle className="w-5 h-5" />
            Rejoindre le groupe WhatsApp
          </a>
        ) : whatsappLink && session.paid !== true ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500 text-center">
            🔒 Le lien du groupe WhatsApp vous sera transmis une fois votre paiement validé.
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <MessageCircle className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-400">
              Le lien WhatsApp sera disponible prochainement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ nom, type, y1, y2 }: { nom: string; type: string; y1: number; y2: number }) {
  return (
    <div className="relative max-w-sm mx-auto bg-gradient-to-br from-[#1e3a5f] to-[#0f2440] border-2 border-blue-400/60 rounded-2xl p-6 shadow-2xl shadow-blue-500/20 overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
      <div className="font-display text-xl text-blue-400 tracking-widest border-b border-white/10 pb-2 mb-4">
        MEMBRE OFFICIEL SACCB
      </div>
      <div className="text-2xl font-bold uppercase text-white">{nom}</div>
      <div className="text-xs uppercase tracking-widest text-white/50 mt-1">
        Saison {y1}–{y2}
      </div>
      <div className="flex items-end justify-between mt-6">
        <span className="text-xs uppercase tracking-widest text-white/60">{type}</span>
        <span className="font-display text-lg text-white/40">ST-ADRESSE</span>
      </div>
    </div>
  );
}

function ResultBadge({ resultat, total }: { resultat: string; total: number }) {
  const parts = resultat.split("/");
  const rank = parseInt(parts[0]);
  const tot = parseInt(parts[1]) || total;
  if (isNaN(rank)) return <span className="text-xs text-slate-500">{resultat}</span>;
  if (rank === 1) return <span className="text-sm font-bold text-yellow-500">🥇 1er / {tot}</span>;
  if (rank === 2) return <span className="text-sm font-bold text-slate-400">🥈 2e / {tot}</span>;
  if (rank === 3) return <span className="text-sm font-bold text-amber-600">🥉 3e / {tot}</span>;
  return <span className="text-xs font-semibold text-slate-600">{rank}e / {tot}</span>;
}
