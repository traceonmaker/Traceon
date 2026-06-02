import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { ownsArtisan } from '@/lib/auth'

export const runtime = 'nodejs'

// Ajout manuel d'un chantier par le patron (déjà confirmé) — réservé au propriétaire
export async function POST(req: NextRequest) {
  const b = await req.json()
  if (!(await ownsArtisan(req, b.artisan_id))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!b.client_nom || !b.type_intervention || !b.date) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const heure_debut = b.heure_debut || '08:00'
  const heure_fin = b.heure_fin || '12:00'

  const { data, error } = await supabaseAdmin.from('demandes').insert({
    artisan_id: b.artisan_id,
    client_nom: b.client_nom,
    client_telephone: b.client_telephone || '',
    client_adresse: b.client_adresse || '',
    client_description: b.client_description || null,
    type_intervention: b.type_intervention,
    envergure: b.envergure || 'moyen',
    prix_estime: Number(b.prix) || 0,
    statut: 'confirme',
    creneau_accepte: { date: b.date, heure_debut, heure_fin },
    date_chantier: new Date(`${b.date}T${heure_debut}:00`).toISOString(),
    date_confirmation: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
