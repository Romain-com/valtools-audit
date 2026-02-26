// Test API OpenAI Responses API avec gpt-5-mini
require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const OPENAI_URL = 'https://api.openai.com/v1/responses'

// Helper identique à lib/openai-parse.ts
function parseOpenAIResponse(data) {
  if (data?.output) {
    const messageBlock = data.output.find((o) => o.type === 'message')
    return messageBlock?.content?.[0]?.text ?? ''
  }
  return data?.choices?.[0]?.message?.content ?? ''
}

async function test() {
  console.log('=== Test OpenAI Responses API — gpt-5-mini ===\n')

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY manquante')
    process.exit(1)
  }
  console.log('✅ Clé API chargée\n')

  // --- Test 1 : appel simple, réponse texte ---
  console.log('— Test 1 : réponse texte simple —')
  try {
    const t0 = Date.now()
    const r1 = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-5-mini',
        input: 'Réponds uniquement avec le mot "ok".',
        max_output_tokens: 500,
        reasoning: { effort: 'low' },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
      }
    )
    const duree = ((Date.now() - t0) / 1000).toFixed(1)
    const texte = parseOpenAIResponse(r1.data)
    const status = r1.data.status
    const tokensIn = r1.data.usage?.input_tokens ?? '?'
    const tokensOut = r1.data.usage?.output_tokens ?? '?'
    console.log(`  Statut     : ${status}`)
    console.log(`  Réponse    : "${texte}"`)
    console.log(`  Tokens     : in=${tokensIn} out=${tokensOut}`)
    console.log(`  Durée      : ${duree}s`)
    console.log(status === 'completed' && texte ? '  ✅ OK\n' : '  ❌ ECHEC\n')
  } catch (e) {
    console.error('  ❌', e.response?.data ?? e.message, '\n')
  }

  // --- Test 2 : sortie JSON structurée (cas réel audit) ---
  console.log('— Test 2 : sortie JSON structurée (cas réel audit) —')
  try {
    const t0 = Date.now()
    const r2 = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-5-mini',
        input: `Tu es expert en tourisme digital français. Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans commentaires.

Destination : Annecy

Retourne ce JSON :
{
  "type_destination": "string",
  "marche_principal": "string",
  "score": 7
}`,
        max_output_tokens: 500,
        reasoning: { effort: 'low' },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
      }
    )
    const duree = ((Date.now() - t0) / 1000).toFixed(1)
    const brut = parseOpenAIResponse(r2.data)
    const status = r2.data.status
    const tokensIn = r2.data.usage?.input_tokens ?? '?'
    const tokensOut = r2.data.usage?.output_tokens ?? '?'
    console.log(`  Statut     : ${status}`)
    console.log(`  Brut       : ${brut}`)
    try {
      const parsed = JSON.parse(brut.replace(/```json\n?|```/g, '').trim())
      console.log(`  Parsed     :`, parsed)
      console.log(`  Tokens     : in=${tokensIn} out=${tokensOut}`)
      console.log(`  Durée      : ${duree}s`)
      console.log('  ✅ JSON valide\n')
    } catch {
      console.log(`  Tokens     : in=${tokensIn} out=${tokensOut}`)
      console.log(`  Durée      : ${duree}s`)
      console.log('  ❌ JSON invalide\n')
    }
  } catch (e) {
    console.error('  ❌', e.response?.data ?? e.message, '\n')
  }

  // --- Test 3 : structure brute de la réponse ---
  console.log('— Test 3 : structure brute data.output[] —')
  try {
    const r3 = await axios.post(
      OPENAI_URL,
      {
        model: 'gpt-5-mini',
        input: 'Dis "bonjour".',
        max_output_tokens: 500,
        reasoning: { effort: 'low' },
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
      }
    )
    const output = r3.data.output ?? []
    console.log(`  output.length : ${output.length}`)
    output.forEach((block, i) => {
      const preview = block.type === 'message'
        ? (block.content?.[0]?.text ?? '').substring(0, 80)
        : `(${block.type})`
      console.log(`  output[${i}].type="${block.type}" → "${preview}"`)
    })
    console.log('  ✅ Structure OK\n')
  } catch (e) {
    console.error('  ❌', e.response?.data ?? e.message, '\n')
  }

  console.log('=== Fin des tests ===')
}

test()
