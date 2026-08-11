/**
 * Garde-fou d'isolation multi-tenant.
 *
 * Ce test ne vérifie pas quelques cas choisis : il **balaye tout le code
 * serveur** et exige que chaque requête Prisma touchant une donnée appartenant
 * à un cabinet soit explicitement scopée.
 *
 * Raison d'être : trois IDOR réels (S1, S2, S3) vivaient en production —
 * modification et suppression des modèles d'un autre cabinet, écriture dans un
 * cabinet arbitraire, débit des crédits d'autrui. Aucun test ne pouvait les
 * détecter. Une revue humaine ne tient pas sur 80 sites d'appel qui évoluent ;
 * une vérification automatique, si.
 *
 * Une exception légitime s'ajoute à ALLOWLIST **avec sa justification**. Le
 * coût d'une exception est alors de l'écrire noir sur blanc, pas de la glisser
 * silencieusement.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

// Modèles dont les lignes appartiennent à un cabinet donné.
const TENANT_MODELS = [
  'document', 'client', 'dossier', 'templateExtraction',
  'compteComptable', 'exportTemplate', 'documentCompteComptable',
  'cabinetAccountPreference',
]

// Opérations capables de lire ou d'écrire des données d'autrui.
const RISKY_OPS = [
  'findFirst', 'findMany', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow',
  'update', 'updateMany', 'delete', 'deleteMany', 'upsert', 'count', 'aggregate', 'groupBy',
]

/**
 * Exceptions assumées. Chaque entrée doit dire *pourquoi* l'absence de scope
 * cabinet est correcte à cet endroit.
 */
const ALLOWLIST = [
  {
    file: 'app/api/cron/recovery/route.js',
    reason: "Tâche système : balaye les documents bloqués de tous les cabinets. Protégée par WORKER_SECRET, jamais atteignable par un utilisateur.",
  },
  {
    // Préfixe : toute la console d'administration
    file: 'app/admin/',
    reason: "Console d'administration : consulte et agit volontairement au-delà d'un cabinet (statistiques globales, gestion des comptes). Double protection — proxy.js bloque la route et requireAdmin() revérifie côté serveur, avec journalisation via logAdminAction().",
  },
  {
    file: 'app/api/admin/',
    reason: "Routes d'administration : même périmètre global assumé que la console, chaque route appelant requireAdmin() en défense en profondeur.",
  },
  {
    file: 'app/api/demo-extraction/route.js',
    reason: "Démo publique : n'écrit que dans DemoAttempt, aucune donnée de cabinet.",
  },
  {
    file: 'app/dashboard/settings/plan-comptable/actions.js',
    reason: "Le plan CGNC standard (cabinet_id null, is_standard true) est partagé par tous les cabinets ; sa lecture n'est pas scopée par nature. Les écritures, elles, le sont.",
  },
]

// ── Collecte des fichiers serveur ────────────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(js|jsx)$/.test(entry)) out.push(full)
  }
  return out
}

/** Extrait l'objet d'arguments d'un appel, en équilibrant les accolades. */
function extractArgs(src, openParenIdx) {
  let depth = 0
  for (let i = openParenIdx; i < src.length; i++) {
    const c = src[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return src.slice(openParenIdx + 1, i)
    }
  }
  return ''
}

/**
 * Le pattern sûr et courant est « vérifier puis agir » : une première requête
 * scopée confirme que la ligne appartient bien au cabinet de l'appelant, puis
 * les opérations suivantes se font par id.
 *
 *   const doc = await prisma.document.findFirst({
 *     where: { id, client: { cabinet_id } },      // ← vérification
 *   })
 *   if (!doc) throw ...
 *   await prisma.document.update({ where: { id }, ... })   // ← sûr
 *
 * L'analyse se fait donc à l'échelle de la **fonction** : une fonction qui
 * touche des données de cabinet doit établir le périmètre quelque part. Les
 * trois IDOR réels (S1, S2, S3) n'avaient aucune vérification de ce type dans
 * la fonction entière — ils seraient tous détectés ici.
 */
function establishesScope(body) {
  return (
    // Périmètre issu de la session, jamais du client
    /utilisateur\??\.cabinet_id/.test(body) ||
    /select\s*:\s*\{\s*cabinet_id\s*:\s*true\s*\}/.test(body) ||
    // Filtrage explicite dans un where
    /client\s*:\s*\{[^}]*cabinet_id/s.test(body) ||
    /where\s*:\s*\{[^{}]*cabinet_id/s.test(body) ||
    /cabinet_id\s*:\s*cabinetId/.test(body) ||
    // Plan CGNC partagé : non scopé par nature
    /is_standard\s*:\s*true/.test(body)
  )
}

/** Découpe un fichier en fonctions de premier niveau (nom + corps). */
function splitFunctions(src) {
  const out = []
  const re = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g
  let m
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length - 1
    let depth = 0
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) {
          out.push({ name: m[1], body: src.slice(start, i + 1), offset: m.index })
          break
        }
      }
    }
  }
  return out
}

function collectViolations() {
  const files = walk(join(ROOT, 'app'))
  const violations = []
  const checked = []

  const riskyRe = new RegExp(
    `prisma\\.(${TENANT_MODELS.join('|')})\\.(${RISKY_OPS.join('|')})\\s*\\(`,
    'g'
  )

  for (const file of files) {
    const rel = relative(ROOT, file)
    const src = readFileSync(file, 'utf8')

    // Les composants client n'ont pas accès à Prisma
    if (/^['"]use client['"]/.test(src.trimStart())) continue
    if (!riskyRe.test(src)) { riskyRe.lastIndex = 0; continue }
    riskyRe.lastIndex = 0

    // Correspondance exacte, ou par préfixe pour les entrées de répertoire
    const allow = ALLOWLIST.find(a => a.file.endsWith('/') ? rel.startsWith(a.file) : rel === a.file)
    const fns = splitFunctions(src)

    let m
    while ((m = riskyRe.exec(src)) !== null) {
      const [, model, op] = m
      const line = src.slice(0, m.index).split('\n').length
      checked.push({ rel, model, op, line })
      if (allow) continue

      // Portée d'analyse : la fonction englobante, sinon le fichier entier
      // (composants serveur qui interrogent Prisma au niveau du module).
      const fn = fns.find(f => m.index > f.offset && m.index < f.offset + f.body.length)
      const scopeBody = fn ? fn.body : src

      if (!establishesScope(scopeBody)) {
        const parenIdx = m.index + m[0].length - 1
        violations.push({
          file: rel,
          line,
          fn:   fn?.name ?? '(module)',
          call: `prisma.${model}.${op}`,
          args: extractArgs(src, parenIdx).replace(/\s+/g, ' ').slice(0, 100),
        })
      }
    }
  }
  return { violations, checked }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Isolation multi-tenant', () => {
  const { violations, checked } = collectViolations()

  it('inspecte réellement un volume significatif de requêtes', () => {
    // Garde-fou du garde-fou : si une refonte casse la détection, ce test
    // tombe au lieu de laisser croire que tout va bien.
    expect(checked.length).toBeGreaterThan(30)
  })

  it('scope toute requête Prisma touchant une donnée de cabinet', () => {
    if (violations.length > 0) {
      const detail = violations
        .map(v => `\n  ✗ ${v.file}:${v.line} — ${v.fn}() → ${v.call}(${v.args})`)
        .join('')
      throw new Error(
        `${violations.length} requête(s) non scopée(s) par cabinet_id :${detail}\n\n` +
        `Ajoutez le filtre cabinet_id, ou une entrée justifiée dans ALLOWLIST ` +
        `(${relative(ROOT, __filename)}).`
      )
    }
    expect(violations).toHaveLength(0)
  })

  it('ne conserve que des exceptions justifiées', () => {
    for (const entry of ALLOWLIST) {
      expect(entry.reason?.length ?? 0).toBeGreaterThan(40)
    }
  })
})

describe('Régressions IDOR déjà corrigées', () => {
  const read = f => readFileSync(join(ROOT, f), 'utf8')

  it('S1 — les modèles ne sont plus modifiés ni supprimés par id seul', () => {
    const src = read('app/dashboard/actions.js')
    // update/delete par id nu permettaient d'agir sur le modèle d'un autre cabinet
    expect(src).not.toMatch(/templateExtraction\.update\s*\(/)
    expect(src).not.toMatch(/templateExtraction\.delete\s*\(/)
    expect(src).toMatch(/templateExtraction\.updateMany/)
    expect(src).toMatch(/templateExtraction\.deleteMany/)
  })

  it('S2 — cabinet_id n\'est jamais lu depuis un formulaire', () => {
    const src = read('app/dashboard/actions.js')
    expect(src).not.toMatch(/formData\.get\(['"]cabinet_id['"]\)/)
  })

  it('S3 — l\'action d\'upload vulnérable reste supprimée', () => {
    const src = read('app/dashboard/actions.js')
    expect(src).not.toMatch(/export\s+async\s+function\s+uploadToDriveAction/)
  })

  it('S9 — le document_id du feedback est vérifié avant stockage', () => {
    const src = read('app/api/feedback/missing-field/route.js')
    expect(src).toMatch(/cabinet_id/)
  })
})
