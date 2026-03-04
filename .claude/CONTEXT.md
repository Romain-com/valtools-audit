# CONTEXT.MD — Destination Digital Audit App
> Destination de test : **Annecy** | Domaine OT : `lac-annecy.com`
> Suivi de développement → `.claude/SUIVI.md`

---

## Vision du projet

Application web d'audit du potentiel de transformation digitale d'une destination touristique française.

**Workflow principal** : saisie du nom d'une commune → identification via SIREN → collecte automatique via APIs → affichage des résultats structurés par bloc → contenus générés par OpenAI à copier-coller manuellement dans les templates GDoc/GSlides.

---

## Stack technique

| Composant | Choix |
|---|---|
| Framework | Next.js (App Router) |
| Style | Tailwind CSS |
| Base de données | Supabase (Postgres + Realtime + Auth) |
| Authentification | Supabase Auth (rôles admin / collaborateur) |
| Stockage code | GitHub (repo privé) |
| DATA Tourisme | Microservice Node.js local (Express) sur Mac |
| Environnement | Mac, usage local uniquement |

**Règle absolue** : tous les appels API via Route Handlers Next.js. Aucune clé API côté client.

**Pattern logic.ts** : chaque route API expose sa logique dans un `logic.ts` colocalisé. Les `lib/blocs/*.ts` importent `logic.ts` directement (pas via `fetch` HTTP — deadlock). Les `route.ts` sont de simples wrappers HTTP.

```typescript
// route.ts — thin wrapper
import { executerXXX } from './logic'
export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await executerXXX(await req.json()))
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur inconnue' }, { status: 500 })
  }
}
```

---

## Utilisateurs

- 2 à 5 personnes (1 admin + collaborateurs)
- Gestion des rôles via Supabase Auth
- Application en local — pas d'exposition publique pour le MVP

---

## Le SIREN comme clé centrale

Le SIREN est l'identifiant unique de chaque destination. Verrouillé dès la sélection, sert de référence pour toutes les APIs.

**Sources CSV locales** (lues par le microservice — jamais uploadées sur Supabase) :
- `identifiants-communes-2024.csv` — 34 968 communes
- `identifiants-epci-2024.csv` — 1 267 groupements
- `identifiants-departements-2024.csv` et `identifiants-regions-2024.csv`

**Workflow de saisie** :
1. Saisie nom commune → microservice CSV → liste avec nom + CP + département
2. Si SIREN existant en base → avertissement + choix mise à jour ou annulation
3. Sélection confirmée → SIREN verrouillé (validé `/^\d{9}$/`) → audit lancé

---

## Règles de gestion des données

- **1 enregistrement par destination** (SIREN unique)
- **Pas de doublon** : relancement écrase les données existantes
- L'historique = liste des destinations avec date de dernière mise à jour

---

## APIs — Documentation

### ✅ DataForSEO — Basic Auth
```
DATAFORSEO_LOGIN=mickael.challet@top10-strategie.fr
DATAFORSEO_PASSWORD=4e494b70cde62abb
```

**SERP organique**
```
POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced
{ "keyword": "Annecy tourisme", "language_code": "fr", "location_code": 2250, "depth": 10 }
```
⚠️ Toujours filtrer `item.type === "organic"` — l'array contient des types mixtes. Jamais d'index fixe.

**Google Maps**
```
POST https://api.dataforseo.com/v3/serp/google/maps/live/advanced
{ "keyword": "Office de tourisme Annecy", "language_code": "fr", "location_code": 2250, "depth": 10 }
```
⚠️ **Une seule tâche à la fois** dans l'array — sinon erreur `40000`
⚠️ Timeout axios minimum : **60 secondes**
⚠️ Pattern : 2 appels par audit — `"[destination]"` + `"Office de tourisme [destination]"`

**domain_rank_overview** (fallback Haloscan)
```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live
[{ "target": "lac-annecy.com", "location_code": 2250, "language_code": "fr" }]
```
⚠️ Chemin parsing — niveau `items[0]` obligatoire :
```javascript
// ✅ CORRECT
const organic = response.data?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic
// ❌ FAUX — manque items[0]
const organic = response.data?.tasks?.[0]?.result?.[0]?.metrics?.organic
```
Champs utiles : `organic.count`, `organic.pos_1_3`, `organic.pos_4_10`, `organic.rank_absolute`, `organic.estimated_traffic_monthly`

**related_keywords** (corpus marché Bloc 4)
```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live
{ "keyword": "...", "location_code": 2250, "language_code": "fr", "limit": 100, "depth": 2 }
```
Parsing : `data?.tasks?.[0]?.result?.[0]?.items ?? []`
⚠️ Filtre pertinence obligatoire : garder si contient la destination OU ≥ 3 mots

**ranked_keywords** (positions OT)
```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live
```
⚠️ Position = `item.ranked_serp_element.serp_item.rank_group`
⚠️ Métriques globales domaine = `result[0].metrics.organic` (pas `items[0].metrics.organic`)

---

### ✅ OpenAI — Responses API (Bearer)
```
OPENAI_API_KEY=sk-proj-V2iayBm71Rm...
```
**Modèle** : `gpt-5-mini` — **Responses API** uniquement (pas Chat Completions)
```
POST https://api.openai.com/v1/responses
{
  "model": "gpt-5-mini",
  "input": "prompt système + user fusionnés en une seule chaîne",
  "max_output_tokens": 1000,
  "reasoning": { "effort": "low" }
}
```
⚠️ `max_tokens` → utiliser `max_completion_tokens` (ou `max_output_tokens` pour Responses API)
⚠️ `temperature` : ne pas passer (seule valeur 1 supportée)
⚠️ `max_output_tokens` minimum **500** — reasoning interne ~80% du budget. Préférer 8 000+.
⚠️ Toujours demander JSON pur dans le prompt
⚠️ Parser via `lib/openai-parse.ts` : `output[type=message].content[0].text`

**Valeurs `max_output_tokens` recommandées** :
- Sorties JSON simples : 500–1 000
- Sorties JSON structurées : 1 000–2 000
- Batch keywords, liste concurrents : 2 000–4 000 (voire 16 000 pour classifications)

---

### ✅ Apify — Instagram (Token)
```
APIFY_API_TOKEN=apify_api_r47zaja0...
```
```
POST https://api.apify.com/v2/acts/ACTOR_SLUG/run-sync-get-dataset-items?token=TOKEN&timeout=90
Axios timeout : 120 000ms
```

| Actor | Usage | Payload |
|-------|-------|---------|
| `apify~instagram-hashtag-stats` | postsCount + hashtags associés | `{ "hashtags": ["annecy"], "maxItems": 1 }` |
| `apify~instagram-hashtag-scraper` | Posts individuels (likes, username, caption) | `{ "hashtags": ["annecy"], "resultsLimit": 10 }` |

⚠️ Ne pas utiliser `apify/instagram-scraper` (pas de postsCount)

---

### ✅ Haloscan — header `haloscan-api-key`
```
HALOSCAN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
⚠️ **SEO keywords/trafic uniquement** — PAS backlinks

**domains/overview**
```
POST https://api.haloscan.com/api/domains/overview
Headers: { "haloscan-api-key": "TOKEN" }
Body: { "input": "lac-annecy.com", "mode": "domain", "requested_data": ["metrics", "best_keywords", "best_pages"] }
```
⚠️ Niveau intermédiaire `stats` obligatoire :
```javascript
// ✅ CORRECT
const metrics = response.data.metrics?.stats
// Champs : total_keyword_count, total_traffic, top_3_positions, top_10_positions, visibility_index, traffic_value
```
⚠️ `traffic_value` retourne `"NA"` (string) → normaliser en `0`
⚠️ `failure_reason` (pas `errorCode`) pour détecter domaine absent
⚠️ Coût : 1 crédit/appel — crédit consommé même si SITE_NOT_FOUND

**Séquence de fallback SEO** (implémentée dans les orchestrateurs) :
```
1. Haloscan domaine nu       → vide/absent
2. Haloscan www.domaine      → vide/absent
3. DataForSEO domain_rank nu → count=0
4. DataForSEO www.domaine    → données réelles ✅
→ site_non_indexe: true uniquement si les 4 étapes retournent 0
```

**keywords/overview** (Bloc 4)
```
POST https://api.haloscan.com/api/keywords/overview
```
- 8 seeds touristiques
- `related_question` → PAA (exclusif Haloscan)
- `ads_metrics.cpc` peut être null — signal transac si `cpc > 0.30`
- ⚠️ `serp` retiré de `requested_data` (économie temps)

**siteCompetitors** (Bloc 7)
```
POST https://api.haloscan.com/api/domains/siteCompetitors
Body: { "input": domaine_ot, "mode": "root", "lineCount": 10 }
```
Retourne : `results[{ root_domain, common_keywords, missed_keywords, keywords, total_traffic }]`

---

### ✅ Monitorank — Query param
```
MONITORANK_API_KEY=4648-80kpZC7othd7...
GET https://api.monitorank.com/?key=API_KEY&module=google&action=update
```
⚠️ Seul endpoint fonctionnel : `module=google&action=update`
⚠️ Rate limit : 1 req/minute — délai 1.2s minimum entre appels

---

### ✅ data.economie.gouv.fr — Sans auth
```
GET https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-communes-en-2024/api/
```
- Communes : `balances-comptables-des-communes-en-2024` (fallback 2023)
- EPCI : `balances-comptables-des-groupements-a-fiscalite-propre-depuis-2010` (filtre `exer='2024'`)
- Filtre ODSQL : `compte='731721' OR compte='731722'` (taxe de séjour + forfaitaire)
- `obnetcre` peut être null → traiter comme 0, additionner plusieurs lignes

---

### ✅ geo.api.gouv.fr — Sans auth
```
GET https://geo.api.gouv.fr/communes?nom=Annecy&fields=nom,code,codesPostaux,codeDepartement,codeRegion,population&format=json&limit=3
```
⚠️ `code` = code INSEE (≠ code postal). `[0]` = commune la plus pertinente.

---

### ✅ Google PageSpeed Insights
```
PAGESPEED_API_KEY=AIza...
```
- 2 appels par domaine (mobile + desktop)
- Timeout : 45 000ms minimum
- Résultats indicatifs (variabilité selon charge serveur)

---

### ✅ API Mélodi (INSEE) — Sans auth
- Rate limit : 30 req/min → batch 10 communes × 2 appels = sleep 2100ms entre batches
- RP 2022 : `GET /melodi/data/DS_RP_LOGEMENT_PRINC?GEO=COM-{insee}&OCS=DW_SEC_DW_OCC&TIME_PERIOD=2022`
  ⚠️ Format GEO : `COM-74010` | Période : `2022` | Valeurs → `Math.round()`
- BPE D7 : `GET /melodi/data/DS_BPE?GEO=COM-{insee}&FACILITY_SDOM=D7`
  Codes : D701=hôtels, D702=campings, D703=rés.tourisme, D710=meublés, D711=ch.d'hôtes

---

### ✅ recherche-entreprises.api.gouv.fr — Sans auth
```
GET https://recherche-entreprises.api.gouv.fr/search?code_commune=74010&activite_principale=55.10Z&etat_administratif=A&per_page=25&limite_matching_etablissements=25
```
⚠️ `results[].matching_etablissements` = UNIQUEMENT les établissements dans la commune
⚠️ Rate limit 429 : sleep 300ms entre chaque code NAF + retry backoff (1.5s × tentative, max 3)
⚠️ Format NAF avec point : `55.10Z`

---

### ❌ APIs abandonnées

- **RapidAPI Instagram** : aucun endpoint postsCount accessible
- **Apify Google Maps** (`compass~crawler-google-places`) : timeout > 300s
- **Backlinks** : aucune API disponible — supprimé du scope
- **Google Docs/Slides API** : supprimé du scope — copier-coller manuel

---

## Données analysées par bloc

| Bloc | Données | Source |
|---|---|---|
| 1 — Positionnement | Note Google OT + 3 POI, Instagram postsCount + posts, analyse IA | DataForSEO Maps + Apify + OpenAI |
| 2 — Volume d'affaires | Taxe de séjour + dispatch TS EPCI | data.economie.gouv.fr + Mélodi INSEE |
| 3 — Schéma digital | Classement SERP, visibilité OT, SEO domaines, Core Web Vitals, maturité site OT | DataForSEO SERP + Haloscan + PageSpeed + OpenAI |
| 4 — Visibilité SEO | Corpus marché, positions OT, gap transactionnel | Haloscan keywords + DataForSEO related/ranked + OpenAI |
| 5 — Stocks physiques | Hébergements / activités / culture DATA Tourisme + SIRENE | Microservice + recherche-entreprises |
| 6 — Stock en ligne | Airbnb, Booking, Viator, analyse site OT | Playwright + OpenAI |
| 7 — Concurrents | 5 concurrents + métriques SEO + note Google + synthèse comparative | OpenAI + Haloscan + DataForSEO Maps |

---

## DATA Tourisme (microservice local)

- **Format** : 489 318 fichiers JSON organisés par région / département (13 Go)
- **Accès** : `http://localhost:3001`
- **Cache disque** : `microservice/cache/index-communes.json` (56 Mo) — généré au 1er démarrage (~3-5 min), puis chargé en 87ms

**Endpoints** :
| Endpoint | Usage |
|----------|-------|
| `GET /health` | Vérification microservice |
| `GET /communes?nom=XXX` | Autocomplete + SIREN + INSEE |
| `GET /poi?code_insee=XXX&limit=10` | POI touristiques |
| `GET /stocks?code_insee=XXX` | Stocks classifiés par catégorie |
| `GET /scan-types?code_insee=XXX` | Scan types @type (usage dev) |
| `GET /epci?code_insee=XXX` | Résolution EPCI |
| `GET /epci/communes?siren_epci=XXX` | Communes d'un EPCI |
| `GET /bbox?code_insee=XXX` | Bounding box géographique |

**Clés JSON DATA Tourisme** :
- Nom : `data["rdfs:label"]["fr"][0]`
- Types : `data["@type"]` (filtrer `PlaceOfInterest`, `PointOfInterest` = racines)
- Code INSEE : `data.isLocatedAt[0]["schema:address"][0]["hasAddressCity"]["insee"]`
- GPS : `data.isLocatedAt[0]["schema:geo"]["schema:latitude/longitude"]` (strings → parseFloat)

**Démarrer le microservice** :
```bash
cd microservice && npm run dev
```

---

## Documents de sortie

- L'app affiche des blocs structurés prêts à copier-coller dans les templates GDoc/GSlides
- Pas d'API Google Docs/Slides — copier-coller manuel

---

## Tracking des coûts API

Chaque module retourne `{ donnees: {...}, cout: { nb_appels, cout_unitaire, cout_total } }`.
Affiché dans l'interface : coût par audit + coût cumulé total.
Stocké dans `audits.couts_api` (JSONB, clés `bloc1`..`bloc7`).

---

## UX — Écrans

1. **`/login`** : formulaire email/password centré, logo Valraiso, fond dégradé avec SVG décoratifs.

2. **`/dashboard`** : grille cards destinations (nom + département + date + badge statut + coût + 3 KPIs jauges). État vide = illustration montagne. Bouton "Nouvel audit".

3. **`/audit/nouveau`** : panneau health check (vert/orange/rouge par service + bouton "Revérifier"). Autocomplete commune via microservice uniquement (debounce 300ms). Sélection → vérification doublon → confirmation SIREN. Bouton "Lancer" désactivé si services critiques KO ou SIREN invalide.

4. **`/audit/[id]/progression`** : profil panoramique SVG 7 pics (un par bloc), skieur SVG qui monte. Statuts temps réel via polling 3s. Modales de validation interactives (Bloc 4 : keywords, Bloc 7 : concurrents). Panneau logs dépliable avec bouton "Copier pour Claude".

5. **`/audit/[id]/resultats`** : sidebar fixe (scroll spy, coût par bloc). 7 sections KpiCards + ExpandableSections + texte OpenAI + CopyButton.

---

## Schéma de base de données Supabase

### Table `destinations`
- `id` UUID (PK), `nom`, `siren` (UNIQUE), `code_insee`, `code_postal`, `code_departement`, `code_region`, `epci`, `population`, `slug` (UNIQUE), `created_at`, `updated_at`, `created_by` UUID FK

### Table `audits`
- `id` UUID (PK), `destination_id` UUID (FK — UNIQUE : 1 seul audit par destination)
- `statut` ENUM (en_cours / termine / erreur)
- `resultats` JSONB : 7 blocs + `blocs_statuts` + `bbox`
- `couts_api` JSONB (clés `bloc1`..`bloc7`)
- `created_at`

> ⚠️ **Pas de table `competitors`** — concurrents dans `resultats.concurrents` (JSONB). Supprimé via migration 005.

### Table `audit_logs`
- `id` UUID, `audit_id` UUID FK, `bloc`, `niveau` (info/warning/error), `message`, `detail` JSONB, `created_at`

### Table `users` (profiles)
- Gérée par Supabase Auth + table `public.profiles`
- Champ `role` ENUM (admin / collaborateur)
- Profil créé automatiquement par trigger à la création d'un utilisateur

**Note** : `SUPABASE_SERVICE_ROLE_KEY` = format `sb_secret_...`. Requis pour tous les Route Handlers (bypass RLS). Clé `anon` retourne 0 lignes (RLS `authenticated` uniquement).

---

## Architecture blocs

### Orchestrateur — 3 segments

```
app/api/orchestrateur/
├── segment-a/route.ts  → POST { audit_id } — Blocs 1→2→3→4A (maxDuration 300)
├── segment-b/route.ts  → POST { audit_id, keywords_valides[] } — Blocs 4B→5→7A (maxDuration 300)
├── segment-c/route.ts  → POST { audit_id, concurrents_valides[] } — Blocs 6→7B (maxDuration 300)
└── statut/route.ts     → GET ?audit_id= — polling fallback

lib/orchestrateur/
├── blocs-statuts.ts      → Types StatutBloc, BlocsStatuts, ParamsAudit
├── logger.ts             → logInfo / logWarning / logError → audit_logs
├── supabase-updates.ts   → mettreAJourBloc, lireParamsAudit, lireDomaineOT, sauvegarderBbox, lireBbox
└── wrappers/
    ├── bloc1.ts  → auditPositionnement()
    ├── bloc2.ts  → lancerBlocVolumeAffaires()
    ├── bloc3.ts  → lancerBlocSchemaDigital()
    ├── bloc4.ts  → lancerPhaseA() + lancerPhaseB()
    ├── bloc5.ts  → lancerBlocStocksPhysiques()
    ├── bloc6.ts  → lancerBlocStockEnLigne()
    └── bloc7.ts  → lancerPhaseAConcurrents() + lancerPhaseBConcurrents()
```

**StatutBloc** : `en_attente | en_cours | termine | en_attente_validation | erreur`

### Bloc 1 — Positionnement
```
app/api/blocs/positionnement/
├── poi/route.ts + logic.ts
├── poi-selection/route.ts + logic.ts
├── maps/route.ts + logic.ts          → DataForSEO Maps (OT + 3 POI)
├── instagram/route.ts + logic.ts     → Apify
└── openai/route.ts + logic.ts        → GPT-5-mini analyse
lib/blocs/positionnement.ts           → orchestrateur
```

Score synthèse Maps : `score = moyenne_POI × 0.7 + note_OT × 0.3`

### Bloc 2 — Volume d'affaires
```
app/api/blocs/volume-affaires/
├── epci/route.ts + logic.ts
├── epci-communes/route.ts + logic.ts
├── taxe/route.ts + logic.ts          → data.economie.gouv.fr
├── melodi/route.ts + logic.ts        → Mélodi INSEE + OpenAI coefficients
└── openai/route.ts + logic.ts
lib/blocs/volume-affaires.ts          → orchestrateur
```

Logique collecteur : commune directe → EPCI → `taxe_non_instituee: true`
`nuitées_estimées = Math.round(montant_taxe / 1.50)`

### Bloc 3 — Schéma digital & Santé technique
```
app/api/blocs/schema-digital/
├── serp/route.ts + logic.ts           → 5 requêtes parallèles (destination/tourisme/hébergement/que_faire/restaurant)
├── classification/route.ts + logic.ts → catégorisation SERP + visibilite_ot_par_intention
├── haloscan/route.ts + logic.ts       → { donnees_valides, resultat }
├── domain-analytics/route.ts + logic.ts → fallback DataForSEO domain_rank_overview
├── pagespeed/route.ts + logic.ts      → Core Web Vitals mobile + desktop
├── analyse-ot/route.ts + logic.ts     → fonctionnalites + maturité digitale
└── openai/route.ts + logic.ts         → synthèse
lib/blocs/schema-digital.ts            → orchestrateur
```

Catégories SERP : `officiel_ot | officiel_mairie | officiel_autre | ota | media | autre`

### Bloc 4 — Visibilité SEO & Gap Transactionnel
```
app/api/blocs/visibilite-seo/
├── haloscan-market/route.ts + logic.ts  → 8 seeds Haloscan keywords/overview
├── dataforseo-related/route.ts + logic.ts → 4 seeds related_keywords
├── dataforseo-ranked/route.ts + logic.ts  → ranked_keywords domaine OT
├── classification/route.ts + logic.ts    → OpenAI (batch 50 kw, max 300)
├── serp-transac/route.ts + logic.ts      → DataForSEO SERP live (Phase B)
└── synthese/route.ts + logic.ts          → OpenAI synthèse gap

lib/blocs/visibilite-seo-phase-a.ts  → Phase A (automatique)
lib/blocs/visibilite-seo-phase-b.ts  → Phase B (après validation)
```

**Architecture deux phases** : Phase A → pause UI validation keywords → Phase B

Règle dure : si `position_ot ≤ 20` alors `gap = false` (post-OpenAI)

Trois volumes distincts (ne pas additionner) :
- `volume_marche_seeds` : demande autour de la destination
- `volume_positionne_ot` : périmètre site OT dans Google
- `volume_transactionnel_gap` : potentiel commercial non capté

### Bloc 5 — Stocks physiques
```
microservice/routes/stocks.ts          → GET /stocks?code_insee=XXX
app/api/blocs/stocks-physiques/
├── datatourisme/route.ts + logic.ts
├── sirene/route.ts + logic.ts         → recherche-entreprises.api.gouv.fr
└── synthese/route.ts + logic.ts
lib/blocs/stocks-physiques.ts          → orchestrateur (déduplication Levenshtein seuil 2)
```

Déduplication : score nom (exact/inclusion/Levenshtein) + adresse. Seuil = 2 (SIRENE utilise souvent des noms holdings).

### Bloc 6 — Stock commercialisé en ligne
```
microservice/routes/bbox.ts           → GET /bbox?code_insee=XXX
lib/scrapers/
├── airbnb.ts    → découpage quadrant récursif (SEUIL_MAX=1000, PROFONDEUR_MAX=6)
├── booking.ts   → compteur total (sélecteur h1)
├── viator.ts    → bloqué Cloudflare → retourne 0 sans erreur
└── site-ot.ts   → analyse hébergements + activités + classification

app/api/blocs/stock-en-ligne/
├── airbnb/route.ts (maxDuration 300, runtime nodejs)
├── booking/route.ts
├── viator/route.ts
├── site-ot/route.ts
└── synthese/route.ts + logic.ts

lib/blocs/stock-en-ligne.ts  → orchestrateur (browser Playwright partagé)
```

⚠️ `export const runtime = 'nodejs'` obligatoire sur tous les route handlers Playwright
⚠️ Airbnb condition `>= SEUIL_MAX` (pas `>`) + forcer SEUIL_MAX+1 si texte contient "+"

### Bloc 7 — Concurrents
```
app/api/blocs/concurrents/
├── identification/route.ts + logic.ts  → OpenAI 6 candidats → filtre subdivisions → 5
├── metriques/route.ts + logic.ts       → séquence SEO 5 étapes + DataForSEO Maps
└── synthese/route.ts + logic.ts        → OpenAI comparatif

lib/blocs/concurrents-phase-a.ts  → Phase A (automatique)
lib/blocs/concurrents-phase-b.ts  → Phase B (après validation)
```

Séquence SEO 5 étapes par concurrent :
1. Haloscan domains/overview domaine nu
2. Haloscan domains/overview www.domaine
3. Haloscan domains/positions (lineCount: 1)
4. DataForSEO ranked_keywords domaine nu (limit: 1)
5. DataForSEO ranked_keywords www.domaine

`site_non_indexe: true` UNIQUEMENT si les 5 étapes retournent 0.

⚠️ Parsing ranked_keywords pour métriques globales : `result?.metrics?.organic` (pas `items[0]`)
⚠️ `taux_dependance_ota` = valeur brute (ex: 9.8x) — ne jamais multiplier par 100

---

## Charte graphique

- Source : PDF `ressources/` + `ressources/design-tokens.md`
- Framework : Tailwind CSS avec tokens couleurs Valraiso dans `tailwind.config.ts`
- SVG Navbar : `Icon-Valraiso.svg` (32×32) + `Logo-Valraiso-blanc.svg`
- SVG décoratifs : `Chemin-plein.svg` (haut-droite) + `Chemin-pointillé-orange.svg` (bas-gauche) dans `app/layout.tsx`

---

## Variables d'environnement (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=sk-proj-V2iayBm71Rm...
DATAFORSEO_LOGIN=mickael.challet@top10-strategie.fr
DATAFORSEO_PASSWORD=4e494b70cde62abb
HALOSCAN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
MONITORANK_API_KEY=4648-80kpZC7othd7...
APIFY_API_TOKEN=apify_api_r47zaja0...
PAGESPEED_API_KEY=AIza...
DATA_TOURISME_API_URL=http://localhost:3001
```

⚠️ Toujours utiliser `dotenv.config({ path: '.env.local' })` dans les scripts Node.

---

## Onglet Territoire — Analyse multi-communes

### Philosophie

L'onglet Territoire répond à un besoin différent de l'audit par destination : au lieu d'analyser un OT unique, il permet d'analyser un territoire constitué de plusieurs communes en une seule session. L'utilisateur colle une liste de communes (une par ligne), l'outil valide, enrichit et présente les données de chaque commune sous forme de tableaux comparatifs.

**Ce n'est pas un audit — c'est un explorateur de territoire.** Pas de SIREN unique, pas de Supabase, pas d'orchestrateur. Tout est sans état (stateless) : saisie → validation → analyse → affichage.

**Cas d'usage** : préparer une proposition commerciale pour un EPCI ou un syndicat de massif en disposant des données brutes de toutes les communes membres.

### Flux utilisateur

```
1. Saisie textarea (1 commune par ligne, max 50)
2. Clic "Valider" → POST /api/territoire/valider
   → statut ok / ambigu (plusieurs homonymes → sélection) / invalide (suggestions + correction inline)
3. Clic "Analyser" → POST /api/territoire/analyser
   → pour chaque commune : hébergements DATA Tourisme + taxe de séjour + RS + capacité INSEE + fréquentation dept
4. Résultats en 3 onglets : Hébergements | POI | Taxe de séjour
   → vue synthèse ou détail, filtres commune + type, tri colonnes, export CSV
5. Bouton "Analyse GPT" (optionnel) → POST /api/territoire/analyse-gpt
   → communes moteurs + spécialisations + maturité + synthèse copyable
```

### Architecture fichiers

```
app/territoire/
├── page.tsx                        → Server Component — auth check → TerritoireClient
└── TerritoireClient.tsx            → Client Component — tout l'UI et les états

app/api/territoire/
├── valider/route.ts                → POST — lit CSV local, normalise, cherche (exact/préfixe/inclusion)
├── analyser/route.ts               → POST — orchestre les 5 sources de données par commune (parallèle)
└── analyse-gpt/route.ts            → POST — OpenAI Responses API, synthèse territoire
```

### Sources de données par commune (`/api/territoire/analyser`)

| Source | Données | API |
|--------|---------|-----|
| Microservice local `/stocks` | Hébergements + POI DATA Tourisme | `http://localhost:3001` |
| Microservice local `/epci` | SIREN EPCI + population EPCI | `http://localhost:3001` |
| `executerTaxe` (logique Bloc 2) | Taxe de séjour commune ou EPCI | `data.economie.gouv.fr` |
| Mélodi INSEE `DS_RP_LOGEMENT_PRINC` | Résidences secondaires (commune + EPCI) | `api.insee.fr/melodi` |
| Mélodi INSEE `DS_TOUR_CAP` | Capacité officielle hôtels/campings/autres | `api.insee.fr/melodi` |
| Mélodi INSEE `DS_TOUR_FREQ` | Nuitées annuelles au niveau département | `api.insee.fr/melodi` |
| `geo.api.gouv.fr/epcis/{siren}/communes` | Liste des communes d'un EPCI (prorata hybride) | gratuit |

### Algorithme prorata taxe EPCI — 3 méthodes

```
1. 'residences_secondaires' : RS_commune / RS_EPCI   (les deux RS connues)
2. 'rs_hybride'             : RS pour communes connues, population pour communes sans RS
3. 'population'             : RS_EPCI inconnue → pop_commune / pop_EPCI
```

⚠️ Délai Mélodi : 400ms entre appels RS pour respecter le rate limit (~150 req/min).
⚠️ Plafond communes inconnues EPCI : MAX_COMMUNES_INCONNUES = 40 (anti-timeout).
⚠️ DS_TOUR_CAP : GEO format `2025-COM-{code_insee}` | DS_TOUR_FREQ : `2023-DEP-{code}` + UNIT_MULT=3 (× 1000).

### Vue synthèse hébergements — déduplication DATA + INSEE

Les comptages DATA Tourisme et INSEE DS_TOUR_CAP sont fusionnés par catégorie avec `Math.max()` :
- `max(data_hotels, insee_hotels)` + `max(data_campings, insee_campings)` + `max(data_autres, insee_autres)`

### Analyse GPT (`/api/territoire/analyse-gpt`)

- Modèle : `gpt-5-mini` via Responses API (`POST /v1/responses`)
- `max_output_tokens` : 4 000
- Sortie JSON : `communes_moteurs[]`, `specialisations[]`, `maturite_touristique{}`, `communes_sous_exploitees[]`, `synthese`
- Prompt résumé : une ligne par commune — nb hébergements, types POI, taxe, résidences secondaires

### UI — onglets et fonctionnalités

| Onglet | Vues | Filtres | Export |
|--------|------|---------|--------|
| Hébergements | synthèse par commune + détail établissements | commune / type | CSV `hebergements_territoire.csv` |
| POI | synthèse catégories + détail | commune / catégorie | CSV `poi_territoire.csv` |
| Taxe de séjour | tableau collecteur/montant/nuitées/méthode | commune | CSV `taxe_sejour_territoire.csv` |

Tri multi-colonnes sur les 5 tableaux (état séparé par tableau).
CSV : séparateur `;`, BOM UTF-8 pour Excel.

---

## Scripts de test disponibles

| Fichier | Usage |
|---|---|
| `test-apis.js` | Connectivité de base (7 APIs) |
| `test-round2.js` | Monitorank, Haloscan, Instagram postsCount |
| `test-hashtag-stats.js` | Validation Apify instagram-hashtag-stats |
| `test-bloc1.js` | Bloc 1 — Annecy (flux complet sans Next.js) |
| `test-trevoux.js` | Bloc 1 — Trévoux (vraies APIs, microservice requis) |
| `test-bloc2.js` | Bloc 2 — taxe de séjour (microservice requis) |
| `test-bloc2-melodi.js` | Bloc 2 — dispatch TS Mélodi (Annecy, microservice requis) |
| `test-bloc3.js` | Bloc 3 — Annecy (SERP, Haloscan, PageSpeed, OpenAI) |
| `test-bloc4.js` | Bloc 4 — Annecy Phase A+B (flag `--phase-b`) |
| `test-bloc5.js` | Bloc 5 — Annecy (DATA Tourisme + SIRENE) |
| `scripts/scan-datatourisme-types.js` | Scan types @type pour un code INSEE |
| `scripts/test-bloc6.js` | Bloc 6 — Airbnb/Booking/Viator/site OT |
| `scripts/test-bloc-concurrents.js` | Bloc 7 — Phase A+B (Next.js requis) |
