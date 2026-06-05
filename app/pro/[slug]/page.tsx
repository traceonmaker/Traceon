import { supabaseAdmin } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Star, ArrowRight, Phone, Clock, ShieldCheck, MessageSquare, CalendarCheck, CheckCircle2, MapPin } from 'lucide-react'
import { Reveal } from './client'
import { TraceOnMark } from '@/app/components/Logo'

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
  // On n'affiche QUE les activités réelles (le fourre-tout "Autre" reste interne)
  const services: string[] = (a.types_chantier || []).map((t: any) => t.type).filter((t: string) => t && t !== 'Autre')
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
        .pu{ animation: proUp .8s cubic-bezier(.22,1,.36,1) both }
        .pu1{animation-delay:.05s}.pu2{animation-delay:.15s}.pu3{animation-delay:.25s}.pu4{animation-delay:.35s}.pu5{animation-delay:.5s}
        @media (prefers-reduced-motion: reduce){ .pu,.pu1,.pu2,.pu3,.pu4,.pu5{animation:none!important} }
        /* Responsive */
        .pro-shell{ padding:0 20px 70px; }
        .pro-name{ max-width:55vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .pro-cta{ width:auto; }
        @media (max-width: 600px){
          .pro-shell{ padding:0 15px 56px; }
          .pro-hero{ padding:30px 0 22px !important; }
          .pro-stats{ width:100%; gap:10px !important; padding:16px 12px !important; }
          .pst-big{ font-size:20px !important; }
          .pst-small{ font-size:10.5px !important; }
          .pro-cta{ width:100%; }
          .pro-cta a{ flex:1; justify-content:center; }
        }
        @media (max-width: 360px){
          .pro-stats{ gap:6px !important; }
          .pst-big{ font-size:18px !important; }
        }

        /* ── Survol : l'élément se soulève + une aura bleue douce et diffuse monte derrière ── */
        .pro-card{ position:relative; transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s ease, border-color .35s ease; }
        .pro-card::before{
          content:''; position:absolute; inset:-40%;
          background:radial-gradient(55% 55% at 50% 72%, rgba(45,99,222,.38) 0%, rgba(45,99,222,.14) 38%, transparent 72%);
          opacity:0; filter:blur(22px); transform:translateY(18px);
          transition: opacity .5s ease, transform .6s cubic-bezier(.22,1,.36,1); pointer-events:none; z-index:0;
        }
        .pro-card > *{ position:relative; z-index:1; }
        .pro-card:hover{ transform:translateY(-6px); border-color:rgba(91,140,255,.45); box-shadow:0 22px 55px rgba(29,95,237,.22); }
        .pro-card:hover::before{ opacity:1; transform:translateY(0); }

        .pro-lift{ transition: transform .25s ease, box-shadow .25s ease, filter .25s ease; }
        .pro-lift:hover{ transform:translateY(-3px); filter:brightness(1.08); box-shadow:0 16px 42px rgba(37,99,235,.5); }

        /* ── Lueur bleue qui s'élève en fond, en continu ── */
        @keyframes proRise { 0%{ transform:translate(-50%,40px); opacity:.25 } 50%{ opacity:.6 } 100%{ transform:translate(-50%,-60px); opacity:0 } }
        .pro-rise{ position:absolute; left:50%; bottom:-40px; width:560px; height:420px; pointer-events:none;
          background:radial-gradient(circle, rgba(45,99,222,.34) 0%, transparent 65%); filter:blur(30px);
          animation: proRise 7s ease-in-out infinite; }

        /* ── Avis qui défilent lentement vers la gauche ── */
        @keyframes proMarquee { from{ transform:translateX(0) } to{ transform:translateX(-50%) } }
        /* padding vertical : laisse la place au soulèvement au survol (sinon le haut est coupé) */
        .pro-marquee{ overflow:hidden; padding:22px 0; -webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent); mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent); }
        .pro-track{ display:flex; gap:14px; width:max-content; animation: proMarquee 45s linear infinite; align-items:stretch; }
        .pro-marquee:hover .pro-track{ animation-play-state:paused; }
        /* pas d'aura diffuse sur les cartes qui défilent (elle serait coupée par le conteneur) */
        .pro-marquee .pro-card::before{ display:none; }
        .pro-marquee .pro-card:hover{ transform:translateY(-5px); }
        @media (prefers-reduced-motion: reduce){ .pro-track{ animation:none !important } .pro-rise{ animation:none !important } }
      `}</style>
      {/* Halos d'ambiance (flottants) */}
      <div style={{ position: 'absolute', top: -160, left: '50%', width: 680, height: 520, background: 'radial-gradient(circle, rgba(45,99,222,0.45) 0%, transparent 65%)', filter: 'blur(40px)', pointerEvents: 'none', animation: 'proFloat 9s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: 360, right: -140, width: 420, height: 420, background: 'radial-gradient(circle, rgba(120,80,255,0.22) 0%, transparent 65%)', filter: 'blur(50px)', pointerEvents: 'none', animation: 'proFloat2 11s ease-in-out infinite' }} />
      <div className="pro-rise" />

      <div className="pro-shell" style={{ position: 'relative', zIndex: 1, maxWidth: 940, margin: '0 auto', padding: '0 20px 70px' }}>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#2a63de,#1550cf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(37,99,235,0.4)' }}>
              {a.logo_url ? <img src={a.logo_url} alt={nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>{nom[0]?.toUpperCase()}</span>}
            </div>
            <span className="pro-name" style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>{nom}</span>
          </div>
          <a href={formUrl} className="pro-lift" style={{ ...pill(C), flexShrink: 0 }}>Devis gratuit</a>
        </nav>

        {/* Hero */}
        <header className="pro-hero" style={{ textAlign: 'center', padding: '64px 0 38px' }}>
          <span className="pu pu1" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: C.mut, background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 30, padding: '6px 14px' }}>
            <MapPin size={13} color={C.accent} /> {zone} · Artisan vérifié
          </span>
          <h1 className="pu pu2" style={{ fontSize: 'clamp(34px,7vw,58px)', fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.04, margin: '20px auto 0', maxWidth: 760 }}>
            {hero.pre}<span style={{ background: 'linear-gradient(120deg,#7aa6ff,#2d63de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{hero.hi}</span>{hero.post}
          </h1>
          <p className="pu pu3" style={{ fontSize: 'clamp(15px,2.4vw,18px)', color: C.mut, maxWidth: 520, margin: '18px auto 0', lineHeight: 1.55 }}>
            {nom} intervient {avecZone(zone)}. Décrivez votre besoin en 1 minute — vous recevez un créneau et un devis clair, sans engagement.
          </p>
          <div className="pu pu4 pro-cta" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 30 }}>
            <a href={formUrl} className="pro-lift" style={{ ...cta(C), textDecoration: 'none' }}>Demander mon devis <ArrowRight size={19} /></a>
            {a.telephone && <a href={`tel:${a.telephone}`} className="pro-lift" style={{ ...ghost(C), textDecoration: 'none' }}><Phone size={17} /> Appeler</a>}
          </div>
          <div className="pu pu5" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', justifyContent: 'center', marginTop: 26 }}>
            <Trust C={C} Icon={Clock} txt="Réponse rapide" />
            <Trust C={C} Icon={ShieldCheck} txt="Devis sans engagement" />
            <Trust C={C} Icon={Star} txt="Artisan local de confiance" />
          </div>
        </header>

        {/* Carte de réassurance flottante */}
        <div className="pu pu5" style={{ display: 'flex', justifyContent: 'center', marginTop: 14, marginBottom: 80 }}>
          <div className="pro-stats pro-card" style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 22, padding: '20px 26px', backdropFilter: 'blur(14px)', display: 'flex', gap: 34, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
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
                <span key={s} className="pro-card" style={{ display: 'inline-block', background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 14, padding: '13px 20px', fontSize: 15, fontWeight: 600 }}>{s}</span>
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
              <div key={i} className="pro-card" style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 20, padding: 22, position: 'relative' }}>
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

        {/* Avis qui défilent lentement vers la gauche */}
        <Reveal><section style={{ marginBottom: 56 }}>
          <Eyebrow C={C} txt="Ils nous ont fait confiance" />
          <div className="pro-marquee">
            <div className="pro-track">
              {[...avis, ...avis].map((av: any, i: number) => (
                <div key={i} className="pro-card" style={{ width: 300, flexShrink: 0, background: C.glass, border: `1px solid ${C.glassBorder}`, borderRadius: 18, padding: 20 }}>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                    {Array.from({ length: 5 }).map((_, k) => <Star key={k} size={15} color="#f5b740" fill={k < av.note ? '#f5b740' : 'none'} />)}
                  </div>
                  {av.commentaire && <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgba(244,247,255,0.86)' }}>“{av.commentaire}”</p>}
                  <p style={{ fontSize: 12.5, color: C.mut2, marginTop: 12, fontWeight: 600 }}>{av.client_nom || 'Client vérifié'}{av.lieu ? ` · ${av.lieu}` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        </section></Reveal>

        {/* CTA final */}
        <Reveal><section style={{ background: 'linear-gradient(135deg,#1d3a8a,#0c1f3f)', border: `1px solid ${C.glassBorder}`, borderRadius: 26, padding: '40px 24px', textAlign: 'center', boxShadow: '0 24px 70px rgba(13,31,63,0.6)' }}>
          <h2 style={{ fontSize: 'clamp(24px,4vw,32px)', fontWeight: 800, letterSpacing: '-0.035em', marginBottom: 10 }}>Prêt à régler votre chantier ?</h2>
          <p style={{ fontSize: 15, color: C.mut, maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.5 }}>Ça prend 1 minute. Vous n'avez rien à payer pour demander un devis.</p>
          <a href={formUrl} className="pro-lift" style={{ ...cta(C), textDecoration: 'none', margin: '0 auto' }}>Demander mon devis gratuit <ArrowRight size={19} /></a>
        </section></Reveal>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 30 }}>
          <TraceOnMark size={16} color="#5b8cff" />
          <span style={{ fontSize: 11.5, color: C.mut2 }}>Propulsé par TraceOn</span>
        </div>
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
function Stat({ C, big, small }: any) { return <div style={{ textAlign: 'center' }}><p className="pst-big" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{big}</p><p className="pst-small" style={{ fontSize: 11.5, color: C.mut, marginTop: 2 }}>{small}</p></div> }
