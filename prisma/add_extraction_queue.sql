-- Migration : file d'attente d'extraction
-- À exécuter dans Supabase → SQL Editor
--
-- Les paramètres d'extraction migrent de l'appel HTTP vers le document
-- lui-même : un worker peut ainsi reprendre un document sans dépendre de
-- l'invocation qui l'a mis en file. C'est ce qui permet de traiter un lot de
-- 700 documents en plusieurs invocations au lieu d'en perdre les deux tiers
-- quand la première atteint son plafond de 90 s.
--
-- CONCURRENTLY : pas de verrou de table, mais ne peut pas s'exécuter dans une
-- transaction — lancez les instructions une par une.

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "lang"              TEXT DEFAULT 'fr';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "queued_by_user_id" UUID;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "queued_at"         TIMESTAMP(3);

-- Sert la sélection de la file : « documents en attente, du plus ancien au
-- plus récent ». Sans lui, chaque tour de répartiteur balaye toute la table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Document_statut_queued_at_idx"
  ON "Document"("statut", "queued_at");
