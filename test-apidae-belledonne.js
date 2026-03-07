// Test stratégie GPS BAN + filtre commune.nom — communes Belledonne
// Affiche chaque hébergement avec sa commune.nom Apidae pour vérification
// Usage : node test-apidae-belledonne.js
require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const API_KEY   = process.env.APIDAE_API_KEY
const PROJET_ID = process.env.APIDAE_PROJECT_ID
const BASE_URL  = 'https://api.apidae-tourisme.com/api/v002/recherche/list-objets-touristiques/'
const CQ_HEB    = 'type:HOTELLERIE OR type:HEBERGEMENT_LOCATIF OR type:HEBERGEMENT_COLLECTIF OR type:HOTELLERIE_PLEIN_AIR'

function normalise(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_']/g, ' ').trim()
}

// Résolution nom + CP → INSEE via geo.api.gouv.fr
async function trouverInsee(nom, cp) {
  const resp = await axios.get('https://geo.api.gouv.fr/communes', {
    params: { nom, codePostal: cp, fields: 'code,nom', limit: 5 },
    timeout: 5000,
  })
  return resp.data // tableau de { code, nom }
}

// Centre mairie via BAN
async function centreBAN(nom, cp) {
  const resp = await axios.get('https://api-adresse.data.gouv.fr/search/', {
    params: { q: nom, postcode: cp, type: 'municipality', limit: 1 },
    timeout: 5000,
  })
  const f = resp.data.features?.[0]
  if (!f) return null
  return { coords: f.geometry.coordinates, label: f.properties.label, score: f.properties.score?.toFixed(2) }
}

// Requête Apidae GPS
async function requeteGPS(coords, rayon) {
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

async function testerCommune(nomCible, cp) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`COMMUNE : ${nomCible.toUpperCase()} (CP ${cp})`)
  console.log('─'.repeat(60))

  // 1. INSEE
  const resultatsGeo = await trouverInsee(nomCible, cp)
  if (resultatsGeo.length === 0) {
    console.log(`  ⚠ geo.api : aucune commune trouvée`)
  } else {
    resultatsGeo.forEach(c => console.log(`  geo.api → "${c.nom}" INSEE ${c.code}`))
  }

  // 2. BAN centre
  const ban = await centreBAN(nomCible, cp)
  if (!ban) { console.log(`  ⚠ BAN : indisponible`); return }
  console.log(`  BAN    → "${ban.label}" (score=${ban.score}) lng=${ban.coords[0].toFixed(4)}, lat=${ban.coords[1].toFixed(4)}`)

  // 3. GPS 3km
  const objets = await requeteGPS(ban.coords, 3000)

  // Répartition brute par commune.nom
  const parCommune = {}
  objets.forEach(o => {
    const c = o.localisation?.adresse?.commune?.nom ?? '(inconnu)'
    parCommune[c] = (parCommune[c] ?? 0) + 1
  })
  console.log(`\n  GPS 3km → ${objets.length} total | répartition par commune.nom :`)
  Object.entries(parCommune).sort((a,b) => b[1]-a[1]).forEach(([c,n]) => console.log(`    "${c}" → ${n}`))

  // 4. Après filtre commune.nom
  const cible = normalise(nomCible)
  const filtres = objets.filter(o => {
    const nomObj = o.localisation?.adresse?.commune?.nom
    if (!nomObj) return true
    const n = normalise(nomObj)
    return n.includes(cible) || cible.includes(n)
  })

  console.log(`\n  Après filtre ≈ "${nomCible}" : ${filtres.length} hébergements`)
  if (filtres.length > 0) {
    console.log(`  Détail (max 20 premiers) :`)
    filtres.slice(0, 20).forEach(o => {
      const nom = o.nom?.libelleFr ?? o.nom?.libelle ?? '(sans nom)'
      const communeApidae = o.localisation?.adresse?.commune?.nom ?? '(inconnu)'
      const cp2 = o.localisation?.adresse?.codePostal ?? ''
      console.log(`    [${o.type.padEnd(22)}] ${nom.slice(0,40).padEnd(40)} | commune.nom="${communeApidae}" ${cp2}`)
    })
    if (filtres.length > 20) console.log(`    ... et ${filtres.length - 20} autres`)
  }

  // 5. Items exclus (dans le rayon mais pas dans cette commune)
  const exclus = objets.filter(o => !filtres.includes(o))
  if (exclus.length > 0) {
    const exclusParCommune = {}
    exclus.forEach(o => { const c = o.localisation?.adresse?.commune?.nom ?? '(inconnu)'; exclusParCommune[c] = (exclusParCommune[c]??0)+1 })
    console.log(`\n  Items exclus (${exclus.length}) — autres communes dans le rayon :`)
    Object.entries(exclusParCommune).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(`    "${c}" → ${n} (exclus)`))
  }
}

async function main() {
  const communes = [
    { nom: 'Theys',                        cp: '38570' },
    { nom: 'Les Adrets-de-Belledonne',     cp: '38190' },
    { nom: 'Haut-Bréda',                   cp: '38580' },
    { nom: 'Chamrousse',                   cp: '38410' },
    { nom: 'Allevard',                     cp: '38580' },
    { nom: 'Crêts-en-Belledonne',          cp: '38570' },
    { nom: 'Le Plateau-des-Petites-Roches',cp: '38660' },
    { nom: 'La Terrasse',                  cp: '38660' },
    { nom: 'Lumbin',                       cp: '38660' },
  ]

  for (const c of communes) {
    await testerCommune(c.nom, c.cp)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('TEST TERMINÉ')
}

main().catch(console.error)
