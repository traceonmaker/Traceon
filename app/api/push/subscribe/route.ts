import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { ownsArtisan } from '@/lib/auth'

export const runtime = 'nodejs'

// Enregistre une souscription push pour l'artisan (un appareil = une souscription)
export async function POST(req: NextRequest) {
  const { artisan_id, subscription } = await req.json()
  if (!(await ownsArtisan(req, artisan_id))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Souscription invalide' }, { status: 400 })

  const { data: artisan } = await supabaseAdmin
    .from('artisans').select('push_subscriptions').eq('id', artisan_id).single()

  const current: any[] = (artisan as any)?.push_subscriptions || []
  // dédoublonnage par endpoint
  const next = [...current.filter((s) => s.endpoint !== subscription.endpoint), subscription]

  const { error } = await supabaseAdmin
    .from('artisans').update({ push_subscriptions: next }).eq('id', artisan_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
