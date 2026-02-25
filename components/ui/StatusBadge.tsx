// Badge de statut coloré selon l'état d'un audit
interface StatusBadgeProps {
  statut: 'termine' | 'en_cours' | 'en_attente_validation' | 'erreur' | 'en_attente'
  size?: 'sm' | 'md'
}

const STATUT_CONFIG = {
  termine: {
    label: 'Terminé',
    classes: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-status-success',
  },
  en_cours: {
    label: 'En cours',
    classes: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-status-info',
    spinner: true,
  },
  en_attente_validation: {
    label: 'En attente de validation',
    classes: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-status-warning',
  },
  erreur: {
    label: 'Erreur',
    classes: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-status-error',
  },
  en_attente: {
    label: 'En attente',
    classes: 'bg-gray-100 text-gray-500 border-gray-200',
    dot: 'bg-status-pending',
  },
} as const

export default function StatusBadge({ statut, size = 'md' }: StatusBadgeProps) {
  const config = STATUT_CONFIG[statut] || STATUT_CONFIG.en_attente
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizeClasses} ${config.classes}`}
    >
      {/* Indicateur point / spinner */}
      {'spinner' in config && config.spinner ? (
        <svg className="w-3 h-3 animate-spin text-current" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      )}
      {config.label}
    </span>
  )
}
