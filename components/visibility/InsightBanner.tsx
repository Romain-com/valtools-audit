// Bannière diagnostic — headline GPT + 3 insights actionnables

interface Props {
  headline: string
  insights: string[]
}

export default function InsightBanner({ headline, insights }: Props) {
  if (!headline && insights.length === 0) return null

  return (
    <div className="bg-slate-800 rounded-xl p-5 text-white">
      {headline && (
        <p className="text-lg font-semibold mb-3">{headline}</p>
      )}
      {insights.length > 0 && (
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
              <span className="text-blue-400 font-bold mt-0.5 flex-shrink-0">→</span>
              {insight}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
