'use client'
// Composant principal de la page Territoire
// Flux : saisie textarea → validation communes → analyse → résultats en 3 onglets + export CSV

import { useState, useMemo, useEffect, useRef } from 'react'
import type { LigneResultat, CommuneValidee } from '@/app/api/territoire/valider/route'
import type { LocalitesCommune } from '@/app/api/territoire/localites/route'

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
  source: 'datatourisme' | 'tourinsoft' | 'apidae'
  localite_apidae?: string | null
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

interface ResultatAirbnb {
  total_annonces: number
  nb_requetes: number
  nb_zones: number
  duree_ms: number
  erreur?: string
}

interface ResultatBooking {
  total_proprietes: number
  detail: { hotels: number; apparts: number; campings: number; bb: number; villas: number }
  duree_ms: number
  erreur?: string
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
  airbnb: ResultatAirbnb | null
  booking: ResultatBooking | null
  erreur?: string
}

// Ligne de validation enrichie avec la sélection utilisateur
interface LigneValidation extends LigneResultat {
  commune_choisie?: CommuneValidee  // si ambigu, commune sélectionnée par l'utilisateur
}

type Onglet = 'hebergements' | 'poi' | 'taxe' | 'apidae' | 'tourinsoft' | 'fusion'

// Type d'un objet dans la vue unifiée Apidae × Tourinsoft
interface ItemFusion {
  id: string
  nom: string
  commune_admin: string
  cat_unif: string       // catégorie dans le référentiel unifié (ex: "Hébergements")
  souscat_unif: string   // sous-catégorie unifiée (ex: "Hôtellerie")
  sources: ('apidae' | 'tourinsoft')[]
  adresse: string | null
  code_postal: string | null
  telephone: string | null
  capacite: number | null
  lat: number | null
  lng: number | null
  nom_apidae?: string      // noms originaux si différents (affiché dans le détail)
  nom_tourinsoft?: string
}

interface PaireDoublon {
  id: string               // "${apidaeUuid}|${tourinUuid}"
  nom_apidae: string
  nom_tourinsoft: string
  commune_admin: string
  cat_unif: string
}

// ─── Fonctions pures de déduplication et mapping (module-level) ───────────────

function normaliserPourDedup(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 4) return 99
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const next = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = dp[j]
      dp[j] = next
    }
  }
  return dp[b.length]
}

function nomsSimilaires(a: string, b: string): boolean {
  const na = normaliserPourDedup(a)
  const nb = normaliserPourDedup(b)
  if (na === nb) return true
  const minLen = Math.min(na.length, nb.length)
  if (minLen < 4) return false
  if (minLen >= 6 && (na.includes(nb) || nb.includes(na))) return true
  return levenshtein(na, nb) <= Math.max(1, Math.floor(minLen * 0.2))
}

// Retourne la catégorie et sous-catégorie dans le référentiel unifié
function getCatUnif(source: string, categorie: string, sous_categorie: string): { cat: string; sousCat: string } {
  if (source === 'apidae') {
    if (categorie === 'hebergements') {
      const m: Record<string, string> = {
        hotels: 'Hôtellerie',
        chambres_hotes: 'Hébergements locatifs',
        locations: 'Hébergements locatifs',
        residences: 'Villages vacances · Résidences',
        collectifs: 'Villages vacances · Résidences',
        campings: 'Camping · Plein air',
        autres: 'Autres hébergements',
      }
      return { cat: 'Hébergements', sousCat: m[sous_categorie] ?? sous_categorie }
    }
    if (categorie === 'activites') {
      const m: Record<string, string> = {
        sports_hiver: 'Sports d\'hiver',
        cyclisme: 'Cyclisme · VTT',
        randonnee: 'Randonnée · Trail',
        equitation: 'Équitation',
        sports_eau: 'Sports aquatiques',
        grimpe_escalade: 'Grimpe · Escalade',
        culturel: 'Culturel',
        sports_loisirs: 'Sports & Loisirs',
      }
      return { cat: 'Activités & Sports', sousCat: m[sous_categorie] ?? sous_categorie }
    }
    if (categorie === 'equipements') {
      const m: Record<string, string> = {
        piscines: 'Piscines · Baignade',
        culture: 'Culture',
        itineraires: 'Itinéraires · Circuits',
        grimpe_escalade: 'Grimpe · Escalade',
        salles: 'Salles · Réceptions',
        equipement: 'Équipements divers',
      }
      return { cat: 'Équipements & Loisirs', sousCat: m[sous_categorie] ?? sous_categorie }
    }
  }
  if (source === 'tourinsoft') {
    const m: Record<string, { cat: string; sousCat: string }> = {
      'h_tellerie':                   { cat: 'Hébergements',         sousCat: 'Hôtellerie' },
      'h_bergements_locatifs':        { cat: 'Hébergements',         sousCat: 'Hébergements locatifs' },
      'villages_vacances':            { cat: 'Hébergements',         sousCat: 'Villages vacances · Résidences' },
      'h_tellerie_de_plein_air':      { cat: 'Hébergements',         sousCat: 'Camping · Plein air' },
      'activit_s_sportives__culturelles_et_formules_itin_rantes':
                                      { cat: 'Activités & Sports',   sousCat: 'Activités & Sports' },
      'equipements_de_loisirs':       { cat: 'Équipements & Loisirs',sousCat: 'Équipements & Loisirs' },
      'commerce':                     { cat: 'Commerces & Services',  sousCat: 'Commerces & Services' },
    }
    return m[sous_categorie] ?? { cat: categorie, sousCat: sous_categorie }
  }
  return { cat: categorie, sousCat: sous_categorie }
}

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
  // ── Filtres Vue Apidae — multi-sélection ──────────────────────────────────
  // Set vide = "tout inclus" (pas de filtre actif)
  const [apidaeFiltresCommunes, setApidaeFiltresCommunes] = useState<Set<string>>(new Set())
  const [apidaeFiltresLocalites, setApidaeFiltresLocalites] = useState<Set<string>>(new Set())
  const [apidaeFiltresCategories, setApidaeFiltresCategories] = useState<Set<string>>(new Set())
  const [apidaeFiltresSousCategories, setApidaeFiltresSousCategories] = useState<Set<string>>(new Set())
  const [apidaeModeVue, setApidaeModeVue] = useState<'synthese' | 'detail'>('synthese')
  const [apidaePanelOuvert, setApidaePanelOuvert] = useState<string | null>(null)
  const [sortApidaeCol, setSortApidaeCol] = useState<string | null>(null)
  const [sortApidaeDir, setSortApidaeDir] = useState<'asc' | 'desc'>('asc')

  // ── Filtres Vue Tourinsoft — multi-sélection ──────────────────────────────
  const [tourinFiltresCommunes, setTourinFiltresCommunes] = useState<Set<string>>(new Set())
  const [tourinFiltresCategories, setTourinFiltresCategories] = useState<Set<string>>(new Set())
  const [tourinFiltresSousCategories, setTourinFiltresSousCategories] = useState<Set<string>>(new Set())
  const [tourinModeVue, setTourinModeVue] = useState<'synthese' | 'detail'>('synthese')
  const [tourinPanelOuvert, setTourinPanelOuvert] = useState<string | null>(null)
  const [sortTourinCol, setSortTourinCol] = useState<string | null>(null)
  const [sortTourinDir, setSortTourinDir] = useState<'asc' | 'desc'>('asc')

  // ── Colonnes masquées par vue (Set de labels) ─────────────────────────────
  const [hebDetColsMasquees, setHebDetColsMasquees] = useState<Set<string>>(new Set())
  const [poiDetColsMasquees, setPoiDetColsMasquees] = useState<Set<string>>(new Set())
  const [taxeColsMasquees,   setTaxeColsMasquees]   = useState<Set<string>>(new Set())
  const [apidaeColsMasquees, setApidaeColsMasquees] = useState<Set<string>>(new Set())
  const [tourinColsMasquees, setTourinColsMasquees] = useState<Set<string>>(new Set())
  const [fusionColsMasquees, setFusionColsMasquees] = useState<Set<string>>(new Set())
  // Panel "Colonnes" pour les onglets sans panelOuvert dédié (héb / poi / taxe)
  const [colsPanelOuvert, setColsPanelOuvert] = useState<string | null>(null)

  // ── Vue Fusion Apidae × Tourinsoft ────────────────────────────────────────
  const [fusionFiltresCommunes, setFusionFiltresCommunes] = useState<Set<string>>(new Set())
  const [fusionFiltresCategories, setFusionFiltresCategories] = useState<Set<string>>(new Set())
  const [fusionFiltresSousCategories, setFusionFiltresSousCategories] = useState<Set<string>>(new Set())
  const [fusionModeVue, setFusionModeVue] = useState<'synthese' | 'detail'>('synthese')
  const [fusionPanelOuvert, setFusionPanelOuvert] = useState<string | null>(null)
  const [fusionPairesExclues, setFusionPairesExclues] = useState<Set<string>>(new Set())
  const [sortFusionCol, setSortFusionCol] = useState<string | null>(null)
  const [sortFusionDir, setSortFusionDir] = useState<'asc' | 'desc'>('asc')

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

  // Scraping OTA (Airbnb + Booking) — lancé après l'analyse, en arrière-plan
  const [otaEnCours, setOtaEnCours] = useState(false)
  const [otaProgression, setOtaProgression] = useState(0)   // 0–100
  const otaProgressionRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Nettoyage de l'intervalle de progression si le composant est démonté
  useEffect(() => () => { if (otaProgressionRef.current) clearInterval(otaProgressionRef.current) }, [])

  // Auto-save Supabase
  const [saveId, setSaveId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Sélection des localités Apidae ────────────────────────────────────────
  // Modale affichée avant l'analyse pour permettre d'inclure des localités supplémentaires
  // (ex: "Le Collet" pour Allevard), détectées dans le rayon GPS mais hors nom de commune.
  const [enDecouverteLocalites, setEnDecouverteLocalites] = useState(false)
  const [modalLocalitesOuvert, setModalLocalitesOuvert] = useState(false)
  const [localitesData, setLocalitesData] = useState<LocalitesCommune[] | null>(null)
  // Sélections : code_insee → Set de noms de localités incluses (nom Apidae exact)
  const [localitesSelections, setLocalitesSelections] = useState<Record<string, Set<string>>>({})

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

  // ── Sauvegarde Supabase ───────────────────────────────────────────────────

  async function sauvegarder(data: {
    communes: object[]
    resultats: object[]
    analyse_gpt?: string | null
  }) {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        communes: data.communes,
        resultats: data.resultats,
      }
      if (saveId) body.id = saveId  // mise à jour si déjà sauvegardé
      if (data.analyse_gpt !== undefined) body.analyse_gpt = data.analyse_gpt

      const res = await fetch('/api/territoire/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.id) setSaveId(d.id)
        setSaveSuccess(true)
      }
    } catch {
      // Non bloquant
    } finally {
      setSaving(false)
    }
  }

  // Communes confirmées (ok + ambiguës avec sélection)
  const communesConfirmees = useMemo(() => {
    if (!validation) return []
    return validation
      .filter((l) => l.statut === 'ok' && (l.commune ?? l.commune_choisie))
      .map((l) => (l.commune_choisie ?? l.commune)!)
  }, [validation])

  // ── Découverte des localités Apidae ──────────────────────────────────────

  // Étape 1 : découvrir les localités disponibles avant de lancer l'analyse.
  // Si des localités supplémentaires existent pour au moins une commune,
  // afficher la modale de sélection. Sinon, lancer directement l'analyse.
  async function ouvrirModalLocalites() {
    if (communesConfirmees.length === 0) return
    setEnDecouverteLocalites(true)

    try {
      const reponse = await fetch('/api/territoire/localites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communes: communesConfirmees }),
      })
      const data = await reponse.json()
      const localites: LocalitesCommune[] = data.localites ?? []

      // Initialiser les sélections : inclure par défaut les localités correspondant à la commune
      const selections: Record<string, Set<string>> = {}
      for (const lc of localites) {
        selections[lc.code_insee] = new Set(
          lc.localites.filter((l) => l.incluse_par_defaut).map((l) => l.nom)
        )
      }
      setLocalitesSelections(selections)
      setLocalitesData(localites)

      // Afficher la modale seulement si au moins une commune a des localités supplémentaires
      const aSupplementaires = localites.some((lc) => lc.a_localites_supplementaires)
      if (aSupplementaires) {
        setModalLocalitesOuvert(true)
      } else {
        // Aucune localité supplémentaire — lancer directement l'analyse
        await executerAnalyse(selections)
      }
    } catch (err) {
      console.error('Erreur découverte localités :', err)
      // En cas d'erreur, lancer l'analyse sans localités supplémentaires
      await executerAnalyse({})
    } finally {
      setEnDecouverteLocalites(false)
    }
  }

  // ── Analyse ───────────────────────────────────────────────────────────────

  // Étape 2 : lancer l'analyse avec les localités confirmées.
  async function executerAnalyse(selections: Record<string, Set<string>>) {
    if (communesConfirmees.length === 0) return
    setModalLocalitesOuvert(false)
    setEnAnalyse(true)

    // Construire localites_par_commune : code_insee → tableau de noms de localités supplémentaires
    // (uniquement celles NON incluses par défaut — la commune principale est déjà filtrée côté API)
    const localites_par_commune: Record<string, string[]> = {}
    if (localitesData) {
      for (const lc of localitesData) {
        const selectionnes = selections[lc.code_insee] ?? new Set<string>()
        const supplementaires = [...selectionnes].filter((nom) => {
          const localite = lc.localites.find((l) => l.nom === nom)
          return localite && !localite.incluse_par_defaut
        })
        if (supplementaires.length > 0) {
          localites_par_commune[lc.code_insee] = supplementaires
        }
      }
    }

    try {
      const reponse = await fetch('/api/territoire/analyser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communes: communesConfirmees, localites_par_commune }),
      })
      const data = await reponse.json()
      const nouveauxResultats = data.resultats ?? []
      setResultats(nouveauxResultats)

      // Auto-save après analyse
      sauvegarder({ communes: communesConfirmees, resultats: nouveauxResultats })
    } catch (err) {
      console.error('Erreur analyse :', err)
    } finally {
      setEnAnalyse(false)
    }
  }

  // ── Scraping OTA ─────────────────────────────────────────────────────────

  async function lancerOTA(communes: { nom: string; code_insee: string }[]) {
    if (communes.length === 0) return
    setOtaEnCours(true)
    setOtaProgression(5)

    // Progression simulée : avance lentement jusqu'à 90%, se complète quand la réponse arrive
    // Durée estimée : ~45s par commune (Airbnb récursif + Booking)
    const dureeEstimeeMs = communes.length * 45_000
    const intervalMs = 500
    const incrementParTick = (85 / (dureeEstimeeMs / intervalMs))  // de 5% à 90%

    otaProgressionRef.current = setInterval(() => {
      setOtaProgression((prev) => Math.min(90, prev + incrementParTick))
    }, intervalMs)

    try {
      const reponse = await fetch('/api/territoire/ota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communes }),
      })
      const data = await reponse.json()
      const otaResultats: Array<{ code_insee: string; airbnb: ResultatAirbnb | null; booking: ResultatBooking | null }> = data.resultats ?? []

      // Fusionner les données OTA dans les résultats existants
      setResultats((prev) => {
        if (!prev) return prev
        return prev.map((r) => {
          const ota = otaResultats.find((o) => o.code_insee === r.commune.code_insee)
          if (!ota) return r
          return { ...r, airbnb: ota.airbnb, booking: ota.booking }
        })
      })

      setOtaProgression(100)
    } catch (err) {
      console.error('Erreur scraping OTA :', err)
    } finally {
      if (otaProgressionRef.current) clearInterval(otaProgressionRef.current)
      setOtaEnCours(false)
    }
  }

  // Bouton "Analyser" → ouvre d'abord la modale de sélection des localités
  function lancerAnalyse() {
    ouvrirModalLocalites()
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

      // Mise à jour de la sauvegarde avec la synthèse GPT
      if (resultats) {
        sauvegarder({
          communes: communesConfirmees,
          resultats,
          analyse_gpt: JSON.stringify(data.analyse),
        })
      }
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

  // Calcule la ventilation par sous-catégorie pour une liste d'établissements
  function sousCategParSource(items: Etablissement[]): Record<string, number> {
    const map: Record<string, number> = {}
    for (const e of items) {
      map[e.sous_categorie] = (map[e.sous_categorie] ?? 0) + 1
    }
    return map
  }

  const syntheseHebergements = useMemo(() => {
    if (!resultats) return []
    return resultats
      .filter((r) => filtreCommune === 'toutes' || r.commune.nom === filtreCommune)
      .map((r) => {
        const dt  = r.hebergements.filter((e) => e.source === 'datatourisme')
        const ts  = r.hebergements.filter((e) => e.source === 'tourinsoft')
        const ap  = r.hebergements.filter((e) => e.source === 'apidae')

        return {
          nom:    r.commune.nom,
          code_insee: r.commune.code_insee,
          dept:   r.commune.code_departement,
          residences_secondaires: r.residences_secondaires,
          total:  r.hebergements.length,
          freq_departement: r.freq_departement,
          // Données par source
          dt_total:      dt.length,
          ts_total:      ts.length,
          ap_total:      ap.length,
          dt_sousCateg:  sousCategParSource(dt),
          ts_sousCateg:  sousCategParSource(ts),
          ap_sousCateg:  sousCategParSource(ap),
          // INSEE (pour info)
          insee_hotels:   r.insee_cap?.hotels.nb_etab    ?? 0,
          insee_campings: r.insee_cap?.campings.nb_etab   ?? 0,
          insee_autres:   r.insee_cap?.autres_heb.nb_etab ?? 0,
          isbn_cap_chambres: r.insee_cap?.hotels.nb_chambres ?? 0,
          // OTA — scraping Airbnb + Booking
          airbnb_total:   r.airbnb?.total_annonces ?? null,
          booking_total:  r.booking?.total_proprietes ?? null,
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

  // ── Données Vue Apidae ────────────────────────────────────────────────────

  // Tous les éléments Apidae enrichis avec la commune admin
  const tousItemsApidae = useMemo(() => {
    if (!resultats) return []
    return resultats.flatMap((r) =>
      [...r.hebergements, ...r.poi]
        .filter((e) => e.source === 'apidae')
        .map((e) => ({ ...e, commune_admin: r.commune.nom }))
    )
  }, [resultats])

  // Localités Apidae distinctes (pour le filtre "intérêt touristique")
  const localitesApidaeDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const item of tousItemsApidae) {
      if (item.localite_apidae) set.add(item.localite_apidae)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [tousItemsApidae])

  // Communes admin distinctes présentes dans les données Apidae
  const communesApidaeDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const item of tousItemsApidae) set.add(item.commune_admin)
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [tousItemsApidae])

  // Catégories distinctes disponibles dans les données Apidae
  const categoriesApidaeDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const item of tousItemsApidae) set.add(item.categorie)
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [tousItemsApidae])

  // Sous-catégories disponibles compte tenu des filtres commune/localité/catégorie actifs
  // (ne dépend PAS du filtre sous-catégorie lui-même pour éviter de vider les options)
  const sousCategApidaeDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const item of tousItemsApidae) {
      if (apidaeFiltresCommunes.size > 0 && !apidaeFiltresCommunes.has(item.commune_admin)) continue
      if (apidaeFiltresLocalites.size > 0 && !apidaeFiltresLocalites.has(item.localite_apidae ?? '')) continue
      if (apidaeFiltresCategories.size > 0 && !apidaeFiltresCategories.has(item.categorie)) continue
      set.add(item.sous_categorie)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [tousItemsApidae, apidaeFiltresCommunes, apidaeFiltresLocalites, apidaeFiltresCategories])

  // Application des 4 filtres cumulatifs (Set vide = pas de filtre)
  const itemsApidaeFiltres = useMemo(() => {
    return tousItemsApidae.filter((e) => {
      if (apidaeFiltresCommunes.size > 0 && !apidaeFiltresCommunes.has(e.commune_admin)) return false
      if (apidaeFiltresLocalites.size > 0 && !apidaeFiltresLocalites.has(e.localite_apidae ?? '')) return false
      if (apidaeFiltresCategories.size > 0 && !apidaeFiltresCategories.has(e.categorie)) return false
      if (apidaeFiltresSousCategories.size > 0 && !apidaeFiltresSousCategories.has(e.sous_categorie)) return false
      return true
    })
  }, [tousItemsApidae, apidaeFiltresCommunes, apidaeFiltresLocalites, apidaeFiltresCategories, apidaeFiltresSousCategories])

  // Vue synthèse — groupement catégorie > sous-catégorie > localité
  const syntheseApidae = useMemo(() => {
    const parCat = new Map<string, typeof itemsApidaeFiltres>()
    for (const item of itemsApidaeFiltres) {
      if (!parCat.has(item.categorie)) parCat.set(item.categorie, [])
      parCat.get(item.categorie)!.push(item)
    }
    return [...parCat.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([categorie, items]) => {
        const capaciteTotale = items.reduce((s, e) => e.capacite !== null ? s + e.capacite : s, 0)
        const nbAvecCapacite = items.filter((e) => e.capacite !== null).length

        const parSousCat = new Map<string, typeof items>()
        for (const item of items) {
          if (!parSousCat.has(item.sous_categorie)) parSousCat.set(item.sous_categorie, [])
          parSousCat.get(item.sous_categorie)!.push(item)
        }
        const sousCategories = [...parSousCat.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([souscat, scItems]) => {
            // Groupement par localité Apidae (ou commune admin si pas de localité)
            const parLoc = new Map<string, number>()
            for (const item of scItems) {
              const key = item.localite_apidae ?? item.commune_admin
              parLoc.set(key, (parLoc.get(key) ?? 0) + 1)
            }
            const cap = scItems.reduce((s, e) => e.capacite !== null ? s + e.capacite : s, 0)
            const nbCap = scItems.filter((e) => e.capacite !== null).length
            return {
              nom: souscat,
              total: scItems.length,
              capacite: nbCap > 0 ? cap : null,
              par_localite: [...parLoc.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([loc, count]) => ({ loc, count })),
            }
          })

        return {
          categorie,
          total: items.length,
          capacite_totale: nbAvecCapacite > 0 ? capaciteTotale : null,
          nb_avec_capacite: nbAvecCapacite,
          sous_categories: sousCategories,
        }
      })
  }, [itemsApidaeFiltres])

  // Vue détail — tableau Apidae trié
  const apidaeTriee = useMemo(() => {
    if (!sortApidaeCol) return itemsApidaeFiltres
    return [...itemsApidaeFiltres].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      if (sortApidaeCol === 'commune_admin')    { va = a.commune_admin;   vb = b.commune_admin }
      else if (sortApidaeCol === 'localite')    { va = a.localite_apidae ?? ''; vb = b.localite_apidae ?? '' }
      else if (sortApidaeCol === 'nom')         { va = a.nom;             vb = b.nom }
      else if (sortApidaeCol === 'categorie')   { va = a.categorie;       vb = b.categorie }
      else if (sortApidaeCol === 'sous_cat')    { va = a.sous_categorie;  vb = b.sous_categorie }
      else if (sortApidaeCol === 'capacite')    { va = a.capacite;        vb = b.capacite }
      else if (sortApidaeCol === 'adresse')     { va = a.adresse ?? '';   vb = b.adresse ?? '' }
      else if (sortApidaeCol === 'cp')          { va = a.code_postal ?? ''; vb = b.code_postal ?? '' }
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortApidaeDir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
      }
      return sortApidaeDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [itemsApidaeFiltres, sortApidaeCol, sortApidaeDir])

  // ── Données Vue Tourinsoft ────────────────────────────────────────────────

  // Tous les éléments Tourinsoft enrichis avec la commune admin
  const tousItemsTourinsoft = useMemo(() => {
    if (!resultats) return []
    return resultats.flatMap((r) =>
      [...r.hebergements, ...r.poi]
        .filter((e) => e.source === 'tourinsoft')
        .map((e) => ({ ...e, commune_admin: r.commune.nom }))
    )
  }, [resultats])

  // Communes admin distinctes présentes dans les données Tourinsoft
  const communesTourinDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const item of tousItemsTourinsoft) set.add(item.commune_admin)
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [tousItemsTourinsoft])

  // Catégories distinctes
  const categoriesTourinDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const item of tousItemsTourinsoft) set.add(item.categorie)
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [tousItemsTourinsoft])

  // Sous-catégories disponibles selon les filtres commune/catégorie actifs
  const sousCategTourinDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const item of tousItemsTourinsoft) {
      if (tourinFiltresCommunes.size > 0 && !tourinFiltresCommunes.has(item.commune_admin)) continue
      if (tourinFiltresCategories.size > 0 && !tourinFiltresCategories.has(item.categorie)) continue
      set.add(item.sous_categorie)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [tousItemsTourinsoft, tourinFiltresCommunes, tourinFiltresCategories])

  // Application des 3 filtres cumulatifs
  const itemsTourinFiltres = useMemo(() => {
    return tousItemsTourinsoft.filter((e) => {
      if (tourinFiltresCommunes.size > 0 && !tourinFiltresCommunes.has(e.commune_admin)) return false
      if (tourinFiltresCategories.size > 0 && !tourinFiltresCategories.has(e.categorie)) return false
      if (tourinFiltresSousCategories.size > 0 && !tourinFiltresSousCategories.has(e.sous_categorie)) return false
      return true
    })
  }, [tousItemsTourinsoft, tourinFiltresCommunes, tourinFiltresCategories, tourinFiltresSousCategories])

  // Vue synthèse — groupement catégorie > sous-catégorie > commune
  const syntheseTourinsoft = useMemo(() => {
    const parCat = new Map<string, typeof itemsTourinFiltres>()
    for (const item of itemsTourinFiltres) {
      if (!parCat.has(item.categorie)) parCat.set(item.categorie, [])
      parCat.get(item.categorie)!.push(item)
    }
    return [...parCat.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([categorie, items]) => {
        const capaciteTotale = items.reduce((s, e) => e.capacite !== null ? s + e.capacite : s, 0)
        const nbAvecCapacite = items.filter((e) => e.capacite !== null).length

        const parSousCat = new Map<string, typeof items>()
        for (const item of items) {
          if (!parSousCat.has(item.sous_categorie)) parSousCat.set(item.sous_categorie, [])
          parSousCat.get(item.sous_categorie)!.push(item)
        }
        const sousCategories = [...parSousCat.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([souscat, scItems]) => {
            const parCommune = new Map<string, number>()
            for (const item of scItems) {
              parCommune.set(item.commune_admin, (parCommune.get(item.commune_admin) ?? 0) + 1)
            }
            const cap = scItems.reduce((s, e) => e.capacite !== null ? s + e.capacite : s, 0)
            const nbCap = scItems.filter((e) => e.capacite !== null).length
            return {
              nom: souscat,
              total: scItems.length,
              capacite: nbCap > 0 ? cap : null,
              par_commune: [...parCommune.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([commune, count]) => ({ commune, count })),
            }
          })

        return {
          categorie,
          total: items.length,
          capacite_totale: nbAvecCapacite > 0 ? capaciteTotale : null,
          nb_avec_capacite: nbAvecCapacite,
          sous_categories: sousCategories,
        }
      })
  }, [itemsTourinFiltres])

  // Vue détail — tableau Tourinsoft trié
  const tourinTriee = useMemo(() => {
    if (!sortTourinCol) return itemsTourinFiltres
    return [...itemsTourinFiltres].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      if (sortTourinCol === 'commune_admin')  { va = a.commune_admin;   vb = b.commune_admin }
      else if (sortTourinCol === 'nom')       { va = a.nom;             vb = b.nom }
      else if (sortTourinCol === 'categorie') { va = a.categorie;       vb = b.categorie }
      else if (sortTourinCol === 'sous_cat')  { va = a.sous_categorie;  vb = b.sous_categorie }
      else if (sortTourinCol === 'cp')        { va = a.code_postal ?? ''; vb = b.code_postal ?? '' }
      else if (sortTourinCol === 'capacite')  { va = a.capacite;        vb = b.capacite }
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortTourinDir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
      }
      return sortTourinDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [itemsTourinFiltres, sortTourinCol, sortTourinDir])

  // ── Vue Fusion : détection des paires doublons (sans dépendance aux exclusions) ──

  const pairesDoublons = useMemo((): PaireDoublon[] => {
    if (!resultats) return []

    // Enrichir avec catégories unifiées et indexer par commune
    type ItemEnrichi = { uuid: string; nom: string; commune_admin: string; cat: string; sousCat: string; source: string }
    const apEnrichis: ItemEnrichi[] = tousItemsApidae.map((e) => {
      const { cat, sousCat } = getCatUnif(e.source, e.categorie, e.sous_categorie)
      return { uuid: e.uuid, nom: e.nom, commune_admin: e.commune_admin, cat, sousCat, source: e.source }
    })
    const tsEnrichis: ItemEnrichi[] = tousItemsTourinsoft.map((e) => {
      const { cat, sousCat } = getCatUnif(e.source, e.categorie, e.sous_categorie)
      return { uuid: e.uuid, nom: e.nom, commune_admin: e.commune_admin, cat, sousCat, source: e.source }
    })

    // Index par commune pour réduire les comparaisons
    const apParCommune = new Map<string, ItemEnrichi[]>()
    for (const e of apEnrichis) {
      if (!apParCommune.has(e.commune_admin)) apParCommune.set(e.commune_admin, [])
      apParCommune.get(e.commune_admin)!.push(e)
    }

    const paires: PaireDoublon[] = []
    const apMatches = new Set<string>()
    const tsMatches = new Set<string>()

    for (const ts of tsEnrichis) {
      if (tsMatches.has(ts.uuid)) continue
      const candidats = apParCommune.get(ts.commune_admin) ?? []
      for (const ap of candidats) {
        if (apMatches.has(ap.uuid)) continue
        // Même catégorie unifiée principale + noms similaires
        if (ap.cat === ts.cat && nomsSimilaires(ap.nom, ts.nom)) {
          paires.push({
            id: `${ap.uuid}|${ts.uuid}`,
            nom_apidae: ap.nom,
            nom_tourinsoft: ts.nom,
            commune_admin: ap.commune_admin,
            cat_unif: ap.cat,
          })
          apMatches.add(ap.uuid)
          tsMatches.add(ts.uuid)
          break
        }
      }
    }
    return paires
  }, [tousItemsApidae, tousItemsTourinsoft, resultats])

  // Index rapide des paires actives (non exclues)
  const pairesActives = useMemo(() => {
    return new Map(
      pairesDoublons
        .filter((p) => !fusionPairesExclues.has(p.id))
        .map((p) => {
          const [apId, tsId] = p.id.split('|')
          return [p.id, { apId, tsId }] as const
        })
    )
  }, [pairesDoublons, fusionPairesExclues])

  const apIdsMerges = useMemo(() => new Set([...pairesActives.values()].map((v) => v.apId)), [pairesActives])
  const tsIdsMerges  = useMemo(() => new Set([...pairesActives.values()].map((v) => v.tsId)),  [pairesActives])

  // Construit la liste d'items de la vue fusion
  const itemsFusionBruts = useMemo((): ItemFusion[] => {
    const items: ItemFusion[] = []

    // Apidae : items non mergés → affichage solo
    for (const e of tousItemsApidae) {
      if (apIdsMerges.has(e.uuid)) continue
      const { cat, sousCat } = getCatUnif(e.source, e.categorie, e.sous_categorie)
      items.push({
        id: e.uuid, nom: e.nom, commune_admin: e.commune_admin,
        cat_unif: cat, souscat_unif: sousCat,
        sources: ['apidae'],
        adresse: e.adresse, code_postal: e.code_postal, telephone: e.telephone,
        capacite: e.capacite, lat: e.lat, lng: e.lng,
      })
    }

    // Tourinsoft : items non mergés → affichage solo
    for (const e of tousItemsTourinsoft) {
      if (tsIdsMerges.has(e.uuid)) continue
      const { cat, sousCat } = getCatUnif(e.source, e.categorie, e.sous_categorie)
      items.push({
        id: e.uuid, nom: e.nom, commune_admin: e.commune_admin,
        cat_unif: cat, souscat_unif: sousCat,
        sources: ['tourinsoft'],
        adresse: e.adresse, code_postal: e.code_postal, telephone: e.telephone,
        capacite: e.capacite, lat: e.lat, lng: e.lng,
      })
    }

    // Paires actives → 1 item fusionné
    for (const [pairId, { apId, tsId }] of pairesActives) {
      const ap = tousItemsApidae.find((e) => e.uuid === apId)
      const ts = tousItemsTourinsoft.find((e) => e.uuid === tsId)
      if (!ap || !ts) continue
      const { cat, sousCat } = getCatUnif(ap.source, ap.categorie, ap.sous_categorie)
      items.push({
        id: pairId,
        nom: ap.nom,
        commune_admin: ap.commune_admin,
        cat_unif: cat, souscat_unif: sousCat,
        sources: ['apidae', 'tourinsoft'],
        adresse: ap.adresse ?? ts.adresse,
        code_postal: ap.code_postal ?? ts.code_postal,
        telephone: ap.telephone,
        capacite: ap.capacite ?? ts.capacite,
        lat: ap.lat ?? ts.lat, lng: ap.lng ?? ts.lng,
        nom_apidae: ap.nom !== ts.nom ? ap.nom : undefined,
        nom_tourinsoft: ap.nom !== ts.nom ? ts.nom : undefined,
      })
    }
    return items
  }, [tousItemsApidae, tousItemsTourinsoft, pairesActives, apIdsMerges, tsIdsMerges])

  // Dimensions disponibles pour les filtres fusion
  const communesFusionDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const e of itemsFusionBruts) set.add(e.commune_admin)
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [itemsFusionBruts])

  const categoriesFusionDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const e of itemsFusionBruts) set.add(e.cat_unif)
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [itemsFusionBruts])

  const sousCategFusionDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const e of itemsFusionBruts) {
      if (fusionFiltresCommunes.size > 0 && !fusionFiltresCommunes.has(e.commune_admin)) continue
      if (fusionFiltresCategories.size > 0 && !fusionFiltresCategories.has(e.cat_unif)) continue
      set.add(e.souscat_unif)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [itemsFusionBruts, fusionFiltresCommunes, fusionFiltresCategories])

  // Items après filtres
  const itemsFusionFiltres = useMemo(() => {
    return itemsFusionBruts.filter((e) => {
      if (fusionFiltresCommunes.size > 0 && !fusionFiltresCommunes.has(e.commune_admin)) return false
      if (fusionFiltresCategories.size > 0 && !fusionFiltresCategories.has(e.cat_unif)) return false
      if (fusionFiltresSousCategories.size > 0 && !fusionFiltresSousCategories.has(e.souscat_unif)) return false
      return true
    })
  }, [itemsFusionBruts, fusionFiltresCommunes, fusionFiltresCategories, fusionFiltresSousCategories])

  // Synthèse : catégorie unifiée > sous-catégorie > commune
  const syntheseFusion = useMemo(() => {
    const parCat = new Map<string, ItemFusion[]>()
    for (const item of itemsFusionFiltres) {
      if (!parCat.has(item.cat_unif)) parCat.set(item.cat_unif, [])
      parCat.get(item.cat_unif)!.push(item)
    }
    return [...parCat.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([cat, items]) => {
        const capTotale = items.reduce((s, e) => e.capacite !== null ? s + e.capacite : s, 0)
        const nbCap = items.filter((e) => e.capacite !== null).length
        const nbMerges = items.filter((e) => e.sources.length === 2).length

        const parSousCat = new Map<string, ItemFusion[]>()
        for (const item of items) {
          if (!parSousCat.has(item.souscat_unif)) parSousCat.set(item.souscat_unif, [])
          parSousCat.get(item.souscat_unif)!.push(item)
        }
        const sousCategories = [...parSousCat.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([sc, scItems]) => {
            const parCommune = new Map<string, number>()
            for (const e of scItems) parCommune.set(e.commune_admin, (parCommune.get(e.commune_admin) ?? 0) + 1)
            const scCap = scItems.reduce((s, e) => e.capacite !== null ? s + e.capacite : s, 0)
            const scNbCap = scItems.filter((e) => e.capacite !== null).length
            const scMerges = scItems.filter((e) => e.sources.length === 2).length
            return {
              nom: sc, total: scItems.length, capacite: scNbCap > 0 ? scCap : null, nb_merges: scMerges,
              par_commune: [...parCommune.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ c, n })),
            }
          })
        return { cat, total: items.length, capacite_totale: nbCap > 0 ? capTotale : null, nb_avec_capacite: nbCap, nb_merges: nbMerges, sous_categories: sousCategories }
      })
  }, [itemsFusionFiltres])

  // Détail trié
  const fusionTriee = useMemo(() => {
    if (!sortFusionCol) return itemsFusionFiltres
    return [...itemsFusionFiltres].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      if (sortFusionCol === 'commune') { va = a.commune_admin; vb = b.commune_admin }
      else if (sortFusionCol === 'nom')      { va = a.nom; vb = b.nom }
      else if (sortFusionCol === 'cat')      { va = a.cat_unif; vb = b.cat_unif }
      else if (sortFusionCol === 'souscat')  { va = a.souscat_unif; vb = b.souscat_unif }
      else if (sortFusionCol === 'cap')      { va = a.capacite; vb = b.capacite }
      else if (sortFusionCol === 'cp')       { va = a.code_postal ?? ''; vb = b.code_postal ?? '' }
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortFusionDir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
      }
      return sortFusionDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [itemsFusionFiltres, sortFusionCol, sortFusionDir])

  // Synthèse triée selon la colonne sélectionnée
  const syntheseTriee = useMemo(() => {
    if (!sortColonne) return syntheseHebergements
    return [...syntheseHebergements].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      if (sortColonne === 'nom')                   { va = a.nom;   vb = b.nom }
      else if (sortColonne === 'residences_secondaires') { va = a.residences_secondaires; vb = b.residences_secondaires }
      else if (sortColonne === 'total')            { va = a.total; vb = b.total }
      else if (sortColonne === 'dt_total')         { va = a.dt_total;  vb = b.dt_total }
      else if (sortColonne === 'ts_total')         { va = a.ts_total;  vb = b.ts_total }
      else if (sortColonne === 'ap_total')         { va = a.ap_total;  vb = b.ap_total }
      else if (sortColonne === 'airbnb_total')     { va = a.airbnb_total;  vb = b.airbnb_total }
      else if (sortColonne === 'booking_total')    { va = a.booking_total; vb = b.booking_total }
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
  function trierApidae(col: string) {
    if (sortApidaeCol === col) setSortApidaeDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortApidaeCol(col); setSortApidaeDir('asc') }
  }

  // Bascule un filtre Apidae multi-sélection. Mise à jour immédiate → réactivité instantanée.
  function toggleFiltreApidae(dimension: 'communes' | 'localites' | 'categories' | 'sous_cat', valeur: string) {
    const updater = (prev: Set<string>): Set<string> => {
      const next = new Set(prev)
      if (next.has(valeur)) next.delete(valeur)
      else next.add(valeur)
      return next
    }
    if (dimension === 'communes') setApidaeFiltresCommunes(updater)
    else if (dimension === 'localites') setApidaeFiltresLocalites(updater)
    else if (dimension === 'categories') {
      setApidaeFiltresCategories(updater)
      // Réinitialiser les sous-catégories qui ne seraient plus disponibles
      setApidaeFiltresSousCategories(new Set())
    }
    else if (dimension === 'sous_cat') setApidaeFiltresSousCategories(updater)
  }

  function effacerFiltresApidae() {
    setApidaeFiltresCommunes(new Set())
    setApidaeFiltresLocalites(new Set())
    setApidaeFiltresCategories(new Set())
    setApidaeFiltresSousCategories(new Set())
    setApidaePanelOuvert(null)
  }

  const nbFiltresApidaeActifs =
    apidaeFiltresCommunes.size + apidaeFiltresLocalites.size +
    apidaeFiltresCategories.size + apidaeFiltresSousCategories.size

  function trierTourin(col: string) {
    if (sortTourinCol === col) setSortTourinDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortTourinCol(col); setSortTourinDir('asc') }
  }

  function toggleFiltreTourinsoft(dimension: 'communes' | 'categories' | 'sous_cat', valeur: string) {
    const updater = (prev: Set<string>): Set<string> => {
      const next = new Set(prev)
      if (next.has(valeur)) next.delete(valeur)
      else next.add(valeur)
      return next
    }
    if (dimension === 'communes') setTourinFiltresCommunes(updater)
    else if (dimension === 'categories') {
      setTourinFiltresCategories(updater)
      setTourinFiltresSousCategories(new Set())
    }
    else if (dimension === 'sous_cat') setTourinFiltresSousCategories(updater)
  }

  function effacerFiltresTourinsoft() {
    setTourinFiltresCommunes(new Set())
    setTourinFiltresCategories(new Set())
    setTourinFiltresSousCategories(new Set())
    setTourinPanelOuvert(null)
  }

  const nbFiltresTourinActifs =
    tourinFiltresCommunes.size + tourinFiltresCategories.size + tourinFiltresSousCategories.size

  function trierFusion(col: string) {
    if (sortFusionCol === col) setSortFusionDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortFusionCol(col); setSortFusionDir('asc') }
  }

  function toggleFiltreFusion(dimension: 'communes' | 'categories' | 'sous_cat', valeur: string) {
    const updater = (prev: Set<string>): Set<string> => {
      const next = new Set(prev)
      if (next.has(valeur)) next.delete(valeur)
      else next.add(valeur)
      return next
    }
    if (dimension === 'communes') setFusionFiltresCommunes(updater)
    else if (dimension === 'categories') {
      setFusionFiltresCategories(updater)
      setFusionFiltresSousCategories(new Set())
    }
    else if (dimension === 'sous_cat') setFusionFiltresSousCategories(updater)
  }

  function effacerFiltreFusion() {
    setFusionFiltresCommunes(new Set())
    setFusionFiltresCategories(new Set())
    setFusionFiltresSousCategories(new Set())
    setFusionPanelOuvert(null)
  }

  const nbFiltreFusionActifs =
    fusionFiltresCommunes.size + fusionFiltresCategories.size + fusionFiltresSousCategories.size

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

  // Vue synthèse POI : une ligne par commune, une colonne par catégorie + ventilation source dans tooltip
  const synthesePOI = useMemo(() => {
    if (!resultats) return { lignes: [], categories: [] as string[] }
    const filtered = resultats.filter((r) => filtreCommune === 'toutes' || r.commune.nom === filtreCommune)
    const categories = [...new Set(filtered.flatMap((r) => r.poi.map((e) => e.categorie)))].sort()
    const lignes = filtered.map((r) => {
      const parCategorie: Record<string, number> = {}
      // Ventilation par source pour chaque catégorie (colonnes)
      const parSource: Record<string, Record<string, number>> = {}
      // Ventilation par source ET sous-catégorie (tooltips par cellule)
      // Structure : parSourceSousCateg[categorie][source][sous_categorie] = count
      const parSourceSousCateg: Record<string, Record<string, Record<string, number>>> = {}
      for (const e of r.poi) {
        parCategorie[e.categorie] = (parCategorie[e.categorie] ?? 0) + 1
        if (!parSource[e.categorie]) parSource[e.categorie] = { datatourisme: 0, tourinsoft: 0, apidae: 0 }
        parSource[e.categorie][e.source] = (parSource[e.categorie][e.source] ?? 0) + 1
        if (!parSourceSousCateg[e.categorie]) parSourceSousCateg[e.categorie] = {}
        if (!parSourceSousCateg[e.categorie][e.source]) parSourceSousCateg[e.categorie][e.source] = {}
        const sc = parSourceSousCateg[e.categorie][e.source]
        sc[e.sous_categorie] = (sc[e.sous_categorie] ?? 0) + 1
      }
      return {
        nom: r.commune.nom,
        code_insee: r.commune.code_insee,
        dept: r.commune.code_departement,
        total: r.poi.length,
        parCategorie,
        parSource,
        parSourceSousCateg,
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
      Source: e.source,
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
      Source: e.source,
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

  function exporterApidae() {
    const lignes = itemsApidaeFiltres.map((e) => ({
      Commune_admin: e.commune_admin,
      Localite_Apidae: e.localite_apidae ?? '',
      Nom: e.nom,
      Categorie: e.categorie,
      Sous_categorie: e.sous_categorie,
      Adresse: e.adresse ?? '',
      Code_postal: e.code_postal ?? '',
      Telephone: e.telephone ?? '',
      Capacite: e.capacite ?? '',
      Latitude: e.lat ?? '',
      Longitude: e.lng ?? '',
    }))
    exporterCSV(lignes, `apidae-territoire-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function exporterTourinsoft() {
    const lignes = itemsTourinFiltres.map((e) => ({
      Commune: e.commune_admin,
      Nom: e.nom,
      Categorie: e.categorie,
      Sous_categorie: e.sous_categorie,
      Code_postal: e.code_postal ?? '',
      Capacite: e.capacite ?? '',
      Latitude: e.lat ?? '',
      Longitude: e.lng ?? '',
    }))
    exporterCSV(lignes, `tourinsoft-territoire-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function exporterFusion() {
    const lignes = itemsFusionFiltres.map((e) => ({
      Commune: e.commune_admin,
      Nom: e.nom,
      Nom_Apidae: e.nom_apidae ?? '',
      Nom_Tourinsoft: e.nom_tourinsoft ?? '',
      Sources: e.sources.join('+'),
      Categorie: e.cat_unif,
      Sous_categorie: e.souscat_unif,
      Code_postal: e.code_postal ?? '',
      Capacite: e.capacite ?? '',
      Latitude: e.lat ?? '',
      Longitude: e.lng ?? '',
    }))
    exporterCSV(lignes, `fusion-apidae-tourinsoft-${new Date().toISOString().slice(0, 10)}.csv`)
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

              <div className="flex items-center gap-3">
                {saving && (
                  <span className="flex items-center gap-1 text-xs text-white/40">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sauvegarde...
                  </span>
                )}
                {!saving && saveSuccess && (
                  <span className="text-xs text-green-400">✓ Sauvegardé</span>
                )}
                <button
                  onClick={lancerAnalyse}
                  disabled={enAnalyse || enDecouverteLocalites || communesConfirmees.length === 0}
                  className="px-5 py-2 bg-brand-orange hover:bg-brand-orange/80 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {enDecouverteLocalites
                    ? 'Détection des localités...'
                    : enAnalyse
                      ? 'Analyse en cours...'
                      : `Analyser ${communesConfirmees.length} commune${communesConfirmees.length > 1 ? 's' : ''}`
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modale sélection localités Apidae ──────────────────────────── */}
        {modalLocalitesOuvert && localitesData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-brand-navy border border-white/15 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">

              {/* En-tête modale */}
              <div className="flex items-start justify-between p-6 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-semibold text-white">Localités détectées dans Apidae</h2>
                  <p className="text-white/50 text-sm mt-1">
                    Des hébergements supplémentaires ont été trouvés sous des noms de localités distincts.
                    Cochez ceux à inclure dans l&apos;analyse.
                  </p>
                </div>
                <button
                  onClick={() => setModalLocalitesOuvert(false)}
                  className="text-white/30 hover:text-white/70 transition-colors ml-4 mt-0.5"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Corps modale — liste par commune */}
              <div className="overflow-y-auto flex-1 p-6 space-y-6">
                {localitesData
                  .filter((lc) => lc.localites.length > 0)
                  .map((lc) => (
                  <div key={lc.code_insee}>
                    <h3 className="text-sm font-semibold text-white/80 mb-2">
                      {lc.nom_commune}
                    </h3>
                    <div className="space-y-1.5">
                      {lc.localites.map((localite) => {
                        const selectionCommune = localitesSelections[lc.code_insee] ?? new Set<string>()
                        const cochee = selectionCommune.has(localite.nom)
                        const isDefault = localite.incluse_par_defaut

                        return (
                          <label
                            key={localite.nom}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                              cochee
                                ? 'bg-brand-orange/15 border border-brand-orange/30'
                                : 'bg-white/5 border border-white/10 hover:bg-white/8'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={cochee}
                              onChange={(e) => {
                                setLocalitesSelections((prev) => {
                                  const next = { ...prev }
                                  const set = new Set(next[lc.code_insee] ?? [])
                                  if (e.target.checked) {
                                    set.add(localite.nom)
                                  } else {
                                    // Ne pas permettre de décocher les localités par défaut
                                    if (!isDefault) set.delete(localite.nom)
                                  }
                                  next[lc.code_insee] = set
                                  return next
                                })
                              }}
                              disabled={isDefault}
                              className="w-4 h-4 accent-brand-orange rounded"
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <span className={`text-sm ${cochee ? 'text-white' : 'text-white/60'}`}>
                                {localite.nom}
                                {isDefault && (
                                  <span className="ml-2 text-xs text-white/30">(commune principale)</span>
                                )}
                              </span>
                              <span className={`text-xs tabular-nums ${cochee ? 'text-brand-orange' : 'text-white/30'}`}>
                                {localite.nb_hebergements} hébgt{localite.nb_hebergements > 1 ? 's' : ''}
                              </span>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pied modale */}
              <div className="flex items-center justify-between p-6 border-t border-white/10">
                <button
                  onClick={() => setModalLocalitesOuvert(false)}
                  className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => executerAnalyse(localitesSelections)}
                  className="px-6 py-2 bg-brand-orange hover:bg-brand-orange/80 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Lancer l&apos;analyse
                </button>
              </div>
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
                  { key: 'apidae', label: `Apidae (${tousItemsApidae.length})` },
                  ...(tousItemsTourinsoft.length > 0 ? [{ key: 'tourinsoft' as Onglet, label: `Tourinsoft (${tousItemsTourinsoft.length})` }] : []),
                  ...(itemsFusionBruts.length > 0 ? [{ key: 'fusion' as Onglet, label: `Fusion (${itemsFusionBruts.length})` }] : []),
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

                  {modeVueHeb === 'detail' && (
                    <>
                      {colsPanelOuvert === 'heb' && <div className="fixed inset-0 z-30" onClick={() => setColsPanelOuvert(null)} />}
                      <div className="relative z-40">
                        <button
                          onClick={() => setColsPanelOuvert((p) => p === 'heb' ? null : 'heb')}
                          className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${hebDetColsMasquees.size > 0 ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/60'}`}
                        >
                          Colonnes {hebDetColsMasquees.size > 0 && <span className="bg-white/20 text-white text-[10px] font-bold px-1 rounded">{hebDetColsMasquees.size} masq.</span>}
                          <span className="opacity-50">▾</span>
                        </button>
                        {colsPanelOuvert === 'heb' && (
                          <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl py-1 min-w-[160px]">
                            {['Commune','Nom','Source','Type','Adresse','Téléphone','Capacité','GPS'].map((col) => (
                              <label key={col} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                                <input type="checkbox" checked={!hebDetColsMasquees.has(col)} onChange={() => setHebDetColsMasquees((prev) => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n })} className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="text-xs text-white/70">{col}</span>
                              </label>
                            ))}
                            {hebDetColsMasquees.size > 0 && <button onClick={() => setHebDetColsMasquees(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">Tout afficher</button>}
                          </div>
                        )}
                      </div>
                    </>
                  )}

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

                  {modeVuePOI === 'detail' && (
                    <>
                      {colsPanelOuvert === 'poi' && <div className="fixed inset-0 z-30" onClick={() => setColsPanelOuvert(null)} />}
                      <div className="relative z-40">
                        <button
                          onClick={() => setColsPanelOuvert((p) => p === 'poi' ? null : 'poi')}
                          className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${poiDetColsMasquees.size > 0 ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/60'}`}
                        >
                          Colonnes {poiDetColsMasquees.size > 0 && <span className="bg-white/20 text-white text-[10px] font-bold px-1 rounded">{poiDetColsMasquees.size} masq.</span>}
                          <span className="opacity-50">▾</span>
                        </button>
                        {colsPanelOuvert === 'poi' && (
                          <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl py-1 min-w-[160px]">
                            {['Commune','Nom','Source','Catégorie','Type','Adresse','Téléphone','GPS'].map((col) => (
                              <label key={col} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                                <input type="checkbox" checked={!poiDetColsMasquees.has(col)} onChange={() => setPoiDetColsMasquees((prev) => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n })} className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="text-xs text-white/70">{col}</span>
                              </label>
                            ))}
                            {poiDetColsMasquees.size > 0 && <button onClick={() => setPoiDetColsMasquees(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">Tout afficher</button>}
                          </div>
                        )}
                      </div>
                    </>
                  )}

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

              {onglet === 'taxe' && (
                <>
                  {colsPanelOuvert === 'taxe' && <div className="fixed inset-0 z-30" onClick={() => setColsPanelOuvert(null)} />}
                  <div className="relative z-40">
                    <button
                      onClick={() => setColsPanelOuvert((p) => p === 'taxe' ? null : 'taxe')}
                      className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${taxeColsMasquees.size > 0 ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/60'}`}
                    >
                      Colonnes {taxeColsMasquees.size > 0 && <span className="bg-white/20 text-white text-[10px] font-bold px-1 rounded">{taxeColsMasquees.size} masq.</span>}
                      <span className="opacity-50">▾</span>
                    </button>
                    {colsPanelOuvert === 'taxe' && (
                      <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl py-1 min-w-[180px]">
                        {['Commune','Collecteur','Nom collecteur','Montant total','Estimé commune','Part EPCI','Année','Nuitées est.'].map((col) => (
                          <label key={col} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                            <input type="checkbox" checked={!taxeColsMasquees.has(col)} onChange={() => setTaxeColsMasquees((prev) => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n })} className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="text-xs text-white/70">{col}</span>
                          </label>
                        ))}
                        {taxeColsMasquees.size > 0 && <button onClick={() => setTaxeColsMasquees(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">Tout afficher</button>}
                      </div>
                    )}
                  </div>
                </>
              )}

              {onglet === 'apidae' && (
                <>
                  {/* Toggle synthèse / détail */}
                  <div className="flex items-center gap-0 border border-white/15 rounded overflow-hidden text-xs">
                    <button
                      onClick={() => setApidaeModeVue('synthese')}
                      className={`px-3 py-1 transition-colors ${apidaeModeVue === 'synthese' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Synthèse
                    </button>
                    <button
                      onClick={() => setApidaeModeVue('detail')}
                      className={`px-3 py-1 transition-colors ${apidaeModeVue === 'detail' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Détail
                    </button>
                  </div>

                  {/* Fermeture des panels au clic extérieur */}
                  {apidaePanelOuvert && (
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setApidaePanelOuvert(null)}
                    />
                  )}

                  {/* ── Filtre Communes ── */}
                  <div className="relative z-40">
                    <button
                      onClick={() => setApidaePanelOuvert((p) => p === 'communes' ? null : 'communes')}
                      className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                        apidaeFiltresCommunes.size > 0
                          ? 'bg-brand-purple/20 border-brand-purple/40 text-white'
                          : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                      }`}
                    >
                      Communes
                      {apidaeFiltresCommunes.size > 0 && (
                        <span className="bg-brand-purple/40 text-white text-[10px] font-bold px-1 rounded">{apidaeFiltresCommunes.size}</span>
                      )}
                      <span className="opacity-50">▾</span>
                    </button>
                    {apidaePanelOuvert === 'communes' && (
                      <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[180px] max-h-64 overflow-y-auto py-1">
                        {communesApidaeDisponibles.map((c) => (
                          <label key={c} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={apidaeFiltresCommunes.has(c)}
                              onChange={() => toggleFiltreApidae('communes', c)}
                              className="accent-brand-purple w-3.5 h-3.5 flex-shrink-0"
                            />
                            <span className="text-xs text-white/70">{c}</span>
                          </label>
                        ))}
                        {apidaeFiltresCommunes.size > 0 && (
                          <button onClick={() => setApidaeFiltresCommunes(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">
                            Tout effacer
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Filtre Localités ── */}
                  {localitesApidaeDisponibles.length > 0 && (
                    <div className="relative z-40">
                      <button
                        onClick={() => setApidaePanelOuvert((p) => p === 'localites' ? null : 'localites')}
                        className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                          apidaeFiltresLocalites.size > 0
                            ? 'bg-amber-500/20 border-amber-500/40 text-white'
                            : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                        }`}
                      >
                        Localités
                        {apidaeFiltresLocalites.size > 0 && (
                          <span className="bg-amber-500/40 text-white text-[10px] font-bold px-1 rounded">{apidaeFiltresLocalites.size}</span>
                        )}
                        <span className="opacity-50">▾</span>
                      </button>
                      {apidaePanelOuvert === 'localites' && (
                        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[200px] max-h-64 overflow-y-auto py-1">
                          {localitesApidaeDisponibles.map((l) => (
                            <label key={l} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={apidaeFiltresLocalites.has(l)}
                                onChange={() => toggleFiltreApidae('localites', l)}
                                className="accent-amber-500 w-3.5 h-3.5 flex-shrink-0"
                              />
                              <span className="text-xs text-white/70">{l}</span>
                            </label>
                          ))}
                          {apidaeFiltresLocalites.size > 0 && (
                            <button onClick={() => setApidaeFiltresLocalites(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">
                              Tout effacer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Filtre Catégories ── */}
                  <div className="relative z-40">
                    <button
                      onClick={() => setApidaePanelOuvert((p) => p === 'categories' ? null : 'categories')}
                      className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                        apidaeFiltresCategories.size > 0
                          ? 'bg-green-500/20 border-green-500/40 text-white'
                          : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                      }`}
                    >
                      Catégories
                      {apidaeFiltresCategories.size > 0 && (
                        <span className="bg-green-500/40 text-white text-[10px] font-bold px-1 rounded">{apidaeFiltresCategories.size}</span>
                      )}
                      <span className="opacity-50">▾</span>
                    </button>
                    {apidaePanelOuvert === 'categories' && (
                      <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[180px] py-1">
                        {categoriesApidaeDisponibles.map((cat) => (
                          <label key={cat} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={apidaeFiltresCategories.has(cat)}
                              onChange={() => toggleFiltreApidae('categories', cat)}
                              className="accent-green-500 w-3.5 h-3.5 flex-shrink-0"
                            />
                            <span className="text-xs text-white/70">{cat}</span>
                          </label>
                        ))}
                        {apidaeFiltresCategories.size > 0 && (
                          <button
                            onClick={() => { setApidaeFiltresCategories(new Set()); setApidaeFiltresSousCategories(new Set()) }}
                            className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1"
                          >
                            Tout effacer
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Filtre Sous-catégories ── */}
                  {sousCategApidaeDisponibles.length > 0 && (
                    <div className="relative z-40">
                      <button
                        onClick={() => setApidaePanelOuvert((p) => p === 'sous_cat' ? null : 'sous_cat')}
                        className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                          apidaeFiltresSousCategories.size > 0
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-white'
                            : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                        }`}
                      >
                        Sous-types
                        {apidaeFiltresSousCategories.size > 0 && (
                          <span className="bg-cyan-500/40 text-white text-[10px] font-bold px-1 rounded">{apidaeFiltresSousCategories.size}</span>
                        )}
                        <span className="opacity-50">▾</span>
                      </button>
                      {apidaePanelOuvert === 'sous_cat' && (
                        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[220px] max-h-72 overflow-y-auto py-1">
                          {sousCategApidaeDisponibles.map((sc) => (
                            <label key={sc} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={apidaeFiltresSousCategories.has(sc)}
                                onChange={() => toggleFiltreApidae('sous_cat', sc)}
                                className="accent-cyan-500 w-3.5 h-3.5 flex-shrink-0"
                              />
                              <span className="text-xs text-white/70">{sc}</span>
                            </label>
                          ))}
                          {apidaeFiltresSousCategories.size > 0 && (
                            <button onClick={() => setApidaeFiltresSousCategories(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">
                              Tout effacer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bouton "Effacer tout" global si des filtres actifs */}
                  {nbFiltresApidaeActifs > 0 && (
                    <button
                      onClick={effacerFiltresApidae}
                      className="text-[11px] text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
                    >
                      Effacer ({nbFiltresApidaeActifs})
                    </button>
                  )}

                  {/* Sélecteur de colonnes (vue détail uniquement) */}
                  {apidaeModeVue === 'detail' && (
                    <div className="relative z-40">
                      <button
                        onClick={() => setApidaePanelOuvert((p) => p === 'colonnes' ? null : 'colonnes')}
                        className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${apidaeColsMasquees.size > 0 ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/60'}`}
                      >
                        Colonnes {apidaeColsMasquees.size > 0 && <span className="bg-white/20 text-white text-[10px] font-bold px-1 rounded">{apidaeColsMasquees.size} masq.</span>}
                        <span className="opacity-50">▾</span>
                      </button>
                      {apidaePanelOuvert === 'colonnes' && (
                        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl py-1 min-w-[160px]">
                          {['Commune','Localité Apidae','Nom','Catégorie','Sous-type','Adresse','CP','Téléphone','Capacité','Carte'].map((col) => (
                            <label key={col} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                              <input type="checkbox" checked={!apidaeColsMasquees.has(col)} onChange={() => setApidaeColsMasquees((prev) => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n })} className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs text-white/70">{col}</span>
                            </label>
                          ))}
                          {apidaeColsMasquees.size > 0 && <button onClick={() => setApidaeColsMasquees(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">Tout afficher</button>}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {onglet === 'tourinsoft' && (
                <>
                  {/* Toggle synthèse / détail */}
                  <div className="flex items-center gap-0 border border-white/15 rounded overflow-hidden text-xs">
                    <button
                      onClick={() => setTourinModeVue('synthese')}
                      className={`px-3 py-1 transition-colors ${tourinModeVue === 'synthese' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Synthèse
                    </button>
                    <button
                      onClick={() => setTourinModeVue('detail')}
                      className={`px-3 py-1 transition-colors ${tourinModeVue === 'detail' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Détail
                    </button>
                  </div>

                  {/* Overlay fermeture panels */}
                  {tourinPanelOuvert && (
                    <div className="fixed inset-0 z-30" onClick={() => setTourinPanelOuvert(null)} />
                  )}

                  {/* ── Filtre Communes ── */}
                  <div className="relative z-40">
                    <button
                      onClick={() => setTourinPanelOuvert((p) => p === 'communes' ? null : 'communes')}
                      className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                        tourinFiltresCommunes.size > 0
                          ? 'bg-brand-purple/20 border-brand-purple/40 text-white'
                          : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                      }`}
                    >
                      Communes
                      {tourinFiltresCommunes.size > 0 && (
                        <span className="bg-brand-purple/40 text-white text-[10px] font-bold px-1 rounded">{tourinFiltresCommunes.size}</span>
                      )}
                      <span className="opacity-50">▾</span>
                    </button>
                    {tourinPanelOuvert === 'communes' && (
                      <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[180px] max-h-64 overflow-y-auto py-1">
                        {communesTourinDisponibles.map((c) => (
                          <label key={c} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                            <input type="checkbox" checked={tourinFiltresCommunes.has(c)} onChange={() => toggleFiltreTourinsoft('communes', c)} className="accent-brand-purple w-3.5 h-3.5 flex-shrink-0" />
                            <span className="text-xs text-white/70">{c}</span>
                          </label>
                        ))}
                        {tourinFiltresCommunes.size > 0 && (
                          <button onClick={() => setTourinFiltresCommunes(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">
                            Tout effacer
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Filtre Catégories ── */}
                  <div className="relative z-40">
                    <button
                      onClick={() => setTourinPanelOuvert((p) => p === 'categories' ? null : 'categories')}
                      className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                        tourinFiltresCategories.size > 0
                          ? 'bg-green-500/20 border-green-500/40 text-white'
                          : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                      }`}
                    >
                      Catégories
                      {tourinFiltresCategories.size > 0 && (
                        <span className="bg-green-500/40 text-white text-[10px] font-bold px-1 rounded">{tourinFiltresCategories.size}</span>
                      )}
                      <span className="opacity-50">▾</span>
                    </button>
                    {tourinPanelOuvert === 'categories' && (
                      <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[180px] py-1">
                        {categoriesTourinDisponibles.map((cat) => (
                          <label key={cat} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                            <input type="checkbox" checked={tourinFiltresCategories.has(cat)} onChange={() => toggleFiltreTourinsoft('categories', cat)} className="accent-green-500 w-3.5 h-3.5 flex-shrink-0" />
                            <span className="text-xs text-white/70">{cat}</span>
                          </label>
                        ))}
                        {tourinFiltresCategories.size > 0 && (
                          <button onClick={() => { setTourinFiltresCategories(new Set()); setTourinFiltresSousCategories(new Set()) }} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">
                            Tout effacer
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Filtre Sous-catégories ── */}
                  {sousCategTourinDisponibles.length > 0 && (
                    <div className="relative z-40">
                      <button
                        onClick={() => setTourinPanelOuvert((p) => p === 'sous_cat' ? null : 'sous_cat')}
                        className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                          tourinFiltresSousCategories.size > 0
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-white'
                            : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                        }`}
                      >
                        Sous-types
                        {tourinFiltresSousCategories.size > 0 && (
                          <span className="bg-cyan-500/40 text-white text-[10px] font-bold px-1 rounded">{tourinFiltresSousCategories.size}</span>
                        )}
                        <span className="opacity-50">▾</span>
                      </button>
                      {tourinPanelOuvert === 'sous_cat' && (
                        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[220px] max-h-72 overflow-y-auto py-1">
                          {sousCategTourinDisponibles.map((sc) => (
                            <label key={sc} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                              <input type="checkbox" checked={tourinFiltresSousCategories.has(sc)} onChange={() => toggleFiltreTourinsoft('sous_cat', sc)} className="accent-cyan-500 w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs text-white/70">{sc}</span>
                            </label>
                          ))}
                          {tourinFiltresSousCategories.size > 0 && (
                            <button onClick={() => setTourinFiltresSousCategories(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">
                              Tout effacer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {nbFiltresTourinActifs > 0 && (
                    <button onClick={effacerFiltresTourinsoft} className="text-[11px] text-white/30 hover:text-white/60 transition-colors underline underline-offset-2">
                      Effacer ({nbFiltresTourinActifs})
                    </button>
                  )}

                  {tourinModeVue === 'detail' && (
                    <div className="relative z-40">
                      <button
                        onClick={() => setTourinPanelOuvert((p) => p === 'colonnes' ? null : 'colonnes')}
                        className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${tourinColsMasquees.size > 0 ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/60'}`}
                      >
                        Colonnes {tourinColsMasquees.size > 0 && <span className="bg-white/20 text-white text-[10px] font-bold px-1 rounded">{tourinColsMasquees.size} masq.</span>}
                        <span className="opacity-50">▾</span>
                      </button>
                      {tourinPanelOuvert === 'colonnes' && (
                        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl py-1 min-w-[160px]">
                          {['Commune','Nom','Catégorie','Sous-type','CP','Capacité','Carte'].map((col) => (
                            <label key={col} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                              <input type="checkbox" checked={!tourinColsMasquees.has(col)} onChange={() => setTourinColsMasquees((prev) => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n })} className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs text-white/70">{col}</span>
                            </label>
                          ))}
                          {tourinColsMasquees.size > 0 && <button onClick={() => setTourinColsMasquees(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">Tout afficher</button>}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {onglet === 'fusion' && (
                <>
                  {/* Toggle synthèse / détail */}
                  <div className="flex items-center gap-0 border border-white/15 rounded overflow-hidden text-xs">
                    <button
                      onClick={() => setFusionModeVue('synthese')}
                      className={`px-3 py-1 transition-colors ${fusionModeVue === 'synthese' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Synthèse
                    </button>
                    <button
                      onClick={() => setFusionModeVue('detail')}
                      className={`px-3 py-1 transition-colors ${fusionModeVue === 'detail' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}
                    >
                      Détail
                    </button>
                  </div>

                  {/* Overlay fermeture panels */}
                  {fusionPanelOuvert && (
                    <div className="fixed inset-0 z-30" onClick={() => setFusionPanelOuvert(null)} />
                  )}

                  {/* ── Filtre Communes ── */}
                  <div className="relative z-40">
                    <button
                      onClick={() => setFusionPanelOuvert((p) => p === 'communes' ? null : 'communes')}
                      className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                        fusionFiltresCommunes.size > 0
                          ? 'bg-brand-purple/20 border-brand-purple/40 text-white'
                          : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                      }`}
                    >
                      Communes
                      {fusionFiltresCommunes.size > 0 && (
                        <span className="bg-brand-purple/40 text-white text-[10px] font-bold px-1 rounded">{fusionFiltresCommunes.size}</span>
                      )}
                      <span className="opacity-50">▾</span>
                    </button>
                    {fusionPanelOuvert === 'communes' && (
                      <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[180px] max-h-64 overflow-y-auto py-1">
                        {communesFusionDisponibles.map((c) => (
                          <label key={c} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                            <input type="checkbox" checked={fusionFiltresCommunes.has(c)} onChange={() => toggleFiltreFusion('communes', c)} className="accent-brand-purple w-3.5 h-3.5 flex-shrink-0" />
                            <span className="text-xs text-white/70">{c}</span>
                          </label>
                        ))}
                        {fusionFiltresCommunes.size > 0 && (
                          <button onClick={() => setFusionFiltresCommunes(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">
                            Tout effacer
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Filtre Catégories ── */}
                  <div className="relative z-40">
                    <button
                      onClick={() => setFusionPanelOuvert((p) => p === 'categories' ? null : 'categories')}
                      className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                        fusionFiltresCategories.size > 0
                          ? 'bg-green-500/20 border-green-500/40 text-white'
                          : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                      }`}
                    >
                      Catégories
                      {fusionFiltresCategories.size > 0 && (
                        <span className="bg-green-500/40 text-white text-[10px] font-bold px-1 rounded">{fusionFiltresCategories.size}</span>
                      )}
                      <span className="opacity-50">▾</span>
                    </button>
                    {fusionPanelOuvert === 'categories' && (
                      <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[200px] py-1">
                        {categoriesFusionDisponibles.map((cat) => (
                          <label key={cat} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                            <input type="checkbox" checked={fusionFiltresCategories.has(cat)} onChange={() => toggleFiltreFusion('categories', cat)} className="accent-green-500 w-3.5 h-3.5 flex-shrink-0" />
                            <span className="text-xs text-white/70">{cat}</span>
                          </label>
                        ))}
                        {fusionFiltresCategories.size > 0 && (
                          <button onClick={() => { setFusionFiltresCategories(new Set()); setFusionFiltresSousCategories(new Set()) }} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">
                            Tout effacer
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Filtre Sous-catégories ── */}
                  {sousCategFusionDisponibles.length > 0 && (
                    <div className="relative z-40">
                      <button
                        onClick={() => setFusionPanelOuvert((p) => p === 'sous_cat' ? null : 'sous_cat')}
                        className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${
                          fusionFiltresSousCategories.size > 0
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-white'
                            : 'bg-white/8 border-white/15 text-white/60 hover:text-white/80'
                        }`}
                      >
                        Sous-types
                        {fusionFiltresSousCategories.size > 0 && (
                          <span className="bg-cyan-500/40 text-white text-[10px] font-bold px-1 rounded">{fusionFiltresSousCategories.size}</span>
                        )}
                        <span className="opacity-50">▾</span>
                      </button>
                      {fusionPanelOuvert === 'sous_cat' && (
                        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl min-w-[220px] max-h-72 overflow-y-auto py-1">
                          {sousCategFusionDisponibles.map((sc) => (
                            <label key={sc} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                              <input type="checkbox" checked={fusionFiltresSousCategories.has(sc)} onChange={() => toggleFiltreFusion('sous_cat', sc)} className="accent-cyan-500 w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs text-white/70">{sc}</span>
                            </label>
                          ))}
                          {fusionFiltresSousCategories.size > 0 && (
                            <button onClick={() => setFusionFiltresSousCategories(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">
                              Tout effacer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {nbFiltreFusionActifs > 0 && (
                    <button onClick={effacerFiltreFusion} className="text-[11px] text-white/30 hover:text-white/60 transition-colors underline underline-offset-2">
                      Effacer ({nbFiltreFusionActifs})
                    </button>
                  )}

                  {fusionModeVue === 'detail' && (
                    <div className="relative z-40">
                      <button
                        onClick={() => setFusionPanelOuvert((p) => p === 'colonnes' ? null : 'colonnes')}
                        className={`flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors ${fusionColsMasquees.size > 0 ? 'bg-white/10 border-white/25 text-white' : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/60'}`}
                      >
                        Colonnes {fusionColsMasquees.size > 0 && <span className="bg-white/20 text-white text-[10px] font-bold px-1 rounded">{fusionColsMasquees.size} masq.</span>}
                        <span className="opacity-50">▾</span>
                      </button>
                      {fusionPanelOuvert === 'colonnes' && (
                        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/15 rounded-lg shadow-xl py-1 min-w-[160px]">
                          {['Commune','Nom','Catégorie','Sous-type','Sources','CP','Capacité','Carte'].map((col) => (
                            <label key={col} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
                              <input type="checkbox" checked={!fusionColsMasquees.has(col)} onChange={() => setFusionColsMasquees((prev) => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n })} className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs text-white/70">{col}</span>
                            </label>
                          ))}
                          {fusionColsMasquees.size > 0 && <button onClick={() => setFusionColsMasquees(new Set())} className="w-full text-left px-3 py-1.5 text-[11px] text-white/30 hover:text-white/60 border-t border-white/8 mt-1">Tout afficher</button>}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Bouton export */}
              <button
                onClick={
                  onglet === 'hebergements' ? exporterHebergements
                  : onglet === 'poi' ? exporterPOI
                  : onglet === 'apidae' ? exporterApidae
                  : onglet === 'tourinsoft' ? exporterTourinsoft
                  : onglet === 'fusion' ? exporterFusion
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

            {/* ── Bloc OTA (Airbnb + Booking) — déclenchement manuel ──────────────── */}
            {onglet === 'hebergements' && (
              <div className="mx-6 mb-4">
                {otaEnCours ? (
                  /* Jauge de progression pendant le scraping */
                  <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin text-rose-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm text-white/70">
                          Scraping <span className="text-rose-300 font-medium">Airbnb</span> &amp; <span className="text-sky-300 font-medium">Booking</span> en cours…
                        </span>
                      </div>
                      <span className="text-xs text-white/40">{Math.round(otaProgression)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${otaProgression}%`, background: 'linear-gradient(90deg, #fb7185, #38bdf8)' }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-white/30">Les résultats apparaîtront automatiquement à la fin</p>
                  </div>
                ) : (
                  /* Bouton de déclenchement manuel */
                  <button
                    onClick={() => lancerOTA(communesConfirmees.map((c) => ({ nom: c.nom, code_insee: c.code_insee })))}
                    className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 rounded-xl text-sm text-white/50 hover:text-white/80 transition-all"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-rose-400/70">Airbnb</span>
                      <span className="text-white/20">&amp;</span>
                      <span className="text-sky-400/70">Booking</span>
                    </span>
                    <span className="text-white/25">·</span>
                    Lancer le scraping
                    {syntheseHebergements.some((c) => c.airbnb_total !== null) && (
                      <span className="ml-1 text-xs text-green-400/60">· données disponibles</span>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* ── Hébergements — Vue Synthèse (groupée par commune, colonnes par source) ── */}
            {onglet === 'hebergements' && modeVueHeb === 'synthese' && (
              <div className="overflow-x-auto">
                {syntheseHebergements.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucun hébergement trouvé</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs border-b border-white/5">
                        <th className="text-left px-4 py-3 font-medium w-8"></th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPar('nom')}>
                          Commune<IconTri col="nom" />
                        </th>
                        <th className="text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPar('residences_secondaires')}>
                          Rés. secondaires<IconTri col="residences_secondaires" />
                        </th>
                        {/* Une colonne par source */}
                        <th className="text-center px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPar('dt_total')}>
                          <span className="flex flex-col items-center gap-0.5">
                            <span className="text-blue-300/80">DATA Tourisme</span>
                            <IconTri col="dt_total" />
                          </span>
                        </th>
                        <th className="text-center px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPar('ts_total')}>
                          <span className="flex flex-col items-center gap-0.5">
                            <span className="text-emerald-300/80">Tourinsoft</span>
                            <IconTri col="ts_total" />
                          </span>
                        </th>
                        <th className="text-center px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPar('ap_total')}>
                          <span className="flex flex-col items-center gap-0.5">
                            <span className="text-amber-300/80">Apidae</span>
                            <IconTri col="ap_total" />
                          </span>
                        </th>
                        <th className="text-center px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPar('airbnb_total')}>
                          <span className="flex flex-col items-center gap-0.5">
                            <span className="text-rose-300/80">Airbnb</span>
                            <IconTri col="airbnb_total" />
                          </span>
                        </th>
                        <th className="text-center px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none" onClick={() => trierPar('booking_total')}>
                          <span className="flex flex-col items-center gap-0.5">
                            <span className="text-sky-300/80">Booking</span>
                            <IconTri col="booking_total" />
                          </span>
                        </th>
                        <th className="text-center px-4 py-3 font-medium whitespace-nowrap text-white/25">INSEE</th>
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

                            {/* Colonne DATA Tourisme avec tooltip sous-catégories */}
                            {([
                              { total: c.dt_total, sousCateg: c.dt_sousCateg, couleur: 'bg-blue-900/30 text-blue-300', label: 'DATA Tourisme' },
                              { total: c.ts_total, sousCateg: c.ts_sousCateg, couleur: 'bg-emerald-900/30 text-emerald-300', label: 'Tourinsoft' },
                              { total: c.ap_total, sousCateg: c.ap_sousCateg, couleur: 'bg-amber-900/30 text-amber-300', label: 'Apidae' },
                            ]).map(({ total, sousCateg, couleur, label }) => (
                              <td key={label} className="px-4 py-2.5 text-center">
                                {total > 0 ? (
                                  <div className="relative inline-block group">
                                    <span className={`inline-flex items-center justify-center min-w-[2rem] h-6 px-2 text-xs font-semibold rounded cursor-default ${couleur}`}>
                                      {total}
                                    </span>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 hidden group-hover:block pointer-events-none">
                                      <div className="w-2 h-2 bg-gray-900 border-l border-t border-white/15 rotate-45 mx-auto -mb-px relative z-10"></div>
                                      <div className="bg-gray-900 border border-white/15 rounded-lg p-3 text-xs whitespace-nowrap shadow-xl min-w-[160px]">
                                        <div className="text-white/40 font-medium mb-2 uppercase tracking-wide text-[10px]">{label}</div>
                                        <div className="space-y-1">
                                          {Object.entries(sousCateg).sort((a, b) => b[1] - a[1]).map(([sc, n]) => (
                                            <div key={sc} className="flex items-center justify-between gap-3">
                                              <span className="text-white/60">{sc}</span>
                                              <span className="font-semibold text-white/90">{n}</span>
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
                            ))}

                            {/* Airbnb */}
                            <td className="px-4 py-2.5 text-center">
                              {c.airbnb_total !== null ? (
                                <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 bg-rose-900/30 text-rose-300 text-xs font-semibold rounded">
                                  {new Intl.NumberFormat('fr-FR').format(c.airbnb_total)}
                                </span>
                              ) : (
                                <span className="text-white/20 text-xs">—</span>
                              )}
                            </td>

                            {/* Booking */}
                            <td className="px-4 py-2.5 text-center">
                              {c.booking_total !== null ? (
                                <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 bg-sky-900/30 text-sky-300 text-xs font-semibold rounded">
                                  {new Intl.NumberFormat('fr-FR').format(c.booking_total)}
                                </span>
                              ) : (
                                <span className="text-white/20 text-xs">—</span>
                              )}
                            </td>

                            {/* INSEE */}
                            <td className="px-4 py-2.5 text-center">
                              {(c.insee_hotels + c.insee_campings + c.insee_autres) > 0 ? (
                                <div className="relative inline-block group">
                                  <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 bg-cyan-900/20 text-cyan-400/70 text-xs font-semibold rounded cursor-default">
                                    {c.insee_hotels + c.insee_campings + c.insee_autres}
                                  </span>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 hidden group-hover:block pointer-events-none">
                                    <div className="w-2 h-2 bg-gray-900 border-l border-t border-white/15 rotate-45 mx-auto -mb-px relative z-10"></div>
                                    <div className="bg-gray-900 border border-white/15 rounded-lg p-3 text-xs whitespace-nowrap shadow-xl min-w-[160px]">
                                      <div className="text-white/40 font-medium mb-2 uppercase tracking-wide text-[10px]">INSEE DS_TOUR_CAP</div>
                                      <div className="space-y-1">
                                        {c.insee_hotels > 0 && <div className="flex justify-between gap-3"><span className="text-white/60">Hôtels</span><span className="text-cyan-300">{c.insee_hotels}</span></div>}
                                        {c.insee_campings > 0 && <div className="flex justify-between gap-3"><span className="text-white/60">Campings</span><span className="text-cyan-300">{c.insee_campings}</span></div>}
                                        {c.insee_autres > 0 && <div className="flex justify-between gap-3"><span className="text-white/60">Autres</span><span className="text-cyan-300">{c.insee_autres}</span></div>}
                                        {c.isbn_cap_chambres > 0 && <div className="flex justify-between gap-3 pt-1 mt-1 border-t border-white/10"><span className="text-white/40">Chambres hôtels</span><span className="text-cyan-400/70">{c.isbn_cap_chambres}</span></div>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-white/20 text-xs">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Lignes détail si commune ouverte */}
                          {communesOuvertes.has(c.code_insee) && c.etablissements.map((e) => (
                            <tr key={`detail-${c.code_insee}-${e.uuid}`} className="border-b border-white/[0.03] bg-white/[0.04]">
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 text-white/50 text-xs pl-8 max-w-[200px] truncate">{e.nom}</td>
                              <td className="px-4 py-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-full ${
                                  e.source === 'datatourisme' ? 'bg-blue-900/30 text-blue-300' :
                                  e.source === 'tourinsoft'   ? 'bg-emerald-900/30 text-emerald-300' :
                                                                'bg-amber-900/30 text-amber-300'
                                }`}>{e.source}</span>
                                <span className="ml-1.5 bg-white/5 text-white/40 px-2 py-0.5 rounded-full">{e.sous_categorie}</span>
                                {e.telephone && <span className="ml-2 text-white/30">{e.telephone}</span>}
                              </td>
                              <td className="px-4 py-2 text-white/30 text-xs" colSpan={6}>
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
                          { label: 'Source',    col: null },
                          { label: 'Type',      col: 'sous_categorie' },
                          { label: 'Adresse',   col: null },
                          { label: 'Téléphone', col: null },
                          { label: 'Capacité',  col: 'capacite' },
                          { label: 'GPS',       col: null },
                        ] as { label: string; col: string | null }[]).map(({ label, col }) =>
                          col ? (
                            <th key={label} className={`text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none ${hebDetColsMasquees.has(label) ? 'hidden' : ''}`} onClick={() => trierHebDet(col)}>
                              {label}<IconTriGen col={col} sortCol={sortHebDetCol} sortDir={sortHebDetDir} />
                            </th>
                          ) : (
                            <th key={label} className={`text-left px-4 py-3 font-medium whitespace-nowrap ${hebDetColsMasquees.has(label) ? 'hidden' : ''}`}>{label}</th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {hebDetTriee.map((e, i) => (
                        <tr key={`${e.commune}-${e.uuid}`} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                          <td className={`px-4 py-2.5 text-white/70 whitespace-nowrap ${hebDetColsMasquees.has('Commune') ? 'hidden' : ''}`}>{e.commune}</td>
                          <td className={`px-4 py-2.5 text-white font-medium max-w-[200px] truncate ${hebDetColsMasquees.has('Nom') ? 'hidden' : ''}`}>{e.nom}</td>
                          <td className={`px-4 py-2.5 ${hebDetColsMasquees.has('Source') ? 'hidden' : ''}`}>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              e.source === 'datatourisme' ? 'bg-blue-900/40 text-blue-300' :
                              e.source === 'tourinsoft'   ? 'bg-emerald-900/40 text-emerald-300' :
                                                            'bg-amber-900/40 text-amber-300'
                            }`}>{e.source === 'datatourisme' ? 'DATA' : e.source === 'tourinsoft' ? 'ANMSM' : 'Apidae'}</span>
                          </td>
                          <td className={`px-4 py-2.5 ${hebDetColsMasquees.has('Type') ? 'hidden' : ''}`}>
                            <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{e.sous_categorie}</span>
                          </td>
                          <td className={`px-4 py-2.5 text-white/50 text-xs max-w-[180px] truncate ${hebDetColsMasquees.has('Adresse') ? 'hidden' : ''}`}>{e.adresse ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-white/50 text-xs whitespace-nowrap ${hebDetColsMasquees.has('Téléphone') ? 'hidden' : ''}`}>{e.telephone ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-white/70 text-xs text-center ${hebDetColsMasquees.has('Capacité') ? 'hidden' : ''}`}>{e.capacite ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-white/30 text-xs whitespace-nowrap ${hebDetColsMasquees.has('GPS') ? 'hidden' : ''}`}>
                            {e.lat && e.lng ? `${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── POI — Vue Synthèse : catégorie principale → 3 sources (DATA | ANMSM | Apidae) ── */}
            {onglet === 'poi' && modeVuePOI === 'synthese' && (
              <div className="overflow-x-auto">
                {synthesePOI.lignes.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucun POI trouvé</p>
                ) : (() => {
                  // Couleur d'accent par catégorie
                  const couleurCat = (cat: string) =>
                    cat === 'activites'   ? { header: 'text-emerald-300', border: 'border-emerald-700/30' } :
                    cat === 'culture'     ? { header: 'text-purple-300',  border: 'border-purple-700/30'  } :
                    cat === 'equipements' ? { header: 'text-orange-300',  border: 'border-orange-700/30'  } :
                    cat === 'services'    ? { header: 'text-amber-300',   border: 'border-amber-700/30'   } :
                                           { header: 'text-blue-300',    border: 'border-blue-700/30'    }

                  const SOURCES: Array<{ key: 'datatourisme' | 'tourinsoft' | 'apidae'; label: string; cls: string }> = [
                    { key: 'datatourisme', label: 'DATA', cls: 'text-blue-300/70' },
                    { key: 'tourinsoft',   label: 'ANMSM', cls: 'text-emerald-300/70' },
                    { key: 'apidae',       label: 'Apidae', cls: 'text-amber-300/70' },
                  ]

                  return (
                    <table className="w-full text-sm">
                      <thead>
                        {/* Ligne 1 : Commune + Total + une cellule par catégorie (colspan=3) */}
                        <tr className="text-white/40 text-xs">
                          <th
                            rowSpan={2}
                            className="text-left px-4 py-2 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none align-bottom border-b border-white/5"
                            onClick={() => trierPOISyn('nom')}
                          >
                            Commune<IconTriGen col="nom" sortCol={sortPOISynCol} sortDir={sortPOISynDir} />
                          </th>
                          <th
                            rowSpan={2}
                            className="text-center px-4 py-2 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none align-bottom border-b border-white/5"
                            onClick={() => trierPOISyn('total')}
                          >
                            Total<IconTriGen col="total" sortCol={sortPOISynCol} sortDir={sortPOISynDir} />
                          </th>
                          {synthesePOI.categories.map((cat) => {
                            const { header, border } = couleurCat(cat)
                            return (
                              <th
                                key={cat}
                                colSpan={3}
                                className={`text-center px-2 py-2 font-medium whitespace-nowrap capitalize cursor-pointer select-none border-b ${border} ${header} hover:opacity-80`}
                                onClick={() => trierPOISyn(cat)}
                              >
                                {cat}<IconTriGen col={cat} sortCol={sortPOISynCol} sortDir={sortPOISynDir} />
                              </th>
                            )
                          })}
                        </tr>
                        {/* Ligne 2 : DATA | ANMSM | Apidae pour chaque catégorie */}
                        <tr className="text-white/25 text-[10px] border-b border-white/5">
                          {synthesePOI.categories.flatMap((cat) =>
                            SOURCES.map(({ key, label, cls }) => (
                              <th key={`${cat}-${key}`} className={`text-center px-3 py-1.5 font-medium whitespace-nowrap ${cls}`}>
                                {label}
                              </th>
                            ))
                          )}
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
                            {synthesePOI.categories.flatMap((cat) => {
                              const src = c.parSource[cat] ?? {}
                              return SOURCES.map(({ key, cls }) => {
                                const n = src[key] ?? 0
                                // Sous-catégories spécifiques à cette source et cette catégorie
                                const sousCateg = Object.entries(
                                  c.parSourceSousCateg[cat]?.[key] ?? {}
                                ).sort((a, b) => b[1] - a[1])
                                return (
                                  <td key={`${cat}-${key}`} className="px-2 py-2.5 text-center">
                                    {n > 0 ? (
                                      <div className="relative inline-block group">
                                        <span className={`text-xs font-semibold cursor-default ${cls.replace('/70', '')}`}>{n}</span>
                                        {sousCateg.length > 0 && (
                                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 hidden group-hover:block pointer-events-none">
                                            <div className="w-2 h-2 bg-gray-900 border-l border-t border-white/15 rotate-45 mx-auto -mb-px relative z-10"></div>
                                            <div className="bg-gray-900 border border-white/15 rounded-lg p-3 text-xs whitespace-nowrap shadow-xl min-w-[160px]">
                                              <div className={`font-medium mb-2 uppercase tracking-wide text-[10px] capitalize ${cls}`}>
                                                {cat} · {key === 'datatourisme' ? 'DATA' : key === 'tourinsoft' ? 'ANMSM' : 'Apidae'}
                                              </div>
                                              <div className="space-y-1">
                                                {sousCateg.map(([sc, count]) => (
                                                  <div key={sc} className="flex items-center justify-between gap-3">
                                                    <span className="text-white/60">{sc.replace(/_/g, ' ')}</span>
                                                    <span className="font-semibold text-white/90">{count}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-white/15 text-xs">—</span>
                                    )}
                                  </td>
                                )
                              })
                            })}
                          </tr>
                        ))}
                        {/* Ligne totaux */}
                        <tr className="border-t border-white/10 bg-white/[0.02]">
                          <td className="px-4 py-2.5 text-white/40 text-xs font-medium">Total</td>
                          <td className="px-4 py-2.5 text-center text-white/60 text-xs font-semibold">
                            {synthesePOI.lignes.reduce((s, c) => s + c.total, 0)}
                          </td>
                          {synthesePOI.categories.flatMap((cat) =>
                            SOURCES.map(({ key, cls }) => (
                              <td key={`total-${cat}-${key}`} className={`px-2 py-2.5 text-center text-xs font-semibold ${cls.replace('/70', '/50')}`}>
                                {synthesePOI.lignes.reduce((s, c) => s + (c.parSource[cat]?.[key] ?? 0), 0) || '—'}
                              </td>
                            ))
                          )}
                        </tr>
                      </tbody>
                    </table>
                  )
                })()}
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
                          { label: 'Source',    col: null },
                          { label: 'Catégorie', col: 'categorie' },
                          { label: 'Type',      col: 'sous_categorie' },
                          { label: 'Adresse',   col: null },
                          { label: 'Téléphone', col: null },
                          { label: 'GPS',       col: null },
                        ] as { label: string; col: string | null }[]).map(({ label, col }) =>
                          col ? (
                            <th key={label} className={`text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none ${poiDetColsMasquees.has(label) ? 'hidden' : ''}`} onClick={() => trierPOIDet(col)}>
                              {label}<IconTriGen col={col} sortCol={sortPOIDetCol} sortDir={sortPOIDetDir} />
                            </th>
                          ) : (
                            <th key={label} className={`text-left px-4 py-3 font-medium whitespace-nowrap ${poiDetColsMasquees.has(label) ? 'hidden' : ''}`}>{label}</th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {poiDetTriee.map((e, i) => (
                        <tr key={`${e.commune}-${e.uuid}`} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                          <td className={`px-4 py-2.5 text-white/70 whitespace-nowrap ${poiDetColsMasquees.has('Commune') ? 'hidden' : ''}`}>{e.commune}</td>
                          <td className={`px-4 py-2.5 text-white font-medium max-w-[200px] truncate ${poiDetColsMasquees.has('Nom') ? 'hidden' : ''}`}>{e.nom}</td>
                          <td className={`px-4 py-2.5 ${poiDetColsMasquees.has('Source') ? 'hidden' : ''}`}>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              e.source === 'datatourisme' ? 'bg-blue-900/40 text-blue-300' :
                              e.source === 'tourinsoft'   ? 'bg-emerald-900/40 text-emerald-300' :
                                                            'bg-amber-900/40 text-amber-300'
                            }`}>{e.source === 'datatourisme' ? 'DATA' : e.source === 'tourinsoft' ? 'ANMSM' : 'Apidae'}</span>
                          </td>
                          <td className={`px-4 py-2.5 ${poiDetColsMasquees.has('Catégorie') ? 'hidden' : ''}`}>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              e.categorie === 'activites'   ? 'bg-emerald-900/40 text-emerald-300' :
                              e.categorie === 'culture'     ? 'bg-purple-900/40 text-purple-300'   :
                              e.categorie === 'services'    ? 'bg-amber-900/40 text-amber-300'     :
                              e.categorie === 'equipements' ? 'bg-orange-900/40 text-orange-300'   :
                                                              'bg-blue-900/40 text-blue-300'
                            }`}>{e.categorie}</span>
                          </td>
                          <td className={`px-4 py-2.5 ${poiDetColsMasquees.has('Type') ? 'hidden' : ''}`}>
                            <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{e.sous_categorie}</span>
                          </td>
                          <td className={`px-4 py-2.5 text-white/50 text-xs max-w-[180px] truncate ${poiDetColsMasquees.has('Adresse') ? 'hidden' : ''}`}>{e.adresse ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-white/50 text-xs whitespace-nowrap ${poiDetColsMasquees.has('Téléphone') ? 'hidden' : ''}`}>{e.telephone ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-white/30 text-xs whitespace-nowrap ${poiDetColsMasquees.has('GPS') ? 'hidden' : ''}`}>
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
                          <th key={label} className={`text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none ${taxeColsMasquees.has(label) ? 'hidden' : ''}`} onClick={() => trierTaxe(col)}>
                            {label}<IconTriGen col={col} sortCol={sortTaxeCol} sortDir={sortTaxeDir} />
                          </th>
                        ))}
                        {/* Colonne Part EPCI avec tooltip formule */}
                        <th className={`text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none ${taxeColsMasquees.has('Part EPCI') ? 'hidden' : ''}`} onClick={() => trierTaxe('part_epci_pct')}>
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
                          <th key={label} className={`text-left px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white/70 select-none ${taxeColsMasquees.has(label) ? 'hidden' : ''}`} onClick={() => trierTaxe(col)}>
                            {label}<IconTriGen col={col} sortCol={sortTaxeCol} sortDir={sortTaxeDir} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {taxeTriee.map((r, i) => (
                        <tr key={r.commune.code_insee} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                          <td className={`px-4 py-2.5 text-white/70 whitespace-nowrap ${taxeColsMasquees.has('Commune') ? 'hidden' : ''}`}>{r.commune.nom}</td>
                          <td className={`px-4 py-2.5 ${taxeColsMasquees.has('Collecteur') ? 'hidden' : ''}`}>
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
                          <td className={`px-4 py-2.5 text-white/60 text-xs max-w-[180px] truncate ${taxeColsMasquees.has('Nom collecteur') ? 'hidden' : ''}`}>{r.taxe?.nom_collecteur ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-white font-medium whitespace-nowrap ${taxeColsMasquees.has('Montant total') ? 'hidden' : ''}`}>
                            {r.taxe?.montant_total ? formaterMontant(r.taxe.montant_total) : '—'}
                          </td>
                          <td className={`px-4 py-2.5 text-white/70 whitespace-nowrap ${taxeColsMasquees.has('Estimé commune') ? 'hidden' : ''}`}>
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
                          <td className={`px-4 py-2.5 text-xs ${taxeColsMasquees.has('Part EPCI') ? 'hidden' : ''}`}>
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
                          <td className={`px-4 py-2.5 text-white/50 text-xs ${taxeColsMasquees.has('Année') ? 'hidden' : ''}`}>{r.taxe?.annee ?? '—'}</td>
                          <td className={`px-4 py-2.5 text-white/50 text-xs whitespace-nowrap ${taxeColsMasquees.has('Nuitées est.') ? 'hidden' : ''}`}>
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

            {/* ── Vue Apidae ────────────────────────────────────────────────── */}
            {onglet === 'apidae' && (
              <div>
                {/* Bandeau compteurs */}
                <div className="flex items-center gap-5 px-6 py-3 border-b border-white/5 text-xs text-white/40 flex-wrap">
                  <span>
                    <span className="text-white/70 font-medium">{itemsApidaeFiltres.length}</span> objet{itemsApidaeFiltres.length > 1 ? 's' : ''}
                    {tousItemsApidae.length !== itemsApidaeFiltres.length && (
                      <span className="ml-1 text-white/25">/ {tousItemsApidae.length}</span>
                    )}
                  </span>
                  {syntheseApidae.map((g) => (
                    <span key={g.categorie} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        g.categorie === 'hebergements' ? 'bg-blue-400' :
                        g.categorie === 'activites'    ? 'bg-green-400' :
                        g.categorie === 'culture'      ? 'bg-purple-400' :
                        g.categorie === 'services'     ? 'bg-orange-400' :
                        g.categorie === 'equipements'  ? 'bg-cyan-400' : 'bg-white/40'
                      }`} />
                      <span className="text-white/60 font-medium">{g.total}</span> {g.categorie}
                      {g.capacite_totale !== null && (
                        <span className="text-white/25 ml-0.5">· {g.capacite_totale.toLocaleString('fr-FR')} unités</span>
                      )}
                    </span>
                  ))}
                </div>

                {itemsApidaeFiltres.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucun objet Apidae trouvé pour ces filtres</p>

                ) : apidaeModeVue === 'synthese' ? (
                  /* ── VUE SYNTHÈSE : catégorie > sous-catégorie > localité ── */
                  <div className="p-6 space-y-4">
                    {syntheseApidae.map((groupe) => (
                      <div key={groupe.categorie} className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                        {/* En-tête catégorie */}
                        <div className={`flex items-center gap-3 px-5 py-3 border-b border-white/8 ${
                          groupe.categorie === 'hebergements' ? 'bg-blue-500/8' :
                          groupe.categorie === 'activites'    ? 'bg-green-500/8' :
                          groupe.categorie === 'culture'      ? 'bg-purple-500/8' :
                          groupe.categorie === 'services'     ? 'bg-orange-500/8' :
                          groupe.categorie === 'equipements'  ? 'bg-cyan-500/8' : 'bg-white/5'
                        }`}>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            groupe.categorie === 'hebergements' ? 'bg-blue-500/20 text-blue-300' :
                            groupe.categorie === 'activites'    ? 'bg-green-500/20 text-green-300' :
                            groupe.categorie === 'culture'      ? 'bg-purple-500/20 text-purple-300' :
                            groupe.categorie === 'services'     ? 'bg-orange-500/20 text-orange-300' :
                            groupe.categorie === 'equipements'  ? 'bg-cyan-500/20 text-cyan-300' :
                            'bg-white/10 text-white/50'
                          }`}>
                            {groupe.categorie}
                          </span>
                          <span className="text-white font-semibold text-sm">{groupe.total} objets</span>
                          {groupe.capacite_totale !== null && (
                            <span className="text-white/40 text-xs">
                              · capacité totale <span className="text-white/60 font-medium">{groupe.capacite_totale.toLocaleString('fr-FR')}</span>
                              <span className="text-white/25 ml-1">({groupe.nb_avec_capacite} fiches)</span>
                            </span>
                          )}
                        </div>

                        {/* Tableau sous-catégories */}
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-white/30 border-b border-white/5">
                              <th className="text-left px-5 py-2 font-medium">Sous-type</th>
                              <th className="text-right px-4 py-2 font-medium w-16">Nb</th>
                              <th className="text-right px-4 py-2 font-medium w-24">Capacité</th>
                              <th className="text-left px-4 py-2 font-medium">Répartition par localité</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupe.sous_categories.map((sc, si) => (
                              <tr key={sc.nom} className={`border-b border-white/[0.04] ${si % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                                <td className="px-5 py-2.5 text-white/70">{sc.nom}</td>
                                <td className="px-4 py-2.5 text-right text-white font-semibold tabular-nums">{sc.total}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  {sc.capacite !== null
                                    ? <span className="text-white/60">{sc.capacite.toLocaleString('fr-FR')}</span>
                                    : <span className="text-white/20">—</span>
                                  }
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex flex-wrap gap-1.5">
                                    {sc.par_localite.map(({ loc, count }) => (
                                      <span key={loc} className="inline-flex items-center gap-1 bg-white/8 border border-white/10 rounded px-1.5 py-0.5 text-[11px]">
                                        <span className="text-white/50">{loc}</span>
                                        <span className="text-white font-semibold">{count}</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                ) : (
                  /* ── VUE DÉTAIL : tableau ligne par ligne ── */
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/40 text-xs border-b border-white/5">
                          {([
                            ['Commune',         'commune_admin'],
                            ['Localité Apidae', 'localite'],
                            ['Nom',             'nom'],
                            ['Catégorie',       'categorie'],
                            ['Sous-type',       'sous_cat'],
                            ['Adresse',         'adresse'],
                            ['CP',              'cp'],
                            ['Téléphone',       null],
                            ['Capacité',        'capacite'],
                            ['Carte',           null],
                          ] as [string, string | null][]).map(([label, col]) => (
                            <th
                              key={label}
                              className={`text-left px-3 py-3 font-medium whitespace-nowrap select-none ${col ? 'cursor-pointer hover:text-white/70' : ''} ${apidaeColsMasquees.has(label) ? 'hidden' : ''}`}
                              onClick={() => col && trierApidae(col)}
                            >
                              {label}
                              {col && <IconTriGen col={col} sortCol={sortApidaeCol} sortDir={sortApidaeDir} />}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {apidaeTriee.map((e, i) => (
                          <tr key={e.uuid} className={`border-b border-white/5 hover:bg-white/[0.03] ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                            <td className={`px-3 py-2 text-white/60 whitespace-nowrap text-xs ${apidaeColsMasquees.has('Commune') ? 'hidden' : ''}`}>{e.commune_admin}</td>
                            <td className={`px-3 py-2 text-xs ${apidaeColsMasquees.has('Localité Apidae') ? 'hidden' : ''}`}>
                              {e.localite_apidae ? (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  e.localite_apidae === e.commune_admin
                                    ? 'bg-white/8 text-white/40'
                                    : 'bg-amber-500/15 text-amber-300/80'
                                }`}>
                                  {e.localite_apidae}
                                </span>
                              ) : <span className="text-white/20">—</span>}
                            </td>
                            <td className={`px-3 py-2 text-white font-medium max-w-[200px] ${apidaeColsMasquees.has('Nom') ? 'hidden' : ''}`}>
                              <span className="block truncate" title={e.nom}>{e.nom}</span>
                            </td>
                            <td className={`px-3 py-2 text-xs ${apidaeColsMasquees.has('Catégorie') ? 'hidden' : ''}`}>
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                e.categorie === 'hebergements' ? 'bg-blue-500/15 text-blue-300' :
                                e.categorie === 'activites'    ? 'bg-green-500/15 text-green-300' :
                                e.categorie === 'culture'      ? 'bg-purple-500/15 text-purple-300' :
                                e.categorie === 'services'     ? 'bg-orange-500/15 text-orange-300' :
                                e.categorie === 'equipements'  ? 'bg-cyan-500/15 text-cyan-300' :
                                'bg-white/10 text-white/40'
                              }`}>
                                {e.categorie}
                              </span>
                            </td>
                            <td className={`px-3 py-2 text-white/50 text-xs max-w-[140px] ${apidaeColsMasquees.has('Sous-type') ? 'hidden' : ''}`}>
                              <span className="block truncate" title={e.sous_categorie}>{e.sous_categorie}</span>
                            </td>
                            <td className={`px-3 py-2 text-white/50 text-xs max-w-[160px] ${apidaeColsMasquees.has('Adresse') ? 'hidden' : ''}`}>
                              <span className="block truncate" title={e.adresse ?? ''}>{e.adresse ?? '—'}</span>
                            </td>
                            <td className={`px-3 py-2 text-white/40 text-xs whitespace-nowrap ${apidaeColsMasquees.has('CP') ? 'hidden' : ''}`}>{e.code_postal ?? '—'}</td>
                            <td className={`px-3 py-2 text-white/40 text-xs whitespace-nowrap ${apidaeColsMasquees.has('Téléphone') ? 'hidden' : ''}`}>
                              {e.telephone
                                ? <a href={`tel:${e.telephone}`} className="hover:text-white/70 transition-colors">{e.telephone}</a>
                                : '—'}
                            </td>
                            <td className={`px-3 py-2 text-right ${apidaeColsMasquees.has('Capacité') ? 'hidden' : ''}`}>
                              {e.capacite !== null
                                ? <span className="text-white/70 text-xs font-medium tabular-nums">{e.capacite}</span>
                                : <span className="text-white/20 text-xs">—</span>}
                            </td>
                            <td className={`px-3 py-2 text-center ${apidaeColsMasquees.has('Carte') ? 'hidden' : ''}`}>
                              {e.lat !== null && e.lng !== null ? (
                                <a
                                  href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-white/25 hover:text-white/50 transition-colors"
                                  title={`${e.lat}, ${e.lng}`}
                                >
                                  📍
                                </a>
                              ) : <span className="text-white/15 text-xs">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Vue Fusion Apidae × Tourinsoft ─────────────────────────────── */}
            {onglet === 'fusion' && (
              <div>
                {/* Bandeau stats */}
                <div className="flex items-center gap-5 px-6 py-3 border-b border-white/5 text-xs text-white/40 flex-wrap">
                  <span>
                    <span className="text-white/70 font-medium">{itemsFusionFiltres.length}</span> objet{itemsFusionFiltres.length > 1 ? 's' : ''}
                    {itemsFusionBruts.length !== itemsFusionFiltres.length && (
                      <span className="ml-1 text-white/25">/ {itemsFusionBruts.length}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    <span className="text-violet-300 font-medium">{pairesActives.size}</span> dédoublonnés
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-white/60 font-medium">{tousItemsApidae.length - apIdsMerges.size}</span> solo Apidae
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                    <span className="text-white/60 font-medium">{tousItemsTourinsoft.length - tsIdsMerges.size}</span> solo Tourinsoft
                  </span>
                </div>

                {itemsFusionFiltres.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucun objet trouvé pour ces filtres</p>

                ) : fusionModeVue === 'synthese' ? (
                  /* ── VUE SYNTHÈSE : catégorie unifiée > sous-catégorie > commune ── */
                  <div className="p-6 space-y-4">
                    {syntheseFusion.map((groupe) => (
                      <div key={groupe.cat} className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 bg-white/5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300">
                            {groupe.cat}
                          </span>
                          <span className="text-white font-semibold text-sm">{groupe.total} objets</span>
                          {groupe.nb_merges > 0 && (
                            <span className="text-violet-400/60 text-xs">
                              · <span className="text-violet-300 font-medium">{groupe.nb_merges}</span> dédoublonnés
                            </span>
                          )}
                          {groupe.capacite_totale !== null && (
                            <span className="text-white/40 text-xs">
                              · <span className="text-white/60 font-medium">{groupe.capacite_totale.toLocaleString('fr-FR')}</span> capacité
                            </span>
                          )}
                        </div>

                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-white/30 border-b border-white/5">
                              <th className="text-left px-5 py-2 font-medium">Sous-type</th>
                              <th className="text-right px-4 py-2 font-medium w-16">Nb</th>
                              <th className="text-right px-4 py-2 font-medium w-20">Dédoub.</th>
                              <th className="text-right px-4 py-2 font-medium w-24">Capacité</th>
                              <th className="text-left px-4 py-2 font-medium">Répartition par commune</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupe.sous_categories.map((sc, si) => (
                              <tr key={sc.nom} className={`border-b border-white/[0.04] ${si % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                                <td className="px-5 py-2.5 text-white/70">{sc.nom}</td>
                                <td className="px-4 py-2.5 text-right text-white font-semibold tabular-nums">{sc.total}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  {sc.nb_merges > 0
                                    ? <span className="text-violet-300 font-medium">{sc.nb_merges}</span>
                                    : <span className="text-white/20">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  {sc.capacite !== null
                                    ? <span className="text-white/60">{sc.capacite.toLocaleString('fr-FR')}</span>
                                    : <span className="text-white/20">—</span>}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex flex-wrap gap-1.5">
                                    {sc.par_commune.map(({ c, n }) => (
                                      <span key={c} className="inline-flex items-center gap-1 bg-white/8 border border-white/10 rounded px-1.5 py-0.5 text-[11px]">
                                        <span className="text-white/50">{c}</span>
                                        <span className="text-white font-semibold">{n}</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                ) : (
                  /* ── VUE DÉTAIL : tableau ligne par ligne ── */
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/40 text-xs border-b border-white/5">
                          {([
                            ['Commune',      'commune'],
                            ['Nom',          'nom'],
                            ['Catégorie',    'cat'],
                            ['Sous-type',    'souscat'],
                            ['Sources',      null],
                            ['CP',           'cp'],
                            ['Capacité',     'cap'],
                            ['Carte',        null],
                          ] as [string, string | null][]).map(([label, col]) => (
                            <th
                              key={label}
                              className={`text-left px-3 py-3 font-medium whitespace-nowrap select-none ${col ? 'cursor-pointer hover:text-white/70' : ''} ${fusionColsMasquees.has(label) ? 'hidden' : ''}`}
                              onClick={() => col && trierFusion(col)}
                            >
                              {label}
                              {col && <IconTriGen col={col} sortCol={sortFusionCol} sortDir={sortFusionDir} />}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fusionTriee.map((e, i) => (
                          <tr key={e.id} className={`border-b border-white/5 hover:bg-white/[0.03] ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                            <td className={`px-3 py-2 text-white/60 whitespace-nowrap text-xs ${fusionColsMasquees.has('Commune') ? 'hidden' : ''}`}>{e.commune_admin}</td>
                            <td className={`px-3 py-2 text-white font-medium max-w-[220px] ${fusionColsMasquees.has('Nom') ? 'hidden' : ''}`}>
                              <span className="block truncate" title={e.nom}>{e.nom}</span>
                              {(e.nom_apidae || e.nom_tourinsoft) && (
                                <span className="block text-[10px] text-white/30 truncate mt-0.5">
                                  {e.nom_apidae && <span className="text-blue-300/50">Ap: {e.nom_apidae}</span>}
                                  {e.nom_apidae && e.nom_tourinsoft && <span className="mx-1 text-white/20">·</span>}
                                  {e.nom_tourinsoft && <span className="text-teal-300/50">Ts: {e.nom_tourinsoft}</span>}
                                </span>
                              )}
                            </td>
                            <td className={`px-3 py-2 text-xs ${fusionColsMasquees.has('Catégorie') ? 'hidden' : ''}`}>
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/15 text-violet-300">
                                {e.cat_unif}
                              </span>
                            </td>
                            <td className={`px-3 py-2 text-white/50 text-xs max-w-[160px] ${fusionColsMasquees.has('Sous-type') ? 'hidden' : ''}`}>
                              <span className="block truncate" title={e.souscat_unif}>{e.souscat_unif}</span>
                            </td>
                            <td className={`px-3 py-2 text-xs ${fusionColsMasquees.has('Sources') ? 'hidden' : ''}`}>
                              <div className="flex gap-1 flex-wrap">
                                {e.sources.includes('apidae') && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 whitespace-nowrap">Apidae</span>
                                )}
                                {e.sources.includes('tourinsoft') && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/15 text-teal-300 whitespace-nowrap">Tourinsoft</span>
                                )}
                              </div>
                            </td>
                            <td className={`px-3 py-2 text-white/40 text-xs whitespace-nowrap ${fusionColsMasquees.has('CP') ? 'hidden' : ''}`}>{e.code_postal ?? '—'}</td>
                            <td className={`px-3 py-2 text-right ${fusionColsMasquees.has('Capacité') ? 'hidden' : ''}`}>
                              {e.capacite !== null
                                ? <span className="text-white/70 text-xs font-medium tabular-nums">{e.capacite}</span>
                                : <span className="text-white/20 text-xs">—</span>}
                            </td>
                            <td className={`px-3 py-2 text-center ${fusionColsMasquees.has('Carte') ? 'hidden' : ''}`}>
                              {e.lat !== null && e.lng !== null ? (
                                <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noopener noreferrer" className="text-white/25 hover:text-white/50 transition-colors" title={`${e.lat}, ${e.lng}`}>
                                  📍
                                </a>
                              ) : <span className="text-white/15 text-xs">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Panneau doublons détectés ── */}
                {pairesDoublons.length > 0 && (
                  <div className="mx-6 mb-6 mt-4 border border-violet-500/20 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3 bg-violet-500/8 border-b border-violet-500/15">
                      <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                      <span className="text-xs text-violet-300 font-medium">
                        {pairesDoublons.length} doublon{pairesDoublons.length > 1 ? 's' : ''} détecté{pairesDoublons.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-white/25 ml-1">— Décocher pour afficher séparément</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {pairesDoublons.map((p) => {
                        const exclue = fusionPairesExclues.has(p.id)
                        return (
                          <label key={p.id} className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.03] ${exclue ? 'opacity-40' : ''}`}>
                            <input
                              type="checkbox"
                              checked={!exclue}
                              onChange={() => {
                                setFusionPairesExclues((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(p.id)) next.delete(p.id)
                                  else next.add(p.id)
                                  return next
                                })
                              }}
                              className="accent-violet-400 w-3.5 h-3.5 flex-shrink-0"
                            />
                            <span className="text-xs text-white/40 w-24 flex-shrink-0 truncate">{p.commune_admin}</span>
                            <span className="flex items-center gap-2 text-xs min-w-0">
                              <span className="text-blue-300/80 truncate max-w-[180px]" title={p.nom_apidae}>{p.nom_apidae}</span>
                              <span className="text-white/20 flex-shrink-0">↔</span>
                              <span className="text-teal-300/80 truncate max-w-[180px]" title={p.nom_tourinsoft}>{p.nom_tourinsoft}</span>
                            </span>
                            <span className="ml-auto text-[10px] text-white/25 flex-shrink-0">{p.cat_unif}</span>
                          </label>
                        )
                      })}
                    </div>
                    {fusionPairesExclues.size > 0 && (
                      <div className="px-5 py-2 border-t border-white/5 bg-white/[0.02]">
                        <button
                          onClick={() => setFusionPairesExclues(new Set())}
                          className="text-[11px] text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
                        >
                          Tout réactiver ({fusionPairesExclues.size} exclus)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Vue Tourinsoft ────────────────────────────────────────────── */}
            {onglet === 'tourinsoft' && (
              <div>
                {/* Bandeau compteurs */}
                <div className="flex items-center gap-5 px-6 py-3 border-b border-white/5 text-xs text-white/40 flex-wrap">
                  <span>
                    <span className="text-white/70 font-medium">{itemsTourinFiltres.length}</span> objet{itemsTourinFiltres.length > 1 ? 's' : ''}
                    {tousItemsTourinsoft.length !== itemsTourinFiltres.length && (
                      <span className="ml-1 text-white/25">/ {tousItemsTourinsoft.length}</span>
                    )}
                  </span>
                  {syntheseTourinsoft.map((g) => (
                    <span key={g.categorie} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        g.categorie === 'hebergements' ? 'bg-blue-400' :
                        g.categorie === 'activites'    ? 'bg-green-400' :
                        g.categorie === 'services'     ? 'bg-orange-400' : 'bg-white/40'
                      }`} />
                      <span className="text-white/60 font-medium">{g.total}</span> {g.categorie}
                      {g.capacite_totale !== null && (
                        <span className="text-white/25 ml-0.5">· {g.capacite_totale.toLocaleString('fr-FR')} lits</span>
                      )}
                    </span>
                  ))}
                </div>

                {itemsTourinFiltres.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-12">Aucun objet Tourinsoft trouvé pour ces filtres</p>

                ) : tourinModeVue === 'synthese' ? (
                  /* ── VUE SYNTHÈSE : catégorie > sous-catégorie > commune ── */
                  <div className="p-6 space-y-4">
                    {syntheseTourinsoft.map((groupe) => (
                      <div key={groupe.categorie} className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                        {/* En-tête catégorie */}
                        <div className={`flex items-center gap-3 px-5 py-3 border-b border-white/8 ${
                          groupe.categorie === 'hebergements' ? 'bg-blue-500/8' :
                          groupe.categorie === 'activites'    ? 'bg-green-500/8' :
                          groupe.categorie === 'services'     ? 'bg-orange-500/8' : 'bg-white/5'
                        }`}>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            groupe.categorie === 'hebergements' ? 'bg-blue-500/20 text-blue-300' :
                            groupe.categorie === 'activites'    ? 'bg-green-500/20 text-green-300' :
                            groupe.categorie === 'services'     ? 'bg-orange-500/20 text-orange-300' :
                            'bg-white/10 text-white/50'
                          }`}>
                            {groupe.categorie}
                          </span>
                          <span className="text-white font-semibold text-sm">{groupe.total} objets</span>
                          {groupe.capacite_totale !== null && (
                            <span className="text-white/40 text-xs">
                              · <span className="text-white/60 font-medium">{groupe.capacite_totale.toLocaleString('fr-FR')}</span> lits
                              <span className="text-white/25 ml-1">({groupe.nb_avec_capacite} fiches)</span>
                            </span>
                          )}
                        </div>

                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-white/30 border-b border-white/5">
                              <th className="text-left px-5 py-2 font-medium">Sous-type</th>
                              <th className="text-right px-4 py-2 font-medium w-16">Nb</th>
                              <th className="text-right px-4 py-2 font-medium w-24">Lits</th>
                              <th className="text-left px-4 py-2 font-medium">Répartition par commune</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupe.sous_categories.map((sc, si) => (
                              <tr key={sc.nom} className={`border-b border-white/[0.04] ${si % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                                <td className="px-5 py-2.5 text-white/70">{sc.nom}</td>
                                <td className="px-4 py-2.5 text-right text-white font-semibold tabular-nums">{sc.total}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                  {sc.capacite !== null
                                    ? <span className="text-white/60">{sc.capacite.toLocaleString('fr-FR')}</span>
                                    : <span className="text-white/20">—</span>
                                  }
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex flex-wrap gap-1.5">
                                    {sc.par_commune.map(({ commune, count }) => (
                                      <span key={commune} className="inline-flex items-center gap-1 bg-white/8 border border-white/10 rounded px-1.5 py-0.5 text-[11px]">
                                        <span className="text-white/50">{commune}</span>
                                        <span className="text-white font-semibold">{count}</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                ) : (
                  /* ── VUE DÉTAIL : tableau ligne par ligne ── */
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/40 text-xs border-b border-white/5">
                          {([
                            ['Commune',     'commune_admin'],
                            ['Nom',         'nom'],
                            ['Catégorie',   'categorie'],
                            ['Sous-type',   'sous_cat'],
                            ['CP',          'cp'],
                            ['Capacité',    'capacite'],
                            ['Carte',       null],
                          ] as [string, string | null][]).map(([label, col]) => (
                            <th
                              key={label}
                              className={`text-left px-3 py-3 font-medium whitespace-nowrap select-none ${col ? 'cursor-pointer hover:text-white/70' : ''} ${tourinColsMasquees.has(label) ? 'hidden' : ''}`}
                              onClick={() => col && trierTourin(col)}
                            >
                              {label}
                              {col && <IconTriGen col={col} sortCol={sortTourinCol} sortDir={sortTourinDir} />}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tourinTriee.map((e, i) => (
                          <tr key={e.uuid} className={`border-b border-white/5 hover:bg-white/[0.03] ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                            <td className={`px-3 py-2 text-white/60 whitespace-nowrap text-xs ${tourinColsMasquees.has('Commune') ? 'hidden' : ''}`}>{e.commune_admin}</td>
                            <td className={`px-3 py-2 text-white font-medium max-w-[240px] ${tourinColsMasquees.has('Nom') ? 'hidden' : ''}`}>
                              <span className="block truncate" title={e.nom}>{e.nom}</span>
                            </td>
                            <td className={`px-3 py-2 text-xs ${tourinColsMasquees.has('Catégorie') ? 'hidden' : ''}`}>
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                e.categorie === 'hebergements' ? 'bg-blue-500/15 text-blue-300' :
                                e.categorie === 'activites'    ? 'bg-green-500/15 text-green-300' :
                                e.categorie === 'services'     ? 'bg-orange-500/15 text-orange-300' :
                                'bg-white/10 text-white/40'
                              }`}>
                                {e.categorie}
                              </span>
                            </td>
                            <td className={`px-3 py-2 text-white/50 text-xs max-w-[160px] ${tourinColsMasquees.has('Sous-type') ? 'hidden' : ''}`}>
                              <span className="block truncate" title={e.sous_categorie}>{e.sous_categorie}</span>
                            </td>
                            <td className={`px-3 py-2 text-white/40 text-xs whitespace-nowrap ${tourinColsMasquees.has('CP') ? 'hidden' : ''}`}>{e.code_postal ?? '—'}</td>
                            <td className={`px-3 py-2 text-right ${tourinColsMasquees.has('Capacité') ? 'hidden' : ''}`}>
                              {e.capacite !== null
                                ? <span className="text-white/70 text-xs font-medium tabular-nums">{e.capacite}</span>
                                : <span className="text-white/20 text-xs">—</span>}
                            </td>
                            <td className={`px-3 py-2 text-center ${tourinColsMasquees.has('Carte') ? 'hidden' : ''}`}>
                              {e.lat !== null && e.lng !== null ? (
                                <a
                                  href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-white/25 hover:text-white/50 transition-colors"
                                  title={`${e.lat}, ${e.lng}`}
                                >
                                  📍
                                </a>
                              ) : <span className="text-white/15 text-xs">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
