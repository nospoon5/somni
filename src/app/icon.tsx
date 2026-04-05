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
          background: '#0a0c1a',
          color: '#fef0dc',
          fontSize: 18,
          fontWeight: 700,
          fontFamily: '"DM Sans", system-ui, sans-serif',
        }}
      >
        S
      </div>
    ),
    size
  )
}