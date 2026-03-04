'use client'
// Composant principal de la page Territoire
// Flux : saisie textarea → validation communes → analyse → résultats en 3 onglets + export CSV

import { useState, useMemo } from 'react'
import type { LigneResultat, CommuneValidee } from '@/app/api/territoire/valider/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Etablissement {
  uuid: string
  nom: string
  categorie: string
  sous_categorie: string
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  lat: number | null
  lng: number | null
  capacite: number | null
}

interface ResultatTaxe {
  collecteur: 'commune' | 'epci' | 'non_institue'
  nom_collecteur: string
  siren_collecteur: string
  montant_total: number
  montant_estime_commune: number | null
  part_epci_pct: number | null
  methode_part: 'residences_secondaires' | 'rs_hybride' | 'population' | null
  annee: number
  nuitees_estimees: number
}

interface CapaciteINSEE {
  hotels: { nb_etab: number; nb_chambres: number }
  campings: { nb_etab: number; nb_emplacements: number }
  autres_heb: { nb_etab: number }
  total_etab: number
  annee: number
}

interface FrequentationINSEE {
  nuitees_total: number
  nuitees_hotels: number
  nuitees_autres: number
  annee: number
  code_departement: string
}

interface ResultatCommune {
  commune: {
    nom: string
    code_insee: string
    code_postal: string
    code_departement: string
  }
  hebergements: Etablissement[]
  poi: Etablissement[]
  taxe: ResultatTaxe | null
  residences_secondaires: number | null
  insee_cap: CapaciteINSEE | null
  freq_departement: FrequentationINSEE | null
  erreur?: string
}

// Ligne de validation enrichie avec la sélection utilisateur
interface LigneValidation extends LigneResultat {
  commune_choisie?: CommuneValidee  // si ambigu, commune sélectionnée par l'utilisateur
}

type Onglet = 'hebergements' | 'poi' | 'taxe'

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function formaterMontant(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function exporterCSV(donnees: object[], nomFichier: string) {
  if (donnees.length === 0) return

  const entetes = Object.keys(donnees[0])
  const lignesCsv = [
    entetes.join(';'),
    ...donnees.map((row) =>
      entetes.map((k) => {
        const val = (row as Record<string, unknown>)[k]
        const str = val === null || val === undefined ? '' : String(val)
        // Échapper les point-virgules et guillemets
        return str.includes(';') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(';')
    ),
  ]

  const blob = new Blob(['\uFEFF' + lignesCsv.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function BadgeStatut({ statut }: { statut: 'ok' | 'ambigu' | 'invalide' }) {
  if (statut === 'ok') return (
    <span className="inline-flex items-center gap-1 text-xs text-green-400">
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      Reconnue
    </span>
  )
  if (statut === 'ambigu') return (
    <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      Ambiguë
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-400">
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
      Inconnue
    </span>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function TerritoireClient() {
  // ── État ──────────────────────────────────────────────────────────────────
  const [texte, setTexte] = useState('')
  const [validation, setValidation] = useState<LigneValidation[] | null>(null)
  const [enValidation, setEnValidation] = useState(false)
  const [lignesEnEdition, setLignesEnEdition] = useState<Record<number, string>>({})
  const [lignesEnRevalidation, setLignesEnRevalidation] = useState<Record<number, boolean>>({})
  const [resultats, setResultats] = useState<ResultatCommune[] | null>(null)
  const [enAnalyse, setEnAnalyse] = useState(false)
  const [onglet, setOnglet] = useState<Onglet>('hebergements')
  const [modeVueHeb, setModeVueHeb] = useState<'synthese' | 'detail'>('synthese')
  const [modeVuePOI, setModeVuePOI] = useState<'synthese' | 'detail'>('synthese')
  const [communesOuvertes, setCommunesOuvertes] = useState<Set<string>>(new Set())
  const [filtreCommune, setFiltreCommune] = useState<string>('toutes')
  const [filtreType, setFiltreType] = useState<string>('tous')
  const [sortColonne, setSortColonne] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  // États de tri pour les 4 autres tableaux
  const [sortHebDetCol, setSortHebDetCol] = useState<string | null>(null)
  const [sortHebDetDir, setSortHebDetDir] = useState<'asc' | 'desc'>('desc')
  const [sortPOISynCol, setSortPOISynCol] = useState<string | null>(null)
  const [sortPOISynDir, setSortPOISynDir] = useState<'asc' | 'desc'>('desc')
  const [sortPOIDetCol, setSortPOIDetCol] = useState<string | null>(null)
  const [sortPOIDetDir, setSortPOIDetDir] = useState<'asc' | 'desc'>('desc')
  const [sortTaxeCol, setSortTaxeCol] = useState<string | null>(null)
  const [sortTaxeDir, setSortTaxeDir] = useState<'asc' | 'desc'>('desc')
  // État analyse GPT
  const [analyseGPT, setAnalyseGPT] = useState<{
    communes_moteurs: { nom: string; raison: string }[]
    specialisations: string[]
    maturite_touristique: { niveau: string; justification: string }
    communes_sous_exploitees: { nom: string; potentiel: string }[]
    synthese: string
  } | null>(null)
  const [enAnalyseGPT, setEnAnalyseGPT] = useState(false)
  const [erreurAnalyseGPT, setErreurAnalyseGPT] = useState<string | null>(null)

  // ── Validation ────────────────────────────────────────────────────────────

  async function validerCommunes() {
    const lignes = texte.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
    if (lignes.length === 0) return

    setEnValidation(true)
    setValidation(null)
    setResultats(null)

    try {
      const reponse = await fetch('/api/territoire/valider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lignes }),
      })
      const data = await reponse.json()
      setValidation(data.resultats ?? [])
    } catch (err) {
      console.error('Erreur validation :', err)
    } finally {
      setEnValidation(false)
    }
  }

  // Sélection d'une commune pour une ligne ambiguë
  function choisirCommune(idx: number, commune: CommuneValidee) {
    if (!validation) return
    const copie = [...validation]
    copie[idx] = { ...copie[idx], statut: 'ok', commune_choisie: commune, commune: commune }
    setValidation(copie)
  }

  // Re-validation d'une ligne invalide après correction par l'utilisateur
  async function revaliderLigne(idx: number) {
    const texteCorrige = (lignesEnEdition[idx] ?? '').trim()
    if (!texteCorrige || !validation) return

    setLignesEnRevalidation((prev) => ({ ...prev, [idx]: true }))

    try {
      const reponse = await fetch('/api/territoire/valider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lignes: [texteCorrige] }),
      })
      const data = await reponse.json()
      const resultat = data.resultats?.[0]
      if (!resultat) return

      const copie = [...validation]
      copie[idx] = { ...resultat }
      setValidation(copie)
      // Nettoyer l'état d'édition pour cette ligne
      setLignesEnEdition((prev) => { const n = { ...prev }; delete n[idx]; return n })
    } catch (err) {
      console.error('Erreur re-validation :', err)
    } finally {
      setLignesEnRevalidation((prev) => { const n = { ...prev }; delete n[idx]; return n })
    }
  }

  // Communes confirmées (ok + ambiguës avec sélection)
  const communesConfirmees = useMemo(() => {
    if (!validation) return []
    return validation
      .filter((l) => l.statut === 'ok' && (l.commune ?? l.commune_choisie))
      .map((l) => (l.commune_choisie ?? l.commune)!)
  }, [validation])

  // ── Analyse ───────────────────────────────────────────────────────────────

  async function lancerAnalyse() {
    if (communesConfirmees.length === 0) return
    setEnAnalyse(true)

    try {
      const reponse = await fetch('/api/territoire/analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communes: communesConfirmees }),
      })
      const data = await reponse.json()
      setResultats(data.resultats ?? [])
    } catch (err) {
      console.error('Erreur analyse :', err)
    } finally {
      setEnAnalyse(false)
    }
  }

  // ── Analyse GPT ───────────────────────────────────────────────────────────

  async function lancerAnalyseGPT() {
    if (!resultats || resultats.length === 0) return
    setEnAnalyseGPT(true)
    setErreurAnalyseGPT(null)
    setAnalyseGPT(null)

    try {
      const reponse = await fetch('/api/territoire/analyse-gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultats }),
      })
      const data = await reponse.json()
      if (data.error) throw new Error(data.error)
      setAnalyseGPT(data.analyse)
    } catch (err) {
      setErreurAnalyseGPT(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setEnAnalyseGPT(false)
    }
  }

  // ── Données filtrées ──────────────────────────────────────────────────────

  const communesDisponibles = useMemo(() => {
    if (!resultats) return []
    return resultats.map((r) => r.commune.nom)
  }, [resultats])

  const hebergementsFiltrés = useMemo(() => {
    if (!resultats) return []
    return resultats
      .filter((r) => filtreCommune === 'toutes' || r.commune.nom === filtreCommune)
      .flatMap((r) =>
        r.hebergements
          .filter((e) => filtreType === 'tous' || e.sous_categorie === filtreType)
          .map((e) => ({ ...e, commune: r.commune.nom, dept: r.commune.code_departement }))
      )
  }, [resultats, filtreCommune, filtreType])

  const poiFiltrés = useMemo(() => {
    if (!resultats) return []
    return resultats
      .filter((r) => filtreCommune === 'toutes' || r.commune.nom === filtreCommune)
      .flatMap((r) =>
        r.poi
          .filter((e) => filtreType === 'tous' || e.categorie === filtreType || e.sous_categorie === filtreType)
          .map((e) => ({ ...e, commune: r.commune.nom, dept: r.commune.code_departement }))
      )
  }, [resultats, filtreCommune, filtreType])

  const taxesFiltrées = useMemo(() => {
    if (!resultats) return []
    return resultats
      .filter((r) => filtreCommune === 'toutes' || r.commune.nom === filtreCommune)
      .filter((r) => r.taxe !== null)
  }, [resultats, filtreCommune])

  // ── Vue synthèse hébergements groupés par commune ─────────────────────────

  const syntheseHebergements = useMemo(() => {
    if (!resultats) return []
    return resultats
      .filter((r) => filtreCommune === 'toutes' || r.commune.nom === filtreCommune)
      .map((r) => {
        const parType: Record<string, number> = {}
        for (const e of r.hebergements) {
          parType[e.sous_categorie] = (parType[e.sous_categorie] ?? 0) + 1
        }
        // Déduplication DATA Tourisme ↔ INSEE DS_TOUR_CAP par catégorie
        // Correspondance : DATA 'hotels' → INSEE I551, 'campings' → I552, reste → I553
        const data_hotels   = parType['hotels']   ?? 0
        const data_campings = parType['campings']  ?? 0
        const data_autres   = r.hebergements.length - data_hotels - data_campings

        const insee_hotels   = r.insee_cap?.hotels.nb_etab   ?? 0
        const insee_campings = r.insee_cap?.campings.nb_etab  ?? 0
        const insee_autres   = r.insee_cap?.autres_heb.nb_etab ?? 0

        const ded_hotels   = Math.max(data_hotels,   insee_hotels)
        const ded_campings = Math.max(data_campings, insee_campings)
        const ded_autres   = Math.max(data_autres,   insee_autres)
        const total_deduplique = ded_hotels + ded_campings + ded_autres

        return {
          nom: r.commune.nom,
          code_insee: r.commune.code_insee,
          dept: r.commune.code_departement,
          residences_secondaires: r.residences_secondaires,
          total: r.hebergements.length,
          parType,
          isbn_cap_chambres: r.insee_cap?.hotels.nb_chambres ?? 0,
          freq_departement: r.freq_departement,
          // Champs dédoublonnés
          data_hotels, data_campings, data_autres,
          insee_hotels, insee_campings, insee_autres,
          ded_hotels, ded_campings, ded_autres,
          total_deduplique,
          etablissements: r.hebergements.map((e) => ({ ...e, commune: r.commune.nom, dept: r.commune.code_departement })),
        }
      })
  }, [resultats, filtreCommune])

  // Fréquentation par département (dédoublonnée pour affichage groupé)
  const freqParDept = useMemo(() => {
    if (!resultats) return new Map<string, FrequentationINSEE>()
    const m = new Map<string, FrequentationINSEE>()
    for (const r of resultats) {
      if (r.freq_departement && !m.has(r.commune.code_departement)) {
        m.set(r.commune.code_departement, r.freq_departement)
      }
    }
    return m
  }, [resultats])

  // Synthèse triée selon la colonne sélectionnée
  const syntheseTriee = useMemo(() => {
    if (!sortColonne) return syntheseHebergements
    return [...syntheseHebergements].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      if (sortColonne === 'nom') { va = a.nom; vb = b.nom }
      else if (sortColonne === 'residences_secondaires') { va = a.residences_secondaires; vb = b.residences_secondaires }
      else if (sortColonne === 'total') { va = a.total; vb = b.total }
      else if (sortColonne === 'total_deduplique') { va = a.total_deduplique; vb = b.total_deduplique }
      else if (sortColonne === 'ded_hotels')   { va = a.ded_hotels;   vb = b.ded_hotels }
      else if (sortColonne === 'ded_campings') { va = a.ded_campings; vb = b.ded_campings }
      else if (sortColonne === 'ded_autres')   { va = a.ded_autres;   vb = b.ded_autres }
      // Nulls toujours en bas
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDirection === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
      }
      return sortDirection === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [syntheseHebergements, sortColonne, sortDirection])

  // Hébergements détail — triés
  const hebDetTriee = useMemo(() => {
    if (!sortHebDetCol) return hebergementsFiltrés
    return [...hebergementsFiltrés].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      if (sortHebDetCol === 'commune')       { va = a.commune;       vb = b.commune }
      else if (sortHebDetCol === 'nom')      { va = a.nom;           vb = b.nom }
      else if (sortHebDetCol === 'sous_categorie') { va = a.sous_categorie; vb = b.sous_categorie }
      else if (sortHebDetCol === 'capacite') { va = a.capacite;      vb = b.capacite }
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortHebDetDir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
      }
      return sortHebDetDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [hebergementsFiltrés, sortHebDetCol, sortHebDetDir])

  // POI détail — triés (toutes les colonnes triables sont des chaînes)
  const poiDetTriee = useMemo(() => {
    if (!sortPOIDetCol) return poiFiltrés
    return [...poiFiltrés].sort((a, b) => {
      let va: string | null = null
      let vb: string | null = null
      if (sortPOIDetCol === 'commune')             { va = a.commune;       vb = b.commune }
      else if (sortPOIDetCol === 'nom')            { va = a.nom;           vb = b.nom }
      else if (sortPOIDetCol === 'categorie')      { va = a.categorie;     vb = b.categorie }
      else if (sortPOIDetCol === 'sous_categorie') { va = a.sous_categorie; vb = b.sous_categorie }
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return sortPOIDetDir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
    })
  }, [poiFiltrés, sortPOIDetCol, sortPOIDetDir])

  // Taxe de séjour — triée
  const taxeTriee = useMemo(() => {
    if (!sortTaxeCol) return taxesFiltrées
    return [...taxesFiltrées].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      if (sortTaxeCol === 'commune')                  { va = a.commune.nom;                 vb = b.commune.nom }
      else if (sortTaxeCol === 'collecteur')          { va = a.taxe?.collecteur ?? null;     vb = b.taxe?.collecteur ?? null }
      else if (sortTaxeCol === 'nom_collecteur')      { va = a.taxe?.nom_collecteur ?? null; vb = b.taxe?.nom_collecteur ?? null }
      else if (sortTaxeCol === 'montant_total')       { va = a.taxe?.montant_total ?? null;  vb = b.taxe?.montant_total ?? null }
      else if (sortTaxeCol === 'montant_estime_commune') {
        // Pour les communes collectrices directes, montant_estime_commune est null → on utilise montant_total
        va = a.taxe?.montant_estime_commune ?? (a.taxe?.collecteur === 'commune' ? (a.taxe?.montant_total ?? null) : null)
        vb = b.taxe?.montant_estime_commune ?? (b.taxe?.collecteur === 'commune' ? (b.taxe?.montant_total ?? null) : null)
      }
      else if (sortTaxeCol === 'part_epci_pct')       { va = a.taxe?.part_epci_pct ?? null; vb = b.taxe?.part_epci_pct ?? null }
      else if (sortTaxeCol === 'annee')               { va = a.taxe?.annee ?? null;          vb = b.taxe?.annee ?? null }
      else if (sortTaxeCol === 'nuitees_estimees')    { va = a.taxe?.nuitees_estimees ?? null; vb = b.taxe?.nuitees_estimees ?? null }
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortTaxeDir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
      }
      return sortTaxeDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [taxesFiltrées, sortTaxeCol, sortTaxeDir])

  // Bascule tri : même colonne → inverse la direction, autre colonne → desc
  function trierPar(col: string) {
    if (sortColonne === col) {
      setSortDirection((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColonne(col)
      setSortDirection('desc')
    }
  }

  function IconTri({ col }: { col: string }) {
    if (sortColonne !== col) return <span className="ml-1 opacity-20">↕</span>
    return <span className="ml-1 opacity-70">{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  // Icône de tri générique (accepte les états de tri en props)
  function IconTriGen({ col, sortCol, sortDir }: { col: string; sortCol: string | null; sortDir: 'asc' | 'desc' }) {
    if (sortCol !== col) return <span className="ml-1 opacity-20">↕</span>
    return <span className="ml-1 opacity-70">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Bascule tri générique
  function trierHebDet(col: string) {
    if (sortHebDetCol === col) setSortHebDetDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortHebDetCol(col); setSortHebDetDir('desc') }
  }
  function trierPOISyn(col: string) {
    if (sortPOISynCol === col) setSortPOISynDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortPOISynCol(col); setSortPOISynDir('desc') }
  }
  function trierPOIDet(col: string) {
    if (sortPOIDetCol === col) setSortPOIDetDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortPOIDetCol(col); setSortPOIDetDir('desc') }
  }
  function trierTaxe(col: string) {
    if (sortTaxeCol === col) setSortTaxeDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortTaxeCol(col); setSortTaxeDir('desc') }
  }

  function toggleCommune(code_insee: string) {
    setCommunesOuvertes((prev) => {
      const copie = new Set(prev)
      if (copie.has(code_insee)) copie.delete(code_insee)
      else copie.add(code_insee)
      return copie
    })
  }

  // ── Types distincts pour les filtres ──────────────────────────────────────

  const typesFiltresHebergements = useMemo(() => {
    if (!resultats) return []
    const types = new Set(resultats.flatMap((r) => r.hebergements.map((e) => e.sous_categorie)))
    return Array.from(types).sort()
  }, [resultats])

  const typesFiltresPOI = useMemo(() => {
    if (!resultats) return []
    const cats = new Set(resultats.flatMap((r) => r.poi.map((e) => e.categorie)))
    return Array.from(cats).sort()
  }, [resultats])

  // Vue synthèse POI : une ligne par commune, une colonne par catégorie
  const synthesePOI = useMemo(() => {
    if (!resultats) return { lignes: [], categories: [] as string[] }
    const filtered = resultats.filter((r) => filtreCommune === 'toutes' || r.commune.nom === filtreCommune)
    const categories = [...new Set(filtered.flatMap((r) => r.poi.map((e) => e.categorie)))].sort()
    const lignes = filtered.map((r) => {
      const parCategorie: Record<string, number> = {}
      // Ventilation par sous-catégorie pour chaque catégorie (utilisée dans les tooltips)
      const parSousCategorie: Record<string, Record<string, number>> = {}
      for (const e of r.poi) {
        parCategorie[e.categorie] = (parCategorie[e.categorie] ?? 0) + 1
        if (!parSousCategorie[e.categorie]) parSousCategorie[e.categorie] = {}
        parSousCategorie[e.categorie][e.sous_categorie] = (parSousCategorie[e.categorie][e.sous_categorie] ?? 0) + 1
      }
      return {
        nom: r.commune.nom,
        code_insee: r.commune.code_insee,
        dept: r.commune.code_departement,
        total: r.poi.length,
        parCategorie,
        parSousCategorie,
      }
    })
    return { lignes, categories }
  }, [resultats, filtreCommune])

  // POI synthèse — lignes triées (doit être après synthesePOI)
  const synthPOITriee = useMemo(() => {
    const lignes = synthesePOI.lignes
    if (!sortPOISynCol) return lignes
    return [...lignes].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      if (sortPOISynCol === 'nom')        { va = a.nom;   vb = b.nom }
      else if (sortPOISynCol === 'total') { va = a.total; vb = b.total }
      else { va = a.parCategorie[sortPOISynCol] ?? 0; vb = b.parCategorie[sortPOISynCol] ?? 0 }
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortPOISynDir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
      }
      return sortPOISynDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [synthesePOI.lignes, sortPOISynCol, sortPOISynDir])

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exporterHebergements() {
    const lignes = hebergementsFiltrés.map((e) => ({
      Commune: e.commune,
      Département: e.dept,
      Nom: e.nom,
      Type: e.sous_categorie,
      Adresse: e.adresse ?? '',
      Code_postal: e.code_postal ?? '',
      Latitude: e.lat ?? '',
      Longitude: e.lng ?? '',
      Téléphone: e.telephone ?? '',
      Capacité: e.capacite ?? '',
    }))
    exporterCSV(lignes, `hebergements-territoire-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function exporterPOI() {
    const lignes = poiFiltrés.map((e) => ({
      Commune: e.commune,
      Département: e.dept,
      Nom: e.nom,
      Catégorie: e.categorie,
      Sous_catégorie: e.sous_categorie,
      Adresse: e.adresse ?? '',
      Code_postal: e.code_postal ?? '',
      Latitude: e.lat ?? '',
      Longitude: e.lng ?? '',
      Téléphone: e.telephone ?? '',
    }))
    exporterCSV(lignes, `poi-territoire-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function exporterTaxe() {
    const lignes = taxesFiltrées.map((r) => ({
      Commune: r.commune.nom,
      'Département': r.commune.code_departement,
      Collecteur: r.taxe?.collecteur ?? '',
      Nom_collecteur: r.taxe?.nom_collecteur ?? '',
      SIREN_collecteur: r.taxe?.siren_collecteur ?? '',
      'Montant_total_EUR': r.taxe?.montant_total ?? '',
      'Montant_estime_commune_EUR': r.taxe?.montant_estime_commune ?? '',
      'Part_EPCI_pct': r.taxe?.part_epci_pct ?? '',
      'Annee': r.taxe?.annee ?? '',
      'Nuitees_estimees': r.taxe?.nuitees_estimees ?? '',
    }))
    exporterCSV(lignes, `taxe-sejour-territoire-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-navy">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Analyse Territoire</h1>
          <p className="text-white/50 text-sm">
            Hébergements, POI touristiques et taxe de séjour pour une liste de communes
          </p>
        </div>

        {/* ── ÉTAPE 1 : Saisie ─────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-purple flex items-center justify-center text-xs text-white font-bold">1</span>
            Saisir les communes
          </h2>
          <p className="text-white/40 text-xs mb-3">
            Copiez-collez jusqu'à 50 communes, une par ligne
          </p>

          <textarea
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value)
              setValidation(null)
              setResultats(null)
            }}
            placeholder={"Annecy\nChamonix-Mont-Blanc\nMégève\nLes Deux Alpes"}
            className="w-full h-40 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 resize-none focus:outline-none focus:border-brand-purple transition-colors font-mono"
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-white/30 text-xs">
              {texte.split('\n').filter((l) => l.trim()).length} ligne(s)
            </span>
            <button
              onClick={validerCommunes}
              disabled={enValidation || texte.trim().length === 0}
              className="px-4 py-2 bg-brand-purple hover:bg-brand-purple/80 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {enValidation ? 'Validation...' : 'Valider les communes'}
            </button>
          </div>
        </div>

        {/* ── ÉTAPE 2 : Résultats de validation ────────────────────────────── */}
        {validation && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-purple flex items-center justify-center text-xs text-white font-bold">2</span>
              Vérification des communes
              <span className="ml-auto text-sm font-normal text-white/40">
                {communesConfirmees.length} confirmée(s) sur {validation.length}
              </span>
            </h2>

            <div className="space-y-2 mb-6 max-h-80 overflow-y-auto pr-1">
              {/* Tri par priorité d'action : invalide → ambigu → ok */}
              {[...validation.map((ligne, idx) => ({ ligne, idx }))]
                .sort((a, b) => {
                  const priorite = { invalide: 0, ambigu: 1, ok: 2 }
                  return priorite[a.ligne.statut] - priorite[b.ligne.statut]
                })
                .map(({ ligne, idx }) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 px-3 py-2 rounded-lg text-sm ${
                    ligne.statut === 'ok'
                      ? 'bg-green-950/30 border border-green-800/30'
                      : ligne.statut === 'ambigu'
                      ? 'bg-yellow-950/30 border border-yellow-800/30'
                      : 'bg-red-950/30 border border-red-800/30'
                  }`}
                >
                  <span className="text-white/70 min-w-[120px] truncate">{ligne.texte_original}</span>
                  <BadgeStatut statut={ligne.statut} />

                  {/* Commune unique reconnue */}
                  {ligne.statut === 'ok' && ligne.commune && (
                    <span className="text-white/40 text-xs ml-auto">
                      INSEE {ligne.commune.code_insee} · Dép. {ligne.commune.code_departement}
                    </span>
                  )}

                  {/* Ambiguïté — sélectionner */}
                  {ligne.statut === 'ambigu' && ligne.suggestions && (
                    <select
                      className="ml-auto text-xs bg-white/10 border border-white/20 text-white rounded px-2 py-0.5"
                      defaultValue=""
                      onChange={(e) => {
                        const c = ligne.suggestions?.find((s) => s.code_insee === e.target.value)
                        if (c) choisirCommune(idx, c)
                      }}
                    >
                      <option value="">Sélectionner...</option>
                      {ligne.suggestions.map((s) => (
                        <option key={s.code_insee} value={s.code_insee}>
                          {s.nom} ({s.code_departement})
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Inconnue — champ de correction + suggestions cliquables */}
                  {ligne.statut === 'invalide' && (
                    <div className="ml-auto flex flex-col items-end gap-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={lignesEnEdition[idx] ?? ligne.texte_original}
                          onChange={(e) => setLignesEnEdition((prev) => ({ ...prev, [idx]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') revaliderLigne(idx) }}
                          className="text-xs bg-white/10 border border-white/20 text-white rounded px-2 py-0.5 w-36 focus:outline-none focus:border-white/40"
                          placeholder="Corriger..."
                        />
                        <button
                          onClick={() => revaliderLigne(idx)}
                          disabled={lignesEnRevalidation[idx]}
                          className="text-xs text-white/50 hover:text-white border border-white/15 hover:border-white/30 rounded px-2 py-0.5 transition-colors disabled:opacity-40"
                        >
                          {lignesEnRevalidation[idx] ? '...' : 'Chercher'}
                        </button>
                      </div>
                      {ligne.suggestions && ligne.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {ligne.suggestions.map((s) => (
                            <button
                              key={s.code_insee}
                              onClick={() => choisirCommune(idx, s)}
                              className="text-xs text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-1.5 py-0.5 transition-colors"
                            >
                              {s.nom} ({s.code_departement})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-xs text-white/40">
                <span className="text-green-400">{validation.filter((l) => l.statut === 'ok').length} ok</span>

                <span className="text-yellow-400">{validation.filter((l) => l.statut === 'ambigu').length} ambiguës</span>
                <span className="text-red-400">{validation.filter((l) => l.statut === 'invalide').length} inconnues</span>
              </div>

              <button
                onClick={lancerAnalyse}
                disabled={enAnalyse || communesConfirmees.length === 0}
                className="px-5 py-2 bg-brand-orange hover:bg-brand-orange/80 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {enAnalyse
                  ? 'Analyse en cours...'
                  : `Analyser ${communesConfirmees.length} commune${communesConfirmees.length > 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>
        )}

        {/* Spinner analyse */}
        {enAnalyse && (
          <div className="flex items-center justify-center gap-3 py-12 text-white/50">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Récupération des données pour {communesConfirmees.length} communes...
          </div>
        )}

        {/* ── ÉTAPE 3 : Résultats ──────────────────────────────────────────── */}
        {resultats && !enAnalyse && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">

            {/* Barre d'onglets + filtres */}
            <div className="flex items-center border-b border-white/10 px-6 py-0 gap-1 flex-wrap">
              {(
                [
                  { key: 'hebergements', label: `Hébergements (${resultats.reduce((s, r) => s + r.hebergements.length, 0)})` },
                  { key: 'poi', label: `POI Touristiques (${resultats.reduce((s, r) => s + r.poi.length, 0)})` },
                  { key: 'taxe', label: `Taxe de séjour (${resultats.length} communes)` },
                ] as { key: Onglet; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setOnglet(key)
                    setFiltreType('tous')
                  }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    onglet === key
                      ? 'border-brand-purple text-white'
                      : 'border-transparent text-white/40 hover:text-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Filtres */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-white/5 flex-wrap">
              <select
                value={filtreCommune}
                onChange={(e) => setFiltreCommune(e.target.value)}
                className="text-xs bg-white/10 border border-white/15 text-white/80 rounded px-2 py-1"
              >
                <option value="toutes">Toutes les communes</option>
                {communesDisponibles.map((nom) => (
                  <option key={nom} value={nom}>{nom}</option>
                ))}
              </select>

              {onglet === 'hebergements' && (
                <>
                  {/* Toggle synthèse / détail */}
                  <div className="flex items-center gap-0 border border-white/15 rounded overflow-hidden text-xs">
                    <button
                      onClick={() => setModeVueHeb('synthese')}
                      className={`px-3 py-1 transition-colors ${modeVueHeb === 'synthese' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Synthèse
                    </button>
                    <button
                      onClick={() => setModeVueHeb('detail')}
                      className={`px-3 py-1 transition-colors ${modeVueHeb === 'detail' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Détail
                    </button>
                  </div>

                  {modeVueHeb === 'detail' && typesFiltresHebergements.length > 0 && (
                    <select
                      value={filtreType}
                      onChange={(e) => setFiltreType(e.target.value)}
                      className="text-xs bg-white/10 border border-white/15 text-white/80 rounded px-2 py-1"
                    >
                      <option value="tous">Tous les types</option>
                      {typesFiltresHebergements.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  )}
                </>
              )}

              {onglet === 'poi' && (
                <>
                  {/* Toggle synthèse / détail */}
                  <div className="flex items-center gap-0 border border-white/15 rounded overflow-hidden text-xs">
                    <button
                      onClick={() => setModeVuePOI('synthese')}
                      className={`px-3 py-1 transition-colors ${modeVuePOI === 'synthese' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Synthèse
                    </button>
                    <button
                      onClick={() => setModeVuePOI('detail')}
                      className={`px-3 py-1 transition-colors ${modeVuePOI === 'detail' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Détail
                    </button>
                  </div>

                  {modeVuePOI === 'detail' && typesFiltresPOI.length > 0 && (
                    <select
                      value={filtreType}
                      onChange={(e) => setFiltreType(e.target.value)}
                      className="text-xs bg-white/10 border border-white/15 text-white/80 rounded px-2 py-1"
                    >
                      <option value="tous">Toutes les catégories</option>
                      {typesFiltresPOI.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  )}
                </>
              )}

              {/* Bouton export */}
              <button
                onClick={
                  onglet === 'hebergements' ? exporterHebergements
                  : onglet === 'poi' ? exporterPOI
                  : exporterTaxe
                }
                className="ml-auto flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-white/15 hover:border-white/30 rounded px-3 py-1 transition-colors"
              >
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Export CSV
              </button>
            </div>

            {/* ── Hébergements — Vue Synthèse (groupée par commune) ─────────── */}
            {onglet === 'hebergements' && modeVueHeb === 'synthese' && (
              <div className="overflow-x-auto">
                {syntheseHebergements.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucun hébergement trouvé</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs border-b border-white/5">
                        <th className="text-left px-4 py-3 font-medium w-8"></th>
                        <th
                          className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none"
                          onClick={() => trierPar('nom')}
                        >Commune<IconTri col="nom" /></th>
                        <th
                          className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none"
                          onClick={() => trierPar('residences_secondaires')}
                        >Rés. secondaires<IconTri col="residences_secondaires" /></th>
                        <th
                          className="text-center px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none"
                          onClick={() => trierPar('total_deduplique')}
                        >Hébergements référencés<IconTri col="total_deduplique" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {syntheseTriee.map((c, i) => (
                        <>
                          {/* Ligne résumé commune */}
                          <tr
                            key={`synthese-${c.code_insee}`}
                            onClick={() => toggleCommune(c.code_insee)}
                            className={`border-b border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                          >
                            <td className="px-4 py-2.5 text-white/30 text-xs">
                              <svg viewBox="0 0 20 20" className={`w-3.5 h-3.5 transition-transform ${communesOuvertes.has(c.code_insee) ? 'rotate-90' : ''}`} fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </td>
                            <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                              {c.nom}
                              <span className="ml-2 text-white/30 text-xs font-normal">{c.dept}</span>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              {c.residences_secondaires !== null ? (
                                <span className="text-amber-300 font-medium">
                                  {new Intl.NumberFormat('fr-FR').format(c.residences_secondaires)}
                                </span>
                              ) : (
                                <span className="text-white/25 text-xs">—</span>
                              )}
                            </td>
                            {/* Hébergements référencés — total dédoublonné DATA+INSEE avec tooltip */}
                            <td className="px-4 py-2.5 text-center">
                              <div className="relative inline-block group">
                                <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 bg-brand-purple/30 text-brand-purple-light text-xs font-semibold rounded cursor-default">
                                  {c.total_deduplique}
                                </span>
                                {/* Tooltip au survol — s'affiche en dessous pour rester dans le flux du tableau */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 hidden group-hover:block pointer-events-none">
                                  {/* Flèche pointant vers le haut */}
                                  <div className="w-2 h-2 bg-gray-900 border-l border-t border-white/15 rotate-45 mx-auto -mb-px relative z-10"></div>
                                  <div className="bg-gray-900 border border-white/15 rounded-lg p-3 text-xs whitespace-nowrap shadow-xl min-w-[220px]">
                                    <div className="text-white/40 font-medium mb-2 uppercase tracking-wide text-[10px]">Détail par source</div>
                                    {/* Ligne d'en-tête */}
                                    <div className="grid grid-cols-4 gap-2 text-white/30 text-[10px] mb-1 pb-1 border-b border-white/10">
                                      <span></span>
                                      <span className="text-center">DATA</span>
                                      <span className="text-center">INSEE</span>
                                      <span className="text-center font-medium text-white/60">Retenu</span>
                                    </div>
                                    {/* Hôtels */}
                                    <div className="grid grid-cols-4 gap-2 items-center py-0.5">
                                      <span className="text-white/60">Hôtels</span>
                                      <span className="text-center text-white/50">{c.data_hotels}</span>
                                      <span className="text-center text-cyan-400/70">{c.insee_hotels > 0 ? c.insee_hotels : '—'}</span>
                                      <span className={`text-center font-semibold ${c.ded_hotels > 0 ? 'text-white' : 'text-white/30'}`}>{c.ded_hotels}</span>
                                    </div>
                                    {/* Campings */}
                                    <div className="grid grid-cols-4 gap-2 items-center py-0.5">
                                      <span className="text-white/60">Campings</span>
                                      <span className="text-center text-white/50">{c.data_campings}</span>
                                      <span className="text-center text-cyan-400/70">{c.insee_campings > 0 ? c.insee_campings : '—'}</span>
                                      <span className={`text-center font-semibold ${c.ded_campings > 0 ? 'text-white' : 'text-white/30'}`}>{c.ded_campings}</span>
                                    </div>
                                    {/* Autres */}
                                    <div className="grid grid-cols-4 gap-2 items-center py-0.5">
                                      <span className="text-white/60">Autres</span>
                                      <span className="text-center text-white/50">{c.data_autres}</span>
                                      <span className="text-center text-cyan-400/70">{c.insee_autres > 0 ? c.insee_autres : '—'}</span>
                                      <span className={`text-center font-semibold ${c.ded_autres > 0 ? 'text-white' : 'text-white/30'}`}>{c.ded_autres}</span>
                                    </div>
                                    {/* Total */}
                                    <div className="grid grid-cols-4 gap-2 items-center pt-1 mt-1 border-t border-white/10">
                                      <span className="text-white/40 text-[10px]">Total</span>
                                      <span className="text-center text-white/50">{c.total}</span>
                                      <span className="text-center text-cyan-400/70">{c.isbn_cap_chambres > 0 ? `${c.isbn_cap_chambres}ch.` : '—'}</span>
                                      <span className="text-center font-bold text-brand-purple-light">{c.total_deduplique}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Lignes détail si commune ouverte (4 colonnes) */}
                          {communesOuvertes.has(c.code_insee) && c.etablissements.map((e) => (
                            <tr key={`detail-${c.code_insee}-${e.uuid}`} className="border-b border-white/[0.03] bg-white/[0.04]">
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 text-white/50 text-xs pl-8 max-w-[200px] truncate">{e.nom}</td>
                              <td className="px-4 py-2 text-xs">
                                <span className="bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-full">{e.sous_categorie}</span>
                                {e.telephone && <span className="ml-2 text-white/30">{e.telephone}</span>}
                              </td>
                              <td className="px-4 py-2 text-white/30 text-xs">
                                {e.adresse ?? '—'}
                                {e.capacite !== null && <span className="ml-2 text-white/40">{e.capacite} places</span>}
                              </td>
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Fréquentation touristique par département (DS_TOUR_FREQ) ─── */}
            {onglet === 'hebergements' && modeVueHeb === 'synthese' && freqParDept.size > 0 && (
              <div className="px-6 py-4 border-t border-white/5">
                <p className="text-white/40 text-xs font-medium mb-3 uppercase tracking-wide">
                  Fréquentation touristique — données INSEE DS_TOUR_FREQ (département)
                </p>
                <div className="flex flex-wrap gap-3">
                  {Array.from(freqParDept.entries()).map(([dept, freq]) => (
                    <div key={dept} className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-3 min-w-[200px]">
                      <div className="text-white/50 text-xs mb-2">Département {dept} · {freq.annee}</div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-baseline gap-4">
                          <span className="text-white/40 text-xs">Nuitées totales</span>
                          <span className="text-cyan-300 text-sm font-semibold">
                            {new Intl.NumberFormat('fr-FR').format(freq.nuitees_total)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline gap-4">
                          <span className="text-white/30 text-xs">dont hôtels (I551)</span>
                          <span className="text-white/60 text-xs">
                            {new Intl.NumberFormat('fr-FR').format(freq.nuitees_hotels)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline gap-4">
                          <span className="text-white/30 text-xs">dont autres héb. (I553)</span>
                          <span className="text-white/60 text-xs">
                            {new Intl.NumberFormat('fr-FR').format(freq.nuitees_autres)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Hébergements — Vue Détail (liste plate) ──────────────────── */}
            {onglet === 'hebergements' && modeVueHeb === 'detail' && (
              <div className="overflow-x-auto">
                {hebergementsFiltrés.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucun hébergement trouvé</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs border-b border-white/5">
                        {([
                          { label: 'Commune',   col: 'commune' },
                          { label: 'Nom',       col: 'nom' },
                          { label: 'Type',      col: 'sous_categorie' },
                          { label: 'Adresse',   col: null },
                          { label: 'Téléphone', col: null },
                          { label: 'Capacité',  col: 'capacite' },
                          { label: 'GPS',       col: null },
                        ] as { label: string; col: string | null }[]).map(({ label, col }) =>
                          col ? (
                            <th key={label} className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierHebDet(col)}>
                              {label}<IconTriGen col={col} sortCol={sortHebDetCol} sortDir={sortHebDetDir} />
                            </th>
                          ) : (
                            <th key={label} className="text-left px-4 py-3 font-medium whitespace-nowrap">{label}</th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {hebDetTriee.map((e, i) => (
                        <tr key={`${e.commune}-${e.uuid}`} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                          <td className="px-4 py-2.5 text-white/70 whitespace-nowrap">{e.commune}</td>
                          <td className="px-4 py-2.5 text-white font-medium max-w-[200px] truncate">{e.nom}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">{e.sous_categorie}</span>
                          </td>
                          <td className="px-4 py-2.5 text-white/50 text-xs max-w-[180px] truncate">{e.adresse ?? '—'}</td>
                          <td className="px-4 py-2.5 text-white/50 text-xs whitespace-nowrap">{e.telephone ?? '—'}</td>
                          <td className="px-4 py-2.5 text-white/70 text-xs text-center">{e.capacite ?? '—'}</td>
                          <td className="px-4 py-2.5 text-white/30 text-xs whitespace-nowrap">
                            {e.lat && e.lng ? `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── POI — Vue Synthèse (une ligne par commune, colonnes = catégories) ── */}
            {onglet === 'poi' && modeVuePOI === 'synthese' && (
              <div className="overflow-x-auto">
                {synthesePOI.lignes.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucun POI trouvé</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs border-b border-white/5">
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPOISyn('nom')}>
                          Commune<IconTriGen col="nom" sortCol={sortPOISynCol} sortDir={sortPOISynDir} />
                        </th>
                        <th className="text-center px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPOISyn('total')}>
                          Total<IconTriGen col="total" sortCol={sortPOISynCol} sortDir={sortPOISynDir} />
                        </th>
                        {synthesePOI.categories.map((cat) => (
                          <th key={cat} className="text-center px-4 py-3 font-medium whitespace-nowrap capitalize cursor-pointer hover:text-white/70 select-none" onClick={() => trierPOISyn(cat)}>
                            {cat}<IconTriGen col={cat} sortCol={sortPOISynCol} sortDir={sortPOISynDir} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {synthPOITriee.map((c, i) => (
                        <tr key={c.code_insee} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                          <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                            {c.nom}
                            <span className="ml-2 text-white/30 text-xs font-normal">{c.dept}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 bg-white/10 text-white/80 text-xs font-semibold rounded">
                              {c.total}
                            </span>
                          </td>
                          {synthesePOI.categories.map((cat) => {
                            const n = c.parCategorie[cat] ?? 0
                            const couleur =
                              cat === 'activites'  ? 'bg-emerald-900/40 text-emerald-300' :
                              cat === 'culture'    ? 'bg-purple-900/40 text-purple-300'   :
                              cat === 'services'   ? 'bg-amber-900/40 text-amber-300'     :
                                                     'bg-blue-900/40 text-blue-300'
                            // Sous-catégories triées par nombre décroissant pour le tooltip
                            const sousCategories = Object.entries(c.parSousCategorie[cat] ?? {})
                              .sort((a, b) => b[1] - a[1])
                            return (
                              <td key={cat} className="px-4 py-2.5 text-center">
                                {n > 0 ? (
                                  <div className="relative inline-block group">
                                    <span className={`inline-flex items-center justify-center min-w-[2rem] h-6 px-2 text-xs font-semibold rounded cursor-default ${couleur}`}>
                                      {n}
                                    </span>
                                    {/* Tooltip détail sous-catégories — s'affiche en dessous */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 hidden group-hover:block pointer-events-none">
                                      <div className="w-2 h-2 bg-gray-900 border-l border-t border-white/15 rotate-45 mx-auto -mb-px relative z-10"></div>
                                      <div className="bg-gray-900 border border-white/15 rounded-lg p-3 text-xs whitespace-nowrap shadow-xl min-w-[160px]">
                                        <div className="text-white/40 font-medium mb-2 uppercase tracking-wide text-[10px] capitalize">{cat}</div>
                                        <div className="space-y-1">
                                          {sousCategories.map(([sc, count]) => (
                                            <div key={sc} className="flex items-center justify-between gap-3">
                                              <span className="text-white/60">{sc}</span>
                                              <span className="font-semibold text-white/90">{count}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-white/20 text-xs">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      {/* Ligne total bas de tableau */}
                      <tr className="border-t border-white/10 bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-white/40 text-xs font-medium">Total</td>
                        <td className="px-4 py-2.5 text-center text-white/60 text-xs font-semibold">
                          {synthesePOI.lignes.reduce((s, c) => s + c.total, 0)}
                        </td>
                        {synthesePOI.categories.map((cat) => (
                          <td key={cat} className="px-4 py-2.5 text-center text-white/50 text-xs font-semibold">
                            {synthesePOI.lignes.reduce((s, c) => s + (c.parCategorie[cat] ?? 0), 0)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── POI — Vue Détail (liste plate) ────────────────────────────── */}
            {onglet === 'poi' && modeVuePOI === 'detail' && (
              <div className="overflow-x-auto">
                {poiFiltrés.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucun POI trouvé</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs border-b border-white/5">
                        {([
                          { label: 'Commune',   col: 'commune' },
                          { label: 'Nom',       col: 'nom' },
                          { label: 'Catégorie', col: 'categorie' },
                          { label: 'Type',      col: 'sous_categorie' },
                          { label: 'Adresse',   col: null },
                          { label: 'Téléphone', col: null },
                          { label: 'GPS',       col: null },
                        ] as { label: string; col: string | null }[]).map(({ label, col }) =>
                          col ? (
                            <th key={label} className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPOIDet(col)}>
                              {label}<IconTriGen col={col} sortCol={sortPOIDetCol} sortDir={sortPOIDetDir} />
                            </th>
                          ) : (
                            <th key={label} className="text-left px-4 py-3 font-medium whitespace-nowrap">{label}</th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {poiDetTriee.map((e, i) => (
                        <tr key={`${e.commune}-${e.uuid}`} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                          <td className="px-4 py-2.5 text-white/70 whitespace-nowrap">{e.commune}</td>
                          <td className="px-4 py-2.5 text-white font-medium max-w-[200px] truncate">{e.nom}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              e.categorie === 'activites' ? 'bg-emerald-900/40 text-emerald-300' :
                              e.categorie === 'culture'   ? 'bg-purple-900/40 text-purple-300'   :
                              e.categorie === 'services'  ? 'bg-amber-900/40 text-amber-300'     :
                                                            'bg-blue-900/40 text-blue-300'
                            }`}>{e.categorie}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{e.sous_categorie}</span>
                          </td>
                          <td className="px-4 py-2.5 text-white/50 text-xs max-w-[180px] truncate">{e.adresse ?? '—'}</td>
                          <td className="px-4 py-2.5 text-white/50 text-xs whitespace-nowrap">{e.telephone ?? '—'}</td>
                          <td className="px-4 py-2.5 text-white/30 text-xs whitespace-nowrap">
                            {e.lat && e.lng ? `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── Tableau Taxe de séjour ────────────────────────────────────── */}
            {onglet === 'taxe' && (
              <div className="overflow-x-auto">
                {taxesFiltrées.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucune donnée de taxe</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs border-b border-white/5">
                        {([
                          ['Commune',        'commune'],
                          ['Collecteur',     'collecteur'],
                          ['Nom collecteur', 'nom_collecteur'],
                          ['Montant total',  'montant_total'],
                          ['Estimé commune', 'montant_estime_commune'],
                        ] as [string, string][]).map(([label, col]) => (
                          <th key={label} className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierTaxe(col)}>
                            {label}<IconTriGen col={col} sortCol={sortTaxeCol} sortDir={sortTaxeDir} />
                          </th>
                        ))}
                        {/* Colonne Part EPCI avec tooltip formule */}
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierTaxe('part_epci_pct')}>
                          <span className="inline-flex items-center gap-1">
                            Part EPCI
                            <IconTriGen col="part_epci_pct" sortCol={sortTaxeCol} sortDir={sortTaxeDir} />
                            <div className="relative inline-block group">
                              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white/15 text-white/50 text-[9px] font-bold cursor-default leading-none">i</span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 hidden group-hover:block pointer-events-none">
                                <div className="w-2 h-2 bg-gray-900 border-l border-t border-white/15 rotate-45 mx-auto -mb-px relative z-10"></div>
                                <div className="bg-gray-900 border border-white/15 rounded-lg p-3 text-xs shadow-xl min-w-[260px] whitespace-normal">
                                  <div className="text-white/40 font-medium mb-2 uppercase tracking-wide text-[10px]">Formule de calcul — prorata EPCI</div>
                                  <div className="text-white/70 leading-relaxed mb-2">
                                    Quand l'EPCI collecte la taxe, la part de la commune est estimée au prorata :
                                  </div>
                                  {/* Méthode résidences secondaires */}
                                  <div className="mb-2">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                                      <span className="text-emerald-400/90 text-[10px] font-medium">Résidences secondaires (prioritaire)</span>
                                    </div>
                                    <div className="bg-white/5 rounded px-2 py-1.5 font-mono text-[10px] text-cyan-300 leading-relaxed">
                                      part = rés_sec_commune / rés_sec_EPCI<br />
                                      estimé = montant_EPCI × part
                                    </div>
                                  </div>
                                  {/* Fallback population */}
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 flex-shrink-0"></span>
                                      <span className="text-amber-400/70 text-[10px] font-medium">Population permanente (fallback)</span>
                                    </div>
                                    <div className="bg-white/5 rounded px-2 py-1.5 font-mono text-[10px] text-white/40 leading-relaxed">
                                      part = pop_commune / pop_EPCI<br />
                                      estimé = montant_EPCI × part
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </span>
                        </th>
                        {([
                          ['Année',        'annee'],
                          ['Nuitées est.', 'nuitees_estimees'],
                        ] as [string, string][]).map(([label, col]) => (
                          <th key={label} className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierTaxe(col)}>
                            {label}<IconTriGen col={col} sortCol={sortTaxeCol} sortDir={sortTaxeDir} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {taxeTriee.map((r, i) => (
                        <tr key={r.commune.code_insee} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                          <td className="px-4 py-2.5 text-white/70 whitespace-nowrap">{r.commune.nom}</td>
                          <td className="px-4 py-2.5">
                            {r.taxe?.collecteur === 'commune' && (
                              <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded-full">Commune</span>
                            )}
                            {r.taxe?.collecteur === 'epci' && (
                              <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">EPCI</span>
                            )}
                            {r.taxe?.collecteur === 'non_institue' && (
                              <span className="text-xs bg-white/10 text-white/40 px-2 py-0.5 rounded-full">Non institué</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-white/60 text-xs max-w-[180px] truncate">{r.taxe?.nom_collecteur ?? '—'}</td>
                          <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                            {r.taxe?.montant_total ? formaterMontant(r.taxe.montant_total) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-white/70 whitespace-nowrap">
                            {r.taxe?.montant_estime_commune !== null && r.taxe?.montant_estime_commune !== undefined
                              ? formaterMontant(r.taxe.montant_estime_commune)
                              : r.taxe?.collecteur === 'commune' && r.taxe?.montant_total
                              ? (
                                <span className="flex items-center gap-1.5">
                                  {formaterMontant(r.taxe.montant_total)}
                                  <span title="Montant réel — la commune est le collecteur direct" className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                                </span>
                              )
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {r.taxe?.part_epci_pct !== null && r.taxe?.part_epci_pct !== undefined ? (
                              <span className="flex items-center gap-1.5">
                                <span className="text-white/50">{r.taxe.part_epci_pct}%</span>
                                {r.taxe.methode_part === 'residences_secondaires' && (
                                  <span className="relative group/dot flex-shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block cursor-help"></span>
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-zinc-800 border border-white/10 text-white/80 text-xs rounded-lg px-3 py-2 opacity-0 group-hover/dot:opacity-100 transition-opacity z-50 shadow-xl leading-relaxed whitespace-normal">
                                      Prorata calculé via résidences secondaires INSEE RP 2022
                                    </span>
                                  </span>
                                )}
                                {r.taxe.methode_part === 'rs_hybride' && (
                                  <span className="relative group/dot flex-shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80 block cursor-help"></span>
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-zinc-800 border border-sky-400/20 text-white/80 text-xs rounded-lg px-3 py-2 opacity-0 group-hover/dot:opacity-100 transition-opacity z-50 shadow-xl leading-relaxed whitespace-normal">
                                      <span className="text-sky-300 font-semibold block mb-1">Prorata hybride RS + population</span>
                                      RS connues pour certaines communes de l&apos;EPCI (calculé sur toutes les communes, même hors sélection). La part non couverte par des RS est distribuée au prorata de la population permanente.
                                    </span>
                                  </span>
                                )}
                                {r.taxe.methode_part === 'population' && (
                                  <span className="relative group/dot flex-shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 block cursor-help"></span>
                                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-zinc-800 border border-amber-400/20 text-white/80 text-xs rounded-lg px-3 py-2 opacity-0 group-hover/dot:opacity-100 transition-opacity z-50 shadow-xl leading-relaxed whitespace-normal">
                                      <span className="text-amber-400 font-semibold block mb-1">Fallback population</span>
                                      {r.residences_secondaires === null
                                        ? <>Résidences secondaires INSEE RP 2022 absentes pour <strong>{r.commune.nom}</strong> — commune non couverte par le dataset Mélodi.</>
                                        : <>RS commune connue ({r.residences_secondaires.toLocaleString('fr-FR')} logements) mais RS de l&apos;EPCI absentes dans Mélodi — ratio par population utilisé à la place.</>
                                      }
                                    </span>
                                  </span>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-white/50 text-xs">{r.taxe?.annee ?? '—'}</td>
                          <td className="px-4 py-2.5 text-white/50 text-xs whitespace-nowrap">
                            {r.taxe?.nuitees_estimees
                              ? new Intl.NumberFormat('fr-FR').format(r.taxe.nuitees_estimees)
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── Analyse GPT — moteurs du territoire ────────────────────────── */}
        {resultats && !enAnalyse && (
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white font-semibold text-base">Analyse IA du territoire</h3>
                <p className="text-white/40 text-xs mt-0.5">Identification des communes moteurs, spécialisations et maturité touristique — validé par recherche en ligne</p>
              </div>
              <button
                onClick={lancerAnalyseGPT}
                disabled={enAnalyseGPT}
                className="flex-shrink-0 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enAnalyseGPT ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyse en cours...
                  </span>
                ) : analyseGPT ? 'Relancer l\'analyse' : 'Lancer l\'analyse'}
              </button>
            </div>

            {/* Erreur */}
            {erreurAnalyseGPT && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">{erreurAnalyseGPT}</p>
            )}

            {/* Résultat */}
            {analyseGPT && (
              <div className="space-y-5">

                {/* Synthèse narrative */}
                <div className="bg-white/3 border border-white/8 rounded-lg p-4">
                  <p className="text-white/70 text-sm leading-relaxed">{analyseGPT.synthese}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Communes moteurs */}
                  <div className="bg-white/3 border border-white/8 rounded-lg p-4">
                    <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Communes moteurs</h4>
                    <ul className="space-y-2">
                      {analyseGPT.communes_moteurs.map((c, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                          <div>
                            <span className="text-white text-sm font-medium">{c.nom}</span>
                            <p className="text-white/40 text-xs mt-0.5">{c.raison}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Maturité + spécialisations */}
                  <div className="space-y-3">
                    {/* Maturité */}
                    <div className="bg-white/3 border border-white/8 rounded-lg p-4">
                      <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Maturité touristique</h4>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          analyseGPT.maturite_touristique.niveau === 'très fort' ? 'bg-emerald-500/20 text-emerald-300' :
                          analyseGPT.maturite_touristique.niveau === 'fort' ? 'bg-blue-500/20 text-blue-300' :
                          analyseGPT.maturite_touristique.niveau === 'intermédiaire' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-white/10 text-white/50'
                        }`}>
                          {analyseGPT.maturite_touristique.niveau}
                        </span>
                      </div>
                      <p className="text-white/40 text-xs">{analyseGPT.maturite_touristique.justification}</p>
                    </div>
                    {/* Spécialisations */}
                    <div className="bg-white/3 border border-white/8 rounded-lg p-4">
                      <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Spécialisations</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analyseGPT.specialisations.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white/8 border border-white/10 rounded-full text-white/60 text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Communes sous-exploitées */}
                {analyseGPT.communes_sous_exploitees.length > 0 && (
                  <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-4">
                    <h4 className="text-amber-300/70 text-xs font-semibold uppercase tracking-wider mb-3">Potentiel sous-exploité</h4>
                    <ul className="space-y-1.5">
                      {analyseGPT.communes_sous_exploitees.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-amber-400/60 mt-0.5">→</span>
                          <span><span className="text-white/70 font-medium">{c.nom}</span> <span className="text-white/40 text-xs">— {c.potentiel}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* État initial — pas encore lancé */}
            {!analyseGPT && !enAnalyseGPT && !erreurAnalyseGPT && (
              <p className="text-white/25 text-sm text-center py-4">Cliquez sur "Lancer l'analyse" pour obtenir une synthèse IA du territoire sélectionné</p>
            )}
          </div>

        )}
      </div>
    </div>
  )
}
