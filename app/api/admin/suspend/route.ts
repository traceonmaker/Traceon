import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Suspendre (ou réactiver) un artisan — admin only.
// Suspendre = annule l'abonnement Stripe + coupe l'accès immédiatement.
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY || !process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { artisan_id, action } = await req.json()
  if (!artisan_id) return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })

  const { data: a } = await supabaseAdmin
    .from('artisans').select('id, stripe_subscription_id').eq('id', artisan_id).single()
  if (!a) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  if (action === 'reactiver') {
    await supabaseAdmin.from('artisans').update({ abonnement_actif: true, abonnement_statut: 'active' }).eq('id', artisan_id)
    return NextResponse.json({ ok: true, abonnement_actif: true })
  }

  // Suspendre : annule l'abonnement Stripe s'il existe, puis coupe l'accès
  if (a.stripe_subscription_id) {
    try { await stripe.subscriptions.cancel(a.stripe_subscription_id) } catch (e) { /* déjà annulé */ }
  }
  await supabaseAdmin.from('artisans').update({ abonnement_actif: false, abonnement_statut: 'canceled' }).eq('id', artisan_id)
  return NextResponse.json({ ok: true, abonnement_actif: false })
}
