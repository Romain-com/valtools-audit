// Route Handler — OpenAI classification des keywords
// Responsabilité : filtrer, catégoriser et détecter les gaps SEO parmi les keywords
// ⚠️  Serveur uniquement — aucune clé API exposée côté client
// ⚠️  Batch de 50 keywords max par appel pour éviter les troncatures JSON
// ⚠️  Règle dure post-OpenAI : gap forcé à false si position_ot ≤ 20
// ⚠️  Filtre pré-OpenAI : patterns hors-tourisme évidents exclus avant envoi au modèle

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { API_COSTS } from '@/lib/api-costs'
import type { KeywordMarche, KeywordPositionneOT, KeywordClassifie, CategorieKeyword } from '@/types/visibilite-seo'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const TIMEOUT_MS = 60_000
const BATCH_SIZE = 50

// ─── Patterns hors-tourisme filtrés AVANT envoi à OpenAI ─────────────────────
// Évite de payer des tokens et améliore la fiabilité sur les cas évidents.
const PATTERNS_HORS_TOURISME = [
  /^météo\b/i,
  /\bmétéo (pour |à |de |en )?/i,
  /^temps (qu'il fait|prévu|à)/i,
  /prévisions? météo/i,
  /\bsncf\b/i,
  /horaires? (train|bus|tram|car)\b/i,
  /^itinéraire\b/i,
]

// ─── Types internes ────────────────────────────────────────────────────────────

interface KeywordInput {
  keyword: string
  volume: number
  cpc?: number
  position_ot?: number | null
}

interface ClassificationOpenAI {
  keyword: string
  volume: number
  categorie: CategorieKeyword
  intent_transactionnel: boolean
  position_ot: number | null
  gap: boolean
}

// ─── Helper : construire la liste fusionnée pour la classification ────────────

function preparerKeywordsInput(
  keywords_marche: KeywordMarche[],
  keywords_positionnes_ot: KeywordPositionneOT[]
): KeywordInput[] {
  // Map des keywords OT pour retrouver les positions rapidement
  const positionsOT = new Map<string, number>()
  for (const kw of keywords_positionnes_ot) {
    const cle = kw.keyword.toLowerCase().trim()
    // Conserver la meilleure position si doublon
    if (!positionsOT.has(cle) || kw.position < positionsOT.get(cle)!) {
      positionsOT.set(cle, kw.position)
    }
  }

  // Fusionner : keywords marché enrichis avec la position OT si disponible
  const parKeyword = new Map<string, KeywordInput>()

  for (const kw of keywords_marche) {
    const cle = kw.keyword.toLowerCase().trim()
    const position = positionsOT.get(cle) ?? null
    if (!parKeyword.has(cle) || kw.volume > (parKeyword.get(cle)?.volume ?? 0)) {
      parKeyword.set(cle, { keyword: kw.keyword, volume: kw.volume, cpc: kw.cpc, position_ot: position })
    }
  }

  // Ajouter les keywords OT non présents dans le marché (l'OT est positionné sur des niche keywords)
  for (const kw of keywords_positionnes_ot) {
    const cle = kw.keyword.toLowerCase().trim()
    if (!parKeyword.has(cle)) {
      parKeyword.set(cle, { keyword: kw.keyword, volume: kw.volume, cpc: kw.cpc, position_ot: kw.position })
    }
  }

  // Trier par volume décroissant et limiter à 300 keywords pour rester dans le budget tokens
  return Array.from(parKeyword.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 300)
}

// ─── Helper : appeler OpenAI pour un batch ────────────────────────────────────

async function classifierBatch(
  keywords: KeywordInput[],
  destination: string,
  apiKey: string,
  nbAppel: number
): Promise<ClassificationOpenAI[]> {
  const lignes = keywords
    .map((kw) => {
      const posInfo = kw.position_ot !== null && kw.position_ot !== undefined
        ? `pos_ot:${kw.position_ot}`
        : 'pos_ot:absent'
      const cpcInfo = kw.cpc !== undefined ? `cpc:${kw.cpc.toFixed(2)}€` : ''
      return `${kw.keyword} | vol:${kw.volume} | ${posInfo}${cpcInfo ? ' | ' + cpcInfo : ''}`
    })
    .join('\n')

  const systemPrompt = `Tu es expert SEO touristique. Tu réponds uniquement en JSON valide.

RÈGLES STRICTES :
- "météo [destination]" et toutes variantes météo → catégorie "hors-tourisme", intent_transactionnel: false
- Keywords sans lien direct avec le tourisme (actualités locales, services municipaux, résultats sportifs, escort, séisme...) → "hors-tourisme"
- intent_transactionnel: true UNIQUEMENT si le keyword exprime clairement une intention d'achat, réservation ou location (pas juste informatif)
- gap: true UNIQUEMENT si position_ot > 20 ou position_ot est null (pos_ot ≤ 20 = JAMAIS un gap)`

  const prompt = `Classifie ces ${keywords.length} keywords pour la destination "${destination}".

Pour chaque keyword, retourne un objet JSON avec :
- keyword (string, exact)
- volume (number, identique à l'input)
- categorie : une valeur parmi ["activités","hébergements","services","culture","restauration","transports","hors-tourisme"]
- intent_transactionnel : true si cpc > 0.30 OU si le keyword contient "réserver|réservation|booking|prix|location|billet|entrée|tarif|louer|acheter"
- position_ot : number ou null (reprendre pos_ot de l'input — null si "absent")
- gap : true si le keyword est touristique ET (pos_ot est null OU pos_ot > 20)

Exclure les keywords "hors-tourisme" du tableau retourné.

Keywords à classer :
${lignes}

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires) :
{ "keywords_classes": [ ... ] }`

  const response = await axios.post(
    OPENAI_URL,
    {
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: TIMEOUT_MS,
    }
  )

  const brut = response.data.choices?.[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
    return parsed.keywords_classes ?? []
  } catch {
    console.error(`[classification] Erreur parsing JSON batch ${nbAppel} :`, brut.slice(0, 200))
    return []
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { destination, keywords_marche, keywords_positionnes_ot } = body as {
    destination?: string
    keywords_marche?: KeywordMarche[]
    keywords_positionnes_ot?: KeywordPositionneOT[]
  }

  if (!destination || !keywords_marche || !keywords_positionnes_ot) {
    return NextResponse.json(
      { erreur: 'Paramètres destination, keywords_marche et keywords_positionnes_ot requis' },
      { status: 400 }
    )
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ erreur: 'Variable OPENAI_API_KEY manquante' }, { status: 500 })
  }

  // ─── Préparation de la liste fusionnée ────────────────────────────────────
  const keywords_fusionnes = preparerKeywordsInput(keywords_marche, keywords_positionnes_ot)

  // ─── Filtre pré-OpenAI : patterns hors-tourisme évidents (économie tokens) ─
  const keywords_input = keywords_fusionnes.filter(
    (kw) => !PATTERNS_HORS_TOURISME.some((pattern) => pattern.test(kw.keyword))
  )
  const nb_filtres_pre = keywords_fusionnes.length - keywords_input.length
  if (nb_filtres_pre > 0) {
    console.log(`[classification] ${nb_filtres_pre} keywords filtrés pré-OpenAI (hors-tourisme évidents)`)
  }

  // ─── Traitement par batch de 50 ──────────────────────────────────────────
  const batches: KeywordInput[][] = []
  for (let i = 0; i < keywords_input.length; i += BATCH_SIZE) {
    batches.push(keywords_input.slice(i, i + BATCH_SIZE))
  }

  const resultats_bruts: ClassificationOpenAI[] = []
  let nb_appels_openai = 0

  for (let i = 0; i < batches.length; i++) {
    const batch_resultat = await classifierBatch(batches[i], destination, apiKey, i + 1)
    resultats_bruts.push(...batch_resultat)
    nb_appels_openai++
  }

  // ─── Conversion vers le type final ────────────────────────────────────────
  const keywords_classes: KeywordClassifie[] = resultats_bruts
    .filter((kw) => kw.categorie !== 'hors-tourisme')
    .map((kw) => ({
      keyword: kw.keyword,
      volume: kw.volume,
      categorie: kw.categorie,
      intent_transactionnel: kw.intent_transactionnel,
      position_ot: kw.position_ot,
      // Règle dure : position ≤ 20 ne peut jamais être un gap, quelle que soit la réponse du modèle
      gap: kw.position_ot !== null && kw.position_ot <= 20 ? false : kw.gap,
      selectionne_phase_b: false,
    }))

  return NextResponse.json({
    keywords_classes,
    cout: {
      nb_appels: nb_appels_openai,
      cout_unitaire: API_COSTS.openai_gpt5_mini,
      cout_total: nb_appels_openai * API_COSTS.openai_gpt5_mini,
    },
  })
}
