'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculerPrixEstime, formatPrix, validerDemande, normalizePhone, isValidPhone } from '@/lib/utils'
import type { Artisan, TypeChantier } from '@/lib/supabase'
import { Droplet, Zap, Snowflake, Hammer, Paintbrush, Wrench, Check, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react'
import { TraceOnMark } from '@/app/components/Logo'

type Form = { type_intervention:string; client_nom:string; client_telephone:string; client_adresse:string; client_description:string; envergure:string }
const ENVERGURES = [
  { v:'petit', l:'Petite intervention', d:"Moins d'une demi-journée" },
  { v:'moyen', l:'Standard',            d:'Une journée complète' },
  { v:'grand', l:'Grand chantier',      d:'Plusieurs jours' },
]
const SVC: Record<string,{Icon:any;color:string}> = {
  'Plomberie':{Icon:Droplet,color:'#3b82f6'},'Électricité':{Icon:Zap,color:'#f59e0b'},
  'Climatisation':{Icon:Snowflake,color:'#22d3ee'},'Maçonnerie':{Icon:Hammer,color:'#f87171'},
  'Peinture':{Icon:Paintbrush,color:'#a78bfa'},'Autre':{Icon:Wrench,color:'#94a3b8'},
}
const svc = (t:string) => SVC[t] || SVC['Autre']

// Palette premium sombre (alignée sur le mini-site)
const C = { txt:'#f4f7ff', mut:'rgba(244,247,255,0.62)', mut2:'rgba(244,247,255,0.40)', glass:'rgba(255,255,255,0.055)', border:'rgba(255,255,255,0.12)', accent:'#5b8cff' }

// Copy qui donne envie d'avancer (StoryBrand : le client est le héros)
const STEP_COPY = [
  { t:'De quoi avez-vous besoin ?',  s:'Choisissez votre service — c’est parti.' },
  { t:'Comment vous joindre ?',      s:'Pour vous envoyer votre devis au plus vite.' },
  { t:'L’ampleur du chantier ?',     s:'Pour vous proposer le bon créneau, tout de suite.' },
  { t:'Presque terminé 🎉',          s:'Un dernier coup d’œil, puis on s’occupe de tout.' },
]

export default function Formulaire() {
  const { artisanId } = useParams<{ artisanId:string }>()
  const [artisan, setArtisan] = useState<Artisan|null>(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [token, setToken] = useState('')
  const [err, setErr] = useState('')
  const [hp, setHp] = useState('')
  const [form, setForm] = useState<Form>({ type_intervention:'', client_nom:'', client_telephone:'', client_adresse:'', client_description:'', envergure:'' })

  function next2() {
    const msg = validerDemande(form)
    if (msg) { setErr(msg); return }
    setErr(''); setStep(3)
  }

  useEffect(() => {
    supabase.from('artisans').select('id, nom, nom_entreprise, logo_url, types_chantier, zone_intervention').eq('id', artisanId).single()
      .then(({ data }) => { if (data) setArtisan(data as Artisan); setLoading(false) })
  }, [artisanId])

  const prix = artisan && form.type_intervention && form.envergure
    ? calculerPrixEstime(form.type_intervention, form.envergure, artisan.types_chantier) : null

  async function submit() {
    const msg = validerDemande(form)
    if (msg) { setErr(msg); setStep(2); return }
    setSubmitting(true)
    const payload = { ...form, client_telephone: normalizePhone(form.client_telephone) }
    const r = await fetch('/api/demandes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ artisan_id:artisanId, hp, ...payload }) })
    const d = await r.json()
    if (r.ok) { setToken(d.token); setDone(true) }
    else setErr(d.error || "Envoi impossible, vérifiez vos informations.")
    setSubmitting(false)
  }

  if (loading) return <Shell><div style={{display:'flex',justifyContent:'center',padding:'90px 0'}}><div className="spinner spinner-w" /></div></Shell>
  if (!artisan) return <Shell><p style={{textAlign:'center',color:'#ff6b6b',padding:'90px 0'}}>Page introuvable.</p></Shell>
  if (done) return <Shell><Done nom={form.client_nom} token={token} ent={artisan.nom_entreprise||artisan.nom} /></Shell>

  const types = artisan.types_chantier || []
  const copy = STEP_COPY[step-1]

  return (
    <Shell>
      <div style={{maxWidth:440,margin:'0 auto',width:'100%'}}>
        {/* En-tête entreprise */}
        <div style={{textAlign:'center',marginBottom:26}} className="a-fadeUp">
          <div style={{width:60,height:60,borderRadius:18,overflow:'hidden',background:'linear-gradient(135deg,#2a63de,#1550cf)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',boxShadow:'0 12px 30px rgba(37,99,235,0.42)'}}>
            {artisan.logo_url ? <img src={artisan.logo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span style={{fontSize:24,fontWeight:800,color:'#fff'}}>{(artisan.nom_entreprise||artisan.nom||'T')[0].toUpperCase()}</span>}
          </div>
          <h1 style={{fontSize:21,fontWeight:800,letterSpacing:'-0.03em'}}>{artisan.nom_entreprise || artisan.nom}</h1>
          <p style={{fontSize:13,color:C.mut2,marginTop:3}}>Demande d’intervention · réponse rapide</p>
        </div>

        {/* Progression */}
        <div style={{display:'flex',gap:6,marginBottom:6}}>
          {[1,2,3,4].map(s => (
            <div key={s} style={{flex:1,height:5,borderRadius:3,background:'rgba(255,255,255,0.10)',overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:3,background:'linear-gradient(90deg,#2a6af0,#5b8cff)',transition:'width .5s cubic-bezier(.22,1,.36,1)',width:s<=step?'100%':'0'}} />
            </div>
          ))}
        </div>
        <p style={{fontSize:11.5,color:C.mut2,textAlign:'right',marginBottom:24}}>Étape {step} sur 4 · ~1 min</p>

        <div key={step} className="a-fadeUp">
          <h2 style={{fontSize:23,fontWeight:800,letterSpacing:'-0.035em',marginBottom:5}}>{copy.t}</h2>
          <p style={{fontSize:14,color:C.mut,marginBottom:22}}>{copy.s}</p>

          {/* Étape 1 — type */}
          {step===1 && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {types.map((t:TypeChantier,i:number)=>{ const sv=svc(t.type); const on=form.type_intervention===t.type; return (
                <button key={t.type} onClick={()=>{setForm(f=>({...f,type_intervention:t.type}));setStep(2)}}
                  className={`pro-card a-fadeUp d${Math.min(i+1,6)}`}
                  style={{padding:16,borderRadius:18,textAlign:'left',cursor:'pointer',background:on?'rgba(45,99,222,0.18)':C.glass,border:`1px solid ${on?C.accent:C.border}`}}>
                  <div style={{width:44,height:44,borderRadius:13,background:`${sv.color}26`,border:`1px solid ${sv.color}44`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:11}}><sv.Icon size={21} color={sv.color} /></div>
                  <p style={{fontSize:15,fontWeight:700,color:C.txt}}>{t.type}</p>
                  <p style={{fontSize:12,color:C.mut2,marginTop:2}}>dès {t.prix_base}€</p>
                </button>
              )})}
            </div>
          )}

          {/* Étape 2 — coordonnées */}
          {step===2 && (
            <div style={{display:'flex',flexDirection:'column',gap:13}}>
              <F label="Votre nom" val={form.client_nom} set={v=>{setForm(f=>({...f,client_nom:v.replace(/[0-9]/g,'')}));setErr('')}} ph="Jean Dupont" />
              <F label="Téléphone" type="tel" val={form.client_telephone} set={v=>{setForm(f=>({...f,client_telephone:v.replace(/[^0-9+\s().-]/g,'').slice(0,20)}));setErr('')}} ph="0696 12 34 56" ok={form.client_telephone ? isValidPhone(form.client_telephone) : undefined} />
              <F label="Adresse du chantier" val={form.client_adresse} set={v=>{setForm(f=>({...f,client_adresse:v}));setErr('')}} ph="12 quartier Dillon, Fort-de-France" />
              <div>
                <label style={{fontSize:12,fontWeight:600,color:C.mut,display:'block',marginBottom:6}}>Décrivez en quelques mots <span style={{color:C.mut2,fontWeight:400}}>(optionnel)</span></label>
                <textarea rows={3} value={form.client_description} onChange={e=>setForm(f=>({...f,client_description:e.target.value}))} placeholder="Ex : fuite sous l'évier de la cuisine…" style={inputStyle()} />
              </div>
              <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={e=>setHp(e.target.value)} aria-hidden="true" style={{position:'absolute',left:'-9999px',width:1,height:1,opacity:0}} />
            </div>
          )}

          {/* Étape 3 — envergure */}
          {step===3 && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {ENVERGURES.map((e,i)=>{ const on=form.envergure===e.v; return (
                <button key={e.v} onClick={()=>setForm(f=>({...f,envergure:e.v}))}
                  className={`pro-card a-fadeUp d${i+1}`}
                  style={{padding:'16px 18px',borderRadius:16,display:'flex',alignItems:'center',gap:14,cursor:'pointer',background:on?'rgba(45,99,222,0.18)':C.glass,border:`1px solid ${on?C.accent:C.border}`}}>
                  <div style={{flex:1,textAlign:'left'}}>
                    <p style={{fontSize:15,fontWeight:700,color:C.txt}}>{e.l}</p>
                    <p style={{fontSize:12.5,color:C.mut2,marginTop:2}}>{e.d}</p>
                  </div>
                  {on && <Check size={19} color={C.accent} />}
                </button>
              )})}
            </div>
          )}

          {/* Étape 4 — récap */}
          {step===4 && (
            <div>
              <div style={{background:C.glass,border:`1px solid ${C.border}`,borderRadius:18,overflow:'hidden',marginBottom:14}}>
                {[
                  ['Service', form.type_intervention],['Nom', form.client_nom],['Téléphone', form.client_telephone],
                  ['Adresse', form.client_adresse],['Ampleur', ENVERGURES.find(e=>e.v===form.envergure)?.l||''],
                  ...(form.client_description?[['Détail',form.client_description]]:[])
                ].map(([l,v],i,a)=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,padding:'13px 16px',borderBottom:i<a.length-1?`1px solid ${C.border}`:'none'}}>
                    <span style={{fontSize:13,color:C.mut2,flexShrink:0}}>{l}</span>
                    <span style={{fontSize:13.5,fontWeight:600,textAlign:'right',color:C.txt}}>{v}</span>
                  </div>
                ))}
              </div>
              {prix && (
                <div style={{background:'linear-gradient(135deg,#1d3a8a,#0c1f3f)',border:`1px solid ${C.border}`,borderRadius:18,padding:'20px 16px',marginBottom:20,textAlign:'center',boxShadow:'0 18px 50px rgba(13,31,63,0.55)'}}>
                  <p style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.7)',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6}}>Estimation indicative</p>
                  <p style={{fontSize:40,fontWeight:800,letterSpacing:'-0.04em',background:'linear-gradient(120deg,#fff,#aaccff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{formatPrix(prix)}</p>
                  <p style={{fontSize:12,color:'rgba(255,255,255,0.6)',marginTop:4}}>Prix définitif après diagnostic · sans engagement</p>
                </div>
              )}
            </div>
          )}
        </div>

        {err && <p style={{fontSize:12.5,color:'#ff9a9a',fontWeight:600,marginTop:14,display:'flex',alignItems:'center',gap:6}}>⚠ {err}</p>}

        {/* Navigation */}
        {step>1 && (
          <div style={{display:'flex',gap:10,marginTop:24}}>
            <button onClick={()=>setStep(step-1)} style={{...ghostStyle(),width:'auto',padding:'14px 18px'}}><ArrowLeft size={16}/>Retour</button>
            {step<4
              ? <button onClick={step===2?next2:()=>setStep(step+1)} disabled={step===3&&!form.envergure} style={{...ctaStyle(),flex:1,opacity:(step===3&&!form.envergure)?.5:1}}>Continuer<ArrowRight size={16}/></button>
              : <button onClick={submit} disabled={submitting} style={{...ctaStyle(),flex:1}}>{submitting ? <span className="spinner spinner-w" /> : <>Envoyer ma demande<ArrowRight size={16}/></>}</button>}
          </div>
        )}

        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:24,flexWrap:'wrap'}}>
          <span style={{fontSize:11.5,color:C.mut2}}>🔒 Informations confidentielles ·</span>
          <TraceOnMark size={15} color="#5b8cff" />
          <span style={{fontSize:11.5,color:C.mut2}}>Propulsé par TraceOn</span>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{minHeight:'100vh',background:'#06080f',color:C.txt,position:'relative',overflow:'hidden',padding:'44px 18px 60px',fontFamily:"'SF Pro Display',-apple-system,Inter,sans-serif"}}>
      <div style={{position:'absolute',top:-160,left:'50%',transform:'translateX(-50%)',width:620,height:460,background:'radial-gradient(circle, rgba(45,99,222,0.40) 0%, transparent 65%)',filter:'blur(44px)',pointerEvents:'none'}} />
      <div style={{position:'relative',zIndex:1}}>{children}</div>
    </div>
  )
}

function inputStyle(): React.CSSProperties {
  return { width:'100%', padding:'13px 15px', borderRadius:13, border:`1px solid ${C.border}`, background:'rgba(255,255,255,0.04)', color:C.txt, fontSize:15, outline:'none', resize:'none', lineHeight:1.5, fontFamily:'inherit' }
}
function ctaStyle(): React.CSSProperties {
  return { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, height:52, fontSize:15.5, fontWeight:700, color:'#fff', background:'linear-gradient(135deg,#2a6af0,#1550cf)', border:'none', borderRadius:15, cursor:'pointer', boxShadow:'0 12px 32px rgba(37,99,235,0.42)' }
}
function ghostStyle(): React.CSSProperties {
  return { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, height:52, fontSize:14.5, fontWeight:600, color:C.txt, background:C.glass, border:`1px solid ${C.border}`, borderRadius:15, cursor:'pointer' }
}

function F({ label, val, set, ph, type='text', ok }: { label:string; val:string; set:(v:string)=>void; ph?:string; type?:string; ok?:boolean }) {
  const invalid = ok === false
  return (
    <div>
      <label style={{fontSize:12,fontWeight:600,color:C.mut,display:'block',marginBottom:6}}>{label}</label>
      <div style={{position:'relative'}}>
        <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
          inputMode={type==='tel'?'tel':'text'} autoComplete={type==='tel'?'tel':label.toLowerCase().includes('nom')?'name':'off'}
          style={{...inputStyle(), ...(invalid?{borderColor:'#ff6b6b',paddingRight:38}:ok?{borderColor:'#4ade80',paddingRight:38}:{})}} />
        {ok===true && <Check size={16} color="#4ade80" style={{position:'absolute',right:13,top:'50%',transform:'translateY(-50%)'}} />}
      </div>
    </div>
  )
}

function Done({ nom, token, ent }: { nom:string; token:string; ent:string }) {
  const prenom = (nom||'').trim().split(' ')[0]
  return (
    <div style={{textAlign:'center',maxWidth:380,margin:'0 auto'}} className="a-fadeUp">
      <div style={{width:84,height:84,borderRadius:24,background:'linear-gradient(135deg,rgba(74,222,128,0.18),rgba(34,197,94,0.10))',border:'1px solid rgba(74,222,128,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 22px'}}>
        <CheckCircle2 size={44} color="#4ade80" />
      </div>
      <h2 style={{fontSize:26,fontWeight:800,letterSpacing:'-0.04em',marginBottom:10}}>C’est envoyé{prenom?`, ${prenom}`:''} !</h2>
      <p style={{fontSize:15,color:C.mut,lineHeight:1.6,marginBottom:28}}>{ent} a reçu votre demande et va vous recontacter rapidement. Vous allez recevoir un SMS de confirmation avec votre lien de suivi.</p>
      <a href={`/suivi/${token}`} style={{...ctaStyle(),textDecoration:'none',width:'100%'}}>Suivre ma demande<ArrowRight size={16}/></a>
    </div>
  )
}
