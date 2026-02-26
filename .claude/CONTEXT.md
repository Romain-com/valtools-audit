# CONTEXT.MD — Destination Digital Audit App
> Dernière mise à jour : Correctifs Phase B + Volume d'affaires + Prefetch bbox Segment A (2026-02-26)
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
**Modèle** : `gpt-5-mini` (économie de tokens) — **Responses API** (pas Chat Completions)
```
POST https://api.openai.com/v1/responses
{
  "model": "gpt-5-mini",
  "input": "prompt système + prompt user fusionnés en une seule chaîne",
  "max_output_tokens": 1000,
  "reasoning": { "effort": "low" }
}
```
- Toujours demander JSON pur : "Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires)"
- Parser la réponse via le helper partagé `lib/openai-parse.ts` (voir section dédiée)
- Parser systématiquement : `JSON.parse(brut.replace(/```json\n?|```/g, '').trim())`
- ⚠️ Pas de `temperature` (non supporté sur les modèles reasoning)
- ⚠️ `max_output_tokens` minimum **500** — les tokens de raisonnement interne consomment ~80% du budget

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
| Positionnement marketing | OpenAI gpt-5-mini | ✅ |
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
| Stock commercialisé OTA (hébergements) | Airbnb + Booking (Playwright) | ✅ Bloc 6 terminé |
| Stock commercialisé OTA (activités) | Viator (Playwright — bloqué Cloudflare → 0) | ⚠️ Bloc 6 partiel |
| Analyse site OT (réservable / lien OTA / listing) | Playwright site OT | ✅ Bloc 6 terminé |
| Concurrents (5) + métriques SEO/Maps | OpenAI + Haloscan + DataForSEO | ✅ Bloc 7 terminé |
| Synthèse comparative destination vs concurrents | OpenAI | ✅ Bloc 7 terminé |
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
- `destination_id` UUID (FK → destinations) — **UNIQUE** : un seul audit par destination, données écrasées au relancement
- `statut` ENUM (en_cours / termine / erreur)
- `resultats` JSONB (7 blocs : positionnement, volume_affaires, schema_digital, visibilite_seo, stocks_physiques, stock_en_ligne, concurrents)
- `couts_api` JSONB (agrégat par bloc et par API)
- `created_at` TIMESTAMP

> ⚠️ **Pas de table `competitors`** — les concurrents sont stockés uniquement dans `resultats.concurrents` (JSONB). Table supprimée via migration 005.

### Table `users` (profiles)
- Gérée par Supabase Auth + table `public.profiles`
- Champ additionnel : `role` ENUM (admin / collaborateur)
- Profil créé automatiquement par trigger à la création d'un utilisateur Auth

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

### Phase 1 — Fondations ✅ TERMINÉE (2026-02-23) + Schéma Supabase ✅ + Validation Supabase ✅ (2026-02-25)
- Setup Next.js + Tailwind + Supabase + Auth + GitHub
- Schéma BDD et migrations Supabase
- **Microservice Node.js local : CSV communes + DATA Tourisme ✅**
- Structure dossiers et `.env.local`
- **Migrations SQL + seed Annecy ✅** (2026-02-25)

#### Schéma Supabase — Fichiers créés (2026-02-25)

```
supabase/
├── schema-documentation.md          → Documentation exhaustive JSONB audits.resultats (7 blocs)
├── migrations/
│   ├── 001_initial_schema.sql        → Tables + ENUMs + triggers (profiles, destinations, audits, competitors)
│   ├── 002_indexes.sql               → GIN (resultats, couts_api) + btree expressions (score_gap, PageSpeed, etc.)
│   ├── 003_rls.sql                   → Row Level Security — authenticated full read/write
│   ├── 004_audit_unique_constraint.sql → UNIQUE(destination_id) sur audits — 1 seul audit par destination
│   └── 005_drop_competitors_table.sql  → Suppression table competitors + ENUM type_concurrent
└── seed.sql                          → Données Annecy complètes (7 blocs, résultats réels + estimés)
```

**ENUMs créés** :
- `statut_audit` : `en_cours | termine | erreur`
- `type_concurrent` : `direct | indirect`
- `role_utilisateur` : `admin | collaborateur`

**Triggers** :
- `on_auth_user_created` → crée automatiquement un profil dans `public.profiles` à chaque nouvel utilisateur Supabase Auth
- `destinations_updated_at` → met à jour `updated_at` automatiquement

**Index notables** :
- GIN global sur `audits.resultats` et `audits.couts_api` (queries JSONB ad-hoc)
- Btree expression sur `score_gap`, `score_visibilite_ot`, `note_google_ot`, `total_stock_physique`

**RLS** : tout utilisateur `authenticated` peut lire et écrire toutes les tables. Les Route Handlers Next.js doivent utiliser `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS automatique).

**Seed Annecy** :
- Destination Annecy (SIREN 200063402, INSEE 74010) + audit complet statut `termine`
- `resultats` JSONB : 7 blocs complets avec toutes les données documentées
- `couts_api` JSONB : agrégat par bloc (total audit ≈ 0,516 €)
- ~~5 concurrents dans la table `competitors`~~ → **table supprimée (migration 005)** — les concurrents sont uniquement dans `resultats.concurrents` (JSONB)
- Valeurs marquées "estimé" dans `schema-documentation.md` : `instagram.posts_count` Annecy, détails PageSpeed LCP/CLS/INP, `analyse_site_ot`

#### Validation Supabase — `scripts/test-supabase.js` ✅ (2026-02-25)

Script de validation ESM (`@supabase/supabase-js` + dotenv) — utilise `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS).

| Bloc | Donnée validée | Valeur seed |
|------|---------------|-------------|
| 1 | Google OT | 4.2/5 — 340 avis |
| 1 | Instagram posts_count | 8 500 000 |
| 2 | Taxe de séjour collecteur | 3 440 837 € |
| 3 | Keywords Haloscan (lac-annecy.com) | 53 842 |
| 3 | Score visibilité OT | 1/5 |
| 4 | Score gap SEO | 8/10 |
| 4 | Top opportunité | "évènement annecy" — 49 500 req/mois |
| 5 | Stock physique total | 2 213 hébergements |
| 6 | Airbnb annonces | 4 246 |
| 7 | Position globale concurrents | leader |
| 7 | Concurrents validés | 5 |
| — | Coût total audit | 0.516 € |

**Contrainte UNIQUE** : doublon `destination_id` correctement refusé (code PG `23505`).

**Note clé** : `SUPABASE_SERVICE_ROLE_KEY` = format `sb_secret_...` (pas un JWT). Requis pour tous les Route Handlers Next.js (bypass RLS). Clé `anon` retourne 0 lignes (RLS `authenticated` uniquement).

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
├── openai/route.ts        → GPT-5-mini (analyse positionnement)
├── poi/route.ts           → Microservice DATA Tourisme (POI bruts)
└── poi-selection/route.ts → GPT-5-mini (sélection 3 POI pertinents)

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
4. POST /openai           → GPT-5-mini (analyse finale)
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
  openai_gpt5_mini: 0.003,      // 2 appels = 0.006 €
}                               // Total bloc ≈ 0.108 €
```

#### Bloc 2 — Volume d'affaires (taxe de séjour) ✅ TERMINÉ (2026-02-24) + Enrichissement Mélodi ✅ (2026-02-25)

**Architecture** :
```
microservice/routes/epci.ts         → GET /epci?code_insee=XXX + GET /epci/communes?siren_epci=XXX

app/api/blocs/volume-affaires/
├── epci/route.ts           → Proxy microservice → résolution EPCI
├── epci-communes/route.ts  → Proxy microservice → communes d'un EPCI (NOUVEAU)
├── taxe/route.ts           → data.economie.gouv.fr (communes + groupements)
├── melodi/route.ts         → API Mélodi INSEE (RP 2022 + BPE D7) + OpenAI coefficients (NOUVEAU)
└── openai/route.ts         → GPT-5-mini (synthèse + indicateurs + part commune)

lib/blocs/volume-affaires.ts        → Orchestrateur du bloc (+ étape Mélodi + dispatch)
types/volume-affaires.ts            → DonneesCollecteur + ResultatVolumeAffaires
                                       + DonneesLogementCommune + Coefficients + DispatchTS + ResultatDispatchTS (NOUVEAU)
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
OpenAI gpt-5-mini    : 1 appel = 0.003 €
Total bloc           : 0.001 €
```

**Enrichissement Mélodi — dispatch TS par commune** :

**Flux** :
```
1. GET /epci/communes  → microservice → liste communes EPCI
2. POST /melodi        → Mélodi RP 2022 (résidences secondaires) + BPE D7 (hébergements)
                         + OpenAI coefficients selon profil destination
3. Orchestrateur       → dispatcherTS() → DispatchTS[] avec part_pct + ts_estimee par commune
```

**API Mélodi (INSEE)** :
- Auth : aucune — open data, gratuit
- Rate limit : 30 req/min → batch de 10 communes × 2 appels = sleep 2100ms entre batches
- RP 2022 : `GET /melodi/data/DS_RP_LOGEMENT_PRINC?GEO=COM-{insee}&OCS=DW_SEC_DW_OCC&TIME_PERIOD=2022&TDW=_T`
  - ⚠️ Format GEO : `COM-74010` (pas juste `74010`)
  - ⚠️ Période disponible : `2022` (pas 2021 ni 2023)
  - Valeurs flottantes → toujours `Math.round()`
- BPE D7 : `GET /melodi/data/DS_BPE?GEO=COM-{insee}&FACILITY_SDOM=D7`
  - ⚠️ Dataset = `DS_BPE` (pas `BPE_EQUIPEMENTS`), dimension = `FACILITY_SDOM` (pas `TYPEQU`)
  - Codes validés : D701=hôtels, D702=campings, D703=rés.tourisme, D705=villages, D710=meublés, D711=ch.d'hôtes

**Coefficients fixes (nuitées/an)** :
```typescript
residence_secondaire: 30 | hotel_etablissement: 2000 | tourisme_etablissement: 1500
camping_etablissement: 600 | autres_etablissement: 800
```
Ajustés par OpenAI selon profil (station_ski / bord_mer / bord_lac / ville / campagne / mixte).

**ResultatDispatchTS** dans `ResultatVolumeAffaires.dispatch_ts` :
- `mode` : `dispatch_epci` ou `reconstitution_totale`
- `communes[]` : dispatch pour toutes les communes EPCI
- `commune_cible` : la commune auditée avec `part_pct` + `ts_estimee`
- `comparaison_bloc5` (optionnel) : ajouté par l'orchestrateur principal si Bloc 5 disponible

**Coût enrichissement Mélodi** :
```
API Mélodi  : 0.000€ (open data INSEE)
OpenAI      : +0.001€ (ajustement coefficients)
TOTAL Bloc 2 après enrichissement : 0.002€
```

**Script de test** : `node test-bloc2-melodi.js "Annecy" "74010"` (microservice requis)

**Tests validés — Annecy (CA Grand Annecy, 34 communes)** :
- EPCI : 34 communes récupérées ✅
- Annecy (74010) : 5 344 RS + 12 hôtels + 7 campings + 4 rés.tourisme + 2 villages + 25 meublés + 2 ch.d'hôtes ✅
- Profil OpenAI : `bord_lac` — coefficients ajustés (hôtel 2000→2500, tourisme 1500→1800) ✅
- Dispatch Annecy : **93.1%** de l'EPCI — TS estimée **3 203 030€** ✅
- Total dispatché : 3 440 838€ ≈ 3 440 837€ — **écart 0.00%** ✅
- Durée : **13.7s** (34 communes × 4 batches × 2 appels Mélodi) ✅
- Pas de 429 rate-limit ✅

⚠️ **Observation** : 19/34 communes ont `source: 'absent'` (petites communes rurales non indexées dans Mélodi). Normal — Annecy représente ~93% du poids d'hébergement de l'EPCI. Le dispatch reste cohérent.

#### Bloc 3 — Schéma digital & Santé technique ✅ TERMINÉ (2026-02-24)

**Architecture** :
```
app/api/blocs/schema-digital/
├── serp/route.ts              → DataForSEO SERP (5 requêtes parallèles, fusion + dédup par domaine)
├── classification/route.ts    → GPT-5-mini (catégorisation SERP + visibilite_ot_par_intention)
├── haloscan/route.ts          → Haloscan — UN domaine par appel, retourne { donnees_valides, resultat }
├── domain-analytics/route.ts  → DataForSEO domain_rank_overview — fallback si Haloscan vide
├── pagespeed/route.ts         → Google PageSpeed (mobile + desktop en parallèle par domaine)
├── analyse-ot/route.ts        → GPT-5-mini (fonctionnalités + maturité digitale site OT)
└── openai/route.ts            → GPT-5-mini (synthèse schéma digital)

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
└── synthese/route.ts      → GPT-5-mini

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
OpenAI gpt-5-mini (1 appel)    : 0.003€
TOTAL                          : 0.001€
```


#### Bloc 6 — Stock commercialisé en ligne (OTA + site OT) ✅ TERMINÉ (2026-02-25)

**Architecture** :
```
microservice/routes/bbox.ts                 → GET /bbox?code_insee=XXX (bounding box via geo.api.gouv.fr)

lib/scrapers/
  site-ot.ts   → scraperSiteOT(browser, domaine_ot) : analyse hébergements + activités OT
  airbnb.ts    → scraperAirbnb(browser, bbox, destination) : découpage quadrant récursif
  booking.ts   → scraperBooking(browser, destination) : compteur total propriétés
  viator.ts    → scraperViator(browser, destination) : activités (bloqué Cloudflare → 0)

app/api/blocs/stock-en-ligne/
  site-ot/route.ts    → POST (runtime nodejs, maxDuration 120s)
  airbnb/route.ts     → POST (runtime nodejs, maxDuration 300s)
  booking/route.ts    → POST (runtime nodejs, maxDuration 120s)
  viator/route.ts     → POST (runtime nodejs, maxDuration 120s)
  synthese/route.ts   → OpenAI synthèse

lib/blocs/stock-en-ligne.ts  → orchestrateur : browser Playwright partagé, Promise.allSettled
types/stock-en-ligne.ts      → tous les types TypeScript
scripts/test-bloc6.js        → test standalone (node scripts/test-bloc6.js "Annecy" "74010" "lac-annecy.com")
```

**Trois indicateurs clés** :
```
taux_dependance_ota       = (airbnb + booking) / bloc5.hebergements.total_unique
taux_visibilite_activites = viator / bloc5.activites.total_unique
taux_reservable_direct    = reservable_ot / (airbnb + booking)
```

**Architecture Playwright** :
- `lib/scrapers/*.ts` sont des fonctions pures qui reçoivent un `browser: Browser`
- L'orchestrateur instancie UN seul browser partagé → `Promise.allSettled` des 4 scrapers
- Les route handlers instancient chacun leur propre browser (usage individuel/debug)
- `export const runtime = 'nodejs'` obligatoire sur chaque route handler (pas Edge)

**Airbnb — découpage quadrant** :
- `SEUIL_MAX = 1000`, `PROFONDEUR_MAX = 6`, `DELAI_MS = 1800`
- Si `nombre >= SEUIL_MAX` → découper en 4 quadrants récursivement
- ⚠️ Condition `>= SEUIL_MAX` (pas `>`) — Airbnb peut retourner exactement 1000
- ⚠️ Si le texte contient "+" → forcer `SEUIL_MAX + 1` pour déclencher subdivision
- Bbox depuis `GET /bbox` microservice → geo.api.gouv.fr `?fields=contour,centre`
- Dans le script de test : appel direct geo.api.gouv.fr (sans microservice) — le microservice a besoin d'être redémarré pour voir la nouvelle route `/bbox`

**Booking** :
- Sélecteur `h1` en premier — contient directement "Annecy : 277 établissements trouvés"
- Les filtres `ht_id` (par type) ne changent pas le compteur h1 → 1 seul appel (total)
- `detail` toujours `{ hotels: 0, ... }` — sous-catégories non extractibles via cette méthode

**Viator** :
- Cloudflare bloque systématiquement le headless Playwright → retourne 0 sans erreur
- Idem pour GetYourGuide et TripAdvisor — même protection Cloudflare
- Alternative possible : Apify actor `apify/tripadvisor-scraper` si ce taux est critique

**Site OT** :
- Teste patterns d'URL `/hebergements`, `/hebergement`, `/ou-dormir`, etc.
- Détecte moteurs de réservation : Bokun, Regiondo, FareHarbor, Checkfront, Rezdy (dans le HTML)
- Détecte liens OTA : Booking, Airbnb, Viator, GetYourGuide, Tripadvisor, Abritel, Gîtes de France, Clevacances
- Classification : `reservable_direct` > `lien_ota` > `listing_seul` > `absent`

**Tests validés — Annecy (INSEE 74010)** :
| Source | Résultat | Note |
|---|---|---|
| Airbnb | 4 246 annonces (21 zones) | Découpage quadrant fonctionnel |
| Booking | 277 propriétés | Correct |
| Viator | 0 | Cloudflare — limitation connue |
| Site OT (héb.) | 34 fiches — listing_seul | Correct |
| Site OT (act.) | 64 fiches — listing_seul | Correct |
| Taux réservable direct | 0.8% | (34 fiches OT / 4 523 OTA) |

Durée : 143s | Coût : 0.001€ (OpenAI uniquement)

**Coût du bloc** :
```
Playwright (Chromium)  : gratuit (local)
Airbnb/Booking/Viator  : gratuit (risque CGU — usage interne uniquement)
OpenAI gpt-5-mini      : 0.003€
TOTAL                  : 0.001€
```

**Pièges critiques** :
- ⚠️ Airbnb `>= SEUIL_MAX` (pas `>`) — sinon exactement 1000 ne déclenche pas la subdivision
- ⚠️ Airbnb texte "+" → forcer SEUIL_MAX + 1 immédiatement
- ⚠️ Booking : `h1` seul fonctionne (les autres sélecteurs sont obsolètes)
- ⚠️ Viator + GYG + TripAdvisor : Cloudflare → 403 headless systématique
- ⚠️ Microservice `/bbox` : la route est dans le code mais le microservice doit être redémarré pour la prendre en compte
- ⚠️ `export const runtime = 'nodejs'` obligatoire sur tous les route handlers Playwright
- ⚠️ `maxDuration: 300` pour le route handler Airbnb (grandes villes = 5-8 min)

#### Bloc 7 — Concurrents v2 ✅ TERMINÉ (2026-02-25)

**Architecture** :
```
app/api/blocs/concurrents/
├── identification/route.ts   → OpenAI : 6 candidats → filtre subdivisions → 5 concurrents
├── metriques/route.ts        → Séquence SEO 5 étapes + DataForSEO Maps (par concurrent)
└── synthese/route.ts         → OpenAI synthèse comparative (+ insight_gap optionnel)

lib/blocs/concurrents-phase-a.ts  → orchestrateur Phase A (automatique)
lib/blocs/concurrents-phase-b.ts  → orchestrateur Phase B (après validation utilisateur)
types/concurrents.ts              → tous les types TypeScript
scripts/test-bloc-concurrents.js  → test standalone
```

**Flux Phase A** (automatique) :
```
1. Parallèle :
   POST /identification  → OpenAI (6 candidats)
                           Filtre dur : exclure subdivisions de la destination
                           .slice(0, 5) → 5 concurrents max
   getSiteCompetitors()  → Haloscan siteCompetitors (domaine_ot cible)
                           10 concurrents SEO réels avec common_keywords, missed_keywords
                           Timeout 60s — réponse ~20-30s

2. Validation domaines incertains (confiance_domaine === 'incertain') :
   → SERP DataForSEO "tourisme [nom]" → filtre OTA/Wikipedia → premier domaine organique
   → Fallback : conserver domaine_ot estimé par OpenAI

3. Boucle séquentielle × 5 concurrents (sleep 500ms entre chaque) :
   POST /metriques → séquence SEO 5 étapes + DataForSEO Maps (parallèle)
   Enrichissement : si séquence retourne 0 ET haloscan_match.keywords > 0
     → metriques.total_keywords = haloscan_match.keywords
     → metriques.source_seo = 'haloscan_competitors'

4. haloscan_suggestions : concurrents Haloscan non proposés par OpenAI (max 3)
5. enregistrerCoutsBloc() → Supabase fire & forget
→ statut: 'en_attente_validation'
```

**Séquence SEO 5 étapes** (dans `metriques/route.ts`) :
```
Étape 1 — Haloscan domains/overview domaine nu
Étape 2 — Haloscan domains/overview www.domaine
Étape 3 — Haloscan domains/positions (lineCount: 1 — vérification existence)
           ⚠️ total_traffic = 0 (non disponible sans charger tous les résultats)
Étape 4 — DataForSEO ranked_keywords/live domaine nu (limit: 1)
Étape 5 — DataForSEO ranked_keywords/live www.domaine
→ site_non_indexe: true UNIQUEMENT si toutes les 5 étapes retournent 0
```

⚠️ **Parsing DataForSEO ranked_keywords pour métriques domaine** :
```javascript
// ✅ CORRECT — métriques globales du domaine (pas les keywords individuels)
const result = response.data?.tasks?.[0]?.result?.[0]
const organic = result?.metrics?.organic   // ← niveau metrics.organic (pas items[0])
// Champs : organic.count (total_keywords), organic.etv (trafic estimé)

// ❌ FAUX — items[0] est un keyword individuel, pas les stats globales
const organic = result?.items?.[0]?.metrics?.organic
```

**Haloscan siteCompetitors** :
- Endpoint : `POST https://api.haloscan.com/api/domains/siteCompetitors`
- Payload : `{ input: domaine_ot, mode: 'root', lineCount: 10 }`
- Retourne : `results[{ root_domain, common_keywords, total_traffic, keywords_vs_max, missed_keywords, bested, keywords }]`
- `missed_keywords` = keywords du concurrent absents de la destination → gap potentiel pour la synthèse
- Matching domaine : `.includes()` dans les deux sens (ex: `ot-chamonix.com` vs `chamonix.com`)

**Pause UI** — l'utilisateur peut supprimer un concurrent incohérent (pas en ajouter)

**Flux Phase B** (après validation) :
```
1. Construction tableau_comparatif (destination cible + concurrents validés)
2. insight_gap : si haloscan_match.missed_keywords > 1000 → string transmise à OpenAI
   (en dessous de 1000 : trop peu significatif)
3. POST /synthese → OpenAI + insight_gap optionnel
4. enregistrerCoutsBloc() → Supabase (coûts agrégés Phase A + B)
→ statut: 'termine'
```

**SourceSEO — type union** :
```typescript
type SourceSEO = 'haloscan' | 'haloscan_positions' | 'haloscan_competitors' | 'dataforseo_ranked' | 'inconnu'
// 'haloscan_positions' : Haloscan positions (trafic = 0)
// 'haloscan_competitors' : données issues de siteCompetitors (séquence SEO à 0 mais match trouvé)
// 'dataforseo_ranked'    : ranked_keywords/live (remplace domain_rank_overview)
// 'inconnu' + site_non_indexe: true : toutes les 5 étapes épuisées → vrai 0 confirmé
```

**Piège critique — filtre subdivisions** :
- OpenAI propose systématiquement des communes-associées (ex: "Annecy-le-Vieux" quand destination = "Annecy")
- Double protection : instruction dans le prompt + filtre dur côté code (normalisé sans accents)
- OpenAI demande 6 candidats pour compenser le filtre → `.slice(0, 5)` en sortie

**`taux_dependance_ota` — valeur brute, pas pourcentage** :
- Vaut `(airbnb + booking) / hebergements_physiques` → ex: 9.8x (pas 9.8%)
- Dans le prompt synthèse : `taux_dependance_ota.toFixed(1)}x` — ne jamais multiplier par 100

**Tests validés — Annecy (v2, 2026-02-25)** :
| Concurrent | Keywords | Trafic | Note Google | Source SEO | Indexé |
|---|---|---|---|---|---|
| Chamonix-Mont-Blanc | 70 755 | 176 206 | 4.4/5 (1866 avis) | haloscan | ✅ |
| Évian-les-Bains | 36 | 4 | 4.3/5 (749 avis) | haloscan | ✅ |
| Aix-les-Bains | 0 | 0 | 4.3/5 (553 avis) | inconnu | ❌ (5 sources) |
| Saint-Gervais-les-Bains | 27 788 | 40 577 | 4.3/5 (361 avis) | haloscan | ✅ |
| La Clusaz | 24 322 | 1 016 314 | 4.1/5 (154 avis) | haloscan | ✅ |

Position globale Annecy : **LEADER** (53 842 kw / 161 645 visites)
Durée Phase A : 46s | Coût total : 0.143€

> **Note v2 vs v1** : Chamonix (0→70 755 kw) et Saint-Gervais (0→27 788 kw) désormais correctement indexés grâce à la séquence 5 étapes. La Clusaz remplace Annecy-le-Vieux (filtré). Aix-les-Bains reste non indexé — confirmé par 5 sources.

**Coût du bloc** :
```
OpenAI identification (1 appel)             : 0.001€
Haloscan siteCompetitors (1 appel)          : 0.010€
Haloscan overview (5-10 appels étapes 1-2)  : 0.050-0.100€
Haloscan positions (0-5 appels étape 3)     : 0-0.050€
DataForSEO ranked (0-10 appels étapes 4-5)  : 0-0.060€
DataForSEO Maps (5 appels)                  : 0.030€
DataForSEO SERP validation (0-5 appels)     : 0-0.030€
OpenAI synthèse (1 appel)                   : 0.001€
TOTAL cas typique (Annecy)                  : 0.143€
```

#### Migration OpenAI : gpt-4o-mini → gpt-5-mini ✅ (2026-02-25)

**Périmètre** : tous les appels OpenAI des blocs 1 à 7 (14 fichiers route.ts + lib/blocs/*.ts).

**Model string** : `gpt-5-mini` (modèle le plus économique de la famille GPT-5)

**Tarification** :
| Modèle | Input | Output | Coût estimé/appel |
|---|---|---|---|
| gpt-4o-mini (ancien) | $0.15/1M tokens | $0.60/1M tokens | ~0.001€ |
| **gpt-5-mini** | $0.25/1M tokens | **$2.00/1M tokens** | ~0.003€ |

⚠️ Output 3.3× plus cher — budget OpenAI par audit passe de ~0.01-0.02€ à ~0.03-0.06€.

**Fichiers modifiés** :
- `lib/api-costs.ts` : clé renommée `openai_gpt5_mini`, valeur `0.001` → `0.003`
- Toutes les références `openai_gpt4o_mini` dans les orchestrateurs lib/blocs/*.ts → `openai_gpt5_mini`
- `.claude/CLAUDE.md` : 2 occurrences mises à jour

---

### Phase 3A — Fondations UX ✅ TERMINÉE (2026-02-25)

**Objectif** : mettre en place toute l'interface utilisateur de l'app — design tokens, auth, navigation et les 4 pages principales.

#### Packages installés
```bash
npm install tailwindcss@3 postcss autoprefixer @supabase/ssr
```

#### Design tokens (`ressources/design-tokens.md`)
Extraits de la charte graphique Valraiso 2026. Référence pour toute l'UI — aucune valeur hardcodée dans les composants.

| Token Tailwind | Hex | Rôle |
|---|---|---|
| `brand-orange` | `#E84520` | Orange ADN — CTA, logo, accents |
| `brand-orange-light` | `#F4A582` | Peach — badges secondaires |
| `brand-purple` | `#6B72C4` | Bleu-violet — data, technologie |
| `brand-yellow` | `#F5B731` | Jaune — KPIs positifs |
| `brand-cream` | `#FAF0DC` | Crème — fonds doux |
| `brand-navy` | `#1A2137` | Bleu nuit — textes, titres |
| `brand-bg` | `#F3F5FA` | Background général app |
| `status-success/warning/error/info` | vert/amber/rouge/bleu | Statuts audit |

**Seuils KPI jauges :**
- Note Google : vert ≥ 4.2 / orange ≥ 3.8 / rouge < 3.8
- Score gap : vert ≥ 7/10 / orange ≥ 4 / rouge < 4
- Score visibilité OT : vert ≥ 3/5 / orange 2 / rouge ≤ 1
- PageSpeed mobile : vert ≥ 70 / orange ≥ 50 / rouge < 50

#### Fichiers créés

```
tailwind.config.ts               ← Tokens couleurs, animations, ombres
postcss.config.js                ← Tailwind v3 + autoprefixer
app/globals.css                  ← Base + .btn-primary/.btn-secondary/.card/.input-base/.gauge-bar

lib/supabase/client.ts           ← createBrowserClient (Realtime + auth côté client)
lib/supabase/server.ts           ← createServerClient + createServiceClient (bypass RLS)
lib/supabase/middleware.ts       ← updateSession() pour le middleware

middleware.ts                    ← Routes protégées, / → /dashboard, redirect login si non-auth

components/layout/Navbar.tsx     ← Logo SVG Valraiso + email utilisateur + déconnexion (client)
components/ui/StatusBadge.tsx    ← Badge coloré avec spinner pour 'en_cours'
components/ui/KpiCard.tsx        ← Gros chiffre + jauge vert/orange/rouge selon seuils
components/ui/ExpandableSection.tsx  ← Section dépliable, chevron animé
components/ui/CopyButton.tsx     ← Copie presse-papier + feedback "Copié !" 2s
components/ui/Modal.tsx          ← Modale bloquante, overlay, Échap optionnel
components/ui/Spinner.tsx        ← SVG animé sm/md/lg

app/layout.tsx                   ← RootLayout : globals.css + Navbar avec session serveur
app/login/page.tsx               ← Auth email/password, redirect post-login

app/dashboard/page.tsx           ← Server Component — grille cards destinations+audits
app/audit/nouveau/page.tsx       ← Autocomplete commune + doublon + lancement
app/audit/[id]/progression/page.tsx  ← Montagne SVG + skieur + Supabase Realtime
app/audit/[id]/resultats/page.tsx    ← Server Component — charge audit + normalise
app/audit/[id]/resultats/ResultatsClient.tsx  ← Sidebar scroll spy + 7 blocs + coûts

app/api/destinations/check/route.ts  ← GET ?insee= → vérifie doublon en base
app/api/audits/lancer/route.ts       ← POST → UPSERT destination + INSERT/UPDATE audit
```

#### Ce qu'on voit sur chaque écran

**`/login`** : formulaire email/password centré avec fond dégradé, logo Valraiso, gestion d'erreur inline. Redirect vers `/dashboard`.

**`/dashboard`** : grille responsive de cards destinations. Chaque card = nom + département + date + badge statut + coût total + 3 KPIs avec jauges (note Google, keywords SEO, score gap). État vide = illustration montagne + bouton "Premier audit". Bouton "Nouvel audit" en haut à droite.

**`/audit/nouveau`** : panneau health check en haut (vert/orange/rouge par service) + bouton "Revérifier". Champ recherche autocomplete (debounce 300ms, min 2 chars) → microservice `/communes` uniquement (⚠️ plus de fallback `geo.api.gouv.fr`). Dropdown suggestions (nom + CP + département + SIREN). Sélection → vérification doublon via `/api/destinations/check`. Doublon → modale avec date du dernier audit + choix relancer/annuler. Panel confirmation avec tous les champs dont SIREN. Bouton "Lancer l'audit" → désactivé si services critiques down OU SIREN invalide → `/api/audits/lancer` → redirect progression.

**`/audit/[id]/progression`** : animation montagne SVG avec 7 étapes marquées, skieur SVG pur qui monte de la base vers le sommet. Skieur pulse (animation CSS) si bloc `en_attente_validation`. Liste des 7 blocs avec statut temps réel via Supabase Realtime (postgres_changes sur `audits` filtré par `id`). Alerte orange + bouton "Valider" si validation requise. Modale placeholder Phase 3B pour blocs 4 et 7. Coût cumulé en bas. Bouton "Voir les résultats" quand tout est terminé.

**`/audit/[id]/resultats`** : sidebar fixe gauche (w-64) avec liste des 7 blocs, scroll spy (IntersectionObserver), point vert si données présentes, coût par bloc. Onglet "Coûts API" en bas = tableau détaillé par API. Contenu principal = 7 sections avec KpiCards + ExpandableSections + texte OpenAI + CopyButton. Chaque bloc gère le cas "données absentes" avec un placeholder dashed.

#### Patterns techniques à retenir

**Normalisation FK Supabase** : `.select()` avec relation retourne un tableau même avec `.single()` :
```typescript
destinations: Array.isArray(audit.destinations)
  ? audit.destinations[0]
  : audit.destinations
```

**Calcul coût couts_api JSONB** : incohérence entre `total` et `total_bloc` selon les blocs :
```typescript
const t = bloc.total ?? bloc.total_bloc ?? 0
```

**Extraction statuts blocs depuis resultats JSONB** :
```typescript
if (data.statut === 'en_attente_validation') → 'en_attente_validation'
else if (data.erreur) → 'erreur'
else (clé présente) → 'termine'
// clé absente → 'en_attente'
```

**Supabase Realtime** : uniquement côté client (page progression). Les Server Components ne supportent pas le Realtime.

#### Bugs préexistants corrigés au passage
| Fichier | Correction |
|---|---|
| `app/api/blocs/visibilite-seo/serp-transac/route.ts` | `export function` → `function` (export non-valide dans Route Handler) |
| `app/api/blocs/visibilite-seo/synthese/route.ts` | Suppression annotation de type trop stricte sur `top_5_opportunites` |
| `lib/blocs/stock-en-ligne.ts` | Cast `as unknown as typeof synthese` pour `SyntheseBloc6` |
| `microservice/routes/bbox.ts` | Conditionnel undefined sur `data.contour?.coordinates?.[0]` |

#### État en fin de Phase 3A
- ✅ `npx next build` passe sans erreur
- ✅ Tailwind configuré avec tous les tokens Valraiso
- ✅ Auth Supabase fonctionnelle (login, middleware, session SSR + client)
- ✅ 4 pages UI complètes (dashboard, nouveau, progression, résultats)
- ✅ 6 composants UI réutilisables
- ✅ Seed Annecy permet de visualiser tous les blocs sans lancer de vrai audit
- ✅ Phase 3B : orchestrateur + modales de validation blocs 4 et 7 + panneau logs — voir section Phase 3B ci-dessous

---

### Tests navigateur validés (2026-02-25)

Serveur dev lancé sur **localhost:3002** (port 3000 occupé par autre processus).
Compte admin créé via `supabase.auth.admin.createUser` : `admin@valraiso.fr` / `Valraiso2026!`.

| Test | URL | Résultat |
|------|-----|----------|
| Login | `/login` | ✅ Auth Supabase OK — redirect `/dashboard` |
| Dashboard | `/dashboard` | ✅ Card Annecy visible avec statut + KPIs |
| Autocomplete | `/audit/nouveau` | ✅ Suggestions via geo.api.gouv.fr |
| Progression | `/audit/20000000-0000-0000-0000-000000000001/progression` | ✅ Montagne SVG + étapes vertes |
| Résultats | `/audit/20000000-0000-0000-0000-000000000001/resultats` | ✅ 7 blocs + sidebar scroll spy |

**Correctif appliqué pendant les tests** : `app/audit/nouveau/page.tsx`
- Le champ "Région" affichait le code numérique (`84`) au lieu du nom.
- Ajout d'une `REGIONS_FR: Record<string, string>` (18 régions) + champ optionnel `nomRegion` dans l'interface `Commune`.
- Ajout de `nomRegion` dans les fields des appels `geo.api.gouv.fr`.
- Affichage : `selected.nomRegion || REGIONS_FR[selected.codeRegion] || selected.codeRegion`.

---

### Améliorations UX post-tests (2026-02-25)

#### SVG Montagne progression — redesign complet
Fichier : `app/audit/[id]/progression/page.tsx`

- Remplacement de la montagne unique par un **profil panoramique 7 pics** (`viewBox 0 0 900 250`).
- Chaque pic correspond à un bloc d'audit (de gauche à droite).
- Coordonnées `PICS_SVG` (sommets) + `CRETE_SVG` (profil complet avec vallées) définies en constantes globales.
- Fond ciel `#EEF3F9`, massif principal gradient bleu `#7AAAC8→#4E7E9E`, plan arrière semi-transparent.
- Neige blanche elliptique sur chaque sommet.
- Cercles de statut numérotés 1–7 au sommet de chaque pic (vert ✓ / bleu pulsé / orange ! / rouge).
- **Skieur ⛷️** positionné au sommet du dernier bloc terminé. Miroir horizontal via `transform="scale(-1, 1)"` pour qu'il monte vers la droite.
- Skieur `animate-pulse` si un bloc est en attente de validation.

#### Composant CoutTooltip
Fichier : `components/ui/CoutTooltip.tsx`

- Icône `i` circulaire (16×16) discrète, qui passe en orange au survol.
- Tooltip `bg-brand-navy` avec montant `.toFixed(4) €` + flèche pointant vers le bas.
- Prop optionnelle `label` pour préfixer le montant dans le tooltip.
- Appliqué partout où des coûts API apparaissent :

| Emplacement | Comportement |
|------------|-------------|
| Progression — ligne de chaque bloc | Icône `i` remplace le texte brut |
| Progression — Coût cumulé | Montant visible + `i` à côté |
| Résultats — sidebar par bloc | Icône `i` remplace le texte brut |
| Résultats — bouton "Coûts API" | Montant total visible + `i` à côté |
| Résultats — en-tête de chaque bloc | Icône `i` remplace le texte brut |
| Onglet Coûts API | Inchangé (tableau détaillé — c'est sa raison d'être) |

#### Assets SVG officiels Valraiso — Navbar + Login (2026-02-25)

Fichiers source : `ressources/` (inline dans TSX — pas de `/public/`, pas de requête HTTP supplémentaire).

**Fichiers modifiés** :
- `components/layout/Navbar.tsx` — logo officiel
- `app/login/page.tsx` — logo + décorations fond

**Navbar** :
- Icône `Icon-Valraiso.svg` inlinée (32×32) : rectangle arrondi crème `#fff7ee` + A orange `#ff450b`
- Wordmark `Logo-Valraiso-blanc.svg` : paths blancs, viewBox cropée `285 88 600 158` (texte seul, sans icône)
- Séparateur `/ Audit Digital` conservé

**Login** :
- Logo `Logo-Valraiso-couleurs.svg` centré (viewBox `60 85 820 168`, `h-12`) : texte navy `#18152b` + A orange `#ff450b`
- Décorations fond supprimées (gérées par le layout global — voir ci-dessous)

#### Fond décoratif global — `app/layout.tsx` (2026-02-25)

Les SVG décoratifs sont placés dans le layout racine en couche `fixed z-0`, derrière tout le contenu. Ils s'affichent sur **toutes les pages** de façon cohérente.

- `Chemin-plein.svg` — haut-droite, `w-[520px]`, `opacity-[0.055]`, `-top-32 -right-52`
- `Chemin-pointillé-orange.svg` — bas-gauche, `w-[420px]`, `opacity-[0.18]`, `-bottom-48 -left-36`
- Couche `fixed inset-0 overflow-hidden pointer-events-none z-0`
- Navbar : `z-50` (sticky) — au-dessus du fond
- `<main>` : `relative z-10` — au-dessus du fond

---

### Phase 3B — Orchestrateur principal + Observabilité ✅ TERMINÉE (2026-02-25)

**Objectif** : orchestrateur principal séquentiel, pauses de validation interactives, observabilité temps réel via `audit_logs`.

#### Architecture — 3 segments

L'audit est découpé en **3 segments** séparés pour gérer les deux pauses de validation :

```
Segment A (maxDuration=300) : Blocs 1 → 2 → 3 → 4 Phase A   [séquentiel strict]
            → pause : bloc4 = 'en_attente_validation'

Segment B (maxDuration=300) : Bloc 4 Phase B → Bloc 5 → Bloc 7 Phase A   [séquentiel strict]
            → pause : bloc7 = 'en_attente_validation'
            ⚠️ Bloc 6 retiré du Segment B — déplacé dans Segment C

Segment C (maxDuration=300) : Bloc 6 → Bloc 7 Phase B   [séquentiel strict]
            → statut global : 'termine'
            ⚠️ maxDuration passé à 300 (Playwright Bloc 6 peut prendre 3-4 min)
```

#### Table `audit_logs` (créée Phase 3B)

```sql
CREATE TABLE public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id    UUID        REFERENCES public.audits(id) ON DELETE CASCADE,
  bloc        TEXT,
  niveau      TEXT NOT NULL CHECK (niveau IN ('info', 'warning', 'error')),
  message     TEXT NOT NULL,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_audit_id ON public.audit_logs USING btree (audit_id);
CREATE INDEX idx_audit_logs_niveau ON public.audit_logs USING btree (niveau);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_select_authenticated" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
```

#### Structure `blocs_statuts` dans `audits.resultats`

Clé `blocs_statuts` ajoutée dans `audits.resultats` — source de vérité de l'orchestrateur :

```typescript
type StatutBloc = 'en_attente' | 'en_cours' | 'termine' | 'en_attente_validation' | 'erreur'
// Valeurs : bloc1..bloc7 → StatutBloc
```

Les coûts de l'orchestrateur sont stockés dans `couts_api` sous `bloc1`..`bloc7` (clés distinctes des clés internes des blocs comme `positionnement`, `schema_digital` etc.).

#### Fichiers créés

**Librairie orchestrateur** :
```
lib/orchestrateur/
├── blocs-statuts.ts      → Types StatutBloc, BlocsStatuts, ParamsAudit, ResultatBloc
├── logger.ts             → logInfo / logWarning / logError → audit_logs (fire & forget)
├── supabase-updates.ts   → mettreAJourBloc, mettreAJourStatutAudit, lireParamsAudit,
│                           lireBlocsStatuts, initialiserBlocsStatutsEnBase,
│                           lireDomaineOT (NOUVEAU — lecture rapide depuis resultats.schema_digital)
│                           ⚠️ Merge JSONB manuel (read → merge → write) — pas d'opérateur ||
└── wrappers/
    ├── bloc1.ts  → auditPositionnement() + normalisation hashtag
    ├── bloc2.ts  → lancerBlocVolumeAffaires()
    ├── bloc3.ts  → lancerBlocSchemaDigital()
    ├── bloc4.ts  → lancerPhaseA() + lancerPhaseB() (lit couts_phase_a depuis Supabase)
    ├── bloc5.ts  → lancerBlocStocksPhysiques()
    ├── bloc6.ts  → lancerBlocStockEnLigne() (croise avec Bloc 5 via Supabase)
    └── bloc7.ts  → lancerPhaseAConcurrents() + lancerPhaseBConcurrents()
                    (construit ContexteAuditPourConcurrents depuis blocs 1-6 en parallèle)
```

**Route Handlers** :
```
app/api/orchestrateur/
├── segment-a/route.ts  → POST { audit_id } — Blocs 1→2→3→4A
├── segment-b/route.ts  → POST { audit_id, keywords_valides[] } — Blocs 4B→5→7A
├── segment-c/route.ts  → POST { audit_id, concurrents_valides[] } — Blocs 6→7B
└── statut/route.ts     → GET ?audit_id= — polling fallback Realtime
```

**Health check** :
```
app/api/health/route.ts → GET /api/health
  Services critiques (bloquants) : microservice_local, supabase, openai, dataforseo
  Services optionnels (warning)  : haloscan, apify
  Timeout par service : 5s
  Retourne : { ok: boolean, services: { [nom]: { ok, critique, message } } }
```

Tous avec `export const runtime = 'nodejs'` (Playwright dans Bloc 6).

#### Page progression — mises à jour Phase 3B

`app/audit/[id]/progression/page.tsx` :
- **Déclenchement automatique Segment A** : `useEffect` sur `audit.statut === 'en_cours'` + tous blocs `en_attente` → `fetch /api/orchestrateur/segment-a` (ref pour éviter double déclenchement StrictMode)
- **Supabase Realtime logs** : nouveau channel sur `audit_logs` filtré par `audit_id` → s'ouvre automatiquement si erreur
- **Modale keywords Bloc 4** : tableau interactif avec checkbox, pré-cochage `gap && intent_transactionnel`, colonnes keyword/volume/catégorie/gap/transac → `POST /api/orchestrateur/segment-b`
- **Modale concurrents Bloc 7** : tableau des 5 concurrents + bouton supprimer + section `haloscan_suggestions` → `POST /api/orchestrateur/segment-c`
- **Panneau logs dépliable** (fermé par défaut, s'ouvre sur erreur) : timestamp + bloc + niveau + message + bouton Détail (JSON indenté) + bouton **"Copier pour Claude"** sur chaque erreur
- **Extraction blocs_statuts** : priorité à `resultats.blocs_statuts` (orchestrateur), fallback sur déduction depuis `resultats` (compatibilité)

#### Idempotence et robustesse

- Chaque segment vérifie le statut avant d'agir — `409 Conflict` si déjà dans le bon état
- Ref `segmentALanceRef` → Segment A ne peut être lancé qu'une fois même en StrictMode
- Erreurs de blocs non bloquantes — `logError` + statut `erreur` + l'audit continue
- Retour sur la page progression → détecte l'état en cours et affiche le bon statut sans relancer

#### Coûts estimés pour Chamonix-Mont-Blanc

| Segment | Durée estimée | Coût estimé |
|---------|---------------|-------------|
| Segment A (Blocs 1-4A) | 8-12 min | 0.80-1.20 € |
| Segment B (Blocs 4B-7A) | 15-25 min | 1.50-2.50 € |
| Segment C (Bloc 7B) | 2-3 min | 0.05 € |
| **Total** | **25-40 min** | **~2.50-3.80 €** |

### Correctifs post-Phase 3B (2026-02-25)

#### 1. Middleware — Routes API non authentifiées

`middleware.ts` : les routes `/api/*` ne sont plus redirigées vers `/login`.

**Problème** : les blocs appelaient des sous-routes via `fetch('http://localhost:3000/api/blocs/...')` sans cookies d'auth → le middleware retournait du HTML → `JSON.parse` échouait.

**Correction** :
```typescript
// Ajouté AVANT le check !user
if (pathname.startsWith('/api/')) {
  return supabaseResponse
}
```

#### 2. Page progression — Polling actif (remplacement Realtime)

Supabase Realtime `postgres_changes` ne fonctionnait pas de façon fiable en local. Remplacé par un **polling toutes les 3s** via `/api/orchestrateur/statut`.

**Comportements ajoutés** :
- Logs existants chargés au montage (pas seulement les nouveaux via INSERT)
- Déduplication des logs (polling + Realtime peuvent ramener le même log)
- `nomDestinationRef` : ref pour préserver le nom de destination (absent du payload Realtime)
- Supabase Realtime conservé en bonus si disponible
- Polling s'arrête automatiquement quand `statut === 'termine'`

#### 3. Page résultats — Lien "← Progression"

`app/audit/[id]/resultats/ResultatsClient.tsx` : lien "← Progression" ajouté dans la sidebar, sous "← Dashboard", pointant vers `/audit/[id]/progression`.

### Correctifs Session 2 post-Phase 3B (2026-02-25)

#### 1. Cause racine 0 keywords — `dataforseo-ranked` retournait 400

**Problème** : si `domaine_ot` est absent (Bloc 3 n'a pas détecté le site OT), `dataforseo-ranked/route.ts` retournait HTTP 400. L'orchestrateur Phase A (`appelRoute`) levait alors une exception → `ranked_result = null` → la Phase A loggait `throw new Error('DataForSEO ranked_keywords indisponible')` → le `catch` retournait `keywords_classes: []`.

**Cascade complète** :
```
domaine_ot null (Bloc 3 SITE_NOT_FOUND)
  → dataforseo-ranked 400
    → appelRoute throw
      → ranked_result = null
        → throw 'ranked_keywords indisponible'
          → catch → keywords_classes: []
            → modal bloquée (keywordsPhaseA.length > 0)
              → Phase B jamais lancée
```

**Correction** (`app/api/blocs/visibilite-seo/dataforseo-ranked/route.ts`) :
```typescript
// Domaine OT absent → résultats vides, pas d'erreur bloquante
if (!domaine_ot) {
  return NextResponse.json({
    keywords_positionnes_ot: [],
    trafic_capte_estime: 0,
    cout: { nb_appels: 0, cout_unitaire: API_COSTS.dataforseo_ranked, cout_total: 0 },
  })
}
```

#### 2. Cascade tolérée — pipeline Phase B avec keywords vides

Trois routes retournaient 400 sur liste vide → corrigées pour retourner résultats vides :

| Fichier | Ancien comportement | Nouveau comportement |
|---------|--------------------|--------------------|
| `app/api/blocs/visibilite-seo/serp-transac/route.ts` | 400 si `keywords_classes` vide | Retourne `{ serp_results: [], keywords_analyses: [], cout: {...} }` |
| `app/api/blocs/visibilite-seo/synthese/route.ts` | 400 si `keywords_classes` absent | Accepte liste vide (seuls `destination` + `domaine_ot` obligatoires) |
| `app/api/orchestrateur/segment-b/route.ts` | 400 si `keywords_valides.length === 0` | Tolère le tableau vide — Phase B calcule le gap sans keywords SERP |

#### 3. Modal Bloc 4 — condition d'affichage corrigée

**Problème** : la condition `{validationBloc === 'visibilite_seo' && keywordsPhaseA.length > 0 && (` bloquait l'affichage de la modale quand `keywords_classes` était vide.

**Corrections** (`app/audit/[id]/progression/page.tsx`) :
- Supprimé `&& keywordsPhaseA.length > 0` de la condition de rendu
- Ajouté dans `ModalValidationKeywords` un état "zéro keyword" avec message d'alerte et bouton "Continuer sans keywords"
- Supprimé le guard `if (valides.length === 0) return` dans `handleConfirm()`

#### 4. Instrumentation diagnostique — tous les wrappers

`logInfo` ajouté dans chaque wrapper et dans `lireParamsAudit` pour diagnostiquer les valeurs réelles en cours d'audit :

| Fichier | Métriques loggées |
|---------|------------------|
| `lib/orchestrateur/wrappers/bloc1.ts` | note_ot, nb_avis_ot, posts_count_instagram, axe_principal, cout_bloc |
| `lib/orchestrateur/wrappers/bloc2.ts` | montant_taxe_euros, type_collecteur, nuitees_estimees, source_donnee, cout_bloc |
| `lib/orchestrateur/wrappers/bloc3.ts` | domaine_ot_detecte, score_visibilite_ot, nb_top3_officiels, haloscan_total_keywords, nb_serp_fusionne |
| `lib/orchestrateur/wrappers/bloc4.ts` | **domaine_ot_utilise** (VIDE si absent), nb_keywords_classes, nb_gaps, volumes + **alerte ANOMALIE si 0 keywords** |
| `lib/orchestrateur/wrappers/bloc5.ts` | total_hebergements, total_activites, total_stock_physique, source_donnee |
| `lib/orchestrateur/wrappers/bloc6.ts` | airbnb_total, booking_total, taux_dependance_ota, taux_reservable_direct |
| `lib/orchestrateur/wrappers/bloc7.ts` | Phase A : nb_concurrents, position_globale / Phase B : nb_concurrents_valides, score_comparatif, synthese_ok |
| `lib/orchestrateur/supabase-updates.ts` | `lireParamsAudit` : nom, code_insee, domaine_ot, domaine_ot_source (bloc3_detecte ou null) |

⚠️ `lireParamsAudit` est appelé deux fois dans Segment A — le **second appel** (après Bloc 3) est le critique : il doit afficher `domaine_ot_source: 'bloc3_detecte'` et une valeur non nulle.

### Correctifs Session 3 — Compatibilité GPT-5-mini (2026-02-26)

#### Contexte

L'erreur `[OpenAI] Erreur appel API : AxiosError 400` sur Bloc 1 (et tous les blocs OpenAI) n'était pas liée au nom du modèle `gpt-5-mini` (qui existe bien sur ce compte), mais à deux paramètres API devenus incompatibles avec les modèles GPT-5.

#### Problème 1 — `max_tokens` non supporté

GPT-5-mini rejette le paramètre `max_tokens` avec :
```json
{ "error": { "message": "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." } }
```

**Correction** : remplacer `max_tokens` par `max_completion_tokens` dans les 13 `logic.ts` concernés.

#### Problème 2 — `temperature` non supporté (valeur ≠ 1)

GPT-5-mini rejette `temperature: 0.2` avec :
```json
{ "error": { "message": "Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported." } }
```

**Correction** : supprimer le paramètre `temperature` dans les mêmes 13 `logic.ts`.

#### Fichiers modifiés (13 logic.ts)

`positionnement/openai`, `positionnement/poi-selection`, `schema-digital/classification`, `schema-digital/analyse-ot`, `schema-digital/openai`, `visibilite-seo/classification`, `visibilite-seo/synthese`, `volume-affaires/melodi`, `volume-affaires/openai`, `stocks-physiques/synthese`, `stock-en-ligne/synthese`, `concurrents/identification`, `concurrents/synthese`

#### Problème 3 — `max_completion_tokens` trop bas → réponse vide tronquée

GPT-5-mini est un **modèle de raisonnement** : il consomme des tokens en interne (reasoning tokens) avant de produire la réponse visible. Avec des valeurs basses (300-1500), la quasi-totalité des tokens est absorbée par le raisonnement interne → la réponse visible est vide → `JSON.parse("")` lève `SyntaxError: Unexpected end of JSON input`.

**Exemple observé** (classification simple, 3 URLs) :
```json
"usage": {
  "completion_tokens": 675,
  "completion_tokens_details": { "reasoning_tokens": 576 }
}
```
576 tokens de raisonnement pour seulement 99 tokens de réponse visible.

**Correction** : porter toutes les valeurs à 8 000 (réponses standard) ou 16 000 (classifications complexes).

| Fichier | Ancienne valeur | Nouvelle valeur |
|---------|----------------|----------------|
| `positionnement/openai` | 400 | 8 000 |
| `positionnement/poi-selection` | 200 | 8 000 |
| `schema-digital/analyse-ot` | 300 | 8 000 |
| `schema-digital/classification` | 1 500 | **16 000** |
| `schema-digital/openai` | 500 | 8 000 |
| `stock-en-ligne/synthese` | 600 | 8 000 |
| `stocks-physiques/synthese` | 600 | 8 000 |
| `visibilite-seo/classification` | 4 000 | **16 000** |
| `visibilite-seo/synthese` | 1 500 | 8 000 |
| `volume-affaires/melodi` | 300 | 8 000 |
| `volume-affaires/openai` | 500 | 8 000 |
| `concurrents/identification` | 1 200 | **16 000** |
| `concurrents/synthese` | 800 | 8 000 |

#### Règle à retenir pour GPT-5 et GPT-5-mini

| Paramètre | GPT-4o-mini | GPT-5-mini |
|-----------|------------|------------|
| `max_tokens` | ✅ | ❌ → utiliser `max_completion_tokens` |
| `temperature` | ✅ (0-2) | ❌ sauf valeur par défaut (1) — supprimer le param |
| `max_completion_tokens` valeur basse | ✅ (tokens = output seul) | ❌ → minimum 8 000 (reasoning interne ~80% des tokens) |

---

### Phase 3C — Fix architecture : suppression appels HTTP auto-référentiels ✅ TERMINÉE (2026-02-26)

#### Problème identifié — deadlock auto-référentiel

Les `lib/blocs/*.ts` (exécutés depuis l'orchestrateur, lui-même un Route Handler Next.js) appelaient leurs propres APIs via `fetch('http://localhost:3000/api/blocs/...')`. Ces appels **échouaient silencieusement** dans le serveur dev Node.js (deadlock du même processus). Le `catch` global de chaque wrapper retournait des résultats vides, déclenchant une cascade sur tous les blocs en aval.

**Symptôme observable** : Bloc 3 terminé en ~6s au lieu de ~53s (les vrais appels DataForSEO prennent 50s+). L'exception était attrapée immédiatement sans appel réseau réel.

**Cascade complète** :
```
lib/blocs/schema-digital.ts
  → fetch('http://localhost:3000/api/blocs/schema-digital/serp')  ← DEADLOCK
    → catch immédiat → domaine_ot_detecte: null
      → Bloc 4 : domaine vide → 0 keywords
        → Bloc 6/7 : données incomplètes
```

#### Solution — extraction logic.ts

Pour chaque route, extraire la logique métier dans un `logic.ts` colocalisé. Les `lib/blocs` importent `logic.ts` directement (import TypeScript) au lieu de passer par HTTP.

```
AVANT :
  lib/blocs/schema-digital.ts
    → fetch('http://localhost:3000/api/blocs/schema-digital/serp')
        → route.ts → DataForSEO

APRÈS :
  lib/blocs/schema-digital.ts
    → import { executerSERP } from '@/app/api/blocs/schema-digital/serp/logic'
        → logic.ts → DataForSEO directement

  route.ts (conservé inchangé pour les appels front) :
    → import { executerSERP } from './logic'
    → NextResponse.json(await executerSERP(body))
```

#### 24 fichiers logic.ts créés

| Bloc | Routes | Fonctions exportées |
|------|--------|-------------------|
| **Bloc 3 — Schema Digital** | serp, classification, haloscan, domain-analytics, pagespeed, analyse-ot, openai | `executerSERP`, `executerClassification`, `executerHaloscan`, `executerDomainAnalytics`, `executerPageSpeed`, `executerAnalyseOT`, `executerOpenAISchemaDigital` |
| **Bloc 1 — Positionnement** | poi, poi-selection, maps, instagram, openai | `executerPOI`, `executerPOISelection`, `executerMaps`, `executerInstagram`, `executerOpenAIPositionnement` |
| **Bloc 2 — Volume Affaires** | epci, taxe, epci-communes, melodi, openai | `executerEPCI`, `executerTaxe`, `executerEPCICommunes`, `executerMelodi`, `executerOpenAIVolumeAffaires` |
| **Bloc 4 — Visibilité SEO** | haloscan-market, dataforseo-related, dataforseo-ranked, classification, serp-transac, synthese | `executerHaloscanMarket`, `executerDataForSEORelated`, `executerDataForSEORanked`, `executerClassificationSEO`, `executerSERPTransac`, `executerSyntheseVisibiliteSEO` |
| **Bloc 5 — Stocks Physiques** | datatourisme, sirene, synthese | `executerDataTourisme`, `executerSIRENE`, `executerSyntheseStocksPhysiques` |
| **Bloc 6 — Stock En Ligne** | synthese | `executerSyntheseStockEnLigne` |
| **Bloc 7 — Concurrents** | identification, metriques, synthese | `executerIdentificationConcurrents`, `executerMetriquesConcurrents`, `executerSyntheseConcurrents` |

#### Patron appliqué — logic.ts

```typescript
// logic.ts — corps extrait du handler POST()
export async function executerXXX({ param }: { param: string }) {
  // Logique métier ex-route.ts
  // throw new Error(...) à la place de NextResponse.json({ error }, { status: 4xx })
  // return data directement à la place de NextResponse.json(data)
}
```

```typescript
// route.ts — thin wrapper HTTP
import { executerXXX } from './logic'
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    return NextResponse.json(await executerXXX(body))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

#### 9 fichiers lib/blocs mis à jour

Dans chaque fichier : suppression de `BASE_URL` + `appelRoute<T>()`, remplacement par imports directs.

| Fichier | Appels remplacés |
|---------|-----------------|
| `lib/blocs/schema-digital.ts` | 7 appelRoute → 7 imports logic.ts |
| `lib/blocs/positionnement.ts` | 5 appelRoute → 5 imports logic.ts |
| `lib/blocs/volume-affaires.ts` | 5 appelRoute → 5 imports logic.ts |
| `lib/blocs/visibilite-seo-phase-a.ts` | 4 appelRoute → 4 imports logic.ts |
| `lib/blocs/visibilite-seo-phase-b.ts` | 2 appelRoute → 2 imports logic.ts |
| `lib/blocs/stocks-physiques.ts` | 3 appelRoute → 3 imports logic.ts |
| `lib/blocs/stock-en-ligne.ts` | 1 appelRoute → 1 import logic.ts |
| `lib/blocs/concurrents-phase-a.ts` | 2 appelRoute → 2 imports logic.ts |
| `lib/blocs/concurrents-phase-b.ts` | 1 appelRoute → 1 import logic.ts |

#### Correctifs TypeScript post-extraction

| Fichier | Erreur | Correction |
|---------|--------|-----------|
| `lib/blocs/schema-digital.ts:160` | `position: number \| undefined` non assignable à `number` | `.position ?? 0`, `.url ?? ''`, `.requete_source ?? ''` |
| `lib/blocs/stock-en-ligne.ts:180` | Overlap type — cast direct impossible | `as unknown as { cout: ...; [k: string]: unknown }` |
| `lib/orchestrateur/wrappers/bloc*.ts` (×6) | Type sans index signature ne peut pas caster en `Record<string, unknown>` | `resultat as unknown as Record<string, unknown>` |

#### Fix test-bloc2.js — arguments CLI

`test-bloc2.js` ignorait les arguments `argv[2..5]` et testait Vanves + Annecy en dur. Corrigé pour utiliser les arguments passés :

```javascript
const CAS = process.argv[2]
  ? [{ label: process.argv[2], destination: process.argv[2],
       code_insee: process.argv[3] ?? '74010',
       siren_commune: process.argv[4] ?? '200063402',
       population_commune: Number(process.argv[5] ?? 0) }]
  : CAS_DEFAUT
// Usage : node test-bloc2.js Megève 74173 217401730 3600
```

#### Résultat

- **Build** : `npm run build` — 46 routes compilées, 0 erreur TypeScript
- **Commit** : `998e178` — 77 fichiers modifiés, +4846 / −4529 lignes
- **Validation** : relancer un audit Megève via l'orchestrateur — Bloc 3 doit prendre ~50s (vrais appels DataForSEO), `nb_serp_fusionne > 0`, `domaine_ot_detecte` non nul

---

### Fix 3-en-1 — SIREN + Health check + Séquencement (2026-02-26)

#### 1. Suppression du SIREN de substitution

**Règle absolue** : le SIREN doit être un vrai SIREN à 9 chiffres issu du CSV local via le microservice.

**`app/api/audits/lancer/route.ts`** :
- Valide `siren` via `/^\d{9}$/` → HTTP 400 `{ error: 'SIREN invalide — le microservice local doit être démarré' }` si invalide
- Suppression du fallback `siren || \`insee-${commune.code}\``

**`app/audit/nouveau/page.tsx`** :
- Suppression de tout appel à `geo.api.gouv.fr` — le microservice est la seule source d'autocomplete
- Bouton "Lancer l'audit" désactivé si `!/^\d{9}$/.test(selected.siren)`
- Affichage explicite du SIREN dans la fiche de confirmation (rouge si invalide)

**Nettoyage SQL** (à exécuter manuellement sur Supabase) :
```sql
DELETE FROM audit_logs WHERE audit_id IN (
  SELECT a.id FROM audits a
  JOIN destinations d ON a.destination_id = d.id
  WHERE d.siren LIKE 'insee-%'
);
DELETE FROM audits WHERE destination_id IN (
  SELECT id FROM destinations WHERE siren LIKE 'insee-%'
);
DELETE FROM destinations WHERE siren LIKE 'insee-%';
```

#### 2. Health check avant lancement

**`app/api/health/route.ts`** (nouveau fichier) :
- `GET /api/health` — vérifie 6 services en parallèle avec timeout 5s
- Critiques : `microservice_local` (GET /health), `supabase` (SELECT 1), `openai` (GET /models), `dataforseo` (GET /appendix/user_data)
- Optionnels : `haloscan` (POST /domains/overview), `apify` (GET /users/me)
- Retourne `{ ok: boolean, services: { [nom]: { ok, critique, message } } }`

**`app/audit/nouveau/page.tsx`** :
- Panneau compact en haut du formulaire avec icônes vert/orange/rouge par service
- `useEffect` au chargement → appel automatique, bouton "Revérifier" manuel
- Bouton "Lancer l'audit" désactivé si `!healthData.ok` (critiques KO) ou healthLoading
- Messages d'erreur explicites pour chaque service dans le panneau
- Import `HealthResponse` + `ServiceStatus` depuis `@/app/api/health/route`

#### 3. Séquencement strict des blocs

**`lib/orchestrateur/supabase-updates.ts`** :
- Ajout `lireDomaineOT(auditId)` — lit `resultats.schema_digital.domaine_ot_detecte` directement sans jointure

**`app/api/orchestrateur/segment-a/route.ts`** :
- Import `lireDomaineOT`
- Après Bloc 3 : appel `lireDomaineOT(audit_id)` + `logInfo('domaine_ot résolu après Bloc 3')`

**`app/api/orchestrateur/segment-b/route.ts`** :
- Bloc 6 retiré — déplacé dans Segment C
- Nouvelle séquence : Bloc 4B → Bloc 5 → Bloc 7A
- Import `lancerBloc6` supprimé

**`app/api/orchestrateur/segment-c/route.ts`** :
- Bloc 6 ajouté en tête — exécuté avant Bloc 7B
- `maxDuration` passé de 120 à 300 (Playwright peut prendre 3-4 min)
- Import `lancerBloc6` ajouté
- Nouvelle séquence : Bloc 6 → Bloc 7B

---

### Fix — Migration Responses API + Helper parsing (2026-02-26)

#### Contexte

Tous les fichiers `logic.ts` utilisaient l'ancienne API Chat Completions (`POST /v1/chat/completions`). Migration vers la **Responses API** (`POST /v1/responses`) pour `gpt-5-mini` (modèle reasoning).

#### 12 fichiers logic.ts migrés

| Fichier | `max_output_tokens` | `reasoning.effort` |
|---------|--------------------|--------------------|
| `positionnement/openai/logic.ts` | 1 000 | low |
| `positionnement/poi-selection/logic.ts` | 500 | low |
| `volume-affaires/openai/logic.ts` | 1 000 | low |
| `schema-digital/classification/logic.ts` | 2 000 | low |
| `schema-digital/analyse-ot/logic.ts` | 500 | low |
| `schema-digital/openai/logic.ts` | 1 000 | low |
| `visibilite-seo/classification/logic.ts` | 4 000 | low |
| `visibilite-seo/synthese/logic.ts` | 2 000 | **medium** |
| `stocks-physiques/synthese/logic.ts` | 1 000 | low |
| `stock-en-ligne/synthese/logic.ts` | 1 000 | low |
| `concurrents/identification/logic.ts` | 2 000 | low |
| `concurrents/synthese/logic.ts` | 1 000 | low |

#### Changements par fichier

```typescript
// AVANT
const response = await axios.post('https://api.openai.com/v1/chat/completions', {
  model: 'gpt-5-mini',
  temperature: 0.2,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  max_tokens: 300,
})
const brut = response.data.choices[0].message.content

// APRÈS
import { parseOpenAIResponse } from '@/lib/openai-parse'
const response = await axios.post('https://api.openai.com/v1/responses', {
  model: 'gpt-5-mini',
  input: `${systemPrompt}\n\n${userPrompt}`,   // fusion en une seule chaîne
  max_output_tokens: 1000,
  reasoning: { effort: 'low' },
})
const brut = parseOpenAIResponse(response.data)
```

#### Helper partagé — `lib/openai-parse.ts`

La Responses API ne retourne pas `choices[0].message.content`. Le texte est dans `output[].type === 'message' → content[0].text`.

```typescript
// lib/openai-parse.ts
export function parseOpenAIResponse(data: unknown): string {
  const d = data as Record<string, unknown>
  // Format Responses API : output[] contient les blocs de réponse
  if (d?.output) {
    const out = d.output as Array<{ type: string; content?: Array<{ text?: string }> }>
    const messageBlock = out.find((o) => o.type === 'message')
    return messageBlock?.content?.[0]?.text ?? ''
  }
  // Fallback Chat Completions (ne devrait plus arriver)
  const choices = d?.choices as Array<{ message: { content: string } }> | undefined
  return choices?.[0]?.message?.content ?? ''
}
```

#### Valeurs `max_output_tokens` — règle

- Minimum absolu : **500** (tokens reasoning interne ~80% du budget)
- Sorties JSON simples (≤ 5 champs) : **500–1 000**
- Sorties JSON moyennes (blocs structurés) : **1 000–2 000**
- Sorties longues (batch keywords, liste concurrents) : **2 000–4 000**

---

### Correctifs audit Mégève — Phase B + Volume d'affaires + Stock en ligne (2026-02-26)

#### Bug 1 — Phase B ne se lançait pas après validation keywords

**Cause** : deux problèmes combinés dans `app/audit/[id]/progression/page.tsx`.

1. `handleConfirmKeywords` utilisait un `fetch` fire-and-forget (non `await`) → les erreurs étaient silencieuses
2. L'`useEffect` d'ouverture automatique de la modale se déclenchait à chaque tick de polling (~3s) pendant que Segment B tournait → double-trigger possible

**Correction** :
- Ajout de deux états : `segmentEnCours: boolean` (empêche la réouverture de la modale pendant l'exécution) et `erreurSegment: string | null` (affiche les erreurs réseau)
- `handleConfirmKeywords` et `handleConfirmConcurrents` sont désormais `async/await` avec `try/catch`
- Bannière d'erreur rouge affichée si le fetch échoue, avec bouton "Réessayer"
- Même traitement appliqué à `handleConfirmConcurrents` pour Segment C

#### Bug 2 — Volume d'affaires — diagnostic EPCI

**Contexte** : pour les communes dont la taxe de séjour est collectée par l'EPCI (ex. Mégève → CC Pays du Mont-Blanc), le chemin commune + EPCI retournait 0 → `taxe_non_instituee: true` sans diagnostic.

**Correction** dans `lib/blocs/volume-affaires.ts` et `types/volume-affaires.ts` :
- Ajout du champ `diagnostic_epci?: 'epci_non_resolu' | 'epci_taxe_non_trouvee' | 'commune_taxe_non_trouvee' | 'ok'` dans `ResultatVolumeAffaires`
- Log `console.warn` quand le SIREN EPCI n'est pas résolu
- Le champ indique exactement quelle partie du chemin a échoué

#### Bug 3 — Stock en ligne — getBbox non bloquant

**Cause** : si le microservice était indisponible, `getBbox()` levait une exception non rattrapée et bloquait tout le Segment C.

**Correction** dans `lib/blocs/stock-en-ligne.ts` :
- `getBbox()` entouré d'un `try/catch` → `bbox = null` si indisponible
- L'erreur est enregistrée dans `erreurs_partielles` (non bloquant)
- Le scraper Airbnb passe en mode nom-de-ville si `bbox === null`

**Correction dans `lib/scrapers/airbnb.ts`** :
- Signature `bbox: BoundingBox` → `bbox: BoundingBox | null`
- Ajout de `buildUrlAirbnbSansGeo()` (recherche par nom de ville sans coordonnées)
- Si `bbox === null` → recherche mono-page sans découpage en quadrants

#### Prefetch bbox en Segment A (suite Bug 3)

**Objectif** : la bbox géographique est disponible dès le Segment A (via le microservice `localhost:3001/bbox`) pour qu'elle soit prête quand Segment C démarre.

**Flux** :
```
Segment A  →  GET localhost:3001/bbox?code_insee=XXX  →  sauvegarderBbox(audit_id, bbox)
                                                               ↓ (Supabase resultats.bbox)
Segment C  →  lireBbox(audit_id)  →  params.bbox  →  scraperAirbnb(browser, bbox, destination)
```

**Fichiers modifiés** :

| Fichier | Modification |
|---------|-------------|
| `types/stock-en-ligne.ts` | Ajout `bbox?: BoundingBox \| null` dans `ParamsBloc6` |
| `lib/orchestrateur/supabase-updates.ts` | Ajout `sauvegarderBbox()` et `lireBbox()` (lit/écrit `resultats.bbox`) |
| `app/api/orchestrateur/segment-a/route.ts` | Appel `GET /bbox` après `lireParamsAudit` + `sauvegarderBbox` si succès (rien si échec — le Segment C retentera) |
| `lib/orchestrateur/wrappers/bloc6.ts` | Lecture `lireBbox(audit_id)` avant `lancerBlocStockEnLigne` ; si null → `bbox` non passée dans params (le fallback microservice de stock-en-ligne.ts est déclenché) |
| `lib/blocs/stock-en-ligne.ts` | Utilise `params.bbox` si fourni ; fallback appel direct microservice si `params.bbox === undefined` |

**Règle** : on ne sauvegarde jamais `null` en Supabase. Si le microservice est indisponible en Segment A → rien sauvegardé → Segment C retentera directement le microservice.

---

### Phase 4 — Page de résultats (intégrée Phase 3A)
✅ Structure complète affichée — données réelles via seed Annecy.

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
| `test-bloc2-melodi.js` | Bloc 2 enrichissement — dispatch TS par commune via Mélodi (Annecy, microservice requis) |
| `test-bloc3.js` | Bloc 3 — test Annecy (SERP 5 requêtes, classification, Haloscan+fallback DataForSEO, PageSpeed, Analyse OT, OpenAI) |
| `test-bloc4.js` | Bloc 4 Phase A+B — test Annecy (Haloscan 8 seeds, DataForSEO related 4 seeds, ranked, classification 300 kw, SERP live 8, synthèse — flag `--phase-b`) |
| `test-bloc5.js` | Bloc 5 — test Annecy (DATA Tourisme /stocks, Recherche Entreprises, déduplication, OpenAI) |
| `scripts/scan-datatourisme-types.js` | Préparation Bloc 5 — scan tous types @type DATA Tourisme sans filtre (node scripts/scan-datatourisme-types.js [code_insee]) |
| `scripts/test-bloc6.js` | Bloc 6 — test Annecy (bbox, Airbnb, Booking, Viator, site OT, OpenAI — node scripts/test-bloc6.js "Annecy" "74010" "lac-annecy.com") |
| `scripts/test-bloc-concurrents.js` | Bloc 7 v2 — test Annecy Phase A + B (séquence SEO 5 étapes + siteCompetitors — Next.js requis — node scripts/test-bloc-concurrents.js "Annecy" "74010" "lac-annecy.com") |
