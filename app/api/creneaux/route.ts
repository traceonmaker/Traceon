import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { demande_id, creneaux } = await req.json()

  const { data: demande } = await supabaseAdmin
    .from('demandes').select('client_nom, client_telephone, token, artisans(nom_entreprise, nom)')
    .eq('id', demande_id).single() as any

  if (!demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  const { data, error } = await supabaseAdmin.from('demandes').update({
    statut: 'creneau_propose',
    creneaux_proposes: creneaux
  }).eq('id', demande_id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const entreprise = demande.artisans?.nom_entreprise || demande.artisans?.nom
  const creneauxText = creneaux.map((c: any) => `${c.date} a ${c.heure_debut}`).join(' / ')

  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: demande.client_telephone,
      message: `${entreprise} vous propose ces creneaux : ${creneauxText}. Choisissez ici : ${process.env.NEXT_PUBLIC_APP_URL}/suivi/${demande.token}`
    })
  }).catch(() => {})

  return NextResponse.json(data)
}
