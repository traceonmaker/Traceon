import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import twilio from 'twilio'

export const runtime = 'nodejs'

function xml(body = '') {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

// Fin de l'appel renvoyé : si l'artisan n'a pas décroché → SMS de rattrapage au client.
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const to = String(form.get('To') || '')                 // numéro TraceOn
  const caller = String(form.get('From') || '')            // client qui a appelé
  const status = String(form.get('DialCallStatus') || '')  // completed | no-answer | busy | failed

  const { data: artisan } = await supabaseAdmin
    .from('artisans').select('id, slug, nom_entreprise, nom').eq('numero_traceon', to).maybeSingle()

  const repondu = status === 'completed'
  if (artisan) {
    await supabaseAdmin.from('appels').insert({
      artisan_id: artisan.id,
      from_number: caller,
      statut: repondu ? 'repondu' : 'manque',
      sms_envoye: false,
    }).select().single().then(async ({ data }) => {
      // Appel manqué → on envoie le lien au client
      if (!repondu && caller) {
        const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN
        const from = process.env.TWILIO_PHONE_NUMBER
        const base = process.env.NEXT_PUBLIC_APP_URL || ''
        const ent = artisan.nom_entreprise || artisan.nom || 'votre artisan'
        const lien = `${base}/pro/${artisan.slug || artisan.id}`
        try {
          if (sid && tok && from) {
            await twilio(sid, tok).messages.create({
              from, to: caller,
              body: `Bonjour, ici ${ent}. Désolé, je n'ai pas pu répondre (sur un chantier). Décrivez votre besoin ici, je vous rappelle vite : ${lien}`,
            })
            if (data?.id) await supabaseAdmin.from('appels').update({ sms_envoye: true }).eq('id', data.id)
          }
        } catch (e) {
          console.error('SMS appel manqué:', (e as any)?.message)
        }
      }
    })
  }

  return xml()
}
