'use client'
// Page de progression d'un audit — montagne SVG + Supabase Realtime
// Phase 3B : orchestrateur principal + modales validation + panneau logs
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import CoutTooltip from '@/components/ui/CoutTooltip'
import type { KeywordClassifie } from '@/types/visibilite-seo'
import type { ConcurrentIdentifie } from '@/types/concurrents'

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
  resultats: Record<string, unknown> | null
  couts_api: Record<string, { total?: number; total_bloc?: number }> | null
  destinations?: { nom: string }
}

interface LogEntry {
  id: string
  bloc: string | null
  niveau: 'info' | 'warning' | 'error'
  message: string
  detail: Record<string, unknown> | null
  created_at: string
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

// Correspondance id_bloc → clé couts_api
const BLOC_ID_TO_COUTS_KEY: Record<string, string> = {
  positionnement:   'bloc1',
  volume_affaires:  'bloc2',
  schema_digital:   'bloc3',
  visibilite_seo:   'bloc4',
  stocks_physiques: 'bloc5',
  stock_en_ligne:   'bloc6',
  concurrents:      'bloc7',
}

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

const CLASSES_LOG_NIVEAU: Record<string, string> = {
  info: 'text-blue-700 bg-blue-50',
  warning: 'text-amber-700 bg-amber-50',
  error: 'text-red-700 bg-red-50',
}

// ─── Panneau Logs ─────────────────────────────────────────────────────────────

function PanneauLogs({
  logs,
  ouvert,
  onToggle,
  nomDestination,
  blocsStatuts,
  statutAudit,
}: {
  logs: LogEntry[]
  ouvert: boolean
  onToggle: () => void
  nomDestination: string
  blocsStatuts: Record<string, StatutBloc>
  statutAudit: string
}) {
  const [detailOuvert, setDetailOuvert] = useState<string | null>(null)

  function copierPourClaude(log: LogEntry) {
    const segment =
      log.bloc && ['bloc1', 'bloc2', 'bloc3', 'bloc4'].includes(log.bloc ?? '') ? 'segment-a'
      : log.bloc && ['bloc5', 'bloc6', 'bloc7'].includes(log.bloc ?? '') ? 'segment-b/c'
      : 'inconnu'

    const blocsTermines = Object.entries(blocsStatuts)
      .filter(([, s]) => s === 'termine')
      .map(([b]) => b)
      .join(', ')

    const texte = `## Erreur audit ${nomDestination} — ${log.bloc ?? 'global'}

**Message** : ${log.message}
**Timestamp** : ${log.created_at}
**Segment** : ${segment}

**Détail technique** :
${log.detail ? JSON.stringify(log.detail, null, 2) : '(aucun détail)'}

**Contexte** :
- Destination : ${nomDestination}
- Statut audit : ${statutAudit}
- Blocs terminés avant l'erreur : ${blocsTermines || '(aucun)'}

**Stack trace** (si disponible) :
${(log.detail?.stack as string) ?? '(non disponible)'}`

    navigator.clipboard.writeText(texte).catch(() => {})
  }

  const nbErreurs = logs.filter(l => l.niveau === 'error').length

  return (
    <div className="border border-brand-border rounded-lg overflow-hidden">
      {/* En-tête dépliable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-brand-bg hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-brand-navy">Logs d&apos;exécution</span>
          {nbErreurs > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
              {nbErreurs} erreur{nbErreurs > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-text-muted">{logs.length} entrée{logs.length > 1 ? 's' : ''}</span>
        </div>
        <svg
          viewBox="0 0 20 20"
          className={`w-4 h-4 text-text-secondary transition-transform ${ouvert ? 'rotate-180' : ''}`}
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Corps dépliable */}
      {ouvert && (
        <div className="divide-y divide-brand-border max-h-80 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-xs text-text-muted px-4 py-3 italic">Aucun log pour le moment.</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`px-4 py-2.5 text-xs ${CLASSES_LOG_NIVEAU[log.niveau] ?? ''}`}>
                <div className="flex items-start gap-2">
                  {/* Timestamp */}
                  <span className="shrink-0 text-[10px] text-text-muted font-mono mt-0.5">
                    {new Date(log.created_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>

                  {/* Bloc */}
                  {log.bloc && (
                    <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-white/50 border border-current/20 font-mono">
                      {log.bloc}
                    </span>
                  )}

                  {/* Niveau */}
                  <span className="shrink-0 font-semibold uppercase text-[10px]">{log.niveau}</span>

                  {/* Message */}
                  <span className="flex-1 leading-relaxed">{log.message}</span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {log.detail && (
                      <button
                        onClick={() => setDetailOuvert(detailOuvert === log.id ? null : log.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-current/30 hover:bg-white/30 transition-colors"
                      >
                        Détail
                      </button>
                    )}
                    {log.niveau === 'error' && (
                      <button
                        onClick={() => copierPourClaude(log)}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-current/30 hover:bg-white/30 transition-colors font-medium"
                        title="Copier le contexte d'erreur pour Claude"
                      >
                        Copier pour Claude
                      </button>
                    )}
                  </div>
                </div>

                {/* Détail JSON déplié */}
                {detailOuvert === log.id && log.detail && (
                  <pre className="mt-2 p-2 bg-white/40 rounded text-[10px] font-mono overflow-x-auto whitespace-pre-wrap border border-current/20">
                    {JSON.stringify(log.detail, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modale validation Bloc 4 — Keywords ─────────────────────────────────────

function ModalValidationKeywords({
  keywords,
  onConfirm,
  onClose,
}: {
  keywords: KeywordClassifie[]
  onConfirm: (keywordsValides: KeywordClassifie[]) => void
  onClose: () => void
}) {
  const [selection, setSelection] = useState<Set<string>>(
    () => new Set(
      keywords
        .filter(k => k.gap && k.intent_transactionnel)
        .map(k => k.keyword)
    )
  )
  const [envoi, setEnvoi] = useState(false)

  function toggleKeyword(keyword: string) {
    setSelection(prev => {
      const next = new Set(prev)
      if (next.has(keyword)) next.delete(keyword)
      else next.add(keyword)
      return next
    })
  }

  function handleConfirm() {
    const valides = keywords.filter(k => selection.has(k.keyword))
    setEnvoi(true)
    onConfirm(valides)
  }

  // Cas liste vide — aucun keyword détecté (domaine OT absent, Haloscan SITE_NOT_FOUND, etc.)
  if (keywords.length === 0) {
    return (
      <Modal open={true} onClose={onClose} title="Validation — Keywords Phase B" blocking>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <svg viewBox="0 0 20 20" className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Aucun keyword détecté</p>
              <p className="text-amber-700 text-xs mt-1">
                Le domaine de l&apos;OT n&apos;a pas été détecté ou n&apos;est pas indexé par Haloscan (SITE_NOT_FOUND).
                La Phase B sera lancée sans keywords — le score gap sera calculé à partir des données disponibles.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setEnvoi(true); onConfirm([]) }}
              disabled={envoi}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {envoi ? <Spinner size="sm" /> : 'Continuer sans keywords'}
            </button>
            <button onClick={onClose} className="btn-secondary">Annuler</button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={true} onClose={onClose} title="Validation — Keywords Phase B" blocking>
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Sélectionnez les keywords à analyser en Phase B (SERP live + calcul du score gap).
          Les keywords avec <strong>gap + intent transactionnel</strong> sont pré-cochés.
        </p>

        <div className="text-xs text-text-muted">
          {selection.size} keyword{selection.size > 1 ? 's' : ''} sélectionné{selection.size > 1 ? 's' : ''}
        </div>

        {/* Tableau keywords */}
        <div className="border border-brand-border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-brand-bg border-b border-brand-border sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">✓</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Keyword</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Volume</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Catégorie</th>
                <th className="px-3 py-2 text-center font-medium text-text-secondary">Gap</th>
                <th className="px-3 py-2 text-center font-medium text-text-secondary">Transac.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {keywords.map(k => (
                <tr
                  key={k.keyword}
                  className={`cursor-pointer hover:bg-gray-50 ${selection.has(k.keyword) ? 'bg-blue-50/40' : ''}`}
                  onClick={() => toggleKeyword(k.keyword)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selection.has(k.keyword)}
                      onChange={() => toggleKeyword(k.keyword)}
                      className="rounded"
                      onClick={e => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-brand-navy">{k.keyword}</td>
                  <td className="px-3 py-2 text-right font-mono">{k.volume.toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2 text-text-secondary">{k.categorie}</td>
                  <td className="px-3 py-2 text-center">{k.gap ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-center">{k.intent_transactionnel ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleConfirm}
            disabled={envoi || selection.size === 0}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {envoi ? <Spinner size="sm" color="white" /> : `Confirmer (${selection.size} keywords)`}
          </button>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modale validation Bloc 7 — Concurrents ──────────────────────────────────

function ModalValidationConcurrents({
  concurrents,
  haloscanSuggestions,
  onConfirm,
  onClose,
}: {
  concurrents: ConcurrentIdentifie[]
  haloscanSuggestions: Array<{ root_domain: string; missed_keywords: number; total_traffic: number }>
  onConfirm: (concurrentsValides: ConcurrentIdentifie[]) => void
  onClose: () => void
}) {
  const [liste, setListe] = useState<ConcurrentIdentifie[]>(concurrents)
  const [envoi, setEnvoi] = useState(false)

  function supprimerConcurrent(index: number) {
    setListe(prev => prev.filter((_, i) => i !== index))
  }

  function handleConfirm() {
    if (liste.length === 0) return
    setEnvoi(true)
    onConfirm(liste)
  }

  return (
    <Modal open={true} onClose={onClose} title="Validation — Concurrents identifiés" blocking>
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Vérifiez la sélection des concurrents avant de lancer l&apos;analyse comparative.
          Vous pouvez supprimer ceux qui ne sont pas pertinents.
        </p>

        {/* Tableau concurrents */}
        <div className="border border-brand-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-brand-bg border-b border-brand-border">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Destination</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Type</th>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Domaine</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {liste.map((c, i) => (
                <tr key={`${c.nom}-${i}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-brand-navy">{c.nom}</div>
                    <div className="text-text-muted text-[10px]">{c.departement}</div>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{c.type_destination}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">
                    {c.domaine_valide || c.domaine_ot}
                    {c.confiance_domaine === 'incertain' && (
                      <span className="ml-1 text-amber-600">?</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => supprimerConcurrent(i)}
                      className="text-red-500 hover:text-red-700 text-[10px] px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Suggestions Haloscan — concurrents SEO non proposés par OpenAI */}
        {haloscanSuggestions.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-800 mb-2">
              Concurrents SEO détectés par Haloscan (non proposés par l&apos;IA)
            </p>
            <div className="space-y-1">
              {haloscanSuggestions.map(s => (
                <div key={s.root_domain} className="flex items-center justify-between text-xs text-blue-700">
                  <span className="font-mono">{s.root_domain}</span>
                  <span className="text-[10px] text-blue-600">
                    {s.missed_keywords.toLocaleString('fr-FR')} keywords manqués
                    {' · '}{s.total_traffic.toLocaleString('fr-FR')} visites/mois
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-blue-600 mt-2 italic">
              Ces sites ne seront pas inclus dans l&apos;analyse comparative à moins d&apos;être ajoutés manuellement.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleConfirm}
            disabled={envoi || liste.length === 0}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {envoi ? <Spinner size="sm" /> : `Confirmer (${liste.length} concurrent${liste.length > 1 ? 's' : ''})`}
          </button>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
        </div>
      </div>
    </Modal>
  )
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
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsOuverts, setLogsOuverts] = useState(false)
  const [validationBloc, setValidationBloc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [segmentALance, setSegmentALance] = useState(false)

  // Ref pour éviter de lancer le Segment A deux fois (StrictMode double render)
  const segmentALanceRef = useRef(false)

  // ── Calcul des blocs depuis resultats JSONB ──
  function extraireBlocs(resultats: AuditData['resultats'], coutsApi: AuditData['couts_api']): BlocStatut[] {
    if (!resultats) return BLOCS_CONFIG.map(b => ({ ...b, statut: 'en_attente' }))

    // Lire les blocs_statuts si disponibles (source de vérité de l'orchestrateur)
    const blocsStatuts = resultats.blocs_statuts as Record<string, StatutBloc> | undefined

    return BLOCS_CONFIG.map((cfg, i) => {
      const coutBlocKey = BLOC_ID_TO_COUTS_KEY[cfg.id] ?? `bloc${i + 1}`
      const coutData = coutsApi?.[coutBlocKey]
      const cout = coutData?.total ?? coutData?.total_bloc ?? undefined

      let statut: StatutBloc = 'en_attente'

      if (blocsStatuts) {
        // Utiliser blocs_statuts — source de vérité de l'orchestrateur
        const cle = `bloc${i + 1}` as keyof typeof blocsStatuts
        statut = (blocsStatuts[cle] as StatutBloc) ?? 'en_attente'
      } else {
        // Fallback : déduire depuis resultats (compatibilité ancienne logique)
        const data = resultats[cfg.id]
        if (data) {
          if ((data as { statut?: string }).statut === 'en_attente_validation') {
            statut = 'en_attente_validation'
          } else if ((data as { erreur?: unknown }).erreur) {
            statut = 'erreur'
          } else {
            statut = 'termine'
          }
        }
      }

      return { ...cfg, statut, cout }
    })
  }

  // ── Réf pour conserver le nom destination entre les updates Realtime ──
  const nomDestinationRef = useRef<string>('')

  // ── Chargement initial + logs existants ──
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
      if (auditData.destinations?.nom) nomDestinationRef.current = auditData.destinations.nom
      setAudit(auditData)
      setBlocs(extraireBlocs(auditData.resultats, auditData.couts_api))
      setLoading(false)
    }

    // Chargement des logs existants
    async function chargerLogs() {
      const { data } = await supabase
        .from('audit_logs')
        .select('id, bloc, niveau, message, detail, created_at')
        .eq('audit_id', id)
        .order('created_at', { ascending: true })
        .limit(100)

      if (data && data.length > 0) {
        setLogs(data as LogEntry[])
        if ((data as LogEntry[]).some(l => l.niveau === 'error')) setLogsOuverts(true)
      }
    }

    charger()
    chargerLogs()
  }, [id])

  // ── Polling actif toutes les 3s (fallback Realtime + source principale) ──
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function pollStatut() {
      try {
        const res = await fetch(`/api/orchestrateur/statut?audit_id=${id}`)
        if (!res.ok) return
        const data = await res.json() as {
          statut: string
          blocs_statuts: Record<string, StatutBloc>
          couts_api: Record<string, { total?: number; total_bloc?: number }> | null
          logs: LogEntry[]
        }

        // Mettre à jour l'audit en préservant le nom destination
        setAudit(prev => {
          if (!prev) return prev
          const next: AuditData = {
            ...prev,
            statut: data.statut,
            resultats: { ...(prev.resultats ?? {}), blocs_statuts: data.blocs_statuts },
            couts_api: data.couts_api,
            destinations: { nom: nomDestinationRef.current },
          }
          setBlocs(extraireBlocs(next.resultats, next.couts_api))
          return next
        })

        // Fusionner les logs (éviter doublons par id)
        if (data.logs?.length > 0) {
          setLogs(prev => {
            const existingIds = new Set(prev.map(l => l.id))
            const nouveaux = data.logs.filter(l => !existingIds.has(l.id))
            if (nouveaux.length === 0) return prev
            if (nouveaux.some(l => l.niveau === 'error')) setLogsOuverts(true)
            return [...prev, ...nouveaux]
          })
        }

        // Arrêter le polling si terminé ou en erreur
        if (data.statut === 'termine' || data.statut === 'erreur') {
          if (intervalId) clearInterval(intervalId)
        }
      } catch {
        // Erreur silencieuse — on réessaie au prochain tick
      }
    }

    // Ne démarrer le polling qu'une fois le chargement initial terminé
    if (!loading) {
      pollStatut() // Premier appel immédiat
      intervalId = setInterval(pollStatut, 3000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [id, loading])

  // ── Supabase Realtime — écoute des changements d'audit (bonus) ──
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
          // Préserver le nom destination (pas dans le payload Realtime)
          setAudit(prev => ({
            ...updated,
            destinations: { nom: nomDestinationRef.current || prev?.destinations?.nom || '' },
          }))
          setBlocs(extraireBlocs(updated.resultats, updated.couts_api))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  // ── Supabase Realtime — écoute des logs d'audit (bonus) ──
  useEffect(() => {
    const channel = supabase
      .channel(`logs-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'audit_logs',
          filter: `audit_id=eq.${id}`,
        },
        (payload) => {
          const newLog = payload.new as LogEntry
          setLogs(prev => {
            // Éviter doublons si le polling a déjà récupéré ce log
            if (prev.some(l => l.id === newLog.id)) return prev
            return [...prev, newLog]
          })
          if (newLog.niveau === 'error') setLogsOuverts(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  // ── Déclenchement automatique Segment A ──
  useEffect(() => {
    if (!audit || loading || segmentALanceRef.current) return

    const blocsStatuts = audit.resultats?.blocs_statuts as Record<string, string> | undefined
    const tousEnAttente = !blocsStatuts || Object.values(blocsStatuts).every(s => s === 'en_attente')
    const doitLancer = audit.statut === 'en_cours' && tousEnAttente

    if (doitLancer) {
      segmentALanceRef.current = true
      setSegmentALance(true)

      fetch(`/api/orchestrateur/segment-a`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: id }),
      }).catch(err => {
        console.error('[progression] Erreur lancement Segment A :', err)
        segmentALanceRef.current = false
        setSegmentALance(false)
      })
    }
  }, [audit, loading, id])

  // ── Rechargement des resultats complets avant d'ouvrir une modale ──
  // Le polling ne met à jour que blocs_statuts — les données de phase (keywords, concurrents)
  // doivent être relues depuis Supabase au moment de la validation.
  async function ouvrirModalValidation(blocId: string) {
    const { data } = await supabase
      .from('audits')
      .select('resultats, couts_api')
      .eq('id', id)
      .single()

    if (data) {
      setAudit(prev => prev ? {
        ...prev,
        resultats: data.resultats as Record<string, unknown>,
        couts_api: data.couts_api as Record<string, { total?: number; total_bloc?: number }>,
      } : prev)
    }

    setValidationBloc(blocId)
  }

  // ── Ouverture automatique de la modale de validation ──
  useEffect(() => {
    const blocValidation = blocs.find(b => b.statut === 'en_attente_validation')
    if (blocValidation && validationBloc === null) {
      // Délai court pour laisser l'UI se mettre à jour visuellement
      const timer = setTimeout(() => ouvrirModalValidation(blocValidation.id), 400)
      return () => clearTimeout(timer)
    }
  }, [blocs])

  // ── Confirmation keywords → déclenche Segment B ──
  async function handleConfirmKeywords(keywordsValides: KeywordClassifie[]) {
    setValidationBloc(null)

    fetch(`/api/orchestrateur/segment-b`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: id, keywords_valides: keywordsValides }),
    }).catch(err => console.error('[progression] Erreur lancement Segment B :', err))
  }

  // ── Confirmation concurrents → déclenche Segment C ──
  async function handleConfirmConcurrents(concurrentsValides: ConcurrentIdentifie[]) {
    setValidationBloc(null)

    fetch(`/api/orchestrateur/segment-c`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: id, concurrents_valides: concurrentsValides }),
    }).catch(err => console.error('[progression] Erreur lancement Segment C :', err))
  }

  // ── Nom destination (depuis ref ou audit) ──
  const nomDestination = nomDestinationRef.current || audit?.destinations?.nom || ''

  // ── Métriques ──
  const nbTermines = blocs.filter(b => b.statut === 'termine').length
  const progression = nbTermines
  const toutTermine = audit?.statut === 'termine' || blocs.every(b => b.statut === 'termine')
  const blocEnAttenteValidation = blocs.find(b => b.statut === 'en_attente_validation')
  const coutCumule = blocs.reduce((sum, b) => sum + (b.cout || 0), 0)

  // ── Données pour les modales ──
  const resultats = audit?.resultats ?? {}
  const blocsStatuts = (resultats.blocs_statuts ?? {}) as Record<string, StatutBloc>

  // Keywords Phase A pour la modale Bloc 4
  const visibiliteSEO = resultats.visibilite_seo as {
    phase_a?: { keywords_classes?: KeywordClassifie[] }
  } | undefined
  const keywordsPhaseA = visibiliteSEO?.phase_a?.keywords_classes ?? []

  // Concurrents Phase A pour la modale Bloc 7
  const concurrentsData = resultats.concurrents as {
    phase_a?: {
      concurrents?: ConcurrentIdentifie[]
      haloscan_suggestions?: Array<{ root_domain: string; missed_keywords: number; total_traffic: number }>
    }
  } | undefined
  const concurrentsPhaseA = concurrentsData?.phase_a?.concurrents ?? []
  const haloscanSuggestions = concurrentsData?.phase_a?.haloscan_suggestions ?? []

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
          {nomDestination || 'Audit en cours'}
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Progression de l&apos;analyse digitale
          {segmentALance && !toutTermine && (
            <span className="ml-2 text-xs text-status-info">• Analyse en cours</span>
          )}
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
            onClick={() => ouvrirModalValidation(blocEnAttenteValidation.id)}
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

            {/* Coût */}
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
                onClick={() => ouvrirModalValidation(bloc.id)}
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
        <div className="text-center animate-fade-in mb-6">
          <button
            onClick={() => router.push(`/audit/${id}/resultats`)}
            className="btn-primary text-base px-8 py-3"
          >
            Voir les résultats →
          </button>
        </div>
      )}

      {/* Panneau Logs */}
      <PanneauLogs
        logs={logs}
        ouvert={logsOuverts}
        onToggle={() => setLogsOuverts(prev => !prev)}
        nomDestination={nomDestination}
        blocsStatuts={blocsStatuts}
        statutAudit={audit?.statut ?? ''}
      />

      {/* Modale validation Bloc 4 — Keywords Phase B (s'ouvre même si liste vide) */}
      {validationBloc === 'visibilite_seo' && (
        <ModalValidationKeywords
          keywords={keywordsPhaseA}
          onConfirm={handleConfirmKeywords}
          onClose={() => setValidationBloc(null)}
        />
      )}

      {/* Modale validation Bloc 7 — Concurrents */}
      {validationBloc === 'concurrents' && concurrentsPhaseA.length > 0 && (
        <ModalValidationConcurrents
          concurrents={concurrentsPhaseA}
          haloscanSuggestions={haloscanSuggestions}
          onConfirm={handleConfirmConcurrents}
          onClose={() => setValidationBloc(null)}
        />
      )}
    </div>
  )
}
