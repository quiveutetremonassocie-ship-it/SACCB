-- ============================================
-- 🔒 SÉCURITÉ MAXIMALE (audit du 2026-11-07)
-- À exécuter UNE fois dans Supabase > SQL Editor
-- ============================================

-- 1. Base : plus aucun accès direct avec un compte Supabase Auth.
--    Le site passe uniquement par le serveur (Edge Function public-api, clé service_role),
--    qui applique la vérification par mail, le journal et la fusion des modifications.
DROP POLICY IF EXISTS "Authenticated users can do everything" ON public.saccb_db;

-- 2. Stockage : plus aucune liste / ajout / suppression de fichiers avec la clé publique
--    (avant : les dossiers de photos des actualités, même réservées aux adhérents, étaient listables).
--    Les photos et PDF publics restent visibles par leur lien ; le serveur garde tous ses droits.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- 3. Vérification : doit renvoyer 0 ligne
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE (schemaname = 'public' AND tablename = 'saccb_db') OR (schemaname = 'storage' AND tablename = 'objects');
