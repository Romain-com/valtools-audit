// Test API Apidae Tourisme — exploration des objets touristiques
// Usage : node test-apidae.js [commune_insee]
// Exemple : node test-apidae.js 74010  (Annecy)
//           node test-apidae.js 73220  (Courchevel)

const axios = require('axios')

const API_KEY = 'm1s2tMJ3'
const PROJET_ID = '2537'
const BASE_URL = 'https://api.apidae-tourisme.com/api/v002/recherche/list-objets-touristiques/'

const codeInsee = process.argv[2] || '74010' // Annecy par défaut

// Extrait le libellé depuis un champ nom Apidae (libelleFr ou libelle)
function getNom(obj) {
  return obj?.nom?.libelleFr ?? obj?.nom?.libelle ?? obj?.nom?.fr ?? '(sans nom)'
}

// Extrait les coordonnées de contact depuis moyensCommunication
function getContacts(obj) {
  const moyens = obj?.informations?.moyensCommunication ?? []
  const site = moyens.find(m => m.type?.id === 205)?.coordonnees?.fr ?? null
  const tel = moyens.find(m => m.type?.id === 201)?.coordonnees?.fr ?? null
  const mail = moyens.find(m => m.type?.id === 204)?.coordonnees?.fr ?? null
  return { site, tel, mail }
}

// --- Test 1 : Recherche basique par code INSEE, comptage par type ---
async function testBasicSearch() {
  console.log('\n=== TEST 1 : Recherche basique par commune INSEE ===')
  console.log(`Code INSEE : ${codeInsee}\n`)

  const query = {
    projetId: PROJET_ID,
    apiKey: API_KEY,
    communeCodesInsee: [codeInsee],
    first: 0,
    count: 10,
    locales: ['fr'],
    responseFields: ['id', 'nom', 'type', 'localisation', 'informations'],
  }

  const response = await axios.get(BASE_URL, {
    params: { query: JSON.stringify(query) },
    timeout: 30_000,
  })

  const data = response.data
  console.log('numFound :', data.numFound)
  console.log('objets retournés :', data.objetsTouristiques?.length ?? 0)

  // Comptage des types
  const parType = {}
  for (const obj of data.objetsTouristiques ?? []) {
    parType[obj.type] = (parType[obj.type] ?? 0) + 1
  }
  console.log('Types dans cet échantillon :', parType)
  console.log()

  console.log('--- Aperçu des 10 premiers objets ---')
  for (const [i, obj] of (data.objetsTouristiques ?? []).entries()) {
    const nom = getNom(obj)
    const commune = obj.localisation?.adresse?.commune?.nom ?? '?'
    const { site, tel } = getContacts(obj)
    console.log(`[${i + 1}] [${obj.type}] ${nom} — ${commune}`)
    if (site) console.log(`     site: ${site}`)
    if (tel) console.log(`     tel: ${tel}`)
  }

  return data
}

// --- Test 2 : Comptage par type via criteresQuery (Lucene) ---
async function testTypes() {
  console.log('\n=== TEST 2 : Comptage par type sur la commune (criteresQuery) ===')

  // Les types Apidae passés via Lucene avec le champ "type"
  const TYPES = ['HEBERGEMENT_LOCATIF', 'HEBERGEMENT_COLLECTIF', 'HOTELLERIE', 'RESTAURATION', 'ACTIVITE', 'FETE_ET_MANIFESTATION', 'STRUCTURE', 'EQUIPEMENT']

  for (const type of TYPES) {
    const query = {
      projetId: PROJET_ID,
      apiKey: API_KEY,
      communeCodesInsee: [codeInsee],
      criteresQuery: `type:${type}`,
      first: 0,
      count: 1,
      locales: ['fr'],
      responseFields: ['id', 'nom', 'type'],
    }

    try {
      const response = await axios.get(BASE_URL, {
        params: { query: JSON.stringify(query) },
        timeout: 30_000,
      })
      console.log(`  ${type.padEnd(30)} : ${response.data.numFound} objets`)
    } catch (err) {
      console.log(`  ${type.padEnd(30)} : ERREUR — ${err.response?.data?.message ?? err.message}`)
    }
  }
}

// --- Test 3 : Recherche fulltext ---
async function testFulltext() {
  const keyword = 'randonnée'
  console.log(`\n=== TEST 3 : Recherche fulltext "${keyword}" ===`)

  const query = {
    projetId: PROJET_ID,
    apiKey: API_KEY,
    searchQuery: keyword,
    searchFields: 'NOM_DESCRIPTION',
    first: 0,
    count: 5,
    locales: ['fr'],
    responseFields: ['id', 'nom', 'type'],
  }

  const response = await axios.get(BASE_URL, {
    params: { query: JSON.stringify(query) },
    timeout: 30_000,
  })

  const data = response.data
  console.log('numFound :', data.numFound)
  for (const [i, obj] of (data.objetsTouristiques ?? []).entries()) {
    console.log(`[${i + 1}] [${obj.type}] ${getNom(obj)}`)
  }
}

// --- Test 4 : Objet complet — inventaire des champs disponibles ---
async function testChampsDispo() {
  console.log('\n=== TEST 4 : Structure complète d\'un HEBERGEMENT (criteresQuery) ===')

  const query = {
    projetId: PROJET_ID,
    apiKey: API_KEY,
    communeCodesInsee: [codeInsee],
    criteresQuery: 'type:HOTELLERIE',
    first: 0,
    count: 1,
    locales: ['fr'],
    // Pas de responseFields → tout retourner
  }

  const response = await axios.get(BASE_URL, {
    params: { query: JSON.stringify(query) },
    timeout: 30_000,
  })

  const obj = response.data.objetsTouristiques?.[0]
  if (!obj) { console.log('Aucun hébergement trouvé pour cette commune'); return }

  console.log('numFound HOTELLERIE :', response.data.numFound)
  console.log('Clés de niveau 1 :', Object.keys(obj).join(', '))
  console.log()
  console.log('--- Objet complet ---')
  console.log(JSON.stringify(obj, null, 2))
}

// --- Test 5 : Recherche géolocalisée (rayon autour d'un point) ---
async function testGeo() {
  // Coordonnées centre d'Annecy
  const center = { type: 'Point', coordinates: [6.1228, 45.899] }
  const radius = 5000 // 5 km
  console.log(`\n=== TEST 5 : Recherche géolocalisée (rayon ${radius / 1000} km) ===`)

  const query = {
    projetId: PROJET_ID,
    apiKey: API_KEY,
    center, // objet GeoJSON directement (pas une string)
    radius,
    first: 0,
    count: 5,
    locales: ['fr'],
    responseFields: ['id', 'nom', 'type', 'localisation'],
  }

  const response = await axios.get(BASE_URL, {
    params: { query: JSON.stringify(query) },
    timeout: 30_000,
  })

  const data = response.data
  console.log('numFound :', data.numFound)
  for (const [i, obj] of (data.objetsTouristiques ?? []).entries()) {
    const coords = obj.localisation?.geolocalisation?.geoJson?.coordinates
    console.log(`[${i + 1}] [${obj.type}] ${getNom(obj)} ${coords ? `(${coords[1]}, ${coords[0]})` : ''}`)
  }
}

// --- Exécution séquentielle ---
async function main() {
  console.log(`\nApidae API Test — apiKey: ${API_KEY} | projetId: ${PROJET_ID}`)
  console.log('='.repeat(60))

  for (const [name, fn] of [
    ['testBasicSearch', testBasicSearch],
    ['testTypes', testTypes],
    ['testFulltext', testFulltext],
    ['testChampsDispo', testChampsDispo],
    ['testGeo', testGeo],
  ]) {
    try {
      await fn()
    } catch (err) {
      console.error(`${name} ERREUR :`, err.response?.data ?? err.message)
    }
  }

  console.log('\n=== Fin des tests ===\n')
}

main()
