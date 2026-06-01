'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// /dashboard sans identifiant → on route selon la session
export default function DashboardIndex() {
  const router = useRouter()
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) { router.replace('/login'); return }
      const { data } = await supabase.from('artisans').select('id').ilike('email', session.user.email).maybeSingle()
      router.replace(data?.id ? `/dashboard/${data.id}` : '/onboarding')
    })()
  }, [router])
  return (
    <div style={{minHeight:'100vh',background:'var(--bg-grad)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="spinner" />
    </div>
  )
}
