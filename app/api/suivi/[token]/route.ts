import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { data, error } = await supabaseAdmin
    .from('demandes').select('*, artisans(nom, nom_entreprise, telephone, types_chantier)')
    .eq('token', token).single()
  if (error) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { action, creneau } = await req.json()

  if (action === 'accepter_creneau') {
    const { data: demande } = await supabaseAdmin
      .from('demandes').select('client_nom, client_telephone, artisan_id, artisans(nom_entreprise, nom)')
      .eq('token', token).single() as any

    const { data, error } = await supabaseAdmin.from('demandes').update({
      statut: 'confirme',
      creneau_accepte: creneau,
      date_confirmation: new Date().toISOString(),
      date_chantier: new Date(`${creneau.date}T${creneau.heure_debut}`).toISOString()
    }).eq('token', token).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (demande) {
      const entreprise = demande.artisans?.nom_entreprise || demande.artisans?.nom
      const base = process.env.NEXT_PUBLIC_APP_URL
      await fetch(`${base}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: demande.client_telephone,
          message: `Intervention confirmee ! ${entreprise} interviendra le ${creneau.date} a ${creneau.heure_debut}. Votre devis : ${base}/api/devis/${token}`
        })
      }).catch(() => {})
    }
    return NextResponse.json(data)
  }

  if (action === 'aucun_creneau') {
    const { data, error } = await supabaseAdmin.from('demandes').update({
      statut: 'nouvelle', creneaux_proposes: null
    }).eq('token', token).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
