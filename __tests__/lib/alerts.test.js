/**
 * Tests des alertes opérationnelles.
 *
 * Sentry est simulé : on vérifie ce qui lui est transmis (niveau, message,
 * contexte) et surtout que le regroupement évite d'envoyer une alerte par
 * document sur un lot en échec.
 */

const captureMessage = jest.fn()
const setLevel = jest.fn()
const setTag = jest.fn()
const setContext = jest.fn()

jest.mock('@sentry/nextjs', () => ({
  captureMessage: (...a) => captureMessage(...a),
  withScope: (fn) => fn({ setLevel, setTag, setContext }),
}))

let alerts

beforeEach(async () => {
  jest.clearAllMocks()
  jest.resetModules()
  global.__alertThrottle = new Map()
  alerts = await import('@/lib/alerts')
})

describe('alertCircuitOpened', () => {
  it('signale l\'ouverture du circuit avec le provider concerné', () => {
    expect(alerts.alertCircuitOpened('claude-haiku', { failures: 3, lastError: 'HTTP 503' })).toBe(true)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0][0]).toMatch(/claude-haiku/)
    expect(setLevel).toHaveBeenCalledWith('warning')
    expect(setTag).toHaveBeenCalledWith('provider', 'claude-haiku')
  })

  it('regroupe les répétitions sur un même provider', () => {
    alerts.alertCircuitOpened('gpt-4o')
    alerts.alertCircuitOpened('gpt-4o')
    alerts.alertCircuitOpened('gpt-4o')
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })

  it('alerte séparément pour deux providers distincts', () => {
    alerts.alertCircuitOpened('gpt-4o')
    alerts.alertCircuitOpened('qwen')
    expect(captureMessage).toHaveBeenCalledTimes(2)
  })
})

describe('alertAllProvidersFailed', () => {
  it('remonte en niveau error', () => {
    alerts.alertAllProvidersFailed({ documentId: 'doc-1', cabinetId: 'cab-1' })
    expect(setLevel).toHaveBeenCalledWith('error')
    expect(captureMessage.mock.calls[0][0]).toMatch(/épuisée/i)
  })

  it('n\'envoie qu\'une alerte pour un lot entier en échec', () => {
    // Le cas qui compte : 300 documents qui échouent ne doivent pas
    // produire 300 alertes.
    for (let i = 0; i < 300; i++) {
      alerts.alertAllProvidersFailed({ documentId: `doc-${i}`, cabinetId: 'cab-1' })
    }
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
})

describe('alertStuckDocumentsRecovered', () => {
  it('reste silencieux sous le seuil — le filet de sécurité fait son travail', () => {
    expect(alerts.alertStuckDocumentsRecovered(0)).toBe(false)
    expect(alerts.alertStuckDocumentsRecovered(4)).toBe(false)
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('alerte à partir du seuil', () => {
    expect(alerts.alertStuckDocumentsRecovered(5)).toBe(true)
    expect(setLevel).toHaveBeenCalledWith('warning')
  })

  it('passe en error sur un volume important', () => {
    alerts.alertStuckDocumentsRecovered(25)
    expect(setLevel).toHaveBeenCalledWith('error')
  })
})

describe('alertExtractionFailed', () => {
  it('ignore les échecs métier attendus', () => {
    // Qualité du document fournie par l'utilisateur : ce n'est pas un
    // incident de plateforme, ça ne doit pas polluer les alertes.
    expect(alerts.alertExtractionFailed({ reason: 'Document non reconnu. Vérifiez...' })).toBe(false)
    expect(alerts.alertExtractionFailed({ reason: 'Fichier illisible ou introuvable.' })).toBe(false)
    expect(alerts.alertExtractionFailed({ reason: "L'IA n'a trouvé aucune donnée pertinente." })).toBe(false)
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('remonte les échecs inattendus', () => {
    expect(alerts.alertExtractionFailed({
      documentId: 'doc-9', cabinetId: 'cab-2', reason: 'SERVICE_UNAVAILABLE',
    })).toBe(true)
    expect(captureMessage.mock.calls[0][0]).toMatch(/SERVICE_UNAVAILABLE/)
  })

  it('regroupe par motif, pas par document', () => {
    for (let i = 0; i < 50; i++) {
      alerts.alertExtractionFailed({ documentId: `d-${i}`, reason: 'SERVICE_UNAVAILABLE' })
    }
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })
})

describe('robustesse', () => {
  it('ne propage jamais une erreur de Sentry', async () => {
    jest.resetModules()
    jest.doMock('@sentry/nextjs', () => ({
      captureMessage: () => { throw new Error('Sentry indisponible') },
      withScope: (fn) => fn({ setLevel: () => {}, setTag: () => {}, setContext: () => {} }),
    }))
    global.__alertThrottle = new Map()
    const mod = await import('@/lib/alerts')
    // Une panne d'alerting ne doit pas casser le pipeline qu'elle surveille
    expect(() => mod.alertAllProvidersFailed({ documentId: 'x' })).not.toThrow()
    expect(mod.alertAllProvidersFailed({ documentId: 'y' })).toBe(false)
  })
})
