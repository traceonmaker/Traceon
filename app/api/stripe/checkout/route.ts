import { NextRequest, NextResponse } from 'next/server'
import { stripe, PRICE_ID, TRIAL_DAYS } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { artisan_id } = await req.json()

  const { data: artisan } = await supabaseAdmin
    .from('artisans').select('id, email, nom_entreprise, stripe_customer_id').eq('id', artisan_id).single()
  if (!artisan) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })

  // Réutilise ou crée le client Stripe
  let customerId = artisan.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: artisan.email || undefined,
      name: artisan.nom_entreprise || undefined,
      metadata: { artisan_id: artisan.id },
    })
    customerId = customer.id
    await supabaseAdmin.from('artisans').update({ stripe_customer_id: customerId }).eq('id', artisan.id)
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { artisan_id: artisan.id },
    },
    success_url: `${base}/dashboard/${artisan.id}?abonnement=ok`,
    cancel_url: `${base}/dashboard/${artisan.id}?abonnement=annule`,
    locale: 'fr',
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
