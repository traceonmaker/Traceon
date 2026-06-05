import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendPush } from '@/lib/push'
import twilio from 'twilio'

export const runtime = 'nodejs'

// Mise à jour / annonce globale à tous les artisans — admin only.
// canal: 'push' (notification) ou 'sms'.
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY || !process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { message, canal } = await req.json()
  const texte = (message || '').trim()
  if (texte.length < 3) return NextResponse.json({ error: 'Message trop court' }, { status: 400 })

  const { data: artisans } = await supabaseAdmin
    .from('artisans').select('id, telephone, push_subscriptions')

  let push = 0, sms = 0

  if (canal === 'sms') {
    const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_PHONE_NUMBER
    const client = sid && tok ? twilio(sid, tok) : null
    for (const a of (artisans || [])) {
      if (client && from && a.telephone) {
        try { await client.messages.create({ from, to: a.telephone, body: `TraceOn — ${texte}` }); sms++ } catch {}
      }
    }
  } else {
    for (const a of (artisans || [])) {
      const subs = (a as any).push_subscriptions || []
      if (subs.length) {
        try {
          await sendPush(subs, { title: 'TraceOn', body: texte, url: `/dashboard/${a.id}`, tag: 'annonce' })
          push++
        } catch {}
      }
    }
  }

  return NextResponse.json({ ok: true, push, sms, total: artisans?.length || 0 })
}
