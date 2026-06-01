import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400','500','600','700','800','900'],
})

export const metadata: Metadata = {
  title: 'TraceOn — Gestion chantiers artisans',
  description: 'Formulaire client, suivi en temps réel, dashboard patron',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'TraceOn' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#e8f0fe',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;var pub=p.indexOf('/formulaire')===0||p.indexOf('/suivi')===0;var t=localStorage.getItem('traceon-theme')||'system';var d=!pub&&(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches));var e=document.documentElement;e.setAttribute('data-theme',d?'dark':'light');e.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
