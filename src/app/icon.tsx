import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d1730',
          color: '#fbf7ef',
          fontSize: 18,
          fontWeight: 700,
          fontFamily:
            '"Geist", "Geist Fallback", "Avenir Next", "Segoe UI", sans-serif',
        }}
      >
        S
      </div>
    ),
    size
  )
}

