import fs from 'fs'
import { Router, Request, Response } from 'express'
import { getFilepathsParCommune, isIndexPret } from '../services/datatourisme'

const router = Router()

/**
 * GET /scan-types?code_insee=74010
 *
 * Retourne tous les types @type présents pour une commune, sans filtre.
 * Utilisé uniquement pour la découverte des types avant de coder le Bloc 5 (stocks).
 *
 * Contrairement à /poi, aucun type n'est exclu — on lit le champ @type brut de chaque fichier.
 */
router.get('/', async (req: Request, res: Response) => {
  // Vérification : l'index est-il prêt ?
  if (!isIndexPret()) {
    return res.status(503).json({
      erreur: 'Index en cours de construction, réessayer dans quelques instants',
    })
  }

  const code_insee = (req.query.code_insee as string)?.trim()
  if (!code_insee) {
    return res.status(400).json({
      erreur: 'Le paramètre "code_insee" est requis',
    })
  }

  const filepaths = getFilepathsParCommune(code_insee)
  if (filepaths.length === 0) {
    return res.status(404).json({
      erreur: `Aucun fichier trouvé pour la commune INSEE ${code_insee}`,
    })
  }

  // Comptage des occurrences de chaque type @type (brut, sans filtre)
  const compteur = new Map<string, number>()

  for (const filepath of filepaths) {
    try {
      const contenu = fs.readFileSync(filepath, 'utf-8')
      const data = JSON.parse(contenu) as Record<string, unknown>

      const typesRaw = data['@type'] as string[] | undefined
      if (!typesRaw || typesRaw.length === 0) continue

      for (const type of typesRaw) {
        compteur.set(type, (compteur.get(type) ?? 0) + 1)
      }
    } catch {
      // Fichier corrompu ou JSON invalide — on ignore
    }
  }

  // Tri par fréquence décroissante
  const types = Array.from(compteur.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  return res.json({
    code_insee,
    total_fichiers: filepaths.length,
    types_distincts: types.length,
    types,
  })
})

export default router
