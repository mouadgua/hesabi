import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Non autorisé', { status: 401 })

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.id }, select: { cabinet_id: true }
    })
    if (!utilisateur?.cabinet_id) return new NextResponse('Cabinet introuvable', { status: 403 })

    // ── Parse input ───────────────────────────────────────────────────────────
    const formData = await request.formData()
    const rawIds = formData.getAll('documentIds')
    const format  = formData.get('format') || 'csv'

    // Sanitize documentIds — UUID format only
    const documentIds = rawIds.filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id))
    if (documentIds.length === 0) return new NextResponse('Aucun document sélectionné.', { status: 400 })

    // Sanitize columns — only allow snake_case keys, max 30 columns
    let requestedColumns = []
    try {
      const parsed = JSON.parse(formData.get('columns') || '[]')
      requestedColumns = Array.isArray(parsed)
        ? parsed.filter(c => typeof c === 'string' && /^[a-z_]{1,50}$/.test(c)).slice(0, 30)
        : []
    } catch { /* fallback to empty */ }

    // ── Fetch documents — scoped to cabinet (IDOR prevention) ─────────────────
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, client: { cabinet_id: utilisateur.cabinet_id } }
    })
    if (documents.length === 0) return new NextResponse('Documents introuvables.', { status: 404 })

    // ── Build rows ────────────────────────────────────────────────────────────
    const mainHeaders = [
      'Nom du Fichier', "Date d'import", 'Statut',
      ...requestedColumns.map(c => c.replace(/_/g, ' ').toUpperCase()),
    ]
    const mainRows    = []
    const detailedLines = []

    for (const doc of documents) {
      const data = doc.donnees_extraites || {}
      const row  = [
        doc.nom_fichier || doc.id,
        new Date(doc.createdAt).toLocaleDateString('fr-FR'),
        doc.statut,
      ]

      for (const col of requestedColumns) {
        let val = data[col]

        if (typeof val === 'string' && val.trim().startsWith('[') && val.trim().endsWith(']')) {
          try { val = JSON.parse(val) } catch { /* keep as string */ }
        }

        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          val.forEach(item => detailedLines.push({
            'FICHIER SOURCE': doc.nom_fichier || doc.id,
            'TYPE LIGNE':     col.toUpperCase(),
            ...item,
          }))
          row.push('[Voir onglet Détails]')
        } else {
          if (val === null || val === undefined) val = ''
          if (typeof val === 'object') val = JSON.stringify(val)
          row.push(val)
        }
      }
      mainRows.push(row)
    }

    // ── Excel ─────────────────────────────────────────────────────────────────
    if (format === 'excel') {
      const wb = XLSX.utils.book_new()

      const mainWs = XLSX.utils.aoa_to_sheet([mainHeaders, ...mainRows])
      mainWs['!cols'] = mainHeaders.map(h => ({ wch: Math.max(20, h.length + 5) }))
      XLSX.utils.book_append_sheet(wb, mainWs, 'Données Générales')

      if (detailedLines.length > 0) {
        const detailKeys    = [...new Set(detailedLines.flatMap(l => Object.keys(l)))]
        const detailHeaders = detailKeys
        const detailRows    = detailedLines.map(l => detailHeaders.map(k => l[k] ?? ''))
        const detailWs      = XLSX.utils.aoa_to_sheet([detailHeaders.map(h => h.replace(/_/g, ' ').toUpperCase()), ...detailRows])
        detailWs['!cols']   = detailHeaders.map(h => ({ wch: Math.max(15, h.length + 5) }))
        XLSX.utils.book_append_sheet(wb, detailWs, 'Lignes Détaillées')
      }

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      return new NextResponse(buf, {
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="Export_Comptable.xlsx"',
        },
      })
    }

    // ── CSV ───────────────────────────────────────────────────────────────────
    const lines = [mainHeaders.map(h => `"${h}"`).join(';')]
    mainRows.forEach(row => {
      lines.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    })
    return new NextResponse('﻿' + lines.join('\n'), {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="Export_Comptable.csv"',
      },
    })

  } catch (err) {
    console.error("Erreur export:", err)
    return new NextResponse("Erreur serveur lors de l'export.", { status: 500 })
  }
}
