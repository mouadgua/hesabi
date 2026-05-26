const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const KEYS = [
  'FC-A3KM-P7RQ-X2HW', //déja utilisé
  'FC-B8NJ-V4TY-Z5CG',
  'FC-C2QX-W9MK-A7PH',
  'FC-D5RT-J3HB-N6YZ',
  'FC-E7WK-Q2XP-M8TV',
  'FC-F4HN-B8ZM-R3QJ',
  'FC-G9PY-K5VT-W7XN',
  'FC-H3ZQ-N7JR-B4MK',
  'FC-J6MX-T2PW-Y8NB',
  'FC-K8TH-Y4QN-C3RZ',
]

async function main() {
  for (const key of KEYS) {
    await prisma.betaKey.upsert({
      where: { key },
      update: {},
      create: { key },
    })
  }
  console.log('✅ 10 beta keys seeded successfully.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
