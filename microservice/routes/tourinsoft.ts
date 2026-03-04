// Routes Express — données Tourinsoft ANMSM
// Toutes les requêtes sont filtrées par code_postal.

import { Router, Request, Response } from 'express'
import {
  isTourinsofrPret,
  getStationsParCp,
  getHebergementsParCp,
  getActivitesParCp,
  getCommercesParCp,
  getSejours,
  getResumeParCp,
} from '../services/tourinsoft'

const router = Router()

// ─── Middleware : vérification disponibilité ──────────────────────────────────

function verifierDisponibilite(req: Request, res: Response, next: () => void) {
  if (!isTourinsofrPret()) {
    return res.status(503).json({
      erreur: 'Index Tourinsoft non initialisé — lancer sync-tourinsoft.ts puis redémarrer le microservice',
    })
  }
  next()
}

// ─── GET /tourinsoft/resume?code_postal=74400 ─────────────────────────────────
// Retourne la station + compteurs héb/act/com pour un code postal

router.get('/resume', verifierDisponibilite, (req: Request, res: Response) => {
  const cp = (req.query.code_postal as string)?.trim()
  if (!cp) return res.status(400).json({ erreur: 'Paramètre code_postal requis' })

  const resume = getResumeParCp(cp)
  return res.json(resume)
})

// ─── GET /tourinsoft/station?code_postal=74400 ───────────────────────────────
// Retourne les stations de montagne correspondant au code postal

router.get('/station', verifierDisponibilite, (req: Request, res: Response) => {
  const cp = (req.query.code_postal as string)?.trim()
  if (!cp) return res.status(400).json({ erreur: 'Paramètre code_postal requis' })

  const stations = getStationsParCp(cp)
  return res.json({ stations, nb: stations.length })
})

// ─── GET /tourinsoft/hebergements?code_postal=74400 ──────────────────────────

router.get('/hebergements', verifierDisponibilite, (req: Request, res: Response) => {
  const cp = (req.query.code_postal as string)?.trim()
  if (!cp) return res.status(400).json({ erreur: 'Paramètre code_postal requis' })

  const items = getHebergementsParCp(cp)
  const total_lits = items.reduce((s, h) => s + (h.lits || 0), 0)
  return res.json({ items, nb: items.length, total_lits })
})

// ─── GET /tourinsoft/activites?code_postal=74400 ─────────────────────────────

router.get('/activites', verifierDisponibilite, (req: Request, res: Response) => {
  const cp = (req.query.code_postal as string)?.trim()
  if (!cp) return res.status(400).json({ erreur: 'Paramètre code_postal requis' })

  const items = getActivitesParCp(cp)
  return res.json({ items, nb: items.length })
})

// ─── GET /tourinsoft/commerces?code_postal=74400 ─────────────────────────────

router.get('/commerces', verifierDisponibilite, (req: Request, res: Response) => {
  const cp = (req.query.code_postal as string)?.trim()
  if (!cp) return res.status(400).json({ erreur: 'Paramètre code_postal requis' })

  const items = getCommercesParCp(cp)
  return res.json({ items, nb: items.length })
})

// ─── GET /tourinsoft/sejours?station_id=STATANMSM... ─────────────────────────

router.get('/sejours', verifierDisponibilite, (req: Request, res: Response) => {
  const stationId = (req.query.station_id as string)?.trim()
  const items = getSejours(stationId || undefined)
  return res.json({ items, nb: items.length })
})

export default router
