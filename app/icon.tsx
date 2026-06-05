import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

// Icône TraceOn aux normes Apple : plein-bord (l'OS applique le masque),
// « T » optiquement centré, tracé net à embouts arrondis.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #ffffff 0%, #eef2f9 100%)',
      }}>
        <svg width="512" height="512" viewBox="0 0 512 512">
          <rect x="146" y="150" width="220" height="46" rx="23" fill="#1d5fed" />
          <path d="M256 170 L268 338 Q272 369 303 356" fill="none" stroke="#1d5fed" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
