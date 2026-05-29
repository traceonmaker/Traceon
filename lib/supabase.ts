import { createClient } from '@supabase/supabase-js'

// Client-side only — variables NEXT_PUBLIC_
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Artisan = {
  id: string
  nom: string
  nom_entreprise: string
  email: string
  telephone: string
  logo_url: string | null
  types_chantier: TypeChantier[]
  horaires: Horaires
  abonnement_actif: boolean
  lien_formulaire: string | null
  // Variables métier étendues
  adresse_entreprise: string | null
  zone_intervention: string | null
  siret: string | null
  tva_applicable: boolean
  taux_tva: number
  prestations: Prestation[]
  modele_devis_url: string | null
  conditions_paiement: string | null
  mentions_legales: string | null
  cgv: string | null
  rgpd: string | null
  onboarding_complet: boolean
  preferences_creneaux: PreferencesCreneaux
  indisponibilites: Creneau[]
}

// Préférence de moment de la journée par envergure de chantier
export type PreferencesCreneaux = {
  grand: 'matin' | 'apres-midi' | 'flexible'
  moyen: 'matin' | 'apres-midi' | 'flexible'
  petit: 'matin' | 'apres-midi' | 'flexible'
}

export type Prestation = {
  service: string      // rattachée à un type de chantier
  libelle: string      // ex: "Remplacement robinet"
  prix: number
  unite: string        // ex: "forfait", "h", "m²", "ml"
}

export type TypeChantier = {
  type: string
  couleur: string
  duree: number
  prix_base: number
}

export type Horaires = {
  [jour: string]: { debut: string; fin: string; actif: boolean }
}

export type Demande = {
  id: string
  created_at: string
  artisan_id: string
  token: string
  statut: 'nouvelle' | 'devis_envoye' | 'creneau_propose' | 'confirme' | 'en_cours' | 'paye' | 'annule'
  client_nom: string
  client_telephone: string
  client_adresse: string
  client_description: string | null
  type_intervention: string
  envergure: 'petit' | 'moyen' | 'grand' | null
  prix_estime: number | null
  creneaux_proposes: Creneau[] | null
  creneau_accepte: Creneau | null
  date_confirmation: string | null
  date_chantier: string | null
  date_paiement: string | null
}

export type Creneau = {
  date: string
  heure_debut: string
  heure_fin: string
}
