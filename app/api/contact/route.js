import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { sanitizeText, sanitizeEmail, escapeHtml } from '@/lib/sanitize'
import { checkAuthRateLimit, clientIp, formatRetryDelay } from '@/lib/authRateLimit'

export async function POST(req) {
  // ── Rate limit ────────────────────────────────────────────────────────────
  // Était un compteur en mémoire : chaque instance Vercel avait le sien, donc
  // il suffisait de retomber sur une autre pour repartir de zéro.
  const ip = clientIp(req.headers)
  const rl = await checkAuthRateLimit('contact', `ip:${ip}`)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Trop de messages envoyés. Réessayez dans ${formatRetryDelay(rl.retryAfterSec)}.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  // ── Parse + sanitize ──────────────────────────────────────────────────────
  let body
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 }) }

  const name    = sanitizeText(body.name,    100)
  const email   = sanitizeEmail(body.email)
  const subject = sanitizeText(body.subject, 200)
  const message = sanitizeText(body.message, 2000)

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Champs manquants ou invalides.' }, { status: 400 })
  }

  // ── Send email — all values HTML-escaped to prevent XSS in email client ───
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    await resend.emails.send({
      from:    'Hesabi <onboarding@resend.dev>',
      to:      'mouadguarraz@gmail.com',
      replyTo: email,
      subject: `[Hesabi Contact] ${escapeHtml(subject)}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
          <div style="background:#1D9E75;padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="margin:0;color:#fff;font-size:20px">Nouveau message — Hesabi</h1>
          </div>
          <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p style="margin:0 0 8px"><strong>De :</strong> ${escapeHtml(name)}</p>
            <p style="margin:0 0 8px"><strong>Email :</strong> ${escapeHtml(email)}</p>
            <p style="margin:0 0 24px"><strong>Sujet :</strong> ${escapeHtml(subject)}</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:24px"/>
            <p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(message)}</p>
          </div>
        </div>
      `,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    return NextResponse.json({ error: "Erreur lors de l'envoi." }, { status: 500 })
  }
}
