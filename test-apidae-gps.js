// Test GPS fallback Apidae — source centroïde par code postal via Nominatim
// Usage : node test-apidae-gps.js
require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const API_KEY   = process.env.APIDAE_API_KEY
const PROJET_ID = process.env.APIDAE_PROJECT_ID
const BASE_URL  = 'https://api.apidae-tourisme.com/api/v002/recherche/list-objets-touristiques/'
const CQ_HEB    = 'type:HOTELLERIE OR type:HEBERGEMENT_LOCATIF OR type:HEBERGEMENT_COLLECTIF OR type:HOTELLERIE_PLEIN_AIR'

async function requeteApidae(filtre, count = 200) {
  const resp = await axios.get(BASE_URL, {
    params: {
      query: JSON.stringify({
        projetId: PROJET_ID, apiKey: API_KEY,
        ...filtre, criteresQuery: CQ_HEB,
        count, locales: ['fr'],
        responseFields: ['id', 'nom', 'type', 'localisation'],
      }),
    },
    timeout: 30_000,
  })
  return resp.data.numFound ?? 0
}

// Récupère le centroïde du code postal via Nominatim (principale localité du CP)
async function centroideCP(code_postal) {
  const resp = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { postalcode: code_postal, country: 'fr', format: 'json', limit: 1 },
    headers: { 'User-Agent': 'DestinationAuditApp/1.0' },
    timeout: 8000,
  })
  if (!resp.data[0]) return null
  return [parseFloat(resp.data[0].lon), parseFloat(resp.data[0].lat)]
}

async function main() {
  // ─── Alpe d'Huez : CP 38750 ─────────────────────────────────────
  console.log('=== HUEZ / Alpe d\'Huez (CP 38750) ===\n')

  const coordsNominatimCP = await centroideCP('38750')
  console.log(`Nominatim CP 38750 → lng=${coordsNominatimCP?.[0]}, lat=${coordsNominatimCP?.[1]}`)

  const parInsee = await requeteApidae({ communeCodesInsee: ['38191'] })
  console.log(`Par INSEE 38191   : ${parInsee}`)

  if (coordsNominatimCP) {
    for (const r of [500, 1000, 2000]) {
      const n = await requeteApidae({ center: { type: 'Point', coordinates: coordsNominatimCP }, radius: r })
      console.log(`Nominatim CP GPS ${r}m : ${n}`)
    }
  }

  // ─── Belledonne : vérification anti-pollution ─────────────────────
  console.log('\n=== BELLEDONNE — risque pollution GPS ===\n')

  const communes = [
    { nom: 'Theys',                code: '38378', cp: '38570' },
    { nom: 'Crêts-en-Belledonne',  code: '38140', cp: '38570' },
    { nom: 'Allevard',             code: '38006', cp: '38580' },
    { nom: 'Haut-Bréda',          code: '38173', cp: '38580' },
    { nom: 'La Terrasse',          code: '38372', cp: '38660' },
    { nom: 'Lumbin',               code: '38221', cp: '38660' },
  ]

  for (const c of communes) {
    const parInsee = await requeteApidae({ communeCodesInsee: [c.code] })
    const coordsCP = await centroideCP(c.cp)

    let gps500 = '-'
    let gps1000 = '-'
    if (coordsCP) {
      gps500  = await requeteApidae({ center: { type: 'Point', coordinates: coordsCP }, radius: 500 })
      gps1000 = await requeteApidae({ center: { type: 'Point', coordinates: coordsCP }, radius: 1000 })
    }

    const fallback = parInsee < 30 ? '← fallback déclenché' : ''
    console.log(`${c.nom.padEnd(22)} INSEE:${String(parInsee).padStart(4)} | GPS CP ${c.cp} 500m:${String(gps500).padStart(4)} 1000m:${String(gps1000).padStart(4)} ${fallback}`)
  }
}

main().catch(console.error)
