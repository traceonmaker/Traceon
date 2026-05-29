'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TypeChantier, Prestation, Horaires } from '@/lib/supabase'
import {
  Building2, User, Wrench, Receipt, Clock, FileText, Check, ArrowRight, ArrowLeft,
  Plus, Trash2, Upload, CheckCircle2, Copy
} from 'lucide-react'

const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche']
const JOURS_LBL: Record<string,string> = { lundi:'Lundi',mardi:'Mardi',mercredi:'Mercredi',jeudi:'Jeudi',vendredi:'Vendredi',samedi:'Samedi',dimanche:'Dimanche' }

const DEFAULT_TYPES: TypeChantier[] = [
  { type:'Plomberie',     couleur:'#0a6bff', duree:2, prix_base:150 },
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

const STEPS = [
  { Icon:User,      titre:'Votre compte' },
  { Icon:Building2, titre:'Entreprise' },
  { Icon:Wrench,    titre:'Services' },
  { Icon:Receipt,   titre:'Grille tarifaire' },
  { Icon:Clock,     titre:'Horaires' },
  { Icon:FileText,  titre:'Légal & devis' },
]

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{id:string}|null>(null)
  const [copied, setCopied] = useState(false)

  const [d, setD] = useState({
    nom:'', email:'', telephone:'',
    nom_entreprise:'', siret:'', adresse_entreprise:'', zone_intervention:'', logo_url:'',
    types_chantier: DEFAULT_TYPES,
    prestations: [] as Prestation[],
    horaires: DEFAULT_HORAIRES,
    tva_applicable:false, taux_tva:20,
    conditions_paiement:'Paiement à réception du chantier. Acompte de 30% à la commande.',
    modele_devis_url:'',
    mentions_legales:'', cgv:'', rgpd:'',
  })
  const set = (k:string,v:any)=>setD(p=>({...p,[k]:v}))

  async function logoUpload(file: File) {
    const reader = new FileReader()
    reader.onload = () => set('logo_url', reader.result as string)
    reader.readAsDataURL(file)
  }

  async function finish() {
    setSaving(true)
    const r = await fetch('/api/artisan', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(d) })
    if (r.ok) { const a = await r.json(); setCreated({ id: a.id }) }
    setSaving(false)
  }

  // Validité par étape
  const canNext = [
    d.nom && d.email && d.telephone,
    d.nom_entreprise,
    d.types_chantier.length > 0,
    true,
    true,
    true,
  ][step]

  if (created) {
    const lien = `${typeof window!=='undefined'?window.location.origin:''}/formulaire/${created.id}`
    return (
      <Shell>
        <div style={{maxWidth:420,margin:'0 auto',textAlign:'center'}} className="a-scaleIn">
          <div style={{width:80,height:80,borderRadius:24,background:'var(--green-dim)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
            <CheckCircle2 size={42} color="var(--green)" />
          </div>
          <h1 style={{fontSize:26,fontWeight:900,letterSpacing:'-0.04em',marginBottom:8}}>C'est configuré</h1>
          <p style={{fontSize:14,color:'var(--text2)',lineHeight:1.6,marginBottom:24}}>
            {d.nom_entreprise} est prêt. Voici votre lien client à partager — chaque demande arrivera dans votre dashboard.
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
      <div style={{maxWidth:440,margin:'0 auto',width:'100%'}}>
        {/* En-tête + progression */}
        <div style={{marginBottom:24}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <div style={{width:44,height:44,borderRadius:14,background:'linear-gradient(135deg,#14318a,#0a1a4e)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'var(--shadow-blue)'}}>
              <Cur.Icon size={20} color="#fff" />
            </div>
            <div>
              <p style={{fontSize:11,fontWeight:700,color:'var(--blue)',letterSpacing:'0.06em',textTransform:'uppercase'}}>Étape {step+1} / {STEPS.length}</p>
              <h1 className="section-title" style={{fontSize:21}}>{Cur.titre}</h1>
            </div>
          </div>
          <div style={{display:'flex',gap:4}}>
            {STEPS.map((_,i)=>(
              <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?'var(--blue)':'var(--border2)',transition:'all .4s'}} />
            ))}
          </div>
        </div>

        {/* Étapes */}
        {step===0 && (
          <div className="a-fadeUp" style={{display:'flex',flexDirection:'column',gap:12}}>
            <Field label="Votre nom" val={d.nom} set={v=>set('nom',v)} ph="Jean Martin" />
            <Field label="Email" type="email" val={d.email} set={v=>set('email',v)} ph="jean@entreprise.fr" />
            <Field label="Téléphone" type="tel" val={d.telephone} set={v=>set('telephone',v)} ph="+596 696 00 00 00" />
          </div>
        )}

        {step===1 && (
          <div className="a-fadeUp" style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <label style={{cursor:'pointer'}}>
                <div style={{width:64,height:64,borderRadius:16,border:'2px dashed var(--border2)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',background:'var(--surface2)'}}>
                  {d.logo_url ? <img src={d.logo_url} alt="logo" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <Upload size={20} color="var(--text3)" />}
                </div>
                <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&logoUpload(e.target.files[0])} />
              </label>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:600}}>Logo de l'entreprise</p>
                <p style={{fontSize:11,color:'var(--text3)',marginTop:2}}>PNG ou JPG. Cliquez pour importer.</p>
              </div>
            </div>
            <Field label="Nom de l'entreprise" val={d.nom_entreprise} set={v=>set('nom_entreprise',v)} ph="Martin Plomberie" />
            <Field label="SIRET" val={d.siret} set={v=>set('siret',v)} ph="123 456 789 00012" />
            <Field label="Adresse" val={d.adresse_entreprise} set={v=>set('adresse_entreprise',v)} ph="12 rue des Artisans, Fort-de-France" />
            <Field label="Zone d'intervention" val={d.zone_intervention} set={v=>set('zone_intervention',v)} ph="Fort-de-France et 20 km alentour" />
          </div>
        )}

        {step===2 && (
          <div className="a-fadeUp">
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:14}}>Vos types de chantier, avec couleur, prix de base et durée.</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {d.types_chantier.map((t,i)=>(
                <div key={i} style={{background:'var(--surface2)',borderRadius:13,padding:12,border:'1px solid var(--border)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <input type="color" value={t.couleur} onChange={e=>set('types_chantier',d.types_chantier.map((x,idx)=>idx===i?{...x,couleur:e.target.value}:x))} style={{width:32,height:32,borderRadius:9,border:'1px solid var(--border)',padding:2,cursor:'pointer',background:'#fff'}} />
                    <input value={t.type} onChange={e=>set('types_chantier',d.types_chantier.map((x,idx)=>idx===i?{...x,type:e.target.value}:x))} className="input-field" style={{flex:1,padding:'9px 12px',fontSize:13}} />
                    <button onClick={()=>set('types_chantier',d.types_chantier.filter((_,idx)=>idx!==i))} className="fab" style={{width:32,height:32,color:'var(--red)'}}><Trash2 size={15}/></button>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <LabeledInput label="PRIX DE BASE (€)" type="number" val={t.prix_base} set={v=>set('types_chantier',d.types_chantier.map((x,idx)=>idx===i?{...x,prix_base:+v}:x))} />
                    <LabeledInput label="DURÉE (h)" type="number" val={t.duree} set={v=>set('types_chantier',d.types_chantier.map((x,idx)=>idx===i?{...x,duree:+v}:x))} />
                  </div>
                </div>
              ))}
              <button onClick={()=>set('types_chantier',[...d.types_chantier,{type:'Nouveau service',couleur:'#64748b',duree:2,prix_base:100}])} className="btn-ghost"><Plus size={16}/>Ajouter un service</button>
            </div>
          </div>
        )}

        {step===3 && (
          <div className="a-fadeUp">
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:14}}>Grille tarifaire détaillée — prestations précises facturables (optionnel).</p>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
              {d.prestations.length===0 && <p style={{fontSize:13,color:'var(--text3)',textAlign:'center',padding:'16px 0',background:'var(--surface2)',borderRadius:12}}>Aucune prestation détaillée. Le prix de base par service sera utilisé.</p>}
              {d.prestations.map((p,i)=>(
                <div key={i} style={{background:'var(--surface2)',borderRadius:13,padding:12,border:'1px solid var(--border)'}}>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    <select value={p.service} onChange={e=>set('prestations',d.prestations.map((x,idx)=>idx===i?{...x,service:e.target.value}:x))} className="input-field" style={{flex:1,padding:'9px 12px',fontSize:13}}>
                      {d.types_chantier.map(t=><option key={t.type} value={t.type}>{t.type}</option>)}
                    </select>
                    <button onClick={()=>set('prestations',d.prestations.filter((_,idx)=>idx!==i))} className="fab" style={{width:32,height:32,color:'var(--red)'}}><Trash2 size={15}/></button>
                  </div>
                  <input value={p.libelle} onChange={e=>set('prestations',d.prestations.map((x,idx)=>idx===i?{...x,libelle:e.target.value}:x))} placeholder="Ex: Remplacement robinet" className="input-field" style={{padding:'9px 12px',fontSize:13,marginBottom:8}} />
                  <div style={{display:'flex',gap:8}}>
                    <LabeledInput label="PRIX (€)" type="number" val={p.prix} set={v=>set('prestations',d.prestations.map((x,idx)=>idx===i?{...x,prix:+v}:x))} />
                    <div style={{flex:1}}>
                      <label style={{fontSize:10,color:'var(--label)',fontWeight:700,display:'block',marginBottom:4}}>UNITÉ</label>
                      <select value={p.unite} onChange={e=>set('prestations',d.prestations.map((x,idx)=>idx===i?{...x,unite:e.target.value}:x))} className="input-field" style={{padding:'9px 12px',fontSize:13}}>
                        {['forfait','heure','m²','ml','unité','jour'].map(u=><option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={()=>set('prestations',[...d.prestations,{service:d.types_chantier[0]?.type||'Autre',libelle:'',prix:0,unite:'forfait'}])} className="btn-ghost"><Plus size={16}/>Ajouter une prestation</button>
            </div>
            <div className="card" style={{padding:14}}>
              <Toggle label="Assujetti à la TVA" on={d.tva_applicable} set={v=>set('tva_applicable',v)} />
              {d.tva_applicable && <div style={{marginTop:10}}><LabeledInput label="TAUX TVA (%)" type="number" val={d.taux_tva} set={v=>set('taux_tva',+v)} /></div>}
            </div>
          </div>
        )}

        {step===4 && (
          <div className="a-fadeUp">
            <p style={{fontSize:13,color:'var(--text2)',marginBottom:14}}>Vos horaires de travail — pour proposer des créneaux cohérents.</p>
            <div className="card" style={{overflow:'hidden'}}>
              {JOURS.map((j,i)=>{
                const h = d.horaires[j]
                return (
                  <div key={j} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderBottom:i<6?'1px solid var(--border)':'none',opacity:h.actif?1:0.5}}>
                    <button onClick={()=>set('horaires',{...d.horaires,[j]:{...h,actif:!h.actif}})}
                      style={{width:42,height:24,borderRadius:12,border:'none',cursor:'pointer',background:h.actif?'var(--blue)':'var(--border2)',position:'relative',transition:'all .2s',flexShrink:0}}>
                      <span style={{position:'absolute',top:2,left:h.actif?20:2,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'all .2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
                    </button>
                    <span style={{fontSize:13,fontWeight:600,flex:1}}>{JOURS_LBL[j]}</span>
                    {h.actif ? <>
                      <input type="time" value={h.debut} onChange={e=>set('horaires',{...d.horaires,[j]:{...h,debut:e.target.value}})} className="input-field" style={{width:80,padding:'7px 8px',fontSize:12}} />
                      <span style={{color:'var(--text3)'}}>–</span>
                      <input type="time" value={h.fin} onChange={e=>set('horaires',{...d.horaires,[j]:{...h,fin:e.target.value}})} className="input-field" style={{width:80,padding:'7px 8px',fontSize:12}} />
                    </> : <span style={{fontSize:12,color:'var(--text3)'}}>Fermé</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {step===5 && (
          <div className="a-fadeUp" style={{display:'flex',flexDirection:'column',gap:14}}>
            <Field label="Modèle de devis (lien PDF)" val={d.modele_devis_url} set={v=>set('modele_devis_url',v)} ph="https://... (optionnel)" />
            <Area label="Conditions de paiement" val={d.conditions_paiement} set={v=>set('conditions_paiement',v)} />
            <Area label="Mentions légales" val={d.mentions_legales} set={v=>set('mentions_legales',v)} ph="SIRET, forme juridique, assurance décennale..." />
            <Area label="Conditions générales de vente (CGV)" val={d.cgv} set={v=>set('cgv',v)} />
            <Area label="Politique de confidentialité (RGPD)" val={d.rgpd} set={v=>set('rgpd',v)} ph="Usage des données client..." />
          </div>
        )}

        {/* Navigation */}
        <div style={{display:'flex',gap:8,marginTop:24}}>
          {step>0 && <button onClick={()=>setStep(s=>s-1)} className="btn-ghost" style={{width:'auto',padding:'13px 18px'}}><ArrowLeft size={16}/>Retour</button>}
          {step < STEPS.length-1
            ? <button onClick={()=>setStep(s=>s+1)} disabled={!canNext} className="btn-primary" style={{flex:1}}>Continuer<ArrowRight size={16}/></button>
            : <button onClick={finish} disabled={saving} className="btn-primary" style={{flex:1}}>{saving ? <span className="spinner spinner-w"/> : <><Check size={17}/>Créer mon espace</>}</button>}
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{minHeight:'100vh',background:'var(--bg-grad)',padding:'40px 16px 60px'}}>{children}</div>
}
function Field({ label, val, set, ph, type='text' }: { label:string; val:string; set:(v:string)=>void; ph?:string; type?:string }) {
  return (
    <div>
      <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>{label}</label>
      <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph} className="input-field" />
    </div>
  )
}
function LabeledInput({ label, val, set, type='text' }: { label:string; val:string|number; set:(v:string)=>void; type?:string }) {
  return (
    <div style={{flex:1}}>
      <label style={{fontSize:10,color:'var(--label)',fontWeight:700,letterSpacing:'0.03em',display:'block',marginBottom:4}}>{label}</label>
      <input type={type} value={val} onChange={e=>set(e.target.value)} className="input-field" style={{padding:'9px 12px',fontSize:13}} />
    </div>
  )
}
function Area({ label, val, set, ph }: { label:string; val:string; set:(v:string)=>void; ph?:string }) {
  return (
    <div>
      <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>{label}</label>
      <textarea value={val} onChange={e=>set(e.target.value)} placeholder={ph} rows={3} className="input-field" style={{resize:'none',lineHeight:1.5}} />
    </div>
  )
}
function Toggle({ label, on, set }: { label:string; on:boolean; set:(v:boolean)=>void }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <span style={{fontSize:13,fontWeight:600}}>{label}</span>
      <button onClick={()=>set(!on)} style={{width:46,height:26,borderRadius:13,border:'none',cursor:'pointer',background:on?'var(--blue)':'var(--border2)',position:'relative',transition:'all .2s'}}>
        <span style={{position:'absolute',top:2,left:on?22:2,width:22,height:22,borderRadius:'50%',background:'#fff',transition:'all .2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
      </button>
    </div>
  )
}
