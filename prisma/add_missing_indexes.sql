-- Migration : index manquants identifiés lors de l'audit (2026-07-03)
-- À exécuter dans le SQL Editor de Supabase : https://supabase.com/dashboard

-- Client : filtrage par cabinet (toutes les routes scopées au cabinet)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Client_cabinet_id_idx" ON "Client"("cabinet_id");

-- Document : filtrage par template et par dossier
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_template_id_idx" ON "Document"("template_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_dossier_id_idx"  ON "Document"("dossier_id");

-- FieldCorrection : learning loop (recherche par user + type de document)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FieldCorrection_user_id_document_type_idx" ON "FieldCorrection"("user_id", "document_type");

-- Dossier : filtrage par client
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Dossier_client_id_idx" ON "Dossier"("client_id");

-- AdminLog : tri par date desc pour le dashboard admin
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AdminLog_createdAt_idx" ON "AdminLog"("createdAt" DESC);
