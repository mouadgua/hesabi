import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'

export async function POST(request) {
  const formData = await request.formData()
  const documentIds = formData.getAll('documentIds')
  const supabase = await createClient()
  const zip = new JSZip()

  // 1. Récupérer les données
  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds } }
  })

  // 2. Créer l'Excel récapitulatif
  const rows = documents.map(doc => ({
    Fichier: doc.nom_fichier,
    Statut: doc.statut,
    ...(doc.donnees_extraites || {})
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Recapitulatif")
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  
  // Ajouter l'Excel au ZIP
  zip.file("00_Recapitulatif_Extraction.xlsx", excelBuffer)

  // 3. Ajouter les PDF originaux au ZIP
  for (const doc of documents) {
    const { data: fileBlob } = await supabase.storage.from('documents').download(doc.chemin_storage)
    if (fileBlob) {
      const buffer = await fileBlob.arrayBuffer()
      zip.file(`documents/${doc.nom_fichier}`, buffer)
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

  return new NextResponse(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="Mass_Export_${Date.now()}.zip"`,
    }
  })
}