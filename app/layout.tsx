import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'ARKIB — Bar Management System',
  description: 'Internal bar management system for ARKIB cocktail bar',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-[#0A0A0B] text-[#F0EEF6] antialiased">
        {children}
      </body>
    </html>
  )
}
