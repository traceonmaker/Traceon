import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { jsPDF } from 'jspdf'

export const runtime = 'nodejs'

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: d, error } = await supabaseAdmin
    .from('demandes')
    .select('*, artisans(*)')
    .eq('token', token).single() as any

  if (error || !d) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })

  const a = d.artisans
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  let y = 18

  const blue = [10, 71, 216] as const
  const dark = [15, 23, 42] as const
  const gray = [100, 116, 139] as const

  // ── En-tête : logo + entreprise (variables fixes) ──
  if (a.logo_url && typeof a.logo_url === 'string' && a.logo_url.startsWith('data:image')) {
    try { doc.addImage(a.logo_url, 'PNG', 16, y, 22, 22) } catch {}
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...dark)
  doc.text(a.nom_entreprise || a.nom || 'Entreprise', 44, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray)
  let infoY = y + 12
  if (a.adresse_entreprise) { doc.text(a.adresse_entreprise, 44, infoY); infoY += 4 }
  if (a.telephone) { doc.text(`Tél : ${a.telephone}`, 44, infoY); infoY += 4 }
  if (a.siret) { doc.text(`SIRET : ${a.siret}`, 44, infoY); infoY += 4 }

  // ── Titre DEVIS ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...blue)
  doc.text('DEVIS', W - 16, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray)
  const num = `N° ${String(d.id).slice(0, 8).toUpperCase()}`
  doc.text(num, W - 16, y + 13, { align: 'right' })
  doc.text(`Date : ${new Date(d.created_at).toLocaleDateString('fr-FR')}`, W - 16, y + 18, { align: 'right' })

  y = 50
  doc.setDrawColor(...blue); doc.setLineWidth(0.6); doc.line(16, y, W - 16, y)
  y += 10

  // ── Client (variables chantier) ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...dark)
  doc.text('CLIENT', 16, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...gray)
  doc.text(d.client_nom, 16, y + 6)
  doc.text(d.client_telephone, 16, y + 11)
  doc.text(d.client_adresse, 16, y + 16)

  // ── Intervention ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...dark)
  doc.text('INTERVENTION', W - 90, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...gray)
  doc.text(`Type : ${d.type_intervention}`, W - 90, y + 6)
  if (d.creneau_accepte) {
    doc.text(`Date prévue : ${new Date(d.creneau_accepte.date).toLocaleDateString('fr-FR')}`, W - 90, y + 11)
    doc.text(`Horaire : ${d.creneau_accepte.heure_debut} – ${d.creneau_accepte.heure_fin}`, W - 90, y + 16)
  }

  y += 30

  // ── Tableau prix ──
  const tva = a.tva_applicable ? (a.taux_tva || 20) : 0
  const totalTTC = d.prix_estime || 0
  const totalHT = tva > 0 ? totalTTC / (1 + tva / 100) : totalTTC
  const montantTVA = totalTTC - totalHT
  const acompte = Math.round(totalTTC * 0.3)

  doc.setFillColor(...blue); doc.rect(16, y, W - 32, 9, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
  doc.text('DÉSIGNATION', 20, y + 6)
  doc.text('MONTANT', W - 20, y + 6, { align: 'right' })
  y += 9

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...dark)
  doc.text(`Intervention ${d.type_intervention}${d.envergure ? ' — ' + d.envergure : ''}`, 20, y + 7)
  doc.text(`${totalHT.toFixed(2)} €`, W - 20, y + 7, { align: 'right' })
  y += 11
  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2); doc.line(16, y, W - 16, y)

  // ── Totaux ──
  y += 8
  const labelX = W - 70, valX = W - 20
  doc.setFontSize(10); doc.setTextColor(...gray)
  doc.text('Total HT', labelX, y); doc.text(`${totalHT.toFixed(2)} €`, valX, y, { align: 'right' }); y += 6
  if (tva > 0) { doc.text(`TVA (${tva}%)`, labelX, y); doc.text(`${montantTVA.toFixed(2)} €`, valX, y, { align: 'right' }); y += 6 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...blue)
  doc.text('TOTAL TTC', labelX, y); doc.text(`${totalTTC.toFixed(2)} €`, valX, y, { align: 'right' }); y += 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray)
  doc.text(`Acompte à la commande (30%) : ${acompte.toFixed(2)} €`, valX, y, { align: 'right' }); y += 12

  // ── Conditions / mentions (variables fixes) ──
  const block = (titre: string, txt: string) => {
    if (!txt) return
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark)
    doc.text(titre, 16, y); y += 4
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gray)
    const lines = doc.splitTextToSize(txt, W - 32)
    doc.text(lines, 16, y); y += lines.length * 3.6 + 4
  }
  block('CONDITIONS DE PAIEMENT', a.conditions_paiement || '')
  block('MENTIONS LÉGALES', a.mentions_legales || '')
  block('CONDITIONS GÉNÉRALES DE VENTE', a.cgv || '')

  // ── Pied de page ──
  doc.setFontSize(7); doc.setTextColor(...gray)
  doc.text(`Devis généré via TraceOn — ${a.nom_entreprise || a.nom}`, W / 2, 288, { align: 'center' })

  const pdf = doc.output('arraybuffer')
  return new NextResponse(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="devis-${d.client_nom.replace(/\s+/g, '-')}.pdf"`,
    },
  })
}
