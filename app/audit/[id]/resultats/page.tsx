// Page Résultats — 7 blocs d'audit avec sidebar + scroll spy
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ResultatsClient from './ResultatsClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ResultatsPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Chargement de l'audit complet
  const { data: audit, error } = await supabase
    .from('audits')
    .select(`
      id,
      statut,
      created_at,
      resultats,
      couts_api,
      destinations (
        id,
        nom,
        code_departement,
        code_insee,
        population,
        slug
      )
    `)
    .eq('id', id)
    .single()

  if (error || !audit) {
    redirect('/dashboard')
  }

  // Supabase retourne destinations comme tableau via foreign key — on normalise
  const auditNormalise = {
    ...audit,
    destinations: Array.isArray(audit.destinations)
      ? audit.destinations[0]
      : audit.destinations,
  } as unknown as AuditFull

  return <ResultatsClient audit={auditNormalise} />
}

// Type exporté pour le client
export interface AuditFull {
  id: string
  statut: string
  created_at: string
  resultats: Record<string, unknown>
  couts_api: Record<string, unknown>
  destinations: {
    id: string
    nom: string
    code_departement: string
    code_insee: string
    population: number
    slug: string
  }
}
