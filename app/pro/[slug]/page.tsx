import { supabaseAdmin } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Star, ArrowRight, Phone, Clock, ShieldCheck, MessageSquare, CalendarCheck, CheckCircle2, MapPin } from 'lucide-react'
import { Reveal, AvisCarousel } from './client'

export const runtime = 'nodejs'
export const revalidate = 120

// Bonne préposition : "en Martinique" (région) vs "à Fort-de-France" (ville)
function avecZone(zone: string): string {
  const z = (zone || '').trim()
  if (/^(la\s|l['’])/i.test(z)) return `dans ${z}`
  if (/^(martinique|guadeloupe|guyane|r[ée]union|france|antilles)\b/i.test(z)) return `en ${z}`
  return `à ${z}`
}

async function getArtisan(slug: string) {
  const cols = 'id, nom, nom_entreprise, logo_url, types_chantier, zone_intervention, telephone, avis_moyenne, avis_count, slug'
  let { data } = await supabaseAdmin.from('artisans').select(cols).eq('slug', slug).maybeSingle()
  if (!data) { const r = await supabaseAdmin.from('artisans').select(cols).eq('id', slug).maybeSingle(); data = r.data }
  return data as any
}

// ── Copywriting auto-généré (StoryBrand : le client est le héros, l'artisan le guide) ──
const HERO: Record<string, { pre: string; hi: string; post: string }> = {
  'Plomberie':     { pre: 'Une fuite, une panne ? ',      hi: 'Réglé',            post: ', vite et proprement.' },
  'Électricité':   { pre: 'Panne ou installation élec ? ', hi: 'En sécurité',      post: ', sans prise de tête.' },
  'Climatisation': { pre: 'Une clim qui ',                 hi: 'rafraîchit vraiment', post: ', posée par des pros.' },
  'Maçonnerie':    { pre: 'Votre projet, ',                hi: 'bâti solide',      post: ', du début à la fin.' },
  'Peinture':      { pre: 'Des murs ',                     hi: 'comme neufs',      post: ", sans lever le petit doigt." },
}
const HERO_DEFAULT = { pre: 'Votre chantier, ', hi: 'pris en main', post: ', du devis à la fin.' }

// Avis de démarrage (remplacés automatiquement par les vrais avis ≥4★ dès qu'ils arrivent)
const SEED = [
  { client_nom: 'Marie-Claire H.', lieu: 'Fort-de-France', note: 5, commentaire: 'Intervention rapide et soignée, je recommande vraiment. Du sérieux.' },
  { client_nom: 'Jean-Marc L.',    lieu: 'Le Lamentin',     note: 5, commentaire: 'Très professionnel et ponctuel. Devis clair, aucune mauvaise surprise.' },
  { client_nom: 'Sandrine P.',     lieu: 'Schœlcher',       note: 4, commentaire: 'Bon contact, travail propre. Je rappellerai sans hésiter.' },
]

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const a = await getArtisan(slug)
  if (!a) return { title: 'TraceOn' }
  const nom = a.nom_entreprise || a.nom
  return {
    title: `${nom} — ${a.zone_intervention || 'Artisan'} | Devis gratuit en ligne`,
    description: `${nom} : décrivez votre besoin, recevez un créneau et un devis en quelques minutes. ${a.zone_intervention || ''}`.trim(),
  }
}

export default async function MiniSite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const a = await getArtisan(slug)
  if (!a) notFound()

  const { data: vrais } = await supabaseAdmin
    .from('avis').select('client_nom, note, commentaire, created_at')
    .eq('artisan_id', a.id).eq('affiche', true).gte('note', 4)
    .order('created_at', { ascending: false }).limit(6)

  const nom = a.nom_entreprise || a.nom
  const services: string[] = (a.types_chantier || []).map((t: any) => t.type)
  const zone = a.zone_intervention || 'Martinique'
  const hero = HERO[services[0]] || HERO_DEFAULT
  const aReel = (vrais && vrais.length > 0)
  const avis = aReel ? vrais! : SEED
  const moyenne = a.avis_moyenne || 0
  const formUrl = `/formulaire/${a.id}`

  const C = { // palette premium sombre
    accent: '#5b8cff', accent2: '#1d5fed',
    glass: 'rgba(255,255,255,0.06)', glassBorder: 'rgba(255,255,255,0.12)',
    txt: '#f4f7ff', mut: 'rgba(244,247,255,0.62)', mut2: 'rgba(244,247,255,0.40)',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#06080f', color: C.txt, overflow: 'hidden', position: 'relative', fontFamily: "'SF Pro Display',-apple-system,Inter,sans-serif" }}>
      {/* Animations (keyframes locales) */}
      <style>{`
        @keyframes proUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:none } }
        @keyframes proFloat { 0%,100% { transform:translate(-50%,0) } 50% { transform:translate(-50%,-22px) } }
        @keyframes proFloat2 { 0%,100% { transform:translateY(0) } 50% { transform:translateY(26px) } }
        @keyframes proPulse { 0%,100% { opacity:.85 } 50% { opacity:.4 } }
        .pu{ animation: proUp .8s cubic-bezier(.22,1,.36,1) both }
        .pu1{animation-delay:.05s}.pu2{animation-delay:.15s}.pu3{animation-delay:.25s}.pu4{animation-delay:.35s}.pu5{animation-delay:.5s}
        @media (prefers-reduced-motion: reduce){ .pu,.pu1,.pu2,.pu3,.pu4,.pu5{animation:none!important} }
      `}</style>
      {/* Halos d'ambiance (flottants) */}
      <div style={{ position: 'absolute', top: -160, left: '50%', width: 680, height: 520, background: 'radial-gradient(circle, rgba(45,99,222,0.45) 0%, transparent 65%)', filter: 'blur(40px)', pointerEvents: 'none', animation: 'proFloat 9s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: 360, right: -140, width: 420, height: 420, background: 'radial-gradient(circle, rgba(120,80,255,0.22) 0%, transparent 65%)', filter: 'blur(50px)', pointerEvents: 'none', animation: 'proFloat2 11s ease-in-out infinite' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 940, margin: '0 auto', padding: '0 20px 70px' }}>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, overflow: 'hidden', background: 'linear-gradient(135deg,#2a63de,#1550cf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(37,99,235,0.4)' }}>
              {a.logo_url ? <img src={a.logo_url} alt={nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>{nom[0]?.toUpperCase()}</span>}
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>{nom}</span>
          </div>
          <a href={formUrl} style={pill(C)}>Devis gratuit</a>
        </nav>

        {/* Hero */}
        <header style={{ textAlign: 'center', padding: '46px 0 30px' }}>
          <span className="pu pu1" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: C.mut, background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 30, padding: '6px 14px' }}>
            <MapPin size={13} color={C.accent} /> {zone} · Artisan vérifié
          </span>
          <h1 className="pu pu2" style={{ fontSize: 'clamp(34px,7vw,58px)', fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.04, margin: '20px auto 0', maxWidth: 760 }}>
            {hero.pre}<span style={{ background: 'linear-gradient(120deg,#7aa6ff,#2d63de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{hero.hi}</span>{hero.post}
          </h1>
          <p className="pu pu3" style={{ fontSize: 'clamp(15px,2.4vw,18px)', color: C.mut, maxWidth: 520, margin: '18px auto 0', lineHeight: 1.55 }}>
            {nom} intervient {avecZone(zone)}. Décrivez votre besoin en 1 minute — vous recevez un créneau et un devis clair, sans engagement.
          </p>
          <div className="pu pu4" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 30 }}>
            <a href={formUrl} style={{ ...cta(C), textDecoration: 'none' }}>Demander mon devis <ArrowRight size={19} /></a>
            {a.telephone && <a href={`tel:${a.telephone}`} style={{ ...ghost(C), textDecoration: 'none' }}><Phone size={17} /> Appeler</a>}
          </div>
          <div className="pu pu5" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', justifyContent: 'center', marginTop: 26 }}>
            <Trust C={C} Icon={Clock} txt="Réponse rapide" />
            <Trust C={C} Icon={ShieldCheck} txt="Devis sans engagement" />
            <Trust C={C} Icon={Star} txt="Artisan local de confiance" />
          </div>
        </header>

        {/* Carte de réassurance flottante */}
        <div className="pu pu5" style={{ display: 'flex', justifyContent: 'center', marginBottom: 56 }}>
          <div style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 22, padding: '20px 26px', backdropFilter: 'blur(14px)', display: 'flex', gap: 34, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <Stat C={C} big={aReel ? moyenne.toFixed(1) : '98%'} small={aReel ? `${a.avis_count} avis` : 'clients satisfaits'} />
            <div style={{ width: 1, background: C.glassBorder }} />
            <Stat C={C} big="< 24h" small="délai de réponse" />
            <div style={{ width: 1, background: C.glassBorder }} />
            <Stat C={C} big="0 €" small="le devis" />
          </div>
        </div>

        {/* Services */}
        {services.length > 0 && (
          <Reveal><section style={{ marginBottom: 56 }}>
            <Eyebrow C={C} txt="Ce qu'on fait pour vous" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {services.map(s => (
                <span key={s} style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 14, padding: '13px 20px', fontSize: 15, fontWeight: 600 }}>{s}</span>
              ))}
            </div>
          </section></Reveal>
        )}

        {/* Comment ça marche (le bloc qui fait basculer la décision) */}
        <Reveal><section style={{ marginBottom: 56 }}>
          <Eyebrow C={C} txt="Comment ça marche" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {[
              { Icon: MessageSquare, t: 'Décrivez votre besoin', d: 'En 1 minute, en ligne. Photo possible.' },
              { Icon: CalendarCheck, t: 'Recevez créneau + devis', d: 'Une proposition claire, sans engagement.' },
              { Icon: CheckCircle2, t: "C'est réglé", d: 'On intervient, vous validez. Simple.' },
            ].map((s, i) => (
              <div key={i} style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 20, padding: 22, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 18, right: 20, fontSize: 40, fontWeight: 800, color: 'rgba(255,255,255,0.06)' }}>{i + 1}</div>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,rgba(91,140,255,0.25),rgba(29,95,237,0.15))', border: `1px solid ${C.glassBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <s.Icon size={21} color={C.accent} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 5 }}>{s.t}</p>
                <p style={{ fontSize: 13.5, color: C.mut, lineHeight: 1.5 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section></Reveal>

        {/* Avis qui tournent */}
        <Reveal><section style={{ marginBottom: 56 }}>
          <Eyebrow C={C} txt="Ils nous ont fait confiance" />
          <AvisCarousel avis={avis} />
        </section></Reveal>

        {/* CTA final */}
        <Reveal><section style={{ background: 'linear-gradient(135deg,#1d3a8a,#0c1f3f)', border: `1px solid ${C.glassBorder}`, borderRadius: 26, padding: '40px 24px', textAlign: 'center', boxShadow: '0 24px 70px rgba(13,31,63,0.6)' }}>
          <h2 style={{ fontSize: 'clamp(24px,4vw,32px)', fontWeight: 800, letterSpacing: '-0.035em', marginBottom: 10 }}>Prêt à régler votre chantier ?</h2>
          <p style={{ fontSize: 15, color: C.mut, maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.5 }}>Ça prend 1 minute. Vous n'avez rien à payer pour demander un devis.</p>
          <a href={formUrl} style={{ ...cta(C), textDecoration: 'none', margin: '0 auto' }}>Demander mon devis gratuit <ArrowRight size={19} /></a>
        </section></Reveal>

        <p style={{ textAlign: 'center', fontSize: 11.5, color: C.mut2, marginTop: 30 }}>Propulsé par TraceOn</p>
      </div>
    </div>
  )
}

/* helpers de style */
function pill(C: any): any { return { display: 'inline-flex', alignItems: 'center', fontSize: 13.5, fontWeight: 700, color: '#06080f', background: '#fff', borderRadius: 30, padding: '9px 18px', textDecoration: 'none' } }
function cta(C: any): any { return { display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 16, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#2a6af0,#1550cf)', borderRadius: 15, padding: '15px 26px', boxShadow: '0 12px 34px rgba(37,99,235,0.45)' } }
function ghost(C: any): any { return { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: C.txt, background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 15, padding: '15px 22px' } }
function Trust({ C, Icon, txt }: any) { return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.mut, fontWeight: 600 }}><Icon size={15} color={C.accent} /> {txt}</span> }
function Eyebrow({ C, txt }: any) { return <p style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 22 }}>{txt}</p> }
function Stat({ C, big, small }: any) { return <div style={{ textAlign: 'center' }}><p style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{big}</p><p style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>{small}</p></div> }
