'use client'
// Barre de progression représentant le score d'autorité (0-100)
// Rouge < 34, Orange 34-66, Vert > 66

interface AuthorityBarProps {
  score: number
}

export default function AuthorityBar({ score }: AuthorityBarProps) {
  const color =
    score >= 67
      ? 'bg-green-500'
      : score >= 34
      ? 'bg-amber-500'
      : 'bg-red-500'

  return (
    <div className="flex items-center gap-2 w-full min-w-[120px]">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-8 text-right shrink-0">
        {score}
      </span>
    </div>
  )
}
