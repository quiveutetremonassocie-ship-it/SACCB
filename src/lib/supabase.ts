import { createClient } from "@supabase/supabase-js";

export const SUPA_URL = "https://jsceiujlopxgsjlxbvyu.supabase.co";
export const SUPA_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzY2VpdWpsb3B4Z3NqbHhidnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTk4NDgsImV4cCI6MjA5MDg5NTg0OH0.4cjGuVhGC1qjtrT4jtsK4vK25_C50N5og4z3KLmC8po";

export const SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbzdHqIZYTGMagGlySoqBeVeFbl1Ve2Z4EXnbQ5K_U5aoZ-HgivyqUMq0O_d0dtFxOCv/exec";

export const FACTURE_BUCKET = "factures";

export const supabaseClient = createClient(SUPA_URL, SUPA_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "saccb-admin-session",
  },
});
