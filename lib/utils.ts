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
