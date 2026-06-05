import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-server'
import { ownsArtisan } from '@/lib/auth'

export const runtime = 'nodejs'

// Portail Stripe : l'artisan gère son abonnement (moyen de paiement,
// renouvellement automatique, annulation) — recommandé par Stripe.
export async function POST(req: NextRequest) {
  const { artisan_id } = await req.json()
  if (!(await ownsArtisan(req, artisan_id))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: artisan } = await supabaseAdmin
    .from('artisans').select('id, stripe_customer_id').eq('id', artisan_id).single()
  if (!artisan?.stripe_customer_id) {
    return NextResponse.json({ error: 'Aucun abonnement' }, { status: 404 })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const session = await stripe.billingPortal.sessions.create({
    customer: artisan.stripe_customer_id,
    return_url: `${base}/dashboard/${artisan.id}`,
  })

  return NextResponse.json({ url: session.url })
}
