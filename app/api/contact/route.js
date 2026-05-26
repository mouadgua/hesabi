import { Resend } from "resend"
import { NextResponse } from "next/server"

export async function POST(req) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { name, email, subject, message } = await req.json()

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 })
  }

  try {
    await resend.emails.send({
      from: "Hesabi <onboarding@resend.dev>",
      to: "mouadguarraz@gmail.com",
      replyTo: email,
      subject: `[Hesabi Contact] ${subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
          <div style="background:#1D9E75;padding:24px 32px;border-radius:12px 12px 0 0">
            <h1 style="margin:0;color:#fff;font-size:20px">Nouveau message — Hesabi</h1>
          </div>
          <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
            <p style="margin:0 0 8px"><strong>De :</strong> ${name}</p>
            <p style="margin:0 0 8px"><strong>Email :</strong> ${email}</p>
            <p style="margin:0 0 24px"><strong>Sujet :</strong> ${subject}</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin-bottom:24px"/>
            <p style="white-space:pre-wrap;line-height:1.7">${message}</p>
          </div>
        </div>
      `,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Resend error:", err)
    return NextResponse.json({ error: "Erreur envoi" }, { status: 500 })
  }
}
