"use client";

import { useMemo, useState } from "react";
import { Shirt, Trash2, Download } from "lucide-react";
import type { DB } from "@/lib/types";
import { adminDeleteTshirtOrder } from "@/lib/db";

const TAILLES = ["XS", "S", "M", "L", "XL"] as const;

export default function TshirtAdmin({
  db,
  adminEmail,
  adminCode,
  onPersist,
  onRefresh,
  readOnly,
}: {
  db: DB;
  adminEmail?: string;
  adminCode?: string;
  onPersist: (db: DB) => Promise<void>;
  onRefresh?: () => Promise<void>;
  readOnly?: boolean;
}) {
  const orders = (db.tshirtOrders || []).slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const open = db.tshirtOpen === true;
  const price = typeof db.tshirtPrice === "number" ? db.tshirtPrice : null;
  const [saving, setSaving] = useState(false);
  const [priceInput, setPriceInput] = useState<string>(price !== null ? String(price) : "");
  const [savingPrice, setSavingPrice] = useState(false);

  // Totaux par taille
  const totals = useMemo(() => {
    const t: Record<string, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0 };
    orders.forEach((o) => { if (t[o.taille] !== undefined) t[o.taille]++; });
    return t;
  }, [orders]);

  const totalRecette = price !== null ? orders.length * price : null;

  async function toggleOpen() {
    if (readOnly) return;
    setSaving(true);
    await onPersist({ ...db, tshirtOpen: !open });
    setSaving(false);
  }

  async function savePrice() {
    if (readOnly) return;
    const v = priceInput.trim();
    const newPrice = v === "" ? undefined : Number(v.replace(",", "."));
    if (v !== "" && (isNaN(newPrice as number) || (newPrice as number) < 0)) {
      alert("Prix invalide.");
      return;
    }
    setSavingPrice(true);
    await onPersist({ ...db, tshirtPrice: newPrice });
    setSavingPrice(false);
  }

  async function handleDelete(orderId: string) {
    if (!adminEmail || !adminCode) return;
    if (!confirm("Supprimer cette commande t-shirt ?")) return;
    const r = await adminDeleteTshirtOrder(adminEmail, adminCode, orderId);
    if (r.ok && onRefresh) await onRefresh();
    else if (!r.ok) alert("Erreur : " + (r.reason || "Inconnue"));
  }

  function exportCSV() {
    const rows: string[][] = [["Prenom", "Nom", "Taille", "Floque", "Date"]];
    orders.forEach((o) => {
      rows.push([o.prenom, o.nom, o.taille, o.nomFloque || "", new Date(o.createdAt).toLocaleString("fr-FR")]);
    });
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tshirts_saccb_${db.y1}_${db.y2}.csv`;
    link.click();
  }

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Shirt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display text-xl tracking-wider text-slate-800">Commande T-shirts</h3>
            <p className="text-xs text-slate-500">{orders.length} commande{orders.length > 1 ? "s" : ""} reçue{orders.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <button onClick={exportCSV} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
          {!readOnly && (
            <button
              onClick={toggleOpen}
              disabled={saving}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                open
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
              }`}
            >
              {open ? "✓ Commandes ouvertes" : "✗ Commandes fermées"}
            </button>
          )}
        </div>
      </div>

      {!open && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-slate-600">
            ℹ️ La section commande t-shirt est <strong>masquée</strong> pour les adhérents. Cliquez sur le bouton ci-dessus pour l&apos;ouvrir.
          </p>
        </div>
      )}

      {/* 💰 Prix unitaire du t-shirt (optionnel) */}
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
        <label className="text-xs uppercase tracking-widest text-amber-700 font-semibold mb-2 block">
          💰 Prix unitaire (€) — facultatif
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            step="0.5"
            min="0"
            placeholder="ex: 15"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            disabled={readOnly}
            className="flex-1 text-sm border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 bg-white"
          />
          {!readOnly && (
            <button
              onClick={savePrice}
              disabled={savingPrice}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {savingPrice ? "..." : "Enregistrer"}
            </button>
          )}
          {price !== null && (
            <button
              onClick={() => { setPriceInput(""); savePrice(); }}
              disabled={savingPrice || readOnly}
              className="text-xs text-slate-500 hover:text-slate-700 px-2"
              title="Retirer le prix"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          Le prix s&apos;affiche dans la commande côté membre. Laisser vide pour ne pas afficher de prix.
          {totalRecette !== null && orders.length > 0 && (
            <> <strong className="text-amber-800">Recette estimée : {totalRecette.toFixed(2)}€</strong> ({orders.length} × {price}€)</>
          )}
        </p>
      </div>

      {/* Totaux par taille */}
      {orders.length > 0 && (
        <div className="grid grid-cols-5 gap-2 mb-4">
          {TAILLES.map((t) => (
            <div key={t} className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold">{t}</p>
              <p className="text-xl font-bold text-amber-900">{totals[t]}</p>
            </div>
          ))}
        </div>
      )}

      {/* Liste des commandes */}
      {orders.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-6">Aucune commande pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 font-mono text-sm font-bold text-amber-800">
                {o.taille}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {o.prenom} {o.nom}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {o.nomFloque ? <>Floqué : <strong>&quot;{o.nomFloque}&quot;</strong> · </> : null}
                  {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleDelete(o.id)}
                  className="text-red-400 hover:text-red-600 p-1.5 rounded shrink-0"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
