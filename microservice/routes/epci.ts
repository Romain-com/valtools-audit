// Route GET /epci — association commune → EPCI
// Charge deux CSV au démarrage du microservice et expose un lookup par code INSEE

import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const router = Router()

// ─── Chemins des fichiers sources ────────────────────────────────────────────

const CHEMIN_APPARTENANCE = path.join(
  __dirname,
  '../../ressources/table-appartenance-geo-communes-2025/COM-Tableau 1.csv'
)
const CHEMIN_EPCI = path.join(
  __dirname,
  '../../ressources/identifiants-epci-2024.csv'
)

// ─── Maps en mémoire ─────────────────────────────────────────────────────────

// Map 1 : code INSEE commune → SIREN EPCI
const mapCommuneVersEpci = new Map<string, string>()

// Map 2 : SIREN EPCI → { nom, type, population }
interface InfosEpci {
  nom: string
  type: string
  population: number
}
const mapEpciInfos = new Map<string, InfosEpci>()

// ─── Chargement au démarrage ──────────────────────────────────────────────────

/**
 * Charge la table d'appartenance commune → EPCI.
 * Le fichier COM-Tableau 1.csv contient 5 lignes de métadonnées,
 * puis la ligne d'en-tête (CODGEO, LIBGEO, DEP, ..., EPCI, ...) à partir de la ligne 6.
 * Délimiteur : point-virgule.
 */
function chargerAppartenance(): void {
  if (!fs.existsSync(CHEMIN_APPARTENANCE)) {
    console.error(`[EPCI] Fichier appartenance introuvable : ${CHEMIN_APPARTENANCE}`)
    return
  }

  const contenu = fs.readFileSync(CHEMIN_APPARTENANCE, 'utf-8')

  // from_line: 6 → utilise la ligne 6 (CODGEO;LIBGEO;...) comme en-tête
  // columns: true → noms de colonnes déduits de cet en-tête
  const lignes = parse(contenu, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    from_line: 6,
    trim: true,
  }) as Record<string, string>[]

  let compteur = 0
  for (const ligne of lignes) {
    const codgeo = ligne['CODGEO']?.trim()
    const epci   = ligne['EPCI']?.trim()

    // Ignorer les communes sans EPCI (code ZZZZZZZZZ = commune isolée)
    if (!codgeo || !epci || epci === 'ZZZZZZZZZ') continue

    mapCommuneVersEpci.set(codgeo, epci)
    compteur++
  }

  console.log(`[EPCI] ${compteur} communes associées à un EPCI`)
}

/**
 * Charge les informations des EPCI (nom, type, population).
 * Fichier identifiants-epci-2024.csv — délimiteur virgule, en-tête en ligne 1.
 */
function chargerInfosEpci(): void {
  if (!fs.existsSync(CHEMIN_EPCI)) {
    console.error(`[EPCI] Fichier EPCI introuvable : ${CHEMIN_EPCI}`)
    return
  }

  const contenu = fs.readFileSync(CHEMIN_EPCI, 'utf-8')

  const lignes = parse(contenu, {
    delimiter: ',',
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  for (const ligne of lignes) {
    const siren      = ligne['SIREN']?.trim()
    const nom        = ligne['nom']?.trim()
    const type       = ligne['type']?.trim()
    const population = parseInt(ligne['population'] || '0', 10)

    if (!siren || !nom) continue

    mapEpciInfos.set(siren, { nom, type, population })
  }

  console.log(`[EPCI] ${mapEpciInfos.size} EPCI chargés`)
}

// Chargement synchrone au moment de l'import du module
// (garantit que les données sont disponibles dès la première requête)
chargerAppartenance()
chargerInfosEpci()

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /epci?code_insee=XXX
 * Retourne les informations de l'EPCI auquel appartient la commune.
 * 404 si la commune n'appartient à aucun EPCI.
 */
router.get('/', (req: Request, res: Response) => {
  const code_insee = (req.query['code_insee'] as string)?.trim()

  if (!code_insee) {
    res.status(400).json({ error: 'Paramètre code_insee requis' })
    return
  }

  const siren_epci = mapCommuneVersEpci.get(code_insee)

  if (!siren_epci) {
    res.status(404).json({ error: `Aucun EPCI trouvé pour le code INSEE ${code_insee}` })
    return
  }

  const infos = mapEpciInfos.get(siren_epci)

  if (!infos) {
    // EPCI référencé dans l'appartenance mais absent de la liste EPCI — cas rare
    res.status(404).json({ error: `EPCI ${siren_epci} introuvable dans le référentiel` })
    return
  }

  res.json({
    siren_epci,
    nom_epci: infos.nom,
    type_epci: infos.type,
    population_epci: infos.population,
  })
})

export default router
