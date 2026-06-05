'use client'
import { useState, useEffect } from 'react'
import { Users, TrendingUp, Euro, RefreshCw, ExternalLink, Wallet, Sparkles, Clock, Phone, MessageSquare, Mail, Ban, RotateCcw, Download, Send, Megaphone, Activity } from 'lucide-react'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' €'

const C = {
  bg: '#06080f', txt: '#f4f7ff', mut: 'rgba(244,247,255,0.6)', mut2: 'rgba(244,247,255,0.38)',
  glass: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)', accent: '#5b8cff',
}

export default function Admin() {
  const [key, setKey] = useState('')
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const [deferred, setDeferred] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function charger(k: string) {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/admin/data', { method: 'POST', headers: { 'x-admin-key': k } })
      if (!r.ok) { setErr('Clé invalide'); setData(null); return }
      setData(await r.json())
      try { localStorage.setItem('traceon-admin-key', k) } catch {}
    } catch { setErr('Erreur réseau') } finally { setLoading(false) }
  }
  useEffect(() => {
    const k = (() => { try { return localStorage.getItem('traceon-admin-key') || '' } catch { return '' } })()
    if (k) { setKey(k); charger(k) }
    // Manifest dédié → installable comme app séparée (ouvre /admin)
    const link = document.createElement('link'); link.rel = 'manifest'; link.href = '/api/admin-manifest'
    document.head.appendChild(link)
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); link.remove() }
  }, [])

  async function suspendre(id: string, action: 'suspendre' | 'reactiver') {
    setBusy(id)
    try {
      await fetch('/api/admin/suspend', { method: 'POST', headers: { 'x-admin-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ artisan_id: id, action }) })
      await charger(key)
    } finally { setBusy(null) }
  }
  async function installer() { if (deferred) { deferred.prompt(); await deferred.userChoice; setDeferred(null) } }

  const shell = (children: any) => (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.txt, position: 'relative', overflow: 'hidden', fontFamily: "'SF Pro Display',-apple-system,Inter,sans-serif" }}>
      <div style={{ position: 'absolute', top: -180, left: '52%', transform: 'translateX(-50%)', width: 720, height: 520, background: 'radial-gradient(circle, rgba(45,99,222,0.42) 0%, transparent 65%)', filter: 'blur(46px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 320, right: -140, width: 420, height: 420, background: 'radial-gradient(circle, rgba(120,80,255,0.20) 0%, transparent 65%)', filter: 'blur(54px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )

  if (!data) return shell(
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 360, width: '100%', background: C.glass, border: `1px solid ${C.border}`, borderRadius: 22, padding: 28, backdropFilter: 'blur(14px)' }}>
        <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em' }}>Cockpit TraceOn</h1>
        <p style={{ fontSize: 13, color: C.mut, margin: '6px 0 20px' }}>Accès réservé.</p>
        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Clé admin"
          onKeyDown={e => e.key === 'Enter' && charger(key)}
          style={{ width: '100%', padding: '13px 15px', borderRadius: 13, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.txt, fontSize: 14, marginBottom: 12, outline: 'none' }} />
        {err && <p style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 12, fontWeight: 600 }}>{err}</p>}
        <button onClick={() => charger(key)} disabled={!key || loading} style={btnPrimary}>{loading ? '…' : 'Entrer'}</button>
      </div>
    </div>
  )

  const { stats, artisans } = data
  return shell(
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '26px 18px 70px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <p style={{ fontSize: 12, color: C.accent, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cockpit</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 2 }}>TraceOn — Admin</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {deferred && (
            <button onClick={installer} title="Installer l'app"
              style={{ height: 42, padding: '0 14px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#2a6af0,#1550cf)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700 }}>
              <Download size={16} /> Installer
            </button>
          )}
          <button onClick={() => charger(key)} title="Rafraîchir"
            style={{ width: 42, height: 42, borderRadius: 13, border: `1px solid ${C.border}`, background: C.glass, color: C.txt, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      {/* MRR hero (façon "Total balance") */}
      <div style={{ background: 'linear-gradient(135deg,#1d3a8a 0%,#0c1f3f 100%)', border: `1px solid ${C.border}`, borderRadius: 26, padding: '26px 26px 24px', marginBottom: 16, position: 'relative', overflow: 'hidden', boxShadow: '0 24px 60px rgba(13,31,63,0.55)' }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 180, height: 180, background: 'radial-gradient(circle, rgba(91,140,255,0.5) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Wallet size={16} color={C.accent} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Revenu mensuel récurrent (MRR)</span>
          </div>
          <p style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, background: 'linear-gradient(120deg,#fff,#aaccff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{eur(stats.mrr)}</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 10 }}>{stats.payants} abonné{stats.payants > 1 ? 's' : ''} payant{stats.payants > 1 ? 's' : ''} · {stats.essais} en essai</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 26 }}>
        <Kpi Icon={Users} label="Artisans" value={`${stats.artisans}`} hint="inscrits" />
        <Kpi Icon={Sparkles} label="Abonnés actifs" value={`${stats.actifs}`} hint="payants" />
        <Kpi Icon={Clock} label="En essai" value={`${stats.essais}`} hint="à convertir" />
        <Kpi Icon={TrendingUp} label="Demandes" value={`${stats.demandes}`} hint={`${stats.demandes_payees} encaissées`} />
      </div>

      <SystemStatus adminKey={key} />

      <Broadcast adminKey={key} />

      <p style={{ fontSize: 12, fontWeight: 700, color: C.mut, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Artisans</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {artisans.map((a: any) => (
          <div key={a.id} style={{ background: C.glass, border: `1px solid ${C.border}`, borderRadius: 16, padding: 15, backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700 }}>{a.nom_entreprise || a.nom || '—'}</p>
                <p style={{ fontSize: 12, color: C.mut2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email} · {a.telephone || 'sans tél'}</p>
              </div>
              <Badge statut={a.abonnement_statut} actif={a.abonnement_actif} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 16px', marginTop: 11, fontSize: 12.5, color: C.mut }}>
              <span><b style={{ color: C.txt }}>{a.demandes}</b> demandes</span>
              <span><b style={{ color: C.txt }}>{a.payes}</b> encaissées</span>
              <span><b style={{ color: '#4ade80' }}>{eur(a.ca)}</b> CA</span>
              {a.avis_count > 0 && <span style={{ color: '#f5b740' }}>★ {Number(a.avis_moyenne).toFixed(1)} ({a.avis_count})</span>}
              <a href={`/pro/${a.slug || a.id}`} target="_blank" rel="noreferrer" style={{ color: C.accent, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>site <ExternalLink size={11} /></a>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {a.telephone && <ActBtn href={`tel:${a.telephone}`} Icon={Phone} txt="Appeler" />}
              {a.telephone && <ActBtn href={`sms:${a.telephone}`} Icon={MessageSquare} txt="SMS" />}
              {a.email && <ActBtn href={`mailto:${a.email}`} Icon={Mail} txt="Email" />}
              {a.abonnement_actif
                ? <button onClick={() => suspendre(a.id, 'suspendre')} disabled={busy === a.id} style={actBtn('#ff6b6b')}><Ban size={13} /> {busy === a.id ? '…' : 'Suspendre'}</button>
                : <button onClick={() => suspendre(a.id, 'reactiver')} disabled={busy === a.id} style={actBtn('#4ade80')}><RotateCcw size={13} /> {busy === a.id ? '…' : 'Réactiver'}</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Kpi({ Icon, label, value, hint }: any) {
  return (
    <div style={{ background: C.glass, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, backdropFilter: 'blur(10px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <Icon size={15} color={C.accent} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.mut }}>{label}</span>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{value}</p>
      {hint && <p style={{ fontSize: 11, color: C.mut2, marginTop: 2 }}>{hint}</p>}
    </div>
  )
}

function Badge({ statut, actif }: any) {
  const map: Record<string, { t: string; c: string; b: string }> = {
    active: { t: 'Actif', c: '#4ade80', b: 'rgba(74,222,128,0.12)' },
    trialing: { t: 'Essai', c: '#5b8cff', b: 'rgba(91,140,255,0.14)' },
    past_due: { t: 'Impayé', c: '#ff6b6b', b: 'rgba(255,107,107,0.12)' },
    canceled: { t: 'Annulé', c: '#94a3b8', b: 'rgba(148,163,184,0.12)' },
  }
  const s = statut ? (map[statut] || { t: statut, c: '#94a3b8', b: 'rgba(148,163,184,0.12)' }) : { t: actif ? 'Actif' : 'Inactif', c: actif ? '#4ade80' : '#94a3b8', b: 'rgba(148,163,184,0.12)' }
  return <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: s.c, background: s.b, border: `1px solid ${s.c}33`, padding: '4px 11px', borderRadius: 9 }}>{s.t}</span>
}

const btnPrimary: any = { width: '100%', padding: '13px', borderRadius: 13, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#2a6af0,#1550cf)' }

function actBtn(color: string): any {
  return { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color, background: `${color}1a`, border: `1px solid ${color}40`, borderRadius: 9, padding: '6px 11px', cursor: 'pointer' }
}
function ActBtn({ href, Icon, txt }: { href: string; Icon: any; txt: string }) {
  return <a href={href} style={{ ...actBtn(C.accent), textDecoration: 'none' }}><Icon size={13} /> {txt}</a>
}

// État du système — config & santé en un coup d'œil
function SystemStatus({ adminKey }: { adminKey: string }) {
  const [s, setS] = useState<any>(null)
  useEffect(() => {
    fetch('/api/admin/status', { method: 'POST', headers: { 'x-admin-key': adminKey } })
      .then(r => r.ok ? r.json() : null).then(setS).catch(() => {})
  }, [adminKey])

  const dot = (color: string) => <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}` }} />
  const G = '#4ade80', A = '#fbbf24', R = '#ff6b6b'
  const rows = s ? [
    { l: 'Base de données', ok: s.db, val: s.db ? 'En ligne' : 'Hors ligne', c: s.db ? G : R },
    { l: 'Paiement (Stripe)', ok: s.stripe === 'live', val: s.stripe === 'live' ? 'LIVE' : s.stripe === 'test' ? 'Mode test' : 'Absent', c: s.stripe === 'live' ? G : s.stripe === 'test' ? A : R },
    { l: 'SMS (Twilio)', ok: s.twilio, val: s.twilio ? 'Actif' : 'Absent', c: s.twilio ? G : R },
    { l: 'Email de secours', ok: s.email, val: s.email ? 'Actif' : 'Absent', c: s.email ? G : A },
    { l: 'Notifications push', ok: s.push, val: s.push ? 'Actif' : 'Absent', c: s.push ? G : R },
    { l: 'Relance auto', ok: s.cron, val: s.cron ? 'Protégée' : 'Absente', c: s.cron ? G : R },
  ] : []

  return (
    <div style={{ background: C.glass, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 16, backdropFilter: 'blur(10px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <Activity size={17} color={C.accent} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>État du système</span>
      </div>
      {!s ? <p style={{ fontSize: 12.5, color: C.mut }}>Chargement…</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px 18px' }}>
          {rows.map(r => (
            <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              {dot(r.c)}
              <span style={{ fontSize: 12.5, color: C.mut, flex: 1 }}>{r.l}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: r.c }}>{r.val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Mise à jour / annonce globale à tous les artisans
function Broadcast({ adminKey }: { adminKey: string }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [canal, setCanal] = useState<'push' | 'sms'>('push')
  const [sending, setSending] = useState(false)
  const [res, setRes] = useState('')
  async function envoyer() {
    if (msg.trim().length < 3) return
    if (!confirm(`Envoyer ce message à TOUS les artisans (${canal === 'sms' ? 'SMS' : 'notification'}) ?`)) return
    setSending(true); setRes('')
    try {
      const r = await fetch('/api/admin/broadcast', { method: 'POST', headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, canal }) })
      const d = await r.json()
      setRes(r.ok ? `Envoyé à ${canal === 'sms' ? d.sms : d.push}/${d.total} artisans.` : (d.error || 'Erreur'))
      if (r.ok) setMsg('')
    } catch { setRes('Erreur réseau') } finally { setSending(false) }
  }
  return (
    <div style={{ background: C.glass, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 22, backdropFilter: 'blur(10px)' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', color: C.txt, cursor: 'pointer', padding: 0 }}>
        <Megaphone size={17} color={C.accent} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>Mise à jour globale</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.mut2 }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 14 }}>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} placeholder="Ex : Nouvelle fonctionnalité disponible — mettez à jour votre app."
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.txt, fontSize: 14, resize: 'none', outline: 'none', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 }}>
              {(['push', 'sms'] as const).map(c => (
                <button key={c} onClick={() => setCanal(c)} style={{ padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: canal === c ? C.accent : 'transparent', color: canal === c ? '#fff' : C.mut }}>{c === 'push' ? 'Notification' : 'SMS'}</button>
              ))}
            </div>
            <button onClick={envoyer} disabled={sending || msg.trim().length < 3} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#2a6af0,#1550cf)', opacity: sending || msg.trim().length < 3 ? .5 : 1 }}>
              <Send size={15} /> {sending ? 'Envoi…' : 'Envoyer à tous'}
            </button>
          </div>
          {res && <p style={{ fontSize: 12.5, color: C.mut, marginTop: 10 }}>{res}</p>}
        </div>
      )}
    </div>
  )
}
