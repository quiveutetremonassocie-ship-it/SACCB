"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy, Loader2, Radio, Check, Users, CalendarDays, Lock, KeyRound } from "lucide-react";
import { membreInterne, MembreInterneReponse, TournoiInterneVue } from "@/lib/db";
import { LiveMatch } from "@/lib/types";
import { LiveBoard } from "./live/LiveBoard";
import ReglementTournoi from "./live/ReglementTournoi";
import { MesMatchs } from "./InterclubPage";

const TYPE_LABEL: Record<string, string> = { Mixte: "Double mixte", Hommes: "Double hommes", Femmes: "Double dames", Libre: "Double libre" };
const dateFr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : iso);

/** 🏠 Tournois internes (entre adhérents) dans l'espace adhérent : inscription, direct, scores */
export default function TournoisInternes({ email, codeInitial }: { email: string; codeInitial: string }) {
  const [code, setCode] = useState(codeInitial);
  const [saisieCode, setSaisieCode] = useState("");
  const [rep, setRep] = useState<MembreInterneReponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [edition, setEdition] = useState<string | null>(null);

  const appeler = useCallback(async (action: Parameters<typeof membreInterne>[0], extra: Record<string, unknown> = {}, c = code) => {
    if (!c) { setRep({ ok: false, needCode: true }); return null; }
    const r = await membreInterne(action, email, c, extra);
    if (r.ok || r.needCode) setRep(r);
    return r;
  }, [email, code]);

  useEffect(() => { appeler("membre_interne"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔄 Direct : actualisation toutes les 5 s pendant un tournoi en cours
  const enCours = !!rep?.tournois?.some((t) => t.live && !t.live.termine && t.monBinome);
  useEffect(() => {
    if (!enCours) return;
    let occupe = false;
    const iv = setInterval(() => {
      if (document.hidden || occupe) return;
      occupe = true;
      membreInterne("membre_interne", email, code).then((r) => { if (r.ok) setRep(r); }).finally(() => { occupe = false; });
    }, 5000);
    return () => clearInterval(iv);
  }, [enCours, email, code]);

  if (!rep) return <div className="flex justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  if (rep.needCode) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const c = saisieCode.trim();
          if (!c) return;
          setBusy(true);
          const r = await membreInterne("membre_interne", email, c);
          setBusy(false);
          if (r.ok) { setCode(c); try { sessionStorage.setItem("saccb_member_code", c); } catch { /* ignore */ } setRep(r); }
          else setMsg({ ok: false, text: r.reason || "Code incorrect." });
        }}
        className="mb-5 rounded-2xl border border-slate-200 p-4"
      >
        <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Tournois du club : entre ton code personnel</p>
        <div className="flex gap-2">
          <input type="password" className="input flex-1 !text-sm" value={saisieCode} onChange={(e) => setSaisieCode(e.target.value)} placeholder="Ton code personnel" />
          <button className="btn-primary !text-xs !px-4" disabled={busy}>OK</button>
        </div>
        {msg && !msg.ok && <p className="text-xs text-red-600 mt-1">{msg.text}</p>}
      </form>
    );
  }

  const tournois = rep.tournois || [];
  if (tournois.length === 0) return null;

  return (
    <div className="space-y-5 mb-6">
      {tournois.map((t) => (
        <CarteTournoi
          key={t.id}
          t={t}
          adherents={rep.adherents || []}
          busy={busy}
          msg={msg}
          edition={edition}
          setEdition={setEdition}
          inscrire={async (partenaireId, niveau) => {
            setBusy(true); setMsg(null);
            const r = await appeler("membre_interne_inscription", { tournoiId: t.id, partenaireId, niveau });
            setBusy(false);
            setMsg(r?.ok ? { ok: true, text: "Inscription enregistrée ✔" } : { ok: false, text: r?.reason || "Erreur." });
          }}
          retirer={async () => {
            if (!confirm("Te désinscrire de ce tournoi (avec ton partenaire) ?")) return;
            setBusy(true); setMsg(null);
            const r = await appeler("membre_interne_retrait", { tournoiId: t.id });
            setBusy(false);
            if (!r?.ok) setMsg({ ok: false, text: r?.reason || "Erreur." });
          }}
          envoyer={async (m, sa, sb) => {
            const r = await appeler("membre_interne_score", { tournoiId: t.id, matchId: m.id, sa, sb });
            if (!r?.ok) return r?.reason || "Erreur lors de l'enregistrement.";
            setEdition(null);
            return null;
          }}
          effacer={async (m) => {
            if (!confirm("Effacer ce score ? Le match repassera « à jouer ».")) return;
            const r = await appeler("membre_interne_score", { tournoiId: t.id, matchId: m.id, effacer: true });
            if (!r?.ok) alert(r?.reason || "Impossible d'effacer ce score.");
            setEdition(null);
          }}
          contester={async (m) => {
            if (!confirm("Contester ce score ?\n\nLa table de marque va venir au terrain pour régler le match.")) return;
            const r = await appeler("membre_interne_score", { tournoiId: t.id, matchId: m.id, contester: true });
            if (!r?.ok) alert(r?.reason || "Impossible de contester ce score.");
          }}
        />
      ))}
    </div>
  );
}

function CarteTournoi({
  t, adherents, busy, msg, edition, setEdition, inscrire, retirer, envoyer, effacer, contester,
}: {
  t: TournoiInterneVue;
  adherents: { id: string; nom: string }[];
  busy: boolean;
  msg: { ok: boolean; text: string } | null;
  edition: string | null;
  setEdition: (id: string | null) => void;
  inscrire: (partenaireId: string, niveau: string) => void;
  retirer: () => void;
  envoyer: (m: LiveMatch, sa: number[], sb: number[]) => Promise<string | null>;
  effacer: (m: LiveMatch) => void;
  contester: (m: LiveMatch) => void;
}) {
  const [partenaire, setPartenaire] = useState("");
  const [niveau, setNiveau] = useState(t.niveaux.length === 1 ? t.niveaux[0] : "");
  const live = t.live;
  const complet = t.nbBinomes >= t.quota;
  const statut = live
    ? live.termine ? { txt: "Terminé", cls: "bg-amber-100 text-amber-800" } : { txt: "🔴 En cours", cls: "bg-red-100 text-red-700" }
    : t.ouvert ? { txt: "Inscriptions ouvertes", cls: "bg-emerald-100 text-emerald-700" } : { txt: "Inscriptions fermées", cls: "bg-slate-100 text-slate-600" };

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-[#1e3a5f] to-[#2a5285] text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 font-semibold">Tournoi du club</p>
            <p className="font-bold text-lg leading-tight">{t.name}</p>
          </div>
          <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${statut.cls}`}>{statut.txt}</span>
        </div>
        <p className="text-xs text-white/75 mt-1 flex flex-wrap gap-x-3">
          {t.date && <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {dateFr(t.date)}</span>}
          {t.type && <span>{TYPE_LABEL[t.type] || t.type}</span>}
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t.nbBinomes}/{t.quota} binômes</span>
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Mon inscription */}
        {t.monBinome ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-emerald-800">
              <Check className="w-4 h-4 inline mr-1" /> Inscrit(e) : <strong>{t.monBinome.joueur1} / {t.monBinome.joueur2}</strong>
              {t.monBinome.niveau && <span className="text-xs text-emerald-700"> · {t.monBinome.niveau}</span>}
            </p>
            {t.ouvert && <button onClick={retirer} disabled={busy} className="text-xs text-red-600 font-semibold hover:underline">Me désinscrire</button>}
          </div>
        ) : t.ouvert ? (
          complet ? (
            <p className="text-sm text-slate-500 flex items-center gap-2"><Lock className="w-4 h-4" /> Le tournoi est complet.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-700">S&apos;inscrire avec un partenaire</p>
              <select className="input w-full !text-sm" value={partenaire} onChange={(e) => setPartenaire(e.target.value)}>
                <option value="">— Choisis ton partenaire —</option>
                {adherents.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
              </select>
              {t.niveaux.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.niveaux.map((n) => (
                    <button key={n} type="button" onClick={() => setNiveau(n)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-semibold ${niveau === n ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white text-slate-600 border-slate-300"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => inscrire(partenaire, niveau)}
                disabled={busy || !partenaire || (t.niveaux.length > 0 && !niveau)}
                className="btn-primary w-full !text-xs"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />} S&apos;inscrire
              </button>
              {t.dateLimit && <p className="text-[11px] text-slate-500 text-center">Inscriptions jusqu&apos;au {dateFr(t.dateLimit)}</p>}
            </div>
          )
        ) : !live ? (
          <p className="text-sm text-slate-500">Les inscriptions sont fermées.</p>
        ) : null}
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}

        {/* 🔴 Direct : mes matchs + toutes les poules */}
        {live && (
          <div className="space-y-4">
            {t.monBinome && (
              <MesMatchs
                phases={live.phases}
                live={live}
                clubId={t.monBinome.id}
                edition={edition}
                setEdition={setEdition}
                envoyer={envoyer}
                effacer={effacer}
                contester={contester}
              />
            )}
            <div className="rounded-2xl bg-gradient-to-br from-[#0f2440] to-[#1e3a5f] p-3">
              <p className="text-white text-sm font-bold mb-2 flex items-center gap-2">
                <Radio className={`w-4 h-4 ${live.termine ? "" : "text-red-400 animate-pulse"}`} /> {live.termine ? "Résultats" : "En direct"}
                <span className="text-[10px] font-normal text-white/50">· mis à jour toutes les 5 s</span>
              </p>
              <LiveBoard phases={live.phases} equipes={live.equipes} termine={live.termine} clubs={live.clubs} />
            </div>
          </div>
        )}

        {t.deroulement && !live && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-[#1e3a5f]">Déroulement</summary>
            <p className="mt-2 whitespace-pre-line text-slate-600">{t.deroulement}</p>
          </details>
        )}
        <ReglementTournoi programme={t.programme} phases={live?.phases} />
      </div>
    </div>
  );
}
