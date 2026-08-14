/**
 * lib/extraction.js — Unified document extraction orchestrator
 *
 * Aiguille chaque document vers la bonne chaîne de traitement. Ce module sert le
 * tableau de bord : Azure lit le document, OpenRouter le structure. La démo
 * publique ne passe jamais par ici — elle a son propre chemin, lib/gemini.js.
 *
 *   'azure'        → Azure DI → JSON essentiel → OpenRouter texte
 *                    Voie principale. Meilleure précision, et la moins chère des
 *                    deux voies Azure : le modèle ne reçoit qu'un JSON condensé
 *                    plutôt que tout le texte de la page.
 *
 *   'hybrid_azure' → Azure DI → texte brut → OpenRouter texte
 *                    Conservée par compatibilité ; 'azure' est préférable.
 *
 *   'gemini'       → aiExtract()
 *                    Repli lorsque Azure n'est pas configuré. Ne devrait plus
 *                    servir en fonctionnement normal.
 *
 * Toutes les voies renvoient { content, provider, method_used, cost_est }.
 */

import { aiExtract, openRouterText } from '@/lib/ai'
import { analyzeLayout, extractEssential, simplifyForLLM } from '@/lib/azureOcr'
import { logger } from '@/lib/logger'

// Coûts estimés en USD.
// La structuration passe désormais par des modèles gratuits : seul Azure est
// facturé sur ce chemin, à la page. C'est ce qui rend le coût d'une extraction
// prévisible — il ne dépend plus que du nombre de pages.
const COST_AZURE_PER_PAGE = 0.0015  // 1,50 $ / 1000 pages
const COST_TEXT_PER_DOC   = 0       // chaîne OpenRouter gratuite
const COST_GEMINI_PER_DOC = 0.0001  // chemin de repli Gemini uniquement

/**
 * Une réponse n'est retenue que si elle contient bien du JSON analysable.
 *
 * L'appelant fait de toute façon cette analyse ; la faire ici aussi change ce
 * qui arrive en cas d'échec : au lieu de rejeter le document, on passe au
 * modèle suivant de la chaîne. C'est ce qui rend les modèles gratuits
 * utilisables — ils répondent parfois en prose malgré la consigne.
 */
const yieldsJson = content => {
  try {
    JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim())
    return true
  } catch {
    return false
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Extract data from a document using the configured method.
 *
 * @param {string} base64
 * @param {string} mimeType
 * @param {string} prompt               - Full extraction prompt
 * @param {object} options
 * @param {string} [options.extractionMethod='azure']
 * @param {number} [options.maxTokens=3000]
 * @param {boolean}[options.useCache=true]
 *
 * @returns {Promise<{ content, provider, method_used, cost_est }>}
 * @throws {Error} 'ALL_PROVIDERS_FAILED' (gemini path only)
 */
export async function extractDocument(base64, mimeType, prompt, {
  extractionMethod = 'azure',
  maxTokens = 3000,
  useCache = true,
} = {}) {

  // ── Azure (principal) : Azure DI → JSON essentiel → OpenRouter texte ─────────
  if (extractionMethod === 'azure') {
    logger.info('Méthode d\'extraction retenue', { methode: 'azure', etapes: 'Azure DI → extractEssential → OpenRouter texte' })

    const azureResult   = await analyzeLayout(base64, mimeType)
    const essential     = extractEssential(azureResult.analyzeResult)

    const structurePrompt =
      prompt +
      `\n\nDONNÉES EXTRAITES PAR AZURE DOCUMENT INTELLIGENCE (${essential.pageCount} page(s)) :\n` +
      '```json\n' + JSON.stringify(essential, null, 2) + '\n```\n' +
      `\nUtilise uniquement les données ci-dessus pour remplir les champs demandés. ` +
      `Ne génère pas de données fictives si un champ est absent.`

    const { content, model } = await openRouterText(structurePrompt, maxTokens, { validate: yieldsJson })

    return {
      content,
      provider:    `azure+${model}`,
      method_used: 'azure',
      cost_est:    COST_AZURE_PER_PAGE * essential.pageCount + COST_TEXT_PER_DOC,
    }
  }

  // ── Azure hybride (compatibilité) : Azure DI → texte brut → OpenRouter ───────
  if (extractionMethod === 'hybrid_azure') {
    logger.info('Méthode d\'extraction retenue', { methode: 'hybrid_azure', etapes: 'Azure DI → texte brut → OpenRouter texte' })

    const azureResult = await analyzeLayout(base64, mimeType)
    const cleanText   = simplifyForLLM(azureResult)

    const hybridPrompt =
      prompt +
      `\n\nCONTENU DU DOCUMENT (extrait par Azure OCR — ${azureResult.pages} page(s)) :\n` +
      '```\n' + cleanText + '\n```'

    const { content, model } = await openRouterText(hybridPrompt, maxTokens, { validate: yieldsJson })

    return {
      content,
      provider:    `hybrid_azure+${model}`,
      method_used: 'hybrid_azure',
      cost_est:    COST_AZURE_PER_PAGE * azureResult.pages + COST_TEXT_PER_DOC,
    }
  }

  // ── Gemini path (fallback / legacy) ──────────────────────────────────────────
  if (extractionMethod === 'gemini') {
    const result = await aiExtract(prompt, mimeType, base64, { maxTokens, useCache })
    return {
      content:     result.content,
      provider:    result.provider,
      method_used: result.provider,
      cost_est:    COST_GEMINI_PER_DOC,
    }
  }

  throw new Error(`extractDocument: méthode inconnue "${extractionMethod}"`)
}
