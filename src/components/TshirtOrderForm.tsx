"use client";

import { useEffect, useState } from "react";
import { Shirt, CheckCircle2, RefreshCw } from "lucide-react";
import { memberGetMyTshirtOrder, memberSubmitTshirtOrder } from "@/lib/db";
import type { TshirtOrder } from "@/lib/types";

const TAILLES = ["XS", "S", "M", "L", "XL"] as const;
type Taille = typeof TAILLES[number];

export default function TshirtOrderForm({
  email,
  code,
  membreId,
  defaultPrenom,
  defaultNom,
}: {
  email: string;
  code: string;
  membreId: string;
  defaultPrenom: string;
  defaultNom: string;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [order, setOrder] = useState<TshirtOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [taille, setTaille] = useState<Taille>("M");
  const [nomFloque, setNomFloque] = useState("");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    memberGetMyTshirtOrder(email, code, membreId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) {
        setOpen(r.open === true);
        setPrice(typeof r.price === "number" ? r.price : null);
        if (r.order) {
          setOrder(r.order);
          setTaille(r.order.taille as Taille);
          setNomFloque(r.order.nomFloque || "");
        }
      }
    });
    return () => { cancelled = true; };
  }, [email, code, membreId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    // Le serveur ignore nom/prenom du body et utilise ceux du compte membre, on les envoie quand même pour le typage
    const r = await memberSubmitTshirtOrder({
      email, code, membreId,
      nom: defaultNom,
      prenom: defaultPrenom,
      taille,
      nomFloque: nomFloque.trim() || undefined,
    });
    setSaving(false);
    if (r.ok) {
      setMsg({ ok: true, text: order ? "Commande mise à jour ✓" : "Commande enregistrée ✓" });
      setOrder({
        id: order?.id || "tmp",
        membreId,
        nom: defaultNom,
        prenom: defaultPrenom,
        taille,
        nomFloque: nomFloque.trim() || undefined,
        createdAt: order?.createdAt || new Date().toISOString(),
      });
      setEditMode(false);
    } else {
      setMsg({ ok: false, text: r.reason || "Erreur." });
    }
  }

  if (loading) return null;
  if (!open) return null;

  // Récap commande existante (mode lecture)
  if (order && !editMode) {
    return (
      <div className="mb-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shirt className="w-4 h-4 text-amber-600" />
            <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">Ma commande T-shirt</p>
          </div>
          {price !== null && (
            <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">{price}€</span>
          )}
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-3 text-sm space-y-1">
          <p><strong>Nom :</strong> {order.prenom} {order.nom}</p>
          <p><strong>Taille :</strong> <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">{order.taille}</span></p>
          {order.nomFloque && <p><strong>Floqué :</strong> &quot;{order.nomFloque}&quot;</p>}
        </div>
        <button
          onClick={() => setEditMode(true)}
          className="mt-3 w-full text-xs text-amber-700 hover:text-amber-900 font-medium border border-amber-300 rounded-lg py-1.5 hover:bg-amber-100 transition"
        >
          <RefreshCw className="w-3 h-3 inline mr-1" />
          Modifier ma commande
        </button>
      </div>
    );
  }

  // Formulaire (commande ou modification)
  return (
    <div className="mb-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shirt className="w-4 h-4 text-amber-600" />
          <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
            {order ? "Modifier ma commande" : "Commander un T-shirt SACCB"}
          </p>
        </div>
        {price !== null && (
          <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-full">{price}€</span>
        )}
      </div>

      {/* Récap nom (lecture seule, vient du compte) */}
      <div className="bg-white/70 border border-amber-200 rounded-lg p-2 mb-2 text-xs text-slate-600">
        Commande pour : <strong className="text-slate-800">{defaultPrenom} {defaultNom}</strong>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-0.5">Taille</label>
          <select
            value={taille}
            onChange={(e) => setTaille(e.target.value as Taille)}
            className="w-full text-sm border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 bg-white"
          >
            {TAILLES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-0.5">
            Nom / surnom à floquer <span className="text-slate-400 normal-case">(facultatif, max 30 car.)</span>
          </label>
          <input
            type="text"
            value={nomFloque}
            onChange={(e) => setNomFloque(e.target.value)}
            placeholder="Ex: Gabin, GB, ton surnom..."
            className="w-full text-sm border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
            maxLength={30}
          />
        </div>
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
            {msg.ok && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
            {msg.text}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          {editMode && (
            <button
              type="button"
              onClick={() => { setEditMode(false); setMsg(null); }}
              className="flex-1 text-xs border border-slate-300 text-slate-600 rounded-lg py-2 hover:bg-slate-50"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg py-2 transition shadow-sm disabled:opacity-50"
          >
            {saving ? "Envoi..." : order ? "Mettre à jour" : `Commander${price !== null ? ` (${price}€)` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}
