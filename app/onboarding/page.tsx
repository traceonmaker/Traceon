'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { TypeChantier, Horaires } from '@/lib/supabase'
import { Phone, Building2, Check, ArrowRight, ArrowLeft, CheckCircle2, Copy, BellRing, MessageSquare, CalendarClock } from 'lucide-react'

const DEFAULT_TYPES: TypeChantier[] = [
  { type:'Plomberie',     couleur:'#2563eb', duree:2, prix_base:150 },
  { type:'Électricité',   couleur:'#d97706', duree:3, prix_base:200 },
  { type:'Climatisation', couleur:'#0891b2', duree:4, prix_base:300 },
  { type:'Maçonnerie',    couleur:'#dc2626', duree:6, prix_base:400 },
  { type:'Peinture',      couleur:'#7c3aed', duree:4, prix_base:250 },
  { type:'Autre',         couleur:'#64748b', duree:3, prix_base:180 },
]
const DEFAULT_HORAIRES: Horaires = {
  lundi:{debut:'08:00',fin:'18:00',actif:true}, mardi:{debut:'08:00',fin:'18:00',actif:true},
  mercredi:{debut:'08:00',fin:'18:00',actif:true}, jeudi:{debut:'08:00',fin:'18:00',actif:true},
  vendredi:{debut:'08:00',fin:'18:00',actif:true}, samedi:{debut:'08:00',fin:'13:00',actif:false},
  dimanche:{debut:'00:00',fin:'00:00',actif:false},
}

// Chaque étape porte une PROMESSE (le résultat), pas une corvée de formulaire
const STEPS = [
  {
    Icon: BellRing,
    accroche: 'Ne perdez plus aucun chantier.',
    sub: 'Vos demandes clients tomberont directement sur votre téléphone, en temps réel.',
  },
  {
    Icon: MessageSquare,
    accroche: 'Vos clients, suivis tout seuls.',
    sub: 'Confirmation, créneaux et relance automatique : tout part en SMS, sans que vous touchiez à rien.',
  },
]

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{id:string}|null>(null)
  const [copied, setCopied] = useState(false)
  const [erreur, setErreur] = useState('')

  const [d, setD] = useState({ nom:'', email:'', telephone:'', nom_entreprise:'', zone_intervention:'' })
  const set = (k:string,v:string)=>setD(p=>({...p,[k]:v}))

  function go(n:number) { setDir(n>step?1:-1); setStep(n) }

  async function finish() {
    setSaving(true); setErreur('')
    try {
      const payload = {
        ...d,
        types_chantier: DEFAULT_TYPES,
        prestations: [],
        horaires: DEFAULT_HORAIRES,
        tva_applicable: false, taux_tva: 20,
        conditions_paiement: 'Paiement à réception du chantier. Acompte de 30% à la commande.',
        modele_devis_url: '', mentions_legales: '', cgv: '', rgpd: '',
      }
      const r = await fetch('/api/artisan', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const a = await r.json()
      if (r.ok) {
        if (a.email && a.password) await supabase.auth.signInWithPassword({ email: a.email, password: a.password }).catch(()=>{})
        setCreated({ id: a.id })
      } else setErreur(a.error || "Une erreur s'est produite. Réessayez.")
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau et réessayez.")
    }
    setSaving(false)
  }

  const canNext = [ !!(d.nom && d.email && d.telephone), !!d.nom_entreprise ][step]

  // ───────── Écran de fin ─────────
  if (created) {
    const lien = `${typeof window!=='undefined'?window.location.origin:''}/formulaire/${created.id}`
    return (
      <Shell>
        <div style={{maxWidth:420,margin:'0 auto',textAlign:'center'}} className="a-scaleIn">
          <div style={{width:80,height:80,borderRadius:24,background:'var(--green-dim)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
            <CheckCircle2 size={42} color="var(--green)" />
          </div>
          <h1 style={{fontSize:26,fontWeight:900,letterSpacing:'-0.04em',marginBottom:8}}>Votre espace est prêt 🎉</h1>
          <p style={{fontSize:14,color:'var(--text2)',lineHeight:1.6,marginBottom:16}}>
            Partagez ce lien à vos clients. Chaque demande arrivera dans votre dashboard — et sur votre téléphone.
          </p>
          <p style={{fontSize:12.5,color:'var(--text3)',background:'var(--surface2)',borderRadius:10,padding:'10px 12px',marginBottom:20,lineHeight:1.5}}>
            🔑 Votre mot de passe vient d'être envoyé par SMS au {d.telephone}. Vous pourrez le modifier dans Réglages.
          </p>
          <div className="card" style={{padding:14,marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
            <span style={{flex:1,fontSize:12,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'left'}}>{lien}</span>
            <button onClick={()=>{navigator.clipboard.writeText(lien);setCopied(true);setTimeout(()=>setCopied(false),1500)}} className="fab" style={{width:38,height:38}}>
              {copied ? <Check size={16} color="var(--green)"/> : <Copy size={16}/>}
            </button>
          </div>
          <button onClick={()=>router.push(`/dashboard/${created.id}`)} className="btn-primary">Accéder à mon dashboard<ArrowRight size={16}/></button>
        </div>
      </Shell>
    )
  }

  const Cur = STEPS[step]

  return (
    <Shell>
      <div style={{maxWidth:430,margin:'0 auto',width:'100%'}}>
        {/* Progression */}
        <div style={{display:'flex',gap:6,marginBottom:26}}>
          {STEPS.map((_,i)=>(
            <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?'var(--blue)':'var(--border2)',transition:'all .4s'}} />
          ))}
        </div>

        <div key={step} className={`tab-pane ${dir>0?'fwd':'back'}`}>
          {/* Promesse (StoryBrand) */}
          <div style={{width:54,height:54,borderRadius:16,background:'linear-gradient(135deg,#2a63de,#1550cf)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:18,boxShadow:'var(--shadow-blue)'}}>
            <Cur.Icon size={26} color="#fff" />
          </div>
          <h1 style={{fontSize:27,fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.1,marginBottom:10}}>{Cur.accroche}</h1>
          <p style={{fontSize:15,color:'var(--text2)',lineHeight:1.5,marginBottom:26}}>{Cur.sub}</p>

          {/* Champs — uniquement l'obligatoire */}
          {step===0 && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <Field label="Votre nom" val={d.nom} set={v=>set('nom',v)} ph="Jean Martin" />
              <Field label="Email" type="email" val={d.email} set={v=>set('email',v)} ph="jean@entreprise.fr" />
              <Field label="Téléphone" type="tel" val={d.telephone} set={v=>set('telephone',v)} ph="+596 696 00 00 00" hint="Vous recevrez votre accès + vos alertes ici." />
            </div>
          )}
          {step===1 && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <Field label="Nom de l'entreprise" val={d.nom_entreprise} set={v=>set('nom_entreprise',v)} ph="Martin Plomberie" />
              <Field label="Zone d'intervention" val={d.zone_intervention} set={v=>set('zone_intervention',v)} ph="Fort-de-France et 20 km alentour" hint="Optionnel — affiché sur votre page client." />
              <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:6}}>
                <Benef Icon={BellRing} txt="Notifications sur votre téléphone à chaque nouvelle demande" />
                <Benef Icon={MessageSquare} txt="SMS automatique de confirmation à vos clients" />
                <Benef Icon={CalendarClock} txt="Relance automatique des clients sans réponse" />
              </div>
            </div>
          )}
        </div>

        {erreur && (
          <div style={{marginTop:18,background:'var(--red-dim)',border:'1px solid #fecaca',color:'var(--red)',borderRadius:12,padding:'12px 14px',fontSize:13,fontWeight:600}}>{erreur}</div>
        )}

        {/* Navigation */}
        <div style={{display:'flex',gap:8,marginTop:26}}>
          {step>0 && <button onClick={()=>go(step-1)} className="btn-ghost" style={{width:'auto',padding:'13px 18px'}}><ArrowLeft size={16}/>Retour</button>}
          {step < STEPS.length-1
            ? <button onClick={()=>go(step+1)} disabled={!canNext} className="btn-primary" style={{flex:1}}>Continuer<ArrowRight size={16}/></button>
            : <button onClick={finish} disabled={saving || !canNext} className="btn-primary" style={{flex:1}}>{saving ? <span className="spinner spinner-w"/> : <><Check size={17}/>Créer mon espace</>}</button>}
        </div>
        <p style={{fontSize:12,color:'var(--text3)',textAlign:'center',marginTop:14}}>1 minute, sans carte bancaire · 7 jours d'essai</p>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{minHeight:'100vh',background:'var(--bg-grad)',padding:'48px 16px 60px'}}>{children}</div>
}
function Field({ label, val, set, ph, type='text', hint }: { label:string; val:string; set:(v:string)=>void; ph?:string; type?:string; hint?:string }) {
  return (
    <div>
      <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>{label}</label>
      <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph} className="input-field" />
      {hint && <p style={{fontSize:11.5,color:'var(--text3)',marginTop:5}}>{hint}</p>}
    </div>
  )
}
function Benef({ Icon, txt }: { Icon:any; txt:string }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'var(--text2)',fontWeight:500}}>
      <span style={{width:26,height:26,borderRadius:8,background:'var(--blue-dim)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon size={14} color="var(--blue)" /></span>
      {txt}
    </div>
  )
}
