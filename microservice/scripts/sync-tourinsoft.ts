#!/usr/bin/env ts-node
// Script de synchronisation Tourinsoft ANMSM
// Télécharge les 5 flux XML, extrait les champs utiles, écrit des JSON compacts sur disque.
// Usage : npx ts-node scripts/sync-tourinsoft.ts
// Durée estimée : 5-15 min (téléchargement ~750MB de XML total)

import https from 'https'
import fs from 'fs'
import path from 'path'

// ─── Configuration des flux ───────────────────────────────────────────────────

const BASE_URL = 'https://api-v3.tourinsoft.com/api/syndications/anmsm.tourinsoft.com'

const FEEDS = {
  stations: `${BASE_URL}/A676A2F1-0B32-41F3-B7CB-C68EBFF61964`,   // 93 items,  22 MB
  sejours:  `${BASE_URL}/6A799016-DCD9-474D-A17B-FDE2FB3C5031`,   // 43 items,   1 MB
  hebergements: `${BASE_URL}/D2075BFB-7D9D-49FA-A3CA-30E5CE646136`, // 15k items, 627 MB
  activites:    `${BASE_URL}/EBD5CD64-5B7D-4911-BDB3-2B31300FD075`, //  8k items, ~80 MB
  commerces:    `${BASE_URL}/349346F2-67F8-4B7C-89F0-54326078BC76`, //  3k items,  65 MB
}

const CACHE_DIR = path.join(__dirname, '../cache/tourinsoft')

// ─── Types compacts (champs stockés pour chaque type d'objet) ─────────────────

interface StationCompacte {
  id: string            // SyndicObjectID = code station
  nom: string           // NOMSTATION
  lat: number
  lng: number
  cp_ot: string         // code postal de l'office de tourisme
  alt_bas: number       // ALTBAS (m)
  alt_haut: number      // ALTHAUT (m)
  vtt: boolean          // pistes VTT été
  nom_ot: string        // NOMOT
  adresse_ot: string    // ADRESSEOT
  accroche: string      // présentation courte
  desc_hiver: string    // DESCHIVERFR
  desc_ete: string      // DESCETEFR
  desc_act_hiver: string // DESCACTHIVERFR
  desc_act_ete: string  // DESCACTFR
  desc_heb: string      // DESCHEBFR
  desc_res: string      // DESCRESHIVERFR
}

interface HebergementCompact {
  id: string
  nom: string
  type: string          // ObjectTypeName
  commune: string       // COMMUNE
  code_postal: string   // CODEPOSTAL
  station_id: string    // STATION (lien vers stations.id)
  lits: number          // HEBTOTAL
  lat: number
  lng: number
}

interface ActiviteCompacte {
  id: string
  nom: string
  type: string          // ObjectTypeName
  commune: string       // COMMUNE
  code_postal: string   // CODEPOSTAL
  station_id: string    // STATION
  lat: number
  lng: number
}

interface CommerceCompact {
  id: string
  nom: string
  type: string          // ObjectTypeName
  commune: string       // IDCOMMUNE ou COMMUNE
  code_postal: string   // CODEPOSTAL
  station_id: string    // STATION
  lat: number
  lng: number
}

interface SejourCompact {
  id: string
  nom: string
  station_id: string    // STATION
  lat: number
  lng: number
  accroche: string      // ACCSEJFR
  description: string   // DESCSEJFR
}

// ─── Téléchargement vers fichier temporaire ───────────────────────────────────
// Écrit sur disque pour éviter la limite de taille des strings V8 (~512 MB)

function telechargerVersFichier(url: string, fichierCible: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let octets = 0

    const requete = https.get(url, (rep) => {
      if (rep.statusCode === 301 || rep.statusCode === 302) {
        const redirect = rep.headers.location
        if (redirect) {
          console.log(`  → Redirection vers ${redirect}`)
          telechargerVersFichier(redirect, fichierCible).then(resolve).catch(reject)
          return
        }
      }
      if (rep.statusCode !== 200) {
        reject(new Error(`HTTP ${rep.statusCode} pour ${url}`))
        return
      }

      const flux = fs.createWriteStream(fichierCible, { encoding: 'utf-8' })

      rep.on('data', (chunk: Buffer) => {
        flux.write(chunk)
        octets += chunk.length
        if (octets % (10 * 1024 * 1024) < chunk.length) {
          process.stdout.write(`\r  ${(octets / 1024 / 1024).toFixed(1)} MB reçus...`)
        }
      })

      rep.on('end', () => {
        process.stdout.write('\n')
        flux.end()
        flux.on('finish', resolve)
        flux.on('error', reject)
      })

      rep.on('error', (err) => { flux.destroy(); reject(err) })
    })

    requete.on('error', reject)
    requete.setTimeout(600_000, () => {
      requete.destroy()
      reject(new Error(`Timeout 10min dépassé pour ${url}`))
    })
  })
}

// ─── Parser XML Atom Tourinsoft — lecture par chunks depuis fichier ────────────
// Lit par blocs de 8 MB pour éviter la limite des strings V8.
// Extrait les blocs <m:properties>...</m:properties> qui traversent les chunks.

const CHUNK_SIZE = 8 * 1024 * 1024 // 8 MB
const MARQUEUR_DEBUT = '<content type="application/xml">'
const MARQUEUR_PROPS_DEBUT = '<m:properties>'
const MARQUEUR_PROPS_FIN = '</m:properties>'
const PROP_REGEX = /<d:([A-Za-z_][A-Za-z0-9_]*)(?:\s[^>]*)?>([^<]*)<\/d:[A-Za-z_][A-Za-z0-9_]*>/g

function extrairePropsDeBloc(propsXml: string): Record<string, string> {
  const props: Record<string, string> = {}
  PROP_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PROP_REGEX.exec(propsXml)) !== null) {
    const [, nom, valeur] = match
    if (valeur.trim()) props[nom] = valeur.trim()
  }
  return props
}

function* extraireEntriesDepuisFichier(fichier: string): Generator<Record<string, string>> {
  const fd = fs.openSync(fichier, 'r')
  const bufferLecture = Buffer.alloc(CHUNK_SIZE)
  let reste = ''

  try {
    let bytesLus: number

    while ((bytesLus = fs.readSync(fd, bufferLecture, 0, CHUNK_SIZE, null)) > 0) {
      const chunk = reste + bufferLecture.subarray(0, bytesLus).toString('utf-8')
      reste = ''

      // Découper le chunk en blocs </m:properties>
      let pos = 0
      while (true) {
        // Chercher un début de bloc de propriétés principal
        const idxContent = chunk.indexOf(MARQUEUR_DEBUT, pos)
        if (idxContent === -1) {
          // Pas de début trouvé — garder la fin du chunk comme reste
          reste = chunk.slice(Math.max(0, chunk.length - MARQUEUR_DEBUT.length - MARQUEUR_PROPS_DEBUT.length - 1))
          break
        }

        const idxDebut = chunk.indexOf(MARQUEUR_PROPS_DEBUT, idxContent)
        if (idxDebut === -1) {
          reste = chunk.slice(idxContent)
          break
        }

        const idxFin = chunk.indexOf(MARQUEUR_PROPS_FIN, idxDebut)
        if (idxFin === -1) {
          // Bloc incomplet — garder tout depuis idxContent
          reste = chunk.slice(idxContent)
          break
        }

        const propsXml = chunk.substring(idxDebut + MARQUEUR_PROPS_DEBUT.length, idxFin)
        const props = extrairePropsDeBloc(propsXml)
        if (Object.keys(props).length > 0) yield props

        pos = idxFin + MARQUEUR_PROPS_FIN.length
      }
    }

    // Traiter le reste final s'il contient un bloc complet
    if (reste) {
      const idxContent = reste.indexOf(MARQUEUR_DEBUT)
      if (idxContent !== -1) {
        const idxDebut = reste.indexOf(MARQUEUR_PROPS_DEBUT, idxContent)
        const idxFin = reste.indexOf(MARQUEUR_PROPS_FIN, idxDebut)
        if (idxDebut !== -1 && idxFin !== -1) {
          const propsXml = reste.substring(idxDebut + MARQUEUR_PROPS_DEBUT.length, idxFin)
          const props = extrairePropsDeBloc(propsXml)
          if (Object.keys(props).length > 0) yield props
        }
      }
    }
  } finally {
    fs.closeSync(fd)
  }
}

function toFloat(v: string | undefined): number {
  const n = parseFloat(v ?? '')
  return isNaN(n) ? 0 : n
}

function toInt(v: string | undefined): number {
  const n = parseInt(v ?? '', 10)
  return isNaN(n) ? 0 : n
}

// ─── Parsers par type de feed ─────────────────────────────────────────────────

function parserStation(props: Record<string, string>): StationCompacte | null {
  const id = props['SyndicObjectID']
  if (!id || !id.startsWith('STATANMSM')) return null
  return {
    id,
    nom:              props['NOMSTATION'] || props['SyndicObjectName'] || '',
    lat:              toFloat(props['GmapLatitude'] || props['LATITUDE'] || props['GOOGLELATITUDE']),
    lng:              toFloat(props['GmapLongitude'] || props['LONGITUDE'] || props['GOOGLELONGITUDE']),
    cp_ot:            props['CPOT'] || '',
    alt_bas:          toInt(props['ALTBAS']),
    alt_haut:         toInt(props['ALTHAUT']),
    vtt:              props['VTT'] === 'true',
    nom_ot:           props['NOMOT'] || '',
    adresse_ot:       props['ADRESSEOT'] || '',
    accroche:         props['ACCROCHE'] || '',
    desc_hiver:       props['DESCHIVERFR'] || '',
    desc_ete:         props['DESCETEFR'] || '',
    desc_act_hiver:   props['DESCACTHIVERFR'] || '',
    desc_act_ete:     props['DESCACTFR'] || '',
    desc_heb:         props['DESCHEBFR'] || '',
    desc_res:         props['DESCRESHIVERFR'] || '',
  }
}

function parserHebergement(props: Record<string, string>): HebergementCompact | null {
  const id = props['SyndicObjectID']
  const cp = props['CODEPOSTAL']
  if (!id || !cp) return null
  return {
    id,
    nom:        props['SyndicObjectName'] || props['SOCIETE'] || '',
    type:       props['ObjectTypeName'] || '',
    commune:    props['COMMUNE'] || '',
    code_postal: cp,
    station_id: props['STATION'] || '',
    lits:       toInt(props['HEBTOTAL']),
    lat:        toFloat(props['GmapLatitude'] || props['GOOGLELATITUDE']),
    lng:        toFloat(props['GmapLongitude'] || props['GOOGLELONGITUDE']),
  }
}

function parserActivite(props: Record<string, string>): ActiviteCompacte | null {
  const id = props['SyndicObjectID']
  const cp = props['CODEPOSTAL']
  if (!id || !cp) return null
  return {
    id,
    nom:        props['SyndicObjectName'] || props['SOCIETE'] || '',
    type:       props['ObjectTypeName'] || '',
    commune:    props['COMMUNE'] || '',
    code_postal: cp,
    station_id: props['STATION'] || '',
    lat:        toFloat(props['GmapLatitude'] || props['GOOGLELATITUDE']),
    lng:        toFloat(props['GmapLongitude'] || props['GOOGLELONGITUDE']),
  }
}

function parserCommerce(props: Record<string, string>): CommerceCompact | null {
  const id = props['SyndicObjectID']
  const cp = props['CODEPOSTAL']
  if (!id || !cp) return null
  return {
    id,
    nom:        props['SyndicObjectName'] || props['SOCIETE'] || '',
    type:       props['ObjectTypeName'] || '',
    commune:    props['IDCOMMUNE'] || props['COMMUNE'] || '',
    code_postal: cp,
    station_id: props['STATION'] || '',
    lat:        toFloat(props['GmapLatitude'] || props['GOOGLELATITUDE']),
    lng:        toFloat(props['GmapLongitude'] || props['GOOGLELONGITUDE']),
  }
}

function parserSejour(props: Record<string, string>): SejourCompact | null {
  const id = props['SyndicObjectID']
  if (!id) return null
  return {
    id,
    nom:         props['SyndicObjectName'] || props['IDSEJFR'] || '',
    station_id:  props['STATION'] || '',
    lat:         toFloat(props['GmapLatitude'] || props['GOOGLELATITUDE']),
    lng:         toFloat(props['GmapLongitude'] || props['GOOGLELONGITUDE']),
    accroche:    props['ACCSEJFR'] || '',
    description: props['DESCSEJFR'] || '',
  }
}

// ─── Synchronisation d'un flux ────────────────────────────────────────────────

const TEMP_DIR = path.join(__dirname, '../cache/tourinsoft')

async function syncFeed<T>(
  nom: string,
  url: string,
  parser: (props: Record<string, string>) => T | null,
  fichierSortie: string
): Promise<number> {
  const fichierTemp = path.join(TEMP_DIR, `_tmp_${nom.toLowerCase().replace(/[^a-z]/g, '')}.xml`)

  console.log(`\n[${nom}] Téléchargement vers fichier temp...`)
  await telechargerVersFichier(url, fichierTemp)

  const tailleMB = (fs.statSync(fichierTemp).size / 1024 / 1024).toFixed(1)
  console.log(`[${nom}] ${tailleMB} MB reçus — parsing par chunks...`)

  const items: T[] = []
  let nbEntries = 0

  for (const props of extraireEntriesDepuisFichier(fichierTemp)) {
    nbEntries++
    const item = parser(props)
    if (item) items.push(item)
  }

  // Supprimer le fichier temporaire
  try { fs.unlinkSync(fichierTemp) } catch { /* ignore */ }

  console.log(`[${nom}] ${nbEntries} blocs analysés → ${items.length} objets valides — écriture...`)
  fs.writeFileSync(fichierSortie, JSON.stringify(items, null, 0))
  console.log(`[${nom}] ✓ Terminé (${(fs.statSync(fichierSortie).size / 1024).toFixed(0)} KB)`)

  return items.length
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

async function main() {
  console.log('=== Synchronisation Tourinsoft ANMSM ===')
  console.log(`Dossier de cache : ${CACHE_DIR}`)

  // Créer le dossier cache si absent
  fs.mkdirSync(CACHE_DIR, { recursive: true })

  const debut = Date.now()
  const resultats: Record<string, number> = {}

  try {
    resultats.stations = await syncFeed(
      'Stations',
      FEEDS.stations,
      parserStation,
      path.join(CACHE_DIR, 'stations.json')
    )
  } catch (err) {
    console.error('[Stations] Erreur :', err instanceof Error ? err.message : err)
  }

  try {
    resultats.sejours = await syncFeed(
      'Séjours',
      FEEDS.sejours,
      parserSejour,
      path.join(CACHE_DIR, 'sejours.json')
    )
  } catch (err) {
    console.error('[Séjours] Erreur :', err instanceof Error ? err.message : err)
  }

  try {
    resultats.hebergements = await syncFeed(
      'Hébergements',
      FEEDS.hebergements,
      parserHebergement,
      path.join(CACHE_DIR, 'hebergements.json')
    )
  } catch (err) {
    console.error('[Hébergements] Erreur :', err instanceof Error ? err.message : err)
  }

  try {
    resultats.activites = await syncFeed(
      'Activités',
      FEEDS.activites,
      parserActivite,
      path.join(CACHE_DIR, 'activites.json')
    )
  } catch (err) {
    console.error('[Activités] Erreur :', err instanceof Error ? err.message : err)
  }

  try {
    resultats.commerces = await syncFeed(
      'Commerces',
      FEEDS.commerces,
      parserCommerce,
      path.join(CACHE_DIR, 'commerces.json')
    )
  } catch (err) {
    console.error('[Commerces] Erreur :', err instanceof Error ? err.message : err)
  }

  const duree = Math.round((Date.now() - debut) / 1000)
  console.log('\n=== Résumé ===')
  for (const [nom, nb] of Object.entries(resultats)) {
    console.log(`  ${nom.padEnd(15)} : ${nb} objets`)
  }
  console.log(`Durée totale : ${duree}s`)
  console.log('Sync Tourinsoft terminée ✓')
}

main().catch((err) => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})
