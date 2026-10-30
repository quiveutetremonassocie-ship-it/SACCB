"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, Navigation, Users, Trophy, Clock, Plus, Trash2, Check, AlertTriangle, Loader2, Lock } from "lucide-react";
import { interclubCall, InterclubPage as PageData } from "@/lib/db";

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

  useEffect(() => {
    // Le jeton est dans le # de l'adresse : il n'est jamais envoyé à l'hébergeur du site
    const t = (window.location.hash.replace(/^#/, "") || new URLSearchParams(window.location.search).get("c") || "").trim();
    setToken(t);
    if (!t) return;
    interclubCall(t).then((r) => {
      setPage(r);
      if (r.ok && r.club) setLignes(r.club.binomes.map((b) => ({ ...b })));
    });
  }, []);

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
    const r = await interclubCall(token, lignes);
    setBusy(false);
    if (r.ok && r.club) {
      setPage(r);
      setLignes(r.club.binomes.map((b) => ({ ...b })));
      setMsg({ ok: true, text: "Inscriptions enregistrées ✔ Vous pouvez revenir les modifier avec ce même lien." });
    } else {
      setMsg({ ok: false, text: r.reason || "Erreur lors de l'enregistrement." });
    }
  }

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
        <div className="flex items-center justify-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SACCB" className="w-12 h-12 rounded-xl bg-white/10 p-1" />
          <div className="text-left">
            <p className="font-bold tracking-[0.25em] text-sm" style={{ fontFamily: "Oswald, sans-serif" }}>SACCB</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Badminton · Sainte-Adresse</p>
          </div>
        </div>
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

      <footer className="text-center text-white/40 text-xs pb-8">
        Organisé par le SACCB — Sainte-Adresse Club Compétition Badminton ·{" "}
        <a href="mailto:contact@saccb.fr" className="hover:text-white/70 underline">contact@saccb.fr</a>
      </footer>
    </Fond>
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
