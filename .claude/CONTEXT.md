# CONTEXT.MD — Destination Digital Audit App
> Dernière mise à jour : Phase 2 — Bloc 5 Corrections déduplication + détail ✅ (2026-02-25)
> Destination de test de référence : **Annecy** | Domaine OT : `lac-annecy.com`

---

## Vision du projet

Application web permettant d'auditer le potentiel de transformation digitale d'une destination touristique française. L'objectif business est de démontrer aux destinations leur potentiel digital non exploité, via un état des lieux complet et automatisé.

**Workflow principal** : saisie du nom d'une commune → identification via SIREN → collecte automatique via APIs → affichage des résultats structurés par bloc → contenus générés par OpenAI à copier-coller manuellement dans les templates GDoc/GSlides existants.

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

**Règle absolue** : tous les appels API se font côté serveur via les Route Handlers Next.js. Aucune clé API n'est jamais exposée côté client.

---

## Utilisateurs

- 2 à 5 personnes (1 admin + collaborateurs)
- Gestion des rôles via Supabase Auth
- Application tournant en local — pas d'exposition publique prévue pour le MVP

---

## Le SIREN comme clé centrale

Le SIREN est l'identifiant unique de chaque destination. Il est verrouillé dès la sélection de la commune et sert de référence pour toutes les APIs et toutes les données stockées.

**Sources CSV locales** (lues uniquement par le microservice — jamais uploadées sur Supabase) :
- `identifiants-communes-2024.csv` — 35 000 communes
- `identifiants-epci-2024.csv` — 1 267 groupements
- `identifiants-departements-2024.csv` — 99 départements
- `identifiants-regions-2024.csv` — 17 régions

**Colonnes utilisées** : nom, SIREN, code INSEE (COG), code_postal, code_departement, code_region, population.

**Workflow de saisie** :
1. L'utilisateur tape un nom de commune
2. Le microservice cherche dans le CSV et propose une liste avec nom + code postal + département (pour lever les homonymes)
3. Si la destination existe déjà en base (SIREN identique) → l'app avertit et propose de mettre à jour ou d'annuler
4. Sélection confirmée → SIREN verrouillé → audit lancé

---

## Règles de gestion des données

- **1 enregistrement par destination** (SIREN unique — contrainte base de données)
- **Pas de doublon** : si un audit est relancé sur une destination existante, les données sont écrasées
- L'historique = liste de toutes les destinations auditées avec leur date de dernière mise à jour (pas d'historique temporel des audits successifs sur une même destination)

---

## APIs — Documentation complète issue des tests réels

### ✅ DataForSEO — API centrale
**Auth** : Basic Auth
```
DATAFORSEO_LOGIN=mickael.challet@top10-strategie.fr
DATAFORSEO_PASSWORD=4e494b70cde62abb
```

**Endpoint SERP organique**
```
POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced
Payload: { "keyword": "Annecy tourisme", "language_code": "fr", "location_code": 2250, "depth": 10 }
```
- Toujours filtrer `item.type === "organic"` — l'array contient des types mixtes
- Le nombre de résultats organiques peut être inférieur à 10
- Jamais d'index fixe — toujours itérer sur le tableau

**Endpoint Google Maps**
```
POST https://api.dataforseo.com/v3/serp/google/maps/live/advanced
Payload: { "keyword": "Office de tourisme Annecy", "language_code": "fr", "location_code": 2250, "depth": 10 }
```
- ⚠️ **Une seule tâche à la fois** dans l'array — sinon erreur `40000`
- Timeout axios minimum : **60 secondes** (30s provoque des timeouts)
- Pattern : 2 appels par audit — `"[destination]"` + `"Office de tourisme [destination]"`
- Gérer le cas fiche OT absente : flag `ot_fiche_manquante: true`
- Champs utiles : `item.title`, `item.rating.value`, `item.rating.votes_count`, `item.address`

**Rôles dans l'audit** : SERP Google, note Google destination + OT, mots-clés, PAA, volumes de recherche, Top 10 Google par catégorie, schéma digital

---

### ✅ OpenAI
**Auth** : Bearer
```
OPENAI_API_KEY=sk-proj-V2iayBm71Rm...
```
**Modèle** : `gpt-4o-mini` (économie de tokens)
```
POST https://api.openai.com/v1/chat/completions
{ "model": "gpt-4o-mini", "temperature": 0.2, "max_tokens": 300 }
```
- Toujours demander JSON pur : "Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires)"
- Parser systématiquement : `JSON.parse(raw.replace(/```json\n?|```/g, '').trim())`

**Rôles dans l'audit** : positionnement marketing, suggestion hashtags, identification 6 concurrents (3 directs + 3 indirects), génération contenus à copier-coller

**Critères concurrents** : même type destination, même taille, même zone géo, même positionnement, mots clés en commun

---

### ✅ Apify — Instagram
**Auth** : Token
```
APIFY_API_TOKEN=apify_api_r47zaja0...
```
**Pattern run-sync (tous actors)**
```
POST https://api.apify.com/v2/acts/ACTOR_SLUG/run-sync-get-dataset-items?token=TOKEN&timeout=90
Axios timeout : 120 000ms
```

**Actor 1 — postsCount** : `apify~instagram-hashtag-stats`
- Retourne `postsCount` + hashtags associés (fréquents/moyens/rares)
- Payload : `{ "hashtags": ["annecy"], "maxItems": 1 }`

**Actor 2 — posts individuels** : `apify~instagram-hashtag-scraper`
- Retourne likes, username, timestamp, caption, hashtags — mais PAS postsCount
- Payload : `{ "hashtags": ["annecy"], "resultsLimit": 10 }`

**⚠️ Ne pas utiliser** : `apify/instagram-scraper` (pas de postsCount) ni `compass~crawler-google-places` (trop lent)

---

### ✅ Haloscan
**Auth** : header `haloscan-api-key`
```
HALOSCAN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**⚠️ SEO keywords/trafic uniquement — PAS backlinks (supprimé du scope)**
Doc de référence : YAML OpenAPI GitHub `occirank/haloscan`

**Endpoint principal**
```
POST https://api.haloscan.com/api/domains/overview
Headers: { "haloscan-api-key": "TOKEN" }
Body: { "input": "lac-annecy.com", "mode": "domain", "requested_data": ["metrics", "best_keywords", "best_pages"] }
```
**⚠️ Niveau intermédiaire `stats` obligatoire** — structure réelle validée sur `www.lac-annecy.com` :
```json
{ "metrics": { "stats": { "total_keyword_count": 53842, "total_traffic": 161645, ... }, "failure_reason": null } }
```
```javascript
// ✅ CORRECT
const metrics = response.data.metrics?.stats
// ❌ FAUX (retourne undefined pour tous les champs)
const metrics = response.data.metrics
```
Champs utiles (sous `metrics.stats`) : `total_keyword_count`, `total_traffic`, `top_3_positions`, `top_10_positions`, `visibility_index`, `traffic_value`
⚠️ `traffic_value` retourne la string `"NA"` — normaliser en `0` : `typeof v === 'number' ? v : 0`

**Coût** : 1 crédit site/appel — ~2 972 crédits/mois renouvelables. ⚠️ Le crédit est consommé même si la réponse est `SITE_NOT_FOUND`.

**Architecture Bloc 3** : `haloscan/route.ts` prend `{ domaine: string }` (un seul domaine) et retourne `{ donnees_valides: boolean, resultat: ResultatHaloscan }`. L'orchestrateur décide lui-même du fallback DataForSEO si `donnees_valides: false`.

**Séquence de fallback implémentée** :
```
Haloscan nu → SITE_NOT_FOUND ou vide (donnees_valides: false)
  → retry Haloscan www.domaine          si toujours vide
  → fallback DataForSEO domain_rank_overview nu
  → retry DataForSEO www.domaine        si count=0
  → zéros (site_non_indexe: true)      en dernier recours
Résultat : domaine original toujours conservé dans l'objet retourné
```

**Condition "vide"** (dans `haloscan/route.ts`) :
```javascript
const estVide =
  (data.metrics?.failure_reason !== null && data.metrics?.failure_reason !== undefined) ||
  (!metrics.total_keyword_count && !metrics.total_traffic)
// ⚠️ failure_reason remplace errorCode === 'SITE_NOT_FOUND' (structure réelle validée)
```

Les données de trafic sous-représentent le trafic FR — fiable pour comparaisons relatives uniquement.

---

### ✅ DataForSEO domain_rank_overview (fallback Haloscan)
**Endpoint** :
```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live
Auth: Basic (même login/password que SERP)
Body: [{ "target": "lac-annecy.com", "location_code": 2250, "language_code": "fr" }]
```

**⚠️ Chemin de parsing — niveau `items[0]` intermédiaire obligatoire** :
```javascript
// ✅ CORRECT
const organic = response.data?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic

// ❌ FAUX — manque items[0]
const organic = response.data?.tasks?.[0]?.result?.[0]?.metrics?.organic
```

Champs utiles : `organic.count` (nb mots-clés), `organic.pos_1_3`, `organic.pos_4_10`, `organic.rank_absolute`, `organic.estimated_traffic_monthly`

**Condition vide** : `!organic || !organic.count`

**Coût** : 0.006 €/appel (même tarif que DataForSEO SERP). Applique aussi retry www. si count=0.

---

### ✅ Monitorank
**Auth** : query param
```
MONITORANK_API_KEY=4648-80kpZC7othd7...
GET https://api.monitorank.com/?key=API_KEY&module=google&action=update
```
- Retourne la liste des updates algo Google (36 au moment des tests)
- Rate limit : 1 requête/minute — délai 1.2s minimum entre appels
- Tous les autres modules/actions → `"Non-existent action"`

**Rôle unique** : contexte algo Google récent

---

### ✅ data.economie.gouv.fr
**Auth** : aucune
```
GET https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-communes-en-2024/api/
Filtrage par code INSEE
```
**Rôle** : taxe de séjour (volume et montant moyen)

---

### ✅ geo.api.gouv.fr
**Auth** : aucune
```
GET https://geo.api.gouv.fr/communes?nom=Annecy&fields=nom,code,codesPostaux,codeDepartement,codeRegion,population&format=json&limit=3
```
- `code` = code INSEE (≠ code postal)
- Résultat `[0]` = commune la plus pertinente

**Rôle** : validation initiale des données communes

---

### ✅ Google PageSpeed Insights
**Auth** : clé Google Cloud Console (gratuite — 25 000 req/jour)
```
PAGESPEED_API_KEY=AIza...
```
- 2 appels par domaine (mobile + desktop)

**Rôle** : Core Web Vitals et score de performance des sites officiels

---

### ❌ APIs abandonnées
- **RapidAPI Instagram** : aucun endpoint accessible ne retourne le postsCount — abandonné définitivement
- **Apify Google Maps** (`compass~crawler-google-places`) : timeout > 300s — remplacé par DataForSEO Maps
- **Backlinks** : aucune API disponible dans le stack — supprimé du scope

---

## Données analysées et leurs sources

| Bloc d'analyse | Source | Statut |
|---|---|---|
| Identification commune + SIREN | Microservice CSV locaux | ✅ |
| Positionnement marketing | OpenAI gpt-4o-mini | ✅ |
| Note Google destination + OT | DataForSEO Maps | ✅ |
| Taxe de séjour | data.economie.gouv.fr | ✅ |
| Schéma digital (sites officiels) | DataForSEO SERP | ✅ |
| Mots-clés & volumes de recherche | DataForSEO SERP | ✅ |
| PAA de la destination | DataForSEO SERP | ✅ |
| Top 10 Google par catégorie | DataForSEO SERP | ✅ |
| Visibilité SEO domaines officiels | Haloscan + fallback DataForSEO domain_rank_overview | ✅ |
| Contexte algo Google | Monitorank | ✅ |
| Volume hashtag Instagram (postsCount) | Apify instagram-hashtag-stats | ✅ |
| Posts récents + ratio OT/UGC | Apify instagram-hashtag-scraper | ✅ |
| Santé technique (Core Web Vitals) | Google PageSpeed API | ✅ |
| Stocks hébergements / activités / services | DATA Tourisme + Recherche Entreprises | ✅ Bloc 5 terminé |
| Concurrents directs (3) + indirects (3) | OpenAI | ✅ |
| Métriques concurrents | DataForSEO + Haloscan | ✅ |
| Contenus GDoc/GSlides | OpenAI (copier-coller manuel) | ✅ |
| Backlinks | ❌ supprimé du scope | — |

---

## DATA Tourisme (13 Go local)

- **Format** : fichiers JSON organisés par région / département
- **Accès** : microservice Node.js local (Express) sur Mac, tourne en arrière-plan
- **Stratégie** : indexation légère au démarrage (nom, type, commune, GPS), filtrage à la volée, streaming sans charger en RAM
- **Endpoints existants** : `GET /communes?nom=XXX` + `GET /poi?code_insee=XXX&limit=XXX` + `GET /stocks?code_insee=XXX` + `GET /scan-types?code_insee=XXX`
- **⚠️ À faire avant de coder** : ouvrir un fichier JSON et identifier la clé exacte du nom de commune

---

## Documents de sortie

- **Pas d'API Google** — supprimé définitivement du scope
- L'app affiche des blocs de contenu structurés prêts à copier-coller dans les templates GDoc/GSlides
- **⚠️ À faire avant de coder** : lister tous les blocs attendus dans les templates pour briefer OpenAI

---

## Tracking des coûts API

Affiché dans l'interface :
- Nombre d'appels par API
- Coût estimé en € par audit
- Coût cumulé total depuis le début

**⚠️ À faire avant de coder** : rassembler les grilles tarifaires → `api-costs.md`

---

## Charte graphique

- Fournie en PDF dans le dossier `ressources`
- **⚠️ À faire avant de coder** : extraire manuellement couleurs hex, typographies, tailles → `design-tokens.md`
- Framework CSS : Tailwind CSS

---

## UX — Écrans de l'application

1. **Dashboard** : liste destinations auditées + date dernière mise à jour + bouton "Nouvel audit"
2. **Lancement** : saisie nom commune → autocomplete (nom + dept + population) → détection doublon → confirmation
3. **Progression** : étapes en temps réel via Supabase Realtime
4. **Résultats** : données par bloc + contenus OpenAI à copier-coller + vue comparaison vs concurrents

---

## Schéma de base de données Supabase

### Table `destinations`
- `id` UUID (PK)
- `nom` TEXT
- `siren` TEXT (UNIQUE)
- `code_insee` TEXT
- `code_postal` TEXT
- `code_departement` TEXT
- `code_region` TEXT
- `epci` TEXT
- `population` INT
- `slug` TEXT (UNIQUE)
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP
- `created_by` UUID (FK → users)

### Table `audits`
- `id` UUID (PK)
- `destination_id` UUID (FK → destinations)
- `statut` ENUM (en_cours / terminé / erreur)
- `resultats` JSONB (un objet par bloc : positionnement, seo, social, technique, stocks, concurrents, contenus)
- `couts_api` JSONB (par API : nb_appels, cout_unitaire, cout_total)
- `created_at` TIMESTAMP

### Table `competitors`
- `id` UUID (PK)
- `audit_id` UUID (FK → audits)
- `nom` TEXT
- `type` ENUM (direct / indirect)
- `metriques` JSONB

### Table `users`
- Gérée par Supabase Auth
- Champ additionnel : `role` ENUM (admin / collaborateur)

---

## Plan de développement

> À chaque fin de phase : mise à jour CONTEXT.md + push GitHub + tests validés.
> Chaque module est rangé dans une section dédiée — ne jamais mélanger les phases dans le code.

### Phase 0 — Préparation (hors code)
- [ ] Extraire charte PDF → `design-tokens.md`
- [ ] Lister les blocs de contenu des templates GDoc/GSlides
- [ ] Rassembler grilles tarifaires API → `api-costs.md`
- [x] Ouvrir un fichier DATA Tourisme → identifier la clé JSON du nom de commune ✅ (clés confirmées : rdfs:label.fr[0], isLocatedAt[0].schema:address[0].hasAddressCity.insee, schema:geo)
- [ ] Créer repo GitHub privé
- [ ] Créer projet Supabase → noter URL + anon key + service role key
- [ ] Créer clé Google PageSpeed (Google Cloud Console)

### Phase 1 — Fondations ✅ TERMINÉE (2026-02-23)
- Setup Next.js + Tailwind + Supabase + Auth + GitHub
- Schéma BDD et migrations Supabase
- **Microservice Node.js local : CSV communes + DATA Tourisme ✅**
- Structure dossiers et `.env.local`

#### Microservice — Résultats de validation
- **34 968 communes** indexées depuis `identifiants-communes-2024.csv`
- **489 318 fichiers** DATA Tourisme indexés — 100% succès, 0 erreur
- **28 883 communes** couvertes dans l'index DATA Tourisme
- Démarrage serveur : **immédiat** — indexation en arrière-plan (~2-3 min)
- Serveur tourne sur port **3001**

#### Microservice — Endpoints validés
| Endpoint | Résultat |
|----------|----------|
| `GET /health` | `{"statut":"ok","port":3001}` |
| `GET /communes?nom=annecy` | Retourne commune + SIREN + INSEE + dept + population |
| `GET /poi?code_insee=01427&limit=10` | 10 POI touristiques (logique exclusion) |
| `GET /poi` (index pas prêt) | HTTP 503 avec message d'attente |

#### Microservice — Structure des fichiers
```
microservice/
├── index.ts                  → Express, démarrage CSV sync + chargement index async
├── routes/communes.ts        → GET /communes?nom=XXX (autocomplete + homonymes)
├── routes/poi.ts             → GET /poi?code_insee=XXX&types=...&limit=...
├── services/csv-reader.ts    → CSV → Map normalisée (accents/tirets/homonymes)
├── services/datatourisme.ts  → cache disque + index RAM filepaths par INSEE
├── types/index.ts            → Commune, IndexPOI, POIResult
├── cache/
│   ├── .gitignore            → exclut index-communes.json (56 Mo, régénérable)
│   └── index-communes.json   → cache persisté sur disque (généré au 1er démarrage)
├── package.json / tsconfig.json
└── .env                      → chemins pré-remplis
```

#### Structure JSON DATA Tourisme — clés confirmées
- Nom : `data["rdfs:label"]["fr"][0]`
- Types : `data["@type"]` filtré (sans préfixe `schema:`)
- Code INSEE : `data.isLocatedAt[0]["schema:address"][0]["hasAddressCity"]["insee"]`
- GPS : `data.isLocatedAt[0]["schema:geo"]["schema:latitude/longitude"]` (strings → parseFloat)

#### Analyse des préfixes DATA Tourisme
Résultat du scan exhaustif : **28 préfixes numériques** distincts dans les noms de fichiers (ex: `3-uuid.json`, `13-uuid.json`).
**Conclusion critique** : les préfixes ne correspondent PAS aux codes département — un préfixe couvre plusieurs départements (ex: préfixe `13` = 103 173 fichiers couvrant les depts 03, 26, 38, 43, 74). Le filtrage par département ne peut donc pas se faire par préfixe de fichier. Il se fait uniquement via le code INSEE extrait du contenu JSON.

#### Optimisation : cache disque (2026-02-24)
**Problème** : l'indexation complète des 489 318 fichiers prenait 3-5 min à chaque démarrage.

**Solution implémentée** — stratégie cache-first :
- Au **premier démarrage** : scan de tous les fichiers → extraction du code INSEE uniquement → construction de la Map `code_insee → [filepaths]` → sauvegarde dans `microservice/cache/index-communes.json` (56 Mo)
- Aux **démarrages suivants** : lecture directe du cache JSON → chargement en RAM en ~87ms
- Si cache corrompu : reconstruction automatique transparente

**Changement architectural dans `datatourisme.ts`** :
- `lancerIndexation()` → remplacée par `chargerOuConstruireIndex()` + `construireIndex()`
- L'index RAM ne stocke plus que des **filepaths** (`Map<string, string[]>`) — beaucoup plus léger
- Les données complètes (nom, types, GPS) sont lues **à la demande** au moment de la requête `/poi`, fichier par fichier avec `try/catch`
- La logique de filtre d'exclusion de types (hébergements, restaurants...) reste dans `routes/poi.ts` — inchangée

**Structure du fichier cache** :
```json
{
  "generated_at": "2026-02-23T22:45:00.000Z",
  "total_fichiers": 489318,
  "total_communes": 28883,
  "index": {
    "01427": ["/chemin/vers/3-xxxx.json", "/chemin/vers/28-xxxx.json"],
    "74010": ["..."]
  }
}
```

**Résultats validés** :
- Premier démarrage : 489 318 fichiers scannés, 28 883 communes, cache 56 Mo généré
- Redémarrage : `Cache chargé — 28883 communes en 87ms` (gain x2000 vs scan complet)
- `GET /poi?code_insee=01427&limit=10` → 10 POI retournés (Trévoux — Apothicairerie, Sanctuaire d'Ars, Voie Bleue...)

#### Pour démarrer le microservice
```bash
cd microservice && npm run dev
# Si premier lancement : construction du cache automatique (~3-5 min, une seule fois)
# Si cache présent : prêt en < 100ms
```

### Phase 2 — Blocs de collecte ✅ Bloc 1 terminé (2026-02-24)

#### Bloc 1 — Positionnement & Notoriété ✅ TERMINÉ

**Architecture** :
```
app/api/blocs/positionnement/
├── maps/route.ts          → DataForSEO Maps (4 appels : OT + 3 POI)
├── instagram/route.ts     → Apify (hashtag-stats + hashtag-scraper)
├── openai/route.ts        → GPT-4o-mini (analyse positionnement)
├── poi/route.ts           → Microservice DATA Tourisme (POI bruts)
└── poi-selection/route.ts → GPT-4o-mini (sélection 3 POI pertinents)

lib/
├── api-costs.ts           → Tarifs unitaires (source de vérité unique)
├── tracking-couts.ts      → Persistance Supabase fire & forget
└── blocs/positionnement.ts → Orchestrateur du bloc

types/positionnement.ts    → Types complets du bloc
```

**Flux orchestrateur** :
```
1. POST /poi              → DATA Tourisme (code_insee)
2. POST /poi-selection    → OpenAI (sélection 3 POI parmi la liste)
3. Promise.all([
     POST /maps           → DataForSEO (OT + 3 POI séquentiels)
     POST /instagram      → Apify (hashtag-stats + scraper)
   ])
4. POST /openai           → GPT-4o-mini (analyse finale)
5. enregistrerCoutsBloc() → Supabase fire & forget
```

**Score de synthèse Maps** :
- 4 appels séquentiels : `"Office de tourisme [destination]"` + 3 POI sélectionnés
- `score = moyenne_POI × 0.7 + note_OT × 0.3`
- Si OT absent → `score = moyenne_POI`
- Si aucun POI → `score = note_OT`

**Logique POI — exclusion** (⚠️ pas inclusion) :
```typescript
const TYPES_EXCLUS = ['Accommodation','FoodEstablishment','Restaurant',
  'CraftsmanShop','Store','Hotel','Guesthouse', ...]
// Garder un POI si aucun de ses types n'est dans TYPES_EXCLUS
```
Types réels retournés pour Trévoux (01427) : `PlaceOfInterest`, `CulturalSite`, `CityHeritage`, `EntertainmentAndEvent`

**Test validé — Trévoux (code INSEE 01427)** :
- OT : Office de tourisme Ars Trévoux — 4.6/5 (66 avis)
- POI DATA Tourisme : 17 disponibles — Apothicairerie, Sanctuaire d'Ars, Voie Bleue à vélo...
- Instagram #trevoux : 1 585 000 posts — ratio OT/UGC : 6/10
- Coût total bloc : **0.108 €** en ~27s

**Piège résolu** : code INSEE Trévoux = `01427` (pas 01390). Le microservice expose `GET /communes?nom=trevoux` pour résoudre le code correct.

**Coûts du bloc** :
```typescript
const API_COSTS = {
  dataforseo_maps: 0.006,       // 4 appels = 0.024 €
  apify_hashtag_stats: 0.05,    // 1 run = 0.05 €
  apify_hashtag_scraper: 0.05,  // 1 run = 0.05 €
  openai_gpt4o_mini: 0.001,     // 2 appels = 0.002 €
}                               // Total bloc ≈ 0.108 €
```

#### Bloc 2 — Volume d'affaires (taxe de séjour) ✅ TERMINÉ (2026-02-24)

**Architecture** :
```
microservice/routes/epci.ts         → GET /epci?code_insee=XXX (nouveau endpoint)

app/api/blocs/volume-affaires/
├── epci/route.ts    → Proxy microservice → résolution EPCI
├── taxe/route.ts    → data.economie.gouv.fr (communes + groupements)
└── openai/route.ts  → GPT-4o-mini (synthèse + indicateurs + part commune)

lib/blocs/volume-affaires.ts        → Orchestrateur du bloc
types/volume-affaires.ts            → DonneesCollecteur + ResultatVolumeAffaires
```

**Source CSV EPCI** :
- `ressources/table-appartenance-geo-communes-2025/COM-Tableau 1.csv` (ex-xlsx converti)
- Délimiteur `;`, métadonnées lignes 1-5, en-tête `CODGEO;LIBGEO;...` à la ligne 6
- Parsing : `csv-parse/sync` avec `from_line: 6, delimiter: ';'`
- Chargement synchrone au démarrage → 34 871 communes associées à 1 263 EPCI

**Flux orchestrateur** :
```
1. GET /epci         → microservice (code_insee → siren_epci + infos)
2. Promise.all([
     POST /taxe (commune),
     POST /taxe (epci) si siren_epci présent
   ])
3. Sélection collecteur : commune si montant > 0, sinon epci, sinon taxe_non_instituee
4. POST /openai      → synthèse + 3 indicateurs + part_commune si EPCI
5. enregistrerCoutsBloc() → Supabase fire & forget
```

**Logique collecteur** :
- La commune collecte en direct → `type_collecteur: 'commune'`
- Pas de taxe commune mais EPCI a des données → `type_collecteur: 'epci'` + estimation part OpenAI
- Aucune donnée → `taxe_non_instituee: true` (pas d'appel OpenAI)

**Datasets data.economie.gouv.fr** :
- Communes : `balances-comptables-des-communes-en-2024` (fallback 2023)
- EPCI : `balances-comptables-des-groupements-a-fiscalite-propre-depuis-2010` (filtre `exer='2024'`, fallback 2023)
- Filtre ODSQL : `compte='731721' OR compte='731722'` (taxe de séjour + forfaitaire)
- `obnetcre` peut être null → traité comme 0, plusieurs lignes additionnées

**nuitées_estimées** = `Math.round(montant_taxe_euros / 1.50)`

**Tests validés — test-bloc2.js** :

| Cas | Collecteur | Montant | Nuitées | Durée |
|---|---|---|---|---|
| Vanves (INSEE 92075) | Commune directe | **739 764 €** (2024) | 493 177 | 3.7s |
| Annecy (INSEE 74010) | CA Grand Annecy | **3 440 837 €** (2024) | 2 293 891 | 5.8s |

**Pièges résolus** :
- Code INSEE Vanves = `92075` (pas 92078 — vérifier toujours via `GET /communes?nom=XXX`)
- Annecy ne collecte pas en direct → bascule automatique sur la CA Grand Annecy (SIREN 200066793)
- SIREN Annecy `200063402` absent des balances communes car c'est l'EPCI qui collecte la taxe, pas la commune directement (le SIREN commençant par 200 est valide pour les communes fusionnées — ce n'est pas un indicateur de nature EPCI)

**Coût du bloc** :
```
data.economie.gouv.fr : gratuit
OpenAI gpt-4o-mini   : 1 appel = 0.001 €
Total bloc           : 0.001 €
```

#### Bloc 3 — Schéma digital & Santé technique ✅ TERMINÉ (2026-02-24)

**Architecture** :
```
app/api/blocs/schema-digital/
├── serp/route.ts              → DataForSEO SERP (5 requêtes parallèles, fusion + dédup par domaine)
├── classification/route.ts    → GPT-4o-mini (catégorisation SERP + visibilite_ot_par_intention)
├── haloscan/route.ts          → Haloscan — UN domaine par appel, retourne { donnees_valides, resultat }
├── domain-analytics/route.ts  → DataForSEO domain_rank_overview — fallback si Haloscan vide
├── pagespeed/route.ts         → Google PageSpeed (mobile + desktop en parallèle par domaine)
├── analyse-ot/route.ts        → GPT-4o-mini (fonctionnalités + maturité digitale site OT)
└── openai/route.ts            → GPT-4o-mini (synthèse schéma digital)

lib/blocs/schema-digital.ts   → Orchestrateur du bloc
types/schema-digital.ts        → CategorieResultatSERP + ResultatHaloscan (avec source) + tous les types
```

**Flux orchestrateur** :
```
1. POST /serp              → DataForSEO (5 requêtes parallèles)
                              Requêtes : destination | tourisme | hébergement | que_faire | restaurant
                              Fusion + déduplication par domaine (meilleure position conservée)
                              Retourne : par_requete (top3 par intention) + tous_resultats (fusionné)

2. POST /classification    → OpenAI (catégorisation de tous les domaines)
                              Retourne : resultats_classes, top3_officiels, domaine_ot,
                                         visibilite_ot_par_intention, score_visibilite_ot (0-5)

3a. Boucle séquentielle par domaine du top3_officiels :
     POST /haloscan { domaine }        → { donnees_valides, resultat }
                                          Haloscan nu → retry www. si vide
     Si !donnees_valides :
       POST /domain-analytics { domaine } → ResultatHaloscan (source: 'dataforseo')
                                            DataForSEO nu → retry www. si count=0
     couts_seo.haloscan++ (toujours)
     couts_seo.dataforseo++ (si fallback déclenché)

3b. Promise.all([
      POST /pagespeed { domaines }     → Core Web Vitals (mobile + desktop par domaine)
      POST /analyse-ot { domaine_ot }  → fonctionnalites_detectees + niveau_maturite_digital
    ])

4. POST /openai            → synthèse narrative (synthese_schema + indicateurs_cles + points_attention)
5. enregistrerCoutsBloc()  → Supabase fire & forget (couts ventilés haloscan / dataforseo_domain)
```

**Types clés** :
```typescript
// Catégories SERP
type CategorieResultatSERP = 'officiel_ot' | 'officiel_mairie' | 'officiel_autre' | 'ota' | 'media' | 'autre'

// Visibilité par intention de recherche
interface VisibiliteParIntention {
  position: number | null       // position du premier site officiel_ dans la requête (null si absent top3)
  categorie_pos1: CategorieResultatSERP  // catégorie du site réellement en position 1
}

// Métriques SEO — Haloscan ou fallback DataForSEO
interface ResultatHaloscan {
  source: 'haloscan' | 'dataforseo' | 'inconnu'  // fournisseur effectif
  site_non_indexe: boolean  // true uniquement si toutes les sources ont retourné 0
  // ... total_keywords, total_traffic, top_3_positions, top_10_positions, visibility_index, traffic_value
}

// Analyse site OT (inférence depuis titre + meta uniquement, sans scraping)
interface AnalyseSiteOT {
  fonctionnalites_detectees: {
    moteur_reservation: boolean | 'incertain'
    blog_actualites: boolean | 'incertain'
    newsletter: boolean | 'incertain'
    agenda_evenements: boolean | 'incertain'
    carte_interactive: boolean | 'incertain'
    application_mobile: boolean | 'incertain'
  }
  niveau_maturite_digital: 'faible' | 'moyen' | 'avance'
  commentaire: string
}
```

**Tests validés** :

| Destination | OT détecté | Score visibilité | total_keywords | source | PageSpeed mobile |
|---|---|---|---|---|---|
| Annecy | lac-annecy.com | 1/5 | 53 842 | haloscan (www) | 51/100 |
| Trévoux | ars-trevoux.com | 2/5 | — | Haloscan direct | mobile+desktop CLS critique (0.95) |

**Pièges résolus** :
- **Classification JSON tronqué** : tronquer titre (80 chars) + meta_description (100 chars) dans le prompt, `max_tokens: 1500` — sinon erreur "Unterminated string" pour 10+ résultats
- **PageSpeed timeout** : 45 000ms obligatoire (30s trop court pour sites lents)
- **Classification séquentielle** avant Haloscan/PageSpeed : besoin de `top3_officiels` pour savoir quels domaines analyser
- **Haloscan nu vs www** : Haloscan indexe parfois uniquement `www.` — retry automatique implémenté dans `haloscan/route.ts`
- **Haloscan zéros silencieux** : peut retourner métriques à 0 sans `SITE_NOT_FOUND` (limite de plan) → fallback DataForSEO déclenché par l'orchestrateur
- **PageSpeed variabilité** : LCP peut varier entre runs selon charge serveur — mentionner dans l'UI comme "mesure indicative"
- **Haloscan metrics.stats** : toutes les métriques sont sous `metrics.stats` (niveau intermédiaire), pas directement sous `metrics`. `traffic_value` retourne `"NA"` (string) → normaliser en 0. `failure_reason` remplace `errorCode === 'SITE_NOT_FOUND'` pour détecter un domaine absent. ⚠️ `test-bloc3.js` appelle Haloscan directement (bypass Next.js) — les deux fichiers doivent être synchronisés.

**⚠️ DataForSEO domain_rank_overview — chemin de parsing critique** :
```javascript
// ✅ CORRECT — niveau items intermédiaire obligatoire
const organic = response.data?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic

// ❌ FAUX — manque le niveau items
const organic = response.data?.tasks?.[0]?.result?.[0]?.metrics?.organic
```
Endpoint : `POST https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live`
Payload : `[{ target: 'lac-annecy.com', location_code: 2250, language_code: 'fr' }]`
Champs utiles : `organic.count` (total_keywords), `organic.pos_1_3`, `organic.pos_4_10`, `organic.rank_absolute`, `organic.estimated_traffic_monthly`

**Stratégie fallback SEO complète** (implémentée dans orchestrateur + test) :
```
Pour chaque domaine :
  1. Haloscan domaine nu       → SITE_NOT_FOUND ou métriques vides
  2. Haloscan www.domaine      → idem si toujours vide
  3. DataForSEO domaine nu     → count=0 si non indexé
  4. DataForSEO www.domaine    → données réelles si disponibles ✅
  → resultat.source = 'dataforseo', domaine original conservé dans l'objet retourné
  → couts_seo.haloscan++ (crédit consommé même si vide)
  → couts_seo.dataforseo++ (appel DataForSEO déclenché)
```

**Coût du bloc** :
```
DataForSEO SERP       : 5 appels    = 0.030 €
Haloscan              : 1-3 appels  = 0.010-0.030 € (1 crédit/appel même si vide)
DataForSEO domain     : 0-3 appels  = 0-0.018 € (fallback uniquement si Haloscan vide)
OpenAI (3 appels)     :             = 0.003 €
PageSpeed             : gratuit     = 0.000 €
Total bloc            :             ≈ 0.043-0.081 €
Exemple Annecy        : 1 Haloscan + 1 DataForSEO fallback + 3 OpenAI = 0.049 €
```

#### Bloc 4 — Visibilité SEO & Gap Transactionnel ✅ TERMINÉ (2026-02-24)

**Architecture** :
```
app/api/blocs/visibilite-seo/
├── haloscan-market/route.ts     → 8 seeds Haloscan keywords/overview en parallèle
├── dataforseo-related/route.ts  → 4 seeds DataForSEO related_keywords (enrichissement corpus)
├── dataforseo-ranked/route.ts   → ranked_keywords domaine OT (200 keywords, tri volume desc)
├── classification/route.ts      → OpenAI filtrage + classification + détection gap (batch 50)
├── serp-transac/route.ts        → DataForSEO SERP live (7-8 appels, Phase B)
└── synthese/route.ts            → OpenAI synthèse gap Phase B

lib/blocs/visibilite-seo-phase-a.ts  → orchestrateur Phase A (automatique)
lib/blocs/visibilite-seo-phase-b.ts  → orchestrateur Phase B (déclenché après validation)
types/visibilite-seo.ts              → tous les types TypeScript du bloc
```

**Architecture en deux phases avec pause utilisateur** :

Phase A (automatique, ~0.116€) :
```
Promise.allSettled([
  Haloscan market (8 seeds ‖),       ← PAA + CPC — source prioritaire
  DataForSEO related (4 seeds ‖),    ← enrichissement corpus — source complémentaire
  DataForSEO ranked (domaine OT),    ← seule source obligatoire
])
→ Fusion corpus marché → classification OpenAI (300 kw max, 6 batches)
→ PAUSE : UI affiche tableau validation → utilisateur coche/décoche → confirme
statut: 'en_attente_validation'
```

Phase B (déclenchée après validation, ~0.05€) :
```
DataForSEO SERP live (7-8 appels) → OpenAI synthèse gap
statut: 'terminé'
```

**Haloscan keywords/overview** (différent de domains/overview) :
- Endpoint : `POST https://api.haloscan.com/api/keywords/overview`
- ⚠️ `serp` retiré de `requested_data` — non utilisé en Phase A, économise du temps de réponse
- 8 seeds couvrant toutes les intentions touristiques :
  ```
  "[destination]", "tourisme [destination]", "que faire [destination]",
  "activités [destination]", "hébergement [destination]", "visiter [destination]",
  "vacances [destination]", "week-end [destination]"
  ```
- `keyword_match` + `similar_highlight` → keywords marché
- `related_question` → PAA (exclusif Haloscan — DataForSEO related ne fournit pas de PAA)
- `ads_metrics.cpc` peut être null — signal transac = `cpc > 0.30`
- Coût : 1 crédit/appel = 0.010€

**DataForSEO related_keywords** (NOUVEAU — enrichissement corpus marché) :
- Endpoint : `POST https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live`
- 4 seeds : `[destination]`, `"tourisme [destination]"`, `"activités [destination]"`, `"visiter [destination]"`
- Payload par seed : `{ keyword, location_code: 2250, language_code: "fr", limit: 100, depth: 2, include_seed_keyword: true }`
- Chemin de parsing : `data?.tasks?.[0]?.result?.[0]?.items ?? []`
- Champs : `item.keyword_data.keyword`, `item.keyword_data.keyword_info.search_volume`, `item.keyword_data.keyword_info.cpc`
- Coût : 0.006€/seed = 0.024€ pour les 4 seeds
- ⚠️ **Filtre pertinence obligatoire** avant fusion — un keyword related sans mention de la destination est trop générique :
  ```typescript
  // Garder si : contient la destination OU ≥ 3 mots (assez spécifique)
  if (!cle.includes(dest) && cle.split(' ').length < 3) continue
  ```
- ⚠️ Haloscan a priorité lors de la fusion — ne jamais écraser un keyword déjà présent (CPC Haloscan plus fiable)
- Source identifiée dans `KeywordMarche.source = 'dataforseo_related'`

**DataForSEO ranked_keywords** :
- Endpoint : `POST https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live`
- Chemin de parsing : `data?.tasks?.[0]?.result?.[0]?.items ?? []`
- Champ position : `item.ranked_serp_element.serp_item.rank_group` (pas rank_absolute)
- ⚠️ **Source obligatoire** — si ranked échoue, Phase A est interrompue (throw dans l'orchestrateur)
- Coût : 0.006€/appel

**Fusion corpus marché** (dans l'orchestrateur Phase A) :
```typescript
// Promise.allSettled — une panne d'une source ne bloque pas les deux autres
// ranked_result est obligatoire (throw si absent), haloscan/related peuvent être null
const mapKeywords = new Map<string, KeywordMarche>()
// 1. Haloscan en premier (priorité CPC)
// 2. DataForSEO related filtrés en complément (ne pas écraser Haloscan)
```

**Classification OpenAI** :
- Pré-filtre regex avant OpenAI — keywords évidents hors-tourisme éliminés d'office :
  ```
  /^météo\b/i, /\bsncf\b/i, /horaires? (train|bus|tram|car)\b/i, /^itinéraire\b/i, etc.
  ```
- Limite : **300 keywords** (augmenté depuis 200 pour exploiter le corpus hybride)
- Batch de 50 keywords max par appel → 6 batches pour 300 kw
- Catégories : `activités | hébergements | services | culture | restauration | transports | hors-tourisme`
- `gap: true` si touristique ET (pos_ot null OU pos_ot > 20)
- ⚠️ **Règle dure post-OpenAI** : si `position_ot ≤ 20` alors `gap = false`
- `intent_transactionnel: true` si cpc > 0.30 OU keyword contient mots-clés booking

**Trois volumes distincts dans `ResultatPhaseA`** (ne pas les additionner) :
```typescript
volume_marche_seeds    // demande autour de la destination (Haloscan, 8 seeds)
volume_positionne_ot   // périmètre du site OT dans Google (DataForSEO ranked)
volume_transactionnel_gap  // potentiel commercial non capté (gap + transac uniquement)
```
⚠️ Ces 3 champs ont des périmètres différents — afficher séparément avec `note_volumes`.

**Sélection Phase B** :
- 50% keywords transac + gap (plus fort volume)
- 50% absences totales (pos_ot null)
- L'utilisateur peut modifier via `selectionne_phase_b: true`
- Max 8 appels SERP live

**Estimation CTR par position** (dans dataforseo-ranked + synthese) :
```
pos 1: 28% | pos 2: 15% | pos 3: 10% | pos 4: 7% | pos 5: 5%
pos 6: 4%  | pos 7: 3%  | pos 8: 2.5% | pos 9: 2% | pos 10: 1.5%
pos 11-20: 1% | pos >20: 0.5%
```

**Coûts** :
```
Haloscan keywords (8 seeds)         : 0.080€
DataForSEO related (4 seeds)        : 0.024€
DataForSEO ranked (1 appel)         : 0.006€
OpenAI classification (4-6 appels)  : 0.004-0.006€
DataForSEO SERP live (7-8 appels)   : 0.042-0.048€  (Phase B)
OpenAI synthèse                     : 0.001€  (Phase B)
TOTAL                               ≈ 0.157-0.165€
```

**Test validé Annecy — Phase A + Phase B avec corrections (2026-02-24)** :
```
Phase A :
  Haloscan : 117 kw | DataForSEO related : 125 kw (avant filtre) → corpus fusionné : 223 kw uniques
  160 classifiés | 21 PAA | 35 gaps transac | 69 absences totales
  Coût Phase A : 0.116€ | Durée : ~156s

Phase B :
  8 SERP live (4 transac + 4 absences)
  - OT absent sur "evènement", "plage de", "randonnée autour de moi", "fromagerie autour de moi"
  - OT position 1 sur "que faire à annecy", "visiter annecy", "tourisme à annecy" → exclus du top 5
  - "week end a annecy" → OT pos 4 (pas un gap)
  Vrais gaps confirmés live : 35 (croisement Phase A ↔ SERP live)
  trafic_estime_capte : 512 484 visites/mois (CTR par position, depuis dataforseo-ranked)
  taux_captation : 80% (512 484 / 640 650 — plafonné à 100%)
  Score gap : 8/10
  Top 5 opportunités : evènement (49500), plage de (27100), randonnée autour de moi (27100),
                       fromagerie autour de moi (22200), hôtel annecy spa (9900)
  PAA sans réponse OT : 5 (que faire à annecy, que faire ce week-end, quand il pleut, lac artificiel ?, où dormir)
  Coût Phase B : 0.049€ | TOTAL Bloc 4 : 0.165€ | Durée totale : ~194s
```

**Pièges critiques** :
- `api-costs.ts` : 3 entrées Bloc 4 (`haloscan_keywords`, `dataforseo_ranked`, `dataforseo_related`)
- Classification : limite à 300 keywords (6 batches max)
- Phase B SERP : appels séquentiels (pas en parallèle) pour éviter les rate limits
- ⚠️ Règle dure gap ≤ 20 : indispensable — OpenAI peut classer `gap: true` des keywords où l'OT est bien positionné
- ⚠️ Filtre related obligatoire : sans lui, des keywords ultra-génériques (1-2 mots sans destination) polluent le corpus
- ⚠️ `Promise.allSettled` (pas `Promise.all`) : une panne Haloscan ne doit pas bloquer DataForSEO related ni ranked
- ⚠️ `taux_captation` : dénominateur = `volume_marche_seeds` (pas `volume_transactionnel_gap`) — plafonné à 100%
- ⚠️ `trafic_estime_capte` : utiliser la valeur CTR déjà calculée par `dataforseo-ranked` (ne pas la recalculer dans synthese)
- ⚠️ `top_5_opportunites` : construire `vrais_gaps` (croisement Phase A ↔ SERP live) AVANT d'envoyer à OpenAI — sans ça, OpenAI invente des opportunités sur des keywords où l'OT est déjà bien positionné
- ⚠️ Timeout OpenAI classification : 90s (60s trop court pour les gros batches de 50 keywords)

#### Préparation Bloc 5 — Scan types DATA Tourisme ✅ TERMINÉ (2026-02-24)

**Objectif** : cartographier tous les types `@type` présents dans les fichiers DATA Tourisme pour une commune avant de coder le Bloc 5 (stocks physiques).

**Fichiers créés** :
```
microservice/routes/scan-types.ts          → GET /scan-types?code_insee=XXX
microservice/services/datatourisme.ts      → export getFilepathsParCommune() ajouté
scripts/scan-datatourisme-types.js         → script standalone (node scripts/scan-datatourisme-types.js 74010)
```

**Endpoint microservice** :
```
GET http://localhost:3001/scan-types?code_insee=74010
Retourne : { code_insee, total_fichiers, types_distincts, types: [{ type, count }] }
Tri : fréquence décroissante
Filtre : aucun — tous les types @type bruts
```

**Résultats scan Annecy (INSEE 74010) — validés** :
- 323 fichiers, 114 types distincts
- Notes : `PointOfInterest` (323) et `PlaceOfInterest` (314) = types racines omniprésents, à ignorer pour les regroupements
- `olo:OrderedList` (13) = artefact technique, à ignorer
- Les types `schema:XXX` sont des doublons des types sans préfixe — compter l'un ou l'autre uniquement

**Regroupements définis pour le Bloc 5** (à affiner lors du codage) :

| Catégorie | Types DATA Tourisme | Count Annecy |
|---|---|---|
| HÉBERGEMENTS | `Accommodation`, `schema:Accommodation`, `schema:LodgingBusiness`, `Hotel`, `schema:Hotel`, `HotelTrade`, `CollectiveAccommodation`, `HolidayResort`, `RentalAccommodation`, `SelfCateringAccommodation` | ~42 |
| ACTIVITÉS & LOISIRS | `SportsAndLeisurePlace`, `ActivityProvider`, `Tour`, `WalkingTour`, `EducationalTrail`, `CyclingTour`, `FitnessCenter`, `TennisComplex`, `ClimbingWall`, `NauticalCentre`, `SwimmingPool`, `EquestrianCenter`, `BoulesPitch`, `LeisureComplex` | ~127+ |
| CULTURE & PATRIMOINE | `CulturalSite`, `ReligiousSite`, `Church`, `Cathedral`, `Convent`, `Monastery`, `CityHeritage`, `TechnicalHeritage`, `RemarkableBuilding`, `NaturalHeritage`, `Museum`, `ArtGalleryOrExhibitionGallery`, `Castle`, `Palace`, `Bridge`, `Theater`, `Cinema`, `InterpretationCentre` | ~68+ |
| SERVICES TOURISTIQUES | `TouristInformationCenter`, `LocalTouristOffice`, `IncomingTravelAgency`, `TourOperatorOrTravelAgency`, `Transport`, `ConvenientService` | ~5+ |

**À exclure** (hors scope) :
- `FoodEstablishment`, `Restaurant`, `HotelRestaurant`, `BistroOrWineBar`, `BarOrPub`, `Store`, `CraftsmanShop`, `schema:LocalBusiness`, `EquipmentRental`, `EquipmentRentalShop`, `Rental`, `Product`, `NightClub`, `Casino`, `Airport`

---

#### Bloc 5 — Stocks physiques ✅ TERMINÉ (2026-02-25)

**Architecture** :
```
microservice/routes/stocks.ts                → GET /stocks?code_insee=XXX (classification DATA Tourisme)
microservice/routes/scan-types.ts            → GET /scan-types?code_insee=XXX (scan types, usage développement)

app/api/blocs/stocks-physiques/
├── datatourisme/route.ts  → proxy microservice /stocks
├── sirene/route.ts        → recherche-entreprises.api.gouv.fr (sans auth)
└── synthese/route.ts      → GPT-4o-mini

lib/blocs/stocks-physiques.ts  → orchestrateur (Promise.allSettled + déduplication Levenshtein)
types/stocks-physiques.ts       → tous les types TypeScript du bloc
```

**Migration SIRENE — piège critique** :
- ❌ `https://api.insee.fr/token` → retourne `"url deprecated, visit portail-api.insee.fr"`
- ❌ `portail-api.insee.fr` → SPA Gravitee APIM — retourne du HTML pour toutes les URLs
- ❌ Gateway `api.insee.fr/api-sirene/3.11` avec API_KEY plan → les SIRENE_CLIENT_ID/SECRET sont pour l'ancien portail OAuth2, non valides avec le nouveau plan API_KEY
- ✅ **Remplacement** → `recherche-entreprises.api.gouv.fr` — gratuit, sans auth, même données, filtre `code_commune` au niveau des établissements
- ⚠️ `SIRENE_CLIENT_ID`/`SIRENE_CLIENT_SECRET` dans `.env.local` sont désormais **inutilisés** (old deprecated credentials)

**recherche-entreprises.api.gouv.fr — comportement clé** :
```
GET https://recherche-entreprises.api.gouv.fr/search?code_commune=74010&activite_principale=55.10Z&etat_administratif=A&per_page=25&limite_matching_etablissements=25
→ results[].matching_etablissements = UNIQUEMENT les établissements dans la commune cible
→ Filtrer : etab.commune === code_insee && etab.etat_administratif === 'A'
→ Déduplication par SIRET (codes NAF se chevauchent ex: 79.90Z dans activites ET services)
```
⚠️ **Rate limit 429** : ajouter `sleep(300ms)` entre chaque code NAF + retry backoff (1.5s × tentative, max 3)
⚠️ **Format NAF avec point** : `55.10Z` (avec point) — obligatoire pour cette API

**Codes NAF par catégorie** :
```
hébergements : ['55.10Z', '55.20Z', '55.30Z', '55.90Z']
activités    : ['93.11Z', '93.12Z', '93.13Z', '93.19Z', '93.21Z', '93.29Z', '79.90Z']
culture      : ['90.01Z', '90.02Z', '90.03A', '91.01Z', '91.02Z', '91.03Z', '91.04Z']
services     : ['79.11Z', '79.12Z', '79.90Z']
```

**Microservice /stocks — classification** :
- 1 fichier JSON = 1 établissement = 1 catégorie (priorité hébergements → activités → culture → services)
- Restauration (`FoodEstablishment`, etc.) **ignorée** — hors scope
- Retourne counts par catégorie + sous-catégories + `etablissements_bruts[]` pour déduplication

**Déduplication DATA Tourisme ↔ Recherche Entreprises** :
- Score de similarité : nom exact (+3), inclusion (+2), Levenshtein ≤ 3 (+1), mots significatifs communs ≥2 (+2), 1 mot commun nom court (+1), code postal identique (+1), adresse partielle (+1)
- ⚠️ Seuil = 2 (pas 3) — SIRENE utilise souvent des noms de sociétés holdings (ex: "GESTION HOTELIERE XYZ") vs nom commercial DT → seuil ≥ 3 manquait trop de matchs
- Mots vides exclus du pivot : articles, prépositions, formes juridiques, mots sectoriels (`hotel`, `camping`, etc.)
- `couverture` par catégorie (%) + `couverture.global` — remplace l'ancien `taux_couverture_dt`
- `ratio_particuliers_hebergement` = % NAF 55.20Z (meublés particuliers) / total SIRENE hébergements

**Sous-catégories enrichies** :
- Hébergements DT : hotels / collectifs / locations / autres
- Culture DT : patrimoine / religieux / musees_galeries / spectacle_vivant / nature ← **NEW**
- SIRENE mappé par NAF : voir `NAF_SOUS_CAT_HEBERGEMENT/ACTIVITES/CULTURE/SERVICES` dans orchestrateur

**Tests validés — Annecy (INSEE 74010)** :

| Source | Hébergements | Activités | Culture | Services | Total |
|---|---|---|---|---|---|
| DATA Tourisme | 42 (37 hôtels) | 153 | 55 (32 patr/15 rel/1 musée/7 nature) | 14 | 264 |
| Recherche Entreprises | 438 (123 hôtels/246 meublés/1 camping) | 811 | 699 (660 spectacle) | 69 | 2 017 |
| **Fusionné** | **461** | **927** | **745** | **80** | **2 213** |
| Doublons | 19 | 37 | 9 | 3 | **68 total** |

Couverture DT globale : 3% | Ratio particuliers hébergement : 56.2% | OpenAI synthèse ✅

> **Note évolution** : l'ancienne valeur fusionnée était **2 271** (seuil dédup = 3, seulement 10 doublons détectés). Après correction du seuil à 2 + pivot mots significatifs → **2 213** (68 doublons). La valeur 2 271 dans les résumés de session antérieurs est obsolète.

⚠️ NAF `90.01Z/90.02Z/90.03A` = spectacle vivant = 660 SIRENE (artistes/auto-entrepreneurs) → culture SIRENE dominée par spectacle, pas par patrimoine

**Coût du bloc** :
```
DATA Tourisme (local)          : gratuit
Recherche Entreprises (open)   : gratuit
OpenAI gpt-4o-mini (1 appel)   : 0.001€
TOTAL                          : 0.001€
```


### Phase 3 — Orchestration et UX
- Page lancement + autocomplete + gestion doublon
- Progression temps réel (Supabase Realtime)
- Stockage structuré des résultats
- Module tracking des coûts API

### Phase 4 — Page de résultats
- Affichage par bloc structuré
- Contenus OpenAI prêts à copier-coller
- Vue comparaison destination vs concurrents
- Dashboard historique

### Phase 5 — Finitions
- Gestion des erreurs et retry par module
- Tests et optimisations
- Interface collaborateurs

---

## Variables d'environnement (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=sk-proj-V2iayBm71Rm...

# DataForSEO
DATAFORSEO_LOGIN=mickael.challet@top10-strategie.fr
DATAFORSEO_PASSWORD=4e494b70cde62abb

# Haloscan
HALOSCAN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Monitorank
MONITORANK_API_KEY=4648-80kpZC7othd7...

# Apify
APIFY_API_TOKEN=apify_api_r47zaja0...

# Google PageSpeed
PAGESPEED_API_KEY=AIza...

# Microservice DATA Tourisme local
DATA_TOURISME_API_URL=http://localhost:3001
```

⚠️ Le fichier `.env` source n'est pas au format KEY=VALUE standard. Toujours utiliser `.env.local` avec `dotenv.config({ path: '.env.local' })`.

---

## Scripts de test disponibles (référence)

| Fichier | Contenu |
|---|---|
| `test-apis.js` | Round 1 — Connectivité de base |
| `test-round2.js` | Round 2 — Monitorank, Haloscan, Instagram postsCount |
| `test-round3.js` | Round 3 — RapidAPI Instagram (abandonné) |
| `test-hashtag-stats.js` | Validation finale — apify/instagram-hashtag-stats |
| `test-bloc1.js` | Bloc 1 — test standalone Annecy (flux complet sans Next.js) |
| `test-trevoux.js` | Bloc 1 — test intégration Trévoux (vraies APIs, microservice requis) |
| `test-bloc2.js` | Bloc 2 — test Vanves + Annecy (taxe de séjour, microservice requis) |
| `test-bloc3.js` | Bloc 3 — test Annecy (SERP 5 requêtes, classification, Haloscan+fallback DataForSEO, PageSpeed, Analyse OT, OpenAI) |
| `test-bloc4.js` | Bloc 4 Phase A+B — test Annecy (Haloscan 8 seeds, DataForSEO related 4 seeds, ranked, classification 300 kw, SERP live 8, synthèse — flag `--phase-b`) |
| `test-bloc5.js` | Bloc 5 — test Annecy (DATA Tourisme /stocks, Recherche Entreprises, déduplication, OpenAI) |
| `scripts/scan-datatourisme-types.js` | Préparation Bloc 5 — scan tous types @type DATA Tourisme sans filtre (node scripts/scan-datatourisme-types.js [code_insee]) |
