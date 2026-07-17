import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/utils/supabase/server'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Non autorisé', { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)

    const ws = wb.worksheets[0]
    if (!ws) return NextResponse.json({ error: 'Feuille introuvable' }, { status: 400 })

    const headers = []
    ws.getRow(1).eachCell({ includeEmpty: false }, cell => {
      const val = String(cell.value ?? '').trim()
      if (val) headers.push(val)
    })

    if (headers.length === 0) {
      return NextResponse.json({ error: 'Aucun en-tête trouvé dans ce fichier.' }, { status: 400 })
    }

    return NextResponse.json({ headers })
  } catch (err) {
    console.error('[parse-excel-headers]', err.message)
    return NextResponse.json({ error: 'Impossible de lire ce fichier Excel.' }, { status: 500 })
  }
}
