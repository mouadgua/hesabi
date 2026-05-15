import prisma from '@/lib/prisma'

function defaultPromptForType(type) {
  switch (type) {
    case 'facture':
      return `Format attendu (JSON plat) : {"fournisseur":null,"date_facture":null,"numero_facture":null,"montant_ht":null,"montant_tva":null,"taux_tva":null,"montant_ttc":null,"ice":null,"categorie":null}`
    case 'releve_bancaire':
      return `Format attendu (JSON) : {"banque":null,"titulaire":null,"iban":null,"periode":null,"solde_ouverture":null,"solde_cloture":null,"lignes":[{"date":null,"libelle":null,"debit":null,"credit":null}]}`
    case 'bon_commande':
      return `Format attendu (JSON plat) : {"fournisseur":null,"numero_bc":null,"date":null,"total_ht":null,"total_ttc":null,"articles":[{"designation":null,"quantite":null,"prix_unitaire":null}]}`
    case 'recu':
      return `Format attendu (JSON plat) : {"emetteur":null,"date":null,"montant":null,"mode_paiement":null,"reference":null}`
    default:
      return `Extrait toutes les informations clés du document. Renvoie UNIQUEMENT un objet JSON plat en snake_case. Adapte-toi au contenu.`
  }
}

/**
 * Builds an enriched Gemini extraction prompt by injecting user preferences
 * (preferred fields, excluded fields, field aliases) when available.
 *
 * @param {string|null} templateId - Template ID or 'NO_MODEL'/'DEFAULT_FACTURE'
 * @param {{ type: string, confidence: number }} classification - Classification result
 * @param {string|null} userId - Supabase user ID (null = no personalization)
 * @returns {Promise<{ prompt: string, personalized: boolean }>}
 */
export async function buildExtractionPrompt(templateId, classification, userId = null) {
  let basePrompt

  if (templateId === 'DEFAULT_FACTURE') {
    basePrompt = defaultPromptForType('facture')
  } else if (templateId && templateId !== 'NO_MODEL') {
    const tmpl = await prisma.templateExtraction.findUnique({ where: { id: templateId } })
    if (tmpl) {
      basePrompt = `Formate STRICTEMENT ta réponse selon ce modèle JSON : ${JSON.stringify(tmpl.structure_json)}`
    } else {
      basePrompt = defaultPromptForType(classification.type)
    }
  } else {
    basePrompt = defaultPromptForType(classification.type)
  }

  // No personalization if no userId
  if (!userId) return { prompt: basePrompt, personalized: false }

  const prefs = await prisma.userFieldPreference.findUnique({
    where: { user_id_document_type: { user_id: userId, document_type: classification.type } },
  })

  if (!prefs) return { prompt: basePrompt, personalized: false }

  const parts = [basePrompt]
  const preferred = Array.isArray(prefs.preferred_fields) ? prefs.preferred_fields : []
  const excluded = Array.isArray(prefs.excluded_fields) ? prefs.excluded_fields : []
  const aliases = prefs.field_aliases && typeof prefs.field_aliases === 'object' ? prefs.field_aliases : {}

  if (preferred.length > 0) {
    parts.push(`Assure-toi d'extraire IMPÉRATIVEMENT ces champs (même s'ils semblent peu importants) : ${preferred.join(', ')}.`)
  }
  if (excluded.length > 0) {
    parts.push(`N'inclus PAS ces champs dans ta réponse : ${excluded.join(', ')}.`)
  }
  if (Object.keys(aliases).length > 0) {
    const aliasStr = Object.entries(aliases).map(([k, v]) => `"${k}" → "${v}"`).join(', ')
    parts.push(`Utilise ces noms de clés personnalisés : ${aliasStr}.`)
  }

  return { prompt: parts.join('\n'), personalized: true }
}
