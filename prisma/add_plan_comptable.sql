-- Plan Comptable CGNC — SQL migration
-- Run this in the Supabase SQL Editor

-- 1. Enum CompteSource
CREATE TYPE "CompteSource" AS ENUM ('SUGGESTION_IA', 'VALIDATION_MANUELLE');

-- 2. CompteComptable
CREATE TABLE "CompteComptable" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id"  UUID,
  "code"        TEXT        NOT NULL,
  "libelle"     TEXT        NOT NULL,
  "classe"      INTEGER     NOT NULL,
  "parent_id"   UUID,
  "actif"       BOOLEAN     NOT NULL DEFAULT true,
  "is_standard" BOOLEAN     NOT NULL DEFAULT false,

  CONSTRAINT "CompteComptable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompteComptable_cabinet_id_fkey"
    FOREIGN KEY ("cabinet_id") REFERENCES "Cabinet"("id") ON DELETE CASCADE,
  CONSTRAINT "CompteComptable_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "CompteComptable"("id")
);

CREATE INDEX "CompteComptable_cabinet_id_idx" ON "CompteComptable"("cabinet_id");
CREATE INDEX "CompteComptable_classe_idx"     ON "CompteComptable"("classe");
CREATE INDEX "CompteComptable_code_idx"       ON "CompteComptable"("code");

-- Partial unique index: no two standard accounts share the same code
CREATE UNIQUE INDEX "CompteComptable_standard_code_unique"
  ON "CompteComptable"("code")
  WHERE "is_standard" = true;

-- 3. DocumentCompteComptable
CREATE TABLE "DocumentCompteComptable" (
  "id"               UUID             NOT NULL DEFAULT gen_random_uuid(),
  "document_id"      UUID             NOT NULL,
  "compte_id"        UUID             NOT NULL,
  "source"           "CompteSource"   NOT NULL DEFAULT 'VALIDATION_MANUELLE',
  "confidence_score" DOUBLE PRECISION,
  "assignedAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentCompteComptable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentCompteComptable_document_id_key" UNIQUE ("document_id"),
  CONSTRAINT "DocumentCompteComptable_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE CASCADE,
  CONSTRAINT "DocumentCompteComptable_compte_id_fkey"
    FOREIGN KEY ("compte_id") REFERENCES "CompteComptable"("id")
);

CREATE INDEX "DocumentCompteComptable_compte_id_idx" ON "DocumentCompteComptable"("compte_id");

-- 4. CabinetAccountPreference
CREATE TABLE "CabinetAccountPreference" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "cabinet_id"      UUID         NOT NULL,
  "document_type"   TEXT         NOT NULL,
  "fournisseur_key" TEXT         NOT NULL,
  "compte_id"       UUID         NOT NULL,
  "use_count"       INTEGER      NOT NULL DEFAULT 1,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CabinetAccountPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CabinetAccountPreference_cabinet_id_document_type_fournisseur_key_key"
    UNIQUE ("cabinet_id", "document_type", "fournisseur_key"),
  CONSTRAINT "CabinetAccountPreference_cabinet_id_fkey"
    FOREIGN KEY ("cabinet_id") REFERENCES "Cabinet"("id") ON DELETE CASCADE,
  CONSTRAINT "CabinetAccountPreference_compte_id_fkey"
    FOREIGN KEY ("compte_id") REFERENCES "CompteComptable"("id")
);

CREATE INDEX "CabinetAccountPreference_cabinet_id_idx" ON "CabinetAccountPreference"("cabinet_id");
