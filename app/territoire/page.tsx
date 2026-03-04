// Page Territoire — analyse multi-communes (hébergements, POI, taxe de séjour)
// Server Component : vérifie l'authentification puis rend le client component

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TerritoireClient from './TerritoireClient'

export default async function TerritoirePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <TerritoireClient />
}
