import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Compte démo uniquement — réinitialise un jeu de données réaliste pour s'entraîner
const DEMO_ID = '69c771ad-cdd1-412b-9022-0aac616a7d34'

function d(offset: number) {
  const x = new Date(); x.setDate(x.getDate() + offset)
  return x.toISOString().split('T')[0]
}
function ts(offset: number, heure: string) {
  return new Date(`${d(offset)}T${heure}:00`).toISOString()
}

export async function GET() {
  // On repart propre
  await supabaseAdmin.from('demandes').delete().eq('artisan_id', DEMO_ID)

  const rows = [
    // ── 5 nouvelles demandes à traiter (pour s'entraîner à proposer des créneaux) ──
    { client_nom:'Marie-Claire Hortense', client_telephone:'+596696112233', client_adresse:'12 quartier Dillon, Fort-de-France', client_description:'Fuite sous l’évier de la cuisine', type_intervention:'Plomberie', envergure:'moyen', prix_estime:150, statut:'nouvelle' },
    { client_nom:'Kevin Adelaide', client_telephone:'+596696334455', client_adresse:'30 rue de la République, Le Lamentin', client_description:'Tableau électrique à remettre aux normes', type_intervention:'Électricité', envergure:'grand', prix_estime:300, statut:'nouvelle' },
    { client_nom:'Sophie Nestor', client_telephone:'+596696667788', client_adresse:'5 impasse des Manguiers, Ducos', client_description:'Installation climatisation chambre', type_intervention:'Climatisation', envergure:'moyen', prix_estime:300, statut:'nouvelle' },
    { client_nom:'Thierry Boulogne', client_telephone:'+596696990011', client_adresse:'18 rue Lamartine, Sainte-Marie', client_description:null, type_intervention:'Peinture', envergure:'grand', prix_estime:375, statut:'nouvelle' },
    { client_nom:'Nadège Sylvestre', client_telephone:'+596696445500', client_adresse:'9 lotissement Bellevue, Saint-Joseph', client_description:'Petit mur à monter dans le jardin', type_intervention:'Maçonnerie', envergure:'petit', prix_estime:280, statut:'nouvelle' },

    // ── 2 chantiers confirmés (pour s'entraîner au bouton Validé) ──
    { client_nom:'Jean-Marc Leotin', client_telephone:'+596696445566', client_adresse:'45 rue Schoelcher, Le Lamentin', client_description:null, type_intervention:'Électricité', envergure:'moyen', prix_estime:200, statut:'confirme', creneau_accepte:{date:d(0),heure_debut:'09:00',heure_fin:'12:00'}, date_chantier:ts(0,'09:00'), date_confirmation:new Date().toISOString() },
    { client_nom:'Stéphane Marie-Sainte', client_telephone:'+596696778899', client_adresse:'8 lotissement Ozanam, Schoelcher', client_description:null, type_intervention:'Climatisation', envergure:'grand', prix_estime:450, statut:'confirme', creneau_accepte:{date:d(1),heure_debut:'08:00',heure_fin:'15:00'}, date_chantier:ts(1,'08:00'), date_confirmation:new Date().toISOString() },

    // ── 3 chantiers payés (historique + stats) ──
    { client_nom:'Patricia Edouard', client_telephone:'+596696223344', client_adresse:'22 rue Victor Hugo, Rivière-Salée', client_description:null, type_intervention:'Peinture', envergure:'moyen', prix_estime:250, statut:'paye', creneau_accepte:{date:d(-3),heure_debut:'08:00',heure_fin:'12:00'}, date_chantier:ts(-3,'08:00'), date_confirmation:new Date().toISOString(), date_paiement:new Date().toISOString() },
    { client_nom:'Daniel Capgras', client_telephone:'+596696556677', client_adresse:'3 chemin Desbrosses, Le Robert', client_description:null, type_intervention:'Plomberie', envergure:'petit', prix_estime:105, statut:'paye', creneau_accepte:{date:d(-8),heure_debut:'14:00',heure_fin:'16:00'}, date_chantier:ts(-8,'14:00'), date_confirmation:new Date().toISOString(), date_paiement:new Date().toISOString() },
    { client_nom:'Lucie Bellune', client_telephone:'+596696889900', client_adresse:'17 avenue des Caraïbes, Le Diamant', client_description:null, type_intervention:'Maçonnerie', envergure:'grand', prix_estime:600, statut:'paye', creneau_accepte:{date:d(-15),heure_debut:'08:00',heure_fin:'17:00'}, date_chantier:ts(-15,'08:00'), date_confirmation:new Date().toISOString(), date_paiement:new Date().toISOString() },
  ].map(r => ({ ...r, artisan_id: DEMO_ID }))

  const { error } = await supabaseAdmin.from('demandes').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    message: 'Démo réinitialisée',
    a_traiter: 5,
    confirmes: 2,
    payes: 3,
    dashboard: `/dashboard/${DEMO_ID}`,
  })
}
