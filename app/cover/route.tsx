import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

// Image de couverture WhatsApp Business — PNG prêt à enregistrer
export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        background: 'linear-gradient(135deg, #2f6bff 0%, #0e3bb0 45%, #071a55 80%, #040f33 100%)',
        color: '#fff', fontFamily: 'sans-serif', paddingTop: 78,
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: 26, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.16)', border: '2px solid rgba(255,255,255,0.38)',
          fontSize: 52, fontWeight: 900, marginBottom: 26,
        }}>T</div>

        <div style={{ display: 'flex', fontSize: 84, fontWeight: 900, letterSpacing: -3 }}>
          <span>Trace</span><span style={{ color: '#7eb0ff' }}>On</span>
        </div>

        <div style={{
          display: 'flex', fontSize: 21, fontWeight: 600, letterSpacing: 5,
          marginTop: 14, opacity: 0.85,
        }}>
          SOLUTIONS DIGITALES
        </div>
      </div>
    ),
    { width: 1200, height: 628 }
  )
}
