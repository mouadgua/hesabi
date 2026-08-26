/**
 * lib/extraction.js — Aiguillage de l'extraction documentaire
 *
 * ┌─ Voie recommandée ────────────────────────────────────────────────────────┐
 * │  'gemini'  → aiExtract()                                                  │
 * │              Défaut du schéma, défaut du formulaire admin, et chemin       │
 * │              retenu pour la beta. Un seul appel : c'est ce qui donne la    │
 * │              meilleure latence, et la précision suffit sur des documents   │
 * │              nets — l'immense majorité des pièces comptables reçues.       │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Les deux voies Azure ci-dessous restent disponibles mais ne sont pas la
 * direction retenue : elles enchaînent deux appels réseau séquentiels (OCR puis
 * structuration), ce qui double la latence pour un gain qui ne se manifeste que
 * sur des scans dégradés. Elles ne s'activent que si un cabinet le demande
 * nommément — voir resolveExtractionMethod() dans le worker.
 *
 * Ce module sert le tableau de bord. La démo publique ne passe jamais par ici :
 * elle a son propre chemin, lib/gemini.js.
 *
 * Toutes les voies renvoient { content, provider, method_used, cost_est,
 * tokens_in, tokens_out }.
 */

import { aiExtract, openRouterText } from '@/lib/ai'
import { analyzeLayout, extractEssential, simplifyForLLM } from '@/lib/azureOcr'
import { logger } from '@/lib/logger'

// Coûts estimés en USD.
const COST_GEMINI_PER_DOC = 0.0001  // voie recommandée
const COST_AZURE_PER_PAGE = 0.0015  // 1,50 $ / 1000 pages — voies Azure uniquement
const COST_TEXT_PER_DOC   = 0       // structuration OpenRouter gratuite

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

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Extrait les données d'un document selon la méthode configurée.
 *
 * @param {string} base64
 * @param {string} mimeType
 * @param {string} prompt                    - Prompt d'extraction complet
 * @param {object} options
 * @param {string} [options.extractionMethod='gemini']
 * @param {number} [options.maxTokens=3000]
 * @param {boolean}[options.useCache=true]
 *
 * @returns {Promise<{ content, provider, method_used, cost_est }>}
 * @throws {Error} 'ALL_PROVIDERS_FAILED' si toute une chaîne est épuisée
 */
export async function extractDocument(base64, mimeType, prompt, {
  extractionMethod = 'gemini',
  maxTokens = 3000,
  useCache = true,
} = {}) {

  // ══ VOIE RECOMMANDÉE ════════════════════════════════════════════════════════
  // Appel direct, sans étape d'OCR préalable.
  if (extractionMethod === 'gemini') {
    const result = await aiExtract(prompt, mimeType, base64, { maxTokens, useCache })
    return {
      content:     result.content,
      provider:    result.provider,
      method_used: result.provider,
      cost_est:    COST_GEMINI_PER_DOC,
      tokens_in:   result.tokensIn  ?? null,
      tokens_out:  result.tokensOut ?? null,
    }
  }

  // ══ VOIES AZURE — disponibles, non prioritaires ═════════════════════════════
  //
  // À n'activer que sur besoin démontré : un cabinet dont les scans passent mal
  // en lecture directe. Les deux voies coûtent un appel réseau supplémentaire et
  // une facturation Azure à la page. En dehors de ce cas, elles sont plus lentes
  // et plus chères sans être plus justes.
  //
  // Différence entre les deux : 'azure' transmet un JSON condensé (paires
  // clé-valeur, tableaux, paragraphes), 'hybrid_azure' transmet le texte brut.
  // La première est préférable — moins de jetons, structure préservée.

  if (extractionMethod === 'azure') {
    logger.info('Méthode d\'extraction retenue', { methode: 'azure', etapes: 'Azure DI → extractEssential → OpenRouter texte' })

    const azureResult = await analyzeLayout(base64, mimeType)
    const essential   = extractEssential(azureResult.analyzeResult)

    const structurePrompt =
      prompt +
      `\n\nDONNÉES EXTRAITES PAR AZURE DOCUMENT INTELLIGENCE (${essential.pageCount} page(s)) :\n` +
      '```json\n' + JSON.stringify(essential, null, 2) + '\n```\n' +
      `\nUtilise uniquement les données ci-dessus pour remplir les champs demandés. ` +
      `Ne génère pas de données fictives si un champ est absent.`

    const { content, model, tokensIn, tokensOut } = await openRouterText(structurePrompt, maxTokens, { validate: yieldsJson })

    return {
      content,
      provider:    `azure+${model}`,
      method_used: 'azure',
      cost_est:    COST_AZURE_PER_PAGE * essential.pageCount + COST_TEXT_PER_DOC,
      tokens_in:   tokensIn  ?? null,
      tokens_out:  tokensOut ?? null,
    }
  }

  if (extractionMethod === 'hybrid_azure') {
    logger.info('Méthode d\'extraction retenue', { methode: 'hybrid_azure', etapes: 'Azure DI → texte brut → OpenRouter texte' })

    const azureResult = await analyzeLayout(base64, mimeType)
    const cleanText   = simplifyForLLM(azureResult)

    const hybridPrompt =
      prompt +
      `\n\nCONTENU DU DOCUMENT (extrait par Azure OCR — ${azureResult.pages} page(s)) :\n` +
      '```\n' + cleanText + '\n```'

    const { content, model, tokensIn, tokensOut } = await openRouterText(hybridPrompt, maxTokens, { validate: yieldsJson })

    return {
      content,
      provider:    `hybrid_azure+${model}`,
      method_used: 'hybrid_azure',
      cost_est:    COST_AZURE_PER_PAGE * azureResult.pages + COST_TEXT_PER_DOC,
      tokens_in:   tokensIn  ?? null,
      tokens_out:  tokensOut ?? null,
    }
  }

  throw new Error(`extractDocument: méthode inconnue "${extractionMethod}"`)
}
