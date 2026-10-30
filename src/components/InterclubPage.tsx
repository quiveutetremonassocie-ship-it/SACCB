"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, Navigation, Users, Trophy, Clock, Plus, Trash2, Check, AlertTriangle, Loader2, Lock, Radio, Info, ChevronDown, ChevronUp } from "lucide-react";
import { interclubCall, interclubScore, interclubEffacerScore, InterclubPage as PageData } from "@/lib/db";
import { LiveMatch, LivePhase } from "@/lib/types";
import { matchJoue, classementGeneral, formatTexte } from "@/lib/interclubLive";
import { LiveBoard, ScoreForm, NomEquipe, texteScore, EtatMatch } from "./live/LiveBoard";
import EcranGeant from "./live/EcranGeant";

type Ligne = { id?: string; joueur1: string; joueur2: string; niveau: string };

const TYPE_LABEL: Record<string, string> = {
  Mixte: "👫 Double mixte",
  Hommes: "👬 Double hommes",
  Femmes: "👭 Double dames",
  Libre: "🏸 Double libre",
};

function dateLongue(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso + "T12:00:00");
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joursRestants(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const fin = new Date(iso + "T23:59:59").getTime();
  return Math.ceil((fin - Date.now()) / 86_400_000);
}

export default function InterclubPage() {
  const [token, setToken] = useState<string | null>(null);
  const [page, setPage] = useState<PageData | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // 🔑 Code d'accès du club (gardé pour l'onglet, pour ne pas le retaper à chaque rechargement)
  const [code, setCode] = useState("");
  const [saisie, setSaisie] = useState("");
  const [codeErreur, setCodeErreur] = useState("");
  // 🏁 Jour J : onglet « En direct » / « Infos & inscriptions », écran géant
  const [onglet, setOnglet] = useState<"direct" | "infos">("direct");
  const [ecran, setEcran] = useState<string | null>(null);
  const [edition, setEdition] = useState<string | null>(null); // match dont on corrige le score

  async function charger(t: string, c: string) {
    const r = await interclubCall(t, c);
    if (r.needCode) {
      try { sessionStorage.removeItem("saccb_interclub_" + t); } catch { /* ignore */ }
      setCodeErreur(c ? r.reason || "Code incorrect." : "");
    } else if (r.ok) {
      try { if (c) sessionStorage.setItem("saccb_interclub_" + t, c); } catch { /* ignore */ }
      setCode(c);
      if (r.club) setLignes(r.club.binomes.map((b) => ({ ...b })));
    }
    setPage(r);
  }

  useEffect(() => {
    // Le jeton est dans le # de l'adresse : il n'est jamais envoyé à l'hébergeur du site
    const hash = window.location.hash.replace(/^#/, "");
    // Écran géant : #ecran=<jeton live>
    if (hash.startsWith("ecran=")) { setEcran(hash.slice(6)); setToken(""); return; }
    const t = (hash || new URLSearchParams(window.location.search).get("c") || "").trim();
    setToken(t);
    if (!t) return;
    let memo = "";
    try { memo = sessionStorage.getItem("saccb_interclub_" + t) || ""; } catch { /* ignore */ }
    charger(t, memo);
  }, []);

  // 🔄 Pendant le tournoi : actualisation automatique toutes les 5 s (une requête à la fois, en pause si l'onglet est caché)
  const enDirect = !!page?.live;
  useEffect(() => {
    if (!enDirect || !token) return;
    let enCours = false;
    const iv = setInterval(() => {
      if (document.hidden || enCours) return;
      enCours = true;
      interclubCall(token, code).then((r) => { if (r.ok) setPage(r); }).finally(() => { enCours = false; });
    }, 5000);
    return () => clearInterval(iv);
  }, [enDirect, token, code]);

  async function effacerScore(m: LiveMatch) {
    if (!token) return;
    if (!confirm("Effacer ce score ? Le match repassera « à jouer ».")) return;
    const r = await interclubEffacerScore(token, code, m.id);
    if (!r.ok) { alert(r.reason || "Impossible d'effacer ce score."); return; }
    setPage(r);
    setEdition(null);
  }

  async function envoyerScore(m: LiveMatch, sa: number[], sb: number[]): Promise<string | null> {
    if (!token) return "Lien invalide.";
    const r = await interclubScore(token, code, m.id, sa, sb);
    if (!r.ok) return r.reason || "Erreur lors de l'enregistrement.";
    setPage(r);
    setEdition(null);
    return null;
  }

  async function validerCode(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !saisie.trim()) return;
    setBusy(true);
    setCodeErreur("");
    await charger(token, saisie.trim());
    setBusy(false);
  }

  const t = page?.tournoi;
  const club = page?.club;
  const quota = club?.quota ?? 0;
  const enregistre = useMemo(() => JSON.stringify(club?.binomes.map((b) => [b.id, b.joueur1, b.joueur2, b.niveau]) ?? []), [club]);
  const modifie = JSON.stringify(lignes.map((b) => [b.id, b.joueur1, b.joueur2, b.niveau])) !== enregistre;

  function maj(i: number, champ: keyof Ligne, v: string) {
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, [champ]: v } : l)));
    setMsg(null);
  }

  async function enregistrer() {
    if (!token || !t) return;
    for (const [i, l] of lignes.entries()) {
      if (l.joueur1.trim().length < 2 || l.joueur2.trim().length < 2) {
        setMsg({ ok: false, text: `Binôme ${i + 1} : indiquez les deux joueurs (prénom et nom).` });
        return;
      }
      if (t.niveaux.length > 0 && !l.niveau) {
        setMsg({ ok: false, text: `Binôme ${i + 1} : choisissez un niveau.` });
        return;
      }
    }
    setBusy(true);
    const r = await interclubCall(token, code, lignes);
    setBusy(false);
    if (r.ok && r.club) {
      setPage(r);
      setLignes(r.club.binomes.map((b) => ({ ...b })));
      setMsg({ ok: true, text: "Inscriptions enregistrées ✔ Vous pouvez revenir les modifier avec ce même lien." });
    } else {
      setMsg({ ok: false, text: r.reason || "Erreur lors de l'enregistrement." });
    }
  }

  if (ecran) return <EcranGeant liveToken={ecran} />;

  // ── États de chargement / erreur ──
  if (token === null || (token && !page)) {
    return (
      <Fond>
        <div className="flex flex-col items-center gap-3 text-white/80 py-32">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>Chargement du tournoi…</p>
        </div>
      </Fond>
    );
  }
  if (token && page?.needCode) {
    return (
      <Fond>
        <form onSubmit={validerCode} className="max-w-sm mx-auto bg-white rounded-3xl p-8 text-center shadow-2xl my-24 mx-4 sm:mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SACCB" className="w-16 h-16 mx-auto mb-3 object-contain" />
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-semibold mb-1">Tournoi inter-clubs</p>
          <p className="font-bold text-[#1e3a5f] text-xl mb-1 flex items-center justify-center gap-2">
            <Lock className="w-5 h-5" /> Espace réservé
          </p>
          <p className="text-slate-500 text-sm mb-5">Entrez le code d&apos;accès communiqué à votre club par le SACCB.</p>
          <input
            className="input w-full text-center text-xl tracking-[0.3em] font-mono uppercase"
            value={saisie}
            onChange={(e) => { setSaisie(e.target.value); setCodeErreur(""); }}
            placeholder="CODE"
            autoFocus
            autoComplete="off"
            maxLength={40}
          />
          {codeErreur && <p className="text-red-600 text-sm mt-2">{codeErreur}</p>}
          <button type="submit" disabled={busy || !saisie.trim()} className="btn-primary w-full mt-4">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Accéder
          </button>
        </form>
      </Fond>
    );
  }
  if (!token || !page?.ok || !t || !club) {
    return (
      <Fond>
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 text-center shadow-2xl my-24">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="font-bold text-slate-800 text-lg mb-2">Lien invalide</p>
          <p className="text-slate-600 text-sm">
            {page?.reason || "Ce lien d'inscription est incomplet. Utilisez le lien exact reçu du SACCB."}
          </p>
          <a href="mailto:contact@saccb.fr" className="inline-block mt-5 text-sm font-semibold text-blue-600 hover:underline">
            contact@saccb.fr
          </a>
        </div>
      </Fond>
    );
  }

  const restants = t.dateLimit ? joursRestants(t.dateLimit) : null;
  const mapQuery = encodeURIComponent([t.salleNom, t.salleAdresse].filter(Boolean).join(", "));
  const totalEquipes = club.binomes.length + (page.autres || []).reduce((s, c) => s + c.equipes, 0);

  return (
    <Fond>
      {/* ── En-tête ── */}
      <header className="max-w-5xl mx-auto px-4 pt-8 pb-10 text-center text-white">
        {/* Lien vers le site du SACCB (nouvel onglet : la page d'inscription reste ouverte) */}
        <a
          href="/"
          target="_blank"
          rel="noopener"
          title="Découvrir le site du SACCB"
          className="inline-flex items-center justify-center gap-3 mb-6 rounded-2xl px-3 py-2 hover:bg-white/10 transition"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SACCB" className="w-12 h-12 rounded-xl bg-white/10 p-1" />
          <span className="text-left">
            <span className="block font-bold tracking-[0.25em] text-sm" style={{ fontFamily: "Oswald, sans-serif" }}>SACCB</span>
            <span className="block text-[10px] uppercase tracking-[0.3em] text-white/50">Badminton · Sainte-Adresse</span>
          </span>
        </a>
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300 mb-3">Tournoi inter-clubs</p>
        <h1
          className="text-5xl md:text-7xl leading-none mb-5 bg-gradient-to-r from-white via-blue-200 to-emerald-200 bg-clip-text text-transparent"
          style={{ fontFamily: "'Bebas Neue', Oswald, sans-serif", letterSpacing: "0.04em" }}
        >
          {t.name}
        </h1>
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          <Pastille><CalendarDays className="w-4 h-4" /> {dateLongue(t.date)}</Pastille>
          {t.type && <Pastille>{TYPE_LABEL[t.type] || t.type}</Pastille>}
          {t.salleNom && <Pastille><MapPin className="w-4 h-4" /> {t.salleNom}</Pastille>}
        </div>
        {t.niveaux.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {t.niveaux.map((n) => (
              <span key={n} className="text-xs px-3 py-1 rounded-full bg-emerald-400/15 text-emerald-200 border border-emerald-300/30 font-semibold">
                {n}
              </span>
            ))}
          </div>
        )}
      </header>

      {page.live && (
        <div className="max-w-5xl mx-auto px-4 mb-6 flex justify-center gap-2">
          <button
            onClick={() => setOnglet("direct")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition ${onglet === "direct" ? "bg-white text-[#1e3a5f] shadow-lg" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            <Radio className={`w-4 h-4 ${page.live.termine ? "" : "text-red-500 animate-pulse"}`} /> {page.live.termine ? "Résultats" : "En direct"}
          </button>
          <button
            onClick={() => setOnglet("infos")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition ${onglet === "infos" ? "bg-white text-[#1e3a5f] shadow-lg" : "bg-white/10 text-white hover:bg-white/20"}`}
          >
            <Info className="w-4 h-4" /> Infos pratiques
          </button>
        </div>
      )}

      {page.live && onglet === "direct" ? (
        <main className="max-w-6xl mx-auto px-4 pb-16 space-y-6">
          <MesMatchs
            phases={page.live.phases}
            live={page.live}
            clubId={club.id || ""}
            edition={edition}
            setEdition={setEdition}
            envoyer={envoyerScore}
            effacer={effacerScore}
          />
          <LiveBoard phases={page.live.phases} equipes={page.live.equipes} termine={page.live.termine} clubs={page.live.clubs} />
          <p className="text-center text-[11px] text-white/40">Actualisation automatique toutes les 5 secondes</p>
        </main>
      ) : (
      <main className="max-w-5xl mx-auto px-4 pb-16 grid lg:grid-cols-5 gap-6">
        {/* ── Inscriptions du club ── */}
        <section className="lg:col-span-3 self-start bg-white rounded-3xl shadow-2xl p-5 md:p-7 order-1">
          <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Espace d&apos;inscription</p>
              <h2 className="text-2xl font-bold text-[#1e3a5f]">{club.nom}</h2>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-[#1e3a5f] leading-none">
                {lignes.length}<span className="text-slate-300 text-xl">/{quota}</span>
              </p>
              <p className="text-[11px] text-slate-500">binômes</p>
            </div>
          </div>

          {page.ouvert ? (
            restants !== null && (
              <p className={`text-sm mb-5 flex items-center gap-1.5 ${restants <= 3 ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                <Clock className="w-4 h-4" />
                {restants <= 0 ? "Dernier jour pour s'inscrire !" : `Inscriptions ouvertes jusqu'au ${dateLongue(t.dateLimit).toLowerCase()} (J-${restants})`}
              </p>
            )
          ) : (
            <p className="text-sm mb-5 flex items-center gap-1.5 text-red-600 font-semibold">
              <Lock className="w-4 h-4" /> Les inscriptions sont closes.
            </p>
          )}

          <div className="space-y-3">
            {lignes.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                Aucun binôme inscrit pour l&apos;instant
              </p>
            )}
            {lignes.map((l, i) => (
              <div key={l.id || `n${i}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">Binôme {i + 1}</p>
                  {page.ouvert && (
                    <button
                      onClick={() => { setLignes((ls) => ls.filter((_, j) => j !== i)); setMsg(null); }}
                      className="text-slate-400 hover:text-red-500 p-1"
                      title="Retirer ce binôme"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input className="input !text-sm" placeholder="Joueur 1 — Prénom Nom" value={l.joueur1} maxLength={80}
                    onChange={(e) => maj(i, "joueur1", e.target.value)} disabled={!page.ouvert} />
                  <input className="input !text-sm" placeholder="Joueur 2 — Prénom Nom" value={l.joueur2} maxLength={80}
                    onChange={(e) => maj(i, "joueur2", e.target.value)} disabled={!page.ouvert} />
                </div>
                {t.niveaux.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {t.niveaux.map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={!page.ouvert}
                        onClick={() => maj(i, "niveau", n)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition ${
                          l.niveau === n
                            ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                            : "bg-white text-slate-600 border-slate-300 hover:border-[#1e3a5f]"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {page.ouvert && (
            <>
              <button
                onClick={() => { setLignes((ls) => [...ls, { joueur1: "", joueur2: "", niveau: t.niveaux.length === 1 ? t.niveaux[0] : "" }]); setMsg(null); }}
                disabled={lignes.length >= quota}
                className="mt-3 w-full py-3 rounded-2xl border-2 border-dashed border-emerald-300 text-emerald-700 font-semibold text-sm hover:bg-emerald-50 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {lignes.length >= quota ? `Limite de ${quota} binôme${quota > 1 ? "s" : ""} atteinte` : "Ajouter un binôme"}
              </button>

              {msg && (
                <p className={`mt-4 text-sm rounded-xl px-4 py-3 flex items-start gap-2 ${msg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {msg.ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                  {msg.text}
                </p>
              )}

              <button onClick={enregistrer} disabled={busy || !modifie} className="btn-primary w-full mt-4">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {busy ? "Enregistrement…" : modifie ? "Enregistrer les inscriptions" : "Inscriptions à jour"}
              </button>
            </>
          )}
        </section>

        {/* ── Infos pratiques ── */}
        <aside className="lg:col-span-2 self-start space-y-6 order-2">
          {(t.salleNom || t.salleAdresse || t.sallePhotoUrl) && (
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              {t.sallePhotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.sallePhotoUrl} alt={t.salleNom || "La salle"} className="w-full h-48 object-cover" />
              )}
              <div className="p-5">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Le lieu</p>
                {t.salleNom && <p className="text-lg font-bold text-[#1e3a5f]">{t.salleNom}</p>}
                {t.salleAdresse && <p className="text-sm text-slate-600 flex items-start gap-1.5 mt-1"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />{t.salleAdresse}</p>}
              </div>
              {mapQuery && (
                <>
                  <iframe
                    title="Plan d'accès"
                    src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                    className="w-full h-56 border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#1e3a5f] to-emerald-600 hover:opacity-90 transition"
                  >
                    <Navigation className="w-4 h-4" /> Itinéraire
                  </a>
                </>
              )}
            </div>
          )}

          {t.deroulement && (
            <div className="bg-white rounded-3xl shadow-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" /> Déroulement
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{t.deroulement}</p>
            </div>
          )}

          <div className="bg-white/10 backdrop-blur rounded-3xl p-5 text-white border border-white/15">
            <p className="text-xs uppercase tracking-widest text-white/60 font-semibold mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Clubs participants · {totalEquipes} équipe{totalEquipes > 1 ? "s" : ""}
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between font-semibold text-emerald-200">
                <span>{club.nom} (vous)</span><span>{club.binomes.length}</span>
              </li>
              {(page.autres || []).map((c, i) => (
                <li key={i} className="flex justify-between text-white/80"><span>{c.nom}</span><span>{c.equipes}</span></li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
      )}

      <footer className="text-center text-white/40 text-xs pb-8">
        Organisé par le{" "}
        <a href="/" target="_blank" rel="noopener" className="hover:text-white/70 underline">SACCB — Sainte-Adresse Club Compétition Badminton</a> ·{" "}
        <a href="mailto:contact@saccb.fr" className="hover:text-white/70 underline">contact@saccb.fr</a>
      </footer>
    </Fond>
  );
}

/** 🏸 Les matchs des équipes du club dans la phase en cours, rangés par binôme (menus déroulants) */
function MesMatchs({
  phases, live, clubId, edition, setEdition, envoyer, effacer,
}: {
  phases: LivePhase[];
  live: NonNullable<PageData["live"]>;
  clubId: string;
  edition: string | null;
  setEdition: (id: string | null) => void;
  envoyer: (m: LiveMatch, sa: number[], sb: number[]) => Promise<string | null>;
  effacer: (m: LiveMatch) => void;
}) {
  // Binôme déplié (mémorisé sur le téléphone : chaque joueur retrouve directement le sien)
  const [ouvert, setOuvert] = useState<string | null>(null);
  useEffect(() => {
    try { setOuvert(localStorage.getItem("saccb_interclub_binome")); } catch { /* ignore */ }
  }, []);
  const basculer = (id: string) => {
    const n = ouvert === id ? null : id;
    setOuvert(n);
    try { if (n) localStorage.setItem("saccb_interclub_binome", n); else localStorage.removeItem("saccb_interclub_binome"); } catch { /* ignore */ }
  };

  const ph = phases[phases.length - 1];
  if (!ph || live.termine) return null;
  const mine = (id: string) => live.equipes[id]?.mine;
  // Mes binômes présents dans cette phase, avec leur poule
  const mesEquipes = ph.poules.flatMap((p) => p.equipes.filter(mine).map((id) => ({ id, poule: p })));
  if (mesEquipes.length === 0) return null;
  const estValide = (m: LiveMatch) => m.etat === "valide" || m.par === "admin";
  // 🏅 Place provisoire dans tout le tournoi (dès qu'un match de la phase a un score)
  const general = classementGeneral(ph);
  const classementVisible = ph.mode === "niveau" || ph.poules.some((p) => p.matchs.some(matchJoue));
  // Binômes du club rangés du mieux classé au moins bien classé dès que le classement existe
  if (classementVisible) mesEquipes.sort((x, y) => general.indexOf(x.id) - general.indexOf(y.id));

  const carte = (m: LiveMatch, moi: string) => {
    const valide = estValide(m);
    const saisiParAdversaire = !valide && matchJoue(m) && m.par !== clubId;
    const saisiParNous = !valide && matchJoue(m) && m.par === clubId;
    const enEdition = edition === m.id;
    const adversaire = m.a === moi ? m.b : m.a;
    return (
      <div key={m.id} className={`rounded-2xl border p-3 ${valide ? "border-emerald-200 bg-emerald-50/50" : saisiParAdversaire ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 mb-2">
          <span className="truncate">contre <span className="font-semibold text-slate-700">{live.equipes[adversaire] ? `${live.equipes[adversaire].joueur1} / ${live.equipes[adversaire].joueur2}` : "—"}</span>{live.equipes[adversaire] ? ` (${live.equipes[adversaire].club})` : ""}</span>
          <EtatMatch m={m} clubs={live.clubs} />
        </div>
        {(!matchJoue(m) || enEdition) && !valide ? (
          <ScoreForm m={m} format={ph.format} equipes={live.equipes} onSubmit={(sa, sb) => envoyer(m, sa, sb)} />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0"><NomEquipe id={m.a} equipes={live.equipes} compact /></div>
              <span className="font-mono font-bold text-[#1e3a5f] text-sm">{texteScore(m)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5"><div className="flex-1 min-w-0"><NomEquipe id={m.b} equipes={live.equipes} compact /></div></div>
            {saisiParAdversaire && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => envoyer(m, m.sa!, m.sb!)} className="flex-1 btn-primary !py-2 !text-xs"><Check className="w-4 h-4" /> Confirmer ce score</button>
                <button onClick={() => setEdition(m.id)} className="btn-ghost !py-2 !px-3 !text-xs">Corriger</button>
              </div>
            )}
            {saisiParNous && (
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>En attente de confirmation de l&apos;adversaire</span>
                <span className="flex gap-3">
                  <button onClick={() => setEdition(m.id)} className="text-blue-600 font-semibold hover:underline">Modifier</button>
                  <button onClick={() => effacer(m)} className="text-red-600 font-semibold hover:underline">Supprimer</button>
                </span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white rounded-3xl shadow-2xl p-5 md:p-6">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2 className="text-xl font-bold text-[#1e3a5f]">Vos binômes — {ph.nom}</h2>
        <p className="text-xs text-slate-500">{formatTexte(ph.format)}</p>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Touchez votre binôme pour voir vos matchs et entrer le score après chaque match. L&apos;équipe adverse le confirme (ou la table de marque le valide).
      </p>
      <div className="space-y-2">
        {mesEquipes.map(({ id, poule }) => {
          const e = live.equipes[id];
          const matchs = poule.matchs.filter((m) => m.a === id || m.b === id);
          const valides = matchs.filter(estValide).length;
          const aSaisir = matchs.filter((m) => !matchJoue(m)).length;
          const aConfirmer = matchs.filter((m) => !estValide(m) && matchJoue(m) && m.par !== clubId).length;
          const place = general.indexOf(id) + 1;
          const deplie = ouvert === id;
          return (
            <div key={id} className={`rounded-2xl border overflow-hidden ${deplie ? "border-[#1e3a5f]/40 shadow" : "border-slate-200"}`}>
              <button onClick={() => basculer(id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <span className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 text-white flex flex-col items-center justify-center leading-none" title="Place provisoire dans le tournoi">
                  {classementVisible && place > 0 ? (
                    <span className="font-bold whitespace-nowrap">
                      <span className="text-lg">{place}</span>
                      <span className="text-[11px] text-white/70">/{general.length}</span>
                    </span>
                  ) : (
                    <span className="font-bold whitespace-nowrap text-white/70">
                      <span className="text-lg">–</span>
                      <span className="text-[11px]">/{general.length}</span>
                    </span>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-slate-800 truncate">{e ? `${e.joueur1} / ${e.joueur2}` : "—"}</span>
                  <span className="block text-[11px] text-slate-500">
                    {poule.nom} · {valides}/{matchs.length} matchs validés
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 shrink-0">
                  {aConfirmer > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚠ {aConfirmer} à confirmer</span>}
                  {aSaisir > 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{aSaisir} à jouer</span>}
                  {aConfirmer === 0 && aSaisir === 0 && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ terminé</span>}
                </span>
                {deplie ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
              </button>
              {deplie && (
                <div className="border-t border-slate-100 bg-slate-50 p-3 grid md:grid-cols-2 gap-3">
                  {matchs.map((m) => carte(m, id))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Fond({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2440] via-[#1e3a5f] to-[#0f2440] relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-blue-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 w-[28rem] h-[28rem] rounded-full bg-emerald-500/20 blur-[120px]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function Pastille({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 backdrop-blur">
      {children}
    </span>
  );
}
