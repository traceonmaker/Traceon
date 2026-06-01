import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import twilio from 'twilio'

export const runtime = 'nodejs'

// Mot de passe initial lisible (envoyé par SMS) — l'artisan pourra le changer dans l'app
function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let p = ''
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p
}

// Création d'un nouvel artisan depuis l'onboarding (core app dupliquable)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const email = (body.email || '').trim().toLowerCase()

  // 1. Compte d'authentification (email + mot de passe généré), email confirmé d'office
  const password = genPassword()
  const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom: body.nom },
  })
  if (authErr && !/already|exists|registered/i.test(authErr.message)) {
    return NextResponse.json({ error: authErr.message }, { status: 500 })
  }
  if (authErr) {
    // L'email existe déjà → on invite à se connecter
    return NextResponse.json({ error: 'Cet email a déjà un compte. Connectez-vous.' }, { status: 409 })
  }

  // 2. Fiche artisan
  const { data, error } = await supabaseAdmin.from('artisans').insert({
    nom: body.nom,
    nom_entreprise: body.nom_entreprise,
    email,
    telephone: body.telephone,
    logo_url: body.logo_url || null,
    adresse_entreprise: body.adresse_entreprise || null,
    zone_intervention: body.zone_intervention || null,
    siret: body.siret || null,
    tva_applicable: body.tva_applicable ?? false,
    taux_tva: body.taux_tva ?? 20,
    types_chantier: body.types_chantier,
    prestations: body.prestations || [],
    horaires: body.horaires,
    modele_devis_url: body.modele_devis_url || null,
    conditions_paiement: body.conditions_paiement || null,
    mentions_legales: body.mentions_legales || null,
    cgv: body.cgv || null,
    rgpd: body.rgpd || null,
    onboarding_complet: true,
    abonnement_actif: false,
  }).select().single()

  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé. Connectez-vous.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 3. Envoi du mot de passe par SMS (best-effort — n'empêche pas la création)
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_PHONE_NUMBER
    const url = process.env.NEXT_PUBLIC_APP_URL || ''
    if (sid && token && from && body.telephone) {
      const client = twilio(sid, token)
      await client.messages.create({
        from,
        to: body.telephone,
        body: `TraceOn — votre espace est prêt.\nIdentifiant : ${email}\nMot de passe : ${password}\nConnexion : ${url}/login\n(Vous pourrez le modifier dans l'app.)`,
      })
    }
  } catch (e) {
    console.error('SMS mot de passe:', (e as any)?.message)
  }

  // password renvoyé une seule fois pour connexion automatique immédiate
  return NextResponse.json({ ...data, password }, { status: 201 })
}
