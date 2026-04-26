"use client";

import { useState } from "react";
import { Plus, Trophy, Trash2, Bell, Pencil, Check, X, ChevronDown, ChevronUp, Archive } from "lucide-react";
import { DB, Tournoi, InscritTournoi } from "@/lib/types";
import { notifyMembres } from "@/lib/db";

export default function TournoisAdmin({
  db,
  onPersist,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  readOnly?: boolean;
}) {
  // Formulaire nouveau tournoi
  const [n, setN] = useState("");
  const [d, setD] = useState("");
  const [dateLimit, setDateLimit] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");

  // Edition en ligne (saison courante)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Tournoi>>({});

  // Edition archive
  const [archiveOpen, setArchiveOpen] = useState<string | null>(null); // "y1-y2"
  const [editingArchive, setEditingArchive] = useState<{ archiveKey: string; tournoiId: string } | null>(null);
  const [editArchiveData, setEditArchiveData] = useState<Partial<Tournoi>>({});

  // Edition résultat inscrit (dans archive)
  const [editingResultat, setEditingResultat] = useState<{ archiveKey: string; inscritId: string } | null>(null);
  const [editResultatVal, setEditResultatVal] = useState("");

  // Inscrits saison courante
  const [currentInscritOpen, setCurrentInscritOpen] = useState<string | null>(null);
  const [editingCurrentResultat, setEditingCurrentResultat] = useState<{ tournoiId: string; inscritId: string } | null>(null);
  const [editCurrentResultatVal, setEditCurrentResultatVal] = useState("");

  const [notifying, setNotifying] = useState<string | null>(null);

  async function add() {
    if (!n || !d) { alert("Nom et date requis."); return; }
    const next = {
      ...db,
      config_tournois: [
        ...(db.config_tournois || []),
        {
          id: Date.now().toString(),
          name: n,
          date: d,
          dateLimit: dateLimit || null,
          type: type || null,
          quota: q ? parseInt(q) : null,
          saison: `${db.y1}-${db.y2}`,
        },
      ],
    };
    await onPersist(next);
    setN(""); setD(""); setDateLimit(""); setType(""); setQ("");
  }

  function startEdit(t: Tournoi) {
    setEditingId(t.id);
    setEditData({ name: t.name, date: t.date, dateLimit: t.dateLimit || "", type: t.type || "", quota: t.quota ?? undefined });
  }

  async function saveEdit(id: string) {
    const next = {
      ...db,
      config_tournois: db.config_tournois.map((t) =>
        t.id === id
          ? {
              ...t,
              name: editData.name || t.name,
              date: editData.date || t.date,
              dateLimit: (editData.dateLimit as string) || null,
              type: (editData.type as string) || null,
              quota: editData.quota ? Number(editData.quota) : null,
            }
          : t
      ),
    };
    await onPersist(next);
    setEditingId(null);
    setEditData({});
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce tournoi et toutes ses inscriptions ?")) return;
    const next = {
      ...db,
      config_tournois: db.config_tournois.filter((t) => t.id !== id),
      inscrits_tournoi: db.inscrits_tournoi.filter((i) => i.tournoiId !== id),
    };
    await onPersist(next);
  }

  async function notify(id: string, name: string) {
    if (!confirm(`Envoyer un email à tous les adhérents pour le tournoi "${name}" ?`)) return;
    setNotifying(id);
    const r = await notifyMembres(id, name);
    setNotifying(null);
    if (r.ok) {
      alert(`✅ Email envoyé à ${r.sent} adhérent(s) !`);
    } else {
      alert("Erreur : " + (r.reason || "Inconnue"));
    }
  }

  // ── Fonctions archive ──

  function startEditArchive(archiveKey: string, t: Tournoi) {
    setEditingArchive({ archiveKey, tournoiId: t.id });
    setEditArchiveData({ name: t.name, date: t.date, dateLimit: t.dateLimit || "", type: t.type || "" });
  }

  async function saveEditArchive(archiveKey: string, tournoiId: string) {
    const [y1, y2] = archiveKey.split("-").map(Number);
    const newArchives = (db.archives ?? []).map((a) => {
      if (a.y1 !== y1 || a.y2 !== y2) return a;
      return {
        ...a,
        config_tournois: a.config_tournois.map((t) =>
          t.id === tournoiId
            ? {
                ...t,
                name: editArchiveData.name || t.name,
                date: editArchiveData.date || t.date,
                dateLimit: (editArchiveData.dateLimit as string) || null,
                type: (editArchiveData.type as string) || null,
              }
            : t
        ),
      };
    });
    await onPersist({ ...db, archives: newArchives });
    setEditingArchive(null);
    setEditArchiveData({});
  }

  async function delArchiveTournoi(archiveKey: string, tournoiId: string) {
    if (!confirm("Supprimer ce tournoi de l'archive ?")) return;
    const [y1, y2] = archiveKey.split("-").map(Number);
    const newArchives = (db.archives ?? []).map((a) => {
      if (a.y1 !== y1 || a.y2 !== y2) return a;
      return {
        ...a,
        config_tournois: a.config_tournois.filter((t) => t.id !== tournoiId),
        inscrits_tournoi: a.inscrits_tournoi.filter((i) => i.tournoiId !== tournoiId),
      };
    });
    await onPersist({ ...db, archives: newArchives });
  }

  async function saveCurrentResultat(tournoiId: string, inscritId: string) {
    const next = {
      ...db,
      inscrits_tournoi: db.inscrits_tournoi.map((i) =>
        i.id === inscritId && i.tournoiId === tournoiId
          ? { ...i, resultat: editCurrentResultatVal || null }
          : i
      ),
    };
    await onPersist(next);
    setEditingCurrentResultat(null);
    setEditCurrentResultatVal("");
  }

  async function saveResultat(archiveKey: string, inscritId: string) {
    const [y1, y2] = archiveKey.split("-").map(Number);
    const newArchives = (db.archives ?? []).map((a) => {
      if (a.y1 !== y1 || a.y2 !== y2) return a;
      return {
        ...a,
        inscrits_tournoi: a.inscrits_tournoi.map((i) =>
          i.id === inscritId ? { ...i, resultat: editResultatVal || null } : i
        ),
      };
    });
    await onPersist({ ...db, archives: newArchives });
    setEditingResultat(null);
    setEditResultatVal("");
  }

  async function delArchiveInscrit(archiveKey: string, inscritId: string) {
    if (!confirm("Supprimer cette inscription de l'archive ?")) return;
    const [y1, y2] = archiveKey.split("-").map(Number);
    const newArchives = (db.archives ?? []).map((a) => {
      if (a.y1 !== y1 || a.y2 !== y2) return a;
      return {
        ...a,
        inscrits_tournoi: a.inscrits_tournoi.filter((i) => i.id !== inscritId),
      };
    });
    await onPersist({ ...db, archives: newArchives });
  }

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-slate-800" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-slate-800">Liste des tournois</h3>
      </div>

      {/* ── Saison courante ── */}
      <div className="space-y-2 mb-6">
        {(db.config_tournois || []).map((t) => (
          <div key={t.id} className="bg-slate-50 rounded-xl border border-slate-200">
            {editingId === t.id ? (
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className="input !text-sm" value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} placeholder="Nom du tournoi" />
                  <input className="input !text-sm" value={editData.date || ""} onChange={(e) => setEditData({ ...editData, date: e.target.value })} placeholder="Date (ex: 25 mai 2025)" />
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Date limite</label>
                    <input className="input !text-sm" type="date" value={(editData.dateLimit as string) || ""} onChange={(e) => setEditData({ ...editData, dateLimit: e.target.value })} />
                  </div>
                  <select className="input !text-sm" value={(editData.type as string) || ""} onChange={(e) => setEditData({ ...editData, type: e.target.value })}>
                    <option value="">Type (optionnel)</option>
                    <option value="Mixte">👫 Mixte</option>
                    <option value="Hommes">👬 Hommes</option>
                    <option value="Femmes">👭 Femmes</option>
                  </select>
                  <input className="input !text-sm" type="number" value={editData.quota ?? ""} onChange={(e) => setEditData({ ...editData, quota: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="Quota max" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(t.id)} className="btn-primary !px-3 !py-1.5 !text-xs flex-1"><Check className="w-3.5 h-3.5" /> Enregistrer</button>
                  <button onClick={() => setEditingId(null)} className="btn-ghost !px-3 !py-1.5 !text-xs"><X className="w-3.5 h-3.5" /> Annuler</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
                  <div>
                    <p className="text-slate-800 font-semibold">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.date}</p>
                    {t.dateLimit && <p className="text-xs text-amber-600">Limite : {t.dateLimit}</p>}
                    {t.type && <p className="text-xs text-blue-500">{t.type}</p>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {!readOnly && <button onClick={() => startEdit(t)} className="btn-primary !px-2.5 !py-1.5 !text-xs" title="Modifier"><Pencil className="w-3.5 h-3.5" /></button>}
                    <button onClick={() => notify(t.id, t.name)} disabled={notifying === t.id} className="btn-primary !px-2.5 !py-1.5 !text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500" title="Prévenir les adhérents">
                      <Bell className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline ml-1">{notifying === t.id ? "Envoi..." : "Prévenir"}</span>
                    </button>
                    {!readOnly && <button onClick={() => del(t.id)} className="btn-danger !px-2.5 !py-1.5 !text-xs"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
                {/* Inscrits saison courante — déroulant */}
                {(() => {
                  const inscrits = (db.inscrits_tournoi || []).filter((i) => i.tournoiId === t.id);
                  if (inscrits.length === 0) return null;
                  const isOpen = currentInscritOpen === t.id;
                  return (
                    <div className="border-t border-slate-100">
                      <button
                        onClick={() => setCurrentInscritOpen(isOpen ? null : t.id)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 transition"
                      >
                        <span>🎾 {inscrits.length} binôme{inscrits.length > 1 ? "s" : ""} inscrit{inscrits.length > 1 ? "s" : ""}</span>
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-3 space-y-1">
                          {inscrits.map((inscrit) => (
                            <div key={inscrit.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs">
                              <span className="text-slate-600 truncate">🎾 {inscrit.joueurs}</span>
                              {inscrit.resultat && (
                                <span className="ml-auto font-semibold text-slate-700 shrink-0">{inscrit.resultat}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
        {(!db.config_tournois || db.config_tournois.length === 0) && (
          <p className="text-slate-400 text-sm">Aucun tournoi pour cette saison.</p>
        )}
      </div>

      {/* ── Nouveau tournoi ── */}
      {!readOnly && (
        <>
          <h4 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-widest">Nouveau tournoi</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input className="input" value={n} onChange={(e) => setN(e.target.value)} placeholder="Nom du tournoi" />
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Date du tournoi</label>
              <input className="input" value={d} onChange={(e) => setD(e.target.value)} placeholder="ex: 25 mai 2025" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Date limite d&apos;inscription</label>
              <input className="input" type="date" value={dateLimit} onChange={(e) => setDateLimit(e.target.value)} />
            </div>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Type de double (optionnel)</option>
              <option value="Mixte">👫 Double Mixte</option>
              <option value="Hommes">👬 Double Hommes</option>
              <option value="Femmes">👭 Double Femmes</option>
            </select>
            <input className="input" type="number" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Quota max doubles (vide = illimité)" />
          </div>
          <button onClick={add} className="btn-primary w-full mb-8">
            <Plus className="w-4 h-4" /> Publier
          </button>
        </>
      )}

      {/* ── Tournois archivés ── */}
      {(db.archives ?? []).filter((a) => (a.config_tournois?.length ?? 0) > 0).length > 0 && (
        <div className="border-t border-slate-200 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Archive className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Tournois archivés</h4>
          </div>
          <div className="space-y-3">
            {(db.archives ?? [])
              .filter((a) => (a.config_tournois?.length ?? 0) > 0)
              .slice().reverse()
              .map((archive) => {
                const key = `${archive.y1}-${archive.y2}`;
                const isOpen = archiveOpen === key;
                return (
                  <div key={key} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setArchiveOpen(isOpen ? null : key)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left"
                    >
                      <span className="font-semibold text-slate-700 text-sm">Saison {archive.y1}–{archive.y2}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        {archive.config_tournois.length} tournoi{archive.config_tournois.length > 1 ? "s" : ""}
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="divide-y divide-slate-100">
                        {archive.config_tournois.map((t) => {
                          const inscrits = (archive.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
                          const isEditingThis = editingArchive?.archiveKey === key && editingArchive?.tournoiId === t.id;
                          return (
                            <div key={t.id} className="p-3">
                              {isEditingThis ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input className="input !text-sm" value={editArchiveData.name || ""} onChange={(e) => setEditArchiveData({ ...editArchiveData, name: e.target.value })} placeholder="Nom" />
                                    <input className="input !text-sm" value={editArchiveData.date || ""} onChange={(e) => setEditArchiveData({ ...editArchiveData, date: e.target.value })} placeholder="Date" />
                                    <input className="input !text-sm" type="date" value={(editArchiveData.dateLimit as string) || ""} onChange={(e) => setEditArchiveData({ ...editArchiveData, dateLimit: e.target.value })} />
                                    <select className="input !text-sm" value={(editArchiveData.type as string) || ""} onChange={(e) => setEditArchiveData({ ...editArchiveData, type: e.target.value })}>
                                      <option value="">Type</option>
                                      <option value="Mixte">👫 Mixte</option>
                                      <option value="Hommes">👬 Hommes</option>
                                      <option value="Femmes">👭 Femmes</option>
                                    </select>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => saveEditArchive(key, t.id)} className="btn-primary !px-3 !py-1.5 !text-xs flex-1"><Check className="w-3.5 h-3.5" /> Enregistrer</button>
                                    <button onClick={() => setEditingArchive(null)} className="btn-ghost !px-3 !py-1.5 !text-xs"><X className="w-3.5 h-3.5" /> Annuler</button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div>
                                      <p className="font-semibold text-slate-800 text-sm">{t.name}</p>
                                      <p className="text-xs text-slate-400">{t.date}</p>
                                      {t.type && <p className="text-xs text-blue-500">{t.type}</p>}
                                    </div>
                                    {!readOnly && (
                                      <div className="flex gap-1 shrink-0">
                                        <button onClick={() => startEditArchive(key, t)} className="btn-primary !px-2 !py-1 !text-xs" title="Modifier"><Pencil className="w-3 h-3" /></button>
                                        <button onClick={() => delArchiveTournoi(key, t.id)} className="btn-danger !px-2 !py-1 !text-xs" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Résultats — déroulant */}
                                  {inscrits.length > 0 && (
                                    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                                      <button
                                        onClick={() => setCurrentInscritOpen(
                                          currentInscritOpen === `${key}-${t.id}` ? null : `${key}-${t.id}`
                                        )}
                                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition bg-white"
                                      >
                                        <span>🎾 {inscrits.length} binôme{inscrits.length > 1 ? "s" : ""}</span>
                                        {currentInscritOpen === `${key}-${t.id}` ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      </button>
                                      {currentInscritOpen === `${key}-${t.id}` && (
                                        <div className="divide-y divide-slate-100">
                                          {inscrits.map((inscrit) => {
                                            const isEditingRes = editingResultat?.archiveKey === key && editingResultat?.inscritId === inscrit.id;
                                            return (
                                              <div key={inscrit.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs bg-white">
                                                <span className="text-slate-600 truncate">🎾 {inscrit.joueurs}</span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  {isEditingRes ? (
                                                    <>
                                                      <input className="input !text-xs !py-0.5 !px-2 w-20" value={editResultatVal} onChange={(e) => setEditResultatVal(e.target.value)} placeholder="ex: 3/25" autoFocus />
                                                      <button onClick={() => saveResultat(key, inscrit.id)} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
                                                      <button onClick={() => setEditingResultat(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <span className={`font-semibold ${inscrit.resultat ? "text-slate-700" : "text-slate-300"}`}>{inscrit.resultat || "—"}</span>
                                                      <button onClick={() => { setEditingResultat({ archiveKey: key, inscritId: inscrit.id }); setEditResultatVal(inscrit.resultat || ""); }} className="text-slate-400 hover:text-slate-600" title="Modifier"><Pencil className="w-3 h-3" /></button>
                                                      {!readOnly && <button onClick={() => delArchiveInscrit(key, inscrit.id)} className="text-red-400 hover:text-red-600" title="Supprimer"><Trash2 className="w-3 h-3" /></button>}
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
