import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculerPrixEstime, validerDemande, normalizePhone, applyTemplate } from '@/lib/utils'
import { ownsArtisan } from '@/lib/auth'
import { sendPush } from '@/lib/push'

export async function GET(req: NextRequest) {
  const artisanId = req.nextUrl.searchParams.get('artisan_id')
  const statut = req.nextUrl.searchParams.get('statut')

  // Les demandes contiennent des données client (PII) → réservé au propriétaire
  if (!(await ownsArtisan(req, artisanId))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let query = supabaseAdmin.from('demandes').select('*').order('created_at', { ascending: false })
  if (artisanId) query = query.eq('artisan_id', artisanId)
  if (statut) query = query.eq('statut', statut)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { artisan_id, client_nom, client_adresse, client_description, type_intervention, envergure } = body

  // Anti-bot : le honeypot doit rester vide (les robots le remplissent)
  if (body.hp) return NextResponse.json({ token: 'ok' }, { status: 201 })

  // Validation serveur (défense en profondeur) + normalisation du téléphone
  const erreur = validerDemande(body)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  const client_telephone = normalizePhone(body.client_telephone)

  // Anti-doublon / anti-flood : même artisan + même numéro dans les 60 dernières secondes → on ignore
  const ilya60s = new Date(Date.now() - 60_000).toISOString()
  const { data: recent } = await supabaseAdmin
    .from('demandes').select('id, token')
    .eq('artisan_id', artisan_id).eq('client_telephone', client_telephone)
    .gte('created_at', ilya60s).limit(1).maybeSingle()
  if (recent) return NextResponse.json({ token: recent.token }, { status: 200 })

  const { data: artisan } = await supabaseAdmin
    .from('artisans').select('types_chantier, nom_entreprise, nom, message_confirmation').eq('id', artisan_id).single()

  const prix_estime = artisan
    ? calculerPrixEstime(type_intervention, envergure, artisan.types_chantier)
    : 0

  const { data, error } = await supabaseAdmin.from('demandes').insert({
    artisan_id, client_nom, client_telephone, client_adresse,
    client_description, type_intervention, envergure, prix_estime,
    statut: 'nouvelle'
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notification push à l'artisan : la demande tombe sur son téléphone (best-effort, indépendant)
  try {
    const { data: aPush } = await supabaseAdmin
      .from('artisans').select('push_subscriptions').eq('id', artisan_id).single()
    const subs = (aPush as any)?.push_subscriptions || []
    if (subs.length) {
      const dead = await sendPush(subs, {
        title: 'Nouvelle demande 🎯',
        body: `${client_nom} · ${type_intervention}${prix_estime ? ` · ${Math.round(prix_estime)} €` : ''}`,
        url: `/dashboard/${artisan_id}`,
        tag: 'demande',
      })
      if (dead.length) {
        const clean = subs.filter((s: any) => !dead.includes(s.endpoint))
        await supabaseAdmin.from('artisans').update({ push_subscriptions: clean }).eq('id', artisan_id)
      }
    }
  } catch {}

  const ent = artisan?.nom_entreprise || artisan?.nom || 'votre artisan'
  const lien = `${process.env.NEXT_PUBLIC_APP_URL}/suivi/${data.token}`
  const tpl = (artisan?.message_confirmation || '').trim()
    || 'Bonjour {client}, votre demande ({type}) a bien été reçue par {entreprise}. Suivez votre intervention ici : {lien}'
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: client_telephone,
      message: applyTemplate(tpl, { client: client_nom, type: type_intervention, entreprise: ent, lien })
    })
  }).catch(() => {})

  return NextResponse.json(data, { status: 201 })
}
