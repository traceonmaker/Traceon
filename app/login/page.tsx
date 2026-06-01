'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react'

export default function Login() {
  const router = useRouter()
  const [phase, setPhase] = useState<'email'|'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function sendCode(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true)
    const mail = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: true } })
    setLoading(false)
    if (error) { setErr(error.message); return }
    setEmail(mail); setPhase('code')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })
    if (error) { setLoading(false); setErr('Code invalide ou expiré.'); return }
    // Où aller : compte existant → son dashboard ; sinon → onboarding
    const { data } = await supabase.from('artisans').select('id').ilike('email', email).maybeSingle()
    router.replace(data?.id ? `/dashboard/${data.id}` : '/onboarding')
  }

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-grad)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div className="card a-scaleIn" style={{maxWidth:400,width:'100%',padding:'30px 26px'}}>
        <div style={{width:54,height:54,borderRadius:16,background:'linear-gradient(135deg,#2a63de,#1550cf)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'var(--shadow-blue)'}}>
          <ShieldCheck size={26} color="#fff" />
        </div>
        <h1 style={{fontSize:23,fontWeight:800,letterSpacing:'-0.03em',textAlign:'center',marginBottom:6}}>Connexion TraceOn</h1>
        <p style={{fontSize:14,color:'var(--text2)',textAlign:'center',lineHeight:1.5,marginBottom:24}}>
          {phase==='email'
            ? 'Entrez votre email : on vous envoie un code de connexion. Pas de mot de passe.'
            : <>Code envoyé à <b>{email}</b>. Vérifiez vos emails.</>}
        </p>

        {phase==='email' ? (
          <form onSubmit={sendCode} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Email</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@entreprise.fr" className="input-field" autoComplete="email" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <span className="spinner spinner-w" /> : <><Mail size={16}/>Recevoir mon code</>}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Code reçu par email</label>
              <input inputMode="numeric" required value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" className="input-field" style={{textAlign:'center',fontSize:22,letterSpacing:'0.3em',fontWeight:800}} autoFocus />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <span className="spinner spinner-w" /> : <>Se connecter<ArrowRight size={16}/></>}
            </button>
            <button type="button" onClick={()=>{ setPhase('email'); setCode(''); setErr('') }} style={{background:'none',border:'none',color:'var(--text3)',fontSize:13,fontWeight:600,cursor:'pointer'}}>← Changer d'email</button>
          </form>
        )}

        {err && <div style={{marginTop:16,background:'var(--red-dim)',border:'1px solid #fecaca',color:'var(--red)',borderRadius:12,padding:'11px 14px',fontSize:13,fontWeight:600,textAlign:'center'}}>{err}</div>}
      </div>
    </div>
  )
}
