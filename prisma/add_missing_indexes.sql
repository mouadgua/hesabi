-- Index de performance — appliqué en production le 2026-08-10
-- À exécuter dans Supabase → SQL Editor
--
-- CONCURRENTLY évite le verrou exclusif sur la table : les écritures continuent
-- pendant la construction. En contrepartie, ces instructions ne peuvent pas être
-- exécutées dans une transaction — lancez-les une par une, pas dans un BEGIN.
--
-- Vérification après coup : `npm run db:check`

-- ── Clés étrangères / colonnes de jointure ──────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Client_cabinet_id_idx"
  ON "Client"("cabinet_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_template_id_idx"
  ON "Document"("template_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_dossier_id_idx"
  ON "Document"("dossier_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Dossier_client_id_idx"
  ON "Dossier"("client_id");

-- ── Index composites (déclarés en @@index dans schema.prisma) ───────────────
-- Document(client_id, statut) sert la requête principale du dashboard :
-- « documents d'un cabinet dans un statut donné ».
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_client_id_statut_idx"
  ON "Document"("client_id", "statut");

-- Sert le cron de recovery : documents bloqués en EN_COURS_IA depuis +10 min.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_statut_updatedAt_idx"
  ON "Document"("statut", "updatedAt");

-- Learning loop : comptage des corrections identiques par utilisateur/type.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FieldCorrection_user_id_document_type_idx"
  ON "FieldCorrection"("user_id", "document_type");

-- Audit admin, consulté par ordre antéchronologique.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AdminLog_createdAt_idx"
  ON "AdminLog"("createdAt" DESC);
