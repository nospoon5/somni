import { ImageResponse } from 'next/og'
import { createElement } from 'react'

export const runtime = 'edge'

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params
  const requested = Number.parseInt(size, 10)
  const dimension = clampNumber(Number.isFinite(requested) ? requested : 512, 32, 1024)

  const fontSize = Math.round(dimension * 0.28)
  const badgeSize = Math.round(dimension * 0.2)

  return new ImageResponse(
    createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at top, rgba(216,187,125,0.22), transparent 45%), radial-gradient(circle at 85% 20%, rgba(142,182,160,0.22), transparent 40%), linear-gradient(180deg, #0d1730 0%, #162544 55%, #f4ecdc 160%)',
          position: 'relative',
          fontFamily:
            '"Geist", "Geist Fallback", "Avenir Next", "Segoe UI", sans-serif',
        },
      },
      createElement(
        'div',
        {
          style: {
            width: Math.round(dimension * 0.78),
            height: Math.round(dimension * 0.78),
            borderRadius: Math.round(dimension * 0.22),
            background: 'rgba(15,26,47,0.74)',
            border: '1px solid rgba(227,235,244,0.16)',
            boxShadow: '0 22px 50px rgba(4,10,24,0.34)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        createElement(
          'div',
          {
            style: {
              color: '#fbf7ef',
              fontSize,
              fontWeight: 650,
              letterSpacing: '-0.06em',
            },
          },
          'Somni'
        )
      ),
      createElement('div', {
        style: {
          position: 'absolute',
          right: Math.round(dimension * 0.14),
          top: Math.round(dimension * 0.14),
          width: badgeSize,
          height: badgeSize,
          borderRadius: 999,
          background: 'rgba(216,187,125,0.95)',
          boxShadow: '0 16px 40px rgba(4,10,24,0.28)',
        },
      })
    ),
    {
      width: dimension,
      height: dimension,
    }
  )
}
