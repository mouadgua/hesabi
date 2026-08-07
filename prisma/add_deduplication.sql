-- Migration : déduplication des uploads par hash de contenu
-- À exécuter dans Supabase → SQL Editor

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "file_hash" TEXT;
CREATE INDEX IF NOT EXISTS "Document_file_hash_idx" ON "Document" ("file_hash");
