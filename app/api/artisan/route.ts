import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Création d'un nouvel artisan depuis l'onboarding (core app dupliquable)
export async function POST(req: NextRequest) {
  const body = await req.json()

  const { data, error } = await supabaseAdmin.from('artisans').insert({
    nom: body.nom,
    nom_entreprise: body.nom_entreprise,
    email: body.email,
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
