"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarPlus, MapPin, Clock, Plus, Pencil, Trash2, X } from "lucide-react";
import type { AgendaEvent } from "@/lib/types";
import { EvenementAgenda, lienGoogle, telechargerIcs } from "@/lib/agenda";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const COULEUR: Record<EvenementAgenda["genre"], { point: string; badge: string; nom: string }> = {
  tournoi: { point: "bg-amber-500", badge: "bg-amber-50 text-amber-800 border-amber-200", nom: "Tournoi" },
  interclub: { point: "bg-blue-500", badge: "bg-blue-50 text-blue-800 border-blue-200", nom: "Inter-clubs" },
  interne: { point: "bg-violet-500", badge: "bg-violet-50 text-violet-800 border-violet-200", nom: "Tournoi interne" },
  club: { point: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800 border-emerald-200", nom: "Vie du club" },
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const joliJour = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/**
 * 📅 Agenda du club.
 * - Public : on clique sur un jour pour voir ses événements et les ajouter à son agenda (Google ou .ics).
 * - Admin (onChange fourni) : on clique sur un jour pour y ajouter un événement ; les événements « vie du club » se modifient/suppriment.
 */
export default function Agenda({
  evenements,
  clubEvents,
  onChange,
  onAdmin,
  sansTitre,
}: {
  evenements: EvenementAgenda[];
  clubEvents?: AgendaEvent[];
  onChange?: (next: AgendaEvent[]) => void | Promise<void>;
  onAdmin?: () => void; // admin connecté sur le site : lien vers la gestion de l'agenda
  sansTitre?: boolean;
}) {
  const aujourdhui = iso(new Date());
  const [mois, setMois] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [jour, setJour] = useState<string | null>(null);
  const [form, setForm] = useState<AgendaEvent | null>(null);
  const admin = !!onChange;

  const parJour = useMemo(() => {
    const m = new Map<string, EvenementAgenda[]>();
    for (const e of evenements) m.set(e.date, [...(m.get(e.date) || []), e]);
    return m;
  }, [evenements]);

  // Grille du mois (semaines commençant le lundi)
  const cases = useMemo(() => {
    const premier = new Date(mois);
    const decalage = (premier.getDay() + 6) % 7;
    const debut = new Date(premier);
    debut.setDate(1 - decalage);
    const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
    const total = Math.ceil((decalage + nbJours) / 7) * 7;
    return Array.from({ length: total }, (_, i) => { const d = new Date(debut); d.setDate(debut.getDate() + i); return d; });
  }, [mois]);

  const aVenir = evenements.filter((e) => e.date >= aujourdhui).slice(0, 5);
  const liste = jour ? parJour.get(jour) || [] : aVenir;

  function changerMois(n: number) {
    setMois(new Date(mois.getFullYear(), mois.getMonth() + n, 1));
    setJour(null);
  }

  async function enregistrer() {
    if (!form || !onChange) return;
    if (!form.titre.trim() || !form.date) { alert("Donne au moins un titre et une date."); return; }
    const propre: AgendaEvent = {
      id: form.id, titre: form.titre.trim().slice(0, 120), date: form.date,
      ...(form.heureDebut ? { heureDebut: form.heureDebut } : {}),
      ...(form.heureFin ? { heureFin: form.heureFin } : {}),
      ...(form.lieu?.trim() ? { lieu: form.lieu.trim().slice(0, 200) } : {}),
      ...(form.description?.trim() ? { description: form.description.trim().slice(0, 1000) } : {}),
    };
    const autres = (clubEvents || []).filter((e) => e.id !== form.id);
    await onChange([...autres, propre]);
    setJour(propre.date);
    setForm(null);
  }

  async function supprimer(id: string) {
    if (!onChange) return;
    const e = (clubEvents || []).find((x) => x.id === id);
    if (!e || !confirm(`Supprimer « ${e.titre} » de l'agenda ?`)) return;
    await onChange((clubEvents || []).filter((x) => x.id !== id));
  }

  const nouveau = (date: string): AgendaEvent => ({ id: "ev-" + Date.now().toString(36), titre: "", date });

  const contenu = (
    <div className="grid lg:grid-cols-[1.15fr_1fr] gap-5 text-left">
      {/* ── Calendrier du mois ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => changerMois(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Mois précédent"><ChevronLeft className="w-5 h-5" /></button>
          <p className="font-display text-lg sm:text-xl text-[#1e3a5f] capitalize">{mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>
          <button onClick={() => changerMois(1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Mois suivant"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {JOURS.map((j) => <div key={j} className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 py-1">{j}</div>)}
          {cases.map((d) => {
            const k = iso(d);
            const evs = parJour.get(k) || [];
            const horsMois = d.getMonth() !== mois.getMonth();
            const choisi = jour === k;
            return (
              <button
                key={k}
                onClick={() => { setJour(choisi ? null : k); setForm(null); }}
                className={`relative aspect-square sm:aspect-auto sm:h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-sm transition
                  ${choisi ? "bg-[#1e3a5f] text-white shadow" : evs.length ? "bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800" : "hover:bg-slate-50 text-slate-600"}
                  ${horsMois && !choisi ? "opacity-35" : ""}
                  ${k === aujourdhui && !choisi ? "ring-2 ring-emerald-400" : ""}`}
              >
                <span>{d.getDate()}</span>
                {evs.length > 0 && (
                  <span className="flex gap-0.5">
                    {evs.slice(0, 3).map((e) => <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${choisi ? "bg-white" : COULEUR[e.genre].point}`} />)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500">
          {(Object.keys(COULEUR) as EvenementAgenda["genre"][]).map((g) => (
            <span key={g} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${COULEUR[g].point}`} />{COULEUR[g].nom}</span>
          ))}
        </div>
      </div>

      {/* ── Événements du jour choisi (ou prochains événements) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="font-semibold text-[#1e3a5f] first-letter:uppercase">{jour ? joliJour(jour) : "Prochains événements"}</p>
          {jour && <button onClick={() => { setJour(null); setForm(null); }} className="text-xs text-slate-500 hover:text-slate-800">Tout voir</button>}
        </div>

        {form ? (
          <div className="space-y-2">
            <input className="input w-full !text-sm" placeholder="Titre (ex. Soirée de Noël, AG, stage jeunes…)" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} autoFocus />
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[11px] text-slate-500">Date<input type="date" className="input w-full !text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label className="text-[11px] text-slate-500">Début<input type="time" className="input w-full !text-sm" value={form.heureDebut || ""} onChange={(e) => setForm({ ...form, heureDebut: e.target.value })} /></label>
              <label className="text-[11px] text-slate-500">Fin<input type="time" className="input w-full !text-sm" value={form.heureFin || ""} onChange={(e) => setForm({ ...form, heureFin: e.target.value })} /></label>
            </div>
            <input className="input w-full !text-sm" placeholder="Lieu (facultatif)" value={form.lieu || ""} onChange={(e) => setForm({ ...form, lieu: e.target.value })} />
            <textarea className="input w-full !text-sm" rows={3} placeholder="Détails (facultatif)" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex gap-2">
              <button onClick={enregistrer} className="btn-primary !text-sm flex-1">Enregistrer</button>
              <button onClick={() => setForm(null)} className="btn-ghost !text-sm"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[11px] text-slate-400">Laisse les heures vides pour un événement sur toute la journée.</p>
          </div>
        ) : (
          <>
            {liste.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">{jour ? "Rien de prévu ce jour-là." : "Aucun événement à venir pour l'instant."}</p>
            ) : (
              <ul className="space-y-3">
                {liste.map((e) => (
                  <li key={e.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className={`inline-block text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${COULEUR[e.genre].badge}`}>{COULEUR[e.genre].nom}</span>
                        <p className="font-semibold text-slate-800 mt-1 break-words">{e.titre}</p>
                        <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {!jour && <span className="first-letter:uppercase">{joliJour(e.date)}</span>}
                          {e.heureDebut && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{e.heureDebut.replace(":", "h")}{e.heureFin ? ` → ${e.heureFin.replace(":", "h")}` : ""}</span>}
                          {e.lieu && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{e.lieu}</span>}
                        </p>
                        {e.description && <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{e.description}</p>}
                      </div>
                      {admin && e.modifiable && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { const c = (clubEvents || []).find((x) => x.id === e.id); if (c) setForm({ ...c }); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Modifier"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => supprimer(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <a href={lienGoogle(e)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">
                        <CalendarPlus className="w-3.5 h-3.5" /> Google Agenda
                      </a>
                      <button onClick={() => telechargerIcs(e)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">
                        <CalendarPlus className="w-3.5 h-3.5" /> iPhone / Outlook
                      </button>
                    </div>
                    {admin && !e.modifiable && <p className="text-[11px] text-slate-400 mt-1.5">Ajouté automatiquement : se modifie dans la rubrique du tournoi.</p>}
                  </li>
                ))}
              </ul>
            )}
            {admin && (
              <button onClick={() => setForm(nouveau(jour || aujourdhui))} className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <Plus className="w-4 h-4" /> Ajouter un événement{jour ? " ce jour-là" : ""}
              </button>
            )}
            {!admin && onAdmin && (
              <button onClick={onAdmin} className="mt-4 text-xs text-slate-500 hover:text-[#1e3a5f] underline self-start">➕ Ajouter un événement (admin)</button>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (sansTitre) return contenu;
  return (
    <section id="agenda" className="bg-section-wrap relative">
      <div className="section-pad relative">
        <div className="text-center mb-10">
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-emerald-600">Agenda</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl h-display mb-3">Les dates du club</h2>
          <p className="text-slate-500 max-w-xl mx-auto">Tournois, rencontres et vie du club. Clique sur une date pour l&apos;ajouter à ton agenda.</p>
        </div>
        {contenu}
      </div>
    </section>
  );
}
