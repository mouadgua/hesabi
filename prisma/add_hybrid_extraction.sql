-- Migration: Phase 2 Hybrid Extraction Pipeline
-- Run this in Supabase SQL Editor before deploying feature/hybrid-extraction-pipeline
-- https://supabase.com/dashboard → SQL Editor

-- 1. Cabinet: extraction method selector (default = gemini = no behavior change)
ALTER TABLE "Cabinet"
  ADD COLUMN IF NOT EXISTS "extraction_method" TEXT NOT NULL DEFAULT 'gemini';

-- 2. Document: track which method was actually used + estimated cost
ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "extraction_method_used" TEXT,
  ADD COLUMN IF NOT EXISTS "extraction_cost_est"    FLOAT;

-- Optional: index for cost analysis in admin dashboard
CREATE INDEX IF NOT EXISTS "Document_extraction_method_used_idx"
  ON "Document" ("extraction_method_used");
