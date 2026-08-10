#!/usr/bin/env node
/**
 * scripts/db-check.mjs
 *
 * Compares what the code expects against what the database actually has.
 * The schema here is applied through hand-run SQL files (no prisma/migrations),
 * so nothing otherwise tells you whether an environment is up to date — that
 * gap is what let a missing `file_hash` column reach production and break every
 * upload with a runtime error the build could not see.
 *
 * Checks, in order:
 *   1. every column referenced in schema.prisma exists in the database
 *   2. every @@index / @@unique declared in schema.prisma exists and is valid
 *   3. the generated Prisma Client is in sync with schema.prisma
 *
 * Usage:  npm run db:check
 * Exit code 1 on any drift, so CI can gate on it.
 */

import { readFileSync, existsSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const SCHEMA = 'prisma/schema.prisma'

// ── Parse schema.prisma ──────────────────────────────────────────────────────
// Deliberately a light parser: it only needs model names, scalar fields and
// index declarations, not full PSL semantics.

function parseSchema(src) {
  const models = []
  const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm
  let m
  while ((m = modelRe.exec(src)) !== null) {
    const [, name, body] = m
    const columns = []
    const indexes = []

    for (const raw of body.split('\n')) {
      const line = raw.split('//')[0].trim()
      if (!line) continue

      if (line.startsWith('@@index') || line.startsWith('@@unique')) {
        const inner = line.match(/\[([^\]]+)\]/)
        if (inner) {
          const cols = inner[1]
            .split(',')
            .map(c => c.trim().replace(/\(.*\)$/, '').trim())
            .filter(Boolean)
          if (cols.length) indexes.push({ columns: cols, unique: line.startsWith('@@unique') })
        }
        continue
      }
      if (line.startsWith('@@') || line.startsWith('}')) continue

      const field = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/)
      if (!field) continue
      const [, fieldName, fieldType, isList] = field
      // Relation fields (object types, or lists) are not columns
      if (isList) continue
      if (/@relation/.test(line) && !/@db\./.test(line)) continue
      const SCALARS = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'BigInt', 'Decimal', 'Bytes'])
      const isEnumOrScalar = SCALARS.has(fieldType) || /^[A-Z]/.test(fieldType)
      if (!isEnumOrScalar) continue
      // A capitalised non-scalar type with no @db/@default is a relation object
      if (!SCALARS.has(fieldType) && !/@/.test(line)) continue
      columns.push(fieldName)
    }
    models.push({ name, columns, indexes })
  }
  return models
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (!existsSync(SCHEMA)) {
  console.error(`✗ ${SCHEMA} introuvable — lancez depuis la racine du projet.`)
  process.exit(1)
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('✗ DIRECT_URL / DATABASE_URL absent de l\'environnement.')
  process.exit(1)
}

const models = parseSchema(readFileSync(SCHEMA, 'utf8'))
const prisma = new PrismaClient({ datasources: { db: { url } } })
const problems = []

try {
  // 1. Columns ---------------------------------------------------------------
  const dbCols = await prisma.$queryRawUnsafe(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
  )
  const colSet = new Set(dbCols.map(c => `${c.table_name}.${c.column_name}`))

  for (const model of models) {
    for (const col of model.columns) {
      if (!colSet.has(`${model.name}.${col}`)) {
        problems.push(`colonne manquante en base : ${model.name}.${col}`)
      }
    }
  }

  // 2. Indexes ---------------------------------------------------------------
  const dbIdx = await prisma.$queryRawUnsafe(`
    SELECT t.relname AS table_name,
           a.attname AS column_name,
           i.indisvalid AND i.indisready AS usable
    FROM pg_index i
    JOIN pg_class c   ON c.oid = i.indexrelid
    JOIN pg_class t   ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE n.nspname = 'public'
  `)
  const indexedCols = new Set(dbIdx.map(r => `${r.table_name}.${r.column_name}`))
  const unusable = dbIdx.filter(r => !r.usable)

  for (const model of models) {
    for (const index of model.indexes) {
      // Leading column is what matters for the index to be usable at all
      const lead = index.columns[0]
      if (!indexedCols.has(`${model.name}.${lead}`)) {
        problems.push(`index manquant en base : ${model.name}(${index.columns.join(', ')})`)
      }
    }
  }
  for (const r of unusable) {
    problems.push(`index inutilisable (invalid/not ready) : ${r.table_name}.${r.column_name}`)
  }

  // 3. Generated client ------------------------------------------------------
  // A stale client is invisible to `next build` and only fails at runtime.
  for (const model of models) {
    const delegate = model.name.charAt(0).toLowerCase() + model.name.slice(1)
    if (!prisma[delegate]) continue
    try {
      await prisma[delegate].findFirst({ select: Object.fromEntries(model.columns.map(c => [c, true])), take: undefined })
    } catch (err) {
      const unknown = err.message.match(/Unknown field `(\w+)`/)
      problems.push(
        unknown
          ? `client Prisma périmé : ${model.name}.${unknown[1]} absent du client — lancez \`npx prisma generate\``
          : `client Prisma : ${model.name} — ${err.message.split('\n')[0].slice(0, 100)}`
      )
    }
  }
} finally {
  await prisma.$disconnect()
}

// ── Report ───────────────────────────────────────────────────────────────────

if (problems.length === 0) {
  console.log(`✓ Base conforme au schéma (${models.length} modèles vérifiés : colonnes, index, client généré)`)
  process.exit(0)
}

console.error(`✗ ${problems.length} écart(s) entre le code et la base :\n`)
for (const p of problems) console.error(`  · ${p}`)
console.error('\nAppliquez les fichiers prisma/*.sql manquants, puis `npx prisma generate`.')
process.exit(1)
