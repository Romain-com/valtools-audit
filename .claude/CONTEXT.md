# CONTEXT.MD — Destination Digital Audit App
> Dernière mise à jour : Phase 1 — Microservice fondations terminé et validé (2026-02-23)
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
Champs utiles : `total_keyword_count`, `total_traffic`, `top_3_positions`, `top_10_positions`, `visibility_index`, `traffic_value`

**Coût** : 1 crédit site/appel — ~2 972 crédits/mois renouvelables

**⚠️ Fallback obligatoire**
```javascript
if (data.metrics?.errorCode === 'SITE_NOT_FOUND') {
  // Afficher "Non indexé dans Haloscan" et continuer sans bloquer
}
```
Les données de trafic sous-représentent le trafic FR — fiable pour comparaisons relatives uniquement.

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

### ⏳ Google PageSpeed Insights
**Auth** : clé Google Cloud Console (gratuite — 25 000 req/jour)
```
PAGESPEED_API_KEY= (à créer)
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
| Visibilité SEO domaines officiels | Haloscan | ✅ |
| Contexte algo Google | Monitorank | ✅ |
| Volume hashtag Instagram (postsCount) | Apify instagram-hashtag-stats | ✅ |
| Posts récents + ratio OT/UGC | Apify instagram-hashtag-scraper | ✅ |
| Santé technique (Core Web Vitals) | Google PageSpeed API | ⏳ clé à créer |
| Stocks hébergements / activités / services | Microservice DATA Tourisme | ✅ index prêt |
| Concurrents directs (3) + indirects (3) | OpenAI | ✅ |
| Métriques concurrents | DataForSEO + Haloscan | ✅ |
| Contenus GDoc/GSlides | OpenAI (copier-coller manuel) | ✅ |
| Backlinks | ❌ supprimé du scope | — |

---

## DATA Tourisme (13 Go local)

- **Format** : fichiers JSON organisés par région / département
- **Accès** : microservice Node.js local (Express) sur Mac, tourne en arrière-plan
- **Stratégie** : indexation légère au démarrage (nom, type, commune, GPS), filtrage à la volée, streaming sans charger en RAM
- **Endpoint exposé** : `GET /stocks?destination=XXX` → counts hébergements / activités / services
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
- [ ] Ouvrir un fichier DATA Tourisme → identifier la clé JSON du nom de commune
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
| `GET /poi?code_insee=74010&types=PointOfInterest&limit=5` | 5 POI avec nom/type/GPS |
| `GET /poi` (index pas prêt) | HTTP 503 avec message d'attente |

#### Microservice — Structure des fichiers
```
microservice/
├── index.ts                  → Express, démarrage CSV sync + indexation async
├── routes/communes.ts        → GET /communes?nom=XXX (autocomplete + homonymes)
├── routes/poi.ts             → GET /poi?code_insee=XXX&types=...&limit=...
├── services/csv-reader.ts    → CSV → Map normalisée (accents/tirets/homonymes)
├── services/datatourisme.ts  → scan récursif 489k fichiers → index RAM par INSEE
├── types/index.ts            → Commune, IndexPOI, POIResult
├── package.json / tsconfig.json
└── .env                      → chemins pré-remplis
```

#### Structure JSON DATA Tourisme — clés confirmées
- Nom : `data["rdfs:label"]["fr"][0]`
- Types : `data["@type"]` filtré (sans préfixe `schema:`)
- Code INSEE : `data.isLocatedAt[0]["schema:address"][0]["hasAddressCity"]["insee"]`
- GPS : `data.isLocatedAt[0]["schema:geo"]["schema:latitude/longitude"]` (strings → parseFloat)

#### Pour démarrer le microservice
```bash
cd microservice && npm run dev
```

### Phase 2 — Modules de collecte
Un module = une section de code = testé indépendamment avant de passer au suivant :
1. Microservice CSV → identification SIREN + détection doublon
2. DataForSEO (SERP + Maps)
3. OpenAI (positionnement + hashtags + concurrents + contenus)
4. data.economie.gouv.fr (taxe de séjour)
5. Apify (instagram-hashtag-stats + instagram-hashtag-scraper)
6. Haloscan (visibilité SEO)
7. Monitorank (contexte algo)
8. Google PageSpeed (Core Web Vitals)
9. Microservice DATA Tourisme (stocks)

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
PAGESPEED_API_KEY= (à créer)

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
