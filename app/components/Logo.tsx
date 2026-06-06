import * as React from 'react'

// Marque TraceOn — le « T » officiel (barre + jambage à pied courbé).
// Utilisé partout où c'est la marque TraceOn (jamais sur les devis = logo de l'artisan).
export function TraceOnMark({ size = 28, color = '#1d5fed', style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" style={style} aria-label="TraceOn" role="img">
      <rect x="108" y="116" width="296" height="58" rx="29" fill={color} />
      <path d="M256 150 L256 372 Q262 416 322 398" stroke={color} strokeWidth="58" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// Logo complet : marque + mot « TraceOn »
export function TraceOnLogo({ size = 26, color = '#1d5fed', text = '#0c1424', style }: { size?: number; color?: string; text?: string; style?: React.CSSProperties }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.34, ...style }}>
      <TraceOnMark size={size} color={color} />
      <span style={{ fontSize: size * 0.78, fontWeight: 800, letterSpacing: '-0.02em', color: text }}>TraceOn</span>
    </span>
  )
}
