-- Retours structurés des bêta-testeurs.
-- Colonnes explicites plutôt qu'un bloc JSON : ces réponses servent à décider
-- d'un prix et d'un modèle de facturation, elles doivent pouvoir être comptées
-- et croisées directement.
CREATE TABLE IF NOT EXISTS "BetaFeedback" (
  "id"                 TEXT PRIMARY KEY,
  "user_id"            TEXT,
  "email"              TEXT,
  "nom_complet"        TEXT NOT NULL,
  "cabinet_nom"        TEXT,
  "portefeuille"       TEXT NOT NULL,
  "logiciel_actuel"    TEXT,
  "reception"          TEXT[] NOT NULL DEFAULT '{}',
  "heures_saisie"      INTEGER,
  "pire_experience"    TEXT,
  "nps"                INTEGER,
  "precision_ia"       INTEGER,
  "review_room"        INTEGER,
  "surprise"           TEXT,
  "bugs"               TEXT,
  "portail_client"     TEXT,
  "budget_mensuel"     TEXT,
  "modele_facturation" TEXT[] NOT NULL DEFAULT '{}',
  "pret_a_payer"       TEXT,
  "autres_cabinets"    TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BetaFeedback_createdAt_idx" ON "BetaFeedback"("createdAt");
