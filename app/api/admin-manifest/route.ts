import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Manifest dédié au cockpit admin → permet de l'installer comme app séparée
// (sur le téléphone ET le bureau), qui ouvre directement /admin.
export async function GET() {
  return NextResponse.json({
    name: 'TraceOn — Cockpit',
    short_name: 'TraceOn Admin',
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    background_color: '#06080f',
    theme_color: '#06080f',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json' } })
}
