'use client'
import { useState, useEffect } from 'react'
import { Users, TrendingUp, Star, Euro, RefreshCw, ExternalLink } from 'lucide-react'

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' €'

export default function Admin() {
  const [key, setKey] = useState('')
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

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
  }, [])

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ maxWidth: 360, width: '100%', padding: 26 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>TraceOn — Admin</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18 }}>Accès réservé.</p>
          <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Clé admin" className="input-field" style={{ marginBottom: 12 }}
            onKeyDown={e => e.key === 'Enter' && charger(key)} />
          {err && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12, fontWeight: 600 }}>{err}</p>}
          <button onClick={() => charger(key)} disabled={!key || loading} className="btn-primary">
            {loading ? <span className="spinner spinner-w" /> : 'Entrer'}
          </button>
        </div>
      </div>
    )
  }

  const { stats, artisans } = data
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-grad)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Cockpit TraceOn</h1>
          <button onClick={() => charger(key)} className="fab" style={{ width: 38, height: 38 }} aria-label="Rafraîchir"><RefreshCw size={16} /></button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <Kpi Icon={Euro} label="MRR" value={eur(stats.mrr)} hint={`${stats.payants} payants`} />
          <Kpi Icon={Users} label="Artisans" value={`${stats.artisans}`} hint={`${stats.essais} en essai`} />
          <Kpi Icon={TrendingUp} label="Demandes" value={`${stats.demandes}`} hint={`${stats.demandes_payees} encaissées`} />
          <Kpi Icon={Star} label="Abonnés actifs" value={`${stats.actifs}`} hint="payants" />
        </div>

        {/* Liste artisans */}
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Artisans</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {artisans.map((a: any) => (
            <div key={a.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 700 }}>{a.nom_entreprise || a.nom || '—'}</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email} · {a.telephone || 'sans tél'}</p>
                </div>
                <StatutBadge statut={a.abonnement_statut} actif={a.abonnement_actif} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
                <span>{a.demandes} demandes</span>
                <span>{a.payes} encaissées</span>
                <span>{eur(a.ca)} CA</span>
                {a.avis_count > 0 && <span>★ {Number(a.avis_moyenne).toFixed(1)} ({a.avis_count})</span>}
                <a href={`/pro/${a.slug || a.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>site <ExternalLink size={11} /></a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Kpi({ Icon, label, value, hint }: { Icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Icon size={15} color="var(--blue)" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>{label}</span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{value}</p>
      {hint && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{hint}</p>}
    </div>
  )
}

function StatutBadge({ statut, actif }: { statut?: string; actif?: boolean }) {
  const map: Record<string, { t: string; c: string; b: string }> = {
    active: { t: 'Actif', c: '#059669', b: 'var(--green-dim)' },
    trialing: { t: 'Essai', c: '#1d5fed', b: 'var(--blue-dim)' },
    past_due: { t: 'Impayé', c: '#dc2626', b: 'var(--red-dim)' },
    canceled: { t: 'Annulé', c: '#64748b', b: 'var(--surface2)' },
  }
  const s = statut ? (map[statut] || { t: statut, c: '#64748b', b: 'var(--surface2)' }) : { t: actif ? 'Actif' : 'Inactif', c: actif ? '#059669' : '#64748b', b: 'var(--surface2)' }
  return <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: s.c, background: s.b, padding: '4px 10px', borderRadius: 9 }}>{s.t}</span>
}
