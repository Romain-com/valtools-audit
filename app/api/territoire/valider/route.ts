// Route POST /api/territoire/valider
// Valide une liste de noms de communes saisis librement contre le CSV officiel.
// Retourne pour chaque ligne : commune trouvée (ok) | suggestions (ambigu) | rien (invalide)

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommuneValidee {
  nom: string
  siren: string
  code_insee: string
  code_postal: string
  code_departement: string
  code_region: string
  population: number
}

export interface LigneResultat {
  texte_original: string
  statut: 'ok' | 'ambigu' | 'invalide'
  commune?: CommuneValidee        // si statut = 'ok' (correspondance exacte unique)
  suggestions?: CommuneValidee[]  // si statut = 'ambigu' ou 'invalide' (jusqu'à 3)
}

// ─── Cache CSV en mémoire ─────────────────────────────────────────────────────
// Chargé une seule fois au premier appel, conservé en mémoire ensuite

let communesCache: CommuneValidee[] | null = null

function chargerCommunes(): CommuneValidee[] {
  if (communesCache) return communesCache

  const csvPath = path.join(process.cwd(), 'ressources', 'identifiants-communes-2024.csv')

  if (!fs.existsSync(csvPath)) {
    console.error('[Territoire/Valider] CSV introuvable :', csvPath)
    return []
  }

  const contenu = fs.readFileSync(csvPath, 'utf-8')
  const lignes = contenu.split('\n')
  if (lignes.length === 0) return []

  // Première ligne = en-têtes
  const entetes = lignes[0].split(',').map((e) => e.trim())
  const idx = {
    nom: entetes.indexOf('nom'),
    siren: entetes.indexOf('SIREN'),
    cog: entetes.indexOf('COG'),
    type: entetes.indexOf('type'),
    dep: entetes.indexOf('code_departement'),
    region: entetes.indexOf('code_region'),
    pop: entetes.indexOf('population'),
    cp: entetes.indexOf('code_postal'),
  }

  const communes: CommuneValidee[] = []

  for (let i = 1; i < lignes.length; i++) {
    const ligne = lignes[i].trim()
    if (!ligne) continue

    const cols = parseLigneCsv(ligne)
    if (cols[idx.type] !== 'COM') continue

    communes.push({
      nom: cols[idx.nom] ?? '',
      siren: cols[idx.siren] ?? '',
      code_insee: cols[idx.cog] ?? '',
      code_postal: cols[idx.cp] ?? '',
      code_departement: cols[idx.dep] ?? '',
      code_region: cols[idx.region] ?? '',
      population: parseInt(cols[idx.pop] ?? '0', 10) || 0,
    })
  }

  communesCache = communes
  console.log(`[Territoire/Valider] ${communes.length} communes chargées`)
  return communes
}

/**
 * Découpe une ligne CSV en tenant compte des guillemets.
 */
function parseLigneCsv(ligne: string): string[] {
  const resultat: string[] = []
  let courant = ''
  let dansGuillemets = false

  for (const char of ligne) {
    if (char === '"') {
      dansGuillemets = !dansGuillemets
    } else if (char === ',' && !dansGuillemets) {
      resultat.push(courant.trim())
      courant = ''
    } else {
      courant += char
    }
  }
  resultat.push(courant.trim())
  return resultat
}

/**
 * Normalise un nom pour la comparaison :
 * minuscules, sans accents, tirets/apostrophes (droites et typographiques) → espaces.
 * Couvre : ' (U+0027), ' (U+2019), ' (U+2018), ‑ (U+2011), – (U+2013), — (U+2014)
 */
function normaliser(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-\u2019\u2018\u0027\u0060\u2011\u2013\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Cherche une commune par nom.
 * 1. Correspondance exacte normalisée
 * 2. Correspondance par préfixe (suggestions)
 * 3. Correspondance par inclusion (fallback suggestions)
 */
function chercherCommune(nomSaisi: string, communes: CommuneValidee[]): LigneResultat {
  const nomNorm = normaliser(nomSaisi)

  if (!nomNorm) {
    return { texte_original: nomSaisi, statut: 'invalide', suggestions: [] }
  }

  // 1. Correspondances exactes
  const exactes = communes.filter((c) => normaliser(c.nom) === nomNorm)
  if (exactes.length === 1) {
    return { texte_original: nomSaisi, statut: 'ok', commune: exactes[0] }
  }
  if (exactes.length > 1) {
    return { texte_original: nomSaisi, statut: 'ambigu', suggestions: exactes.slice(0, 5) }
  }

  // 2. Correspondances par préfixe
  const prefixes = communes
    .filter((c) => normaliser(c.nom).startsWith(nomNorm))
    .slice(0, 5)

  if (prefixes.length === 1) {
    return { texte_original: nomSaisi, statut: 'ok', commune: prefixes[0] }
  }
  if (prefixes.length > 1) {
    return { texte_original: nomSaisi, statut: 'ambigu', suggestions: prefixes }
  }

  // 3. Correspondances par inclusion (pour les fautes d'orthographe partielles)
  const incluses = communes
    .filter((c) => {
      const cn = normaliser(c.nom)
      return cn.includes(nomNorm) || nomNorm.includes(cn)
    })
    .slice(0, 3)

  return { texte_original: nomSaisi, statut: 'invalide', suggestions: incluses }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const lignes: string[] = body.lignes ?? []

    if (!Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json({ error: 'Paramètre lignes requis (tableau)' }, { status: 400 })
    }

    if (lignes.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 communes par requête' }, { status: 400 })
    }

    const communes = chargerCommunes()
    const resultats: LigneResultat[] = lignes
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => chercherCommune(l, communes))

    const nb_ok = resultats.filter((r) => r.statut === 'ok').length
    const nb_ambigu = resultats.filter((r) => r.statut === 'ambigu').length
    const nb_invalide = resultats.filter((r) => r.statut === 'invalide').length

    return NextResponse.json({ resultats, nb_ok, nb_ambigu, nb_invalide })
  } catch (err) {
    console.error('[Territoire/Valider] Erreur :', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
