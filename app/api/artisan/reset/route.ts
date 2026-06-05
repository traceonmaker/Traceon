import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendEmail, emailLayout } from '@/lib/email'
import twilio from 'twilio'

export const runtime = 'nodejs'

function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let p = ''
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p
}

// Mot de passe oublié → on régénère un mot de passe et on l'envoie par SMS.
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const mail = (email || '').trim().toLowerCase()
  if (!mail) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

  const { data: artisan } = await supabaseAdmin
    .from('artisans').select('id, telephone').ilike('email', mail).maybeSingle()
  // Réponse générique : on ne révèle pas si le compte existe
  if (!artisan?.telephone) return NextResponse.json({ ok: true })

  // Retrouve l'utilisateur auth par email
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const user = list?.users?.find(u => (u.email || '').toLowerCase() === mail)
  if (!user) return NextResponse.json({ ok: true })

  const password = genPassword()
  await supabaseAdmin.auth.admin.updateUserById(user.id, { password })

  try {
    const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_PHONE_NUMBER
    const url = process.env.NEXT_PUBLIC_APP_URL || ''
    if (sid && tok && from) {
      await twilio(sid, tok).messages.create({
        from, to: artisan.telephone,
        body: `TraceOn — nouveau mot de passe : ${password}\nConnexion : ${url}/login\n(Modifiable dans Réglages.)`,
      })
    }
  } catch (e) { console.error('SMS reset:', (e as any)?.message) }

  // Fallback email
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  sendEmail(mail, 'Votre nouveau mot de passe TraceOn', emailLayout('Nouveau mot de passe',
    `Votre nouveau mot de passe : <b>${password}</b><br><br><a href="${base}/login" style="color:#1d5fed">Se connecter</a><br><br>Modifiable dans Réglages.`)).catch(() => {})

  return NextResponse.json({ ok: true })
}
