import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

// Image de couverture / OG (1200×628) — logo officiel + signature de marque.
export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
        background: 'linear-gradient(140deg, #2a63de 0%, #1550cf 42%, #0c2f7a 78%, #061640 100%)',
        color: '#fff', fontFamily: 'sans-serif',
      }}>
        {/* lueur d'ambiance */}
        <div style={{ position: 'absolute', top: -160, left: 380, width: 480, height: 420, background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 70%)' }} />

        {/* Tuile blanche avec le T officiel */}
        <div style={{
          width: 132, height: 132, borderRadius: 34, display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: '#ffffff',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)', marginBottom: 34,
        }}>
          <svg width="92" height="92" viewBox="0 0 512 512">
            <rect x="113" y="108" width="286" height="57" rx="28.5" fill="#1d5fed" />
            <path d="M256 120 L271 374 Q282 430 348 405" fill="none" stroke="#1d5fed" strokeWidth="57" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div style={{ display: 'flex', fontSize: 86, fontWeight: 900, letterSpacing: -3 }}>
          <span>Trace</span><span style={{ color: '#9cc0ff' }}>On</span>
        </div>

        <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, letterSpacing: 2, marginTop: 16, opacity: 0.88 }}>
          Votre business, sous contrôle
        </div>
      </div>
    ),
    { width: 1200, height: 628 }
  )
}
