import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Twilio Voice — appel entrant sur le numéro TraceOn d'un artisan.
// On renvoie l'appel vers son vrai téléphone ; s'il ne décroche pas,
// /api/voice/status enverra un SMS au client avec le lien de demande.
function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const to = String(form.get('To') || '')      // numéro TraceOn appelé
  const base = process.env.NEXT_PUBLIC_APP_URL || ''

  const { data: artisan } = await supabaseAdmin
    .from('artisans').select('id, telephone').eq('numero_traceon', to).maybeSingle()

  if (!artisan?.telephone) {
    return xml(`<Say language="fr-FR">Bonjour. Ce numéro n'est pas disponible pour le moment.</Say>`)
  }

  // Renvoi vers l'artisan ; action appelée à la fin de l'appel (pour détecter le non-décroché)
  const action = `${base}/api/voice/status`
  return xml(
    `<Dial timeout="18" action="${action}" method="POST" callerId="${to}">` +
    `<Number>${artisan.telephone}</Number></Dial>`
  )
}
