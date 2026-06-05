import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { ownsDemande } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { demande_id } = await req.json()
  if (!(await ownsDemande(req, demande_id))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabaseAdmin.from('demandes').update({
    statut: 'paye',
    date_paiement: new Date().toISOString()
  }).eq('id', demande_id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Demande d'avis automatique au client (best-effort — n'impacte pas la réponse)
  try {
    if (data?.client_telephone && data?.token) {
      const { data: art } = await supabaseAdmin
        .from('artisans').select('nom_entreprise, nom').eq('id', data.artisan_id).single()
      const ent = art?.nom_entreprise || art?.nom || 'votre artisan'
      const url = process.env.NEXT_PUBLIC_APP_URL || ''
      await fetch(`${url}/api/sms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: data.client_telephone,
          message: `Merci d'avoir fait appel à ${ent} ! Votre avis compte : notez votre intervention en 10s ici ${url}/avis/${data.token}`,
        }),
      }).catch(() => {})
    }
  } catch {}

  return NextResponse.json(data)
}

