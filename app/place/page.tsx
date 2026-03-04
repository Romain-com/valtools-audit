// Page Vue 3 — Analyse d'un lieu touristique
// Server Component : vérifie l'authentification puis rend le client component

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlaceView from '@/components/place/PlaceView'
import VisibiliteTabNav from '@/components/layout/VisibiliteTabNav'

export default async function PlacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50">
      <VisibiliteTabNav />
      <PlaceView />
    </div>
  )
}
