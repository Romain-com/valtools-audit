const axios = require('axios')

async function scanTypes(codeInsee) {
  console.log(`\nScan types DATA Tourisme — INSEE ${codeInsee}\n`)

  let data
  try {
    const response = await axios.get(`http://localhost:3001/scan-types?code_insee=${codeInsee}`, {
      timeout: 120000, // 2 min — le scan peut être long pour les grandes communes
    })
    data = response.data
  } catch (err) {
    if (err.response) {
      console.error(`Erreur HTTP ${err.response.status} :`, err.response.data)
    } else {
      console.error('Impossible de joindre le microservice :', err.message)
      console.error('→ Vérifier que le microservice tourne : cd microservice && npm run dev')
    }
    process.exit(1)
  }

  const { total_fichiers, types_distincts, types } = data

  console.log(`Total fichiers    : ${total_fichiers}`)
  console.log(`Types distincts   : ${types_distincts}`)
  console.log('\n--- TYPES PAR FRÉQUENCE ---\n')

  const largeurBarre = 40
  types.forEach(({ type, count }) => {
    const pct = total_fichiers > 0 ? count / total_fichiers : 0
    const nbBlocs = Math.round(pct * largeurBarre)
    const barre = '█'.repeat(nbBlocs).padEnd(largeurBarre)
    const pctStr = (pct * 100).toFixed(1).padStart(5)
    console.log(`${String(count).padStart(6)}  ${barre}  ${pctStr}%  ${type}`)
  })

  console.log('\n--- RÉSUMÉ BRUT (copier-coller) ---\n')
  types.forEach(({ type, count }) => {
    console.log(`${type}: ${count}`)
  })
}

const codeInsee = process.argv[2] || '74010'
scanTypes(codeInsee).catch(console.error)
