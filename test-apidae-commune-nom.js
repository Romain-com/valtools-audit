// Test : quels commune.nom Apidae retourne pour les communes Belledonne + Huez
// Stratégie : GPS large rayon centré BAN, post-tri par commune.nom
// Usage : node test-apidae-commune-nom.js
require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const API_KEY   = process.env.APIDAE_API_KEY
const PROJET_ID = process.env.APIDAE_PROJECT_ID
const BASE_URL  = 'https://api.apidae-tourisme.com/api/v002/recherche/list-objets-touristiques/'
const CQ_HEB    = 'type:HOTELLERIE OR type:HEBERGEMENT_LOCATIF OR type:HEBERGEMENT_COLLECTIF OR type:HOTELLERIE_PLEIN_AIR'

// Centre via BAN (mairie — meilleur que centroïde géométrique pour les stations)
async function centreBAN(nom, cp) {
  const resp = await axios.get('https://api-adresse.data.gouv.fr/search/', {
    params: { q: nom, postcode: cp, type: 'municipality', limit: 1 },
    timeout: 5000,
  })
  const f = resp.data.features?.[0]
  if (!f) return null
  return f.geometry.coordinates // [lng, lat]
}

async function requeteApidaeGPS(coords, rayon) {
  const resp = await axios.get(BASE_URL, {
    params: {
      query: JSON.stringify({
        projetId: PROJET_ID, apiKey: API_KEY,
        center: { type: 'Point', coordinates: coords },
        radius: rayon,
        criteresQuery: CQ_HEB,
        count: 200,
        locales: ['fr'],
        responseFields: ['id', 'nom', 'type', 'localisation'],
      }),
    },
    timeout: 30_000,
  })
  return resp.data.objetsTouristiques ?? []
}

async function requeteApidaeInsee(codes) {
  const resp = await axios.get(BASE_URL, {
    params: {
      query: JSON.stringify({
        projetId: PROJET_ID, apiKey: API_KEY,
        communeCodesInsee: codes,
        criteresQuery: CQ_HEB,
        count: 200,
        locales: ['fr'],
        responseFields: ['id', 'nom', 'type', 'localisation'],
      }),
    },
    timeout: 30_000,
  })
  return resp.data.objetsTouristiques ?? []
}

function communeNom(obj) {
  return obj.localisation?.adresse?.commune?.nom ?? '(inconnu)'
}

async function analyserCommune(label, codeInsee, cp, nomCommune) {
  console.log(`\n${'='.repeat(55)}`)
  console.log(`${label} | INSEE: ${codeInsee} | CP: ${cp}`)
  console.log('='.repeat(55))

  // 1. Par INSEE
  const parInsee = await requeteApidaeInsee([codeInsee])
  const communesInsee = {}
  parInsee.forEach(o => { communesInsee[communeNom(o)] = (communesInsee[communeNom(o)] ?? 0) + 1 })
  console.log(`\nPar communeCodesInsee: ${parInsee.length} résultats`)
  Object.entries(communesInsee).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(`  commune.nom="${c}" → ${n}`))

  // 2. Centre BAN + GPS 3km
  const coords = await centreBAN(nomCommune, cp)
  if (!coords) { console.log('BAN indisponible'); return }
  console.log(`\nBAN centre: lng=${coords[0].toFixed(4)}, lat=${coords[1].toFixed(4)}`)

  const parGPS = await requeteApidaeGPS(coords, 3000)
  const communesGPS = {}
  parGPS.forEach(o => { communesGPS[communeNom(o)] = (communesGPS[communeNom(o)] ?? 0) + 1 })
  console.log(`\nPar GPS BAN 3km: ${parGPS.length} résultats`)
  Object.entries(communesGPS).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(`  commune.nom="${c}" → ${n}`))

  // 3. Post-filtrage par nom cible
  function normalise(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_']/g, ' ').trim()
  }
  const cible = normalise(nomCommune)
  const filtres = parGPS.filter(o => {
    const n = normalise(communeNom(o))
    return n.includes(cible) || cible.includes(n) || n === '(inconnu)'
  })
  console.log(`\nAprès filtre commune.nom ≈ "${nomCommune}": ${filtres.length} hébergements`)
}

async function main() {
  // Communes Belledonne partageant des CP
  await analyserCommune('Theys',               '38378', '38570', 'Theys')
  await analyserCommune('Crêts-en-Belledonne', '38140', '38570', 'Crêts-en-Belledonne')
  await analyserCommune('La Terrasse',         '38372', '38660', 'La Terrasse')
  await analyserCommune('Lumbin',              '38221', '38660', 'Lumbin')
  // Station Alpe d'Huez
  await analyserCommune('Huez / Alpe d\'Huez', '38191', '38750', 'Huez')
}

main().catch(console.error)
