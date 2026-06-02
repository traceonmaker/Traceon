import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(145deg, #2a6af0 0%, #1550cf 55%, #0c2f7a 100%)',
      }}>
        <div style={{
          width: 132, height: 244,
          borderRight: '46px solid #ffffff',
          borderBottom: '46px solid #ffffff',
          borderBottomRightRadius: 10,
          transform: 'rotate(45deg)',
          marginTop: -34,
        }} />
      </div>
    ),
    { ...size }
  )
}
