"use server";

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aiExtract } from '@/lib/ai'

// ============================================================================
// 1. UPLOAD DE DOCUMENTS (AVEC DÉDUCTION DE CRÉDITS)
// ============================================================================
export async function uploadToDriveAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const clientId = formData.get('client_id')
    const dossierId = formData.get('dossier_id')
    const files = formData.getAll('file')

    if (!files || files.length === 0) return

    // 1. Vérifier que le client existe et récupérer le cabinet_id
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { cabinet_id: true }
    })

    if (!client) throw new Error("Client introuvable")

    // 2. Déduction atomique des crédits — check + decrement en une seule requête
    // Empêche la race condition (2 onglets simultanés consommant plus que le quota)
    const creditResult = await prisma.cabinet.updateMany({
        where: { id: client.cabinet_id, credits: { gte: files.length } },
        data:  { credits: { decrement: files.length } },
    })
    if (creditResult.count === 0) {
        const current = await prisma.cabinet.findUnique({
            where: { id: client.cabinet_id }, select: { credits: true }
        })
        throw new Error(`Crédits insuffisants. Il vous reste ${current?.credits ?? 0} extractions, mais vous essayez d'envoyer ${files.length} fichiers.`)
    }

    // 3. Boucle d'upload des fichiers vers Supabase
    for (const file of files) {
        // Générer un nom unique pour éviter les conflits
        const fileExt = file.name.split('.').pop()
        const uniqueFileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
        const filePath = `${clientId}/${uniqueFileName}`

        // Upload dans le bucket 'documents'
        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file)

        if (uploadError) throw new Error("Erreur d'upload Supabase: " + uploadError.message)

        // Créer l'entrée dans la base de données Prisma
        await prisma.document.create({
            data: {
                client_id: clientId,
                dossier_id: (dossierId && dossierId !== 'ROOT') ? dossierId : null,
                nom_fichier: file.name,
                chemin_storage: filePath,
                statut: 'A_EXTRAIRE'
            }
        })
    }

    revalidatePath('/dashboard/extraction')
}

// ============================================================================
// 2. SUPPRESSION DE DOCUMENTS
// ============================================================================
export async function deleteDocumentsAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const documentIds = formData.getAll('documentIds')
    if (!documentIds || documentIds.length === 0) return

    const utilisateur = await prisma.utilisateur.findUnique({
        where: { id: user.id }, select: { cabinet_id: true }
    })
    if (!utilisateur?.cabinet_id) throw new Error("Cabinet introuvable")

    // Only fetch documents that belong to this cabinet (IDOR prevention)
    const documents = await prisma.document.findMany({
        where: { id: { in: documentIds }, client: { cabinet_id: utilisateur.cabinet_id } }
    })

    const filePaths = documents.map(doc => doc.chemin_storage).filter(Boolean)

    if (filePaths.length > 0) {
        const { error } = await supabase.storage.from('documents').remove(filePaths)
        if (error) console.error("Erreur de suppression Supabase:", error)
    }

    await prisma.document.deleteMany({
        where: { id: { in: documents.map(d => d.id) } }
    })

    revalidatePath('/dashboard/extraction')
}

// ============================================================================
// 3. LANCER L'EXTRACTION EN FILE D'ATTENTE (WORKER)
// ============================================================================
export async function extractDocumentsAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const templateId = formData.get('template_id')
    const documentIds = formData.getAll('documentIds')
    const lang = ['fr', 'en'].includes(formData.get('lang')) ? formData.get('lang') : 'fr'

    if (!templateId) throw new Error("Veuillez sélectionner un modèle d'extraction.")
    if (!documentIds || documentIds.length === 0) throw new Error("Veuillez sélectionner au moins un document.")

    const utilisateur = await prisma.utilisateur.findUnique({
        where: { id: user.id }, select: { cabinet_id: true }
    })
    if (!utilisateur?.cabinet_id) throw new Error("Cabinet introuvable")

    // Only process documents that belong to this cabinet (IDOR prevention)
    const ownedDocs = await prisma.document.findMany({
        where: { id: { in: documentIds }, client: { cabinet_id: utilisateur.cabinet_id } },
        select: { id: true }
    })
    const safeIds = ownedDocs.map(d => d.id)
    if (safeIds.length === 0) throw new Error("Aucun document valide sélectionné.")

    try {
        const dbTemplateId = (templateId === "NO_MODEL" || templateId === "DEFAULT_FACTURE") ? null : templateId

        await prisma.document.updateMany({
            where: { id: { in: safeIds } },
            data: { statut: 'EN_COURS_IA', template_id: dbTemplateId }
        })

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        fetch(`${appUrl}/api/worker-extraction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-worker-secret': process.env.WORKER_SECRET ?? '',
            },
            body: JSON.stringify({
                documentIds: safeIds,
                templateId,
                userId:    user.id,
                cabinetId: utilisateur.cabinet_id,
                lang,
            }),
        }).catch(err => console.error("Erreur lancement worker:", err))

    } catch (error) {
        console.error("Erreur lors de la mise en file d'attente:", error)
    }

    revalidatePath('/dashboard/extraction')
}

// ============================================================================
// 7. RE-EXTRAIRE UN SEUL DOCUMENT (PAGE VÉRIFICATION)
// ============================================================================
export async function reExtractSingleDocumentAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const documentId = formData.get('documentId')
    const templateId = formData.get('template_id')

    if (!documentId || !templateId) throw new Error("Données manquantes")

    const utilisateur = await prisma.utilisateur.findUnique({
        where: { id: user.id }, select: { cabinet_id: true }
    })
    if (!utilisateur?.cabinet_id) throw new Error("Cabinet introuvable")

    // Verify document belongs to this cabinet (IDOR prevention)
    const document = await prisma.document.findFirst({
        where: { id: documentId, client: { cabinet_id: utilisateur.cabinet_id } },
        include: { client: { include: { cabinet: true } } }
    })

    if (!document) throw new Error("Document introuvable")

    if (document.client.cabinet.credits <= 0) {
        throw new Error("Crédits épuisés. Impossible de re-extraire ce document.")
    }

    await prisma.cabinet.update({
        where: { id: document.client.cabinet_id },
        data: { credits: { decrement: 1 } }
    })

    const dbTemplateId = (templateId === "NO_MODEL" || templateId === "DEFAULT_FACTURE") ? null : templateId

    await prisma.document.update({
        where: { id: documentId },
        data: { statut: 'EN_COURS_IA', template_id: dbTemplateId }
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${appUrl}/api/worker-extraction`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-worker-secret': process.env.WORKER_SECRET ?? '',
        },
        body: JSON.stringify({
            documentIds: [documentId],
            templateId,
            userId:    user.id,
            cabinetId: utilisateur.cabinet_id,
        }),
    }).catch(err => console.error("Erreur worker:", err))

    revalidatePath(`/dashboard/verification/${documentId}`)
}

// ============================================================================
// 8. VALIDER ET ENREGISTRER LES DONNÉES (PAGE VÉRIFICATION)
// ============================================================================
export async function validateDocumentAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const documentId = formData.get('documentId')
    if (!documentId) return

    const utilisateur = await prisma.utilisateur.findUnique({
        where: { id: user.id }, select: { cabinet_id: true }
    })
    if (!utilisateur?.cabinet_id) throw new Error("Cabinet introuvable")

    // Verify document belongs to this cabinet (IDOR prevention)
    const doc = await prisma.document.findFirst({
        where: { id: documentId, client: { cabinet_id: utilisateur.cabinet_id } }
    })
    if (!doc) throw new Error("Document introuvable ou accès refusé")

    const donnees_extraites = {}
    for (const [key, value] of formData.entries()) {
        if (key !== 'documentId' && !key.startsWith('$ACTION')) {
            try {
                donnees_extraites[key] = JSON.parse(value)
            } catch {
                donnees_extraites[key] = value
            }
        }
    }

    await prisma.document.update({
        where: { id: documentId },
        data: { statut: 'VALIDE', donnees_extraites }
    })

    redirect('/dashboard/extraction')
}

// ============================================================================
// 9. CRÉER UN MODÈLE D'EXTRACTION MANUEL (PAGE MODELS)
// ============================================================================
export async function createManualTemplateAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const nomModele = formData.get('nom_modele')
    const cabinetId = formData.get('cabinet_id')
    const structureJsonString = formData.get('structure_json')

    if (!nomModele || !cabinetId || !structureJsonString) {
        throw new Error("Données manquantes pour la création du modèle.")
    }

    try {
        // On transforme la chaîne JSON du formulaire en véritable objet JSON pour Prisma
        const structureJson = JSON.parse(structureJsonString)

        // Création du modèle dans la base de données
        await prisma.templateExtraction.create({
            data: {
                nom_modele: nomModele,
                cabinet_id: cabinetId,
                structure_json: structureJson
            }
        })

        // Rafraîchir la page des modèles pour voir le nouveau modèle apparaître
        revalidatePath('/dashboard/models')
        revalidatePath('/dashboard') // Au cas où tu l'affiches aussi sur l'accueil
        
    } catch (error) {
        console.error("Erreur lors de la création du modèle manuel :", error)
        throw new Error("Impossible de créer le modèle.")
    }
}

// ============================================================================
// 10. CRÉER UN MODÈLE D'EXTRACTION VIA L'IA (DEPUIS UNE IMAGE)
// ============================================================================
export async function createTemplateFromImageAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const file = formData.get('file')
    const nomModele = formData.get('nom_modele')

    if (!file || !nomModele) throw new Error("Fichier et nom du modèle requis.")

    const utilisateur = await prisma.utilisateur.findUnique({ where: { id: user.id }, select: { cabinet_id: true } })
    if (!utilisateur?.cabinet_id) throw new Error("Cabinet introuvable.")

    try {
        const arrayBuffer = await file.arrayBuffer()
        const base64Image = Buffer.from(arrayBuffer).toString('base64')
        const mimeType = file.type

        const prompt =
            `Tu es un expert comptable et développeur. Analyse cette image de document (facture, reçu, relevé, etc.). ` +
            `Déduis tous les champs importants qui devraient être extraits systématiquement de ce type de document. ` +
            `Génère une structure JSON où les clés sont les noms des champs en snake_case (ex: date_facture, montant_ht, tva, nom_fournisseur) et les valeurs sont null. ` +
            `Renvoie UNIQUEMENT un objet JSON valide, sans texte avant ni après, et sans markdown.`

        const { content: raw } = await aiExtract(prompt, mimeType, base64Image, { maxTokens: 400, useCache: false })
        const structureJson = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim())

        await prisma.templateExtraction.create({
            data: { nom_modele: nomModele, cabinet_id: utilisateur.cabinet_id, structure_json: structureJson }
        })

        revalidatePath('/dashboard/models')
        revalidatePath('/dashboard')

    } catch (error) {
        console.error("Erreur génération modèle IA:", error)
        throw new Error("L'IA n'a pas pu générer le modèle à partir de cette image. Assurez-vous que l'image est nette.")
    }
}
// ============================================================================
// 11. MODIFIER UN MODÈLE D'EXTRACTION EXISTANT
// ============================================================================
export async function updateTemplateAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const templateId = formData.get('template_id')
    const nomModele = formData.get('nom_modele')
    const columnsJson = formData.get('columns')

    if (!templateId || !nomModele || !columnsJson) throw new Error("Données manquantes.")

    const columns = JSON.parse(columnsJson)
    if (!Array.isArray(columns) || columns.length === 0) throw new Error("Aucun champ défini.")

    // Preserve the columns as-is for keys (they're already the field names)
    const structureJson = Object.fromEntries(columns.map(col => [col, null]))

    await prisma.templateExtraction.update({
        where: { id: templateId },
        data: { nom_modele: nomModele, structure_json: structureJson }
    })

    revalidatePath('/dashboard/models')
}

// ============================================================================
// 12. SUPPRIMER UN MODÈLE D'EXTRACTION
// ============================================================================
export async function deleteTemplateAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const templateId = formData.get('template_id')
    if (!templateId) throw new Error("ID manquant.")

    await prisma.templateExtraction.delete({ where: { id: templateId } })
    revalidatePath('/dashboard/models')
}

// ============================================================================
// 13. CRÉER UN MODÈLE DEPUIS DES COLONNES EXCEL (FEATURE 2)
// ============================================================================
export async function createTemplateFromColumnsAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const nomModele = formData.get('nom_modele')
    const columnsJson = formData.get('columns')

    if (!nomModele || !columnsJson) throw new Error("Données manquantes.")

    const columns = JSON.parse(columnsJson)
    if (!Array.isArray(columns) || columns.length === 0) throw new Error("Aucune colonne sélectionnée.")

    const utilisateur = await prisma.utilisateur.findUnique({ where: { id: user.id }, select: { cabinet_id: true } })
    if (!utilisateur?.cabinet_id) throw new Error("Cabinet introuvable.")

    // Build structure_json: { column_name: null, ... }
    const structureJson = Object.fromEntries(columns.map(col => {
        const key = col.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        return [key || col, null]
    }))

    await prisma.templateExtraction.create({
        data: {
            nom_modele: nomModele,
            cabinet_id: utilisateur.cabinet_id,
            structure_json: structureJson,
        }
    })

    revalidatePath('/dashboard/models')
}

// ============================================================================
// 14. DUPLIQUER UN MODÈLE D'EXTRACTION
// ============================================================================
export async function duplicateTemplateAction(formData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Non autorisé")

    const templateId = formData.get('template_id')
    if (!templateId) throw new Error("ID manquant.")

    const utilisateur = await prisma.utilisateur.findUnique({ where: { id: user.id }, select: { cabinet_id: true } })
    if (!utilisateur?.cabinet_id) throw new Error("Cabinet introuvable.")

    const original = await prisma.templateExtraction.findFirst({
        where: { id: templateId, cabinet_id: utilisateur.cabinet_id }
    })
    if (!original) throw new Error("Modèle introuvable.")

    await prisma.templateExtraction.create({
        data: {
            nom_modele:     `Copie de ${original.nom_modele}`,
            cabinet_id:     utilisateur.cabinet_id,
            structure_json: original.structure_json,
        }
    })

    revalidatePath('/dashboard/models')
}

