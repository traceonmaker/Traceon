'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, ArrowRight } from 'lucide-react'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setLoading(true)
    const mail = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
    if (error) { setLoading(false); setErr('Email ou mot de passe incorrect.'); return }
    const { data } = await supabase.from('artisans').select('id').ilike('email', mail).maybeSingle()
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
          Connectez-vous avec votre email et le mot de passe reçu par SMS.
        </p>

        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Email</label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@entreprise.fr" className="input-field" autoComplete="email" />
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:'var(--label)',display:'block',marginBottom:6}}>Mot de passe</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="input-field" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <span className="spinner spinner-w" /> : <>Se connecter<ArrowRight size={16}/></>}
          </button>
        </form>

        {err && <div style={{marginTop:16,background:'var(--red-dim)',border:'1px solid #fecaca',color:'var(--red)',borderRadius:12,padding:'11px 14px',fontSize:13,fontWeight:600,textAlign:'center'}}>{err}</div>}

        <p style={{fontSize:13,color:'var(--text3)',textAlign:'center',marginTop:20}}>
          Pas encore de compte ?{' '}
          <a href="/onboarding" style={{color:'var(--blue)',fontWeight:700,textDecoration:'none'}}>Créer mon espace</a>
        </p>
      </div>
    </div>
  )
}
