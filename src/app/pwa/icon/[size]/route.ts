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

  const fontSize = Math.round(dimension * 0.36)

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
            'radial-gradient(ellipse at 60% 0%, rgba(18, 22, 39, 0.8) 0%, transparent 60%), #0a0c1a',
          position: 'relative',
          fontFamily: '"Playfair Display", Georgia, serif',
        },
      },
      createElement(
        'div',
        {
          style: {
            width: Math.round(dimension * 0.78),
            height: Math.round(dimension * 0.78),
            borderRadius: Math.round(dimension * 0.22),
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(232, 180, 74, 0.12)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        createElement(
          'div',
          {
            style: {
              color: '#fef0dc',
              fontSize,
              fontWeight: 700,
              letterSpacing: '-0.03em',
            },
          },
          'S'
        )
      )
    ),
    {
      width: dimension,
      height: dimension,
    }
  )
}