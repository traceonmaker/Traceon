'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculerPrixEstime, formatPrix } from '@/lib/utils'
import type { Artisan, TypeChantier } from '@/lib/supabase'
import { Droplet, Zap, Snowflake, Hammer, Paintbrush, Wrench, Check, CheckCircle2, ArrowRight } from 'lucide-react'

type Form = { type_intervention:string; client_nom:string; client_telephone:string; client_adresse:string; client_description:string; envergure:string }
const ENVERGURES = [
  { v:'petit', l:'Petite intervention', d:"Moins d'une demi-journée" },
  { v:'moyen', l:'Standard',            d:'Une journée complète' },
  { v:'grand', l:'Grand chantier',      d:'Plusieurs jours' },
]
const SVC: Record<string,{Icon:any;color:string}> = {
  'Plomberie':{Icon:Droplet,color:'#2563eb'},'Électricité':{Icon:Zap,color:'#d97706'},
  'Climatisation':{Icon:Snowflake,color:'#0891b2'},'Maçonnerie':{Icon:Hammer,color:'#dc2626'},
  'Peinture':{Icon:Paintbrush,color:'#7c3aed'},'Autre':{Icon:Wrench,color:'#64748b'},
}
const svc = (t:string) => SVC[t] || SVC['Autre']

export default function Formulaire() {
  const { artisanId } = useParams<{ artisanId:string }>()
  const [artisan, setArtisan] = useState<Artisan|null>(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [token, setToken] = useState('')
  const [form, setForm] = useState<Form>({ type_intervention:'', client_nom:'', client_telephone:'', client_adresse:'', client_description:'', envergure:'' })

  useEffect(() => {
    supabase.from('artisans').select('*').eq('id', artisanId).single()
      .then(({ data }) => { if (data) setArtisan(data as Artisan); setLoading(false) })
  }, [artisanId])

  const prix = artisan && form.type_intervention && form.envergure
    ? calculerPrixEstime(form.type_intervention, form.envergure, artisan.types_chantier) : null

  async function submit() {
    setSubmitting(true)
    const r = await fetch('/api/demandes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ artisan_id:artisanId, ...form }) })
    const d = await r.json()
    if (r.ok) { setToken(d.token); setDone(true) }
    setSubmitting(false)
  }

  if (loading) return <Shell><div style={{display:'flex',justifyContent:'center',padding:'80px 0'}}><div className="spinner" /></div></Shell>
  if (!artisan) return <Shell><p style={{textAlign:'center',color:'var(--red)',padding:'80px 0'}}>Introuvable.</p></Shell>
  if (done) return <Shell><Done nom={form.client_nom} token={token} /></Shell>

  const types = artisan.types_chantier || []

  return (
    <Shell>
      <div style={{maxWidth:400,margin:'0 auto',width:'100%'}}>
        <div style={{textAlign:'center',marginBottom:30}} className="a-fadeUp">
          <div style={{width:54,height:54,borderRadius:16,background:'linear-gradient(135deg,#2563eb,#60a5fa)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',boxShadow:'var(--shadow-blue)'}}>
            <Wrench size={24} color="#fff" />
          </div>
          <h1 style={{fontSize:20,fontWeight:800,letterSpacing:'-0.03em'}}>{artisan.nom_entreprise || artisan.nom}</h1>
          <p style={{fontSize:13,color:'var(--text3)',marginTop:4}}>Demande d'intervention</p>
        </div>

        <div style={{display:'flex',gap:5,marginBottom:30}}>
          {[1,2,3,4].map(s => (
            <div key={s} style={{flex:1,height:4,borderRadius:2,background:'var(--border2)',overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:2,background:s<=step?'var(--blue)':'transparent',transition:'all .5s cubic-bezier(.22,1,.36,1)',width:s<=step?'100%':'0'}} />
            </div>
          ))}
        </div>

        {step===1 && (
          <div className="a-fadeUp">
            <StepLabel n={1} t="Type d'intervention" s="De quoi avez-vous besoin ?" />
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {types.map((t:TypeChantier,i:number)=>{ const sv=svc(t.type); return (
                <button key={t.type} onClick={()=>{setForm(f=>({...f,type_intervention:t.type}));setStep(2)}}
                  className={`a-fadeUp d${i+1}`}
                  style={{padding:16,borderRadius:16,textAlign:'left',background:form.type_intervention===t.type?'var(--blue-dim)':'#fff',border:`1.5px solid ${form.type_intervention===t.type?'var(--blue)':'var(--border)'}`,cursor:'pointer',transition:'all .2s',boxShadow:'var(--shadow-sm)'}}>
                  <div className="icon-tile" style={{width:42,height:42,borderRadius:12,background:`${sv.color}14`,marginBottom:10}}><sv.Icon size={20} color={sv.color} /></div>
                  <p style={{fontSize:14,fontWeight:700}}>{t.type}</p>
                  <p style={{fontSize:11,color:'var(--text3)',marginTop:2}}>dès {t.prix_base}€</p>
                </button>
              )})}
            </div>
          </div>
        )}

        {step===2 && (
          <div className="a-fadeUp">
            <StepLabel n={2} t="Vos coordonnées" s="Pour qu'on puisse vous contacter" />
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <F label="Nom complet" val={form.client_nom} set={v=>setForm(f=>({...f,client_nom:v}))} ph="Jean Dupont" />
              <F label="Téléphone" type="tel" val={form.client_telephone} set={v=>setForm(f=>({...f,client_telephone:v}))} ph="+596 696 00 00 00" />
              <F label="Adresse du chantier" val={form.client_adresse} set={v=>setForm(f=>({...f,client_adresse:v}))} ph="12 rue des Fleurs, Le Robert" />
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text2)',display:'block',marginBottom:6}}>Description <span style={{color:'var(--text3)',fontWeight:400}}>(optionnel)</span></label>
                <textarea rows={3} value={form.client_description} onChange={e=>setForm(f=>({...f,client_description:e.target.value}))} placeholder="Décrivez votre problème..." className="input-field" style={{resize:'none',lineHeight:1.5}} />
              </div>
            </div>
            <Actions onBack={()=>setStep(1)} onNext={()=>setStep(3)} disabled={!form.client_nom||!form.client_telephone||!form.client_adresse} />
          </div>
        )}

        {step===3 && (
          <div className="a-fadeUp">
            <StepLabel n={3} t="Envergure" s="Donnez une idée de l'ampleur" />
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {ENVERGURES.map((e,i)=>(
                <button key={e.v} onClick={()=>setForm(f=>({...f,envergure:e.v}))}
                  className={`a-fadeUp d${i+1}`}
                  style={{padding:'15px 16px',borderRadius:14,display:'flex',alignItems:'center',gap:14,background:form.envergure===e.v?'var(--blue-dim)':'#fff',border:`1.5px solid ${form.envergure===e.v?'var(--blue)':'var(--border)'}`,cursor:'pointer',transition:'all .2s',boxShadow:'var(--shadow-sm)'}}>
                  <div style={{flex:1,textAlign:'left'}}>
                    <p style={{fontSize:14,fontWeight:700}}>{e.l}</p>
                    <p style={{fontSize:12,color:'var(--text3)',marginTop:2}}>{e.d}</p>
                  </div>
                  {form.envergure===e.v && <Check size={18} color="var(--blue)" />}
                </button>
              ))}
            </div>
            <Actions onBack={()=>setStep(2)} onNext={()=>setStep(4)} disabled={!form.envergure} />
          </div>
        )}

        {step===4 && (
          <div className="a-fadeUp">
            <StepLabel n={4} t="Récapitulatif" s="Vérifiez avant d'envoyer" />
            <div className="card" style={{overflow:'hidden',marginBottom:12}}>
              {[
                ['Type', form.type_intervention],['Nom', form.client_nom],['Téléphone', form.client_telephone],
                ['Adresse', form.client_adresse],['Envergure', ENVERGURES.find(e=>e.v===form.envergure)?.l||''],
                ...(form.client_description?[['Note',form.client_description]]:[])
              ].map(([l,v],i,a)=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'13px 16px',borderBottom:i<a.length-1?'1px solid var(--border)':'none'}}>
                  <span style={{fontSize:13,color:'var(--text3)'}}>{l}</span>
                  <span style={{fontSize:13,fontWeight:600,textAlign:'right',maxWidth:'58%'}}>{v}</span>
                </div>
              ))}
            </div>
            {prix && (
              <div style={{background:'linear-gradient(135deg,#2563eb,#3b82f6)',borderRadius:18,padding:'20px 16px',marginBottom:20,textAlign:'center',color:'#fff',boxShadow:'var(--shadow-blue)'}}>
                <p style={{fontSize:11,fontWeight:600,opacity:.85,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>Estimation indicative</p>
                <p style={{fontSize:38,fontWeight:800,letterSpacing:'-0.05em'}}>{formatPrix(prix)}</p>
                <p style={{fontSize:12,opacity:.8,marginTop:4}}>Prix définitif après diagnostic</p>
              </div>
            )}
            <Actions onBack={()=>setStep(3)} onNext={submit} labelNext="Envoyer ma demande" loading={submitting} />
          </div>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{minHeight:'100vh',background:'var(--bg-grad)',padding:'40px 16px 60px'}}>{children}</div>
}
function StepLabel({ n, t, s }: { n:number; t:string; s:string }) {
  return (
    <div style={{marginBottom:20}}>
      <p style={{fontSize:11,fontWeight:700,color:'var(--blue)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6}}>Étape {n} / 4</p>
      <h2 style={{fontSize:22,fontWeight:800,letterSpacing:'-0.04em',marginBottom:4}}>{t}</h2>
      <p style={{fontSize:13,color:'var(--text3)'}}>{s}</p>
    </div>
  )
}
function F({ label, val, set, ph, type='text' }: any) {
  return (
    <div>
      <label style={{fontSize:12,fontWeight:600,color:'var(--text2)',display:'block',marginBottom:6}}>{label}</label>
      <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph} className="input-field" />
    </div>
  )
}
function Actions({ onBack, onNext, disabled, labelNext, loading=false }: any) {
  return (
    <div style={{display:'flex',gap:8,marginTop:24}}>
      <button onClick={onBack} className="btn-ghost" style={{width:'auto',padding:'13px 18px'}}>Retour</button>
      <button onClick={onNext} disabled={disabled||loading} className="btn-primary" style={{flex:1}}>
        {loading ? <span className="spinner spinner-w" /> : <>{labelNext||'Continuer'}<ArrowRight size={16}/></>}
      </button>
    </div>
  )
}
function Done({ nom, token }: { nom:string; token:string }) {
  return (
    <div style={{textAlign:'center',maxWidth:340,margin:'0 auto'}} className="a-scaleIn">
      <div style={{width:76,height:76,borderRadius:22,background:'var(--green-dim)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px'}}>
        <CheckCircle2 size={40} color="var(--green)" />
      </div>
      <h2 style={{fontSize:24,fontWeight:800,letterSpacing:'-0.04em',marginBottom:8}}>Demande envoyée</h2>
      <p style={{fontSize:14,color:'var(--text3)',lineHeight:1.6,marginBottom:28}}>Merci {nom}. Vous recevrez un SMS de confirmation avec votre lien de suivi.</p>
      <a href={`/suivi/${token}`} className="btn-primary" style={{textDecoration:'none'}}>Suivre ma demande<ArrowRight size={16}/></a>
    </div>
  )
}
