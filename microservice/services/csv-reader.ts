import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { Commune } from '../types'

// Index en mémoire : clé = nom normalisé, valeur = liste de communes (gestion homonymes)
const indexParNom = new Map<string, Commune[]>()

// Index secondaire : code INSEE → commune (pour lookup direct)
const indexParInsee = new Map<string, Commune>()

/**
 * Normalise un nom de commune pour la recherche :
 * minuscules, sans accents, sans tirets, sans apostrophes, sans espaces multiples
 */
function normaliserNom(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')                   // décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '')    // supprime les diacritiques
    .replace(/[-']/g, ' ')             // tirets et apostrophes → espace
    .replace(/\s+/g, ' ')              // espaces multiples → un seul
    .trim()
}

/**
 * Charge et parse le fichier CSV au démarrage du microservice.
 * Appelé une seule fois — bloquant intentionnellement pour garantir
 * que le service est prêt avant de répondre aux requêtes communes.
 */
export function chargerCSVCommunes(csvPath: string): void {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`[CSV] Fichier introuvable : ${csvPath}`)
  }

  const contenu = fs.readFileSync(csvPath, 'utf-8')

  // csv-parse en mode synchrone — options alignées sur le format du fichier
  const lignes = parse(contenu, {
    columns: true,         // utilise la première ligne comme noms de colonnes
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  let compteur = 0

  for (const ligne of lignes) {
    // On ne garde que les lignes de type commune (pas EPCI, etc.)
    if (ligne['type'] !== 'COM') continue

    const commune: Commune = {
      nom: ligne['nom'],
      siren: ligne['SIREN'],
      code_insee: ligne['COG'],              // COG = code officiel géographique = INSEE
      code_postal: ligne['code_postal'],
      code_departement: ligne['code_departement'],
      code_region: ligne['code_region'],
      population: parseInt(ligne['population'] || '0', 10),
    }

    // Index par nom normalisé (gestion des homonymes : tableau)
    const cle = normaliserNom(commune.nom)
    if (!indexParNom.has(cle)) {
      indexParNom.set(cle, [])
    }
    indexParNom.get(cle)!.push(commune)

    // Index par code INSEE (unicité supposée)
    indexParInsee.set(commune.code_insee, commune)

    compteur++
  }

  console.log(`[CSV] ${compteur} communes chargées depuis ${path.basename(csvPath)}`)
}

/**
 * Recherche des communes par nom.
 * 1. Correspondance exacte sur le nom normalisé
 * 2. Si aucun résultat exact → correspondances par préfixe (autocomplete)
 */
export function rechercherCommunes(nom: string): Commune[] {
  const nomNormalise = normaliserNom(nom)

  // 1. Correspondance exacte
  if (indexParNom.has(nomNormalise)) {
    return indexParNom.get(nomNormalise)!
  }

  // 2. Correspondances par préfixe (pour l'autocomplete)
  const resultats: Commune[] = []
  for (const [cle, communes] of indexParNom.entries()) {
    if (cle.startsWith(nomNormalise)) {
      resultats.push(...communes)
    }
  }

  return resultats
}

/**
 * Lookup direct par code INSEE — retourne null si introuvable
 */
export function getCommuneParInsee(code_insee: string): Commune | null {
  return indexParInsee.get(code_insee) ?? null
}
