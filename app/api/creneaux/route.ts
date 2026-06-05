import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { ownsDemande } from '@/lib/auth'
import { applyTemplate } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const { demande_id, creneaux } = await req.json()
  if (!(await ownsDemande(req, demande_id))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: demande } = await supabaseAdmin
    .from('demandes').select('client_nom, client_telephone, token, artisans(nom_entreprise, nom, message_creneaux)')
    .eq('id', demande_id).single() as any

  if (!demande) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  const { data, error } = await supabaseAdmin.from('demandes').update({
    statut: 'creneau_propose',
    creneaux_proposes: creneaux,
    creneaux_envoyes_at: new Date().toISOString(),
    relance_envoyee: false,
  }).eq('id', demande_id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const entreprise = demande.artisans?.nom_entreprise || demande.artisans?.nom || 'votre artisan'
  const creneauxText = creneaux.map((c: any) => `${c.date} à ${c.heure_debut}`).join(' / ')
  const lien = `${process.env.NEXT_PUBLIC_APP_URL}/suivi/${demande.token}`
  const tpl = (demande.artisans?.message_creneaux || '').trim()
    || '{entreprise} vous propose ces créneaux : {creneaux}. Choisissez le vôtre ici : {lien}'

  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: demande.client_telephone,
      message: applyTemplate(tpl, { client: demande.client_nom, entreprise, creneaux: creneauxText, lien })
    })
  }).catch(() => {})

  return NextResponse.json(data)
}
