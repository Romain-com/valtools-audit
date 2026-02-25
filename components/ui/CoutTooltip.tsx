'use client'
// Icône "i" avec tooltip au survol — affiche le montant en € d'un appel API

interface CoutTooltipProps {
  cout: number
  label?: string  // Optionnel : texte affiché dans le tooltip avant le montant
}

export default function CoutTooltip({ cout, label }: CoutTooltipProps) {
  if (!cout || cout <= 0) return null

  return (
    <div className="relative group inline-flex items-center">
      {/* Icône i */}
      <span className="w-4 h-4 rounded-full border border-gray-300 text-[10px] text-gray-400 flex items-center justify-center cursor-help font-bold leading-none group-hover:border-brand-orange group-hover:text-brand-orange transition-colors select-none">
        i
      </span>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-brand-navy text-white text-xs font-mono rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
        {label && <span className="font-sans font-normal text-white/70 mr-1">{label}</span>}
        {cout.toFixed(4)} €
        {/* Flèche */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-brand-navy" />
      </div>
    </div>
  )
}
