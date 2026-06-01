import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { ownsArtisan } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await ownsArtisan(req, id))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data, error } = await supabaseAdmin.from('artisans').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await ownsArtisan(req, id))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const fields = await req.json()
  delete fields.id
  const { data, error } = await supabaseAdmin.from('artisans').update(fields).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
