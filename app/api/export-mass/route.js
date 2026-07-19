import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'
import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const GREEN = 'FF1D9E75'
const WHITE = 'FFFFFFFF'

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Non autorisé', { status: 401 })

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.id }, select: { cabinet_id: true }
    })
    if (!utilisateur?.cabinet_id) return new NextResponse('Cabinet introuvable', { status: 403 })

    const formData    = await request.formData()
    const rawIds      = formData.getAll('documentIds')
    const documentIds = rawIds.filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id))
    if (documentIds.length === 0) return new NextResponse('Aucun document.', { status: 400 })

    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, client: { cabinet_id: utilisateur.cabinet_id } }
    })
    if (documents.length === 0) return new NextResponse('Documents introuvables.', { status: 404 })

    // ── Recap Excel (exceljs) ─────────────────────────────────────────────────
    const workbook   = new ExcelJS.Workbook()
    workbook.creator = 'Hesabi'
    workbook.created = new Date()
    const ws         = workbook.addWorksheet('Récapitulatif')

    // Gather all keys across all documents
    const allKeys = new Set(['Fichier', 'Statut'])
    documents.forEach(doc => {
      if (doc.donnees_extraites) Object.keys(doc.donnees_extraites).forEach(k => allKeys.add(k))
    })
    const keys = [...allKeys]

    ws.columns = keys.map(k => ({
      header: k.replace(/_/g, ' ').toUpperCase(),
      key:    k,
      width:  Math.max(16, k.length + 4),
    }))

    documents.forEach(doc => {
      const data = doc.donnees_extraites || {}
      const row  = { Fichier: doc.nom_fichier || doc.id, Statut: doc.statut }
      keys.forEach(k => {
        if (k === 'Fichier' || k === 'Statut') return
        const v = data[k]
        row[k]  = Array.isArray(v) ? JSON.stringify(v) : (v ?? '')
      })
      ws.addRow(row)
    })

    const hdr    = ws.getRow(1)
    hdr.font     = { bold: true, color: { argb: WHITE } }
    hdr.fill     = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    hdr.height   = 22
    ws.views     = [{ state: 'frozen', ySplit: 1 }]

    const excelBuffer = await workbook.xlsx.writeBuffer()

    // ── ZIP ───────────────────────────────────────────────────────────────────
    const zip = new JSZip()
    zip.file('00_Recapitulatif_Extraction.xlsx', excelBuffer)

    for (const doc of documents) {
      const { data: fileBlob } = await supabaseService.storage
        .from('documents')
        .download(doc.chemin_storage)
      if (fileBlob) {
        const buffer   = await fileBlob.arrayBuffer()
        const safeName = doc.nom_fichier?.replace(/[^a-zA-Z0-9._-]/g, '_') ?? doc.id
        zip.file(`documents/${safeName}`, buffer)
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="Mass_Export_${Date.now()}.zip"`,
      },
    })
  } catch (err) {
    console.error('Export mass error:', err)
    return new NextResponse('Erreur serveur.', { status: 500 })
  }
}
