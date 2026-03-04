// Composant d'état de chargement multi-étapes
// Affiche les étapes avec ✓ progressif et étape en cours avec spinner

interface Props {
  currentStep: string
  completedSteps: string[]
}

const ALL_STEPS = [
  'Analyse SERP principale',
  'Analyse hébergement (5 requêtes)',
  'Analyse activités (2 requêtes)',
  'Univers sémantique',
  'Classification des acteurs',
  'Analyse du domaine de référence',
  'Calcul du score',
  'Génération du diagnostic',
]

export default function LoadingOrchestra({ currentStep, completedSteps }: Props) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="max-w-sm mx-auto">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Analyse en cours...</h2>
        <ul className="space-y-2">
          {ALL_STEPS.map((step) => {
            const isCompleted = completedSteps.includes(step)
            const isCurrent = currentStep === step && !isCompleted

            return (
              <li key={step} className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {isCompleted ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isCurrent ? (
                    <svg className="w-3.5 h-3.5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isCompleted
                      ? 'text-slate-400 line-through'
                      : isCurrent
                      ? 'text-slate-800 font-medium'
                      : 'text-slate-400'
                  }`}
                >
                  {step}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
