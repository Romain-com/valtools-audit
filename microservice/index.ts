import 'dotenv/config'
import express from 'express'
import path from 'path'
import { chargerCSVCommunes } from './services/csv-reader'
import { chargerOuConstruireIndex } from './services/datatourisme'
import routesCommunes from './routes/communes'
import routesPOI from './routes/poi'
import routesEPCI from './routes/epci'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)

// Variables d'environnement requises
const CSV_PATH = process.env.CSV_COMMUNES_PATH
const DATATOURISME_PATH = process.env.DATA_TOURISME_PATH

if (!CSV_PATH) {
  console.error('[Microservice] Variable manquante : CSV_COMMUNES_PATH')
  process.exit(1)
}
if (!DATATOURISME_PATH) {
  console.error('[Microservice] Variable manquante : DATA_TOURISME_PATH')
  process.exit(1)
}

// Middleware JSON (pour les futures routes POST si besoin)
app.use(express.json())

// Chargement du CSV communes — synchrone et bloquant intentionnellement
// (garantit que les recherches de communes fonctionnent dès le démarrage)
try {
  chargerCSVCommunes(path.resolve(CSV_PATH))
} catch (err) {
  console.error('[Microservice] Impossible de charger le CSV communes :', err)
  process.exit(1)
}

// Routes
app.use('/communes', routesCommunes)
app.use('/poi', routesPOI)
app.use('/epci', routesEPCI)

// Route de santé — utile pour vérifier que le serveur répond
app.get('/health', (_req, res) => {
  res.json({ statut: 'ok', port: PORT })
})

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`[Microservice] Serveur démarré sur le port ${PORT}`)

  // Chargement ou construction de l'index DATA Tourisme — ne bloque pas le serveur
  chargerOuConstruireIndex().catch((err: unknown) => {
    console.error('[Microservice] Erreur lors du chargement de l\'index :', err)
  })
})
