'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDate, formatHeure, isToday, isTomorrow, suggererCreneaux } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import LaunchIntro from '@/app/components/LaunchIntro'
import type { Demande, Artisan, TypeChantier, Prestation } from '@/lib/supabase'

// Compte démo — accessible sans connexion (pour les démonstrations commerciales)
const DEMO_ID = '69c771ad-cdd1-412b-9022-0aac616a7d34'
import {
  Home, CalendarDays, Clock, BarChart3, Settings, Phone, MapPin, Check,
  Link2, Plus, Trash2, Droplet, Zap, Snowflake, Hammer, Paintbrush, Wrench,
  ChevronLeft, ChevronRight, TrendingUp, Save, Upload, Copy,
  Euro, Briefcase, Receipt, Percent, FileText, Download, Sun, Moon, Monitor, BellRing, RotateCcw, Star
} from 'lucide-react'
import InstallPrompt from '@/app/components/InstallPrompt'
import PushSetup from '@/app/components/PushSetup'
import PushBanner from '@/app/components/PushBanner'
import { TraceOnMark } from '@/app/components/Logo'

type Tab = 'accueil'|'planning'|'bilan'|'parametres'
const TABS: Tab[] = ['accueil','planning','bilan','parametres']

// Sélecteur de jour (modal créneaux) : on montre la semaine en cours + au-delà,
// déroulant sur 4 semaines, centré par défaut sur les prochains jours.
const JOURS_VISIBLES = 28

const SVC: Record<string,{Icon:any;color:string}> = {
  'Plomberie':     { Icon:Droplet,   color:'#2563eb' },
  'Électricité':   { Icon:Zap,       color:'#d97706' },
  'Climatisation': { Icon:Snowflake, color:'#0891b2' },
  'Maçonnerie':    { Icon:Hammer,    color:'#dc2626' },
  'Peinture':      { Icon:Paintbrush,color:'#7c3aed' },
  'Autre':         { Icon:Wrench,    color:'#64748b' },
}
const svc = (t:string) => SVC[t] || SVC['Autre']

// Retour haptique léger (PWA) — rend chaque action "physique"
const haptic = (ms:number|number[]=10) => { try { (navigator as any).vibrate?.(ms) } catch {} }

// Montant en euros, sans centimes (plus net — réflexe Jobs)
const eur = (n:number) => new Intl.NumberFormat('fr-FR',{ maximumFractionDigits:0 }).format(Math.round(n||0)) + ' €'

// fetch authentifié : joint le jeton de session (les routes sensibles le vérifient)
async function authedFetch(input: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string,string> = { ...(init.headers as Record<string,string> || {}) }
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  return fetch(input, { ...init, headers })
}

// Prochain rendez-vous (chantier confirmé le plus proche, encore à venir)
function prochainRDV(confirmes: Demande[]): Demande | null {
  const now = Date.now()
  const items = confirmes
    .filter(d => d.creneau_accepte?.date || d.date_chantier)
    .map(d => {
      const c = d.creneau_accepte
      const iso = c ? `${c.date}T${c.heure_debut || '08:00'}` : (d.date_chantier as string)
      return { d, t: new Date(iso).getTime() }
    })
    .filter(x => !isNaN(x.t) && x.t >= now - 2*3600*1000)
    .sort((a,b) => a.t - b.t)
  return items[0]?.d || null
}
function whenLabel(d: Demande): string {
  const c = d.creneau_accepte
  const dateStr = (c?.date || d.date_chantier) as string
  const heure = c?.heure_debut ? formatHeure(c.heure_debut) : ''
  const j = isToday(dateStr) ? 'Auj.' : isTomorrow(dateStr) ? 'Dem.' : new Date(dateStr).toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','')
  return heure ? `${j} ${heure}` : j
}

// Libellé humain d'un créneau pour l'artisan : "Demain · 14h–18h" (lecture instantanée,
// au lieu de la date brute à slashes — celle-ci reste dans le récap envoyé au client)
function creneauLisible(date: string, hd?: string, hf?: string): string {
  if (!date) return 'Choisir un jour'
  const j = isToday(date) ? "Aujourd'hui" : isTomorrow(date) ? 'Demain'
    : new Date(date + 'T00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })
  const jc = j.charAt(0).toUpperCase() + j.slice(1)
  const h = hd ? ` · ${formatHeure(hd)}${hf ? '–' + formatHeure(hf) : ''}` : ''
  return jc + h
}

// Thème clair / sombre / système
type Theme = 'system'|'light'|'dark'
const getTheme = (): Theme => { try { return (localStorage.getItem('traceon-theme') as Theme) || 'system' } catch { return 'system' } }
const applyTheme = (t: Theme) => {
  try { localStorage.setItem('traceon-theme', t) } catch {}
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const el = document.documentElement
  // Neutralise les transitions le temps du basculement → switch net, sans lag
  el.classList.add('theme-switching')
  el.setAttribute('data-theme', dark ? 'dark' : 'light')
  el.style.colorScheme = dark ? 'dark' : 'light'
  // Force un reflow puis réactive les transitions au frame suivant
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('theme-switching')))
}

// Salutation selon l'heure
function salutation() {
  const h = new Date().getHours()
  if (h < 6)  return 'Bonne nuit'
  if (h < 18) return 'Bonjour'
  return 'Bonsoir'
}

// Montant avec décimales atténuées (réflexe fintech)
function MontantHero({ value }: { value:number }) {
  const s = eur(value)
  const i = s.indexOf(',')
  if (i === -1) return <span className="amount-hero" style={{fontSize:46,lineHeight:1}}>{s}</span>
  return (
    <span className="amount-hero" style={{fontSize:46,lineHeight:1}}>
      {s.slice(0,i)}<span style={{fontSize:'0.56em',opacity:0.6,fontWeight:700}}>{s.slice(i)}</span>
    </span>
  )
}


// Pliage repliable qui se MÉMORISE (survit aux changements d'onglet / rechargements)
function useCollapse(key: string, defaultOpen: boolean) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultOpen
    try { const v = localStorage.getItem('traceon-open-' + key); return v === null ? defaultOpen : v === '1' } catch { return defaultOpen }
  })
  const toggle = () => setOpen(o => {
    const n = !o
    try { localStorage.setItem('traceon-open-' + key, n ? '1' : '0') } catch {}
    return n
  })
  return [open, toggle] as const
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('accueil')
  const [dir, setDir] = useState(1)
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [avis, setAvis] = useState<any[]>([])
  const [artisan, setArtisan] = useState<Artisan|null>(null)
  const [loading, setLoading] = useState(true)
  const [validating] = useState<string|null>(null)
  const [removing, setRemoving] = useState<string|null>(null)
  const [modal, setModal] = useState<Demande|null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [toast, setToast] = useState<{msg:string; action?:{label:string; fn:()=>void}}|null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [authed, setAuthed] = useState<boolean|null>(null)
  const [showIntro, setShowIntro] = useState(false)
  const undoRef = useRef<{id:string; timer:any}|null>(null)
  const router = useRouter()

  const { artisanId } = useParams<{ artisanId:string }>()
  const isDemo = artisanId === DEMO_ID
  // Premier lancement : animation de déblocage + plongée dans l'univers TraceOn
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('welcome') === '1') {
      setShowIntro(true)
      window.history.replaceState({}, '', `/dashboard/${artisanId}`)
    }
  }, [artisanId])
  useEffect(() => {
    async function init() {
      const isDemo = artisanId === DEMO_ID
      // Garde d'accès : hors démo, il faut être connecté ET propriétaire du compte
      let sessionEmail: string | null = null
      if (!isDemo) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.email) { router.replace('/login'); return }
        sessionEmail = session.user.email.toLowerCase()
      }
      // Au retour du paiement Stripe, on réconcilie l'abonnement avant de charger
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('abonnement') === 'ok') {
        await fetch('/api/stripe/sync', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ artisan_id: artisanId }) }).catch(()=>{})
        window.history.replaceState({}, '', `/dashboard/${artisanId}`)
      }
      const r = await authedFetch(`/api/artisan/${artisanId}`)
      const d = await r.json()
      if (!d?.id) { setAuthed(true); return } // affichera l'écran "créer un compte"
      if (!isDemo && d.email?.toLowerCase() !== sessionEmail) { router.replace('/login'); return }
      setArtisan(d); setAuthed(true)
    }
    init()
  }, [artisanId, router])

  const load = useCallback(async () => {
    if (!artisan?.id) return
    try {
      const r = await authedFetch(`/api/demandes?artisan_id=${artisan.id}`)
      if (!r.ok) throw new Error()
      setDemandes(await r.json())
      // Avis (best-effort, n'empêche rien si ça échoue)
      authedFetch(`/api/avis?artisan_id=${artisan.id}`).then(async rr => { if (rr.ok) setAvis(await rr.json()) }).catch(()=>{})
    } catch {
      setToast(s => s || { msg:'Connexion impossible' })
    } finally {
      setLoading(false)
    }
  }, [artisan?.id])
  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])
  // toasts de confirmation (sans action) → disparaissent seuls
  useEffect(() => { if (toast && !toast.action) { const t = setTimeout(()=>setToast(null), 2600); return ()=>clearTimeout(t) } }, [toast])

  const nouvelles  = demandes.filter(d => ['nouvelle','devis_envoye','creneau_propose'].includes(d.statut)).sort((a,b)=> new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const confirmes  = demandes.filter(d => ['confirme','en_cours'].includes(d.statut)).sort((a,b)=>new Date(a.date_chantier||0).getTime()-new Date(b.date_chantier||0).getTime())
  const payes      = demandes.filter(d => d.statut === 'paye')
  const potentiel  = confirmes.reduce((s,d)=>s+(d.prix_estime||0),0)
  const encaisse   = payes.reduce((s,d)=>s+(d.prix_estime||0),0)
  // Mise à jour optimiste : pendant la fenêtre d'annulation, le cash inclut déjà le chantier validé
  const pendingPay = removing ? demandes.find(d=>d.id===removing && d.statut!=='paye') : null
  const encaisseAffiche = encaisse + (pendingPay?.prix_estime || 0)

  function valider(id: string) {
    haptic([12,40,16])
    // Animation de sortie immédiate (feel instantané) + fenêtre d'annulation de 4s façon Gmail
    setRemoving(id)
    const timer = setTimeout(async () => {
      undoRef.current = null
      try {
        const r = await authedFetch('/api/valider', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({demande_id:id}) })
        if (!r.ok) throw new Error()
        await load(); setRemoving(null)
        haptic([10,30,12]); setToast({ msg:'Chantier encaissé' })
      } catch {
        setRemoving(null); setToast({ msg:'Connexion impossible, réessaie' })
      }
    }, 4000)
    undoRef.current = { id, timer }
    setToast({ msg:'Chantier encaissé', action:{ label:'Annuler', fn:()=>{
      if (undoRef.current) { clearTimeout(undoRef.current.timer); undoRef.current = null }
      setRemoving(null); setToast(null); haptic(8)
    }}})
  }
  async function proposer(id: string, creneaux: any[]) {
    haptic(12)
    try {
      const r = await authedFetch('/api/creneaux', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({demande_id:id, creneaux}) })
      if (!r.ok) throw new Error()
      setModal(null); await load()
      setToast({ msg:'Créneaux envoyés au client' })
    } catch {
      setToast({ msg:'Envoi impossible, réessaie' })
    }
  }
  async function saveArtisan(fields: Partial<Artisan>) {
    try {
      const r = await authedFetch(`/api/artisan/${artisan!.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(fields) })
      if (!r.ok) throw new Error()
      setArtisan(await r.json())
    } catch {
      setToast({ msg:'Enregistrement impossible' })
    }
  }
  async function ajouterChantier(payload: any): Promise<boolean> {
    try {
      const r = await authedFetch('/api/chantier', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ artisan_id: artisan!.id, ...payload }) })
      if (!r.ok) throw new Error()
      setAddOpen(false); haptic(12); await load()
      setToast({ msg:'Chantier ajouté' })
      return true
    } catch {
      setToast({ msg:'Ajout impossible, réessaie' })
      return false
    }
  }
  async function supprimer(id: string) {
    try {
      const r = await authedFetch(`/api/demandes/${id}`, { method:'DELETE' })
      if (!r.ok) throw new Error()
      haptic(12); await load(); setToast({ msg:'Chantier supprimé' })
    } catch {
      setToast({ msg:'Suppression impossible' })
    }
  }
  function copyLink() {
    // Lien à diffuser partout (bio Insta, WhatsApp, camion) → mini-site vitrine + bouton devis
    const slug = (artisan as any)!.slug || artisan!.id
    navigator.clipboard.writeText(`${window.location.origin}/pro/${slug}`)
    setLinkCopied(true); haptic(8); setToast({ msg:'Lien de votre site copié' })
    setTimeout(()=>setLinkCopied(false),1600)
  }
  async function resetDemo() {
    haptic(8)
    await fetch('/api/demo/reset').catch(()=>{})
    await load()
    setToast({ msg:'Démo réinitialisée' })
  }

  if (authed === null || (artisan && loading)) return (
    <div style={{minHeight:'100vh',background:'var(--bg-grad)'}}>
      <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:18}}>
          <div className="skel" style={{width:40,height:40,borderRadius:13}} />
          <div style={{flex:1}}><div className="skel" style={{width:80,height:10,marginBottom:7}} /><div className="skel" style={{width:140,height:14}} /></div>
        </div>
        <div className="skel" style={{height:168,borderRadius:22,marginBottom:18}} />
        <div className="skel" style={{width:120,height:18,marginBottom:14}} />
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div className="skel" style={{height:128,borderRadius:20}} />
          <div className="skel" style={{height:128,borderRadius:20}} />
        </div>
      </div>
    </div>
  )

  if (!artisan) return (
    <div style={{minHeight:'100vh',background:'var(--bg-grad)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}>
      <div style={{width:64,height:64,borderRadius:18,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:18,boxShadow:'var(--shadow)',border:'1px solid var(--border)'}}><TraceOnMark size={36} /></div>
      <p style={{fontSize:18,fontWeight:700,marginBottom:6}}>Bienvenue sur TraceOn</p>
      <p style={{fontSize:14,color:'var(--text2)',marginBottom:24}}>Créez votre compte artisan</p>
      <a href="/onboarding" className="btn-primary" style={{width:'auto',padding:'12px 24px',textDecoration:'none'}}>Créer mon compte</a>
    </div>
  )

  // Paywall : accès bloqué tant que l'abonnement n'est pas actif
  if (!artisan.abonnement_actif) return <Paywall artisan={artisan} />

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-grad)',position:'relative'}}>
      {showIntro && <LaunchIntro onDone={()=>setShowIntro(false)} nom={artisan.nom_entreprise || artisan.nom} />}
      <div className="app-glow" />
      <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px calc(124px + env(safe-area-inset-bottom))',position:'relative',zIndex:1}}>

        {/* Top bar */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
          <div style={{display:'flex',alignItems:'center',gap:11}}>
            <div style={{width:40,height:40,borderRadius:13,background:'linear-gradient(135deg,#2a63de,#1550cf)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:'#fff',boxShadow:'var(--shadow-blue)'}}>
              {(artisan.nom_entreprise||artisan.nom||'T')[0].toUpperCase()}
            </div>
            <div>
              <p style={{fontSize:11,color:'var(--text3)'}}>{salutation()}</p>
              <p style={{fontSize:15,fontWeight:700,letterSpacing:'-0.02em'}}>{artisan.nom_entreprise||artisan.nom}</p>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {isDemo && <button onClick={resetDemo} className="fab" style={{width:40,height:40}} title="Réinitialiser la démo" aria-label="Réinitialiser la démo"><RotateCcw size={16} /></button>}
            <button
              onClick={copyLink}
              className="fab" style={{width:'auto',padding:'0 14px',gap:7,fontSize:13,fontWeight:600}} title="Copier le lien de votre site (à mettre partout)">
              {linkCopied ? <><Check size={16} color="var(--green)"/>Copié</> : <><Link2 size={16}/>Mon site</>}
            </button>
          </div>
        </div>

        {!isDemo && tab==='accueil' && <PushBanner artisanId={artisan.id} />}

        <div key={tab} className={`tab-pane ${dir>0?'fwd':'back'}`}>
          {tab==='accueil'     && <Accueil nouvelles={nouvelles} encaisse={encaisseAffiche} potentiel={potentiel} confirmes={confirmes} valider={valider} validating={validating} removing={removing} onCreneaux={setModal} onShare={copyLink} onSupprimer={supprimer} objectif={artisan.objectif_mensuel ?? 5000} />}
          {tab==='planning'    && <Planning confirmes={confirmes} artisan={artisan} save={saveArtisan} />}
          {tab==='bilan'       && <Bilan payes={payes} demandes={demandes} encaisse={encaisse} avis={avis} />}
          {tab==='parametres'  && <Parametres artisan={artisan} save={saveArtisan} />}
        </div>
      </div>

      <nav className="bottom-nav">
        {([
          { k:'accueil',    Icon:Home,        l:'Accueil',  n:nouvelles.length },
          { k:'planning',   Icon:CalendarDays,l:'Planning', n:0 },
          { k:'bilan',      Icon:BarChart3,   l:'Bilan',    n:0 },
          { k:'parametres', Icon:Settings,    l:'Réglages', n:0 },
        ] as const).map(t => {
          const on = tab===t.k
          return (
            <button key={t.k} onClick={()=>{ setDir(TABS.indexOf(t.k) >= TABS.indexOf(tab) ? 1 : -1); haptic(6); setTab(t.k) }} className={`nav-item ${on?'on':''}`}>
              <div className="nav-ico">
                <t.Icon size={21} color={on?'#fff':'#94a3b8'} strokeWidth={on?2.5:2} />
                {t.n>0 && <span style={{position:'absolute',top:-2,right:1,background:'#fff',color:'#0c1424',fontSize:9.5,fontWeight:800,minWidth:16,height:16,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px',border:'1.5px solid var(--border2)',boxShadow:'0 1px 3px rgba(0,0,0,0.18)'}}>{t.n}</span>}
              </div>
              <span>{t.l}</span>
            </button>
          )
        })}
      </nav>

      {modal && <ModalCreneaux d={modal} artisan={artisan} confirmes={confirmes} onClose={()=>setModal(null)} onProposer={proposer} />}
      {addOpen && <ModalAjout artisan={artisan} onClose={()=>setAddOpen(false)} onAjouter={ajouterChantier} />}

      {(tab==='accueil' || tab==='planning') && (
        <button onClick={()=>{ haptic(8); setAddOpen(true) }} aria-label="Ajouter un chantier"
          style={{position:'fixed',right:18,bottom:'calc(86px + env(safe-area-inset-bottom))',zIndex:45,width:56,height:56,borderRadius:18,border:'none',cursor:'pointer',
            background:'linear-gradient(180deg,#2a6af0,#1551d0)',color:'#fff',
            boxShadow:'0 1px 0 rgba(255,255,255,0.25) inset, 0 8px 22px rgba(21,80,207,0.42)',
            display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {toast && (
        <div className="toast-wrap">
          <div className="toast">
            <span className="t-ic"><Check size={14} color="#fff" strokeWidth={3} /></span>
            <span className="t-msg">{toast.msg}</span>
            {toast.action && <button onClick={toast.action.fn}>{toast.action.label}</button>}
          </div>
        </div>
      )}
      <InstallPrompt />
    </div>
  )
}

/* ───────── PAYWALL ───────── */
function Paywall({ artisan }: { artisan:Artisan }) {
  const [loading, setLoading] = useState(false)
  async function abonner() {
    setLoading(true)
    const r = await fetch('/api/stripe/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ artisan_id: artisan.id }) })
    const d = await r.json()
    if (d.url) window.location.href = d.url
    else setLoading(false)
  }
  const avantages = [
    'Chaque demande sur votre téléphone, en temps réel',
    'Clients confirmés et relancés par SMS, automatiquement',
    'Planning & créneaux intelligents',
    'Devis pro + suivi de vos encaissements',
  ]
  return (
    <div style={{minHeight:'100vh',background:'var(--bg-grad)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div className="card a-scaleIn" style={{maxWidth:400,width:'100%',padding:'28px 24px',textAlign:'center'}}>
        <div style={{width:56,height:56,borderRadius:16,background:'linear-gradient(135deg,#2a63de,#1550cf)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'var(--shadow-blue)'}}>
          <BellRing size={26} color="#fff" />
        </div>
        <h1 style={{fontSize:23,fontWeight:800,letterSpacing:'-0.03em',marginBottom:6,lineHeight:1.15}}>Ne perdez plus un seul chantier</h1>
        <p style={{fontSize:14,color:'var(--text2)',marginBottom:18,lineHeight:1.5}}>{artisan.nom_entreprise || 'Votre espace'} est prêt. Activez votre essai — chaque demande tombe directement sur votre téléphone.</p>

        {/* Cadrage ROI */}
        <div style={{background:'var(--blue-dim)',border:'1px solid var(--blue-mid)',borderRadius:12,padding:'12px 14px',marginBottom:18,textAlign:'left'}}>
          <p style={{fontSize:13,fontWeight:800,color:'var(--blue-600)',letterSpacing:'-0.01em'}}>Un seul chantier gagné = plusieurs mois remboursés.</p>
          <p style={{fontSize:12,color:'var(--text2)',marginTop:3,lineHeight:1.45}}>Un chantier moyen vaut 200 à 600 €. TraceOn vous évite d'en perdre — il se rentabilise dès le 1ᵉʳ client.</p>
        </div>

        <div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:4,marginBottom:18}}>
          <span style={{fontSize:38,fontWeight:900,letterSpacing:'-0.04em'}}>250 €</span>
          <span style={{fontSize:14,color:'var(--text3)',fontWeight:600}}>/ mois</span>
        </div>

        <div style={{textAlign:'left',display:'flex',flexDirection:'column',gap:9,marginBottom:24}}>
          {avantages.map(a=>(
            <div key={a} style={{display:'flex',alignItems:'center',gap:10,fontSize:13,fontWeight:500}}>
              <span style={{width:20,height:20,borderRadius:'50%',background:'var(--green-dim)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Check size={13} color="var(--green)"/></span>
              {a}
            </div>
          ))}
        </div>

        <button onClick={abonner} disabled={loading} className="btn-primary" style={{height:50,fontSize:15}}>
          {loading ? <span className="spinner spinner-w" /> : 'Démarrer mes 7 jours gratuits'}
        </button>
        <p style={{fontSize:11,color:'var(--text3)',marginTop:12}}>7 jours gratuits, puis 250 €/mois · Renouvellement automatique (recommandé) · Annulable en 1 clic</p>
      </div>
    </div>
  )
}

// Compteur animé — défile vers la cible (qui saute dès le tap grâce au cash optimiste)
function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(target)
  const prev = useRef(target)
  useEffect(() => {
    const start = prev.current, delta = target - start, t0 = performance.now()
    if (delta === 0) return
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      setVal(start + delta * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick); else { setVal(target); prev.current = target }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

/* ───────── ACCUEIL ───────── */
function Accueil({ nouvelles, encaisse, potentiel, confirmes, valider, validating, removing, onCreneaux, onShare, onSupprimer, objectif }: any) {
  const animEnc = useCountUp(encaisse)
  const prochain = prochainRDV(confirmes as Demande[])
  const obj = Number(objectif) || 0
  const atteint = obj > 0 && encaisse >= obj
  const reste = Math.max(obj - encaisse, 0)
  const todayList = (confirmes as Demande[]).filter(d => d.date_chantier && isToday(d.date_chantier!))
  const startTomorrow = new Date(); startTomorrow.setHours(0,0,0,0); startTomorrow.setDate(startTomorrow.getDate()+1)
  const futureList = (confirmes as Demande[]).filter(d => d.date_chantier && new Date(d.date_chantier!).getTime() >= startTomorrow.getTime())
  const [vue, setVue] = useState<'a_traiter'|'aujourdhui'|'avenir'>(() => todayList.length ? 'aujourdhui' : (nouvelles.length ? 'a_traiter' : 'aujourdhui'))
  const [segDir, setSegDir] = useState(1)
  const touchRef = useRef<{x:number;y:number}|null>(null)
  const VUES = ['a_traiter','aujourdhui','avenir'] as const
  const goVue = (k: typeof VUES[number]) => { setSegDir(VUES.indexOf(k) >= VUES.indexOf(vue) ? 1 : -1); haptic(5); setVue(k) }
  const onSwipeEnd = (e: React.TouchEvent) => {
    const t = touchRef.current; touchRef.current = null
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const i = VUES.indexOf(vue)
      if (dx < 0 && i < VUES.length - 1) goVue(VUES[i + 1])
      else if (dx > 0 && i > 0) goVue(VUES[i - 1])
    }
  }
  return (
    <div>
      {/* Hero — reste fixe au défilement */}
      <div className="hero-card a-scaleIn" style={{padding:'22px 22px 20px',marginBottom:16}}>
        <div className="hero-shine" />
        <div style={{position:'relative',zIndex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14}}>
            <div style={{minWidth:0}}>
              <p style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.9)',marginBottom:7}}>Encaissé ce mois</p>
              <p style={{margin:0}}><MontantHero value={animEnc} /></p>
              <p style={{fontSize:12.5,fontWeight:500,color:'rgba(255,255,255,0.6)',marginTop:8}}>
                {atteint
                  ? <span style={{color:'rgba(255,255,255,0.92)',fontWeight:700}}>🎉 Objectif atteint</span>
                  : <>Plus que <b style={{color:'rgba(255,255,255,0.85)',fontWeight:700}}>{eur(reste)}</b> · objectif {eur(obj)}</>}
              </p>
            </div>
          </div>
          <div style={{display:'flex',gap:14,marginTop:20}}>
            <div className="hero-stat" style={{flex:1,padding:'13px 15px',border:'1px solid rgba(255,255,255,0.28)',background:'rgba(255,255,255,0.14)',backdropFilter:'blur(8px)',boxShadow:'0 1px 0 rgba(255,255,255,0.25) inset, 0 6px 16px rgba(5,9,31,0.2)'}}>
              <p style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.02em'}}>Prévu</p>
              <p className="amount" style={{fontSize:20,marginTop:4,color:'#fff'}}>{eur(potentiel)}</p>
            </div>
            <div className="hero-stat" style={{flex:1,padding:'13px 15px',border:'1px solid rgba(255,255,255,0.28)',background:'rgba(255,255,255,0.14)',backdropFilter:'blur(8px)',boxShadow:'0 1px 0 rgba(255,255,255,0.25) inset, 0 6px 16px rgba(5,9,31,0.2)',minWidth:0}}>
              <p style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.02em'}}>Prochain RDV</p>
              {prochain ? (
                <>
                  <p style={{fontSize:20,fontWeight:800,marginTop:4,letterSpacing:'-0.02em',color:'#fff'}}>{whenLabel(prochain)}</p>
                  <p style={{fontSize:12,color:'rgba(255,255,255,0.82)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{prochain.client_nom}</p>
                </>
              ) : (
                <>
                  <p style={{fontSize:20,fontWeight:800,marginTop:4,color:'#fff'}}>—</p>
                  <p style={{fontSize:12,color:'rgba(255,255,255,0.82)',marginTop:1}}>Rien de prévu</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Vue segmentée : À traiter · Aujourd'hui · À venir */}
      {(nouvelles.length + todayList.length + futureList.length) === 0 ? (
        <div style={{textAlign:'center',padding:'40px 14px'}} className="a-fadeIn">
          <div className="icon-tile" style={{width:58,height:58,borderRadius:16,background:'var(--blue-dim)',border:'1px solid var(--blue-mid)',margin:'0 auto 16px'}}><Link2 size={24} color="var(--blue)" /></div>
          <p style={{fontSize:16,fontWeight:700,marginBottom:5}}>Prêt à recevoir vos demandes</p>
          <p style={{fontSize:13,color:'var(--text3)',maxWidth:280,margin:'0 auto 18px',lineHeight:1.5}}>Partagez votre lien client : chaque demande arrivera directement ici.</p>
          <button onClick={onShare} className="btn-primary" style={{width:'auto',padding:'13px 22px',margin:'0 auto'}}><Link2 size={17}/>Partager mon lien client</button>
        </div>
      ) : (
        <div onTouchStart={e=>{ touchRef.current = { x:e.touches[0].clientX, y:e.touches[0].clientY } }} onTouchEnd={onSwipeEnd} style={{minHeight:'56vh',touchAction:'pan-y'}}>
          <div style={{display:'flex',gap:4,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:14,padding:4,marginBottom:10}}>
            {([
              { k:'a_traiter',  label:'À traiter',    count: nouvelles.length },
              { k:'aujourdhui', label:"Aujourd'hui",  count: todayList.length },
              { k:'avenir',     label:'À venir',      count: futureList.length },
            ] as const).map(s => {
              const on = vue === s.k
              return (
                <button key={s.k} onClick={()=>goVue(s.k)}
                  style={{flex:1,padding:'9px 4px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12.5,fontWeight:700,letterSpacing:'-0.01em',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,
                    transition:'background .2s, color .2s, box-shadow .2s',
                    background:on?'var(--surface)':'transparent',color:on?'var(--text)':'var(--text3)',boxShadow:on?'0 1px 3px rgba(15,23,42,0.12)':'none'}}>
                  {s.label}
                  {s.count>0 && <span style={{fontSize:11,fontWeight:800,minWidth:18,height:18,padding:'0 5px',borderRadius:9,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#0c1424',border:'1px solid rgba(0,0,0,0.10)',boxShadow:'0 1px 2px rgba(0,0,0,0.08)'}}>{s.count}</span>}
                </button>
              )
            })}
          </div>

          <div style={{position:'relative',height:4,marginBottom:14}}>
            <div style={{position:'absolute',top:0,left:`${(VUES.indexOf(vue)+0.5)*(100/3)}%`,transform:'translateX(-50%)',width:40,height:4,borderRadius:2,background:'var(--text3)',transition:'left .32s cubic-bezier(.22,1,.36,1)'}} />
          </div>
          <div key={vue} className={`tab-pane ${segDir>0?'fwd':'back'}`}>
            {vue==='a_traiter' && (
              nouvelles.length
                ? <div style={{display:'flex',flexDirection:'column',gap:10}}>{nouvelles.map((d:Demande,i:number)=><CardDemande key={d.id} d={d} i={i} onCreneaux={()=>onCreneaux(d)} />)}</div>
                : <Empty Icon={Check} title="Rien à traiter" sub="Toutes vos demandes sont traitées." />
            )}
            {vue==='aujourdhui' && (
              todayList.length
                ? <div style={{display:'flex',flexDirection:'column'}}>{todayList.map((d:Demande)=><CardChantier key={d.id} d={d} onValider={()=>valider(d.id)} onDelete={()=>onSupprimer(d.id)} validating={validating===d.id} removing={removing===d.id} />)}</div>
                : <Empty Icon={CalendarDays} title="Rien aujourd'hui" sub="Aucun chantier prévu aujourd'hui." />
            )}
            {vue==='avenir' && (() => {
              if (!futureList.length) return <Empty Icon={CalendarDays} title="Rien à venir" sub="Vos prochains chantiers s'afficheront ici." />
              const groups: { key:string; label:string; items:Demande[] }[] = []
              for (const d of futureList) {
                const ds = new Date(d.date_chantier!).toDateString()
                let g = groups.find(x => x.key === ds)
                if (!g) { g = { key: ds, label: isTomorrow(d.date_chantier!) ? 'Demain' : formatDate(d.date_chantier!), items: [] }; groups.push(g) }
                g.items.push(d)
              }
              return groups.map(g => (
                <div key={g.key} style={{marginBottom:18}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                    <h2 className="section-title" style={{fontSize:16,textTransform:'capitalize'}}>{g.label}</h2>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--text3)'}}>· {g.items.length}</span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column'}}>
                    {g.items.map((d:Demande)=><CardChantier key={d.id} d={d} onValider={()=>valider(d.id)} onDelete={()=>onSupprimer(d.id)} validating={validating===d.id} removing={removing===d.id} />)}
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────── PLANNING ───────── */
function Planning({ confirmes, artisan, save }: { confirmes:Demande[]; artisan:Artisan; save:(f:Partial<Artisan>)=>Promise<void> }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [bloquer, setBloquer] = useState<string|null>(null) // date ISO en cours de blocage
  const [bDebut, setBDebut] = useState('08:00')
  const [bFin, setBFin] = useState('12:00')
  const [weekDir, setWeekDir] = useState(1)
  const touchRef = useRef<{x:number;y:number}|null>(null)
  const changeWeek = (delta:number) => { setWeekDir(delta>0?1:-1); haptic(5); setWeekOffset(w=>w+delta) }
  const base = new Date(); base.setHours(0,0,0,0)
  const monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay()+6)%7) + weekOffset*7)
  const days = Array.from({length:7},(_,i)=>{ const dd=new Date(monday); dd.setDate(monday.getDate()+i); return dd })
  const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
  const indispo = (artisan.indisponibilites as any[]) || []

  const slotsFor = (day:Date) => confirmes.filter(d => d.date_chantier && new Date(d.date_chantier).toDateString()===day.toDateString())
  const indispoFor = (day:Date) => indispo.filter(b => b.date === day.toISOString().split('T')[0])

  async function ajouterIndispo(iso:string) {
    const next = [...indispo, { date: iso, heure_debut: bDebut, heure_fin: bFin }]
    await save({ indisponibilites: next as any })
    setBloquer(null)
  }
  async function retirerIndispo(iso:string, hd:string) {
    const next = indispo.filter(b => !(b.date===iso && b.heure_debut===hd))
    await save({ indisponibilites: next as any })
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <SectionTitle title="Planning" />
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button onClick={()=>changeWeek(-1)} className="fab" style={{width:34,height:34,borderRadius:10}}><ChevronLeft size={16}/></button>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text2)',minWidth:90,textAlign:'center'}}>
            {weekOffset===0?'Cette semaine':monday.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
          </span>
          <button onClick={()=>changeWeek(1)} className="fab" style={{width:34,height:34,borderRadius:10}}><ChevronRight size={16}/></button>
        </div>
      </div>

      <div key={weekOffset} className={`tab-pane ${weekDir>0?'fwd':'back'}`} style={{touchAction:'pan-y'}}
        onTouchStart={e=>{ touchRef.current = { x:e.touches[0].clientX, y:e.touches[0].clientY } }}
        onTouchEnd={e=>{ const t=touchRef.current; touchRef.current=null; if(!t) return; const dx=e.changedTouches[0].clientX-t.x, dy=e.changedTouches[0].clientY-t.y; if(Math.abs(dx)>48 && Math.abs(dx)>Math.abs(dy)*1.5){ changeWeek(dx<0?1:-1) } }}>
      <div className="card" style={{padding:'4px 0',overflow:'hidden'}}>
        {days.map((day,di)=>{
          const slots = slotsFor(day)
          const blocs = indispoFor(day)
          const iso = day.toISOString().split('T')[0]
          const isTd = day.toDateString()===base.toDateString()
          return (
            <div key={di} style={{display:'flex',borderBottom:di<6?'1px solid var(--border)':'none',background:isTd?'var(--blue-dim)':'transparent'}}>
              <div style={{width:60,flexShrink:0,padding:'18px 0',textAlign:'center',borderRight:'1px solid var(--border)'}}>
                <p style={{fontSize:11,color:isTd?'var(--blue)':'var(--text3)',fontWeight:600,textTransform:'uppercase'}}>{JOURS[di]}</p>
                <p style={{fontSize:20,fontWeight:800,color:isTd?'var(--blue)':'var(--text)',marginTop:2}}>{day.getDate()}</p>
              </div>
              <div style={{flex:1,padding:'14px 14px',display:'flex',flexDirection:'column',gap:7,minHeight:'calc((100vh - 320px) / 7)',justifyContent:'center'}}>
                {slots.map(s=>{
                  const st = svc(s.type_intervention); const c = s.creneau_accepte
                  return (
                    <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,background:`${st.color}12`,borderLeft:`3px solid ${st.color}`,borderRadius:8,padding:'6px 10px'}}>
                      <span style={{fontSize:11,fontWeight:700,color:st.color,minWidth:38}}>{c?formatHeure(c.heure_debut):'—'}</span>
                      <span style={{fontSize:12,fontWeight:600,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.client_nom}</span>
                      <span style={{fontSize:11,color:'var(--text3)'}}>{s.type_intervention}</span>
                    </div>
                  )
                })}
                {blocs.map((b,bi)=>(
                  <div key={bi} onClick={()=>retirerIndispo(iso,b.heure_debut)} title="Cliquez pour retirer" style={{display:'flex',alignItems:'center',gap:8,background:'var(--red-dim)',borderLeft:'3px solid var(--red)',borderRadius:8,padding:'6px 10px',cursor:'pointer'}}>
                    <span style={{fontSize:11,fontWeight:700,color:'var(--red)',minWidth:38}}>{formatHeure(b.heure_debut)}</span>
                    <span style={{fontSize:12,fontWeight:600,flex:1,color:'var(--red)'}}>Indisponible</span>
                    <Trash2 size={13} color="var(--red)" />
                  </div>
                ))}
                {/* Formulaire de blocage inline */}
                {bloquer===iso ? (
                  <div style={{display:'flex',gap:6,alignItems:'center',marginTop:2}}>
                    <input type="time" value={bDebut} onChange={e=>setBDebut(e.target.value)} className="input-field" style={{width:78,padding:'7px 6px',fontSize:12}} />
                    <input type="time" value={bFin} onChange={e=>setBFin(e.target.value)} className="input-field" style={{width:78,padding:'7px 6px',fontSize:12}} />
                    <button onClick={()=>ajouterIndispo(iso)} className="btn-primary" style={{width:'auto',padding:'7px 12px',fontSize:12,height:'auto'}}>OK</button>
                    <button onClick={()=>setBloquer(null)} className="fab" style={{width:30,height:30}}>✕</button>
                  </div>
                ) : (
                  slots.length===0 && blocs.length===0
                    ? <button onClick={()=>setBloquer(iso)} style={{fontSize:12,color:'var(--text3)',background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0}}>Libre · <span style={{color:'var(--blue)',fontWeight:600}}>bloquer</span></button>
                    : <button onClick={()=>setBloquer(iso)} style={{fontSize:11,color:'var(--blue)',fontWeight:600,background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0}}>+ bloquer un créneau</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:14,marginTop:12,justifyContent:'center'}}>
        <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}><span style={{width:10,height:10,borderRadius:3,background:'var(--blue)'}}/>Chantier</span>
        <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}><span style={{width:10,height:10,borderRadius:3,background:'var(--red)'}}/>Indisponible</span>
        <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}><span style={{width:10,height:10,borderRadius:3,background:'var(--border2)'}}/>Libre</span>
      </div>
    </div>
  )
}

/* ───────── HISTORIQUE ───────── */
/* ───────── BILAN (Historique + Stats fusionnés) ───────── */
function Bilan({ payes, demandes, encaisse, avis }: { payes:Demande[]; demandes:Demande[]; encaisse:number; avis:any[] }) {
  const ORD = ['historique','avis','stats'] as const
  type Sub = typeof ORD[number]
  const [sub, setSub] = useState<Sub>('historique')
  const [dir, setDir] = useState(1)
  const touchRef = useRef<{x:number;y:number}|null>(null)
  const go = (k:Sub) => { setDir(ORD.indexOf(k) >= ORD.indexOf(sub) ? 1 : -1); haptic(5); setSub(k) }
  const onEnd = (e: React.TouchEvent) => {
    const t = touchRef.current; touchRef.current = null; if (!t) return
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const i = ORD.indexOf(sub)
      if (dx < 0 && i < ORD.length-1) go(ORD[i+1]); else if (dx > 0 && i > 0) go(ORD[i-1])
    }
  }
  const segs = [{ k:'historique', label:'Historique', count:payes.length }, { k:'avis', label:'Avis', count:avis.length }, { k:'stats', label:'Stats', count:0 }] as const
  return (
    <div onTouchStart={e=>{ touchRef.current = { x:e.touches[0].clientX, y:e.touches[0].clientY } }} onTouchEnd={onEnd} style={{minHeight:'72vh',touchAction:'pan-y'}}>
      <div style={{display:'flex',gap:4,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:14,padding:4,marginBottom:10}}>
        {segs.map(s => {
          const on = sub === s.k
          return (
            <button key={s.k} onClick={()=>go(s.k)} style={{flex:1,padding:'9px 4px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12.5,fontWeight:700,letterSpacing:'-0.01em',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,transition:'background .2s, color .2s, box-shadow .2s',background:on?'var(--surface)':'transparent',color:on?'var(--text)':'var(--text3)',boxShadow:on?'0 1px 3px rgba(15,23,42,0.12)':'none'}}>
              {s.label}
              {s.count>0 && <span style={{fontSize:11,fontWeight:800,minWidth:18,height:18,padding:'0 5px',borderRadius:9,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',color:'#0c1424',border:'1px solid rgba(0,0,0,0.10)',boxShadow:'0 1px 2px rgba(0,0,0,0.08)'}}>{s.count}</span>}
            </button>
          )
        })}
      </div>
      <div style={{position:'relative',height:4,marginBottom:14}}>
        <div style={{position:'absolute',top:0,left:`${(ORD.indexOf(sub)+0.5)*(100/3)}%`,transform:'translateX(-50%)',width:40,height:4,borderRadius:2,background:'var(--text3)',transition:'left .32s cubic-bezier(.22,1,.36,1)'}} />
      </div>
      <div key={sub} className={`tab-pane ${dir>0?'fwd':'back'}`}>
        {sub==='historique' && <Historique payes={payes} encaisse={encaisse} />}
        {sub==='avis' && <AvisListe avis={avis} />}
        {sub==='stats' && <Stats payes={payes} demandes={demandes} encaisse={encaisse} />}
      </div>
    </div>
  )
}

/* ───────── AVIS (vue artisan : "Mes avis") ───────── */
function AvisListe({ avis }: { avis:any[] }) {
  const count = avis.length
  const moyenne = count ? Math.round((avis.reduce((s,a)=>s+(a.note||0),0)/count)*10)/10 : 0
  return (
    <div>
      <div className="hero-card a-scaleIn" style={{padding:'20px 22px',marginBottom:16}}>
        <div style={{position:'relative',zIndex:1,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{fontSize:13,opacity:.85,marginBottom:5}}>Note moyenne</p>
            <p className="amount-hero" style={{fontSize:38}}>{count ? moyenne.toFixed(1) : '—'}</p>
            <p style={{fontSize:12,opacity:.8,marginTop:4}}>{count} avis client{count>1?'s':''}</p>
          </div>
          <div style={{display:'flex',gap:3}}>
            {Array.from({length:5}).map((_,k)=><Star key={k} size={20} color="#fbbf24" fill={k<Math.round(moyenne)?'#fbbf24':'rgba(255,255,255,0.25)'} />)}
          </div>
        </div>
      </div>
      <SectionTitle title="Mes avis" />
      {count===0
        ? <Empty Icon={Star} title="Pas encore d'avis" sub="Après chaque chantier validé, vos clients reçoivent une demande d'avis par SMS." />
        : <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {avis.map((a,i)=>(
              <div key={a.id||i} className="card" style={{padding:15}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <div style={{display:'flex',gap:2}}>
                    {Array.from({length:5}).map((_,k)=><Star key={k} size={15} color="#f59e0b" fill={k<a.note?'#f59e0b':'none'} />)}
                  </div>
                  {!a.affiche && <span style={{fontSize:10,fontWeight:700,color:'var(--text3)',background:'var(--surface2)',padding:'2px 7px',borderRadius:7}}>masqué du site</span>}
                </div>
                {a.commentaire && <p style={{fontSize:14,color:'var(--text2)',lineHeight:1.5}}>“{a.commentaire}”</p>}
                <p style={{fontSize:12,color:'var(--text3)',marginTop:8,fontWeight:600}}>{a.client_nom || 'Client'} · {new Date(a.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</p>
              </div>
            ))}
          </div>}
    </div>
  )
}

function Historique({ payes, encaisse }: { payes:Demande[]; encaisse:number }) {
  // Regroupe par mois (éventail), du plus récent au plus ancien ; à l'intérieur, ordre alphabétique
  const groups: Record<string,{ ts:number; items:Demande[] }> = {}
  for (const d of payes) {
    const dt = new Date(d.date_chantier || d.created_at)
    const key = `${dt.getFullYear()}-${dt.getMonth()}`
    if (!groups[key]) groups[key] = { ts: new Date(dt.getFullYear(), dt.getMonth(), 1).getTime(), items: [] }
    groups[key].items.push(d)
  }
  const ordered = Object.values(groups).sort((a,b)=> b.ts - a.ts)
  ordered.forEach(g => g.items.sort((a,b)=> (a.client_nom||'').localeCompare(b.client_nom||'', 'fr', { sensitivity:'base' })))
  const moisAnnee = (ts:number) => { const s = new Date(ts).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); return s.charAt(0).toUpperCase()+s.slice(1) }
  const totalMois = (items:Demande[]) => items.reduce((s,d)=>s+(d.prix_estime||0),0)

  return (
    <div>
      <div className="hero-card a-scaleIn" style={{padding:'20px 22px',marginBottom:16}}>
        <div style={{position:'relative',zIndex:1}}>
          <p style={{fontSize:13,opacity:.85,marginBottom:5}}>Total encaissé</p>
          <p className="amount-hero" style={{fontSize:38}}>{eur(encaisse)}</p>
          <p style={{fontSize:12,opacity:.8,marginTop:4}}>{payes.length} chantier{payes.length>1?'s':''} validé{payes.length>1?'s':''}</p>
        </div>
      </div>

      <SectionTitle title="Chantiers réalisés" />
      {ordered.length===0
        ? <Empty Icon={Clock} title="Aucun chantier" sub="Vos chantiers validés apparaîtront ici." />
        : <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {ordered.map((g,i)=>(
              <MonthGroup key={g.ts} id={g.ts} label={moisAnnee(g.ts)} total={totalMois(g.items)} count={g.items.length} defaultOpen={i===0}>
                {g.items.map(d=><HistoCard key={d.id} d={d} />)}
              </MonthGroup>
            ))}
          </div>}
    </div>
  )
}

function MonthGroup({ id, label, total, count, defaultOpen, children }: { id:string|number; label:string; total:number; count:number; defaultOpen:boolean; children:React.ReactNode }) {
  const [open, toggle] = useCollapse('histo-' + id, defaultOpen)
  return (
    <div className="card" style={{padding:'12px 14px'}}>
      <button onClick={()=>{ haptic(5); toggle() }} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',background:'none',border:'none',cursor:'pointer',padding:0}}>
        <span style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          <ChevronRight size={18} color="var(--text3)" style={{transform:open?'rotate(90deg)':'none',transition:'transform .2s',flexShrink:0}} />
          <span style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{label}</span>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text3)'}}>· {count}</span>
        </span>
        <span className="amount-green" style={{fontSize:15,flexShrink:0}}>{eur(total)}</span>
      </button>
      {open && <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:12}}>{children}</div>}
    </div>
  )
}

function HistoCard({ d }: { d:Demande }) {
  const s = svc(d.type_intervention); const c = d.creneau_accepte
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:14,padding:13}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
        <div className="icon-tile" style={{width:40,height:40,borderRadius:11,background:`${s.color}14`}}><s.Icon size={18} color={s.color} /></div>
        <div style={{flex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <p style={{fontSize:15,fontWeight:700}}>{d.client_nom}</p>
            <span className="amount-green" style={{fontSize:16}}>+{eur(d.prix_estime||0)}</span>
          </div>
          <p style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{d.type_intervention}</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:'4px 14px',marginTop:8}}>
            {c && <Meta Icon={CalendarDays} txt={formatDate(c.date)} />}
            {c && <Meta Icon={Clock} txt={`${formatHeure(c.heure_debut)}–${formatHeure(c.heure_fin)}`} />}
            <Meta Icon={MapPin} txt={d.client_adresse} />
            <Meta Icon={Phone} txt={d.client_telephone} />
          </div>
          <a href={`/api/devis/${d.token}`} target="_blank" rel="noreferrer"
            style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:10,fontSize:12,fontWeight:600,color:'var(--blue)',textDecoration:'none',background:'var(--blue-dim)',padding:'6px 12px',borderRadius:9,border:'1px solid var(--blue-mid)'}}>
            <FileText size={13}/>Devis PDF<Download size={13}/>
          </a>
        </div>
      </div>
    </div>
  )
}
function Meta({ Icon, txt }: { Icon:any; txt:string }) {
  return <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--text3)'}}><Icon size={12} />{txt}</span>
}

/* ───────── STATS ───────── */
function Stats({ payes, demandes, encaisse }: { payes:Demande[]; demandes:Demande[]; encaisse:number }) {
  // CA par mois (6 derniers mois)
  const now = new Date()
  const months = Array.from({length:6},(_,i)=>{ const d=new Date(now.getFullYear(),now.getMonth()-5+i,1); return d })
  const caByMonth = months.map(m => payes.filter(p => { const d=new Date(p.date_paiement||p.created_at); return d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear() }).reduce((s,p)=>s+(p.prix_estime||0),0))
  const maxCA = Math.max(...caByMonth, 1)

  // Top services
  const counts: Record<string,{n:number;ca:number}> = {}
  payes.forEach(p => { const t=p.type_intervention; if(!counts[t]) counts[t]={n:0,ca:0}; counts[t].n++; counts[t].ca+=p.prix_estime||0 })
  const top = Object.entries(counts).sort((a,b)=>b[1].ca-a[1].ca)
  const maxSvc = Math.max(...top.map(t=>t[1].ca), 1)

  const ticket = payes.length>0 ? encaisse/payes.length : 0
  const conv = demandes.length>0 ? Math.round(payes.length/demandes.length*100) : 0

  return (
    <div>
      <SectionTitle title="Statistiques" />

      {/* KPIs — cartes dark premium avec glow */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <KPI label="Chiffre d'affaires" value={eur(encaisse)} Icon={Euro}      glow="#1d5fed" />
        <KPI label="Chantiers"          value={`${payes.length}`}    Icon={Briefcase} glow="#1d5fed" />
        <KPI label="Ticket moyen"       value={eur(ticket)}   Icon={Receipt}   glow="#10b981" />
        <KPI label="Taux de réussite"   value={`${conv}%`}           Icon={Percent}   glow="#1d5fed" />
      </div>

      {/* Graphique CA */}
      <div className="card" style={{padding:18,marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18}}>
          <TrendingUp size={16} color="var(--blue)" />
          <p style={{fontSize:14,fontWeight:700}}>Évolution du CA</p>
        </div>
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:8,height:130}}>
          {caByMonth.map((ca,i)=>(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%',justifyContent:'flex-end'}}>
              <span style={{fontSize:9,fontWeight:700,color:'var(--text2)'}}>{ca>0?Math.round(ca):''}</span>
              <div style={{width:'100%',maxWidth:32,height:`${Math.max((ca/maxCA)*100,3)}%`,background:i===5?'linear-gradient(180deg,#2a6af0,#1550cf)':'#d8e2f2',borderRadius:'6px 6px 0 0',transformOrigin:'bottom',animation:`growBar .6s cubic-bezier(.22,1,.36,1) both`,animationDelay:`${i*0.06}s`,boxShadow:i===5?'0 4px 10px rgba(10,50,184,0.3)':'none'}} />
              <span style={{fontSize:10,color:'var(--text2)',fontWeight:600}}>{months[i].toLocaleDateString('fr-FR',{month:'short'})}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top services */}
      <div className="card" style={{padding:18}}>
        <p style={{fontSize:14,fontWeight:700,marginBottom:16}}>Ce qui se vend le plus</p>
        {top.length===0
          ? <p style={{fontSize:13,color:'var(--text3)',textAlign:'center',padding:'12px 0'}}>Pas encore de données</p>
          : <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {top.map(([type,{n,ca}],i)=>{
                const s = svc(type)
                return (
                  <div key={type} className={`a-fadeUp d${Math.min(i+1,6)}`}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <s.Icon size={15} color={s.color} />
                      <span style={{fontSize:13,fontWeight:600,flex:1}}>{type}</span>
                      <span style={{fontSize:12,color:'var(--text3)'}}>{n}×</span>
                      <span style={{fontSize:13,fontWeight:700,color:'var(--green)',minWidth:56,textAlign:'right'}}>{eur(ca)}</span>
                    </div>
                    <div style={{height:7,background:'var(--surface2)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${(ca/maxSvc)*100}%`,background:s.color,borderRadius:4,transition:'width .6s ease'}} />
                    </div>
                  </div>
                )
              })}
            </div>}
      </div>
    </div>
  )
}
function KPI({ label, value, Icon, glow }: { label:string; value:string; Icon:any; glow:string }) {
  return (
    <div className="a-count" style={{
      padding:'15px 16px', borderRadius:18, position:'relative', overflow:'hidden',
      background:'linear-gradient(150deg, #1b1e2b 0%, #0a0c14 100%)',
      border:`1px solid ${glow}40`,
      boxShadow:`0 1px 0 rgba(255,255,255,0.10) inset, 0 0 0 1px ${glow}1a, 0 10px 28px rgba(0,0,0,0.45), 0 0 24px ${glow}1f`,
    }}>
      {/* glow coloré en coin */}
      <div style={{position:'absolute',top:-30,right:-30,width:96,height:96,borderRadius:'50%',background:`radial-gradient(circle, ${glow}55 0%, transparent 70%)`,pointerEvents:'none'}} />
      {/* Titre en premier, plus gros */}
      <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
        <p style={{fontSize:14,fontWeight:700,color:'rgba(255,255,255,0.92)',letterSpacing:'-0.02em'}}>{label}</p>
        <div className="icon-tile" style={{width:30,height:30,borderRadius:9,background:`${glow}26`,border:`1px solid ${glow}40`,boxShadow:'none',flexShrink:0}}><Icon size={15} color={glow} /></div>
      </div>
      <p className="amount" style={{fontSize:24,color:'#fff',position:'relative'}}>{value}</p>
    </div>
  )
}

/* ───────── RÉGLAGE APPARENCE (clair / auto / sombre) ───────── */
function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getTheme())
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => { if (getTheme() === 'system') applyTheme('system') }
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  const choose = (t: Theme) => { haptic(6); setTheme(t); applyTheme(t) }
  const opts: { v:Theme; l:string; Icon:any }[] = [
    { v:'light',  l:'Clair',  Icon:Sun },
    { v:'system', l:'Auto',   Icon:Monitor },
    { v:'dark',   l:'Sombre', Icon:Moon },
  ]
  return (
    <Section title="Apparence" defaultOpen>
      <div style={{display:'flex',gap:8}}>
        {opts.map(o => {
          const on = theme === o.v
          return (
            <button key={o.v} onClick={()=>choose(o.v)} style={{flex:1,padding:'12px 0',borderRadius:13,fontSize:13,fontWeight:600,cursor:'pointer',transition:'all .2s',display:'flex',flexDirection:'column',alignItems:'center',gap:6,background:on?'var(--blue)':'var(--surface2)',color:on?'#fff':'var(--text2)',border:`1px solid ${on?'var(--blue)':'var(--border)'}`}}>
              <o.Icon size={18} strokeWidth={2.2} />
              {o.l}
            </button>
          )
        })}
      </div>
    </Section>
  )
}

/* ───────── PARAMÈTRES (toutes les variables entreprise) ───────── */
function Parametres({ artisan, save }: { artisan:Artisan; save:(f:Partial<Artisan>)=>Promise<void> }) {
  const router = useRouter()
  const [pwd, setPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  async function changePwd() {
    if (pwd.length < 6) { setPwdMsg('6 caractères minimum') ; return }
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) { setPwdMsg('Erreur, réessayez') }
    else { setPwd(''); setPwdMsg('Mot de passe modifié ✓'); haptic(8) }
  }
  const [f, setF] = useState<Partial<Artisan>>({
    nom_entreprise: artisan.nom_entreprise||'', telephone: artisan.telephone||'', email: artisan.email||'',
    logo_url: artisan.logo_url||'', adresse_entreprise: artisan.adresse_entreprise||'',
    zone_intervention: artisan.zone_intervention||'', siret: artisan.siret||'',
    tva_applicable: artisan.tva_applicable||false, taux_tva: artisan.taux_tva||20,
    types_chantier: artisan.types_chantier||[], prestations: artisan.prestations||[],
    horaires: artisan.horaires, modele_devis_url: artisan.modele_devis_url||'',
    conditions_paiement: artisan.conditions_paiement||'', mentions_legales: artisan.mentions_legales||'',
    cgv: artisan.cgv||'', rgpd: artisan.rgpd||'',
    preferences_creneaux: artisan.preferences_creneaux || { grand:'matin', moyen:'flexible', petit:'apres-midi' },
    objectif_mensuel: artisan.objectif_mensuel ?? 5000,
    message_relance: artisan.message_relance || '',
    message_confirmation: artisan.message_confirmation || '',
    message_creneaux: artisan.message_creneaux || '',
    message_avis: artisan.message_avis || '',
    google_avis_url: artisan.google_avis_url || '',
  })
  const set = (k:keyof Artisan, v:any) => setF(p=>({...p,[k]:v}))
  const types = f.types_chantier as TypeChantier[]
  const prest = f.prestations as Prestation[]
  const hr = f.horaires as any
  const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche']
  const JL: Record<string,string> = {lundi:'Lun',mardi:'Mar',mercredi:'Mer',jeudi:'Jeu',vendredi:'Ven',samedi:'Sam',dimanche:'Dim'}

  function logoUpload(file: File) { const r=new FileReader(); r.onload=()=>set('logo_url',r.result as string); r.readAsDataURL(file) }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <SectionTitle title="Paramètres" />

      <ThemeToggle />

      <Section title="Notifications" defaultOpen><PushSetup artisanId={artisan.id} /></Section>

      <Section title="Objectif mensuel" defaultOpen onSave={()=>save(f)}>
        <p style={{fontSize:13,color:'var(--text2)',marginBottom:10,lineHeight:1.5}}>Le montant à atteindre ce mois — l'anneau de progression se remplit à mesure que vous encaissez.</p>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <input type="number" value={f.objectif_mensuel as number} onChange={e=>set('objectif_mensuel', +e.target.value)} className="input-field" style={{maxWidth:160}} />
          <span style={{fontSize:14,fontWeight:700,color:'var(--text2)'}}>€ / mois</span>
        </div>
      </Section>

      {/* Entreprise */}
      <Section title="Entreprise" onSave={()=>save(f)}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
          <label style={{cursor:'pointer'}}>
            <div style={{width:56,height:56,borderRadius:14,border:'2px dashed var(--border2)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',background:'var(--surface2)'}}>
              {f.logo_url ? <img src={f.logo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <Upload size={18} color="var(--text3)" />}
            </div>
            <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&logoUpload(e.target.files[0])} />
          </label>
          <span style={{fontSize:12,color:'var(--text3)'}}>Logo — cliquez pour changer</span>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Field label="Nom de l'entreprise" val={f.nom_entreprise} set={(v:any)=>set('nom_entreprise',v)} />
          <Field label="Téléphone" type="tel" val={f.telephone} set={(v:any)=>set('telephone',v)} />
          <Field label="Email" type="email" val={f.email} set={(v:any)=>set('email',v)} />
          <Field label="SIRET" val={f.siret} set={(v:any)=>set('siret',v)} />
          <Field label="Adresse" val={f.adresse_entreprise} set={(v:any)=>set('adresse_entreprise',v)} />
          <Field label="Zone d'intervention" val={f.zone_intervention} set={(v:any)=>set('zone_intervention',v)} />
          <Field label="Lien avis Google (pour booster votre référencement)" val={f.google_avis_url} set={(v:any)=>set('google_avis_url',v)} />
        </div>
        <div style={{marginTop:14,background:'var(--blue-dim)',border:'1px solid var(--blue-mid)',borderRadius:12,padding:'12px 14px'}}>
          <p style={{fontSize:12,fontWeight:700,color:'var(--blue-600)',marginBottom:4}}>Votre site est en ligne 🌐</p>
          <a href={`/pro/${(artisan as any).slug || artisan.id}`} target="_blank" rel="noreferrer" style={{fontSize:12.5,color:'var(--blue)',fontWeight:600,wordBreak:'break-all'}}>
            {typeof window!=='undefined'?window.location.origin:''}/pro/{(artisan as any).slug || artisan.id}
          </a>
          <p style={{fontSize:11,color:'var(--text2)',marginTop:6,lineHeight:1.5}}>Mettez ce lien partout (bio Instagram, WhatsApp, carte de visite, camion).</p>
        </div>
      </Section>

      {/* Services & tarifs */}
      <Section title="Services & tarifs" onSave={()=>save(f)} action={<button onClick={()=>set('types_chantier',[...types,{type:'Nouveau',couleur:'#64748b',duree:2,prix_base:100}])} className="fab" style={{width:32,height:32}}><Plus size={16}/></button>}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {types.map((t,i)=>(
            <div key={i} style={{background:'var(--surface2)',borderRadius:13,padding:12,border:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <input type="color" value={t.couleur} onChange={e=>set('types_chantier',types.map((x,idx)=>idx===i?{...x,couleur:e.target.value}:x))} style={{width:32,height:32,borderRadius:9,border:'1px solid var(--border)',padding:2,cursor:'pointer',background:'#fff'}} />
                <input value={t.type} onChange={e=>set('types_chantier',types.map((x,idx)=>idx===i?{...x,type:e.target.value}:x))} className="input-field" style={{flex:1,padding:'9px 12px',fontSize:13}} />
                <button onClick={()=>set('types_chantier',types.filter((_,idx)=>idx!==i))} className="fab" style={{width:32,height:32,color:'var(--red)'}}><Trash2 size={15}/></button>
              </div>
              <div style={{display:'flex',gap:8}}>
                <Lab label="PRIX DE BASE (€)" type="number" val={t.prix_base} set={(v:any)=>set('types_chantier',types.map((x,idx)=>idx===i?{...x,prix_base:+v}:x))} />
                <Lab label="DURÉE (h)" type="number" val={t.duree} set={(v:any)=>set('types_chantier',types.map((x,idx)=>idx===i?{...x,duree:+v}:x))} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Grille tarifaire détaillée */}
      <Section title="Grille tarifaire détaillée" onSave={()=>save(f)} action={<button onClick={()=>set('prestations',[...prest,{service:types[0]?.type||'Autre',libelle:'',prix:0,unite:'forfait'}])} className="fab" style={{width:32,height:32}}><Plus size={16}/></button>}>
        {prest.length===0 && <p style={{fontSize:12,color:'var(--text3)',textAlign:'center',padding:'8px 0'}}>Aucune prestation détaillée.</p>}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {prest.map((p,i)=>(
            <div key={i} style={{background:'var(--surface2)',borderRadius:13,padding:12,border:'1px solid var(--border)'}}>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <select value={p.service} onChange={e=>set('prestations',prest.map((x,idx)=>idx===i?{...x,service:e.target.value}:x))} className="input-field" style={{flex:1,padding:'9px 12px',fontSize:13}}>
                  {types.map(t=><option key={t.type} value={t.type}>{t.type}</option>)}
                </select>
                <button onClick={()=>set('prestations',prest.filter((_,idx)=>idx!==i))} className="fab" style={{width:32,height:32,color:'var(--red)'}}><Trash2 size={15}/></button>
              </div>
              <input value={p.libelle} onChange={e=>set('prestations',prest.map((x,idx)=>idx===i?{...x,libelle:e.target.value}:x))} placeholder="Ex: Remplacement robinet" className="input-field" style={{padding:'9px 12px',fontSize:13,marginBottom:8}} />
              <div style={{display:'flex',gap:8}}>
                <Lab label="PRIX (€)" type="number" val={p.prix} set={(v:any)=>set('prestations',prest.map((x,idx)=>idx===i?{...x,prix:+v}:x))} />
                <div style={{flex:1}}>
                  <label style={{fontSize:10,color:'var(--label)',fontWeight:700,display:'block',marginBottom:4}}>UNITÉ</label>
                  <select value={p.unite} onChange={e=>set('prestations',prest.map((x,idx)=>idx===i?{...x,unite:e.target.value}:x))} className="input-field" style={{padding:'9px 12px',fontSize:13}}>
                    {['forfait','heure','m²','ml','unité','jour'].map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:12,display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:12,borderTop:'1px solid var(--border)'}}>
          <span style={{fontSize:13,fontWeight:600}}>Assujetti à la TVA</span>
          <button onClick={()=>set('tva_applicable',!f.tva_applicable)} style={{width:46,height:26,borderRadius:13,border:'none',cursor:'pointer',background:f.tva_applicable?'var(--blue)':'var(--border2)',position:'relative',transition:'all .2s'}}>
            <span style={{position:'absolute',top:2,left:f.tva_applicable?22:2,width:22,height:22,borderRadius:'50%',background:'#fff',transition:'all .2s'}} />
          </button>
        </div>
        {f.tva_applicable && <div style={{marginTop:10}}><Lab label="TAUX TVA (%)" type="number" val={f.taux_tva} set={(v:any)=>set('taux_tva',+v)} /></div>}
      </Section>

      {/* Horaires */}
      <Section title="Horaires de travail" onSave={()=>save(f)}>
        {JOURS.map((j,i)=>{ const h=hr[j]; return (
          <div key={j} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:i<6?'1px solid var(--border)':'none',opacity:h.actif?1:0.5}}>
            <button onClick={()=>set('horaires',{...hr,[j]:{...h,actif:!h.actif}})} style={{width:40,height:23,borderRadius:12,border:'none',cursor:'pointer',background:h.actif?'var(--blue)':'var(--border2)',position:'relative',flexShrink:0}}>
              <span style={{position:'absolute',top:2,left:h.actif?19:2,width:19,height:19,borderRadius:'50%',background:'#fff',transition:'all .2s'}} />
            </button>
            <span style={{fontSize:13,fontWeight:600,flex:1}}>{JL[j]}</span>
            {h.actif ? <>
              <input type="time" value={h.debut} onChange={e=>set('horaires',{...hr,[j]:{...h,debut:e.target.value}})} className="input-field" style={{width:76,padding:'6px 8px',fontSize:12}} />
              <span style={{color:'var(--text3)'}}>–</span>
              <input type="time" value={h.fin} onChange={e=>set('horaires',{...hr,[j]:{...h,fin:e.target.value}})} className="input-field" style={{width:76,padding:'6px 8px',fontSize:12}} />
            </> : <span style={{fontSize:12,color:'var(--text3)'}}>Fermé</span>}
          </div>
        )})}
      </Section>

      {/* Préférences de créneaux */}
      <Section title="Préférences de créneaux" onSave={()=>save(f)}>
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:14,lineHeight:1.5}}>
          Selon la taille du chantier, l'app proposera automatiquement des créneaux au bon moment de la journée.
        </p>
        {([
          { k:'grand', l:'Gros chantiers' },
          { k:'moyen', l:'Chantiers standards' },
          { k:'petit', l:'Petites interventions' },
        ] as const).map(({k,l})=>(
          <div key={k} style={{marginBottom:14}}>
            <p style={{fontSize:13,fontWeight:600,marginBottom:7}}>{l}</p>
            <div style={{display:'flex',gap:6}}>
              {([
                { v:'matin', l:'Matin' },
                { v:'apres-midi', l:'Après-midi' },
                { v:'flexible', l:'Flexible' },
              ] as const).map(opt=>{
                const on = (f.preferences_creneaux as any)[k]===opt.v
                return (
                  <button key={opt.v} onClick={()=>set('preferences_creneaux',{...(f.preferences_creneaux as any),[k]:opt.v})}
                    style={{flex:1,padding:'9px 0',borderRadius:11,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .2s',
                      background:on?'var(--blue)':'var(--surface2)',color:on?'#fff':'var(--text2)',
                      border:`1px solid ${on?'var(--blue)':'var(--border)'}`}}>
                    {opt.l}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </Section>

      {/* Légal & devis */}
      <Section title="Légal & devis" onSave={()=>save(f)}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Field label="Modèle de devis (lien PDF)" val={f.modele_devis_url} set={(v:any)=>set('modele_devis_url',v)} />
          <Area label="Conditions de paiement" val={f.conditions_paiement} set={(v:any)=>set('conditions_paiement',v)} />
          <Area label="Mentions légales" val={f.mentions_legales} set={(v:any)=>set('mentions_legales',v)} />
          <Area label="CGV" val={f.cgv} set={(v:any)=>set('cgv',v)} />
          <Area label="RGPD" val={f.rgpd} set={(v:any)=>set('rgpd',v)} />
        </div>
      </Section>

      {/* Messages SMS envoyés aux clients — tous personnalisables */}
      <Section title="Messages aux clients" onSave={()=>save(f)}>
        <p style={{fontSize:13,color:'var(--text2)',marginBottom:16,lineHeight:1.5}}>
          Les SMS envoyés automatiquement à vos clients, <b>en votre nom</b>. Personnalisez-les si vous voulez.
          Les variables entre accolades sont remplacées automatiquement. Laissez vide = message par défaut.
        </p>
        <MsgTpl titre="1. Confirmation de demande" desc="Dès qu'un client envoie une demande." vars={['client','entreprise','type','lien']}
          val={f.message_confirmation as string} set={(v:string)=>set('message_confirmation',v)}
          placeholder="Bonjour {client}, votre demande ({type}) a bien été reçue par {entreprise}. Suivez votre intervention ici : {lien}" />
        <MsgTpl titre="2. Proposition de créneaux" desc="Quand vous proposez des créneaux." vars={['client','entreprise','creneaux','lien']}
          val={f.message_creneaux as string} set={(v:string)=>set('message_creneaux',v)}
          placeholder="{entreprise} vous propose ces créneaux : {creneaux}. Choisissez le vôtre ici : {lien}" />
        <MsgTpl titre="3. Relance automatique" desc="Au client sans réponse après 2h." vars={['client','entreprise','lien']}
          val={f.message_relance as string} set={(v:string)=>set('message_relance',v)}
          placeholder="Bonjour {client}, avez-vous choisi un créneau pour votre intervention avec {entreprise} ? Réservez ici : {lien}" />
        <MsgTpl titre="4. Demande d'avis" desc="Après un chantier validé." vars={['client','entreprise','lien']}
          val={f.message_avis as string} set={(v:string)=>set('message_avis',v)}
          placeholder="Merci d'avoir fait appel à {entreprise} ! Votre avis compte : notez votre intervention en 10s ici {lien}" last />
      </Section>

      {/* Capture d'appel raté */}
      <Section title="Capture d'appel">
        {(artisan as any).numero_traceon ? (
          <>
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:10,lineHeight:1.5}}>Votre numéro TraceOn — affichez-le partout. Les appels arrivent sur votre téléphone ; si vous ne décrochez pas, le client reçoit un SMS avec votre lien.</p>
            <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--blue-dim)',border:'1px solid var(--blue-mid)',borderRadius:12,padding:'12px 14px'}}>
              <Phone size={18} color="var(--blue)" />
              <span style={{fontSize:16,fontWeight:800,letterSpacing:'-0.01em'}}>{(artisan as any).numero_traceon}</span>
            </div>
          </>
        ) : (
          <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.5}}>
            Bientôt : un numéro TraceOn qui renvoie vers votre téléphone et <b>rattrape chaque appel manqué</b> par SMS — pour ne plus jamais perdre un client. Activation sur demande.
          </p>
        )}
      </Section>

      {/* Abonnement */}
      <AbonnementSection artisan={artisan} />

      {/* Installer l'application */}
      <InstallSection />

      {/* Compte */}
      <Section title="Compte">
        <p style={{fontSize:13,color:'var(--text2)',marginBottom:14}}>Connecté en tant que <b>{artisan.email}</b></p>
        <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Modifier le mot de passe</label>
        <div style={{display:'flex',gap:8}}>
          <input type="password" value={pwd} onChange={e=>{setPwd(e.target.value); setPwdMsg('')}} placeholder="Nouveau mot de passe" className="input-field" autoComplete="new-password" />
          <button onClick={changePwd} disabled={!pwd} className="btn-primary" style={{width:'auto',padding:'0 18px'}}>OK</button>
        </div>
        {pwdMsg && <p style={{fontSize:12,marginTop:7,fontWeight:600,color: pwdMsg.includes('✓')?'var(--green)':'var(--red)'}}>{pwdMsg}</p>}
        <button onClick={async ()=>{ haptic(8); await supabase.auth.signOut(); router.replace('/login') }} className="btn-ghost" style={{color:'var(--red)',marginTop:16}}>Se déconnecter</button>
      </Section>
    </div>
  )
}

/* Section "Abonnement" — état + portail Stripe (renouvellement / annulation) */
function AbonnementSection({ artisan }: { artisan:Artisan }) {
  const [loading, setLoading] = useState(false)
  const statut = (artisan as any).abonnement_statut as string | undefined
  const label: Record<string,{txt:string;color:string}> = {
    trialing: { txt:'Essai gratuit en cours', color:'var(--blue)' },
    active:   { txt:'Abonnement actif', color:'var(--green)' },
    past_due: { txt:'Paiement en échec — accès suspendu', color:'var(--red)' },
    canceled: { txt:'Abonnement annulé', color:'var(--red)' },
  }
  const s = statut ? (label[statut] || { txt:statut, color:'var(--text2)' }) : { txt: artisan.abonnement_actif ? 'Actif' : 'Inactif', color: artisan.abonnement_actif?'var(--green)':'var(--text3)' }
  async function portail() {
    setLoading(true)
    try {
      const r = await authedFetch('/api/stripe/portal', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ artisan_id: artisan.id }) })
      const d = await r.json()
      if (d.url) window.location.href = d.url; else setLoading(false)
    } catch { setLoading(false) }
  }
  return (
    <Section title="Abonnement">
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{width:9,height:9,borderRadius:'50%',background:s.color,flexShrink:0}} />
        <span style={{fontSize:13,fontWeight:700,color:s.color}}>{s.txt}</span>
      </div>
      <p style={{fontSize:12.5,color:'var(--text2)',marginBottom:14,lineHeight:1.5}}>
        250 € / mois · <b>renouvellement automatique (recommandé)</b>. Gérez votre moyen de paiement,
        le renouvellement ou l'annulation à tout moment.
      </p>
      <button onClick={portail} disabled={loading} className="btn-ghost" style={{width:'100%'}}>
        {loading ? <span className="spinner" /> : <><Receipt size={16}/>Gérer mon abonnement</>}
      </button>
    </Section>
  )
}

/* Section "Installer l'app" — bouton natif (Android) + instructions (iOS) */
function InstallSection() {
  const [deferred, setDeferred] = useState<any>(null)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone)
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const h = (e:any) => { e.preventDefault(); setDeferred(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  async function install() { if (deferred) { deferred.prompt(); await deferred.userChoice; setDeferred(null) } }
  return (
    <Section title="Installer l'application">
      {installed ? (
        <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'var(--green)',fontWeight:600}}>
          <Check size={16}/> Application installée sur cet appareil
        </div>
      ) : (
        <>
          <p style={{fontSize:12,color:'var(--text2)',marginBottom:14,lineHeight:1.5}}>Ajoutez TraceOn à votre écran d'accueil pour y accéder comme une vraie application, en plein écran.</p>
          {deferred && !isIOS && (
            <button onClick={install} className="btn-primary" style={{marginBottom:14}}><Download size={17}/>Ajouter à l'écran d'accueil</button>
          )}
          <div style={{background:'var(--surface2)',borderRadius:12,padding:14,border:'1px solid var(--border)'}}>
            <p style={{fontSize:12,fontWeight:700,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>📱 Sur iPhone (Safari)</p>
            <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.7}}>1. Bouton <b>Partager</b> (carré + flèche ↑)<br/>2. <b>Sur l'écran d'accueil</b> → Ajouter</p>
            <p style={{fontSize:12,fontWeight:700,margin:'12px 0 8px',display:'flex',alignItems:'center',gap:6}}>🤖 Sur Android (Chrome)</p>
            <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.7}}>1. Menu <b>⋮</b> (3 points)<br/>2. <b>Ajouter à l'écran d'accueil</b></p>
          </div>
        </>
      )}
    </Section>
  )
}
function Section({ title, action, children, defaultOpen=false, onSave }: { title:string; action?:React.ReactNode; children:React.ReactNode; defaultOpen?:boolean; onSave?:()=>Promise<void> }) {
  const [open, toggle] = useCollapse('sec-' + title, defaultOpen)
  return (
    <div className="card" style={{padding:18}}>
      <div
        onClick={()=>{ haptic(5); toggle() }}
        style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom: open?14:0, cursor:'pointer'}}
      >
        <p style={{fontSize:14,fontWeight:700}}>{title}</p>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {action && <span onClick={e=>e.stopPropagation()}>{action}</span>}
          <ChevronRight size={18} color="var(--text3)" style={{transform: open?'rotate(90deg)':'none', transition:'transform .2s'}} />
        </div>
      </div>
      {open && children}
      {open && onSave && <SectionSave onSave={onSave} />}
    </div>
  )
}

// Bouton "Enregistrer" propre à chaque section (sauvegarde directe sans descendre en bas de page)
function SectionSave({ onSave }: { onSave:()=>Promise<void> }) {
  const [state, setState] = useState<'idle'|'saving'|'saved'>('idle')
  return (
    <button onClick={async()=>{ setState('saving'); await onSave(); haptic(8); setState('saved'); setTimeout(()=>setState('idle'),1800) }}
      disabled={state==='saving'} className="btn-primary" style={{marginTop:16,height:42,fontSize:13}}>
      {state==='saving' ? <span className="spinner spinner-w" /> : state==='saved' ? <><Check size={16}/>Enregistré</> : <><Save size={16}/>Enregistrer</>}
    </button>
  )
}
function Field({ label, val, set, type='text' }: { label:string; val:any; set:(v:string)=>void; type?:string }) {
  return (
    <div>
      <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>{label}</label>
      <input type={type} value={val||''} onChange={e=>set(e.target.value)} className="input-field" />
    </div>
  )
}
function Lab({ label, val, set, type='text' }: { label:string; val:any; set:(v:string)=>void; type?:string }) {
  return (
    <div style={{flex:1}}>
      <label style={{fontSize:10,color:'var(--label)',fontWeight:700,letterSpacing:'0.03em',display:'block',marginBottom:4}}>{label}</label>
      <input type={type} value={val} onChange={e=>set(e.target.value)} className="input-field" style={{padding:'9px 12px',fontSize:13}} />
    </div>
  )
}
// Champ d'édition d'un modèle de SMS client, avec ses variables disponibles
function MsgTpl({ titre, desc, vars, val, set, placeholder, last }: { titre:string; desc:string; vars:string[]; val:string; set:(v:string)=>void; placeholder:string; last?:boolean }) {
  return (
    <div style={{paddingBottom:14,marginBottom:14,borderBottom:last?'none':'1px solid var(--border)'}}>
      <p style={{fontSize:13.5,fontWeight:700,marginBottom:2}}>{titre}</p>
      <p style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>{desc}</p>
      <textarea value={val} onChange={e=>set(e.target.value)} rows={3} placeholder={placeholder} className="input-field" style={{resize:'none',lineHeight:1.5,fontSize:13}} />
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>
        {vars.map(v=>(
          <span key={v} style={{fontSize:11,fontWeight:600,color:'var(--blue)',background:'var(--blue-dim)',border:'1px solid var(--blue-mid)',borderRadius:7,padding:'2px 8px'}}>{`{${v}}`}</span>
        ))}
      </div>
    </div>
  )
}
function Area({ label, val, set }: { label:string; val:any; set:(v:string)=>void }) {
  return (
    <div>
      <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>{label}</label>
      <textarea value={val||''} onChange={e=>set(e.target.value)} rows={3} className="input-field" style={{resize:'none',lineHeight:1.5}} />
    </div>
  )
}

/* ───────── SHARED ───────── */
function SectionTitle({ title, count }: { title:string; count?:number }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14}}>
      <h2 className="section-title">{title}</h2>
      {count!==undefined && count>0 && (
        <span style={{
          display:'inline-flex',alignItems:'center',
          background:'var(--blue-dim)',color:'var(--blue)',
          fontSize:12,fontWeight:700,height:22,borderRadius:11,padding:'0 11px',
          letterSpacing:'-0.01em'
        }}>
          {count} nouveau{count>1?'x':''}
        </span>
      )}
    </div>
  )
}
function Empty({ Icon, title, sub }: { Icon:any; title:string; sub:string }) {
  return (
    <div style={{textAlign:'center',padding:'48px 0'}} className="a-fadeIn">
      <div className="icon-tile" style={{width:56,height:56,borderRadius:16,background:'var(--surface)',border:'1px solid var(--border)',margin:'0 auto 14px'}}><Icon size={24} color="var(--text3)" /></div>
      <p style={{fontSize:15,fontWeight:600,marginBottom:4}}>{title}</p>
      <p style={{fontSize:13,color:'var(--text3)'}}>{sub}</p>
    </div>
  )
}

// Catégorie en sourdine : point coloré + texte neutre (le bleu reste réservé à l'action)
function CatLabel({ type }: { type:string }) {
  const s = svc(type)
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:'var(--text2)'}}>
      <span style={{width:9,height:9,borderRadius:'50%',background:s.color,flexShrink:0}} />
      {type}
    </span>
  )
}

// Délai avant la relance auto (cron quotidien 13h UTC, éligible 2h après l'envoi des créneaux)
function relanceDansLabel(envoyeAt: string): string {
  const eligible = new Date(envoyeAt).getTime() + 2 * 3600e3
  const ref = Math.max(Date.now(), eligible)
  const run = new Date(ref); run.setUTCHours(13, 0, 0, 0)
  if (run.getTime() < ref) run.setUTCDate(run.getUTCDate() + 1)
  const h = Math.round((run.getTime() - Date.now()) / 3600e3)
  if (h <= 1) return 'Relance imminente'
  if (h < 24) return `Relance auto dans ${h} h`
  return `Relance auto dans ${Math.round(h / 24)} j`
}

function CardDemande({ d, i, onCreneaux }: { d:Demande; i:number; onCreneaux:()=>void }) {
  const enAttente = d.statut === 'creneau_propose'
  return (
    <div className={`card card-client card-interactive a-fadeUp d${Math.min(i+1,6)}`} style={{padding:15}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:16,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.client_nom}</p>
          <div style={{display:'flex',alignItems:'center',gap:10,marginTop:5,flexWrap:'wrap'}}>
            <CatLabel type={d.type_intervention} />
            {d.client_adresse && <Meta Icon={MapPin} txt={d.client_adresse} />}
          </div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          {d.prix_estime ? <span className="amount-green" style={{fontSize:20}}>{eur(d.prix_estime)}</span> : null}
          {enAttente && <p style={{fontSize:11,fontWeight:700,color:'var(--text3)',marginTop:3}}>En attente</p>}
          {enAttente && (d.relance_envoyee
            ? <p style={{fontSize:10,color:'var(--green)',marginTop:1,fontWeight:600}}>Relancé ✓</p>
            : d.creneaux_envoyes_at && <p style={{fontSize:10,color:'var(--text3)',marginTop:1}}>{relanceDansLabel(d.creneaux_envoyes_at)}</p>)}
        </div>
      </div>
      {d.client_description && (
        <p style={{fontSize:12.5,color:'var(--text3)',fontStyle:'italic',borderLeft:'2px solid var(--border2)',paddingLeft:11,margin:'12px 0 0',lineHeight:1.5}}>{d.client_description}</p>
      )}
      <div style={{display:'flex',gap:8,marginTop:14}}>
        <a href={`tel:${d.client_telephone}`} className="fab" style={{color:'var(--blue)'}} aria-label="Appeler"><Phone size={18} /></a>
        <button onClick={onCreneaux} className="btn-primary" style={{flex:1,height:46,padding:'0 14px',fontSize:13}}><CalendarDays size={16}/>Proposer un créneau</button>
      </div>
    </div>
  )
}

function CardChantier({ d, onValider, onDelete, validating, removing=false }: { d:Demande; onValider:()=>void; onDelete?:()=>void; validating:boolean; removing?:boolean; highlight?:boolean }) {
  const c = d.creneau_accepte
  const [armDel, setArmDel] = useState(false)
  const onTrash = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (armDel) { onDelete?.(); setArmDel(false); return }
    haptic(8); setArmDel(true)
  }
  // Cliquer ailleurs (ou attendre 3 s) annule la confirmation
  useEffect(() => {
    if (!armDel) return
    const cancel = () => setArmDel(false)
    const attach = setTimeout(() => document.addEventListener('click', cancel), 0)
    const reset = setTimeout(() => setArmDel(false), 3000)
    return () => { clearTimeout(attach); clearTimeout(reset); document.removeEventListener('click', cancel) }
  }, [armDel])
  return (
   <div style={{ display:'grid', gridTemplateRows: removing ? '0fr' : '1fr', opacity: removing ? 0 : 1, transform: removing ? 'scale(.98)' : 'none', transition:'grid-template-rows .45s cubic-bezier(.4,0,.2,1), opacity .35s ease, transform .4s cubic-bezier(.4,0,.2,1)' }}>
    <div style={{ overflow:'hidden', minHeight:0 }}>
    <div className="card card-client card-interactive" style={{padding:15, marginBottom:10}}>
      {c && <p style={{fontSize:14,fontWeight:700,color:'var(--text2)',letterSpacing:'-0.01em',marginBottom:8}}>{formatHeure(c.heure_debut)} – {formatHeure(c.heure_fin)}</p>}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
        <p style={{fontSize:16,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.client_nom}</p>
        <span className="amount-green" style={{fontSize:22,flexShrink:0}}>{eur(d.prix_estime||0)}</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginTop:5,marginBottom:14,flexWrap:'wrap'}}>
        <CatLabel type={d.type_intervention} />
        {d.client_adresse && <Meta Icon={MapPin} txt={d.client_adresse} />}
      </div>
      <div style={{display:'flex',gap:8}}>
        {armDel
          ? <button onClick={onTrash} style={{flex:'0 0 auto',height:48,padding:'0 14px',borderRadius:14,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,color:'#fff',display:'inline-flex',alignItems:'center',gap:6,background:'linear-gradient(180deg,#ef4444,#dc2626)',boxShadow:'0 4px 14px rgba(220,38,38,0.28)'}}><Trash2 size={16}/>Confirmer</button>
          : <button onClick={onTrash} className="fab" style={{height:48,color:'var(--text3)'}} aria-label="Supprimer"><Trash2 size={18} /></button>}
        <a href={`tel:${d.client_telephone}`} className="fab" style={{height:48,color:'var(--blue)'}} aria-label="Appeler"><Phone size={18} /></a>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.client_adresse)}&travelmode=driving`} target="_blank" rel="noreferrer" className="fab" style={{height:48,color:'var(--blue)'}} aria-label="Itinéraire"><MapPin size={18} /></a>
        <button onClick={onValider} disabled={validating} className="btn-success" style={{flex:1,height:48,fontSize:15}}>
          {validating ? <span className="spinner spinner-w" /> : 'Validé'}
        </button>
      </div>
    </div>
    </div>
   </div>
  )
}

function ModalAjout({ artisan, onClose, onAjouter }: { artisan:Artisan; onClose:()=>void; onAjouter:(p:any)=>Promise<boolean> }) {
  const types = (artisan.types_chantier || []) as TypeChantier[]
  const [nom, setNom] = useState('')
  const [tel, setTel] = useState('')
  const [adresse, setAdresse] = useState('')
  const [type, setType] = useState(types[0]?.type || 'Autre')
  const [prix, setPrix] = useState<number>(types[0]?.prix_base || 0)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [hd, setHd] = useState('08:00')
  const [hf, setHf] = useState('12:00')
  const [saving, setSaving] = useState(false)

  function pickType(t: string) {
    setType(t)
    const tc = types.find(x => x.type === t)
    if (tc) setPrix(tc.prix_base)
  }
  async function submit() {
    if (!nom.trim()) return
    setSaving(true)
    const ok = await onAjouter({ client_nom: nom.trim(), client_telephone: tel, client_adresse: adresse, type_intervention: type, prix, date, heure_debut: hd, heure_fin: hf })
    if (!ok) setSaving(false)
  }

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:50,background:'rgba(8,14,30,0.5)',backdropFilter:'blur(6px)',display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} className="a-slideUp" style={{width:'100%',maxWidth:480,margin:'0 auto',background:'var(--surface)',borderRadius:'26px 26px 0 0',padding:'12px 16px 32px',boxShadow:'var(--shadow-lg)',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{width:36,height:4,background:'var(--border2)',borderRadius:2,margin:'0 auto 20px'}} />
        <p style={{fontSize:18,fontWeight:800,letterSpacing:'-0.03em',marginBottom:4}}>Ajouter un chantier</p>
        <p style={{fontSize:13,color:'var(--text3)',marginBottom:16}}>Un chantier obtenu par téléphone ou bouche-à-oreille.</p>

        <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Client</label>
        <input value={nom} onChange={e=>setNom(e.target.value)} placeholder="Nom du client" className="input-field" style={{marginBottom:14}} />

        <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:8}}>Type d'intervention</label>
        <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:14}}>
          {types.map(t => {
            const on = type === t.type
            return (
              <button key={t.type} onClick={()=>pickType(t.type)} style={{padding:'8px 13px',borderRadius:11,fontSize:13,fontWeight:600,cursor:'pointer',transition:'all .15s',
                background:on?'var(--blue)':'var(--surface2)',color:on?'#fff':'var(--text2)',border:`1px solid ${on?'var(--blue)':'var(--border)'}`}}>{t.type}</button>
            )
          })}
        </div>

        <div style={{display:'flex',gap:10,marginBottom:14}}>
          <div style={{flex:1}}>
            <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Montant (€)</label>
            <input type="number" value={prix} onChange={e=>setPrix(+e.target.value)} className="input-field" />
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="input-field" />
          </div>
        </div>

        <div style={{display:'flex',gap:10,marginBottom:14}}>
          <div style={{flex:1}}>
            <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Début</label>
            <input type="time" value={hd} onChange={e=>setHd(e.target.value)} className="input-field" />
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Fin</label>
            <input type="time" value={hf} onChange={e=>setHf(e.target.value)} className="input-field" />
          </div>
        </div>

        <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Téléphone <span style={{color:'var(--text3)',fontWeight:500}}>(optionnel)</span></label>
        <input type="tel" value={tel} onChange={e=>setTel(e.target.value)} placeholder="+596 696 00 00 00" className="input-field" style={{marginBottom:14}} />

        <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Adresse <span style={{color:'var(--text3)',fontWeight:500}}>(optionnel)</span></label>
        <input value={adresse} onChange={e=>setAdresse(e.target.value)} placeholder="Lieu du chantier" className="input-field" style={{marginBottom:20}} />

        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} className="btn-ghost" style={{flex:1}}>Annuler</button>
          <button onClick={submit} disabled={!nom.trim() || saving} className="btn-primary" style={{flex:1}}>
            {saving ? <span className="spinner spinner-w" /> : <><Plus size={16}/>Ajouter</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalCreneaux({ d, artisan, confirmes, onClose, onProposer }: { d:Demande; artisan:Artisan; confirmes:Demande[]; onClose:()=>void; onProposer:(id:string,c:any[])=>void }) {
  // Suggestion automatique à l'ouverture, selon le planning + préférences
  const suggestion = useState(() => suggererCreneaux({
    envergure: d.envergure || 'moyen',
    typeIntervention: d.type_intervention,
    confirmes,
    horaires: artisan.horaires,
    typesChantier: artisan.types_chantier,
    preferences: artisan.preferences_creneaux,
    indisponibilites: artisan.indisponibilites,
    nb: 3,
  }))[0]

  const init = suggestion.length > 0 ? suggestion : [
    { date:'', heure_debut:'08:00', heure_fin:'12:00' },
    { date:'', heure_debut:'14:00', heure_fin:'18:00' },
  ]
  const [creneaux, setCreneaux] = useState(init)
  const upd = (i:number,f:string,v:string) => setCreneaux(p=>p.map((c,idx)=>idx===i?{...c,[f]:v}:c))
  const del = (i:number) => setCreneaux(p=>p.filter((_,idx)=>idx!==i))
  const add = () => creneaux.length<3 && setCreneaux(p=>[...p,{date:'',heure_debut:'08:00',heure_fin:'12:00'}])
  const valides = creneaux.filter(c=>c.date)
  const prefLabel: Record<string,string> = { matin:'matinée', 'apres-midi':'après-midi', flexible:'flexible' }
  const pref = (artisan.preferences_creneaux as any)?.[d.envergure||'moyen'] || 'flexible'

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:50,background:'rgba(8,14,30,0.5)',backdropFilter:'blur(6px)',display:'flex',alignItems:'flex-end'}}>
      <div onClick={e=>e.stopPropagation()} className="a-slideUp" style={{width:'100%',maxWidth:480,margin:'0 auto',background:'var(--surface)',borderRadius:'26px 26px 0 0',padding:'12px 16px 32px',boxShadow:'var(--shadow-lg)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{width:36,height:4,background:'var(--border2)',borderRadius:2,margin:'0 auto 20px'}} />
        <p style={{fontSize:18,fontWeight:700,letterSpacing:'-0.03em',marginBottom:4}}>Proposer des créneaux</p>
        <p style={{fontSize:13,color:'var(--text3)',marginBottom:14}}>{d.client_nom} · {d.type_intervention}</p>

        {/* Bandeau suggestion intelligente */}
        {suggestion.length > 0 && (
          <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--blue-dim)',border:'1px solid var(--blue-mid)',borderRadius:12,padding:'10px 12px',marginBottom:14}}>
            <div className="icon-tile" style={{width:30,height:30,borderRadius:9,background:'var(--blue)',boxShadow:'none'}}><CalendarDays size={15} color="#fff"/></div>
            <p style={{fontSize:12,color:'var(--text2)',lineHeight:1.4,flex:1}}>
              Créneaux proposés selon votre planning et votre préférence <b style={{color:'var(--blue)'}}>{prefLabel[pref]}</b> pour ce type de chantier.
            </p>
          </div>
        )}

        {/* Sélecteur de jour — centré sur la semaine, mais déroulant aussi loin que voulu */}
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8}}>
          <p style={{fontSize:11,fontWeight:700,color:'var(--label)',letterSpacing:'0.06em',textTransform:'uppercase'}}>Choisir un jour</p>
          <span style={{fontSize:10,color:'var(--text3)'}}>faites défiler →</span>
        </div>
        <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:16,paddingBottom:4,scrollSnapType:'x proximity'}}>
          {Array.from({length:JOURS_VISIBLES},(_,i)=>{
            const x=new Date(); x.setHours(0,0,0,0); x.setDate(x.getDate()+i)
            const ds=x.toDateString(); const iso=x.toISOString().split('T')[0]
            const jour=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'][x.getDay()]
            const ferme = !(artisan.horaires as any)?.[jour]?.actif
            const nbCh=confirmes.filter(c=>c.creneau_accepte && c.date_chantier && new Date(c.date_chantier).toDateString()===ds).length
            const nbInd=((artisan.indisponibilites as any[])||[]).filter(b=>b.date===iso).length
            const occupe=nbCh+nbInd
            const libre=!ferme && occupe===0
            const choisi=creneaux.some(c=>c.date===iso)
            // Séparateur léger au début de chaque nouvelle semaine (lundi), sauf le 1er
            const nouvelleSemaine = i>0 && x.getDay()===1
            return (
              <div key={i} style={{display:'flex',alignItems:'stretch',gap:6,flexShrink:0,scrollSnapAlign:'start'}}>
                {nouvelleSemaine && <div style={{width:1,background:'var(--border2)',margin:'4px 0',flexShrink:0}} />}
                <button onClick={()=>setCreneaux(p=>{ const idx=p.findIndex(c=>!c.date); const t=idx>=0?idx:0; return p.map((c,j)=>j===t?{...c,date:iso}:c) })}
                  style={{width:52,padding:'8px 0',borderRadius:11,border:`2px solid ${choisi?'var(--blue)':libre?'#a7f3d0':occupe?'#fecaca':'var(--border)'}`,background:choisi?'var(--blue-dim)':ferme?'var(--surface2)':libre?'var(--green-dim)':'var(--red-dim)',cursor:'pointer',textAlign:'center'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--text3)',textTransform:'uppercase'}}>{['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][x.getDay()]}</div>
                  <div style={{fontSize:17,fontWeight:800,color:choisi?'var(--blue)':'var(--text)'}}>{x.getDate()}</div>
                  <div style={{fontSize:9,fontWeight:600,color:ferme?'var(--text3)':libre?'var(--green)':'var(--red)'}}>{ferme?'Fermé':libre?'Libre':`${occupe} pris`}</div>
                </button>
              </div>
            )
          })}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
          {creneaux.map((c,i)=>(
            <div key={i} style={{background:'var(--surface2)',borderRadius:13,padding:12,border:`1px solid ${c.date?'var(--blue-mid)':'var(--border)'}`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <p style={{fontSize:13,fontWeight:800,letterSpacing:'-0.01em',color:c.date?'var(--blue)':'var(--text3)'}}>{creneauLisible(c.date,c.heure_debut,c.heure_fin)}</p>
                {creneaux.length>1 && <button onClick={()=>del(i)} className="fab" style={{width:26,height:26,color:'var(--red)'}}><Trash2 size={13}/></button>}
              </div>
              <div style={{display:'flex',gap:6}}>
                <input type="date" value={c.date} onChange={e=>upd(i,'date',e.target.value)} min={new Date().toISOString().split('T')[0]} className="input-field" style={{flex:1,padding:'10px 12px',fontSize:13}} />
                <input type="time" value={c.heure_debut} onChange={e=>upd(i,'heure_debut',e.target.value)} className="input-field" style={{width:82,padding:'10px 6px',fontSize:13}} />
                <input type="time" value={c.heure_fin} onChange={e=>upd(i,'heure_fin',e.target.value)} className="input-field" style={{width:82,padding:'10px 6px',fontSize:13}} />
              </div>
            </div>
          ))}
          {creneaux.length<3 && <button onClick={add} className="btn-ghost" style={{padding:'10px'}}><Plus size={15}/>Ajouter un créneau</button>}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} className="btn-ghost" style={{flex:1}}>Annuler</button>
          <button onClick={()=>onProposer(d.id,valides)} disabled={valides.length===0} className="btn-primary" style={{flex:1}}>Envoyer au client ({valides.length})</button>
        </div>
      </div>
    </div>
  )
}
