'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BellRing, Check } from 'lucide-react'

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export default function PushSetup({ artisanId }: { artisanId: string }) {
  const [state, setState] = useState<'idle'|'on'|'unsupported'|'denied'|'loading'>('idle')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setState('unsupported'); return }
    navigator.serviceWorker.register('/sw.js').catch(() => {})
    if (Notification.permission === 'denied') { setState('denied'); return }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => { if (sub) setState('on') })
      .catch(() => {})
  }, [])

  async function activer() {
    try {
      setState('loading')
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'idle'); return }
      const reg = await navigator.serviceWorker.ready
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key) { setState('idle'); return }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) })
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ artisan_id: artisanId, subscription: sub }),
      })
      try { (navigator as any).vibrate?.(10) } catch {}
      setState('on')
    } catch {
      setState('idle')
    }
  }

  if (state === 'unsupported') return <p style={{fontSize:13,color:'var(--text3)',lineHeight:1.5}}>Pour recevoir les notifications, installez l'app sur l'écran d'accueil (section ci-dessous), puis revenez ici.</p>
  if (state === 'denied') return <p style={{fontSize:13,color:'var(--text3)',lineHeight:1.5}}>Notifications bloquées. Autorisez-les dans les réglages du navigateur, puis réessayez.</p>
  if (state === 'on') return <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'var(--green)',fontWeight:600}}><Check size={16}/> Notifications activées sur cet appareil</div>

  return (
    <>
      <p style={{fontSize:13,color:'var(--text2)',marginBottom:12,lineHeight:1.5}}>Recevez chaque nouvelle demande directement sur ce téléphone, même l'application fermée.</p>
      <button onClick={activer} disabled={state==='loading'} className="btn-primary">
        {state==='loading' ? <span className="spinner spinner-w" /> : <><BellRing size={17}/>Activer les notifications</>}
      </button>
    </>
  )
}
