import { createClient } from "@supabase/supabase-js";

export const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const EDGE_FUNCTION_URL = `${SUPA_URL}/functions/v1/public-api`;

export const FACTURE_BUCKET = "factures";
export const ACTU_BUCKET = "actualities";

export const supabaseClient = createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "saccb-admin-session",
  },
});
