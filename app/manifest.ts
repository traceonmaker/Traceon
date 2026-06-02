import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TraceOn — Votre business, sous contrôle',
    short_name: 'TraceOn',
    description: 'Demandes clients, planning, devis et encaissements pour artisans.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c1f3f',
    theme_color: '#1d5fed',
    orientation: 'portrait',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
