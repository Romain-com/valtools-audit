// Logique métier — collecte Mélodi (INSEE) + ajustement coefficients via OpenAI
// Sources : RP 2022 (résidences secondaires) + BPE (hébergements touristiques D7)
// Respecte le rate limit Mélodi : 30 req/min → batch de 10 communes × 2 appels = sleep 2100ms
// Extrait de route.ts pour permettre l'import direct depuis l'orchestrateur (évite les appels auto-référentiels)

import axios from 'axios'
import type { DonneesLogementCommune, Coefficients } from '@/types/volume-affaires'

// ─── Constantes Mélodi ────────────────────────────────────────────────────────

const MELODI_BASE = 'https://api.insee.fr/melodi'

// Codes BPE pour les hébergements touristiques (domaine D7)
const BPE_CODES_HEBERGEMENT: Record<string, keyof Pick<
  DonneesLogementCommune,
  'hotels' | 'campings' | 'residences_tourisme' | 'villages_vacances' | 'meubles_classes' | 'chambres_hotes'
>> = {
  D701: 'hotels',
  D702: 'campings',
  D703: 'residences_tourisme',
  D705: 'villages_vacances',
  D710: 'meubles_classes',
  D711: 'chambres_hotes',
}

// Coefficients fixes par défaut (nuitées/an)
const COEFFICIENTS_FIXES: Omit<Coefficients, 'source' | 'profil_destination' | 'justification'> = {
  residence_secondaire: 30,       // ~8 semaines/an × occupants moyens
  hotel_etablissement: 2000,      // ~55 chambres × 200 nuits/an (taux occ. 55%)
  tourisme_etablissement: 1500,   // résidences de tourisme — hypothèse conservative
  camping_etablissement: 600,     // ~50 emplacements × 12 nuits/an (saison estivale)
  autres_etablissement: 800,      // foyers, auberges, villages vacances — hypothèse
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pause asynchrone en millisecondes */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Collecte les résidences secondaires d'une commune via RP 2022.
 * Format GEO obligatoire : COM-{code_insee} (ex: COM-74010).
 * Filtre TDW=_T pour n'avoir que le total (sans ventilation par taille).
 */
async function fetchResidencesSecondaires(code_insee: string): Promise<{
  valeur: number
  source: 'melodi_rp' | 'absent'
}> {
  try {
    const url = `${MELODI_BASE}/data/DS_RP_LOGEMENT_PRINC`
    const reponse = await axios.get(url, {
      params: {
        GEO: `COM-${code_insee}`,
        OCS: 'DW_SEC_DW_OCC',
        TIME_PERIOD: '2022',
        TDW: '_T',
      },
      timeout: 15000,
    })

    const obs = reponse.data?.observations ?? []
    // Le filtre TDW=_T dans la requête devrait retourner une seule ligne
    // On cherche quand même TDW=_T par sécurité
    const total = obs.find(
      (o: Record<string, unknown>) =>
        (o.dimensions as Record<string, string>)?.TDW === '_T'
    ) ?? obs[0]

    const valeur = Math.round(
      (total?.measures as Record<string, { value: number }>)?.OBS_VALUE_NIVEAU?.value ?? 0
    )

    return { valeur, source: 'melodi_rp' }
  } catch {
    // Commune sans données RP — normal pour petites communes
    return { valeur: 0, source: 'absent' }
  }
}

/**
 * Collecte les hébergements touristiques d'une commune via BPE (domaine D7).
 * Retourne le détail par type d'établissement.
 */
async function fetchHebergementsBPE(code_insee: string): Promise<{
  hotels: number
  campings: number
  residences_tourisme: number
  villages_vacances: number
  meubles_classes: number
  chambres_hotes: number
  autres_hebergements: number
  source: 'melodi_bpe' | 'absent'
}> {
  const defaut = {
    hotels: 0,
    campings: 0,
    residences_tourisme: 0,
    villages_vacances: 0,
    meubles_classes: 0,
    chambres_hotes: 0,
    autres_hebergements: 0,
    source: 'absent' as const,
  }

  try {
    const url = `${MELODI_BASE}/data/DS_BPE`
    const reponse = await axios.get(url, {
      params: {
        GEO: `COM-${code_insee}`,
        FACILITY_SDOM: 'D7',
      },
      timeout: 15000,
    })

    const obs = reponse.data?.observations ?? []
    if (obs.length === 0) return defaut

    const detail: Record<string, number> = {}
    let autres = 0

    for (const o of obs) {
      const code = (o.dimensions as Record<string, string>)?.FACILITY_TYPE
      const val = Math.round(
        (o.measures as Record<string, { value: number }>)?.OBS_VALUE_NIVEAU?.value ?? 0
      )
      if (!code || code === '_T') continue

      const champ = BPE_CODES_HEBERGEMENT[code]
      if (champ) {
        detail[champ] = (detail[champ] ?? 0) + val
      } else {
        // Code D7 non listé — compté dans autres_hebergements
        autres += val
      }
    }

    return {
      hotels:              detail['hotels']              ?? 0,
      campings:            detail['campings']            ?? 0,
      residences_tourisme: detail['residences_tourisme'] ?? 0,
      villages_vacances:   detail['villages_vacances']   ?? 0,
      meubles_classes:     detail['meubles_classes']     ?? 0,
      chambres_hotes:      detail['chambres_hotes']      ?? 0,
      autres_hebergements: autres,
      source: 'melodi_bpe',
    }
  } catch {
    return defaut
  }
}

/**
 * Collecte les données Mélodi pour une seule commune (2 appels en parallèle).
 */
async function fetchDonneesCommune(
  code_insee: string,
  nom: string
): Promise<DonneesLogementCommune> {
  const [rs_result, bpe_result] = await Promise.allSettled([
    fetchResidencesSecondaires(code_insee),
    fetchHebergementsBPE(code_insee),
  ])

  const rs  = rs_result.status  === 'fulfilled' ? rs_result.value  : { valeur: 0, source: 'absent' as const }
  const bpe = bpe_result.status === 'fulfilled' ? bpe_result.value : {
    hotels: 0, campings: 0, residences_tourisme: 0, villages_vacances: 0,
    meubles_classes: 0, chambres_hotes: 0, autres_hebergements: 0, source: 'absent' as const,
  }

  return {
    code_insee,
    nom,
    residences_secondaires: rs.valeur,
    hotels:              bpe.hotels,
    campings:            bpe.campings,
    residences_tourisme: bpe.residences_tourisme,
    villages_vacances:   bpe.villages_vacances,
    meubles_classes:     bpe.meubles_classes,
    chambres_hotes:      bpe.chambres_hotes,
    autres_hebergements: bpe.autres_hebergements,
    source_rs:  rs.source,
    source_bpe: bpe.source,
  }
}

/**
 * Appelle OpenAI pour ajuster les coefficients selon le profil de la destination.
 * Fallback sur les coefficients fixes si OpenAI échoue.
 */
async function ajusterCoefficients(
  destination: string,
  departement: string,
  montant_ts_euros: number
): Promise<Coefficients> {
  const profils = 'station_ski | bord_mer | bord_lac | ville | campagne | mixte'

  const promptUser = `Tu es expert en tourisme français. Ajuste les coefficients de nuitées/an selon le profil de la destination.

Destination : ${destination} (département ${departement})
Taxe de séjour collectée : ${montant_ts_euros}€

Coefficients par défaut (nuitées/an) :
- résidence_secondaire : 30
- hôtel (par établissement) : 2000
- résidence_tourisme (par établissement) : 1500
- camping (par établissement) : 600
- autres_hébergements (par établissement) : 800

Profils disponibles : ${profils}

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires) :
{
  "coefficients_ajustes": {
    "residence_secondaire": 30,
    "hotel_etablissement": 2000,
    "tourisme_etablissement": 1500,
    "camping_etablissement": 600,
    "autres_etablissement": 800
  },
  "profil_confirme": "bord_lac",
  "justification": "1 phrase"
}`

  try {
    const reponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: 'Tu es expert en tourisme français. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.',
          },
          { role: 'user', content: promptUser },
        ],
        temperature: 0.2,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    )

    const brut = reponse.data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())

    const coeff = parsed.coefficients_ajustes ?? {}
    return {
      residence_secondaire:   coeff.residence_secondaire   ?? COEFFICIENTS_FIXES.residence_secondaire,
      hotel_etablissement:    coeff.hotel_etablissement     ?? COEFFICIENTS_FIXES.hotel_etablissement,
      tourisme_etablissement: coeff.tourisme_etablissement  ?? COEFFICIENTS_FIXES.tourisme_etablissement,
      camping_etablissement:  coeff.camping_etablissement   ?? COEFFICIENTS_FIXES.camping_etablissement,
      autres_etablissement:   coeff.autres_etablissement    ?? COEFFICIENTS_FIXES.autres_etablissement,
      source: 'openai_ajuste',
      profil_destination: parsed.profil_confirme ?? 'mixte',
      justification: parsed.justification ?? null,
    }
  } catch {
    // Fallback coefficients fixes si OpenAI échoue
    return {
      ...COEFFICIENTS_FIXES,
      source: 'fixes',
      profil_destination: 'mixte',
      justification: null,
    }
  }
}

// ─── Fonction exportée ────────────────────────────────────────────────────────

/**
 * Collecte les données Mélodi pour une liste de communes, par batch de 10.
 * Appelle ensuite OpenAI pour ajuster les coefficients selon le profil de destination.
 */
export async function executerMelodi({
  communes,
  destination,
  departement,
  montant_ts,
}: {
  communes: { code_insee: string; nom: string }[]
  destination?: string
  departement?: string
  montant_ts?: number
}): Promise<{
  donnees: DonneesLogementCommune[]
  coefficients: Coefficients
  meta: {
    nb_communes: number
    nb_communes_avec_donnees: number
  }
}> {
  if (!communes || communes.length === 0) {
    throw new Error('communes requis (tableau non vide)')
  }

  // ─── Collecte Mélodi par batch de 10 communes ─────────────────────────────
  // Rate limit : 30 req/min. 10 communes × 2 appels = 20 req → safe avec sleep 2100ms entre batches.

  const BATCH_SIZE = 10
  const donnees: DonneesLogementCommune[] = []

  for (let i = 0; i < communes.length; i += BATCH_SIZE) {
    const batch = communes.slice(i, i + BATCH_SIZE)

    // Traitement du batch en parallèle
    const resultats = await Promise.allSettled(
      batch.map((c) => fetchDonneesCommune(c.code_insee, c.nom))
    )

    for (const resultat of resultats) {
      if (resultat.status === 'fulfilled') {
        donnees.push(resultat.value)
      }
      // Les communes en erreur sont silencieusement ignorées (Promise.allSettled)
    }

    // Pause entre batches (sauf le dernier)
    if (i + BATCH_SIZE < communes.length) {
      await sleep(2100)
    }
  }

  // ─── Ajustement coefficients via OpenAI ───────────────────────────────────
  const coefficients = await ajusterCoefficients(
    destination ?? '',
    departement ?? '',
    montant_ts ?? 0,
  )

  return {
    donnees,
    coefficients,
    meta: {
      nb_communes: communes.length,
      nb_communes_avec_donnees: donnees.filter(
        (d) => d.source_rs === 'melodi_rp' || d.source_bpe === 'melodi_bpe'
      ).length,
    },
  }
}
