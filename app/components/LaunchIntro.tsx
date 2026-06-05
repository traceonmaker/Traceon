'use client'
import { useEffect } from 'react'

/** Animation de premier lancement façon Apple : « Bonjour » + nom de l'entreprise,
 *  puis plongée dans l'app. */
export default function LaunchIntro({ onDone, nom }: { onDone: () => void; nom?: string }) {
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(onDone, reduce ? 450 : 2300)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="intro-overlay" role="presentation">
      <div className="intro-hello">Bonjour</div>
      {nom && <div className="intro-word">{nom}</div>}
      <div className="intro-tag">Votre business, sous contrôle</div>
    </div>
  )
}
