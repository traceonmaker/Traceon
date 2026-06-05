import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Icône iOS plein-bord — Apple applique son masque squircle automatiquement.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #ffffff 0%, #eef2f9 100%)',
      }}>
        <svg width="180" height="180" viewBox="0 0 512 512">
          <rect x="113" y="108" width="286" height="57" rx="28.5" fill="#1d5fed" />
          <path d="M256 120 L271 374 Q282 430 348 405" fill="none" stroke="#1d5fed" strokeWidth="57" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
