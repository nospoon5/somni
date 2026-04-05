import type { Metadata } from 'next'
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { PwaServiceWorker } from '@/components/pwa/PwaServiceWorker'
import { SiteFooter } from '@/components/ui/SiteFooter'
import { AppBottomNav } from '@/components/ui/AppBottomNav'

const displayFont = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const bodyFont = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500'],
  display: 'swap',
})

const monoFont = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Somni',
  description: 'Calm infant sleep coaching with source-backed guidance.',
  applicationName: 'Somni',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Somni',
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en-AU"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
    >
      <body>
        <PwaServiceWorker />
        {children}
        <AppBottomNav />
        <SiteFooter />
      </body>
    </html>
  )
}