// Page Visibilité digitale — Vue 1 : Écosystème digital d'une destination
// Server Component : vérifie l'authentification puis rend le client component

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EcosystemView from '@/components/ecosystem/EcosystemView'
import VisibiliteTabNav from '@/components/layout/VisibiliteTabNav'

export default async function EcosystemPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50">
      <VisibiliteTabNav />
      <EcosystemView />
    </div>
  )
}
