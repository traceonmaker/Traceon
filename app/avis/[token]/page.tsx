'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Star, CheckCircle2 } from 'lucide-react'

export default function AvisPage() {
  const { token } = useParams<{ token: string }>()
  const [note, setNote] = useState(0)
  const [hover, setHover] = useState(0)
  const [commentaire, setCommentaire] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [google, setGoogle] = useState<string | null>(null)
  const [entreprise, setEntreprise] = useState('')

  async function envoyer() {
    if (!note) return
    setSending(true)
    try {
      const r = await fetch('/api/avis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, note, commentaire }),
      })
      const d = await r.json()
      if (r.ok) { setGoogle(d.google_avis_url); setEntreprise(d.entreprise); setDone(true) }
    } finally { setSending(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-grad)', padding: '48px 16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        {done ? (
          <div className="card a-scaleIn" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <CheckCircle2 size={38} color="var(--green)" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>Merci pour votre avis !</h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: google ? 22 : 0 }}>
              Votre retour aide {entreprise || 'votre artisan'} à progresser.
            </p>
            {google && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.5 }}>
                  Vous pouvez aussi le partager sur Google en 10 secondes — un vrai coup de pouce pour un artisan local.
                </p>
                <a href={google} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none' }}>
                  <Star size={16} /> Laisser un avis Google
                </a>
              </>
            )}
          </div>
        ) : (
          <div className="card a-fadeUp" style={{ padding: '30px 24px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>Votre intervention s'est bien passée ?</h1>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 24, lineHeight: 1.5 }}>Donnez votre note — ça prend 10 secondes.</p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setNote(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }} aria-label={`${n} étoiles`}>
                  <Star size={40} strokeWidth={1.5}
                    color={(hover || note) >= n ? '#f59e0b' : 'var(--border2)'}
                    fill={(hover || note) >= n ? '#f59e0b' : 'none'} />
                </button>
              ))}
            </div>

            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={3}
              placeholder="Un mot sur votre expérience (optionnel)" className="input-field"
              style={{ resize: 'none', lineHeight: 1.5, marginBottom: 18, textAlign: 'left' }} />

            <button onClick={envoyer} disabled={!note || sending} className="btn-primary" style={{ width: '100%' }}>
              {sending ? <span className="spinner spinner-w" /> : 'Envoyer mon avis'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
