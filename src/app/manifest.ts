import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Somni',
    short_name: 'Somni',
    description: 'Calm, grounded infant sleep coaching.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0c1a',
    theme_color: '#0a0c1a',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}