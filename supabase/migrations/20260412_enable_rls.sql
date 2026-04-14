-- ============================================
-- SÉCURISATION DE LA TABLE saccb_db
-- À exécuter dans Supabase > SQL Editor
-- ============================================

-- 1. Activer Row Level Security
ALTER TABLE saccb_db ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Authenticated users can do everything" ON saccb_db;
DROP POLICY IF EXISTS "Anon cannot access" ON saccb_db;

-- 3. Policy : seuls les utilisateurs authentifiés (admin) peuvent lire/modifier
CREATE POLICY "Authenticated users can do everything"
  ON saccb_db
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Bloquer tout accès anonyme (le frontend public passe par l'Edge Function)
-- Pas besoin de policy pour anon = tout est bloqué par défaut avec RLS activé
