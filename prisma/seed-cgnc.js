/**
 * Seed script for CGNC (Plan Comptable Général Normalisé du Maroc).
 * Run: node prisma/seed-cgnc.js
 *
 * Two-pass insert: sorted by code length so parents always come first.
 * Idempotent: findFirst by (code, is_standard=true) → update if found, create otherwise.
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const prisma = new PrismaClient()

async function main() {
  const raw   = readFileSync(join(__dirname, 'data', 'cgnc.json'), 'utf-8')
  const items = JSON.parse(raw)

  console.log(`Seeding ${items.length} CGNC accounts...`)

  // Sort by code length ascending so parents always come first
  items.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code))

  const idByCode = new Map()

  for (const item of items) {
    const parent_id = item.parent_code ? (idByCode.get(item.parent_code) ?? null) : null

    const existing = await prisma.compteComptable.findFirst({
      where: { code: item.code, is_standard: true },
      select: { id: true },
    })

    let compte
    if (existing) {
      compte = await prisma.compteComptable.update({
        where: { id: existing.id },
        data:  { libelle: item.libelle, classe: item.classe, parent_id, actif: true },
        select: { id: true },
      })
    } else {
      compte = await prisma.compteComptable.create({
        data: {
          code:        item.code,
          libelle:     item.libelle,
          classe:      item.classe,
          parent_id,
          actif:       true,
          is_standard: true,
          cabinet_id:  null,
        },
        select: { id: true },
      })
    }

    idByCode.set(item.code, compte.id)
    process.stdout.write('.')
  }

  console.log(`\nDone — ${items.length} accounts seeded.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
