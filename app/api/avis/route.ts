import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { ownsArtisan } from '@/lib/auth'

export const runtime = 'nodejs'

// Liste des avis d'un artisan — réservé au propriétaire (vue "Mes avis")
export async function GET(req: NextRequest) {
  const artisanId = req.nextUrl.searchParams.get('artisan_id')
  if (!(await ownsArtisan(req, artisanId))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('avis').select('*').eq('artisan_id', artisanId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Dépôt d'un avis par le client (via le token de sa demande) — public
export async function POST(req: NextRequest) {
  const { token, note, commentaire } = await req.json()
  const n = Number(note)
  if (!token || !(n >= 1 && n <= 5)) {
    return NextResponse.json({ error: 'Avis invalide' }, { status: 400 })
  }

  // Retrouve la demande (donc l'artisan + le nom du client) à partir du token
  const { data: dem } = await supabaseAdmin
    .from('demandes').select('id, artisan_id, client_nom').eq('token', token).single()
  if (!dem) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  // Un seul avis par demande → upsert sur demande_id
  const { error } = await supabaseAdmin.from('avis').upsert({
    artisan_id: dem.artisan_id,
    demande_id: dem.id,
    client_nom: dem.client_nom,
    note: n,
    commentaire: (commentaire || '').slice(0, 500) || null,
    affiche: n >= 4,            // on met en avant les meilleurs avis sur le mini-site
    source: 'traceon',
  }, { onConflict: 'demande_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalcule la moyenne + le total pour l'artisan
  const { data: tous } = await supabaseAdmin
    .from('avis').select('note').eq('artisan_id', dem.artisan_id)
  const count = tous?.length || 0
  const moyenne = count ? Math.round((tous!.reduce((s, a) => s + a.note, 0) / count) * 10) / 10 : 0
  const { data: art } = await supabaseAdmin
    .from('artisans').update({ avis_moyenne: moyenne, avis_count: count })
    .eq('id', dem.artisan_id).select('nom_entreprise, google_avis_url').single()

  // Si le client est content, on l'invite à poster aussi sur Google (SEO de l'artisan)
  return NextResponse.json({
    ok: true, moyenne, count,
    entreprise: art?.nom_entreprise || '',
    google_avis_url: n >= 4 ? (art?.google_avis_url || null) : null,
  })
}
