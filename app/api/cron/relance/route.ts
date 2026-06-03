import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import twilio from 'twilio'

export const runtime = 'nodejs'

// Délai d'éligibilité (heures) après l'envoi des créneaux avant de relancer
const DELAY_H = Number(process.env.RELANCE_DELAY_H || 2)

// Relance automatique des clients sans réponse — déclenché par Vercel Cron (1×/jour sur Hobby)
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const seuil = new Date(Date.now() - DELAY_H * 3600 * 1000).toISOString()
  const { data: demandes } = await supabaseAdmin
    .from('demandes')
    .select('id, client_nom, client_telephone, token, type_intervention, artisans(nom_entreprise, nom)')
    .eq('statut', 'creneau_propose')
    .eq('relance_envoyee', false)
    .not('creneaux_envoyes_at', 'is', null)
    .lt('creneaux_envoyes_at', seuil) as any

  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_PHONE_NUMBER
  const url = process.env.NEXT_PUBLIC_APP_URL || ''
  const client = sid && tok ? twilio(sid, tok) : null

  let sent = 0
  for (const d of (demandes || [])) {
    if (!d.client_telephone) continue
    const ent = d.artisans?.nom_entreprise || d.artisans?.nom || 'votre artisan'
    try {
      if (client && from) {
        await client.messages.create({
          from,
          to: d.client_telephone,
          body: `Bonjour ${d.client_nom}, avez-vous choisi un créneau pour votre ${d.type_intervention} avec ${ent} ? Réservez ici : ${url}/suivi/${d.token}`,
        })
      }
      await supabaseAdmin.from('demandes').update({ relance_envoyee: true }).eq('id', d.id)
      sent++
    } catch (e) {
      console.error('relance err', d.id, (e as any)?.message)
    }
  }
  return NextResponse.json({ ok: true, relances: sent })
}
