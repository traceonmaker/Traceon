import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const ACTIFS = ['trialing', 'active', 'past_due']

// Réconcilie l'abonnement depuis Stripe (appelé au retour du checkout)
export async function POST(req: NextRequest) {
  const { artisan_id } = await req.json()
  const { data: artisan } = await supabaseAdmin
    .from('artisans').select('id, stripe_customer_id').eq('id', artisan_id).single()
  if (!artisan?.stripe_customer_id) return NextResponse.json({ abonnement_actif: false })

  const subs = await stripe.subscriptions.list({ customer: artisan.stripe_customer_id, status: 'all', limit: 1 })
  const sub = subs.data[0]
  const actif = sub ? ACTIFS.includes(sub.status) : false

  await supabaseAdmin.from('artisans').update({
    abonnement_actif: actif,
    abonnement_statut: sub?.status || 'inactif',
    stripe_subscription_id: sub?.id || null,
  }).eq('id', artisan.id)

  return NextResponse.json({ abonnement_actif: actif, statut: sub?.status })
}
