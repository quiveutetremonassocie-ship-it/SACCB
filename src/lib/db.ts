import { supabaseClient, SUPA_URL, SUPA_KEY, SHEETS_WEBHOOK } from "./supabase";
import { DB } from "./types";

export const emptyDB = (): DB => ({
  membres: [],
  factures: [],
  inscrits_tournoi: [],
  config_tournois: [],
  actualites: [],
  y1: 2024,
  y2: 2025,
  insc_open: true,
});

export async function fetchPublicDB(): Promise<Partial<DB> & { membresCount: number }> {
  const res = await fetch(`${SUPA_URL}/rest/v1/saccb_db?select=data&id=eq.1`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  const json = await res.json();
  const d = json[0]?.data ?? {};
  return {
    insc_open: d.insc_open ?? true,
    y1: d.y1 ?? 2024,
    y2: d.y2 ?? 2025,
    config_tournois: d.config_tournois ?? [],
    inscrits_tournoi: d.inscrits_tournoi ?? [],
    actualites: d.actualites ?? [],
    membresCount: (d.membres || []).length,
  };
}

export async function fetchAdminDB(): Promise<DB | null> {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;
  const res = await fetch(`${SUPA_URL}/rest/v1/saccb_db?select=data&id=eq.1`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json();
  const d = json[0]?.data;
  if (!d) return null;
  return {
    ...emptyDB(),
    ...d,
    factures: d.factures ?? [],
    actualites: d.actualites ?? [],
    insc_open: d.insc_open ?? true,
  };
}

export async function saveDB(db: DB): Promise<void> {
  const { error } = await supabaseClient.from("saccb_db").update({ data: db }).eq("id", 1);
  fetch(SHEETS_WEBHOOK, { method: "POST", mode: "no-cors", body: JSON.stringify(db) }).catch(() => {});
  if (error) {
    await supabaseClient.from("saccb_db").insert([{ id: 1, data: db }]);
  }
}

export async function publicAddMembre(newMembre: {
  id: string;
  nom: string;
  email: string;
  tel: string;
  type: "Adulte" | "Etudiant";
  ok: boolean;
  paymentMethod?: "online" | "virement";
}): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(`${SUPA_URL}/rest/v1/saccb_db?select=data&id=eq.1`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  const json = await res.json();
  const currentData = json[0]?.data ?? emptyDB();
  if (currentData.membres?.find((m: any) => m.email === newMembre.email)) {
    return { ok: false, reason: "Cet email est déjà inscrit !" };
  }
  currentData.membres = currentData.membres || [];
  currentData.membres.push(newMembre);
  await fetch(`${SUPA_URL}/rest/v1/saccb_db?id=eq.1`, {
    method: "PATCH",
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: currentData }),
  });
  fetch(SHEETS_WEBHOOK, { method: "POST", mode: "no-cors", body: JSON.stringify(currentData) }).catch(() => {});
  return { ok: true };
}

export async function publicMarkPaid(membreId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${SUPA_URL}/rest/v1/saccb_db?select=data&id=eq.1`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  const json = await res.json();
  const currentData = json[0]?.data ?? emptyDB();
  let found = false;
  currentData.membres = (currentData.membres || []).map((m: any) => {
    if (m.id === membreId) {
      found = true;
      return { ...m, ok: true, paymentDate: new Date().toISOString() };
    }
    return m;
  });
  if (!found) return { ok: false };
  await fetch(`${SUPA_URL}/rest/v1/saccb_db?id=eq.1`, {
    method: "PATCH",
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: currentData }),
  });
  fetch(SHEETS_WEBHOOK, { method: "POST", mode: "no-cors", body: JSON.stringify(currentData) }).catch(() => {});
  return { ok: true };
}
