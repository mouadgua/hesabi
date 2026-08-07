-- Migration : classification précoce à l'upload
-- À exécuter dans Supabase → SQL Editor

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "document_language_detected" TEXT;
