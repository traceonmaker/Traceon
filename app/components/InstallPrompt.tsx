'use client'
import { useState, useEffect } from 'react'
import { Download, Share, Plus, X } from 'lucide-react'

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [iosGuide, setIosGuide] = useState(false)

  useEffect(() => {
    // Déjà installée ?
    const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    if (installed) return
    if (localStorage.getItem('traceon_install_dismissed')) return

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const handler = (e: any) => { e.preventDefault(); setDeferred(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS ne déclenche pas beforeinstallprompt → on montre le guide après un court délai
    if (isIOS) { setTimeout(() => setShow(true), 1200) }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() { setShow(false); localStorage.setItem('traceon_install_dismissed', '1') }

  async function install() {
    if (deferred) {
      deferred.prompt()
      await deferred.userChoice
      setDeferred(null); setShow(false)
    } else {
      setIosGuide(true) // pas de prompt natif (iOS) → instructions
    }
  }

  if (!show) return null

  return (
    <div style={{position:'fixed',left:16,right:16,bottom:90,zIndex:45,maxWidth:448,margin:'0 auto'}} className="a-slideUp">
      <div className="card" style={{padding:14,display:'flex',alignItems:'center',gap:12,boxShadow:'var(--shadow-lg)'}}>
        <div className="icon-tile" style={{width:44,height:44,borderRadius:13,background:'linear-gradient(135deg,#1565ff,#0a47d8)'}}>
          <Download size={20} color="#fff" />
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:14,fontWeight:700}}>Installer l'application</p>
          <p style={{fontSize:12,color:'var(--text3)'}}>Accès direct depuis votre écran d'accueil.</p>
        </div>
        <button onClick={install} className="btn-primary" style={{width:'auto',padding:'10px 16px',fontSize:13}}>Installer</button>
        <button onClick={dismiss} className="fab" style={{width:32,height:32}}><X size={15}/></button>
      </div>

      {iosGuide && (
        <div className="card" style={{padding:14,marginTop:10}}>
          <p style={{fontSize:13,fontWeight:700,marginBottom:8}}>Sur iPhone :</p>
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text2)',marginBottom:6}}>
            <Share size={16} color="var(--blue)"/> 1. Appuyez sur <b>Partager</b>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text2)'}}>
            <Plus size={16} color="var(--blue)"/> 2. <b>Sur l'écran d'accueil</b>
          </div>
        </div>
      )}
    </div>
  )
}
