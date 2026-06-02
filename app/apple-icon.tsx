import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(145deg, #2a6af0 0%, #1550cf 55%, #0c2f7a 100%)',
      }}>
        <div style={{
          width: 46, height: 86,
          borderRight: '16px solid #ffffff',
          borderBottom: '16px solid #ffffff',
          borderBottomRightRadius: 4,
          transform: 'rotate(45deg)',
          marginTop: -12,
        }} />
      </div>
    ),
    { ...size }
  )
}
