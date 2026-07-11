import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/utils/supabase/server'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(request) {
  // Auth check — must be logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop().toLowerCase()

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    // CSV: pure split — no library needed
    if (ext === 'csv') {
      const text = buffer.toString('utf-8')
      const firstLine = text.split(/\r?\n/)[0] ?? ''
      // Detect delimiter: semicolon (French Excel default) or comma
      const delimiter = firstLine.includes(';') ? ';' : ','
      const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, '')).filter(Boolean)
      if (headers.length === 0) return NextResponse.json({ error: 'Aucun en-tête trouvé' }, { status: 422 })
      return NextResponse.json({ headers })
    }

    // XLSX / XLS via exceljs
    const wb = new ExcelJS.Workbook()
    if (ext === 'xlsx') {
      await wb.xlsx.load(buffer)
    } else {
      return NextResponse.json({ error: 'Format non supporté. Utilisez .xlsx ou .csv' }, { status: 400 })
    }

    const ws = wb.worksheets[0]
    if (!ws) return NextResponse.json({ error: 'Aucune feuille trouvée' }, { status: 422 })

    const firstRow = ws.getRow(1)
    const headers = []
    firstRow.eachCell({ includeEmpty: false }, cell => {
      const val = String(cell.value ?? '').trim()
      if (val) headers.push(val)
    })

    if (headers.length === 0) return NextResponse.json({ error: 'Aucun en-tête trouvé dans la première ligne' }, { status: 422 })

    return NextResponse.json({ headers })
  } catch (err) {
    console.error('[parse-excel-headers]', err)
    return NextResponse.json({ error: 'Impossible de lire ce fichier' }, { status: 500 })
  }
}
