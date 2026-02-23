import fs from 'fs'
import path from 'path'
import { IndexPOI, POIResult } from '../types'

// Index principal : code_insee → liste de POI légers
const indexParInsee = new Map<string, IndexPOI[]>()

// Flag indiquant si l'indexation est terminée
let indexPret = false

/**
 * Indique si l'index est prêt à être interrogé
 */
export function isIndexPret(): boolean {
  return indexPret
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
 * Extrait les champs utiles d'un fichier JSON DATA Tourisme.
 * Retourne null si les données sont incomplètes ou malformées.
 */
function extraireEntreeIndex(filepath: string, data: Record<string, unknown>): IndexPOI | null {
  try {
    // Nom : rdfs:label.fr[0]
    const labelFr = (data['rdfs:label'] as Record<string, string[]> | undefined)?.['fr']
    const nom = labelFr?.[0]
    if (!nom) return null

    // Types : @type filtré — on garde uniquement les valeurs sans préfixe "schema:"
    const typesRaw = data['@type'] as string[] | undefined
    if (!typesRaw || typesRaw.length === 0) return null
    const types = typesRaw.filter((t) => !t.startsWith('schema:'))
    if (types.length === 0) return null

    // Localisation : isLocatedAt[0]
    const isLocatedAt = data['isLocatedAt'] as Record<string, unknown>[] | undefined
    if (!isLocatedAt || isLocatedAt.length === 0) return null
    const lieu = isLocatedAt[0]

    // Code INSEE : isLocatedAt[0].schema:address[0].hasAddressCity.insee
    const adresses = lieu['schema:address'] as Record<string, unknown>[] | undefined
    if (!adresses || adresses.length === 0) return null
    const adresse = adresses[0]
    const ville = adresse['hasAddressCity'] as Record<string, string> | undefined
    const code_insee = ville?.['insee']
    if (!code_insee) return null

    // GPS : isLocatedAt[0].schema:geo
    const geo = lieu['schema:geo'] as Record<string, string> | undefined
    if (!geo) return null
    const latitude = parseFloat(geo['schema:latitude'])
    const longitude = parseFloat(geo['schema:longitude'])
    if (isNaN(latitude) || isNaN(longitude)) return null

    return { nom, types, code_insee, latitude, longitude, filepath }
  } catch {
    // Champ manquant ou structure inattendue — on ignore ce fichier
    return null
  }
}

/**
 * Lance l'indexation complète en arrière-plan.
 * Appelée une seule fois au démarrage — ne bloque pas le serveur.
 */
export async function lancerIndexation(datatourismePath: string): Promise<void> {
  console.log(`[DataTourisme] Démarrage de l'indexation depuis : ${datatourismePath}`)

  // On tourne dans un setImmediate pour ne pas bloquer la boucle d'événement au démarrage
  setImmediate(async () => {
    try {
      const fichiers = listerFichiersJson(datatourismePath)
      const total = fichiers.length
      console.log(`[DataTourisme] ${total} fichiers JSON trouvés — indexation en cours...`)

      let nbIndexes = 0
      let nbIgnores = 0

      for (let i = 0; i < fichiers.length; i++) {
        const filepath = fichiers[i]

        // Log de progression toutes les 10 000 fichiers
        if (i > 0 && i % 10000 === 0) {
          console.log(`[DataTourisme] Indexation : ${i}/${total} fichiers...`)
        }

        try {
          const contenu = fs.readFileSync(filepath, 'utf-8')
          const data = JSON.parse(contenu) as Record<string, unknown>
          const entree = extraireEntreeIndex(filepath, data)

          if (entree) {
            if (!indexParInsee.has(entree.code_insee)) {
              indexParInsee.set(entree.code_insee, [])
            }
            indexParInsee.get(entree.code_insee)!.push(entree)
            nbIndexes++
          } else {
            nbIgnores++
          }
        } catch {
          // Fichier corrompu ou JSON invalide — on passe sans stopper l'indexation
          nbIgnores++
        }
      }

      indexPret = true
      const nbCommunes = indexParInsee.size
      console.log(
        `[DataTourisme] Index prêt — ${total} fichiers traités, ${nbIndexes} indexés, ` +
        `${nbIgnores} ignorés, ${nbCommunes} communes couvertes`
      )
    } catch (err) {
      console.error('[DataTourisme] Erreur fatale lors de l\'indexation :', err)
      // On marque quand même comme prêt pour ne pas bloquer les requêtes indéfiniment
      indexPret = true
    }
  })
}

/**
 * Retourne les POI d'une commune filtrés par type.
 * Retourne [] si la commune est absente de l'index ou si l'index n'est pas prêt.
 *
 * @param code_insee - Code INSEE de la commune
 * @param types - Types à inclure (au moins un doit correspondre)
 * @param limit - Nombre maximum de résultats (max 50)
 */
export function getPOIParCommune(
  code_insee: string,
  types: string[],
  limit: number
): POIResult[] {
  const pois = indexParInsee.get(code_insee)
  if (!pois) return []

  const resultats: POIResult[] = []

  for (const poi of pois) {
    if (resultats.length >= limit) break

    // Vérification : au moins un des types demandés est présent dans les types du POI
    const correspond = types.length === 0 || poi.types.some((t) => types.includes(t))
    if (!correspond) continue

    resultats.push({
      nom: poi.nom,
      type_principal: poi.types[0] ?? 'PointOfInterest',
      latitude: poi.latitude,
      longitude: poi.longitude,
    })
  }

  return resultats
}
