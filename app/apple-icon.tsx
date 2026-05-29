import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1565ff 0%, #0a47d8 55%, #042aa0 100%)',
        color: '#fff', fontSize: 110, fontWeight: 800,
      }}>
        T
      </div>
    ),
    { ...size }
  )
}
