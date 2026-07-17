import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import ExcelJS from 'exceljs'

// ── Field name translations ────────────────────────────────────────────────────
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
    const lang    = formData.get('lang') === 'en' ? 'en' : 'fr'

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
    const BASE_HEADERS = lang === 'en'
      ? ['File Name', 'Import Date', 'Status']
      : ['Nom du Fichier', "Date d'import", 'Statut']

    const mainHeaders = [
      ...BASE_HEADERS,
      ...requestedColumns.map(c => colLabel(c, lang)),
    ]
    const mainRows    = []
    const detailedLines = []

    for (const doc of documents) {
      const data = doc.donnees_extraites || {}
      const STATUT_MAP = lang === 'en'
        ? { A_EXTRAIRE: 'Pending', EN_COURS_IA: 'Processing', A_VERIFIER: 'To Review', VALIDE: 'Validated', REJETE: 'Rejected' }
        : { A_EXTRAIRE: 'En attente', EN_COURS_IA: 'En cours', A_VERIFIER: 'À vérifier', VALIDE: 'Validé', REJETE: 'Rejeté' }

      const row  = [
        doc.nom_fichier || doc.id,
        new Date(doc.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR'),
        STATUT_MAP[doc.statut] ?? doc.statut,
      ]

      for (const col of requestedColumns) {
        let val = data[col]

        if (typeof val === 'string' && val.trim().startsWith('[') && val.trim().endsWith(']')) {
          try { val = JSON.parse(val) } catch { /* keep as string */ }
        }

        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          val.forEach(item => detailedLines.push({
            [lang === 'en' ? 'SOURCE FILE' : 'FICHIER SOURCE']: doc.nom_fichier || doc.id,
            [lang === 'en' ? 'LINE TYPE'   : 'TYPE LIGNE']:     colLabel(col, lang).toUpperCase(),
            ...item,
          }))
          row.push(lang === 'en' ? '[See Details tab]' : '[Voir onglet Détails]')
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
      const wb = new ExcelJS.Workbook()

      const mainWs = wb.addWorksheet(lang === 'en' ? 'General Data' : 'Données Générales')
      mainWs.columns = mainHeaders.map(h => ({ header: h, width: Math.max(20, h.length + 5) }))
      for (const row of mainRows) mainWs.addRow(row)
      mainWs.getRow(1).font = { bold: true }

      if (detailedLines.length > 0) {
        const detailKeys = [...new Set(detailedLines.flatMap(l => Object.keys(l)))]
        const detailWs   = wb.addWorksheet(lang === 'en' ? 'Detailed Lines' : 'Lignes Détaillées')
        detailWs.columns = detailKeys.map(k => ({
          header: k.replace(/_/g, ' ').toUpperCase(),
          width: Math.max(15, k.length + 5),
        }))
        for (const line of detailedLines) detailWs.addRow(detailKeys.map(k => line[k] ?? ''))
        detailWs.getRow(1).font = { bold: true }
      }

      const filename = lang === 'en' ? 'Accounting_Export.xlsx' : 'Export_Comptable.xlsx'
      const buf = await wb.xlsx.writeBuffer()
      return new NextResponse(buf, {
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // ── CSV ───────────────────────────────────────────────────────────────────
    const lines = [mainHeaders.map(h => `"${h}"`).join(';')]
    mainRows.forEach(row => {
      lines.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    })
    const csvFilename = lang === 'en' ? 'Accounting_Export.csv' : 'Export_Comptable.csv'
    return new NextResponse('﻿' + lines.join('\n'), {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename}"`,
      },
    })

  } catch (err) {
    console.error("Erreur export:", err)
    return new NextResponse("Erreur serveur lors de l'export.", { status: 500 })
  }
}
