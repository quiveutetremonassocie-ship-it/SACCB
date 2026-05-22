"use client";

import { useState } from "react";
import { X, Trash2, Pencil, Check, ChevronDown, ChevronUp, Trophy, Users, FileText, Calendar, FileDown } from "lucide-react";
import { DB, SeasonArchive, Tournoi, InscritTournoi, ReunionReport } from "@/lib/types";

export default function ArchiveEditModal({
  db,
  archiveIdx,
  onPersist,
  onClose,
}: {
  db: DB;
  archiveIdx: number;
  onPersist: (db: DB) => Promise<void>;
  onClose: () => void;
}) {
  const archive = db.archives?.[archiveIdx];
  const [tab, setTab] = useState<"tournois" | "reports">("tournois");
  const [expandedTournoiId, setExpandedTournoiId] = useState<string | null>(null);
  const [editingTournoiId, setEditingTournoiId] = useState<string | null>(null);
  const [tournoiForm, setTournoiForm] = useState<{ name: string; date: string }>({ name: "", date: "" });
  const [editingInscritId, setEditingInscritId] = useState<string | null>(null);
  const [inscritForm, setInscritForm] = useState<{ joueurs: string; resultat: string }>({ joueurs: "", resultat: "" });

  if (!archive) return null;

  // Helper : remplace l'archive dans db.archives par une version mise à jour
  async function updateArchive(updates: Partial<SeasonArchive>) {
    if (!archive) return;
    const newArchives = (db.archives ?? []).map((a, i) =>
      i === archiveIdx ? { ...a, ...updates } : a
    );
    await onPersist({ ...db, archives: newArchives });
  }

  // ─── Tournois ───
  const tournois = archive.config_tournois ?? [];
  const inscrits = archive.inscrits_tournoi ?? [];

  async function deleteTournoi(t: Tournoi) {
    const nbInscrits = inscrits.filter((i) => i.tournoiId === t.id).length;
    if (!confirm(
      `Supprimer ce tournoi de l'archive ?\n\n` +
      `🏸 ${t.name}\n` +
      `📅 ${t.date}\n` +
      `${nbInscrits} équipe${nbInscrits > 1 ? "s inscrites" : " inscrite"}\n\n` +
      `Toutes les inscriptions associées seront aussi supprimées. Irréversible.`
    )) return;
    await updateArchive({
      config_tournois: tournois.filter((x) => x.id !== t.id),
      inscrits_tournoi: inscrits.filter((i) => i.tournoiId !== t.id),
    });
    if (expandedTournoiId === t.id) setExpandedTournoiId(null);
  }

  function startEditTournoi(t: Tournoi) {
    setEditingTournoiId(t.id);
    setTournoiForm({ name: t.name, date: t.date });
  }

  async function saveTournoiEdit(t: Tournoi) {
    if (!tournoiForm.name.trim() || !tournoiForm.date.trim()) {
      alert("Nom et date requis.");
      return;
    }
    await updateArchive({
      config_tournois: tournois.map((x) =>
        x.id === t.id ? { ...x, name: tournoiForm.name.trim(), date: tournoiForm.date.trim() } : x
      ),
    });
    setEditingTournoiId(null);
  }

  // ─── Inscriptions ───
  async function deleteInscrit(insc: InscritTournoi) {
    if (!confirm(
      `Supprimer cette inscription de l'archive ?\n\n` +
      `🎾 ${insc.joueurs}${insc.resultat ? `\nRésultat : ${insc.resultat}` : ""}\n\n` +
      `Irréversible.`
    )) return;
    await updateArchive({
      inscrits_tournoi: inscrits.filter((i) => i.id !== insc.id),
    });
  }

  function startEditInscrit(insc: InscritTournoi) {
    setEditingInscritId(insc.id);
    setInscritForm({ joueurs: insc.joueurs, resultat: insc.resultat || "" });
  }

  async function saveInscritEdit(insc: InscritTournoi) {
    if (!inscritForm.joueurs.trim()) {
      alert("Le nom des joueurs est requis.");
      return;
    }
    await updateArchive({
      inscrits_tournoi: inscrits.map((i) =>
        i.id === insc.id
          ? { ...i, joueurs: inscritForm.joueurs.trim(), resultat: inscritForm.resultat.trim() || null }
          : i
      ),
    });
    setEditingInscritId(null);
  }

  // ─── Comptes-rendus ───
  const reports = archive.reunionReports ?? [];

  async function deleteReport(r: ReunionReport) {
    if (!confirm(
      `Supprimer ce compte-rendu de l'archive ?\n\n` +
      `📋 ${r.title}\n` +
      `📅 ${new Date(r.date).toLocaleDateString("fr-FR")}\n\n` +
      `Irréversible.`
    )) return;
    await updateArchive({
      reunionReports: reports.filter((x) => x.id !== r.id),
    });
  }

  return (
    <div className="fixed inset-0 z-[5500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl my-auto max-h-[90vh] overflow-hidden flex flex-col">
        {/* En-tête */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-xl tracking-wider text-slate-800 truncate">
                Modifier l&apos;archive
              </h3>
              <p className="text-xs text-slate-400">Saison {archive.y1}–{archive.y2}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 border-b border-slate-200">
          <button
            onClick={() => setTab("tournois")}
            className={`px-3 py-3 text-sm font-medium transition border-b-2 -mb-[1px] ${tab === "tournois" ? "border-blue-500 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-700"}`}
          >
            <Trophy className="w-4 h-4 inline mr-1.5" />
            Tournois ({tournois.length})
          </button>
          <button
            onClick={() => setTab("reports")}
            className={`px-3 py-3 text-sm font-medium transition border-b-2 -mb-[1px] ${tab === "reports" ? "border-blue-500 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-700"}`}
          >
            <FileText className="w-4 h-4 inline mr-1.5" />
            Compte-rendus ({reports.length})
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "tournois" && (
            <div className="space-y-3">
              {tournois.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Aucun tournoi dans cette archive.</p>
              )}
              {tournois.map((t) => {
                const tInscrits = inscrits.filter((i) => i.tournoiId === t.id);
                const isExpanded = expandedTournoiId === t.id;
                const isEditing = editingTournoiId === t.id;
                return (
                  <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                    {isEditing ? (
                      <div className="p-3 space-y-2">
                        <input
                          className="input !text-sm"
                          value={tournoiForm.name}
                          onChange={(e) => setTournoiForm({ ...tournoiForm, name: e.target.value })}
                          placeholder="Nom du tournoi"
                        />
                        <input
                          className="input !text-sm"
                          value={tournoiForm.date}
                          onChange={(e) => setTournoiForm({ ...tournoiForm, date: e.target.value })}
                          placeholder="Date (ex: 31 mai 2026)"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => saveTournoiEdit(t)} className="btn-primary !text-xs !py-1.5 flex-1">
                            <Check className="w-3.5 h-3.5" /> Enregistrer
                          </button>
                          <button onClick={() => setEditingTournoiId(null)} className="btn-ghost !text-xs !py-1.5">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 p-3">
                          <button
                            onClick={() => setExpandedTournoiId(isExpanded ? null : t.id)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left"
                          >
                            <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 text-sm truncate">{t.name}</p>
                              <p className="text-xs text-slate-400">
                                {t.date} · <Users className="w-3 h-3 inline" /> {tInscrits.length} équipe{tInscrits.length > 1 ? "s" : ""}
                              </p>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </button>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => startEditTournoi(t)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Modifier">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteTournoi(t)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Supprimer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-slate-200 bg-white">
                            {tInscrits.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-3">Aucune équipe inscrite.</p>
                            ) : (
                              <div className="divide-y divide-slate-100">
                                {tInscrits.map((insc) => {
                                  const isEditingI = editingInscritId === insc.id;
                                  return (
                                    <div key={insc.id} className="p-3">
                                      {isEditingI ? (
                                        <div className="space-y-2">
                                          <input
                                            className="input !text-sm"
                                            value={inscritForm.joueurs}
                                            onChange={(e) => setInscritForm({ ...inscritForm, joueurs: e.target.value })}
                                            placeholder="Joueur 1 / Joueur 2"
                                          />
                                          <input
                                            className="input !text-sm"
                                            value={inscritForm.resultat}
                                            onChange={(e) => setInscritForm({ ...inscritForm, resultat: e.target.value })}
                                            placeholder="Résultat (ex: 3/25)"
                                          />
                                          <div className="flex gap-2">
                                            <button onClick={() => saveInscritEdit(insc)} className="btn-primary !text-xs !py-1 flex-1">
                                              <Check className="w-3 h-3" /> OK
                                            </button>
                                            <button onClick={() => setEditingInscritId(null)} className="btn-ghost !text-xs !py-1">
                                              Annuler
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="text-sm text-slate-700 truncate">🎾 {insc.joueurs}</p>
                                            {insc.resultat && (
                                              <p className="text-xs text-amber-600 font-semibold">📊 {insc.resultat}</p>
                                            )}
                                          </div>
                                          <div className="flex gap-1 shrink-0">
                                            <button onClick={() => startEditInscrit(insc)} className="p-1 rounded hover:bg-blue-50 text-blue-600" title="Modifier">
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => deleteInscrit(insc)} className="p-1 rounded hover:bg-red-50 text-red-500" title="Supprimer">
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "reports" && (
            <div className="space-y-2">
              {reports.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Aucun compte-rendu dans cette archive.</p>
              )}
              {reports.slice().reverse().map((r) => (
                <div key={r.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{r.title}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(r.date).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {r.pdfUrl && (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                          title="Télécharger le PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => deleteReport(r)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {r.content && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-3 whitespace-pre-wrap">
                      {r.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pied : action close */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="btn-primary w-full !text-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
