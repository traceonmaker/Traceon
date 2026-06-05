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
          <rect x="146" y="150" width="220" height="46" rx="23" fill="#1d5fed" />
          <path d="M256 170 L268 338 Q272 369 303 356" fill="none" stroke="#1d5fed" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
