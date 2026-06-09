import prisma from '@/lib/prisma'
import ExtractionsHub from './ExtractionsHub'

const DH_PER_1K_IN  = 0.025
const DH_PER_1K_OUT = 0.10

export default async function AdminExtractionsPage() {
  const [docs, agg, successCount, rejectedCount, fallbackCount] = await Promise.all([
    prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true, nom_fichier: true, statut: true,
        ai_provider: true, processing_ms: true,
        tokens_in: true, tokens_out: true,
        document_type_confidence: true, document_type: true,
        createdAt: true,
        client: { select: { cabinet: { select: { nom: true } } } },
      },
    }),
    prisma.document.aggregate({
      _sum: { tokens_in: true, tokens_out: true },
      _avg: { document_type_confidence: true, processing_ms: true },
      _count: { id: true },
      where: { statut: { in: ['A_VERIFIER', 'VALIDE', 'REJETE'] } },
    }),
    prisma.document.count({ where: { statut: { in: ['A_VERIFIER', 'VALIDE'] } } }),
    prisma.document.count({ where: { statut: 'REJETE' } }),
    prisma.document.count({
      where: {
        ai_provider: { in: ['anthropic/claude-haiku-4-5', 'qwen/qwen2.5-vl-72b-instruct', 'openai/gpt-4o'] },
        statut: { in: ['A_VERIFIER', 'VALIDE', 'REJETE'] },
      },
    }),
  ])

  const totalExtracted = agg._count.id
  const tokensIn  = agg._sum.tokens_in  ?? 0
  const tokensOut = agg._sum.tokens_out ?? 0
  const costDH  = (tokensIn / 1000) * DH_PER_1K_IN + (tokensOut / 1000) * DH_PER_1K_OUT

  return (
    <ExtractionsHub
      docs={docs.map(d => ({
        id:            d.id,
        nom_fichier:   d.nom_fichier,
        statut:        d.statut,
        ai_provider:   d.ai_provider,
        processing_ms: d.processing_ms,
        tokens_in:     d.tokens_in,
        tokens_out:    d.tokens_out,
        confidence:    d.document_type_confidence,
        document_type: d.document_type,
        createdAt:     d.createdAt.toISOString(),
        cabinet_nom:   d.client?.cabinet?.nom ?? '—',
      }))}
      stats={{
        total:              totalExtracted,
        tokens_in:          tokensIn,
        tokens_out:         tokensOut,
        cost_dh:            costDH,
        cost_usd:           costDH / 10,
        avg_confidence:     agg._avg.document_type_confidence,
        avg_processing_ms:  agg._avg.processing_ms,
        success_rate:       totalExtracted > 0 ? Math.round(successCount / totalExtracted * 100) : null,
        rejected_count:     rejectedCount,
        fallback_rate:      totalExtracted > 0 ? Math.round(fallbackCount / totalExtracted * 100) : null,
      }}
    />
  )
}
