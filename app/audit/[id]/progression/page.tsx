'use client'
// Page de progression d'un audit — montagne SVG + Supabase Realtime
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import CoutTooltip from '@/components/ui/CoutTooltip'

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

// ─── SVG Montagne panoramique — 7 pics, un par bloc ─────────────────────────

// Sommets des 7 pics dans un viewBox 900×250
// Y décalé vers le bas pour laisser de l'espace au skieur au-dessus des sommets
const PICS_SVG: [number, number][] = [
  [100, 162],   // Bloc 1
  [238, 138],   // Bloc 2
  [372, 108],   // Bloc 3 — le plus haut
  [505, 122],   // Bloc 4
  [630, 112],   // Bloc 5
  [748, 130],   // Bloc 6
  [862,  98],   // Bloc 7 — sommet final
]

// Profil complet crête (pics + vallées intercalées)
const CRETE_SVG: [number, number][] = [
  [0,   228],
  [48,  210],
  [100, 162],   // Pic 1
  [162, 208],
  [238, 138],   // Pic 2
  [308, 198],
  [372, 108],   // Pic 3
  [440, 192],
  [505, 122],   // Pic 4
  [570, 194],
  [630, 112],   // Pic 5
  [692, 196],
  [748, 130],   // Pic 6
  [808, 200],
  [862,  98],   // Pic 7
  [900, 218],
]

function MontagneSVG({ blocs, progression }: { blocs: BlocStatut[]; progression: number }) {
  const skierIndex = Math.min(progression, 7)

  // Skieur au départ (bord gauche) ou au sommet du dernier bloc terminé
  const skierX = skierIndex === 0 ? 18 : PICS_SVG[skierIndex - 1][0]
  const skierY = skierIndex === 0 ? CRETE_SVG[0][1] : PICS_SVG[skierIndex - 1][1]

  // Polygon de remplissage : crête → bas droite → bas gauche
  const fillPoints = [
    ...CRETE_SVG,
    [900, 250] as [number, number],
    [0,   250] as [number, number],
  ].map(([x, y]) => `${x},${y}`).join(' ')

  const cretePoints = CRETE_SVG.map(([x, y]) => `${x},${y}`).join(' ')

  // Plan arrière flou (montagne secondaire)
  const arrierePlan = [
    '0,250',
    '0,222', '70,178', '175,218', '290,160', '405,212',
    '510,162', '618,215', '712,168', '820,218', '900,178',
    '900,250',
  ].join(' ')

  const enAttenteValidation = blocs.some(b => b.statut === 'en_attente_validation')

  return (
    <svg viewBox="0 0 900 250" className="w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mgPrincipal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7AAAC8" />
          <stop offset="100%" stopColor="#4E7E9E" />
        </linearGradient>
        <linearGradient id="mgArriere" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B8D3E6" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#8AB2CC" stopOpacity="0.6" />
        </linearGradient>
        <filter id="ombre">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Fond ciel */}
      <rect width="900" height="250" fill="#EEF3F9" />

      {/* Plan arrière — chaîne secondaire */}
      <polygon points={arrierePlan} fill="url(#mgArriere)" />

      {/* Massif principal — 7 pics */}
      <polygon points={fillPoints} fill="url(#mgPrincipal)" />

      {/* Ligne de crête */}
      <polyline
        points={cretePoints}
        fill="none"
        stroke="#3D6E8E"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Neige sur chaque sommet */}
      {PICS_SVG.map(([x, y], i) => (
        <ellipse key={`neige-${i}`} cx={x} cy={y} rx={20} ry={7} fill="white" opacity="0.72" />
      ))}

      {/* Cercles de statut sur chaque pic */}
      {PICS_SVG.map(([x, y], i) => {
        const statut = blocs[i]?.statut || 'en_attente'
        const couleur =
          statut === 'termine'              ? '#22C55E'
          : statut === 'en_cours'           ? '#3B82F6'
          : statut === 'en_attente_validation' ? '#F59E0B'
          : statut === 'erreur'             ? '#EF4444'
          : '#C8D8E8'

        return (
          <g key={`etape-${i}`} filter="url(#ombre)">
            {/* Numéro du bloc au-dessus */}
            <text
              x={x} y={y - 16}
              textAnchor="middle"
              fontSize="10"
              fill="white"
              fontFamily="Inter, sans-serif"
              fontWeight="600"
              opacity="0.9"
            >
              {i + 1}
            </text>
            {/* Cercle statut */}
            <circle cx={x} cy={y} r="11" fill="white" stroke={couleur} strokeWidth="2.5" />
            {statut === 'termine' && (
              <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill={couleur} fontWeight="bold">✓</text>
            )}
            {statut === 'en_cours' && (
              <circle cx={x} cy={y} r="4" fill={couleur}>
                <animate attributeName="r" values="2;6;2" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.25;1" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
            {statut === 'en_attente_validation' && (
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill={couleur} fontWeight="bold">!</text>
            )}
          </g>
        )
      })}

      {/* Skieur ⛷️ — miroir horizontal pour qu'il monte vers la droite */}
      <g
        transform={`translate(${skierX}, ${skierY - 34})`}
        className={enAttenteValidation ? 'animate-pulse' : ''}
      >
        <text
          textAnchor="middle"
          fontSize="28"
          dominantBaseline="auto"
          transform="scale(-1, 1)"
          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.2))' }}
        >
          ⛷️
        </text>
      </g>
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
            </div>

            {/* Coût — icône i avec tooltip */}
            {bloc.cout && <CoutTooltip cout={bloc.cout} />}

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
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-brand-navy">{coutCumule.toFixed(3)} €</span>
          <CoutTooltip cout={coutCumule} label="Total" />
        </div>
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
