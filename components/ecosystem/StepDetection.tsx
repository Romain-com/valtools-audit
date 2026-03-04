'use client'
// Étape 1 — Saisie du nom de la destination et lancement de la détection

import { useState } from 'react'

interface StepDetectionProps {
  onDetect: (keyword: string) => void
  loading: boolean
  loadingMessage: string
  error: string | null
}

export default function StepDetection({ onDetect, loading, loadingMessage, error }: StepDetectionProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim()) onDetect(value.trim())
  }

  return (
    <div className="max-w-xl mx-auto py-16 px-4">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        Cartographie de l&apos;écosystème digital
      </h2>
      <p className="text-slate-500 mb-8 text-sm leading-relaxed">
        Saisissez le nom d&apos;une destination touristique pour détecter automatiquement
        les acteurs officiels présents sur Google, puis enrichir chacun avec ses métriques de visibilité.
      </p>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex : Les 7 Laux, Morzine, Sarlat..."
          disabled={loading}
          className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? 'Analyse...' : 'Analyser'}
        </button>
      </form>

      {loading && (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-500">
          {/* Spinner */}
          <svg className="animate-spin w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          <span>{loadingMessage}</span>
        </div>
      )}
    </div>
  )
}
