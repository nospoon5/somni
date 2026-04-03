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
            'radial-gradient(circle at top, rgba(216,187,125,0.22), transparent 45%), radial-gradient(circle at 85% 20%, rgba(142,182,160,0.22), transparent 40%), linear-gradient(180deg, #0d1730 0%, #162544 55%, #f4ecdc 160%)',
          fontFamily:
            '"Geist", "Geist Fallback", "Avenir Next", "Segoe UI", sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: 142,
            height: 142,
            borderRadius: 36,
            background: 'rgba(15,26,47,0.74)',
            border: '1px solid rgba(227,235,244,0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 22px 50px rgba(4,10,24,0.34)',
          }}
        >
          <div
            style={{
              color: '#fbf7ef',
              fontSize: 44,
              fontWeight: 650,
              letterSpacing: '-0.06em',
            }}
          >
            Somni
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 22,
            top: 22,
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'rgba(216,187,125,0.95)',
            boxShadow: '0 16px 40px rgba(4,10,24,0.28)',
          }}
        />
      </div>
    ),
    size
  )
}

