'use client'
// Page de progression d'un audit — montagne SVG + Supabase Realtime
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'

// ─── Types ───────────────────────────────────────────────────────────────────

type StatutBloc = 'en_attente' | 'en_cours' | 'termine' | 'en_attente_validation' | 'erreur'

interface BlocStatut {
  id: string
  label: string
  icone: string
  statut: StatutBloc
  cout?: number
}

interface AuditData {
  id: string
  statut: string
  resultats: Record<string, { statut?: string }> | null
  couts_api: Record<string, { total?: number; total_bloc?: number }> | null
  destinations?: { nom: string }
}

// ─── Configuration des 7 blocs ───────────────────────────────────────────────

const BLOCS_CONFIG: Omit<BlocStatut, 'statut' | 'cout'>[] = [
  { id: 'positionnement',   label: 'Positionnement & Notoriété',    icone: '🗺️' },
  { id: 'volume_affaires',  label: 'Volume d\'affaires',             icone: '💶' },
  { id: 'schema_digital',   label: 'Schéma digital & Santé tech.',  icone: '🖥️' },
  { id: 'visibilite_seo',   label: 'Visibilité SEO & Gap',          icone: '🔍' },
  { id: 'stocks_physiques', label: 'Stocks physiques',              icone: '🏨' },
  { id: 'stock_en_ligne',   label: 'Stock en ligne',                icone: '🌐' },
  { id: 'concurrents',      label: 'Concurrents',                   icone: '🏔️' },
]

// ─── SVG Montagne avec étapes et skieur ─────────────────────────────────────

function MontagneSVG({ blocs, progression }: { blocs: BlocStatut[]; progression: number }) {
  // Points de chemin du sommet au bas (7 étapes réparties)
  const points = [
    { x: 200, y: 30 },  // Sommet
    { x: 175, y: 70 },
    { x: 155, y: 105 },
    { x: 140, y: 140 },
    { x: 130, y: 175 },
    { x: 120, y: 205 },
    { x: 108, y: 235 },
    { x:  90, y: 260 },  // Base
  ]

  // Position du skieur (index 0 = base, 7 = sommet)
  const skierIndex = Math.min(progression, 7)
  // On inverse : skieur part du bas (index 7) vers le sommet (index 0)
  const skierPointIdx = 7 - skierIndex
  const skierPos = points[skierPointIdx] || points[7]

  // Statut de la dernière étape pour détecter "en attente validation"
  const lastBloc = blocs.find(b => b.statut === 'en_attente_validation')
  const skierPulse = !!lastBloc

  return (
    <svg viewBox="0 0 400 280" className="w-full max-w-sm mx-auto" fill="none">
      {/* Ciel gradient */}
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F3F5FA" />
          <stop offset="100%" stopColor="#E8EEFF" />
        </linearGradient>
        <linearGradient id="snowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F3F5FA" />
        </linearGradient>
        <linearGradient id="rockGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6B72C4" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#1A2137" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Fond */}
      <rect width="400" height="280" fill="url(#skyGrad)" rx="12" />

      {/* Montagne principale */}
      <polygon
        points="200,25 340,260 60,260"
        fill="url(#rockGrad)"
      />
      {/* Neige sommet */}
      <polygon
        points="200,25 220,75 180,75"
        fill="url(#snowGrad)"
        opacity="0.9"
      />

      {/* Montagne arrière-plan gauche */}
      <polygon
        points="80,90 160,260 0,260"
        fill="#1A2137"
        opacity="0.2"
      />
      {/* Montagne arrière-plan droite */}
      <polygon
        points="320,100 400,260 240,260"
        fill="#6B72C4"
        opacity="0.15"
      />

      {/* Ligne de chemin pointillée */}
      <polyline
        points={points.map(p => `${p.x},${p.y}`).join(' ')}
        stroke="#E84520"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Étapes (cercles) */}
      {points.slice(0, 7).map((pt, i) => {
        const bloc = blocs[6 - i] // Inversé : sommet = bloc 7
        const statut = bloc?.statut || 'en_attente'
        const color = statut === 'termine'
          ? '#22C55E'
          : statut === 'en_cours'
          ? '#3B82F6'
          : statut === 'en_attente_validation'
          ? '#F59E0B'
          : statut === 'erreur'
          ? '#EF4444'
          : '#E2E6F0'

        return (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="10" fill="white" stroke={color} strokeWidth="2" />
            {statut === 'termine' && (
              <text x={pt.x} y={pt.y + 4} textAnchor="middle" fontSize="8" fill={color}>✓</text>
            )}
            {statut === 'en_cours' && (
              <circle cx={pt.x} cy={pt.y} r="5" fill={color} opacity="0.8">
                <animate attributeName="r" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            {statut === 'en_attente_validation' && (
              <text x={pt.x} y={pt.y + 4} textAnchor="middle" fontSize="9" fill={color}>!</text>
            )}
          </g>
        )
      })}

      {/* Skieur SVG */}
      <g
        transform={`translate(${skierPos.x - 10}, ${skierPos.y - 20})`}
        className={skierPulse ? 'animate-pulse' : ''}
      >
        {/* Corps skieur */}
        <circle cx="10" cy="5" r="4" fill="#E84520" />  {/* Tête */}
        <line x1="10" y1="9" x2="10" y2="18" stroke="#E84520" strokeWidth="2" strokeLinecap="round" />
        {/* Bras */}
        <line x1="10" y1="12" x2="5" y2="16" stroke="#E84520" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="12" x2="15" y2="15" stroke="#E84520" strokeWidth="1.5" strokeLinecap="round" />
        {/* Jambes / skis */}
        <line x1="10" y1="18" x2="5" y2="22" stroke="#1A2137" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="18" x2="15" y2="22" stroke="#1A2137" strokeWidth="2" strokeLinecap="round" />
        {/* Skis */}
        <line x1="2" y1="22" x2="8" y2="22" stroke="#6B72C4" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="22" x2="18" y2="22" stroke="#6B72C4" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Indicateur de progression texte */}
      <text x="200" y="275" textAnchor="middle" fontSize="11" fill="#6B7280" fontFamily="Inter, sans-serif">
        {skierIndex} / 7 blocs terminés
      </text>
    </svg>
  )
}

// ─── Ligne de statut d'un bloc ───────────────────────────────────────────────

const ICONE_STATUT: Record<StatutBloc, string> = {
  en_attente: '⏳',
  en_cours: '🔄',
  termine: '✅',
  en_attente_validation: '⚠️',
  erreur: '❌',
}

const LABEL_STATUT: Record<StatutBloc, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  termine: 'Terminé',
  en_attente_validation: 'En attente de validation',
  erreur: 'Erreur',
}

const CLASSES_STATUT: Record<StatutBloc, string> = {
  en_attente: 'text-text-muted bg-gray-50 border-gray-200',
  en_cours: 'text-status-info bg-blue-50 border-blue-200',
  termine: 'text-status-success bg-green-50 border-green-200',
  en_attente_validation: 'text-status-warning bg-amber-50 border-amber-200',
  erreur: 'text-status-error bg-red-50 border-red-200',
}

// ─── Modales de validation (placeholders Phase 3B) ───────────────────────────

const VALIDATION_CONFIG: Record<string, { titre: string; description: string }> = {
  visibilite_seo: {
    titre: 'Validation — Keywords Phase B',
    description:
      'Les keywords de la Phase A ont été collectés et classifiés. Vérifiez la liste avant de lancer la Phase B (SERP live + calcul du score gap).',
  },
  concurrents: {
    titre: 'Validation — Concurrents identifiés',
    description:
      'L\'IA a identifié 5 concurrents pour cette destination. Vérifiez la sélection avant de lancer l\'analyse comparative.',
  },
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function ProgressionPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [audit, setAudit] = useState<AuditData | null>(null)
  const [blocs, setBlocs] = useState<BlocStatut[]>(
    BLOCS_CONFIG.map(b => ({ ...b, statut: 'en_attente' }))
  )
  const [validationBloc, setValidationBloc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Calcul des blocs depuis resultats JSONB ──
  function extraireBlocs(resultats: AuditData['resultats'], coutsApi: AuditData['couts_api']): BlocStatut[] {
    return BLOCS_CONFIG.map((cfg, i) => {
      const blocKey = cfg.id
      const data = resultats?.[blocKey]
      const coutBlocKey = `bloc${i + 1}`
      const coutData = coutsApi?.[coutBlocKey]
      const cout = coutData?.total ?? coutData?.total_bloc ?? undefined

      let statut: StatutBloc = 'en_attente'
      if (data) {
        if ((data as { statut?: string }).statut === 'en_attente_validation') {
          statut = 'en_attente_validation'
        } else if ((data as { erreur?: unknown }).erreur) {
          statut = 'erreur'
        } else {
          statut = 'termine'
        }
      }

      return { ...cfg, statut, cout }
    })
  }

  // ── Chargement initial ──
  useEffect(() => {
    async function charger() {
      const { data, error } = await supabase
        .from('audits')
        .select('id, statut, resultats, couts_api, destinations(nom)')
        .eq('id', id)
        .single()

      if (error || !data) {
        setLoading(false)
        return
      }

      const auditData = data as unknown as AuditData
      setAudit(auditData)
      setBlocs(extraireBlocs(auditData.resultats, auditData.couts_api))
      setLoading(false)
    }

    charger()
  }, [id])

  // ── Supabase Realtime — écoute des changements d'audit ──
  useEffect(() => {
    const channel = supabase
      .channel(`audit-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'audits',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as AuditData
          setAudit(updated)
          setBlocs(extraireBlocs(updated.resultats, updated.couts_api))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  // ── Métriques ──
  const nbTermines = blocs.filter(b => b.statut === 'termine').length
  const progression = nbTermines
  const toutTermine = blocs.every(b => b.statut === 'termine')
  const blocEnAttenteValidation = blocs.find(b => b.statut === 'en_attente_validation')

  const coutCumule = blocs.reduce((sum, b) => sum + (b.cout || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* En-tête */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-text-secondary hover:text-brand-orange transition-colors flex items-center gap-1 mb-3">
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-brand-navy">
          {audit?.destinations?.nom || 'Audit en cours'}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Progression de l&apos;analyse digitale
        </p>
      </div>

      {/* Animation montagne */}
      <div className="card p-6 mb-6 overflow-hidden">
        <MontagneSVG blocs={blocs} progression={progression} />
      </div>

      {/* Alerte validation requise */}
      {blocEnAttenteValidation && (
        <div className="flex items-center gap-3 p-4 mb-4 bg-amber-50 border border-amber-300 rounded-lg">
          <svg viewBox="0 0 20 20" className="w-5 h-5 text-amber-600 shrink-0" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">Action requise</p>
            <p className="text-amber-700 text-xs mt-0.5">
              {blocEnAttenteValidation.label} nécessite une validation avant de continuer.
            </p>
          </div>
          <button
            onClick={() => setValidationBloc(blocEnAttenteValidation.id)}
            className="text-xs font-semibold px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
          >
            Valider
          </button>
        </div>
      )}

      {/* Liste des 7 blocs */}
      <div className="card divide-y divide-brand-border mb-6">
        {blocs.map((bloc, i) => (
          <div
            key={bloc.id}
            className={`flex items-center gap-4 px-5 py-4 ${
              bloc.statut === 'en_attente_validation' ? 'bg-amber-50/50' : ''
            }`}
          >
            {/* Numéro */}
            <span className="text-xs font-mono text-text-muted w-5 shrink-0">{i + 1}</span>

            {/* Icône bloc */}
            <span className="text-lg">{bloc.icone}</span>

            {/* Label */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-brand-navy text-sm truncate">{bloc.label}</p>
              {bloc.cout && (
                <p className="text-xs text-text-muted font-mono">{bloc.cout.toFixed(3)} €</p>
              )}
            </div>

            {/* Badge statut */}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${CLASSES_STATUT[bloc.statut]}`}>
              {ICONE_STATUT[bloc.statut]} {LABEL_STATUT[bloc.statut]}
            </span>

            {/* Spinner pour en_cours */}
            {bloc.statut === 'en_cours' && (
              <Spinner size="sm" color="navy" />
            )}

            {/* Bouton valider */}
            {bloc.statut === 'en_attente_validation' && (
              <button
                onClick={() => setValidationBloc(bloc.id)}
                className="text-xs px-2.5 py-1 bg-amber-500 text-white rounded font-medium hover:bg-amber-600 transition-colors shrink-0"
              >
                Valider
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Coût cumulé */}
      <div className="flex items-center justify-between p-4 bg-brand-navy/5 rounded-lg border border-brand-border mb-6">
        <span className="text-sm font-medium text-brand-navy">Coût cumulé</span>
        <span className="font-mono font-bold text-brand-navy">{coutCumule.toFixed(3)} €</span>
      </div>

      {/* Bouton résultats si terminé */}
      {toutTermine && (
        <div className="text-center animate-fade-in">
          <button
            onClick={() => router.push(`/audit/${id}/resultats`)}
            className="btn-primary text-base px-8 py-3"
          >
            Voir les résultats →
          </button>
        </div>
      )}

      {/* Modale validation (placeholder Phase 3B) */}
      {validationBloc && VALIDATION_CONFIG[validationBloc] && (
        <Modal
          open={true}
          onClose={() => setValidationBloc(null)}
          title={VALIDATION_CONFIG[validationBloc].titre}
          blocking
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {VALIDATION_CONFIG[validationBloc].description}
            </p>
            <div className="p-4 bg-brand-bg rounded-lg border border-brand-border">
              <p className="text-xs text-text-muted italic">
                La logique de validation détaillée sera implémentée en Phase 3B.
                Pour l&apos;instant, cliquez sur &quot;Valider&quot; pour continuer.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setValidationBloc(null)}
                className="btn-primary flex-1 justify-center"
              >
                Valider et continuer
              </button>
              <button
                onClick={() => setValidationBloc(null)}
                className="btn-secondary"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
