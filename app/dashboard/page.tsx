// Page Dashboard — grille des destinations auditées
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'

// ─── Types locaux ────────────────────────────────────────────────────────────

interface AuditRow {
  id: string
  statut: 'termine' | 'en_cours' | 'en_attente_validation' | 'erreur'
  created_at: string
  couts_api: Record<string, { total?: number; total_bloc?: number }> | null
  resultats: {
    positionnement?: {
      google?: { ot?: { note?: number }; score_synthese?: number }
    }
    schema_digital?: {
      haloscan?: Array<{ total_keywords?: number }>
    }
    visibilite_seo?: {
      phase_b?: { score_gap?: number }
    }
  } | null
  destinations: {
    id: string
    nom: string
    code_departement: string
    slug: string
  }
}

// ─── Calcul coût total d'un audit ────────────────────────────────────────────

function calculerCoutTotal(couts: AuditRow['couts_api']): number {
  if (!couts) return 0
  return Object.values(couts).reduce((sum, bloc) => {
    const t = bloc.total ?? bloc.total_bloc ?? 0
    return sum + (typeof t === 'number' ? t : 0)
  }, 0)
}

// ─── Card destination ────────────────────────────────────────────────────────

function DestinationCard({ audit }: { audit: AuditRow }) {
  const { destinations: dest } = audit
  const coutTotal = calculerCoutTotal(audit.couts_api)

  // KPIs depuis resultats JSONB
  const noteGoogle = audit.resultats?.positionnement?.google?.ot?.note ?? null
  const totalKeywords = audit.resultats?.schema_digital?.haloscan?.[0]?.total_keywords ?? null
  const scoreGap = audit.resultats?.visibilite_seo?.phase_b?.score_gap ?? null

  const dateAudit = new Date(audit.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Link
      href={`/audit/${audit.id}/resultats`}
      className="card p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group flex flex-col gap-4"
    >
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-brand-navy text-lg group-hover:text-brand-orange transition-colors">
            {dest.nom}
          </h3>
          <p className="text-sm text-text-secondary">
            Département {dest.code_departement}
          </p>
        </div>
        <StatusBadge statut={audit.statut} size="sm" />
      </div>

      {/* Date + coût */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Audité le {dateAudit}</span>
        {coutTotal > 0 && (
          <span className="font-mono bg-brand-bg px-2 py-0.5 rounded">
            {coutTotal.toFixed(3)} €
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {/* Note Google */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Google Maps</span>
          {noteGoogle !== null ? (
            <>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold text-brand-navy">{noteGoogle.toFixed(1)}</span>
                <svg viewBox="0 0 20 20" className="w-4 h-4 text-brand-yellow" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <div className="h-1 bg-brand-bg rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${noteGoogle >= 4.2 ? 'bg-status-success' : noteGoogle >= 3.8 ? 'bg-status-warning' : 'bg-status-error'}`}
                  style={{ width: `${(noteGoogle / 5) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-sm text-text-muted">—</span>
          )}
        </div>

        {/* Keywords SEO */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Keywords SEO</span>
          {totalKeywords !== null ? (
            <>
              <span className="text-lg font-bold text-brand-navy">
                {totalKeywords >= 1000
                  ? `${(totalKeywords / 1000).toFixed(0)}k`
                  : totalKeywords}
              </span>
              <div className="h-1 bg-brand-bg rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${totalKeywords >= 20000 ? 'bg-status-success' : totalKeywords >= 5000 ? 'bg-status-warning' : 'bg-status-error'}`}
                  style={{ width: `${Math.min((totalKeywords / 100000) * 100, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-sm text-text-muted">—</span>
          )}
        </div>

        {/* Score gap */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Score gap</span>
          {scoreGap !== null ? (
            <>
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg font-bold text-brand-navy">{scoreGap}</span>
                <span className="text-xs text-text-muted">/10</span>
              </div>
              <div className="h-1 bg-brand-bg rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${scoreGap >= 7 ? 'bg-status-success' : scoreGap >= 4 ? 'bg-status-warning' : 'bg-status-error'}`}
                  style={{ width: `${(scoreGap / 10) * 100}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-sm text-text-muted">—</span>
          )}
        </div>
      </div>

      {/* Flèche hover */}
      <div className="flex justify-end">
        <svg
          viewBox="0 0 20 20"
          className="w-4 h-4 text-text-muted group-hover:text-brand-orange transition-colors"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </Link>
  )
}

// ─── État vide ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Illustration montagne stylisée */}
      <svg viewBox="0 0 200 120" className="w-48 h-28 mb-6 opacity-40" fill="none">
        <path
          d="M100 20 L140 80 H60 Z"
          fill="#E84520"
          opacity="0.6"
        />
        <path
          d="M60 80 L90 40 L120 80 H60Z"
          fill="#6B72C4"
          opacity="0.5"
        />
        <path
          d="M120 80 L150 50 L180 80 H120Z"
          fill="#1A2137"
          opacity="0.3"
        />
        <rect x="10" y="90" width="180" height="3" rx="1.5" fill="#E2E6F0" />
      </svg>
      <h2 className="text-xl font-bold text-brand-navy mb-2">
        Aucune destination auditée
      </h2>
      <p className="text-text-secondary text-sm mb-8 max-w-xs">
        Lancez votre premier audit pour analyser le potentiel digital d&apos;une destination touristique.
      </p>
      <Link href="/audit/nouveau" className="btn-primary">
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
            clipRule="evenodd"
          />
        </svg>
        Lancer le premier audit
      </Link>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  // Vérification auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Jointure destinations + audits (dernier audit par destination)
  const { data: audits, error } = await supabase
    .from('audits')
    .select(`
      id,
      statut,
      created_at,
      couts_api,
      resultats,
      destinations (
        id,
        nom,
        code_departement,
        slug
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erreur chargement audits:', error)
  }

  const auditList = (audits ?? []) as unknown as AuditRow[]

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Tableau de bord</h1>
          <p className="text-text-secondary text-sm mt-1">
            {auditList.length} destination{auditList.length !== 1 ? 's' : ''} auditée{auditList.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Link href="/audit/nouveau" className="btn-primary">
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Nouvel audit
        </Link>
      </div>

      {/* Grille ou état vide */}
      {auditList.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {auditList.map((audit) => (
            <DestinationCard key={audit.id} audit={audit} />
          ))}
        </div>
      )}
    </div>
  )
}
