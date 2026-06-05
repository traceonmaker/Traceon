import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Statuts donnant accès : essai en cours OU abonnement payé.
// 'past_due'/'unpaid'/'canceled' = pas payé → accès coupé immédiatement (décision produit).
const ACTIFS = ['trialing', 'active']

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  let event: any
  try {
    event = secret && sig
      ? stripe.webhooks.constructEvent(body, sig, secret)
      : JSON.parse(body) // fallback dev sans secret
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook: ${err.message}` }, { status: 400 })
  }

  async function syncSubscription(sub: any) {
    const artisanId = sub.metadata?.artisan_id
    const actif = ACTIFS.includes(sub.status)
    const filter = artisanId
      ? supabaseAdmin.from('artisans').update({
          abonnement_actif: actif,
          abonnement_statut: sub.status,
          stripe_subscription_id: sub.id,
        }).eq('id', artisanId)
      : supabaseAdmin.from('artisans').update({
          abonnement_actif: actif,
          abonnement_statut: sub.status,
          stripe_subscription_id: sub.id,
        }).eq('stripe_customer_id', sub.customer)
    await filter
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        ;(sub as any).metadata = { ...(sub.metadata||{}), artisan_id: (sub.metadata as any)?.artisan_id }
        await syncSubscription(sub)
      }
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncSubscription(event.data.object)
      break
    }
    // Paiement échoué → coupe l'accès tout de suite (on ne tolère pas l'impayé)
    case 'invoice.payment_failed': {
      const inv = event.data.object
      if (inv.subscription) {
        const sub = await stripe.subscriptions.retrieve(inv.subscription as string)
        await syncSubscription(sub)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
