'use client'
import { useEffect } from 'react'
import { Check } from 'lucide-react'

/** Animation de premier lancement : déblocage de la marque + plongée dans l'app. */
export default function LaunchIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(onDone, reduce ? 450 : 2300)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="intro-overlay" role="presentation">
      <div className="intro-mark"><Check size={50} color="#fff" strokeWidth={3} /></div>
      <div className="intro-word">TraceOn</div>
      <div className="intro-tag">Votre business, sous contrôle</div>
    </div>
  )
}
