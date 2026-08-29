import ExcelJS from 'exceljs'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// ── Field translations ─────────────────────────────────────────────────────────
const FIELD_LABELS = {
  fournisseur:     { fr: 'Fournisseur',      en: 'Supplier'           },
  date_facture:    { fr: 'Date Facture',      en: 'Invoice Date'       },
  numero_facture:  { fr: 'N° Facture',        en: 'Invoice Number'     },
  montant_ht:      { fr: 'Montant HT',        en: 'Amount Excl. Tax'   },
  montant_tva:     { fr: 'TVA',               en: 'Tax Amount'         },
  taux_tva:        { fr: 'Taux TVA',          en: 'Tax Rate'           },
  montant_ttc:     { fr: 'Montant TTC',       en: 'Amount Incl. Tax'   },
  ice:             { fr: 'ICE',               en: 'Tax ID (ICE)'       },
  categorie:       { fr: 'Catégorie',         en: 'Category'           },
  articles:        { fr: 'Articles',          en: 'Items'              },
  banque:          { fr: 'Banque',            en: 'Bank'               },
  titulaire:       { fr: 'Titulaire',         en: 'Account Holder'     },
  rib:             { fr: 'RIB',               en: 'Bank Account (RIB)' },
  periode:         { fr: 'Période',           en: 'Period'             },
  solde_ouverture: { fr: 'Solde Ouverture',   en: 'Opening Balance'    },
  solde_cloture:   { fr: 'Solde Clôture',     en: 'Closing Balance'    },
  lignes:          { fr: 'Lignes',            en: 'Lines'              },
  libelle:         { fr: 'Libellé',           en: 'Description'        },
  debit:           { fr: 'Débit',             en: 'Debit'              },
  credit:          { fr: 'Crédit',            en: 'Credit'             },
  numero_bc:       { fr: 'N° Bon Commande',   en: 'PO Number'          },
  total_ht:        { fr: 'Total HT',          en: 'Total Excl. Tax'    },
  total_ttc:       { fr: 'Total TTC',         en: 'Total Incl. Tax'    },
  designation:     { fr: 'Désignation',       en: 'Description'        },
  quantite:        { fr: 'Quantité',          en: 'Quantity'           },
  prix_unitaire:   { fr: 'Prix Unitaire',     en: 'Unit Price'         },
  emetteur:        { fr: 'Émetteur',          en: 'Issuer'             },
  montant:         { fr: 'Montant',           en: 'Amount'             },
  mode_paiement:   { fr: 'Mode Paiement',     en: 'Payment Method'     },
  reference:       { fr: 'Référence',         en: 'Reference'          },
  date:            { fr: 'Date',              en: 'Date'               },
}

function colLabel(key, lang) {
  const entry = FIELD_LABELS[key]
  if (entry) return entry[lang] ?? entry.fr
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Safe arithmetic formula: only "field1+field2" or "field1-field2" patterns
function evalFormula(formula, data) {
  const m = /^([a-z_]{1,50})([+-])([a-z_]{1,50})$/.exec((formula || '').trim())
  if (!m) return null
  const v1 = Number(data[m[1]]) || 0
  const v2 = Number(data[m[3]]) || 0
  return Number((m[2] === '+' ? v1 + v2 : v1 - v2).toFixed(4))
}

// ── Config parsing ─────────────────────────────────────────────────────────────
function parseConfig(formData) {
  const raw = formData.get('config')
  if (raw) {
    try {
      const cfg = JSON.parse(raw)
      return {
        preset:   ['simple', 'par_mois', 'par_compte', 'personnalise'].includes(cfg.preset) ? cfg.preset : 'simple',
        lang:     cfg.lang === 'en' ? 'en' : 'fr',
        columns:  Array.isArray(cfg.columns)
          ? cfg.columns
              .filter(c => typeof c?.key === 'string' && /^(_calc_\d+|[a-z_]{1,50})$/.test(c.key))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .slice(0, 30)
          : [],
        groupBy:  Array.isArray(cfg.groupBy)
          ? cfg.groupBy.filter(g => ['mois', 'fournisseur', 'categorie'].includes(g)).slice(0, 1)
          : [],
        subtotals: cfg.subtotals === true,
      }
    } catch { /* fall through to legacy */ }
  }

  // Legacy: columns is JSON array of strings
  const lang = formData.get('lang') === 'en' ? 'en' : 'fr'
  try {
    const cols = JSON.parse(formData.get('columns') || '[]')
    const columns = Array.isArray(cols)
      ? cols
          .filter(c => typeof c === 'string' && /^[a-z_]{1,50}$/.test(c))
          .map((key, i) => ({ key, label: colLabel(key, lang), order: i, include: true }))
      : []
    return { preset: 'simple', lang, columns, groupBy: [], subtotals: false }
  } catch {}

  return { preset: 'simple', lang: 'fr', columns: [], groupBy: [], subtotals: false }
}

// ── Row builder ────────────────────────────────────────────────────────────────
const NUMERIC_KW = ['montant', 'total', '_ht', '_ttc', '_tva', 'debit', 'credit', 'solde', 'prix', 'quantite', 'amount', 'balance', 'ouverture', 'cloture']

function isNumericKey(key) {
  return NUMERIC_KW.some(kw => key.includes(kw))
}

function buildDocRow(doc, colDefs, lang) {
  const data = doc.donnees_extraites || {}
  const STATUT = lang === 'en'
    ? { A_EXTRAIRE: 'Pending', EN_COURS_IA: 'Processing', A_VERIFIER: 'To Review', VALIDE: 'Validated', REJETE: 'Rejected' }
    : { A_EXTRAIRE: 'En attente', EN_COURS_IA: 'En cours', A_VERIFIER: 'À vérifier', VALIDE: 'Validé', REJETE: 'Rejeté' }

  const row = {
    __nom:    doc.nom_fichier || doc.id,
    __date:   new Date(doc.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR'),
    __statut: STATUT[doc.statut] ?? doc.statut,
  }

  const detailLines = []

  for (const col of colDefs) {
    if (col.formula) {
      const val = evalFormula(col.formula, data)
      row[col.key] = val !== null ? val : ''
      continue
    }

    let val = data[col.key]
    if (typeof val === 'string' && val.trim().startsWith('[')) {
      try { val = JSON.parse(val) } catch {}
    }

    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      detailLines.push({ colKey: col.key, label: col.label || colLabel(col.key, lang), rows: val })
      row[col.key] = lang === 'en' ? '[See Details]' : '[Voir Détails]'
    } else {
      if (val === null || val === undefined) val = ''
      if (typeof val === 'object') val = JSON.stringify(val)
      row[col.key] = val
    }
  }

  return { row, detailLines }
}

// ── Grouping ───────────────────────────────────────────────────────────────────
function getGroupKey(doc, groupBy, lang) {
  const data = doc.donnees_extraites || {}
  const dim  = groupBy[0]

  if (dim === 'mois') {
    const dateStr = data.date_facture || data.date || doc.createdAt
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label   = d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { month: 'long', year: 'numeric' })
      return { sortKey, label: label.charAt(0).toUpperCase() + label.slice(1) }
    }
    return { sortKey: '9999-99', label: lang === 'en' ? 'Unknown date' : 'Date inconnue' }
  }

  if (dim === 'fournisseur') {
    const v = (data.fournisseur || data.emetteur || '').trim()
    return { sortKey: v.toLowerCase() || 'zz', label: v || (lang === 'en' ? 'Unknown supplier' : 'Fournisseur inconnu') }
  }

  if (dim === 'categorie') {
    const v = (data.categorie || '').trim()
    return { sortKey: v.toLowerCase() || 'zz', label: v || (lang === 'en' ? 'Other' : 'Autre') }
  }

  return { sortKey: '', label: '' }
}

function groupDocuments(documents, groupBy, lang) {
  if (!groupBy.length) return [{ label: null, docs: documents }]

  const map = new Map()
  for (const doc of documents) {
    const { sortKey, label } = getGroupKey(doc, groupBy, lang)
    if (!map.has(sortKey)) map.set(sortKey, { label, docs: [] })
    map.get(sortKey).docs.push(doc)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, g]) => g)
}

// ── Excel sheet builder ────────────────────────────────────────────────────────
const GREEN  = 'FF1D9E75'
const GREEN2 = 'FFD1FAE5'
const WHITE  = 'FFFFFFFF'
const STRIPE = 'FFF8FAFC'

function buildExcelSheet(workbook, sheetName, baseHeaders, colDefs, lang, docGroups, subtotals) {
  const ws = workbook.addWorksheet(sheetName.slice(0, 31))

  const colConfigs = [
    { header: baseHeaders[0], key: '__nom',    width: 28 },
    { header: baseHeaders[1], key: '__date',   width: 14 },
    { header: baseHeaders[2], key: '__statut', width: 14 },
    ...colDefs.map(c => ({
      header: c.label || colLabel(c.key, lang),
      key:    c.key,
      width:  Math.max(16, (c.label || c.key).length + 4),
    })),
  ]
  ws.columns = colConfigs

  // Style header row
  const hdr = ws.getRow(1)
  hdr.font      = { bold: true, color: { argb: WHITE } }
  hdr.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
  hdr.alignment = { vertical: 'middle', horizontal: 'left' }
  hdr.height    = 22
  ws.views      = [{ state: 'frozen', ySplit: 1 }]

  const numericColKeys = colDefs.filter(c => isNumericKey(c.key)).map(c => c.key)
  const isGrouped      = docGroups.length > 1 || (docGroups.length === 1 && docGroups[0].label !== null)

  for (const group of docGroups) {
    // Precompute rows for the group
    const allDetailLines = []
    const dataRows = group.docs.map(doc => {
      const { row, detailLines } = buildDocRow(doc, colDefs, lang)
      allDetailLines.push(...detailLines.map(dl => ({ nom: doc.nom_fichier || doc.id, ...dl })))
      return {
        __nom:    row.__nom,
        __date:   row.__date,
        __statut: row.__statut,
        ...Object.fromEntries(colDefs.map(c => [c.key, row[c.key] ?? ''])),
      }
    })

    // Group header band
    if (isGrouped && group.label) {
      const ghRow = ws.addRow({})
      ghRow.getCell(1).value     = group.label.toUpperCase()
      ghRow.getCell(1).font      = { bold: true, color: { argb: WHITE } }
      ghRow.fill                 = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
      ghRow.height               = 18
      ws.mergeCells(ghRow.number, 1, ghRow.number, colConfigs.length)
    }

    // Data rows
    dataRows.forEach((rowObj, i) => {
      const dr = ws.addRow(rowObj)
      if (i % 2 === 1) {
        dr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } }
      }
      numericColKeys.forEach(k => {
        const cell = dr.getCell(k)
        if (typeof rowObj[k] === 'number') cell.numFmt = '#,##0.00'
      })
    })

    // Subtotal row
    if (subtotals && numericColKeys.length > 0 && isGrouped && dataRows.length > 0) {
      const sums = {}
      numericColKeys.forEach(k => {
        sums[k] = dataRows.reduce((s, r) => s + (Number(r[k]) || 0), 0)
      })

      const totalRow = ws.addRow({
        __nom: lang === 'en' ? `Total — ${group.label}` : `Total — ${group.label}`,
        ...sums,
      })
      totalRow.font = { bold: true }
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN2 } }
      numericColKeys.forEach(k => {
        totalRow.getCell(k).numFmt = '#,##0.00'
      })

      // Spacer between groups
      ws.addRow({})
    }
  }

  return ws
}

// ── Main handler ───────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Non autorisé', { status: 401 })

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.id }, select: { cabinet_id: true }
    })
    if (!utilisateur?.cabinet_id) return new NextResponse('Cabinet introuvable', { status: 403 })

    // Sorti du try général : un corps mal formé — mauvais Content-Type, requête
    // construite à la main — est une entrée invalide, pas une panne. Il
    // renvoyait 500 et remontait donc comme incident alors qu'il n'y a rien à
    // corriger côté serveur.
    let formData
    try { formData = await request.formData() }
    catch { return new NextResponse('Requête invalide.', { status: 400 }) }

    const format = formData.get('format') || 'csv'

    const cfg = parseConfig(formData)
    const { lang, columns: colDefs, groupBy, subtotals } = cfg

    const rawIds     = formData.getAll('documentIds')
    const documentIds = rawIds.filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id))
    if (documentIds.length === 0) return new NextResponse('Aucun document sélectionné.', { status: 400 })

    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, client: { cabinet_id: utilisateur.cabinet_id } }
    })
    if (documents.length === 0) return new NextResponse('Documents introuvables.', { status: 404 })

    const BASE_HEADERS = lang === 'en'
      ? ['File Name', 'Import Date', 'Status']
      : ['Nom du Fichier', "Date d'import", 'Statut']

    const docGroups = groupDocuments(documents, groupBy, lang)

    // ── Excel ────────────────────────────────────────────────────────────────
    if (format === 'excel') {
      const workbook    = new ExcelJS.Workbook()
      workbook.creator  = 'Hesabi'
      workbook.created  = new Date()

      const mainName = lang === 'en' ? 'General Data' : 'Données Générales'
      buildExcelSheet(workbook, mainName, BASE_HEADERS, colDefs, lang, docGroups, subtotals)

      // Collect all detail lines for the second sheet
      const allDetailLines = []
      for (const group of docGroups) {
        for (const doc of group.docs) {
          const { detailLines } = buildDocRow(doc, colDefs, lang)
          detailLines.forEach(dl => {
            dl.rows.forEach(r => allDetailLines.push({
              [lang === 'en' ? 'SOURCE FILE' : 'FICHIER SOURCE']: doc.nom_fichier || doc.id,
              [lang === 'en' ? 'LINE TYPE'   : 'TYPE LIGNE'    ]: dl.label.toUpperCase(),
              ...r,
            }))
          })
        }
      }

      if (allDetailLines.length > 0) {
        const detailName = lang === 'en' ? 'Detailed Lines' : 'Lignes Détaillées'
        const dws        = workbook.addWorksheet(detailName)
        const detailKeys = [...new Set(allDetailLines.flatMap(l => Object.keys(l)))]
        dws.columns      = detailKeys.map(k => ({
          header: k.replace(/_/g, ' ').toUpperCase(),
          key:    k,
          width:  Math.max(15, k.length + 4),
        }))
        allDetailLines.forEach(r => dws.addRow(r))
        const dhdr    = dws.getRow(1)
        dhdr.font     = { bold: true, color: { argb: WHITE } }
        dhdr.fill     = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
        dhdr.height   = 22
        dws.views     = [{ state: 'frozen', ySplit: 1 }]
      }

      const filename = lang === 'en' ? 'Accounting_Export.xlsx' : 'Export_Comptable.xlsx'
      const buf      = await workbook.xlsx.writeBuffer()
      return new NextResponse(Buffer.from(buf), {
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // ── CSV (always flat — grouping not applied) ───────────────────────────
    const headerRow = [
      ...BASE_HEADERS,
      ...colDefs.map(c => c.label || colLabel(c.key, lang)),
    ]
    const lines = [headerRow.map(h => `"${h}"`).join(';')]

    for (const doc of documents) {
      const { row } = buildDocRow(doc, colDefs, lang)
      const vals    = [
        row.__nom,
        row.__date,
        row.__statut,
        ...colDefs.map(c => {
          const v = row[c.key]
          if (v === null || v === undefined) return ''
          if (typeof v === 'object') return JSON.stringify(v)
          return String(v)
        }),
      ]
      lines.push(vals.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    }

    const csvFilename = lang === 'en' ? 'Accounting_Export.csv' : 'Export_Comptable.csv'
    return new NextResponse('﻿' + lines.join('\n'), {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename}"`,
      },
    })

  } catch (err) {
    console.error('Erreur export:', err)
    return new NextResponse("Erreur serveur lors de l'export.", { status: 500 })
  }
}
