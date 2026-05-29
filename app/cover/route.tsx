import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

// Image de couverture WhatsApp Business — PNG prêt à enregistrer
export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #2f6bff 0%, #0e3bb0 45%, #071a55 80%, #040f33 100%)',
        color: '#fff', fontFamily: 'sans-serif', padding: '0 60px',
      }}>
        <div style={{
          width: 92, height: 92, borderRadius: 24, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.16)', border: '2px solid rgba(255,255,255,0.35)',
          fontSize: 50, fontWeight: 900, marginBottom: 26,
        }}>T</div>

        <div style={{ display: 'flex', fontSize: 76, fontWeight: 900, letterSpacing: -3, marginBottom: 18 }}>
          <span>Trace</span><span style={{ color: '#7eb0ff' }}>On</span>
        </div>

        <div style={{
          display: 'flex', fontSize: 30, fontWeight: 700, textAlign: 'center',
          maxWidth: 820, lineHeight: 1.3, marginBottom: 30,
        }}>
          Sites web &amp; applications pro pour entreprises — sur abonnement.
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {['Livré rapidement', 'Tout géré', 'Sans gros budget'].map(t => (
            <div key={t} style={{
              display: 'flex', background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.28)', borderRadius: 100,
              padding: '12px 24px', fontSize: 22, fontWeight: 600,
            }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 628 }
  )
}
