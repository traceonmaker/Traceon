'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BellRing, X, Download } from 'lucide-react'

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64); const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// Bandeau bien visible sur l'Accueil : pousse l'artisan à activer les notifications.
// Gère iOS (push impossible tant que l'app n'est pas installée sur l'écran d'accueil).
export default function PushBanner({ artisanId }: { artisanId: string }) {
  const [show, setShow] = useState(false)
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('push-banner-hidden') === '1') return
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const installed = (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone)
    if (Notification?.permission === 'granted') return // déjà autorisé
    if (Notification?.permission === 'denied') return
    if (isIOS && !installed) { setIosNeedsInstall(true); setShow(true); return }
    if (!supported) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())
      .then(sub => { if (!sub) setShow(true) }).catch(() => setShow(true))
  }, [])

  async function activer() {
    try {
      setLoading(true)
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setLoading(false); if (perm === 'denied') setShow(false); return }
      const reg = await navigator.serviceWorker.ready
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key) { setLoading(false); return }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) })
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ artisan_id: artisanId, subscription: sub }),
      })
      try { (navigator as any).vibrate?.(12) } catch {}
      setShow(false)
    } catch { setLoading(false) }
  }
  function masquer() { try { sessionStorage.setItem('push-banner-hidden', '1') } catch {}; setShow(false) }

  if (!show) return null

  return (
    <div style={{ background: 'linear-gradient(135deg,#2a63de,#1550cf)', borderRadius: 16, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow-blue)', position: 'relative' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <BellRing size={20} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {iosNeedsInstall ? (
          <>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Activez les alertes sur iPhone</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 1.4 }}>Bouton Partager <b>↑</b> → « Sur l'écran d'accueil ». Ouvrez l'app installée, puis activez.</p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Recevez chaque demande sur ce téléphone</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 1.4 }}>Même l'app fermée. Ne ratez plus jamais un client.</p>
          </>
        )}
      </div>
      {iosNeedsInstall
        ? <Download size={18} color="#fff" style={{ flexShrink: 0 }} />
        : <button onClick={activer} disabled={loading} style={{ flexShrink: 0, background: '#fff', color: '#1550cf', border: 'none', borderRadius: 11, padding: '9px 15px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{loading ? '…' : 'Activer'}</button>}
      <button onClick={masquer} aria-label="Masquer" style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.7)' }}><X size={15} /></button>
    </div>
  )
}
