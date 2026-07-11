-- Migration : ExportTemplate model (2026-07-11)
-- À exécuter dans le SQL Editor de Supabase : https://supabase.com/dashboard

CREATE TABLE IF NOT EXISTS "ExportTemplate" (
  "id"         TEXT        NOT NULL,
  "cabinet_id" UUID        NOT NULL,
  "name"       TEXT        NOT NULL,
  "config"     JSONB       NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExportTemplate"
  ADD CONSTRAINT "ExportTemplate_cabinet_id_fkey"
  FOREIGN KEY ("cabinet_id") REFERENCES "Cabinet"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ExportTemplate_cabinet_id_idx"
  ON "ExportTemplate"("cabinet_id");
