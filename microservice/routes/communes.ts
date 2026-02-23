import { Router, Request, Response } from 'express'
import { rechercherCommunes } from '../services/csv-reader'

const router = Router()

/**
 * GET /communes?nom=XXX
 *
 * Recherche des communes par nom (correspondance exacte ou préfixe).
 * Gère les homonymes (plusieurs communes avec le même nom dans des départements différents).
 * Retourne au maximum 10 résultats.
 */
router.get('/', (req: Request, res: Response) => {
  const nom = (req.query.nom as string)?.trim()

  if (!nom || nom.length < 2) {
    return res.status(400).json({
      erreur: 'Le paramètre "nom" est requis et doit contenir au moins 2 caractères',
    })
  }

  const resultats = rechercherCommunes(nom)

  if (resultats.length === 0) {
    return res.json({
      resultats: [],
      message: 'Aucune commune trouvée',
    })
  }

  // On tronque à 10 pour éviter des réponses trop larges
  const tronque = resultats.length > 10
  const selection = tronque ? resultats.slice(0, 10) : resultats

  // On ne retourne que les champs utiles au client
  const donnees = selection.map((c) => ({
    nom: c.nom,
    siren: c.siren,
    code_insee: c.code_insee,
    code_postal: c.code_postal,
    code_departement: c.code_departement,
    population: c.population,
  }))

  return res.json({
    resultats: donnees,
    ...(tronque && { tronque: true, total: resultats.length }),
  })
})

export default router
