"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, User, Receipt, Trophy, Mail, MessageSquare } from "lucide-react";
import type { DB } from "@/lib/types";

type Hit = {
  type: "membre" | "facture" | "inscription" | "message" | "email";
  id: string;
  label: string;
  sub: string;
  anchor: string; // id DOM à scroller
};

export default function GlobalSearch({ db }: { db: DB }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Raccourci Cmd/Ctrl + K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    const res: Hit[] = [];

    // Adhérents
    for (const m of db.membres || []) {
      const hay = `${m.nom || ""} ${m.email || ""} ${m.tel || ""}`.toLowerCase();
      if (hay.includes(query)) {
        res.push({
          type: "membre", id: m.id,
          label: m.nom, sub: `${m.email}${m.tel ? " · " + m.tel : ""} · ${m.type}${m.ok ? " ✓ payé" : ""}`,
          anchor: "admin-membres",
        });
      }
    }
    // Factures
    for (const f of db.factures || []) {
      const hay = `${f.desc || ""} ${f.date || ""}`.toLowerCase();
      if (hay.includes(query)) {
        res.push({
          type: "facture", id: f.id,
          label: f.desc, sub: `${f.date} · ${f.montant.toFixed(2)} €`,
          anchor: "admin-comptabilite",
        });
      }
    }
    // Inscriptions tournoi
    for (const i of db.inscrits_tournoi || []) {
      const tn = (db.config_tournois || []).find((t) => t.id === i.tournoiId);
      const hay = `${i.joueurs || ""} ${tn?.name || ""}`.toLowerCase();
      if (hay.includes(query)) {
        res.push({
          type: "inscription", id: i.id,
          label: i.joueurs, sub: `Tournoi : ${tn?.name || "?"}${i.resultat ? " · " + i.resultat : ""}`,
          anchor: "admin-inscriptions",
        });
      }
    }
    // Messages contact
    for (const msg of db.contactMessages || []) {
      const hay = `${msg.name || ""} ${msg.email || ""} ${msg.message || ""}`.toLowerCase();
      if (hay.includes(query)) {
        res.push({
          type: "message", id: msg.id,
          label: `${msg.name} (${msg.email})`,
          sub: msg.message.slice(0, 80) + (msg.message.length > 80 ? "…" : ""),
          anchor: "admin-messages",
        });
      }
    }
    // Emails envoyés
    for (const e of db.emailHistory || []) {
      const hay = `${e.subject || ""} ${(e.recipientsPreview || []).join(" ")}`.toLowerCase();
      if (hay.includes(query)) {
        res.push({
          type: "email", id: e.id,
          label: e.subject, sub: `${e.date.slice(0, 10)} · ${e.recipientCount} destinataire${e.recipientCount > 1 ? "s" : ""}`,
          anchor: "admin-emailing",
        });
      }
    }

    return res.slice(0, 50);
  }, [db, q]);

  function jumpTo(h: Hit) {
    setOpen(false);
    setTimeout(() => {
      document.getElementById(h.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const icons = {
    membre: <User className="w-4 h-4 text-emerald-600" />,
    facture: <Receipt className="w-4 h-4 text-purple-600" />,
    inscription: <Trophy className="w-4 h-4 text-amber-600" />,
    message: <MessageSquare className="w-4 h-4 text-sky-600" />,
    email: <Mail className="w-4 h-4 text-indigo-600" />,
  };
  const labels = {
    membre: "Adhérent", facture: "Comptabilité", inscription: "Tournoi",
    message: "Message reçu", email: "Email envoyé",
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg border border-slate-300 transition"
        title="Recherche globale (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="hidden md:inline text-[10px] bg-white border border-slate-300 px-1 rounded">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Adhérent, email, facture, tournoi, message…"
                className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400"
              />
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="text-sm text-slate-400 italic p-6 text-center">
                  Tapez au moins 2 caractères. Cherche dans : adhérents · factures · inscriptions · messages · emails.
                </p>
              ) : hits.length === 0 ? (
                <p className="text-sm text-slate-400 italic p-6 text-center">Aucun résultat pour « {q} »</p>
              ) : (
                <ul>
                  {hits.map((h, i) => (
                    <li key={`${h.type}-${h.id}-${i}`}>
                      <button
                        onClick={() => jumpTo(h)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 flex items-start gap-3"
                      >
                        <div className="mt-0.5">{icons[h.type]}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{h.label}</p>
                          <p className="text-xs text-slate-500 truncate">{h.sub}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 shrink-0 mt-1">
                          {labels[h.type]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="text-[11px] text-slate-400 px-4 py-2 bg-slate-50 border-t border-slate-200 flex justify-between">
              <span>{hits.length > 0 ? `${hits.length} résultat${hits.length > 1 ? "s" : ""}` : ""}</span>
              <span>↵ ouvrir · Esc fermer</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
