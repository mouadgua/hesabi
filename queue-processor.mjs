/**
 * queue-processor.mjs
 *
 * Traite un lot de documents (potentiellement de plusieurs cabinets à la fois)
 * en respectant les limites de débit d'Azure (15 TPS par défaut sur S0) et de
 * Gemini, tout en garantissant qu'un gros batch d'un cabinet ne bloque pas
 * les petits batches des autres.
 *
 * Ce fichier est une démo autonome. En production, cette même logique de
 * concurrence + ordonnancement équitable + retry doit vivre dans ton worker
 * Trigger.dev/BullMQ — les principes ne changent pas, seul le moteur d'exécution change.
 */

// ---------- 1. Limiteur de concurrence (sans dépendance externe) ----------

function createLimiter(maxConcurrent) {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= maxConcurrent || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

// ---------- 2. Ordonnancement équitable entre cabinets (round-robin) ----------
// Sans ça, un cabinet qui upload 500 fichiers fait attendre un cabinet
// qui vient d'en uploader 3 derrière toute la pile — mauvaise expérience
// pour le petit utilisateur, qui n'a pourtant rien demandé de gros.

function roundRobinByTenant(jobs) {
  const byTenant = new Map();
  for (const job of jobs) {
    if (!byTenant.has(job.cabinetId)) byTenant.set(job.cabinetId, []);
    byTenant.get(job.cabinetId).push(job);
  }
  const queues = [...byTenant.values()];
  const ordered = [];
  let i = 0;
  while (queues.some((q) => q.length > 0)) {
    const q = queues[i % queues.length];
    if (q.length > 0) ordered.push(q.shift());
    i++;
  }
  return ordered;
}

// ---------- 3. Retry avec backoff exponentiel — uniquement sur erreurs transitoires ----------

async function withRetry(fn, { maxAttempts = 4, baseDelayMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRateLimited = err.status === 429 || /429/.test(err.message || "");
      const isTransient = isRateLimited || err.status >= 500;
      if (!isTransient || attempt === maxAttempts) throw err;

      // Backoff exponentiel + jitter — évite que tous les jobs retentent au même instant
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 500;
      console.log(`  ⏳ Rate limit/erreur transitoire, retry dans ${(delay / 1000).toFixed(1)}s (tentative ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ---------- 4. Le processeur principal ----------

/**
 * @param {Array<{cabinetId: string, documentId: string, process: () => Promise<any>}>} jobs
 * @param {object} options
 * @param {number} options.concurrency - Appels simultanés max. Reste SOUS la limite
 *   réelle du provider le plus restrictif (Azure S0 = 15 TPS par défaut, mais
 *   chaque analyse déclenche aussi des appels GET de polling qui comptent à part —
 *   d'où une marge de sécurité : ne pas viser 15, viser 8-10).
 * @param {(progress: {done: number, total: number, failed: number}) => void} options.onProgress
 */
async function processQueue(jobs, { concurrency = 8, onProgress } = {}) {
  const ordered = roundRobinByTenant(jobs);
  const limit = createLimiter(concurrency);

  let done = 0;
  let failed = 0;
  const total = ordered.length;
  const results = [];

  await Promise.all(
    ordered.map((job) =>
      limit(async () => {
        try {
          const result = await withRetry(job.process);
          results.push({ ...job, ok: true, result });
        } catch (err) {
          results.push({ ...job, ok: false, error: err.message });
          failed++;
        } finally {
          done++;
          onProgress?.({ done, total, failed });
        }
      })
    )
  );

  return results;
}

export { processQueue, createLimiter, roundRobinByTenant, withRetry };
