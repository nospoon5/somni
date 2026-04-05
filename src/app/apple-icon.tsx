import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(ellipse at 60% 0%, rgba(18, 22, 39, 0.8) 0%, transparent 60%), #0a0c1a',
          fontFamily: '"DM Sans", system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 36,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(232, 180, 74, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              color: '#fef0dc',
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              fontFamily: '"Playfair Display", Georgia, serif',
            }}
          >
            S
          </div>
        </div>
      </div>
    ),
    size
  )
}