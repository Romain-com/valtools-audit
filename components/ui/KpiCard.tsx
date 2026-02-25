// Carte KPI — gros chiffre + label + jauge colorée selon seuils
interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  // Valeur entre 0 et 1 pour la jauge (ou null = pas de jauge)
  gaugeValue?: number | null
  // Seuils : gaugeValue >= high = vert, >= medium = orange, sinon rouge
  thresholds?: { high: number; medium: number }
  subtitle?: string
  icon?: React.ReactNode
  compact?: boolean
}

function getGaugeColor(value: number, thresholds: { high: number; medium: number }): string {
  if (value >= thresholds.high) return 'bg-status-success'
  if (value >= thresholds.medium) return 'bg-status-warning'
  return 'bg-status-error'
}

function getValueColor(value: number, thresholds: { high: number; medium: number }): string {
  if (value >= thresholds.high) return 'text-green-600'
  if (value >= thresholds.medium) return 'text-amber-600'
  return 'text-red-600'
}

export default function KpiCard({
  label,
  value,
  unit,
  gaugeValue,
  thresholds = { high: 0.7, medium: 0.4 },
  subtitle,
  icon,
  compact = false,
}: KpiCardProps) {
  const hasGauge = gaugeValue !== null && gaugeValue !== undefined
  const gaugeColor = hasGauge ? getGaugeColor(gaugeValue!, thresholds) : ''
  const valueColorClass =
    hasGauge && typeof gaugeValue === 'number'
      ? getValueColor(gaugeValue!, thresholds)
      : 'text-brand-navy'

  return (
    <div className={`card ${compact ? 'p-4' : 'p-5'} flex flex-col gap-2`}>
      {/* En-tête label + icône */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          {label}
        </span>
        {icon && (
          <span className="text-text-muted">{icon}</span>
        )}
      </div>

      {/* Valeur principale */}
      <div className="flex items-baseline gap-1">
        <span className={`font-bold leading-none ${compact ? 'text-2xl' : 'text-3xl'} ${valueColorClass}`}>
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-text-secondary">{unit}</span>
        )}
      </div>

      {/* Sous-titre optionnel */}
      {subtitle && (
        <p className="text-xs text-text-muted truncate">{subtitle}</p>
      )}

      {/* Jauge colorée */}
      {hasGauge && (
        <div className="mt-1">
          <div className="h-1.5 bg-brand-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full gauge-bar ${gaugeColor}`}
              style={{ width: `${Math.min(gaugeValue! * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
