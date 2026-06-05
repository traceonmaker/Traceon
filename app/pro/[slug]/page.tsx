import { supabaseAdmin } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Star, MapPin, Phone, ArrowRight, ShieldCheck, Clock } from 'lucide-react'

export const runtime = 'nodejs'
export const revalidate = 120 // SEO : régénéré périodiquement

// Récupère l'artisan par slug, avec repli sur l'id (compatibilité comptes sans slug)
async function getArtisan(slug: string) {
  const cols = 'id, nom, nom_entreprise, logo_url, types_chantier, zone_intervention, adresse_entreprise, telephone, avis_moyenne, avis_count, slug'
  let { data } = await supabaseAdmin.from('artisans').select(cols).eq('slug', slug).maybeSingle()
  if (!data) {
    const r = await supabaseAdmin.from('artisans').select(cols).eq('id', slug).maybeSingle()
    data = r.data
  }
  return data as any
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const a = await getArtisan(slug)
  if (!a) return { title: 'TraceOn' }
  const nom = a.nom_entreprise || a.nom
  return {
    title: `${nom} — ${a.zone_intervention || 'Artisan'} | Devis en ligne`,
    description: `${nom} : demandez votre devis en ligne en 1 minute. ${a.zone_intervention || ''}`.trim(),
  }
}

export default async function MiniSite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = await getArtisan(slug)
  if (!a) notFound()

  const { data: avis } = await supabaseAdmin
    .from('avis').select('client_nom, note, commentaire, created_at')
    .eq('artisan_id', a.id).eq('affiche', true).gte('note', 4)
    .order('created_at', { ascending: false }).limit(6)

  const nom = a.nom_entreprise || a.nom
  const services = (a.types_chantier || []).map((t: any) => t.type)
  const moyenne = a.avis_moyenne || 0
  const count = a.avis_count || 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-grad)', color: 'var(--text)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px 60px' }}>

        {/* Hero */}
        <header style={{ textAlign: 'center', padding: '52px 0 30px' }}>
          <div style={{ width: 88, height: 88, borderRadius: 24, margin: '0 auto 18px', overflow: 'hidden', background: 'linear-gradient(135deg,#2a63de,#1550cf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-blue)' }}>
            {a.logo_url
              ? <img src={a.logo_url} alt={nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 34, fontWeight: 800, color: '#fff' }}>{nom[0]?.toUpperCase()}</span>}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em' }}>{nom}</h1>
          {a.zone_intervention && (
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={14} /> {a.zone_intervention}
            </p>
          )}
          {count > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, background: 'var(--amber-dim)', border: '1px solid #fde68a', borderRadius: 20, padding: '5px 12px' }}>
              <Star size={15} color="#f59e0b" fill="#f59e0b" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>{moyenne.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: '#92702a' }}>· {count} avis</span>
            </div>
          )}
        </header>

        {/* CTA principal */}
        <a href={`/formulaire/${a.id}`} className="btn-primary" style={{ textDecoration: 'none', height: 54, fontSize: 16, marginBottom: 14 }}>
          Demander un devis gratuit <ArrowRight size={18} />
        </a>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 34, flexWrap: 'wrap' }}>
          <Trust Icon={Clock} txt="Réponse rapide" />
          <Trust Icon={ShieldCheck} txt="Devis sans engagement" />
          {a.telephone && <Trust Icon={Phone} txt="Artisan local" />}
        </div>

        {/* Services */}
        {services.length > 0 && (
          <section style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Nos services</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {services.map((s: string) => (
                <span key={s} className="card" style={{ padding: '9px 15px', fontSize: 14, fontWeight: 600, borderRadius: 12 }}>{s}</span>
              ))}
            </div>
          </section>
        )}

        {/* Avis */}
        {avis && avis.length > 0 && (
          <section style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Ils nous ont fait confiance</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {avis.map((av: any, i: number) => (
                <div key={i} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 7 }}>
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} size={15} color="#f59e0b" fill={k < av.note ? '#f59e0b' : 'none'} />
                    ))}
                  </div>
                  {av.commentaire && <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text2)' }}>“{av.commentaire}”</p>}
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, fontWeight: 600 }}>{av.client_nom || 'Client vérifié'}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA bas */}
        <a href={`/formulaire/${a.id}`} className="btn-primary" style={{ textDecoration: 'none', height: 52, fontSize: 15 }}>
          Demander mon devis <ArrowRight size={17} />
        </a>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 24 }}>
          Propulsé par TraceOn
        </p>
      </div>
    </div>
  )
}

function Trust({ Icon, txt }: { Icon: any; txt: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>
      <Icon size={15} color="var(--blue)" /> {txt}
    </span>
  )
}
