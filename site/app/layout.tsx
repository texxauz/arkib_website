import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT', 'WONK'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-index',
  weight: ['400', '500'],
  display: 'swap',
})

const siteUrl = 'https://arkib.bar'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'ARKIB — A Bar for What Stays',
    template: '%s — ARKIB',
  },
  description:
    'ARKIB is a design-led cocktail bar in Melaka, Malaysia. A sensory archive of drinks, culture and people.',
  openGraph: {
    title: 'ARKIB — A Bar for What Stays',
    description:
      'A sensory archive of drinks, culture and people. Design-led cocktail bar in Melaka, Malaysia.',
    url: siteUrl,
    siteName: 'ARKIB',
    locale: 'en_MY',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ARKIB — A Bar for What Stays',
    description: 'A sensory archive of drinks, culture and people.',
  },
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#11100e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full bg-arkib-black text-warm-paper antialiased">
        {/* .reveal hides content until scrolled into view (progressive
            enhancement, see Reveal.tsx) — without JS, show it all up front. */}
        <noscript>
          <style>{'.reveal{opacity:1!important;transform:none!important;}'}</style>
        </noscript>
        {children}
      </body>
    </html>
  )
}
