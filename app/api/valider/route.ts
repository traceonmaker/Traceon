import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { demande_id } = await req.json()

  const { data, error } = await supabaseAdmin.from('demandes').update({
    statut: 'paye',
    date_paiement: new Date().toISOString()
  }).eq('id', demande_id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

