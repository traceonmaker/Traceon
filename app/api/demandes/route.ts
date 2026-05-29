import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerPrixEstime } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const artisanId = req.nextUrl.searchParams.get('artisan_id')
  const statut = req.nextUrl.searchParams.get('statut')

  let query = supabaseAdmin.from('demandes').select('*').order('created_at', { ascending: false })
  if (artisanId) query = query.eq('artisan_id', artisanId)
  if (statut) query = query.eq('statut', statut)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { artisan_id, client_nom, client_telephone, client_adresse, client_description, type_intervention, envergure } = body

  const { data: artisan } = await supabaseAdmin
    .from('artisans').select('types_chantier, nom_entreprise, nom').eq('id', artisan_id).single()

  const prix_estime = artisan
    ? calculerPrixEstime(type_intervention, envergure, artisan.types_chantier)
    : 0

  const { data, error } = await supabaseAdmin.from('demandes').insert({
    artisan_id, client_nom, client_telephone, client_adresse,
    client_description, type_intervention, envergure, prix_estime,
    statut: 'nouvelle'
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: client_telephone,
      message: `Bonjour ${client_nom}, votre demande (${type_intervention}) a bien été reçue par ${artisan?.nom_entreprise || artisan?.nom}. Suivez votre intervention ici : ${process.env.NEXT_PUBLIC_APP_URL}/suivi/${data.token}`
    })
  }).catch(() => {})

  return NextResponse.json(data, { status: 201 })
}
