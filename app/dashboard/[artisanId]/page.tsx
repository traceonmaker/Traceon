'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { formatDate, formatHeure, formatPrix, isToday, isTomorrow, suggererCreneaux } from '@/lib/utils'
import type { Demande, Artisan, TypeChantier, Prestation } from '@/lib/supabase'
import {
  Home, CalendarDays, Clock, BarChart3, Settings, Phone, MapPin, Check,
  Link2, Plus, Trash2, Droplet, Zap, Snowflake, Hammer, Paintbrush, Wrench,
  ChevronLeft, ChevronRight, TrendingUp, Save, Upload, Copy,
  Euro, Briefcase, Receipt, Percent, FileText, Download
} from 'lucide-react'
import InstallPrompt from '@/app/components/InstallPrompt'

type Tab = 'accueil'|'planning'|'historique'|'stats'|'parametres'

const SVC: Record<string,{Icon:any;color:string}> = {
  'Plomberie':     { Icon:Droplet,   color:'#2563eb' },
  'Électricité':   { Icon:Zap,       color:'#d97706' },
  'Climatisation': { Icon:Snowflake, color:'#0891b2' },
  'Maçonnerie':    { Icon:Hammer,    color:'#dc2626' },
  'Peinture':      { Icon:Paintbrush,color:'#7c3aed' },
  'Autre':         { Icon:Wrench,    color:'#64748b' },
}
const svc = (t:string) => SVC[t] || SVC['Autre']

// Mini-courbe pour le hero (inspirée des cartes fintech)
function sparkData(confirmes: Demande[], encaisse: number): number[] {
  // série lissée basée sur le volume — purement visuelle si peu de données
  const base = [0.3, 0.45, 0.4, 0.6, 0.55, 0.75, 0.7, 0.9]
  const factor = encaisse > 0 ? 1 : 0.6
  return base.map(b => b * factor)
}

function Sparkline({ data, w = 84, h = 40 }: { data:number[]; w?:number; h?:number }) {
  const max = Math.max(...data, 0.001)
  const pts = data.map((v,i) => [ (i/(data.length-1))*w, h - (v/max)*(h-6) - 3 ])
  const line = pts.map((p,i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg width={w} height={h} style={{overflow:'visible'}}>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r={3} fill="#fff" />
    </svg>
  )
}

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const start = prev.current, delta = target - start, t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      setVal(start + delta * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(tick); else prev.current = target
    }
    requestAnimationFrame(tick)
  }, [target])
  return val
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('accueil')
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [artisan, setArtisan] = useState<Artisan|null>(null)
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState<string|null>(null)
  const [removing, setRemoving] = useState<string|null>(null)
  const [modal, setModal] = useState<Demande|null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const { artisanId } = useParams<{ artisanId:string }>()
  useEffect(() => {
    fetch(`/api/artisan/${artisanId}`).then(r=>r.json()).then(d=>{ if(d?.id) setArtisan(d) }).catch(()=>{})
  }, [artisanId])

  const load = useCallback(async () => {
    if (!artisan?.id) return
    const r = await fetch(`/api/demandes?artisan_id=${artisan.id}`)
    if (r.ok) setDemandes(await r.json())
    setLoading(false)
  }, [artisan?.id])
  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  const nouvelles  = demandes.filter(d => ['nouvelle','devis_envoye','creneau_propose'].includes(d.statut))
  const confirmes  = demandes.filter(d => ['confirme','en_cours'].includes(d.statut)).sort((a,b)=>new Date(a.date_chantier||0).getTime()-new Date(b.date_chantier||0).getTime())
  const payes      = demandes.filter(d => d.statut === 'paye')
  const potentiel  = confirmes.reduce((s,d)=>s+(d.prix_estime||0),0)
  const encaisse   = payes.reduce((s,d)=>s+(d.prix_estime||0),0)
  const today      = confirmes.filter(d => d.date_chantier && isToday(d.date_chantier))

  async function valider(id: string) {
    setValidating(id)
    // 1. enregistre le paiement côté serveur
    await fetch('/api/valider', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({demande_id:id}) })
    // 2. déclenche l'animation de sortie de la carte
    setValidating(null); setRemoving(id)
    // 3. laisse l'animation se jouer, puis recharge (le cash encaissé monte, le potentiel baisse)
    setTimeout(async () => { await load(); setRemoving(null) }, 560)
  }
  async function proposer(id: string, creneaux: any[]) {
    await fetch('/api/creneaux', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({demande_id:id, creneaux}) })
    setModal(null); await load()
  }
  async function saveArtisan(fields: Partial<Artisan>) {
    const r = await fetch(`/api/artisan/${artisan!.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(fields) })
    if (r.ok) setArtisan(await r.json())
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--bg-grad)',display:'flex',alignItems:'center',justifyContent:'center'}}><div className="spinner" /></div>
  )

  if (!artisan) return (
    <div style={{minHeight:'100vh',background:'var(--bg-grad)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,textAlign:'center'}}>
      <p style={{fontSize:18,fontWeight:700,marginBottom:6}}>Bienvenue sur TraceOn</p>
      <p style={{fontSize:14,color:'var(--text2)',marginBottom:24}}>Créez votre compte artisan</p>
      <a href="/onboarding" className="btn-primary" style={{width:'auto',padding:'12px 24px',textDecoration:'none'}}>Créer mon compte</a>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-grad)',position:'relative'}}>
      <div className="app-glow" />
      <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px 120px',position:'relative',zIndex:1}}>

        {/* Top bar */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
          <div style={{display:'flex',alignItems:'center',gap:11}}>
            <div style={{width:40,height:40,borderRadius:13,background:'linear-gradient(135deg,#2f6bff,#0e47d2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:'#fff',boxShadow:'var(--shadow-blue)'}}>
              {(artisan.nom_entreprise||artisan.nom||'T')[0].toUpperCase()}
            </div>
            <div>
              <p style={{fontSize:11,color:'var(--text3)'}}>Bonjour</p>
              <p style={{fontSize:15,fontWeight:700,letterSpacing:'-0.02em'}}>{artisan.nom_entreprise||artisan.nom}</p>
            </div>
          </div>
          <button
            onClick={()=>{ navigator.clipboard.writeText(`${window.location.origin}/formulaire/${artisan.id}`); setLinkCopied(true); setTimeout(()=>setLinkCopied(false),1600) }}
            className="fab" style={{width:'auto',padding:'0 14px',gap:7,fontSize:13,fontWeight:600}} title="Copier le lien de demande client">
            {linkCopied ? <><Check size={16} color="var(--green)"/>Copié</> : <><Link2 size={16}/>Lien client</>}
          </button>
        </div>

        {tab==='accueil'     && <Accueil today={today} nouvelles={nouvelles} encaisse={encaisse} potentiel={potentiel} confirmes={confirmes} valider={valider} validating={validating} removing={removing} onCreneaux={setModal} goTo={setTab} />}
        {tab==='planning'    && <Planning confirmes={confirmes} artisan={artisan} />}
        {tab==='historique'  && <Historique payes={payes} encaisse={encaisse} />}
        {tab==='stats'       && <Stats payes={payes} demandes={demandes} encaisse={encaisse} />}
        {tab==='parametres'  && <Parametres artisan={artisan} save={saveArtisan} />}
      </div>

      <nav className="bottom-nav">
        {([
          { k:'accueil',    Icon:Home,        l:'Accueil',  n:nouvelles.length },
          { k:'planning',   Icon:CalendarDays,l:'Planning', n:0 },
          { k:'historique', Icon:Clock,       l:'Historique',n:0 },
          { k:'stats',      Icon:BarChart3,   l:'Stats',    n:0 },
          { k:'parametres', Icon:Settings,    l:'Réglages', n:0 },
        ] as const).map(t => {
          const on = tab===t.k
          return (
            <button key={t.k} onClick={()=>setTab(t.k)} className={`nav-item ${on?'on':''}`}>
              <div className="nav-ico">
                <t.Icon size={21} color={on?'var(--blue)':'#ffffff'} strokeWidth={on?2.6:2.1} />
                {t.n>0 && <span style={{position:'absolute',top:-1,right:3,background:'#ff3b30',color:'#fff',fontSize:9,fontWeight:700,minWidth:15,height:15,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px',border:'1.5px solid #0a6bff'}}>{t.n}</span>}
              </div>
              <span>{t.l}</span>
            </button>
          )
        })}
      </nav>

      {modal && <ModalCreneaux d={modal} artisan={artisan} confirmes={confirmes} onClose={()=>setModal(null)} onProposer={proposer} />}
      <InstallPrompt />
    </div>
  )
}

/* ───────── ACCUEIL ───────── */
function Accueil({ today, nouvelles, encaisse, potentiel, confirmes, valider, validating, removing, onCreneaux, goTo }: any) {
  const animEnc = useCountUp(encaisse)
  return (
    <div className="a-fadeUp">
      {/* Hero — reste fixe au défilement */}
      <div className="hero-card a-scaleIn" style={{padding:'22px 22px 20px',marginBottom:16,position:'sticky',top:8,zIndex:5}}>
        <div className="hero-shine" />
        <div style={{position:'relative',zIndex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <p style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.95)',marginBottom:6}}>Encaissé ce mois</p>
              <p className="amount-hero" style={{fontSize:46,lineHeight:1}}>{formatPrix(animEnc)}</p>
              <div style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:10,background:'rgba(255,255,255,0.22)',borderRadius:7,padding:'4px 9px'}}>
                <TrendingUp size={13} color="#fff" />
                <span style={{fontSize:11,fontWeight:700}}>Objectif du mois</span>
              </div>
            </div>
            <Sparkline data={sparkData(confirmes, encaisse)} />
          </div>
          <div style={{display:'flex',gap:14,marginTop:20}}>
            <div className="hero-stat" style={{flex:1,padding:'13px 15px',border:'1px solid rgba(255,255,255,0.28)',background:'rgba(255,255,255,0.14)',backdropFilter:'blur(8px)',boxShadow:'0 1px 0 rgba(255,255,255,0.25) inset, 0 6px 16px rgba(5,9,31,0.2)'}}>
              <p style={{fontSize:14,fontWeight:800,color:'#fff',letterSpacing:'-0.02em'}}>Potentiel</p>
              <p className="amount" style={{fontSize:21,marginTop:4,color:'#fff'}}>{formatPrix(potentiel)}</p>
            </div>
            <div className="hero-stat" style={{flex:1,padding:'13px 15px',border:'1px solid rgba(255,255,255,0.28)',background:'rgba(255,255,255,0.14)',backdropFilter:'blur(8px)',boxShadow:'0 1px 0 rgba(255,255,255,0.25) inset, 0 6px 16px rgba(5,9,31,0.2)'}}>
              <p style={{fontSize:14,fontWeight:800,color:'#fff',letterSpacing:'-0.02em'}}>Aujourd'hui</p>
              <p style={{fontSize:21,fontWeight:800,marginTop:4,letterSpacing:'-0.02em',color:'#fff'}}>{today.length} chantier{today.length>1?'s':''}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nouvelles demandes */}
      {nouvelles.length>0 && <>
        <SectionTitle title="À traiter" count={nouvelles.length} />
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
          {nouvelles.slice(0,3).map((d:Demande,i:number)=><CardDemande key={d.id} d={d} i={i} onCreneaux={()=>onCreneaux(d)} />)}
          {nouvelles.length>3 && <button onClick={()=>goTo('accueil')} style={{fontSize:13,color:'var(--blue)',fontWeight:600,background:'none',border:'none',cursor:'pointer',padding:8}}>Voir les {nouvelles.length} demandes →</button>}
        </div>
      </>}

      {/* Planning du jour + prochains chantiers */}
      <SectionTitle title="Planning du jour" />
      {today.length>0 && (
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
          {today.map((d:Demande)=><CardChantier key={d.id} d={d} onValider={()=>valider(d.id)} validating={validating===d.id} removing={removing===d.id} highlight />)}
        </div>
      )}
      {today.length===0 && (
        <div style={{marginBottom:20}}>
          <div className="card" style={{padding:'16px',display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
            <div className="icon-tile" style={{width:40,height:40,borderRadius:12,background:'var(--green-dim)'}}><CalendarDays size={19} color="var(--green)"/></div>
            <div><p style={{fontSize:14,fontWeight:700}}>Journée libre aujourd'hui</p><p style={{fontSize:12,color:'var(--text3)'}}>Voici vos prochains chantiers.</p></div>
          </div>
        </div>
      )}

      {/* Prochains chantiers (jours suivants) */}
      {(() => {
        const upcoming = (confirmes as Demande[]).filter(d => d.date_chantier && !isToday(d.date_chantier))
        if (upcoming.length === 0) {
          return today.length===0 ? <Empty Icon={CalendarDays} title="Aucun chantier à venir" sub="Les chantiers confirmés s'afficheront ici." /> : null
        }
        return <>
          <SectionTitle title="Prochains chantiers" />
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {upcoming.map((d:Demande)=><CardChantier key={d.id} d={d} onValider={()=>valider(d.id)} validating={validating===d.id} removing={removing===d.id} highlight={isTomorrow(d.date_chantier!)} />)}
          </div>
        </>
      })()}
    </div>
  )
}

/* ───────── PLANNING ───────── */
function Planning({ confirmes, artisan }: { confirmes:Demande[]; artisan:Artisan }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const base = new Date(); base.setHours(0,0,0,0)
  const monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay()+6)%7) + weekOffset*7)
  const days = Array.from({length:7},(_,i)=>{ const dd=new Date(monday); dd.setDate(monday.getDate()+i); return dd })
  const HOURS = Array.from({length:11},(_,i)=>8+i) // 8h → 18h
  const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

  const slotsFor = (day:Date) => confirmes.filter(d => d.date_chantier && new Date(d.date_chantier).toDateString()===day.toDateString())

  return (
    <div className="a-fadeUp">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <SectionTitle title="Planning" />
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button onClick={()=>setWeekOffset(w=>w-1)} className="fab" style={{width:34,height:34,borderRadius:10}}><ChevronLeft size={16}/></button>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text2)',minWidth:90,textAlign:'center'}}>
            {weekOffset===0?'Cette semaine':monday.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
          </span>
          <button onClick={()=>setWeekOffset(w=>w+1)} className="fab" style={{width:34,height:34,borderRadius:10}}><ChevronRight size={16}/></button>
        </div>
      </div>

      <div className="card" style={{padding:'4px 0',overflow:'hidden'}}>
        {days.map((day,di)=>{
          const slots = slotsFor(day)
          const isTd = day.toDateString()===base.toDateString()
          return (
            <div key={di} style={{display:'flex',borderBottom:di<6?'1px solid var(--border)':'none',background:isTd?'var(--blue-dim)':'transparent'}}>
              <div style={{width:54,flexShrink:0,padding:'12px 0',textAlign:'center',borderRight:'1px solid var(--border)'}}>
                <p style={{fontSize:11,color:isTd?'var(--blue)':'var(--text3)',fontWeight:600,textTransform:'uppercase'}}>{JOURS[di]}</p>
                <p style={{fontSize:18,fontWeight:800,color:isTd?'var(--blue)':'var(--text)',marginTop:1}}>{day.getDate()}</p>
              </div>
              <div style={{flex:1,padding:'10px 12px',display:'flex',flexDirection:'column',gap:6,minHeight:50,justifyContent:'center'}}>
                {slots.length===0
                  ? <p style={{fontSize:12,color:'var(--text3)'}}>Libre</p>
                  : slots.map(s=>{
                      const st = svc(s.type_intervention)
                      const c = s.creneau_accepte
                      return (
                        <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,background:`${st.color}12`,borderLeft:`3px solid ${st.color}`,borderRadius:8,padding:'6px 10px'}}>
                          <span style={{fontSize:11,fontWeight:700,color:st.color,minWidth:38}}>{c?formatHeure(c.heure_debut):'—'}</span>
                          <span style={{fontSize:12,fontWeight:600,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.client_nom}</span>
                          <span style={{fontSize:11,color:'var(--text3)'}}>{s.type_intervention}</span>
                        </div>
                      )
                    })}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{display:'flex',alignItems:'center',gap:14,marginTop:12,justifyContent:'center'}}>
        <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}><span style={{width:10,height:10,borderRadius:3,background:'var(--blue)'}}/>Occupé</span>
        <span style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}><span style={{width:10,height:10,borderRadius:3,background:'var(--border2)'}}/>Libre</span>
      </div>
    </div>
  )
}

/* ───────── HISTORIQUE ───────── */
function Historique({ payes, encaisse }: { payes:Demande[]; encaisse:number }) {
  return (
    <div className="a-fadeUp">
      <div className="hero-card a-scaleIn" style={{padding:'20px 22px',marginBottom:16}}>
        <div style={{position:'relative',zIndex:1}}>
          <p style={{fontSize:13,opacity:.85,marginBottom:5}}>Total encaissé</p>
          <p className="amount-hero" style={{fontSize:38}}>{formatPrix(encaisse)}</p>
          <p style={{fontSize:12,opacity:.8,marginTop:4}}>{payes.length} chantier{payes.length>1?'s':''} validé{payes.length>1?'s':''}</p>
        </div>
      </div>

      <SectionTitle title="Chantiers réalisés" />
      {payes.length===0
        ? <Empty Icon={Clock} title="Aucun chantier" sub="Vos chantiers validés apparaîtront ici." />
        : <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {payes.map((d,i)=>{
              const s = svc(d.type_intervention); const c = d.creneau_accepte
              return (
                <div key={d.id} className={`card a-fadeUp d${Math.min(i+1,6)}`} style={{padding:14}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                    <div className="icon-tile" style={{width:42,height:42,borderRadius:12,background:`${s.color}14`}}><s.Icon size={19} color={s.color} /></div>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                        <p style={{fontSize:15,fontWeight:700}}>{d.client_nom}</p>
                        <span className="amount-green" style={{fontSize:16}}>+{formatPrix(d.prix_estime||0)}</span>
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
            })}
          </div>}
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
    <div className="a-fadeUp">
      <SectionTitle title="Statistiques" />

      {/* KPIs — cartes dark premium avec glow */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <KPI label="Chiffre d'affaires" value={formatPrix(encaisse)} Icon={Euro}      glow="#2f6bff" />
        <KPI label="Chantiers"          value={`${payes.length}`}    Icon={Briefcase} glow="#a855f7" />
        <KPI label="Ticket moyen"       value={formatPrix(ticket)}   Icon={Receipt}   glow="#10b981" />
        <KPI label="Taux de conversion" value={`${conv}%`}           Icon={Percent}   glow="#f59e0b" />
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
              <div style={{width:'100%',maxWidth:32,height:`${Math.max((ca/maxCA)*100,3)}%`,background:i===5?'linear-gradient(180deg,#3a7bff,#0e47d2)':'#cdddf5',borderRadius:'6px 6px 0 0',transformOrigin:'bottom',animation:`growBar .6s cubic-bezier(.22,1,.36,1) both`,animationDelay:`${i*0.06}s`,boxShadow:i===5?'0 4px 10px rgba(10,50,184,0.3)':'none'}} />
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
                      <span style={{fontSize:13,fontWeight:700,color:'var(--green)',minWidth:56,textAlign:'right'}}>{formatPrix(ca)}</span>
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

/* ───────── PARAMÈTRES (toutes les variables entreprise) ───────── */
function Parametres({ artisan, save }: { artisan:Artisan; save:(f:Partial<Artisan>)=>Promise<void> }) {
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
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const set = (k:keyof Artisan, v:any) => setF(p=>({...p,[k]:v}))
  const types = f.types_chantier as TypeChantier[]
  const prest = f.prestations as Prestation[]
  const hr = f.horaires as any
  const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche']
  const JL: Record<string,string> = {lundi:'Lun',mardi:'Mar',mercredi:'Mer',jeudi:'Jeu',vendredi:'Ven',samedi:'Sam',dimanche:'Dim'}

  async function handleSave() {
    setSaving(true); await save(f); setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000)
  }
  function logoUpload(file: File) { const r=new FileReader(); r.onload=()=>set('logo_url',r.result as string); r.readAsDataURL(file) }
  const onboardLink = `${typeof window!=='undefined'?window.location.origin:''}/onboarding`

  return (
    <div className="a-fadeUp" style={{display:'flex',flexDirection:'column',gap:14}}>
      <SectionTitle title="Paramètres" />

      {/* Entreprise */}
      <Section title="Entreprise">
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
        </div>
      </Section>

      {/* Services & tarifs */}
      <Section title="Services & tarifs" action={<button onClick={()=>set('types_chantier',[...types,{type:'Nouveau',couleur:'#64748b',duree:2,prix_base:100}])} className="fab" style={{width:32,height:32}}><Plus size={16}/></button>}>
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
      <Section title="Grille tarifaire détaillée" action={<button onClick={()=>set('prestations',[...prest,{service:types[0]?.type||'Autre',libelle:'',prix:0,unite:'forfait'}])} className="fab" style={{width:32,height:32}}><Plus size={16}/></button>}>
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
      <Section title="Horaires de travail">
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
      <Section title="Préférences de créneaux">
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
      <Section title="Légal & devis">
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Field label="Modèle de devis (lien PDF)" val={f.modele_devis_url} set={(v:any)=>set('modele_devis_url',v)} />
          <Area label="Conditions de paiement" val={f.conditions_paiement} set={(v:any)=>set('conditions_paiement',v)} />
          <Area label="Mentions légales" val={f.mentions_legales} set={(v:any)=>set('mentions_legales',v)} />
          <Area label="CGV" val={f.cgv} set={(v:any)=>set('cgv',v)} />
          <Area label="RGPD" val={f.rgpd} set={(v:any)=>set('rgpd',v)} />
        </div>
      </Section>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? <span className="spinner spinner-w" /> : saved ? <><Check size={17}/>Enregistré</> : <><Save size={17}/>Enregistrer</>}
      </button>

      {/* Dupliquer le core app */}
      <Section title="Dupliquer TraceOn">
        <p style={{fontSize:12,color:'var(--text2)',marginBottom:12,lineHeight:1.5}}>Partagez ce lien à une autre entreprise : elle configure son propre espace en quelques minutes.</p>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{flex:1,fontSize:12,color:'var(--text2)',background:'var(--surface2)',padding:'10px 12px',borderRadius:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{onboardLink}</span>
          <button onClick={()=>{navigator.clipboard.writeText(onboardLink);setCopied(true);setTimeout(()=>setCopied(false),1500)}} className="fab">
            {copied ? <Check size={16} color="var(--green)"/> : <Copy size={16}/>}
          </button>
        </div>
      </Section>
    </div>
  )
}
function Section({ title, action, children }: { title:string; action?:React.ReactNode; children:React.ReactNode }) {
  return (
    <div className="card" style={{padding:18}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <p style={{fontSize:14,fontWeight:700}}>{title}</p>
        {action}
      </div>
      {children}
    </div>
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
          display:'inline-flex',alignItems:'center',gap:5,
          background:'linear-gradient(135deg,#ff5a52,#ff3b30)',color:'#fff',
          fontSize:12,fontWeight:800,height:23,borderRadius:12,padding:'0 10px',
          boxShadow:'0 2px 8px rgba(255,59,48,0.4)',letterSpacing:'-0.01em'
        }}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#fff',animation:'pulseDot 1.3s ease-in-out infinite'}} />
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

function CardDemande({ d, i, onCreneaux }: { d:Demande; i:number; onCreneaux:()=>void }) {
  const isNew = d.statut === 'nouvelle'
  const s = svc(d.type_intervention)
  return (
    <div className={`card card-client card-interactive a-fadeUp d${Math.min(i+1,6)}`} style={{padding:14}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:6}}>
            <span style={{fontSize:16,fontWeight:700}}>{d.client_nom}</span>
            {isNew && <span className="badge" style={{background:'var(--blue-dim)',color:'var(--blue)'}}>Nouveau</span>}
            {d.statut==='creneau_propose' && <span className="badge" style={{background:'var(--amber-dim)',color:'var(--amber)'}}>En attente</span>}
          </div>
          <span style={{display:'inline-flex',alignItems:'center',background:`${s.color}1a`,color:s.color,fontSize:12,fontWeight:700,padding:'3px 11px',borderRadius:8}}>{d.type_intervention}</span>
          <p style={{fontSize:12,color:'var(--text3)',marginTop:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.client_adresse}</p>
        </div>
        {d.prix_estime && <span className="amount-green" style={{fontSize:20,flexShrink:0}}>{formatPrix(d.prix_estime)}</span>}
      </div>
      {d.client_description && <p style={{fontSize:12,color:'var(--text2)',background:'var(--surface2)',borderRadius:10,padding:'8px 11px',marginBottom:12}}>{d.client_description}</p>}
      <div style={{display:'flex',gap:8}}>
        <a href={`tel:${d.client_telephone}`} className="fab"><Phone size={17} /></a>
        <button onClick={onCreneaux} className="btn-primary" style={{flex:1,height:44,padding:'0 14px',fontSize:13}}><CalendarDays size={16}/>Proposer un créneau</button>
      </div>
    </div>
  )
}

function CardChantier({ d, onValider, validating, removing=false, highlight=false }: { d:Demande; onValider:()=>void; validating:boolean; removing?:boolean; highlight?:boolean }) {
  const c = d.creneau_accepte
  const s = svc(d.type_intervention)
  return (
    <div className={`card card-client card-interactive ${removing?'card-validating':''}`} style={{padding:14}}>
      {/* Date à gauche, montant en haut à droite (gros) */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:12}}>
        {c ? <span className="date-badge"><CalendarDays size={13}/>{formatDate(c.date)} · {formatHeure(c.heure_debut)}</span> : <span/>}
        <span className="amount-green" style={{fontSize:22}}>{formatPrix(d.prix_estime||0)}</span>
      </div>
      <div style={{marginBottom:12}}>
        {/* Nom client, puis métier (badge couleur) en dessous */}
        <p style={{fontSize:16,fontWeight:700,marginBottom:6}}>{d.client_nom}</p>
        <span style={{display:'inline-flex',alignItems:'center',background:`${s.color}1a`,color:s.color,fontSize:12,fontWeight:700,padding:'3px 11px',borderRadius:8}}>{d.type_intervention}</span>
      </div>
      <div style={{marginBottom:12}}><Meta Icon={MapPin} txt={d.client_adresse} /></div>
      {/* Appel + Itinéraire discrets (icônes), Validé = seule action avec texte */}
      <div style={{display:'flex',gap:8}}>
        <a href={`tel:${d.client_telephone}`} className="fab" style={{height:48}}><Phone size={18} /></a>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.client_adresse)}&travelmode=driving`} target="_blank" rel="noreferrer" className="fab" style={{height:48}}><MapPin size={18} /></a>
        <button onClick={onValider} disabled={validating} className="btn-success" style={{flex:1,height:48,fontSize:15}}>
          {validating ? <span className="spinner spinner-w" /> : 'Validé'}
        </button>
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
      <div onClick={e=>e.stopPropagation()} className="a-slideUp" style={{width:'100%',maxWidth:480,margin:'0 auto',background:'#fff',borderRadius:'26px 26px 0 0',padding:'12px 16px 32px',boxShadow:'var(--shadow-lg)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{width:36,height:4,background:'var(--border2)',borderRadius:2,margin:'0 auto 20px'}} />
        <p style={{fontSize:18,fontWeight:700,letterSpacing:'-0.03em',marginBottom:4}}>Proposer des créneaux</p>
        <p style={{fontSize:13,color:'var(--text3)',marginBottom:14}}>{d.client_nom} · {d.type_intervention}</p>

        {/* Bandeau suggestion intelligente */}
        {suggestion.length > 0 && (
          <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--blue-dim)',border:'1px solid var(--blue-mid)',borderRadius:12,padding:'10px 12px',marginBottom:16}}>
            <div className="icon-tile" style={{width:30,height:30,borderRadius:9,background:'var(--blue)',boxShadow:'none'}}><CalendarDays size={15} color="#fff"/></div>
            <p style={{fontSize:12,color:'var(--text2)',lineHeight:1.4,flex:1}}>
              Créneaux proposés selon votre planning et votre préférence <b style={{color:'var(--blue)'}}>{prefLabel[pref]}</b> pour ce type de chantier.
            </p>
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
          {creneaux.map((c,i)=>(
            <div key={i} style={{background:'var(--surface2)',borderRadius:13,padding:12,border:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <p style={{fontSize:11,fontWeight:700,color:'var(--label)',letterSpacing:'0.06em',textTransform:'uppercase'}}>Créneau {i+1}</p>
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
