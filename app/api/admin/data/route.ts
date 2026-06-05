import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const PRIX_ABO = 250

// Tableau de bord admin (Noham) — protégé par une clé secrète (ADMIN_KEY).
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-admin-key')
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: artisans } = await supabaseAdmin
    .from('artisans')
    .select('id, nom, nom_entreprise, email, telephone, slug, created_at, abonnement_actif, abonnement_statut, avis_moyenne, avis_count')
    .order('created_at', { ascending: false })

  const { data: demandes } = await supabaseAdmin
    .from('demandes').select('artisan_id, statut, prix_estime, created_at, date_paiement')

  // Agrégats par artisan
  const parArtisan: Record<string, { total: number; payes: number; ca: number }> = {}
  for (const d of (demandes || [])) {
    const a = (parArtisan[d.artisan_id] ||= { total: 0, payes: 0, ca: 0 })
    a.total++
    if (d.statut === 'paye') { a.payes++; a.ca += d.prix_estime || 0 }
  }

  // Séries temporelles pour les mini-graphiques
  const now = new Date()
  const caParMois = Array.from({ length: 6 }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const ca = (demandes || []).filter(d => {
      if (d.statut !== 'paye') return false
      const dt = new Date(d.date_paiement || d.created_at)
      return dt.getFullYear() === m.getFullYear() && dt.getMonth() === m.getMonth()
    }).reduce((s, d) => s + (d.prix_estime || 0), 0)
    return { label: m.toLocaleDateString('fr-FR', { month: 'short' }), ca }
  })
  const demandesParJour = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - 13 + i)
    const n = (demandes || []).filter(d => new Date(d.created_at).toDateString() === day.toDateString()).length
    return n
  })

  const liste = (artisans || []).map(a => ({
    ...a,
    demandes: parArtisan[a.id]?.total || 0,
    payes: parArtisan[a.id]?.payes || 0,
    ca: parArtisan[a.id]?.ca || 0,
  }))

  const actifs = liste.filter(a => a.abonnement_statut === 'active').length
  const essais = liste.filter(a => a.abonnement_statut === 'trialing').length

  const stats = {
    artisans: liste.length,
    actifs,
    essais,
    payants: actifs,
    mrr: actifs * PRIX_ABO,
    demandes: demandes?.length || 0,
    demandes_payees: (demandes || []).filter(d => d.statut === 'paye').length,
  }

  return NextResponse.json({ stats, artisans: liste, caParMois, demandesParJour })
}
