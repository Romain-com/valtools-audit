import fs from 'fs'
import path from 'path'
import { POIResult } from '../types'

// Chemin du fichier cache de l'index communes
const CACHE_PATH = path.join(__dirname, '../cache/index-communes.json')

// Chemin du dossier DATA Tourisme
const DATA_PATH = process.env.DATA_TOURISME_PATH || ''

// Index en RAM : code_insee → liste de filepaths vers les fichiers JSON
const indexParInsee = new Map<string, string[]>()

// Flag indiquant si l'index est prêt à être interrogé
let indexPret = false

/**
 * Indique si l'index est prêt à être interrogé
 */
export function isIndexPret(): boolean {
  return indexPret
}

// Structure du fichier cache JSON sur disque
interface CacheData {
  generated_at: string
  total_fichiers: number
  total_communes: number
  index: Record<string, string[]>
}

/**
 * Parcourt récursivement un dossier et retourne tous les chemins de fichiers .json
 */
function listerFichiersJson(dossier: string): string[] {
  const resultats: string[] = []

  function parcourir(repertoire: string): void {
    let entrees: fs.Dirent[]
    try {
      entrees = fs.readdirSync(repertoire, { withFileTypes: true })
    } catch {
      // Dossier illisible — on passe
      return
    }

    for (const entree of entrees) {
      const chemin = path.join(repertoire, entree.name)
      if (entree.isDirectory()) {
        parcourir(chemin)
      } else if (entree.isFile() && entree.name.endsWith('.json')) {
        resultats.push(chemin)
      }
    }
  }

  parcourir(dossier)
  return resultats
}

/**
 * Construit l'index code_insee → filepaths en scannant les 489k fichiers.
 * Persiste le résultat dans CACHE_PATH et charge l'index en RAM.
 * Appelé uniquement si le cache n'existe pas encore.
 */
async function construireIndex(): Promise<void> {
  // Créer le dossier cache s'il n'existe pas
  const cacheDir = path.dirname(CACHE_PATH)
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }

  console.log(`[DataTourisme] Scan des fichiers depuis : ${DATA_PATH}`)
  const fichiers = listerFichiersJson(DATA_PATH)
  const total = fichiers.length
  console.log(`[DataTourisme] ${total} fichiers JSON trouvés — construction de l'index...`)

  const indexTemp = new Map<string, string[]>()
  let nbIndexes = 0

  for (let i = 0; i < fichiers.length; i++) {
    // Log de progression toutes les 10 000 fichiers
    if (i > 0 && i % 10000 === 0) {
      console.log(`[DataTourisme] Progression : ${i}/${total} fichiers...`)
    }

    const filepath = fichiers[i]
    try {
      const contenu = fs.readFileSync(filepath, 'utf-8')
      const data = JSON.parse(contenu) as Record<string, unknown>

      // Extraction du code INSEE uniquement — on ne lit pas les autres champs
      const locatedAt = data['isLocatedAt'] as Record<string, unknown>[] | undefined
      const adresse = locatedAt?.[0]?.['schema:address'] as Record<string, unknown>[] | undefined
      const ville = adresse?.[0]?.['hasAddressCity'] as Record<string, string> | undefined
      const insee = ville?.['insee']

      if (!insee) continue

      if (!indexTemp.has(insee)) indexTemp.set(insee, [])
      indexTemp.get(insee)!.push(filepath)
      nbIndexes++
    } catch {
      // Fichier corrompu ou JSON invalide — on ignore
    }
  }

  // Sérialisation en objet plain pour JSON.stringify
  const indexObj: Record<string, string[]> = {}
  for (const [insee, paths] of indexTemp) {
    indexObj[insee] = paths
  }

  const cacheData: CacheData = {
    generated_at: new Date().toISOString(),
    total_fichiers: total,
    total_communes: indexTemp.size,
    index: indexObj,
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cacheData))
  console.log(
    `[DataTourisme] Index construit et sauvegardé — ${indexTemp.size} communes, ${nbIndexes} fichiers indexés`
  )

  // Charger immédiatement en RAM
  for (const [insee, paths] of indexTemp) {
    indexParInsee.set(insee, paths)
  }
}

/**
 * Charge l'index depuis le cache disque si disponible, sinon le construit.
 * Appelée au démarrage du microservice — remplace lancerIndexation().
 */
export async function chargerOuConstruireIndex(): Promise<void> {
  if (fs.existsSync(CACHE_PATH)) {
    console.log('[DataTourisme] Cache détecté — chargement...')
    const debut = Date.now()
    try {
      const contenu = fs.readFileSync(CACHE_PATH, 'utf-8')
      const cache = JSON.parse(contenu) as CacheData

      for (const [insee, paths] of Object.entries(cache.index)) {
        indexParInsee.set(insee, paths)
      }

      const ms = Date.now() - debut
      console.log(`[DataTourisme] Cache chargé — ${cache.total_communes} communes en ${ms}ms`)
      indexPret = true
    } catch (err) {
      console.error('[DataTourisme] Cache corrompu — reconstruction depuis les fichiers sources...', err)
      await construireIndex()
      indexPret = true
    }
  } else {
    console.log('[DataTourisme] Pas de cache — construction de l\'index (première utilisation)...')
    try {
      await construireIndex()
      indexPret = true
    } catch (err) {
      console.error('[DataTourisme] Erreur fatale lors de la construction de l\'index :', err)
      // On marque quand même comme prêt pour ne pas bloquer les requêtes indéfiniment
      indexPret = true
    }
  }
}

/**
 * Retourne tous les filepaths d'une commune depuis l'index RAM.
 * Utilisé par les endpoints qui ont besoin d'accéder aux fichiers bruts sans filtrage.
 */
export function getFilepathsParCommune(code_insee: string): string[] {
  return indexParInsee.get(code_insee) ?? []
}

/**
 * Retourne les POI d'une commune filtrés par type.
 * Lit les fichiers JSON individuellement à la demande (pas de données en RAM hors filepaths).
 *
 * @param code_insee - Code INSEE de la commune
 * @param types - Types à inclure (vide = tous les types acceptés)
 * @param limit - Nombre maximum de résultats (max 50)
 */
export function getPOIParCommune(
  code_insee: string,
  types: string[],
  limit: number
): POIResult[] {
  const filepaths = indexParInsee.get(code_insee)
  if (!filepaths || filepaths.length === 0) return []

  const resultats: POIResult[] = []

  for (const filepath of filepaths) {
    if (resultats.length >= limit) break

    try {
      const contenu = fs.readFileSync(filepath, 'utf-8')
      const data = JSON.parse(contenu) as Record<string, unknown>

      // Nom : rdfs:label.fr[0]
      const labelFr = (data['rdfs:label'] as Record<string, string[]> | undefined)?.['fr']
      const nom = labelFr?.[0]
      if (!nom) continue

      // Types : @type filtré — on garde uniquement les valeurs sans préfixe "schema:"
      const typesRaw = data['@type'] as string[] | undefined
      if (!typesRaw || typesRaw.length === 0) continue
      const typesFiltres = typesRaw.filter((t) => !t.startsWith('schema:'))
      if (typesFiltres.length === 0) continue

      // Vérification de l'inclusion (logique existante — inchangée)
      const correspond = types.length === 0 || typesFiltres.some((t) => types.includes(t))
      if (!correspond) continue

      // GPS : isLocatedAt[0].schema:geo
      const isLocatedAt = data['isLocatedAt'] as Record<string, unknown>[] | undefined
      if (!isLocatedAt || isLocatedAt.length === 0) continue
      const lieu = isLocatedAt[0]
      const geo = lieu['schema:geo'] as Record<string, string> | undefined
      if (!geo) continue
      const latitude = parseFloat(geo['schema:latitude'])
      const longitude = parseFloat(geo['schema:longitude'])
      if (isNaN(latitude) || isNaN(longitude)) continue

      resultats.push({
        nom,
        type_principal: typesFiltres[0] ?? 'PointOfInterest',
        latitude,
        longitude,
      })
    } catch {
      // Fichier corrompu ou structure inattendue — on passe
    }
  }

  return resultats
}
