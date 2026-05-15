"use server";

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function extractInvoiceData(formData) {
  try {
    // 1. Récupérer le fichier depuis le FormData
    const file = formData.get("document");
    if (!file) throw new Error("Aucun fichier reçu");

    // 2. Convertir le fichier en Base64 côté SERVEUR
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const mimeType = file.type;

    // 3. Configuration de Gemini
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
    
    // 4. Appel à l'API
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType: mimeType } }
    ]);

    // 5. Retourner le JSON propre
    return JSON.parse(result.response.text());

  } catch (error) {
    console.error("Erreur IA détaillée:", error);
    throw new Error("Échec de l'extraction sur le serveur");
  }
}