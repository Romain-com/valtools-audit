'use client'
// Étape 2 — Liste éditable des acteurs officiels détectés
// Permet de supprimer, changer la catégorie ou ajouter un domaine manuellement

import { useState } from 'react'
import type { ClassifiedSite, SiteCategory } from '@/types/ecosystem'
import SiteCard from './SiteCard'

interface StepValidationProps {
  sites: ClassifiedSite[]
  destination: string
  onEnrich: (sites: ClassifiedSite[]) => void
  loading: boolean
}

export default function StepValidation({ sites, destination, onEnrich, loading }: StepValidationProps) {
  const [localSites, setLocalSites] = useState<ClassifiedSite[]>(sites)
  const [newDomain, setNewDomain] = useState('')

  function handleRemove(index: number) {
    setLocalSites((prev) => prev.filter((_, i) => i !== index))
  }

  function handleCategoryChange(index: number, category: SiteCategory) {
    setLocalSites((prev) =>
      prev.map((s, i) => i === index ? { ...s, category } : s)
    )
  }

  function handleAddDomain(e: React.FormEvent) {
    e.preventDefault()
    const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
    if (!domain) return
    if (localSites.some((s) => s.domain === domain)) {
      setNewDomain('')
      return
    }

    const newSite: ClassifiedSite = {
      domain,
      url: `https://${domain}`,
      title: '',
      description: '',
      serpPosition: null,
      isOfficial: true,
      category: 'AUTRE_OFFICIEL',
      confidence: 'low',
      manuallyAdded: true,
    }

    setLocalSites((prev) => [...prev, newSite])
    setNewDomain('')
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Acteurs officiels détectés</h2>
          <p className="text-sm text-slate-500 mt-1">
            {localSites.length} acteur{localSites.length > 1 ? 's' : ''} identifié{localSites.length > 1 ? 's' : ''} pour &laquo; {destination} &raquo;
          </p>
        </div>
        <button
          onClick={() => onEnrich(localSites)}
          disabled={loading || localSites.length === 0}
          className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Enrichissement...' : 'Enrichir les données →'}
        </button>
      </div>

      {/* Liste des sites */}
      <div className="flex flex-col gap-3 mb-6">
        {localSites.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            Aucun acteur officiel détecté. Ajoutez des domaines manuellement ci-dessous.
          </p>
        )}
        {localSites.map((site, index) => (
          <SiteCard
            key={site.domain}
            site={site}
            onRemove={() => handleRemove(index)}
            onCategoryChange={(cat) => handleCategoryChange(index, cat)}
          />
        ))}
      </div>

      {/* Ajout manuel */}
      <div className="border-t border-slate-100 pt-5">
        <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wide">Ajouter un domaine</p>
        <form onSubmit={handleAddDomain} className="flex gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="Ex : www.mairie-laux.fr ou https://..."
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          <button
            type="submit"
            disabled={!newDomain.trim()}
            className="px-4 py-2 border border-slate-200 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            + Ajouter
          </button>
        </form>
      </div>
    </div>
  )
}
