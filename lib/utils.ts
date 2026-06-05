export function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date(date))
}

export function formatHeure(heure: string) {
  return heure.replace(':', 'h')
}

export function formatPrix(prix: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(prix)
}

export function calculerPrixEstime(typeIntervention: string, envergure: string, types: any[]) {
  const type = types.find(t => t.type === typeIntervention)
  if (!type) return 0
  const multiplicateurs: Record<string, number> = { petit: 0.7, moyen: 1, grand: 1.5 }
  return Math.round(type.prix_base * (multiplicateurs[envergure] || 1))
}

// ── Validation & normalisation des données client ──
// Normalise un téléphone en E.164 (format requis par Twilio).
// Gère les saisies locales Antilles/France : 0696… → +596, 0690… → +590, 0X… → +33
export function normalizePhone(raw: string): string {
  let s = (raw || '').replace(/[\s.\-()]/g, '')
  if (!s) return ''
  if (s.startsWith('+')) return s
  if (s.startsWith('00')) return '+' + s.slice(2)
  if (/^0(696|697)/.test(s)) return '+596' + s.slice(1) // mobile Martinique
  if (/^0(690|691)/.test(s)) return '+590' + s.slice(1) // mobile Guadeloupe
  if (s.startsWith('0596')) return '+596' + s.slice(1)   // fixe Martinique
  if (s.startsWith('0590')) return '+590' + s.slice(1)   // fixe Guadeloupe
  if (s.startsWith('0')) return '+33' + s.slice(1)        // France métropole
  return s
}

export function isValidPhone(raw: string): boolean {
  return /^\+\d{8,15}$/.test(normalizePhone(raw))
}

// Valide une demande client. Retourne un message d'erreur, ou null si tout est bon.
export function validerDemande(f: { client_nom?: string; client_telephone?: string; client_adresse?: string }): string | null {
  if (!f.client_nom || f.client_nom.trim().length < 2) return 'Indiquez votre nom complet.'
  if (!isValidPhone(f.client_telephone || '')) return 'Numéro de téléphone invalide (ex : 0696 12 34 56).'
  if (!f.client_adresse || f.client_adresse.trim().length < 4) return "Indiquez l'adresse du chantier."
  return null
}

// Applique un modèle de message en remplaçant {variables} : {client}, {entreprise}, {lien}…
export function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), v ?? ''),
    tpl || ''
  )
}

// Transforme un nom d'entreprise en slug d'URL : "Plomberie Dillon" → "plomberie-dillon"
export function slugify(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'pro'
}

export function isToday(dateStr: string) {
  const today = new Date()
  const date = new Date(dateStr)
  return date.toDateString() === today.toDateString()
}

export function isTomorrow(dateStr: string) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const date = new Date(dateStr)
  return date.toDateString() === tomorrow.toDateString()
}

// ─────────────────────────────────────────────
// Moteur de suggestion de créneaux intelligent
// Analyse le planning (chantiers confirmés) + horaires + préférences
// pour proposer 3 créneaux libres cohérents.
// ─────────────────────────────────────────────

type Creneau = { date: string; heure_debut: string; heure_fin: string }
const JOURS_KEY = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']

function hToMin(h: string) { const [a,b] = h.split(':').map(Number); return a*60 + b }
function minToH(m: number) { const h = Math.floor(m/60), mm = m%60; return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}` }

export function suggererCreneaux(opts: {
  envergure: string
  typeIntervention: string
  confirmes: any[]          // demandes confirmées (avec date_chantier + creneau_accepte)
  horaires: any             // artisan.horaires
  typesChantier: any[]      // pour récupérer la durée
  preferences: any          // artisan.preferences_creneaux
  indisponibilites?: any[]  // créneaux bloqués {date, heure_debut, heure_fin}
  nb?: number
}): Creneau[] {
  const { envergure, typeIntervention, confirmes, horaires, typesChantier, preferences, indisponibilites = [], nb = 3 } = opts
  const type = typesChantier?.find(t => t.type === typeIntervention)
  const dureeMin = Math.max((type?.duree || 2) * 60, 60)
  const pref = (preferences?.[envergure] as string) || 'flexible' // matin | apres-midi | flexible

  const suggestions: Creneau[] = []
  const cursor = new Date(); cursor.setHours(0,0,0,0); cursor.setDate(cursor.getDate() + 1) // dès demain

  for (let i = 0; i < 21 && suggestions.length < nb; i++) {
    const jour = JOURS_KEY[cursor.getDay()]
    const h = horaires?.[jour]
    if (h?.actif) {
      const ouv = hToMin(h.debut), ferm = hToMin(h.fin)
      const jourStr = cursor.toISOString().split('T')[0]
      // créneaux déjà occupés ce jour (chantiers confirmés)
      const occupesChantiers = confirmes
        .filter(c => c.creneau_accepte && new Date(c.date_chantier).toDateString() === cursor.toDateString())
        .map(c => {
          const ct = typesChantier?.find(t => t.type === c.type_intervention)
          const deb = hToMin(c.creneau_accepte.heure_debut)
          return [deb, deb + (ct?.duree || 2) * 60] as [number, number]
        })
      // + indisponibilités bloquées ce jour
      const occupesIndispo = (indisponibilites || [])
        .filter((b: any) => b.date === jourStr)
        .map((b: any) => [hToMin(b.heure_debut), hToMin(b.heure_fin)] as [number, number])
      const occupes = [...occupesChantiers, ...occupesIndispo].sort((a,b) => a[0]-b[0])

      // fenêtre de recherche selon préférence
      let start = ouv, limit = ferm
      const midi = 12*60
      if (pref === 'matin')      limit = Math.min(ferm, midi + 60)
      if (pref === 'apres-midi') start = Math.max(ouv, midi + 60)

      // cherche le 1er trou libre assez grand
      let candidate = start
      for (const [oDeb, oFin] of occupes) {
        if (candidate + dureeMin <= oDeb) break          // trou avant ce chantier
        if (oFin > candidate) candidate = oFin            // décale après
      }
      if (candidate + dureeMin <= limit) {
        suggestions.push({
          date: cursor.toISOString().split('T')[0],
          heure_debut: minToH(candidate),
          heure_fin: minToH(candidate + dureeMin),
        })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return suggestions
}
