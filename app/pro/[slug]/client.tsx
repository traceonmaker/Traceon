'use client'
import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'

const GLASS = 'rgba(255,255,255,0.06)'
const BORDER = 'rgba(255,255,255,0.12)'

// Révélation au scroll (fade + montée)
export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShow(true); io.disconnect() } }, { threshold: 0.14 })
    io.observe(el); return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} style={{
      opacity: show ? 1 : 0,
      transform: show ? 'none' : 'translateY(26px)',
      transition: `opacity .7s ease ${delay}ms, transform .8s cubic-bezier(.22,1,.36,1) ${delay}ms`,
    }}>{children}</div>
  )
}

// Carrousel d'avis qui tournent automatiquement (crossfade + points)
export function AvisCarousel({ avis }: { avis: any[] }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (avis.length <= 1 || paused) return
    const t = setInterval(() => setI(p => (p + 1) % avis.length), 4200)
    return () => clearInterval(t)
  }, [avis.length, paused])

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div style={{ position: 'relative', minHeight: 180 }}>
        {avis.map((av, k) => (
          <div key={k} aria-hidden={k !== i} style={{
            position: k === i ? 'relative' : 'absolute', inset: 0,
            opacity: k === i ? 1 : 0,
            transform: k === i ? 'none' : 'translateY(10px) scale(.98)',
            transition: 'opacity .6s ease, transform .6s cubic-bezier(.22,1,.36,1)',
            pointerEvents: k === i ? 'auto' : 'none',
          }}>
            <div style={{ maxWidth: 560, margin: '0 auto', background: GLASS, border: `1px solid ${BORDER}`, borderRadius: 22, padding: '28px 26px', textAlign: 'center', backdropFilter: 'blur(14px)' }}>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 14 }}>
                {Array.from({ length: 5 }).map((_, s) => <Star key={s} size={18} color="#f5b740" fill={s < av.note ? '#f5b740' : 'none'} />)}
              </div>
              {av.commentaire && <p style={{ fontSize: 'clamp(16px,2.5vw,19px)', lineHeight: 1.55, color: '#f4f7ff', fontWeight: 500 }}>“{av.commentaire}”</p>}
              <p style={{ fontSize: 13, color: 'rgba(244,247,255,0.5)', marginTop: 16, fontWeight: 600 }}>
                {av.client_nom || 'Client vérifié'}{av.lieu ? ` · ${av.lieu}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
      {avis.length > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
          {avis.map((_, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`Avis ${k + 1}`} style={{
              width: k === i ? 26 : 8, height: 8, borderRadius: 4, border: 'none', cursor: 'pointer',
              background: k === i ? '#5b8cff' : 'rgba(255,255,255,0.22)', transition: 'all .35s ease', padding: 0,
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
