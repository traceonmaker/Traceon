import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// État du système (config + santé) — admin only.
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY || !process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Santé base de données
  let db = false
  try { const { error } = await supabaseAdmin.from('artisans').select('id').limit(1); db = !error } catch {}

  const stripeKey = process.env.STRIPE_SECRET_KEY || ''
  const stripeMode = stripeKey.startsWith('sk_live') ? 'live' : stripeKey.startsWith('sk_test') ? 'test' : 'absent'

  return NextResponse.json({
    db,
    stripe: stripeMode,                                   // 'live' | 'test' | 'absent'
    twilio: !!process.env.TWILIO_ACCOUNT_SID,             // SMS
    email: !!process.env.RESEND_API_KEY,                  // email de secours
    push: !!process.env.VAPID_PRIVATE_KEY,                // notifications
    cron: !!process.env.CRON_SECRET,                      // relance protégée
    appUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    ts: new Date().toISOString(),
  })
}
