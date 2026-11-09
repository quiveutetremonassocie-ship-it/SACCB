"use client";

import { useEffect, useState } from "react";
import { Shirt, CheckCircle2, RefreshCw } from "lucide-react";
import { fetchPublicDB, memberGetMyTshirtOrder, memberSubmitTshirtOrder } from "@/lib/db";
import { TSHIRT_SIZES_DEFAULT, type TshirtOrder, type TshirtPhoto } from "@/lib/types";

type Taille = string;
type Sexe = "H" | "F";

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
  // Tailles proposées par l'admin, séparées H / F (renvoyées par le serveur)
  const [sizesH, setSizesH] = useState<string[]>(TSHIRT_SIZES_DEFAULT);
  const [sizesF, setSizesF] = useState<string[]>(TSHIRT_SIZES_DEFAULT);
  const [sizesAll, setSizesAll] = useState<string[]>(TSHIRT_SIZES_DEFAULT);
  // 👤 Sexe connu sur la fiche adhérent (si rempli par le bureau). Sinon null → on demande.
  const [membreSexe, setMembreSexe] = useState<Sexe | null>(null);
  // 👤 Sexe choisi par l'adhérent au moment de la commande (quand pas renseigné sur sa fiche)
  const [sexeChoisi, setSexeChoisi] = useState<Sexe | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  // 🎨 Couleurs proposées par le bureau (vide = pas de choix)
  const [colors, setColors] = useState<string[]>([]);
  const [catalogue, setCatalogue] = useState<{ url: string; name: string } | null>(null); // 📄 catalogue PDF
  const [photos, setPhotos] = useState<TshirtPhoto[]>([]); // 🖼️ photos du catalogue
  const [couleur, setCouleur] = useState("");
  const [order, setOrder] = useState<TshirtOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [taille, setTaille] = useState<Taille>("M");
  const [nomFloque, setNomFloque] = useState("");
  const [editMode, setEditMode] = useState(false);

  // 👤 Sexe effectif pour cette commande : sexe de la fiche sinon choix de l'adhérent
  const sexeEffectif: Sexe | null = membreSexe ?? sexeChoisi;
  // Tailles affichées : filtrées par sexe si connu, sinon toutes (union)
  const sizes: string[] = sexeEffectif === "H" ? sizesH : sexeEffectif === "F" ? sizesF : sizesAll;

  // 🔑 Certaines sessions (ex : admin) ne gardent pas de code en mémoire : on le
  // redemande dans le bloc au lieu de masquer la section (gardé en mémoire, jamais stocké).
  const [enteredCode, setEnteredCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const effCode = code || enteredCode;

  useEffect(() => {
    let cancelled = false;
    if (!effCode) {
      fetchPublicDB().then((d) => {
        if (cancelled) return;
        setOpen(d.tshirtOpen === true);
        setLoading(false);
      }).catch(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
    setLoading(true);
    memberGetMyTshirtOrder(email, effCode, membreId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (!r.ok && !code) {
        setEnteredCode("");
        setMsg({ ok: false, text: "Code incorrect, ou aucune fiche adhérent liée à ce compte." });
        return;
      }
      if (r.ok) {
        const data = r as unknown as {
          open?: boolean;
          price?: number;
          sizes?: string[];
          sizesH?: string[];
          sizesF?: string[];
          sizesAll?: string[];
          membreSexe?: "H" | "F" | null;
          colors?: string[];
          catalogue?: { url: string; name: string } | null;
          photos?: TshirtPhoto[];
          paymentUrl?: string;
          order?: TshirtOrder | null;
        };
        setOpen(data.open === true);
        setPrice(typeof data.price === "number" ? data.price : null);
        const legacy = Array.isArray(data.sizes) && data.sizes.length > 0 ? data.sizes : TSHIRT_SIZES_DEFAULT;
        const sH = Array.isArray(data.sizesH) && data.sizesH.length > 0 ? data.sizesH : legacy;
        const sF = Array.isArray(data.sizesF) && data.sizesF.length > 0 ? data.sizesF : legacy;
        const sAll = Array.isArray(data.sizesAll) && data.sizesAll.length > 0 ? data.sizesAll : legacy;
        setSizesH(sH);
        setSizesF(sF);
        setSizesAll(sAll);
        const mSexe = data.membreSexe === "H" || data.membreSexe === "F" ? data.membreSexe : null;
        setMembreSexe(mSexe);
        setPaymentUrl(typeof data.paymentUrl === "string" && data.paymentUrl ? data.paymentUrl : null);
        const cols = Array.isArray(data.colors) ? data.colors : [];
        setColors(cols);
        setCatalogue(data.catalogue && data.catalogue.url ? data.catalogue : null);
        setPhotos(Array.isArray(data.photos) ? data.photos : []);
        // 🎨 Si une seule couleur est proposée, on la sélectionne automatiquement
        //    (nouvelle commande ou modif) — l'adhérent n'a pas à choisir.
        if (cols.length === 1) setCouleur(cols[0]);
        // 👤 Taille initiale : liste correspondant au sexe connu, sinon union
        const listeInitiale = mSexe === "H" ? sH : mSexe === "F" ? sF : sAll;
        if (!data.order) setTaille(listeInitiale.includes("M") ? "M" : listeInitiale[0]);
        if (data.order) {
          setOrder(data.order);
          setTaille(data.order.taille as Taille);
          setNomFloque(data.order.nomFloque || "");
          setCouleur(data.order.couleur || "");
          // 👤 Si la commande a déjà un sexe (modif d'une ancienne) → on le reprend
          if (data.order.sexe === "H" || data.order.sexe === "F") setSexeChoisi(data.order.sexe);
        }
      }
    });
    return () => { cancelled = true; };
  }, [email, code, effCode, membreId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 👤 Si le sexe n'est pas connu (ni sur la fiche, ni choisi ici) → obligatoire avant de valider
    if (!sexeEffectif) { setMsg({ ok: false, text: "Indique si tu veux un t-shirt Homme ou Femme." }); return; }
    // Si la taille n'est pas dans la liste du sexe choisi → on aligne silencieusement sur "M" ou la 1re dispo
    if (!sizes.includes(taille)) {
      setMsg({ ok: false, text: "Choisis une taille parmi les propositions." });
      return;
    }
    // 🎨 Couleur effective : si une seule est proposée, on la prend d'office (évite de bloquer la modif
    //    d'une commande ancienne qui n'avait pas encore de couleur enregistrée).
    const couleurEffective = colors.length === 1 ? colors[0] : couleur;
    if (colors.length > 0 && !couleurEffective) { setMsg({ ok: false, text: "Choisis une couleur." }); return; }
    setSaving(true);
    setMsg(null);
    // Le serveur ignore nom/prenom du body et utilise ceux du compte membre, on les envoie quand même pour le typage
    const r = await memberSubmitTshirtOrder({
      email, code: effCode, membreId,
      nom: defaultNom,
      prenom: defaultPrenom,
      taille,
      // 👤 Envoie le sexe choisi uniquement s'il n'est pas déjà sur la fiche (le serveur l'ignore si fiche remplie)
      sexe: membreSexe ?? sexeChoisi ?? undefined,
      couleur: colors.length > 0 ? couleurEffective : undefined,
      nomFloque: nomFloque.trim() || undefined,
    });
    setSaving(false);
    if (r.ok) {
      setMsg({ ok: true, text: order ? "Commande mise à jour ✓" : "Commande enregistrée ✓" });
      setOrder({
        ...(order ?? {}),
        id: order?.id || "tmp",
        membreId,
        nom: defaultNom,
        prenom: defaultPrenom,
        taille,
        sexe: sexeEffectif,
        couleur: colors.length > 0 ? couleurEffective : undefined,
        nomFloque: nomFloque.trim() || undefined,
        createdAt: order?.createdAt || new Date().toISOString(),
      });
      // 🎨 Synchronise l'état local si on a complété la couleur automatiquement
      if (couleurEffective && couleurEffective !== couleur) setCouleur(couleurEffective);
      setEditMode(false);
    } else {
      setMsg({ ok: false, text: r.reason || "Erreur." });
    }
  }

  // 👤 Quand l'adhérent change de sexe (quand pas renseigné), on réaligne sa taille sur la nouvelle liste
  function changerSexe(nouveau: Sexe) {
    setSexeChoisi(nouveau);
    const nouvelleListe = nouveau === "H" ? sizesH : sizesF;
    if (!nouvelleListe.includes(taille)) {
      setTaille(nouvelleListe.includes("M") ? "M" : (nouvelleListe[0] || "M"));
    }
  }

  if (loading) return null;
  if (!open) return null;

  // Pas de code en mémoire → on le demande pour accéder à la commande
  if (!effCode) {
    return (
      <div className="mb-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shirt className="w-4 h-4 text-amber-600" />
          <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">Commande T-shirt ouverte</p>
        </div>
        <p className="text-sm text-slate-600 mb-3">Entre ton code personnel pour commander ou voir ta commande.</p>
        <form
          onSubmit={(e) => { e.preventDefault(); setMsg(null); if (codeInput.trim()) setEnteredCode(codeInput.trim()); }}
          className="flex gap-2"
        >
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Code personnel"
            className="flex-1 min-w-0 border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white"
          />
          <button type="submit" className="text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5">OK</button>
        </form>
        {msg && !msg.ok && <p className="mt-2 text-xs text-red-600">{msg.text}</p>}
      </div>
    );
  }

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
          <p>
            <strong>Taille :</strong>{" "}
            <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono">{order.taille}</span>
            {order.sexe === "H" && <span className="ml-2 text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">👕 Homme</span>}
            {order.sexe === "F" && <span className="ml-2 text-[11px] font-semibold text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded">👚 Femme</span>}
          </p>
          {order.couleur && <p><strong>Couleur :</strong> {order.couleur}</p>}
          {order.nomFloque && <p><strong>Floqué :</strong> &quot;{order.nomFloque}&quot;</p>}
        </div>
        {/* 💳 Paiement */}
        {order.paid ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            ✓ Payé — il ne te reste plus qu&apos;à venir chercher ton t-shirt !
          </p>
        ) : paymentUrl ? (
          <div className="mt-3">
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 transition"
            >
              💳 Payer mon t-shirt en ligne{price !== null ? ` (${price}€)` : ""}
            </a>
            <p className="text-[11px] text-slate-500 mt-1 text-center">
              Paiement sécurisé HelloAsso. Le bureau valide ensuite ton paiement, puis tu n&apos;as plus qu&apos;à venir chercher ton t-shirt.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-600">Paiement : à régler au magasin quand tu viendras chercher ton t-shirt.</p>
        )}
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
        {/* 👤 Sexe pour le t-shirt — demandé UNIQUEMENT si pas renseigné sur la fiche adhérent */}
        {!membreSexe && (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-0.5">
              Coupe du t-shirt <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => changerSexe("H")}
                className={`text-sm font-semibold border rounded-lg px-3 py-2 transition ${
                  sexeChoisi === "H"
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-white border-amber-300 text-slate-700 hover:border-blue-400"
                }`}
              >
                👕 Homme
              </button>
              <button
                type="button"
                onClick={() => changerSexe("F")}
                className={`text-sm font-semibold border rounded-lg px-3 py-2 transition ${
                  sexeChoisi === "F"
                    ? "bg-pink-500 border-pink-500 text-white"
                    : "bg-white border-amber-300 text-slate-700 hover:border-pink-400"
                }`}
              >
                👚 Femme
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Les tailles disponibles dépendent de la coupe choisie.</p>
          </div>
        )}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-0.5">
            Taille
            {sexeEffectif === "H" && <span className="ml-2 text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">👕 Homme</span>}
            {sexeEffectif === "F" && <span className="ml-2 text-[9px] text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded font-semibold">👚 Femme</span>}
          </label>
          <select
            value={taille}
            onChange={(e) => setTaille(e.target.value as Taille)}
            disabled={!sexeEffectif}
            className="w-full text-sm border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(sizes.includes(taille) ? sizes : [...sizes, taille]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {!sexeEffectif && <p className="text-[11px] text-slate-500 mt-1">Choisis d&apos;abord Homme ou Femme ci-dessus.</p>}
        </div>
        {catalogue && (
          <a href={catalogue.url} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-3 py-2">
            📄 Voir le catalogue (couleurs et modèles)
          </a>
        )}
        {photos.length > 0 && (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">
              🖼️ Photos du catalogue
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {photos.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border border-amber-200 rounded-lg overflow-hidden bg-white aspect-square hover:border-amber-400 transition"
                  title={p.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        )}
        {colors.length === 1 ? (
          // 🎨 Une seule couleur proposée : pas de choix, on affiche juste l'info
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-0.5">Couleur</label>
            <div className="w-full text-sm border border-amber-200 rounded-lg px-3 py-1.5 bg-amber-50 text-slate-700 font-semibold">
              {colors[0]}
            </div>
          </div>
        ) : colors.length > 1 ? (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-0.5">Couleur</label>
            <select
              value={couleur}
              onChange={(e) => setCouleur(e.target.value)}
              className="w-full text-sm border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 bg-white"
            >
              <option value="">— Choisis une couleur —</option>
              {(couleur && !colors.includes(couleur) ? [...colors, couleur] : colors).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-0.5">
            Nom / surnom à floquer <span className="text-slate-400 normal-case">(facultatif, max 12 car.)</span>
          </label>
          <input
            type="text"
            value={nomFloque}
            onChange={(e) => setNomFloque(e.target.value)}
            placeholder="Ex: Gabin, GB, ton surnom..."
            className="w-full text-sm border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
            maxLength={12}
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
