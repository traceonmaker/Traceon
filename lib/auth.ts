import { supabaseAdmin } from './supabase-server'

// Compte démo — accès public (démonstrations commerciales)
const DEMO_ID = '69c771ad-cdd1-412b-9022-0aac616a7d34'

// Email de l'utilisateur authentifié (depuis le jeton Bearer), ou null
export async function authedEmail(req: Request): Promise<string | null> {
  const h = req.headers.get('authorization') || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user?.email) return null
  return data.user.email.toLowerCase()
}

// Le requérant est-il propriétaire de ce compte artisan ? (démo = ouvert)
export async function ownsArtisan(req: Request, artisanId: string | null): Promise<boolean> {
  if (!artisanId) return false
  if (artisanId === DEMO_ID) return true
  const email = await authedEmail(req)
  if (!email) return false
  const { data } = await supabaseAdmin.from('artisans').select('email').eq('id', artisanId).single()
  return !!data && (data.email || '').toLowerCase() === email
}

// Le requérant possède-t-il la demande (via l'artisan rattaché) ?
export async function ownsDemande(req: Request, demandeId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('demandes').select('artisan_id').eq('id', demandeId).single()
  if (!data) return false
  return ownsArtisan(req, data.artisan_id as string)
}
