import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const documentIds = formData.getAll('documentIds')
    const requestedColumns = JSON.parse(formData.get('columns') || "[]")
    const format = formData.get('format') || 'csv'

    if (!documentIds || documentIds.length === 0) {
      return new NextResponse("Aucun document sélectionné.", { status: 400 })
    }

    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } }
    })

    if (documents.length === 0) return new NextResponse("Documents introuvables.", { status: 404 })

    const mainHeaders = ['Nom du Fichier', 'Date d\'import', 'Statut', ...requestedColumns.map(c => c.replace(/_/g, ' ').toUpperCase())]
    const mainRows = []
    
    // Pour stocker toutes les lignes complexes trouvées (ex: les relevés bancaires)
    const detailedLines = []

    documents.forEach(doc => {
      const data = doc.donnees_extraites || {}
      const row = [
        doc.nom_fichier || doc.id,
        new Date(doc.createdAt).toLocaleDateString('fr-FR'),
        doc.statut
      ]

      requestedColumns.forEach(col => {
        let val = data[col]

        // --- LA MAGIE EST ICI ---
        // Si c'est du texte qui ressemble à un tableau JSON "[...]", on le parse pour le re-transformer en vrai tableau !
        if (typeof val === 'string' && val.trim().startsWith('[') && val.trim().endsWith(']')) {
          try {
            val = JSON.parse(val)
          } catch (e) {
            // Si la conversion échoue (JSON mal formaté par l'utilisateur), ça reste du texte.
          }
        }
        // ------------------------

        // SI LA VALEUR EST UN VRAI TABLEAU D'OBJETS
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          // On extrait chaque ligne et on y attache le nom du fichier
          val.forEach(item => {
            detailedLines.push({
              "FICHIER SOURCE": doc.nom_fichier || doc.id,
              "TYPE LIGNE": col.toUpperCase(),
              ...item
            })
          })
          row.push("[Voir onglet Détails]")
        } 
        else {
          if (val === null || val === undefined) val = ""
          if (typeof val === 'object') val = JSON.stringify(val)
          row.push(val)
        }
      })

      mainRows.push(row)
    })

    // ==========================================
    // 2. GÉNÉRATION EXCEL MULTI-ONGLETS (.xlsx)
    // ==========================================
    if (format === 'excel') {
      const workbook = XLSX.utils.book_new()

      // ONGLET 1 : Données principales
      const mainWorksheetData = [mainHeaders, ...mainRows]
      const mainWorksheet = XLSX.utils.aoa_to_sheet(mainWorksheetData)
      mainWorksheet['!cols'] = mainHeaders.map(h => ({ wch: Math.max(20, h.length + 5) }))
      XLSX.utils.book_append_sheet(workbook, mainWorksheet, "Données Générales")

      // ONGLET 2 : Détails (Les lignes du relevé)
      if (detailedLines.length > 0) {
        const detailKeys = new Set()
        detailedLines.forEach(line => Object.keys(line).forEach(k => detailKeys.add(k)))
        const detailHeaders = Array.from(detailKeys)

        const detailRows = detailedLines.map(line => detailHeaders.map(header => line[header] || ""))
        
        const detailWorksheetData = [detailHeaders.map(h => h.replace(/_/g, ' ').toUpperCase()), ...detailRows]
        const detailWorksheet = XLSX.utils.aoa_to_sheet(detailWorksheetData)
        detailWorksheet['!cols'] = detailHeaders.map(h => ({ wch: Math.max(15, h.length + 5) }))
        XLSX.utils.book_append_sheet(workbook, detailWorksheet, "Lignes Détaillées")
      }

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="Export_Comptable.xlsx"',
        }
      })
    } 
    
    // ==========================================
    // 3. GÉNÉRATION CSV (.csv)
    // ==========================================
    else {
      const lignesCsv = []
      lignesCsv.push(mainHeaders.map(h => `"${h}"`).join(';'))

      mainRows.forEach(row => {
        lignesCsv.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
      })

      const BOM = "\uFEFF"
      const csvContent = BOM + lignesCsv.join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="Export_Comptable.csv"',
        }
      })
    }

  } catch (error) {
    console.error("Erreur lors de l'export :", error)
    return new NextResponse("Erreur serveur lors de l'export.", { status: 500 })
  }
}