import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Somni',
    short_name: 'Somni',
    description: 'Calm infant sleep coaching with source-backed guidance.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0d1730',
    theme_color: '#0d1730',
    orientation: 'portrait',
    icons: [
      {
        src: '/pwa/icon/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
