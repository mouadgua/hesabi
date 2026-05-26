"use server";

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

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

    // 1. Récupérer le cabinet pour vérifier les crédits
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: { cabinet: true }
    })

    if (!client) throw new Error("Client introuvable")

    // 2. Vérification stricte des crédits côté serveur
    if (client.cabinet.credits < files.length) {
        throw new Error(`Crédits insuffisants. Il vous reste ${client.cabinet.credits} extractions, mais vous essayez d'envoyer ${files.length} fichiers.`)
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

    // 4. DÉDUCTION DES CRÉDITS (On retire le nombre exact de fichiers envoyés)
    await prisma.cabinet.update({
        where: { id: client.cabinet_id },
        data: {
            credits: { decrement: files.length }
        }
    })

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

    const documents = await prisma.document.findMany({
        where: { id: { in: documentIds } }
    })

    const filePaths = documents.map(doc => doc.chemin_storage).filter(Boolean)

    if (filePaths.length > 0) {
        const { error } = await supabase.storage.from('documents').remove(filePaths)
        if (error) console.error("Erreur de suppression Supabase:", error)
    }

    await prisma.document.deleteMany({
        where: { id: { in: documentIds } }
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

    if (!templateId) throw new Error("Veuillez sélectionner un modèle d'extraction.")
    if (!documentIds || documentIds.length === 0) throw new Error("Veuillez sélectionner au moins un document.")

    try {
        const dbTemplateId = (templateId === "NO_MODEL" || templateId === "DEFAULT_FACTURE") ? null : templateId;

        // Passer le statut en "En cours IA" instantanément
        await prisma.document.updateMany({
            where: { id: { in: documentIds } },
            data: { 
                statut: 'EN_COURS_IA',
                template_id: dbTemplateId 
            }
        })

        // Lancer le Worker en arrière-plan (File d'attente)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        fetch(`${appUrl}/api/worker-extraction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentIds, templateId, userId: user.id })
        }).catch(err => console.error("Erreur lancement worker:", err))

    } catch (error) {
        console.error("Erreur lors de la mise en file d'attente:", error)
    }

    revalidatePath('/dashboard/extraction')
}

// ============================================================================
// 4. EXTRACTION SINGLE TEST
// ============================================================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function extractInvoiceData(formData) {
  try {
    const file = formData.get("document");
    if (!file) throw new Error("Aucun fichier reçu");

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const mimeType = file.type;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            fournisseur: { type: SchemaType.STRING, description: "Nom de l'entreprise" },
            date_facture: { type: SchemaType.STRING, description: "Format YYYY-MM-DD" },
            montant_ht: { type: SchemaType.NUMBER },
            montant_tva: { type: SchemaType.NUMBER },
            taux_tva: { type: SchemaType.NUMBER, description: "Taux appliqué (7, 10, 14, 20)" },
            montant_ttc: { type: SchemaType.NUMBER },
            ice: { type: SchemaType.STRING, description: "L'ICE à 15 chiffres s'il est présent" },
            categorie: { 
              type: SchemaType.STRING, 
              description: "Choix : DEPLACEMENT, REPAS, ACHAT_MARCHANDISE, AUTRE" 
            },
            score_fiabilite: { type: SchemaType.INTEGER, description: "De 0 à 100" }
          },
          required: ["fournisseur", "montant_ttc", "categorie"]
        }
      }
    });

    const prompt = "Analyse cette facture marocaine et extrais les données. Si le HT ou la TVA manquent, déduis-les si possible.";
    
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType: mimeType } }
    ]);

    return JSON.parse(result.response.text());

  } catch (error) {
    console.error("Erreur IA détaillée:", error);
    throw new Error("Échec de l'extraction sur le serveur");
  }
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

    // 1. Vérification des crédits restants
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { client: { include: { cabinet: true } } }
    })

    if (!document) throw new Error("Document introuvable")

    if (document.client.cabinet.credits <= 0) {
        throw new Error("Crédits épuisés. Impossible de re-extraire ce document.")
    }

    // 2. Déduction du crédit
    await prisma.cabinet.update({
        where: { id: document.client.cabinet_id },
        data: { credits: { decrement: 1 } }
    })

    // 3. Formatage pour Prisma
    const dbTemplateId = (templateId === "NO_MODEL" || templateId === "DEFAULT_FACTURE") ? null : templateId;

    // 4. Mise à jour du statut
    await prisma.document.update({
        where: { id: documentId },
        data: { 
            statut: 'EN_COURS_IA',
            template_id: dbTemplateId
        }
    })

    // 5. Lancement du Worker en fond
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${appUrl}/api/worker-extraction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: [documentId], templateId, userId: user.id })
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

    const donnees_extraites = {};
    for (const [key, value] of formData.entries()) {
        if (key !== 'documentId' && !key.startsWith('$ACTION')) {
            try {
                // Si c'était un objet/tableau complexe (ex: les "lignes" de facture), on le parse
                donnees_extraites[key] = JSON.parse(value);
            } catch {
                donnees_extraites[key] = value;
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

    if (!file || !nomModele) {
        throw new Error("Fichier et nom du modèle requis.")
    }

    const utilisateur = await prisma.utilisateur.findUnique({ where: { id: user.id }, select: { cabinet_id: true } })
    if (!utilisateur?.cabinet_id) throw new Error("Cabinet introuvable.")
    const cabinetId = utilisateur.cabinet_id

    try {
        // 1. Préparer l'image pour Gemini (Conversion en Base64)
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64Image = buffer.toString("base64")
        const mimeType = file.type

        // 2. Initialiser Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
        
        // 3. Le Prompt magique pour générer la structure
        const prompt = `Tu es un expert comptable et développeur. Analyse cette image de document (facture, reçu, relevé, etc.). 
        Déduis tous les champs importants qui devraient être extraits systématiquement de ce type de document.
        Génère une structure JSON où les clés sont les noms des champs en snake_case (ex: date_facture, montant_ht, tva, nom_fournisseur) et les valeurs sont null.
        Renvoie UNIQUEMENT un objet JSON valide, sans texte avant ni après, et sans markdown (\`\`\`json).`

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Image, mimeType: mimeType } }
        ])

        // 4. Nettoyage de la réponse de Gemini
        let responseText = result.response.text()
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
        
        const structureJson = JSON.parse(responseText)

        // 5. Sauvegarde du nouveau modèle généré par l'IA dans Prisma
        await prisma.templateExtraction.create({
            data: {
                nom_modele: nomModele,
                cabinet_id: cabinetId,
                structure_json: structureJson
            }
        })

        // 6. Rafraîchir l'interface
        revalidatePath('/dashboard/models')
        revalidatePath('/dashboard')
        
    } catch (error) {
        console.error("Erreur lors de la génération IA du modèle :", error)
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

