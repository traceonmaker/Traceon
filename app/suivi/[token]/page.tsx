'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { formatDate, formatHeure } from '@/lib/utils'
import type { Demande, Creneau } from '@/lib/supabase'
import { Inbox, FileText, CalendarDays, CheckCircle2, Wrench, PartyPopper, Phone, MapPin, Check } from 'lucide-react'

const STEPS = [
  { key:'nouvelle',        label:'Demande reçue',        Icon:Inbox,        desc:'Votre demande a bien été transmise' },
  { key:'devis_envoye',    label:'Devis en préparation', Icon:FileText,     desc:"L'artisan prépare votre devis" },
  { key:'creneau_propose', label:'Créneaux proposés',    Icon:CalendarDays, desc:'Choisissez un créneau ci-dessous' },
  { key:'confirme',        label:'RDV confirmé',          Icon:CheckCircle2, desc:"L'intervention est planifiée" },
  { key:'en_cours',        label:'En cours',              Icon:Wrench,       desc:"L'artisan est sur place" },
  { key:'paye',            label:'Terminé',               Icon:PartyPopper,  desc:'Merci de votre confiance' },
]

type D = Demande & { artisans?: { nom:string; nom_entreprise:string; telephone:string } }

export default function Suivi() {
  const { token } = useParams<{ token:string }>()
  const [data, setData] = useState<D|null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function load() {
    const r = await fetch(`/api/suivi/${token}`)
    setData(await r.json()); setLoading(false)
  }
  useEffect(() => { load() }, [token])

  async function accepter(c: Creneau) {
    setBusy(true)
    const r = await fetch(`/api/suivi/${token}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'accepter_creneau', creneau:c }) })
    if (r.ok) setData(await r.json()); setBusy(false)
  }
  async function aucun() {
    setBusy(true)
    const r = await fetch(`/api/suivi/${token}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'aucun_creneau' }) })
    if (r.ok) setData(await r.json()); setBusy(false)
  }

  if (loading) return <Shell><div style={{display:'flex',justifyContent:'center',padding:'80px 0'}}><div className="spinner" /></div></Shell>
  if (!data||(data as any).error) return <Shell><p style={{textAlign:'center',color:'var(--red)',padding:'80px 0',fontSize:14}}>Demande introuvable.</p></Shell>

  const idx = STEPS.findIndex(s=>s.key===data.statut)
  const current = STEPS[idx]
  const entreprise = data.artisans?.nom_entreprise || data.artisans?.nom || 'Votre artisan'
  const CurIcon = current?.Icon || Inbox

  return (
    <Shell>
      <div style={{maxWidth:400,margin:'0 auto',width:'100%'}}>
        <div className="hero-card a-scaleIn" style={{padding:'28px 22px',textAlign:'center',marginBottom:16}}>
          <div style={{position:'relative',zIndex:1}}>
            <div style={{width:60,height:60,borderRadius:18,background:'rgba(255,255,255,0.18)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
              <CurIcon size={28} color="#fff" />
            </div>
            <p style={{fontSize:19,fontWeight:800,letterSpacing:'-0.03em',marginBottom:4}}>{current?.label}</p>
            <p style={{fontSize:13,opacity:.85,marginBottom:8}}>{current?.desc}</p>
            <div style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'5px 12px'}}>
              <span style={{fontSize:12,fontWeight:600}}>{entreprise}</span><span style={{opacity:.6}}>·</span><span style={{fontSize:12}}>{data.type_intervention}</span>
            </div>
          </div>
        </div>

        <div className="card a-fadeUp" style={{overflow:'hidden',marginBottom:12}}>
          {STEPS.map((s,i)=>{
            const done = i<idx, active = i===idx, future = i>idx
            const Ic = s.Icon
            return (
              <div key={s.key} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',background:active?'var(--blue-dim)':'#fff',borderBottom:i<STEPS.length-1?'1px solid var(--border)':'none',opacity:future?.4:1,transition:'all .3s'}}>
                <div className="icon-tile" style={{width:32,height:32,borderRadius:'50%',background:done?'var(--green)':active?'var(--blue)':'var(--surface2)',transition:'all .3s',boxShadow:active?'var(--shadow-blue)':'none'}}>
                  {done ? <Check size={15} color="#fff" /> : <Ic size={15} color={active?'#fff':'var(--text3)'} />}
                </div>
                <span style={{fontSize:13,fontWeight:600,flex:1,color:active?'var(--blue)':done?'var(--text)':'var(--text3)'}}>{s.label}</span>
                {active && <span style={{width:7,height:7,borderRadius:'50%',background:'var(--blue)',animation:'pulseDot 1.4s ease-in-out infinite'}} />}
              </div>
            )
          })}
        </div>

        {data.statut==='creneau_propose' && data.creneaux_proposes && (
          <div className="card a-slideUp" style={{padding:16,marginBottom:12}}>
            <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>Choisissez un créneau</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {data.creneaux_proposes.map((c,i)=>(
                <button key={i} onClick={()=>accepter(c)} disabled={busy}
                  style={{padding:'14px 16px',borderRadius:13,border:'1px solid var(--border)',background:'var(--surface2)',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',transition:'all .2s',opacity:busy?.6:1}}>
                  <div style={{textAlign:'left'}}>
                    <p style={{fontSize:14,fontWeight:600}}>{formatDate(c.date)}</p>
                    <p style={{fontSize:12,color:'var(--text3)',marginTop:2}}>{formatHeure(c.heure_debut)} – {formatHeure(c.heure_fin)}</p>
                  </div>
                  <span className="badge" style={{background:'var(--blue)',color:'#fff'}}>Choisir</span>
                </button>
              ))}
            </div>
            <button onClick={aucun} disabled={busy} style={{width:'100%',marginTop:10,padding:'8px 0',fontSize:12,color:'var(--text3)',background:'none',border:'none',cursor:'pointer'}}>Aucun créneau ne me convient</button>
          </div>
        )}

        {(data.statut==='confirme'||data.statut==='en_cours') && data.creneau_accepte && (
          <div className="a-fadeUp" style={{background:'var(--green-dim)',border:'1px solid #a7f3d0',borderRadius:16,padding:16,marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}><CheckCircle2 size={16} color="var(--green)" /><p style={{fontSize:13,fontWeight:700,color:'var(--green)'}}>Intervention confirmée</p></div>
            <p style={{fontSize:15,fontWeight:600}}>{formatDate(data.creneau_accepte.date)}</p>
            <p style={{fontSize:13,color:'var(--text2)',marginTop:2}}>{formatHeure(data.creneau_accepte.heure_debut)} – {formatHeure(data.creneau_accepte.heure_fin)}</p>
            <p style={{fontSize:12,color:'var(--text3)',marginTop:6,display:'flex',alignItems:'center',gap:4}}><MapPin size={13}/>{data.client_adresse}</p>
          </div>
        )}

        {data.artisans?.telephone && (
          <a href={`tel:${data.artisans.telephone}`} className="btn-ghost a-fadeUp" style={{textDecoration:'none',background:'#fff'}}>
            <Phone size={16}/>Appeler {entreprise}
          </a>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{minHeight:'100vh',background:'var(--bg-grad)',padding:'40px 16px 60px'}}>{children}</div>
}
