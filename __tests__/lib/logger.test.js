/**
 * Tests de la journalisation structurée.
 *
 * L'enjeu vérifié ici est la **corrélation** : sans elle, on ne peut pas
 * reconstituer le parcours d'un document en incident, ce qui était tout
 * l'objet du point A4.
 */

let logger, withLogContext, currentCorrelationId
let out

function capture() {
  out = { log: [], warn: [], error: [] }
  jest.spyOn(console, 'log').mockImplementation(m => out.log.push(m))
  jest.spyOn(console, 'warn').mockImplementation(m => out.warn.push(m))
  jest.spyOn(console, 'error').mockImplementation(m => out.error.push(m))
}

async function loadLogger({ prod = false } = {}) {
  jest.resetModules()
  process.env.NODE_ENV = prod ? 'production' : 'development'
  delete process.env.LOG_LEVEL
  const mod = await import('@/lib/logger')
  ;({ logger, withLogContext, currentCorrelationId } = mod)
}

afterEach(() => jest.restoreAllMocks())

describe('contexte de corrélation', () => {
  beforeEach(async () => { await loadLogger({ prod: true }); capture() })

  it('attache un identifiant de corrélation et le contexte fourni', async () => {
    await withLogContext({ documentId: 'doc-1', cabinetId: 'cab-1' }, () => {
      logger.info('test')
    })
    const entry = JSON.parse(out.log[0])
    expect(entry.documentId).toBe('doc-1')
    expect(entry.cabinetId).toBe('cab-1')
    expect(typeof entry.correlationId).toBe('string')
  })

  it('propage le contexte aux fonctions appelées, sans le passer en paramètre', async () => {
    // C'est le point clé : lib/ai.js journalise sans jamais recevoir l'id.
    async function couche2() { logger.warn('depuis une fonction imbriquée') }
    async function couche1() { await couche2() }

    await withLogContext({ documentId: 'doc-2' }, async () => { await couche1() })
    const entry = JSON.parse(out.warn[0])
    expect(entry.documentId).toBe('doc-2')
  })

  it('conserve le même identifiant sur toute la durée du traitement', async () => {
    await withLogContext({ documentId: 'doc-3' }, () => {
      logger.info('début'); logger.info('milieu'); logger.info('fin')
    })
    const ids = out.log.map(l => JSON.parse(l).correlationId)
    expect(new Set(ids).size).toBe(1)
  })

  it('donne un identifiant distinct à chaque document', async () => {
    await withLogContext({ documentId: 'a' }, () => logger.info('x'))
    await withLogContext({ documentId: 'b' }, () => logger.info('y'))
    const [a, b] = out.log.map(l => JSON.parse(l).correlationId)
    expect(a).not.toBe(b)
  })

  it('hérite de l\'identifiant parent quand les contextes sont imbriqués', async () => {
    await withLogContext({ cabinetId: 'cab-9' }, async () => {
      const parent = currentCorrelationId()
      await withLogContext({ documentId: 'doc-9' }, () => logger.info('imbriqué'))
      const entry = JSON.parse(out.log[0])
      expect(entry.correlationId).toBe(parent)
      expect(entry.cabinetId).toBe('cab-9')   // le contexte parent est conservé
      expect(entry.documentId).toBe('doc-9')
    })
  })

  it('fonctionne hors contexte, sans lever', () => {
    expect(() => logger.info('sans contexte')).not.toThrow()
    expect(currentCorrelationId()).toBeNull()
  })
})

describe('format', () => {
  it('émet une ligne JSON par événement en production', async () => {
    await loadLogger({ prod: true }); capture()
    logger.info('message', { extra: 1 })
    const entry = JSON.parse(out.log[0])
    expect(entry).toMatchObject({ level: 'info', msg: 'message', extra: 1 })
    expect(typeof entry.ts).toBe('string')
  })

  it('reste lisible en développement', async () => {
    await loadLogger({ prod: false }); capture()
    await withLogContext({ documentId: 'doc-5' }, () => logger.info('lisible'))
    // Pas du JSON : un préfixe de niveau et un identifiant court
    expect(out.log[0]).toMatch(/^\[INFO\] \[[0-9a-f]{8}\] lisible/)
  })

  it('aplatit les erreurs — un Error sérialisé en JSON donnerait {}', async () => {
    await loadLogger({ prod: true }); capture()
    logger.exception('échec', new TypeError('mauvais type'), { provider: 'x' })
    const entry = JSON.parse(out.error[0])
    expect(entry.error).toBe('mauvais type')
    expect(entry.errorType).toBe('TypeError')
    expect(entry.provider).toBe('x')
  })

  it('accepte une valeur non-Error', async () => {
    await loadLogger({ prod: true }); capture()
    logger.exception('échec', 'panne réseau')
    expect(JSON.parse(out.error[0]).error).toBe('panne réseau')
  })
})

describe('niveaux', () => {
  it('masque debug en production', async () => {
    await loadLogger({ prod: true }); capture()
    logger.debug('invisible')
    logger.info('visible')
    expect(out.log).toHaveLength(1)
    expect(JSON.parse(out.log[0]).msg).toBe('visible')
  })

  it('respecte LOG_LEVEL', async () => {
    jest.resetModules()
    process.env.NODE_ENV = 'production'
    process.env.LOG_LEVEL = 'error'
    const mod = await import('@/lib/logger')
    capture()
    mod.logger.warn('masqué')
    mod.logger.error('conservé')
    expect(out.warn).toHaveLength(0)
    expect(out.error).toHaveLength(1)
    delete process.env.LOG_LEVEL
  })

  it('dirige chaque niveau vers le bon flux', async () => {
    await loadLogger({ prod: true }); capture()
    logger.info('i'); logger.warn('w'); logger.error('e')
    expect(out.log).toHaveLength(1)
    expect(out.warn).toHaveLength(1)
    expect(out.error).toHaveLength(1)
  })
})
