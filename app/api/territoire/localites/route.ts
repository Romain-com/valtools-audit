// Route POST /api/territoire/localites
// Pour chaque commune, découvre les localités Apidae présentes dans un rayon de 3km
// en utilisant la même stratégie GPS BAN + post-regroupement par commune.nom.
// Retourne, par commune, la liste des localités trouvées avec leur nombre d'hébergements.
// Utilisé pour afficher la modale de sélection avant l'analyse principale.

export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const APIDAE_BASE_URL = 'https://api.apidae-tourisme.com/api/v002/recherche/list-objets-touristiques/'
const CQ_HEB = 'type:HOTELLERIE OR type:HEBERGEMENT_LOCATIF OR type:HEBERGEMENT_COLLECTIF OR type:HOTELLERIE_PLEIN_AIR'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommuneInput {
  nom: string
  code_postal: string
  code_insee: string
}

export interface LocaliteApidae {
  nom: string        // commune.nom retourné par Apidae
  nb_hebergements: number
  incluse_par_defaut: boolean  // true si correspond au nom de la commune demandée
}

export interface LocalitesCommune {
  code_insee: string
  nom_commune: string
  localites: LocaliteApidae[]
  // true si plusieurs localités détectées au-delà de la commune principale
  a_localites_supplementaires: boolean
}

// ─── Normalisation ────────────────────────────────────────────────────────────

function normaliserNom(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_']/g, ' ')
    .trim()
}

function correspondCommune(nomApidae: string, nomCommune: string): boolean {
  const n = normaliserNom(nomApidae)
  const cible = normaliserNom(nomCommune)
  return n.includes(cible) || cible.includes(n)
}

// ─── Découverte des localités Apidae pour une commune ─────────────────────────

async function decouvrirlocalites(
  commune: CommuneInput,
  apiKey: string,
  projetId: string,
): Promise<LocalitesCommune> {
  // Centre via BAN (mairie)
  let coords: [number, number] | null = null
  try {
    const banResp = await axios.get('https://api-adresse.data.gouv.fr/search/', {
      params: { q: commune.nom, postcode: commune.code_postal, type: 'municipality', limit: 1 },
      timeout: 5000,
    })
    const feature = banResp.data.features?.[0]
    if (feature?.geometry?.coordinates?.length === 2) {
      coords = feature.geometry.coordinates as [number, number]
    }
  } catch { /* BAN indisponible */ }

  if (!coords) {
    return {
      code_insee: commune.code_insee,
      nom_commune: commune.nom,
      localites: [],
      a_localites_supplementaires: false,
    }
  }

  // Requête GPS 3km — hébergements uniquement (pour les comptages)
  let objets: Array<{ localisation?: { adresse?: { commune?: { nom?: string } } } }> = []
  try {
    const resp = await axios.get(APIDAE_BASE_URL, {
      params: {
        query: JSON.stringify({
          projetId, apiKey,
          center: { type: 'Point', coordinates: coords },
          radius: 3000,
          criteresQuery: CQ_HEB,
          count: 200,
          locales: ['fr'],
          responseFields: ['id', 'localisation'],
        }),
      },
      timeout: 30_000,
    })
    objets = resp.data.objetsTouristiques ?? []
  } catch { /* Apidae indisponible */ }

  // Regroupement par commune.nom Apidae
  const compteurs = new Map<string, number>()
  for (const obj of objets) {
    const nomApidae = obj.localisation?.adresse?.commune?.nom ?? '(inconnu)'
    compteurs.set(nomApidae, (compteurs.get(nomApidae) ?? 0) + 1)
  }

  // Construction des localités triées par nombre décroissant
  const localites: LocaliteApidae[] = []
  for (const [nom, nb] of [...compteurs.entries()].sort((a, b) => b[1] - a[1])) {
    localites.push({
      nom,
      nb_hebergements: nb,
      incluse_par_defaut: nom === '(inconnu)' ? false : correspondCommune(nom, commune.nom),
    })
  }

  const a_localites_supplementaires = localites.some((l) => !l.incluse_par_defaut && l.nb_hebergements > 0)

  return {
    code_insee: commune.code_insee,
    nom_commune: commune.nom,
    localites,
    a_localites_supplementaires,
  }
}

// ─── Handler POST ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const communes: CommuneInput[] = body.communes ?? []

    if (!Array.isArray(communes) || communes.length === 0) {
      return NextResponse.json({ error: 'Paramètre communes requis (tableau)' }, { status: 400 })
    }

    const apiKey   = process.env.APIDAE_API_KEY
    const projetId = process.env.APIDAE_PROJECT_ID

    if (!apiKey || !projetId) {
      // Apidae non configuré — retourner tableau vide (non bloquant)
      return NextResponse.json({ localites: [] })
    }

    // Découverte en parallèle pour toutes les communes
    const localites = await Promise.all(
      communes.map((c) => decouvrirlocalites(c, apiKey, projetId))
    )

    return NextResponse.json({ localites })
  } catch (err) {
    console.error('[Territoire/Localites] Erreur :', err)
    return NextResponse.json({ error: 'Erreur serveur', localites: [] }, { status: 500 })
  }
}
