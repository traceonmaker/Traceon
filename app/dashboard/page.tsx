import { redirect } from 'next/navigation'

// /dashboard sans identifiant → on renvoie vers la création de compte
export default function DashboardIndex() {
  redirect('/onboarding')
}
