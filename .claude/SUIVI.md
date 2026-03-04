# SUIVI.MD — Développement Destination Digital Audit
> Historique des phases, tests validés, bugs résolus et décisions techniques.
> Mis à jour à chaque fin de phase.

---

## Plan de développement

| Phase | Contenu | Statut |
|-------|---------|--------|
| Phase 0 | Préparation hors code | ✅ partielle |
| Phase 1 | Fondations (Next.js + Supabase + microservice) | ✅ TERMINÉE |
| Phase 2 — Blocs 1–7 | Collecte de données par bloc | ✅ TERMINÉE |
| Phase 3A | Fondations UX (4 pages + composants) | ✅ TERMINÉE |
| Phase 3B | Orchestrateur principal + observabilité | ✅ TERMINÉE |
| Phase 3C | Fix architecture (suppression appels auto-référentiels) | ✅ TERMINÉE |
| Phase 4 | Page de résultats (intégrée Phase 3A) | ✅ |
| Phase 5 | Finitions (gestion erreurs, tests, collaborateurs) | En attente |

---

## Phase 0 — Préparation (hors code)

- [x] Ouvrir un fichier DATA Tourisme → identifier la clé JSON du nom de commune
  Clés confirmées : `rdfs:label.fr[0]`, `isLocatedAt[0].schema:address[0].hasAddressCity.insee`, `schema:geo`
- [ ] Extraire charte PDF → `design-tokens.md`
- [ ] Lister les blocs de contenu des templates GDoc/GSlides
- [ ] Rassembler grilles tarifaires API → `api-costs.md`
- [ ] Créer clé Google PageSpeed (Google Cloud Console)

---

## Phase 1 — Fondations ✅ TERMINÉE (2026-02-23 → 2026-02-25)

### Schéma Supabase

```
supabase/
├── schema-documentation.md          → Documentation exhaustive JSONB audits.resultats (7 blocs)
├── migrations/
│   ├── 001_initial_schema.sql        → Tables + ENUMs + triggers
│   ├── 002_indexes.sql               → GIN (resultats, couts_api) + btree expressions
│   ├── 003_rls.sql                   → Row Level Security — authenticated full read/write
│   ├── 004_audit_unique_constraint.sql → UNIQUE(destination_id) sur audits
│   └── 005_drop_competitors_table.sql  → Suppression table competitors + ENUM type_concurrent
└── seed.sql                          → Données Annecy complètes (7 blocs, résultats réels + estimés)
```

**ENUMs** : `statut_audit` (en_cours/termine/erreur), `role_utilisateur` (admin/collaborateur)

**Triggers** :
- `on_auth_user_created` → crée profil dans `public.profiles`
- `destinations_updated_at` → met à jour `updated_at` automatiquement

**Seed Annecy** (SIREN 200063402, INSEE 74010) :
- `resultats` JSONB : 7 blocs complets
- `couts_api` JSONB : total audit ≈ 0,516 €
- Valeurs "estimé" : `instagram.posts_count`, détails PageSpeed, `analyse_site_ot`

**Note** : `SUPABASE_SERVICE_ROLE_KEY` = format `sb_secret_...` (pas un JWT). Requis pour tous les Route Handlers (bypass RLS). Clé `anon` retourne 0 lignes (RLS `authenticated` uniquement).

### Microservice résultats de validation

- **34 968 communes** indexées depuis `identifiants-communes-2024.csv`
- **489 318 fichiers** DATA Tourisme indexés — 100% succès, 0 erreur
- **28 883 communes** couvertes dans l'index DATA Tourisme
- Démarrage serveur : **immédiat** — indexation en arrière-plan (~2-3 min)
- Cache disque `microservice/cache/index-communes.json` (56 Mo) → redémarrage en 87ms

**Analyse préfixes DATA Tourisme** : 28 préfixes numériques distincts. Les préfixes ne correspondent PAS aux codes département — filtrage par département uniquement via code INSEE extrait du JSON.

### Validation Supabase — `scripts/test-supabase.js`

| Bloc | Donnée | Valeur seed |
|------|--------|-------------|
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
| — | Coût total audit | 0.516 € |

---

## Phase 2 — Blocs de collecte ✅ TERMINÉE

### Bloc 1 — Positionnement & Notoriété ✅ (2026-02-24)

**Tests validés — Trévoux (code INSEE 01427)** :
- OT : Office de tourisme Ars Trévoux — 4.6/5 (66 avis)
- POI DATA Tourisme : 17 disponibles
- Instagram #trevoux : 1 585 000 posts — ratio OT/UGC : 6/10
- Coût total bloc : **0.108 €** en ~27s

**Piège résolu** : code INSEE Trévoux = `01427` (pas 01390).

### Bloc 2 — Volume d'affaires (taxe de séjour) ✅ (2026-02-24) + Enrichissement Mélodi ✅ (2026-02-25)

**Tests validés** :

| Cas | Collecteur | Montant | Nuitées | Durée |
|---|---|---|---|---|
| Vanves (INSEE 92075) | Commune directe | **739 764 €** (2024) | 493 177 | 3.7s |
| Annecy (INSEE 74010) | CA Grand Annecy | **3 440 837 €** (2024) | 2 293 891 | 5.8s |

**Pièges résolus** :
- Code INSEE Vanves = `92075` (pas 92078)
- Annecy ne collecte pas en direct → bascule sur CA Grand Annecy (SIREN 200066793)
- SIREN commençant par 200 est valide pour communes fusionnées (pas indicateur EPCI)

**Enrichissement Mélodi — Annecy (CA Grand Annecy, 34 communes)** :
- 34 communes récupérées ✅
- Profil OpenAI : `bord_lac` — coefficients ajustés (hôtel 2000→2500, tourisme 1500→1800)
- Dispatch Annecy : **93.1%** de l'EPCI — TS estimée **3 203 030€**
- Total dispatché : 3 440 838€ ≈ 3 440 837€ — **écart 0.00%** ✅
- 19/34 communes avec `source: 'absent'` → normal pour petites communes rurales
- Durée : 13.7s | Pas de 429 rate-limit

### Bloc 3 — Schéma digital & Santé technique ✅ (2026-02-24)

**Tests validés** :

| Destination | OT détecté | Score visibilité | total_keywords | source | PageSpeed mobile |
|---|---|---|---|---|---|
| Annecy | lac-annecy.com | 1/5 | 53 842 | haloscan (www) | 51/100 |
| Trévoux | ars-trevoux.com | 2/5 | — | Haloscan direct | CLS critique (0.95) |

**Pièges résolus** :
- Classification JSON tronqué → tronquer titre (80 chars) + meta (100 chars) dans le prompt, `max_tokens: 1500`
- PageSpeed timeout → 45 000ms obligatoire
- Haloscan zéros silencieux → peut retourner métriques à 0 sans SITE_NOT_FOUND → fallback DataForSEO

**Coût du bloc** : DataForSEO SERP 0.030 € + Haloscan 0.010-0.030 € + OpenAI 0.003 € + PageSpeed 0 € = **≈ 0.043-0.081 €**

### Bloc 4 — Visibilité SEO & Gap Transactionnel ✅ (2026-02-24)

**Tests validés Annecy — Phase A + B** :
```
Phase A :
  Haloscan : 117 kw | DataForSEO related : 125 kw → corpus fusionné : 223 kw
  160 classifiés | 21 PAA | 35 gaps transac | 69 absences totales
  Coût Phase A : 0.116€ | Durée : ~156s

Phase B :
  8 SERP live (4 transac + 4 absences)
  Vrais gaps confirmés live : 35
  trafic_estime_capte : 512 484 visites/mois
  taux_captation : 80% | Score gap : 8/10
  Top 5 opportunités : evènement (49500), plage de (27100), randonnée autour de moi (27100),
                       fromagerie autour de moi (22200), hôtel annecy spa (9900)
  PAA sans réponse OT : 5
  Coût Phase B : 0.049€ | TOTAL Bloc 4 : 0.165€ | Durée totale : ~194s
```

**Pièges critiques** :
- Règle dure gap ≤ 20 : OpenAI peut classer `gap: true` des keywords où l'OT est bien positionné
- Filtre related obligatoire : keywords ultra-génériques (1-2 mots sans destination) polluent le corpus
- `Promise.allSettled` (pas `Promise.all`) : panne Haloscan ne doit pas bloquer les autres sources
- `taux_captation` : dénominateur = `volume_marche_seeds` (pas `volume_transactionnel_gap`)

### Préparation Bloc 5 — Scan types DATA Tourisme ✅ (2026-02-24)

**Résultats scan Annecy (INSEE 74010)** :
- 323 fichiers, 114 types distincts
- `PointOfInterest` (323) et `PlaceOfInterest` (314) = types racines → ignorer pour regroupements
- `olo:OrderedList` (13) = artefact technique → ignorer
- Types `schema:XXX` = doublons → compter l'un ou l'autre uniquement

### Bloc 5 — Stocks physiques ✅ (2026-02-25)

**Migration SIRENE** :
- ❌ `api.insee.fr` → deprecated
- ❌ `portail-api.insee.fr` → SPA APIM retourne HTML
- ✅ **Remplacement** → `recherche-entreprises.api.gouv.fr` — gratuit, sans auth

**⚠️ Rate limit 429** : `sleep(300ms)` entre chaque code NAF + retry backoff (1.5s × tentative, max 3)

**Tests validés — Annecy (INSEE 74010)** :

| Source | Hébergements | Activités | Culture | Services | Total |
|---|---|---|---|---|---|
| DATA Tourisme | 42 | 153 | 55 | 14 | 264 |
| Recherche Entreprises | 438 | 811 | 699 | 69 | 2 017 |
| **Fusionné** | **461** | **927** | **745** | **80** | **2 213** |
| Doublons | 19 | 37 | 9 | 3 | **68** |

Couverture DT globale : 3% | Ratio particuliers hébergement : 56.2%

**Note évolution** : ancienne valeur 2 271 (seuil dédup = 3) → 2 213 après correction seuil à 2.

NAF `90.01Z/90.02Z/90.03A` = spectacle vivant = 660 SIRENE (artistes auto-entrepreneurs) → culture SIRENE dominée par spectacle.

### Bloc 6 — Stock commercialisé en ligne (OTA + site OT) ✅ (2026-02-25)

**Tests validés — Annecy (INSEE 74010)** :

| Source | Résultat | Note |
|---|---|---|
| Airbnb | 4 246 annonces (21 zones) | Découpage quadrant fonctionnel |
| Booking | 277 propriétés | Correct |
| Viator | 0 | Cloudflare — limitation connue |
| Site OT (héb.) | 34 fiches — listing_seul | Correct |
| Site OT (act.) | 64 fiches — listing_seul | Correct |

Durée : 143s | Coût : 0.001€

**Pièges critiques** :
- Airbnb `>= SEUIL_MAX` (pas `>`) — exactement 1000 doit déclencher subdivision
- Airbnb texte "+" → forcer SEUIL_MAX + 1 immédiatement
- Booking : sélecteur `h1` seul fonctionne
- Viator + GYG + TripAdvisor : Cloudflare → 403 headless systématique
- `export const runtime = 'nodejs'` obligatoire sur tous les route handlers Playwright

### Bloc 7 — Concurrents v2 ✅ (2026-02-25)

**Tests validés — Annecy (v2)** :

| Concurrent | Keywords | Trafic | Note Google | Source SEO |
|---|---|---|---|---|
| Chamonix-Mont-Blanc | 70 755 | 176 206 | 4.4/5 (1866 avis) | haloscan |
| Évian-les-Bains | 36 | 4 | 4.3/5 (749 avis) | haloscan |
| Aix-les-Bains | 0 | 0 | 4.3/5 (553 avis) | inconnu (5 sources) |
| Saint-Gervais-les-Bains | 27 788 | 40 577 | 4.3/5 | haloscan |
| La Clusaz | 24 322 | 1 016 314 | 4.1/5 | haloscan |

Position globale Annecy : **LEADER** | Durée Phase A : 46s | Coût : 0.143€

v2 vs v1 : Chamonix (0→70 755 kw), Saint-Gervais (0→27 788 kw) — séquence 5 étapes. La Clusaz remplace Annecy-le-Vieux (filtré).

**Piège critique — filtre subdivisions** : OpenAI propose systématiquement des communes-associées. Double protection : instruction prompt + filtre dur code (normalisé sans accents). OpenAI demande 6 candidats → `.slice(0, 5)` en sortie.

### Migration OpenAI : gpt-4o-mini → gpt-5-mini ✅ (2026-02-25)

**Périmètre** : 14 fichiers route.ts + lib/blocs/*.ts

**Tarification** :
| Modèle | Input | Output |
|---|---|---|
| gpt-4o-mini | $0.15/1M | $0.60/1M |
| **gpt-5-mini** | $0.25/1M | **$2.00/1M** |

Budget OpenAI par audit : ~0.01-0.02€ → ~0.03-0.06€

---

## Phase 3A — Fondations UX ✅ TERMINÉE (2026-02-25)

### Packages installés
```bash
npm install tailwindcss@3 postcss autoprefixer @supabase/ssr
```

### Design tokens (`ressources/design-tokens.md`)

| Token Tailwind | Hex | Rôle |
|---|---|---|
| `brand-orange` | `#E84520` | CTA, logo, accents |
| `brand-orange-light` | `#F4A582` | Badges secondaires |
| `brand-purple` | `#6B72C4` | Data, technologie |
| `brand-yellow` | `#F5B731` | KPIs positifs |
| `brand-cream` | `#FAF0DC` | Fonds doux |
| `brand-navy` | `#1A2137` | Textes, titres |
| `brand-bg` | `#F3F5FA` | Background général |

**Seuils KPI jauges** :
- Note Google : vert ≥ 4.2 / orange ≥ 3.8 / rouge < 3.8
- Score gap : vert ≥ 7/10 / orange ≥ 4 / rouge < 4
- Score visibilité OT : vert ≥ 3/5 / orange 2 / rouge ≤ 1
- PageSpeed mobile : vert ≥ 70 / orange ≥ 50 / rouge < 50

### Tests navigateur validés (2026-02-25)

Serveur dev sur **localhost:3002** (port 3000 occupé).
Compte admin : `admin@valraiso.fr` / `Valraiso2026!`

| Test | URL | Résultat |
|------|-----|----------|
| Login | `/login` | ✅ Auth Supabase OK |
| Dashboard | `/dashboard` | ✅ Card Annecy visible |
| Autocomplete | `/audit/nouveau` | ✅ Suggestions via microservice |
| Progression | `/audit/.../progression` | ✅ Montagne SVG + étapes |
| Résultats | `/audit/.../resultats` | ✅ 7 blocs + sidebar |

**Correctif** : champ "Région" affichait code numérique (`84`) → ajout `REGIONS_FR: Record<string, string>` + champ `nomRegion`.

### Bugs préexistants corrigés au passage

| Fichier | Correction |
|---|---|
| `visibilite-seo/serp-transac/route.ts` | `export function` → `function` |
| `visibilite-seo/synthese/route.ts` | Suppression annotation type trop stricte |
| `lib/blocs/stock-en-ligne.ts` | Cast `as unknown as typeof synthese` |
| `microservice/routes/bbox.ts` | Conditionnel undefined sur `contour?.coordinates?.[0]` |

---

## Phase 3B — Orchestrateur principal + Observabilité ✅ TERMINÉE (2026-02-25)

### Architecture 3 segments

```
Segment A (maxDuration=300) : Blocs 1 → 2 → 3 → 4A → pause validation keywords
Segment B (maxDuration=300) : Blocs 4B → 5 → 7A → pause validation concurrents
Segment C (maxDuration=300) : Blocs 6 → 7B → statut 'termine'
```

**Note** : Bloc 6 retiré du Segment B → déplacé dans Segment C (Playwright ~3-4 min).

### Coûts estimés Chamonix-Mont-Blanc

| Segment | Durée | Coût |
|---------|-------|------|
| Segment A (Blocs 1-4A) | 8-12 min | 0.80-1.20 € |
| Segment B (Blocs 4B-7A) | 15-25 min | 1.50-2.50 € |
| Segment C (Bloc 7B) | 2-3 min | 0.05 € |
| **Total** | **25-40 min** | **~2.50-3.80 €** |

---

## Correctifs post-Phase 3B

### Session 1 (2026-02-25)

**1. Middleware — Routes API non authentifiées**
- Problème : les blocs appelaient des sous-routes sans cookies d'auth → middleware retournait HTML
- Correction : `if (pathname.startsWith('/api/')) return supabaseResponse` avant check `!user`

**2. Page progression — Polling actif (remplacement Realtime)**
- Supabase Realtime `postgres_changes` non fiable en local → remplacé par polling 3s via `/api/orchestrateur/statut`
- Logs existants chargés au montage, déduplication logs, Realtime conservé en bonus

**3. Page résultats — Lien "← Progression"** ajouté dans sidebar

### Session 2 (2026-02-25)

**1. 0 keywords — cascade domaine_ot null**
```
domaine_ot null → dataforseo-ranked 400 → ranked_result null → throw ranked_keywords indisponible
  → catch → keywords_classes: [] → modal bloquée → Phase B jamais lancée
```
Correction : `dataforseo-ranked` retourne résultats vides si `!domaine_ot` (pas 400)

**2. Pipeline Phase B avec keywords vides**

| Fichier | Ancien | Nouveau |
|---------|--------|---------|
| `serp-transac/route.ts` | 400 si vide | Retourne `{ serp_results: [] }` |
| `synthese/route.ts` | 400 si absent | Accepte liste vide |
| `segment-b/route.ts` | 400 si length=0 | Tolère tableau vide |

**3. Modal Bloc 4 — condition** : supprimé `&& keywordsPhaseA.length > 0` ; ajouté état "zéro keyword" avec bouton "Continuer sans keywords"

**4. Instrumentation diagnostique** : `logInfo` ajouté dans tous les wrappers pour diagnostiquer les valeurs réelles

---

## Correctifs Session 3 — Compatibilité GPT-5-mini (2026-02-26)

### Deux paramètres incompatibles

**`max_tokens`** → utiliser `max_completion_tokens`
**`temperature: 0.2`** → supprimer (seule valeur 1 supportée)

### `max_completion_tokens` trop bas → réponse vide

GPT-5-mini est un modèle de raisonnement : reasoning tokens ~80% du budget. Exemple : 675 tokens dont 576 reasoning → 99 tokens visibles.

**Valeurs corrigées** :

| Fichier | Ancienne | Nouvelle |
|---------|---------|---------|
| `schema-digital/classification` | 1 500 | **16 000** |
| `visibilite-seo/classification` | 4 000 | **16 000** |
| `concurrents/identification` | 1 200 | **16 000** |
| Autres logic.ts | 200-800 | **8 000** |

**Règle GPT-5-mini** : minimum absolu `max_output_tokens` = 500. Préférer 8 000+ pour les sorties JSON.

---

## Phase 3C — Fix architecture (2026-02-26)

### Problème — deadlock auto-référentiel

Les `lib/blocs/*.ts` appelaient leurs propres APIs via `fetch('http://localhost:3000/api/...')` → deadlock dans le même processus Node.js → `catch` immédiat → résultats vides.

**Symptôme** : Bloc 3 terminé en ~6s au lieu de ~53s.

### Solution — pattern logic.ts

```
AVANT : lib/blocs/schema-digital.ts → fetch('http://...') → route.ts → DataForSEO
APRÈS : lib/blocs/schema-digital.ts → import { executerSERP } from './serp/logic' → DataForSEO
```

**24 fichiers logic.ts créés** (blocs 1, 2, 3, 4, 5, 6, 7).

**Résultat** : `npm run build` — 46 routes compilées, 0 erreur TypeScript.
**Commit** : `998e178` — 77 fichiers modifiés, +4846 / −4529 lignes.

---

## Migration Responses API (2026-02-26)

Migration `POST /v1/chat/completions` → **`POST /v1/responses`** (API native gpt-5-mini).

**Format** :
```typescript
// AVANT : Chat Completions
{ model, messages: [{role, content}], max_tokens }
// APRÈS : Responses API
{ model, input: `${systemPrompt}\n\n${userPrompt}`, max_output_tokens, reasoning: { effort: 'low' } }
```

Helper partagé `lib/openai-parse.ts` pour extraire `output[type=message].content[0].text`.

**12 fichiers logic.ts migrés** — voir CONTEXT.md pour le détail.

---

## Fix 3-en-1 — SIREN + Health check + Séquencement (2026-02-26)

### 1. Suppression SIREN de substitution

- `lancer/route.ts` : valide `siren` via `/^\d{9}$/` → HTTP 400 si invalide, suppression fallback `insee-{code}`
- `nouveau/page.tsx` : suppression appel `geo.api.gouv.fr` — microservice = seule source autocomplete

**Nettoyage SQL Supabase** (à exécuter manuellement) :
```sql
DELETE FROM audit_logs WHERE audit_id IN (
  SELECT a.id FROM audits a JOIN destinations d ON a.destination_id = d.id
  WHERE d.siren LIKE 'insee-%'
);
DELETE FROM audits WHERE destination_id IN (SELECT id FROM destinations WHERE siren LIKE 'insee-%');
DELETE FROM destinations WHERE siren LIKE 'insee-%';
```

### 2. Health check avant lancement

`GET /api/health` — 6 services, timeout 5s.
Critiques : `microservice_local`, `supabase`, `openai`, `dataforseo`.
Optionnels : `haloscan`, `apify`.

### 3. Séquencement strict

- Ajout `lireDomaineOT(auditId)` dans `supabase-updates.ts`
- Segment A : appel `lireDomaineOT` après Bloc 3 + log diagnostic
- Segment B : Bloc 6 retiré → déplacé Segment C
- Segment C : Bloc 6 ajouté en tête, `maxDuration` 120 → 300

---

## Onglet Territoire — Analyse multi-communes (2026-03-04)

### Objectif

Nouvel onglet indépendant de l'audit : permet d'analyser un territoire de plusieurs communes en collant une liste libre. Pas de Supabase, pas d'orchestrateur — tout stateless.

### Fichiers créés

```
app/territoire/page.tsx                 → Server Component auth + redirect
app/territoire/TerritoireClient.tsx     → Client Component (UI complet)
app/api/territoire/valider/route.ts     → POST — validation communes via CSV local
app/api/territoire/analyser/route.ts    → POST — collecte données (5 sources) par commune
app/api/territoire/analyse-gpt/route.ts → POST — synthèse OpenAI du territoire
```

### APIs intégrées

| API | Endpoint | Usage |
|-----|----------|-------|
| Microservice local | `/stocks` | Hébergements + POI DATA Tourisme |
| Microservice local | `/epci` | SIREN + population EPCI |
| `executerTaxe` (logique Bloc 2) | data.economie.gouv.fr | Taxe de séjour commune / EPCI |
| Mélodi INSEE | `DS_RP_LOGEMENT_PRINC` | Résidences secondaires commune + EPCI |
| Mélodi INSEE | `DS_TOUR_CAP` | Capacité officielle hôtels/campings/autres |
| Mélodi INSEE | `DS_TOUR_FREQ` | Nuitées annuelles par département |
| geo.api.gouv.fr | `/epcis/{siren}/communes` | Liste communes EPCI (prorata hybride) |
| OpenAI Responses API | `gpt-5-mini` | Synthèse territoire JSON |

### Décisions techniques notables

**Validation communes** (`valider/route.ts`)
- Lit `ressources/identifiants-communes-2024.csv` en mémoire (cache module)
- Normalisation : minuscules + NFD + tirets/apostrophes → espaces (couvre `'`, `'`, `‑`, `–`)
- Recherche en 3 passes : exact → préfixe → inclusion
- Ambiguïté → sélection utilisateur dans l'UI ; invalide → correction inline + re-validation

**Collecte parallèle** (`analyser/route.ts`)
- DS_TOUR_FREQ préchargé **par département unique** (évite N requêtes identiques pour un même département)
- Communes analysées en `Promise.all` (parallèle)
- Appels Mélodi RS **séquentiels** dans chaque commune (rate limit ~150 req/min → délai 400ms)
- GEO format DS_TOUR_CAP : `2025-COM-{code_insee}` | DS_TOUR_FREQ : `2023-DEP-{code}` + valeurs × 1000 (UNIT_MULT=3)

**Prorata taxe EPCI — algorithme hybride (v3)**
- Passe 1 : RS connues → part = RS_commune / RS_EPCI
- Passe 2 : RS inconnues → part sur montant résiduel pondéré par **capacité touristique officielle** (DS_TOUR_CAP `total_etab`) — bien plus pertinent que la population permanente
- Fallback passe 2 : si aucune donnée DS_TOUR_CAP disponible → population pure
- Fallback global : RS_EPCI absent → capacité touristique ou population pure
- `methode_part` retourné dans les résultats : `residences_secondaires | rs_hybride | population`

**Déduplication hébergements** (vue synthèse)
- Fusion DATA Tourisme + INSEE DS_TOUR_CAP avec `Math.max()` par catégorie
- Correspondance : `hotels` → `I551`, `campings` → `I552`, autres → `I553`

**Export CSV**
- Séparateur `;` + BOM UTF-8 (`\uFEFF`) pour compatibilité Excel
- Échappement guillemets et point-virgules dans les valeurs

**Analyse GPT**
- `max_output_tokens: 4000`
- Prompt construit côté serveur : 1 ligne résumée par commune (hébergements, POI, taxe, RS)
- Champs retournés : `communes_moteurs`, `specialisations`, `maturite_touristique`, `communes_sous_exploitees`, `synthese`

### Contraintes identifiées

- Mélodi RS EPCI : format GEO `EPCI-{siren_epci}` (pas `EPCI-{code_insee}`)
- DS_TOUR_CAP peut retourner 0 observations pour les petites communes → fallback `null`
- MAX_COMMUNES_INCONNUES = 40 (plafond anti-timeout pour le prorata hybride EPCI)
- Limite : 50 communes par requête
- `fetchResidencesSecondaires` retourne `null` si Mélodi n'a pas de données (distinct de "0 RS")
- RS EPCI pré-chargé avant le `Promise.all` principal (1 seul appel par EPCI unique, séquentiel)

---

## Correctifs Territoire — Prorata EPCI (2026-03-04)

### Bug 1 — Race condition RS EPCI (symptôme : Pontcharra orange alors que RS connue)

**Cause** : `fetchResidencesSecondairesEPCI` était appelée dans `analyserCommune()` via `Promise.all`. Pour 4 communes du même EPCI (ex. CC LE GRESIVAUDAN), l'API Mélodi recevait 4 appels simultanés sur le même SIREN → rate limit → certaines communes (dont Pontcharra) recevaient `null` → fallback population.

**Correction** :
- `fetchEpci` et `fetchResidencesSecondairesEPCI` déplacés **avant** le `Promise.all` principal
- Une seule requête par EPCI unique, séquentielle (boucle `for...of`)
- Résultat : `epciParCommune: Map<code_insee, InfosEpci>` + `rsEpciMap: Map<siren_epci, number | null>`
- Ces maps sont passées en paramètre à `analyserCommune` (plus de re-fetch interne)
- Enrichissement hybride réutilise `rsEpciMap` (pas de 3e appel API)

### Bug 2 — `fetchResidencesSecondaires` retournait 0 pour "données absentes"

**Cause** : si Mélodi retourne `observations: []`, la fonction calculait `Math.round(undefined ?? 0) = 0` et retournait `0`. Résultat : "0 RS" et "données absentes" étaient indistinguables dans `calculerPartHybride`.

**Correction** : ajout `if (obs.length === 0) return null` avant le calcul.

### Amélioration — Passe 2 hybride : capacité touristique au lieu de population

**Problème** : distribuer le montant résiduel (communes sans RS) par population permanente est un mauvais proxy touristique. Un bourg de 10 000 hab. sans hôtel recevait plus qu'une station de ski de 800 hab. avec 30 chalets.

**Solution** : en passe 2, utiliser `total_etab` (DS_TOUR_CAP Mélodi) comme poids.
- `construireMapsEPCI` remplace `construireMapRSEPCI` : fetch RS **et** Cap par commune inconnue (séquentiel, 400ms entre appels, 2 appels par commune)
- `calculerPartHybride` reçoit `cap_par_commune: Map<string, number | null>` en plus
- Passe 2 : `part = résidu × (cap_commune / cap_total_sans_rs)` si cap disponible, sinon population
- Communes avec 0 établissements touristiques → 0€ du résiduel (correct)

---

## Intégration Tourinsoft ANMSM (2026-03-04)

### Objectif

Connecter les 5 flux de données ANMSM (stations de montagne) pour enrichir l'onglet Territoire avec des données stations, hébergements, activités et commerces propres au périmètre des stations affiliées.

### Analyse préalable des flux

| Feed | Items réels | Taille XML | Cache JSON | Stratégie |
|------|-------------|------------|------------|-----------|
| Données Stations | 93 | 22 MB | 287 KB | Sync + mémoire |
| Séjours | 43 | 1 MB | 56 KB | Sync + mémoire |
| Hébergements | 15 321 | 627 MB | 3.0 MB | Sync + mémoire |
| Activités | 8 148 | ~80 MB | 1.8 MB | Sync + mémoire |
| Commerces | 1 856 | 65 MB | 356 KB | Sync + mémoire |

**Total** : ~750 MB XML → 5.5 MB JSON compact (facteur compression ×136)

**Contraintes découvertes** : pas de filtres serveur (`$filter`/`$top` ignorés), format XML Atom OData v3, pas de code INSEE (CODEPOSTAL uniquement), périmètre limité aux communes affiliées ANMSM.

### Architecture retenue : pré-indexation + microservice

```
Script sync → XML brut (750 MB total) → JSON compact (5-10 MB total)
Microservice → charge JSON au démarrage → index Map<code_postal, items[]>
Route territoire → fetchTourinsoft(code_postal) → champ tourinsoft dans ResultatCommune
```

### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `microservice/scripts/sync-tourinsoft.ts` | Télécharge et parse les 5 flux XML → JSON compacts dans `cache/tourinsoft/` |
| `microservice/services/tourinsoft.ts` | Charge les JSON en RAM, indexe par code_postal, expose les fonctions getXxxParCp() |
| `microservice/routes/tourinsoft.ts` | Endpoints Express : /tourinsoft/resume, /station, /hebergements, /activites, /commerces |

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `microservice/index.ts` | Import + route `/tourinsoft` + `chargerTourinsoft()` au démarrage |
| `microservice/package.json` | Script `sync-tourinsoft` ajouté |
| `app/api/territoire/analyser/route.ts` | `fetchTourinsoft(code_postal)` en parallèle des stocks DATA Tourisme, champ `tourinsoft` dans `ResultatCommune` |

### Mise en service

```bash
# 1. Lancer la sync une première fois (~5-15 min)
cd microservice && npm run sync-tourinsoft

# 2. Redémarrer le microservice
npm run dev
```

### Comportement runtime

- `tourinsoft: null` → commune hors périmètre ANMSM (pas une station affiliée)
- `tourinsoft.station: null` → commune dans un code postal sans station enregistrée
- Erreur microservice → `null` silencieux (pas bloquant pour l'analyse)

---

## Onglet Visibilité digitale — Vue 1 : Écosystème digital (2026-03-04)

### Objectif

Nouvel onglet dans la navbar (`/ecosystem`) permettant de cartographier l'écosystème digital d'une destination touristique en 3 étapes : détection automatique des acteurs officiels via Google, validation/édition de la liste, enrichissement SEO avec métriques de visibilité.

### Fichiers créés

```
types/ecosystem.ts                                  → DetectedSite, ClassifiedSite, EnrichedSite, HaloscanData
lib/scores.ts                                       → computeAuthorityScore (60% position + 40% trafic log)
lib/formatters.ts                                   → formatTraffic, formatPosition

app/api/ecosystem/serp/route.ts                     → DataForSEO SERP live/advanced depth:20
app/api/ecosystem/classify/route.ts                 → OpenAI gpt-5-mini + fallback regex
app/api/ecosystem/enrich/route.ts                   → Haloscan bulk
app/api/ecosystem/save/route.ts                     → Supabase INSERT ecosystem_analyses
app/api/ecosystem/history/route.ts                  → Supabase GET (20 dernières) + DELETE

components/ecosystem/EcosystemView.tsx              → Orchestrateur 3 étapes + historique + auto-save
components/ecosystem/StepDetection.tsx              → Formulaire + états loading animés
components/ecosystem/StepValidation.tsx             → Liste éditable + ajout manuel de domaines
components/ecosystem/StepResults.tsx                → Tableau trié + phrase de synthèse
components/ecosystem/SiteCard.tsx                   → Carte individuelle (select catégorie + suppression)
components/ecosystem/AuthorityBar.tsx               → Barre de progression 0–100 colorée

app/ecosystem/page.tsx                              → Server Component auth guard

supabase/migrations/006_ecosystem_analyses.sql      → Table + index + RLS
components/layout/Navbar.tsx                        → Ajout lien "Visibilité digitale" → /ecosystem
```

### Décisions techniques notables

**DataForSEO SERP — capture Local Pack**
- Initialement, seuls les `organic` items étaient capturés → la mairie/OT absents de la SERP organique (ex : `alpedhuez-mairie.fr`) n'étaient pas détectés
- Correction : capturer aussi les items `type === 'local_pack'` et leurs sous-items (domain, url, title, address)
- Sites du Local Pack ont `serpPosition: null` → authorityScore calculé sur trafic uniquement

**Classification OpenAI → Chat Completions (pas Responses API)**
- La Responses API (`POST /v1/responses`) ne supporte pas `response_format: { type: "json_object" }`
- Pour la classification, on reste sur `POST /v1/chat/completions` avec `response_format: { type: "json_object" }` pour obtenir du JSON garanti
- Modèle : `gpt-5-mini` dans les deux cas

**Haloscan bulk**
- Endpoint `/api/domains/bulk` (pas `/api/domains/overview` qui ne traite qu'un domaine à la fois)
- Les domaines absents de la réponse → `haloscanFound: false`, métriques `null`
- Fallback gracieux total : si Haloscan échoue, tous les domaines reviennent avec `haloscanFound: false`

**Sauvegarde non bloquante**
- Le `fetch('/api/ecosystem/save')` est fire-and-forget (pas de `await`)
- L'utilisateur voit les résultats immédiatement ; le badge "Sauvegardé" apparaît 1–2s après

**Historique panneau latéral**
- Affiché uniquement à l'étape 1 (formulaire) — pas de distraction pendant les étapes 2/3
- Clic → saute directement à l'étape Résultats sans refaire l'analyse (économie API)

### Coûts estimés par analyse

| API | Coût | Nb appels |
|-----|------|-----------|
| DataForSEO SERP | ~0.003 $ | 1 |
| OpenAI gpt-5-mini | ~0.0015 $ | 1 |
| Haloscan bulk | ~1 crédit / site indexé trouvé | 1 |

### Migration à appliquer

```sql
-- supabase/migrations/006_ecosystem_analyses.sql
-- Appliquer via Supabase Dashboard → SQL Editor ou supabase db push
```

---

## Vue 3 — Analyse d'un lieu touristique (2026-03-04)

### Objectif

Deuxième outil dans la section "Visibilité digitale". L'utilisateur saisit le nom d'un lieu touristique et sa commune. L'outil analyse sa présence digitale (site, GMB, SERP) et la compare à celle de la commune.

### Fichiers créés

```
types/place.ts                                    → CommuneDetection, PlaceSerpResult, PlaceGMB,
                                                     CommuneSerpResult, PlaceHaloscanData, PlaceDiagnostic, PlaceData

app/api/place/serp-place/route.ts                 → DataForSEO SERP organic + Maps + classification GPT acteurs
app/api/place/serp-commune/route.ts               → DataForSEO SERP commune + détection mentionsPlace
app/api/place/ranked-place/route.ts               → Haloscan bulk lieu + commune (1 appel)
app/api/place/diagnostic-insights/route.ts        → OpenAI headline + recommandations
app/api/place/detect-commune/route.ts             → (non utilisé — IA détectait la commune, abandonné)

app/place/page.tsx                                → Server Component auth guard → PlaceView

components/place/PlaceView.tsx                    → Orchestrateur — 2 champs → analyse → résultats
components/place/StepInput.tsx                    → Formulaire : nom du lieu + commune + Lancer
components/place/StepResults.tsx                  → Résultats scrollables (4 sections)
components/place/DiagnosticBanner.tsx             → Headline GPT + badges + recommandations
components/place/SectionExistence.tsx             → SERP lieu + fiche GMB côte à côte
components/place/SectionCommuneContent.tsx        → SERP commune + surlignage des mentions
components/place/SectionComparison.tsx            → Tableau comparatif Haloscan + phrase de contexte

components/layout/VisibiliteTabNav.tsx            → Sous-navigation partagée Écosystème / Lieu touristique
```

### Fichiers modifiés

```
components/layout/Navbar.tsx         → "Visibilité digitale" actif sur /ecosystem ET /place
app/ecosystem/page.tsx               → Ajout VisibiliteTabNav
app/place/page.tsx                   → Ajout VisibiliteTabNav
components/ecosystem/EcosystemView.tsx → sticky top-28 (navbar + tab nav)
app/api/ecosystem/classify/route.ts  → max_completion_tokens, sans temperature, sans response_format
```

### Décisions techniques

**Saisie manuelle de la commune**
- Premier design : GPT détectait la commune depuis le nom du lieu → retournait `content: ""` avec `gpt-5-mini`
- Décision : saisie manuelle — formulaire avec 2 champs. Plus fiable, plus rapide.
- La route `detect-commune` est conservée dans le code mais n'est pas appelée.

**Contraintes gpt-5-mini (découvertes en prod)**
- `max_tokens` → remplacer par `max_completion_tokens`
- `temperature: 0.2` → non supporté, supprimer le paramètre
- `response_format: { type: 'json_object' }` → retourne `content: ""`, ne pas utiliser
- Correction appliquée à TOUTES les routes OpenAI du projet (ecosystem/classify + toutes les routes place)

**Haloscan bulk optimisé**
- Un seul appel pour le lieu ET la commune (si deux domaines différents)
- Domaines détectés depuis les SERP results : `LIEU_OFFICIEL` → placeDomain, `COMMUNE_OT` → communeDomain

**Navigation Visibilité digitale**
- Navbar : lien unique "Visibilité digitale" → `/ecosystem`
- `VisibiliteTabNav` : composant `'use client'` réutilisé sur les deux pages
- Détection de la page active via `usePathname()`

### Coûts estimés par analyse complète

| API | Coût | Appels |
|-----|------|--------|
| DataForSEO SERP x2 | ~0.006 $ | 2 |
| DataForSEO Maps | ~0.003 $ | 1 |
| OpenAI classification | ~0.001 $ | 1 |
| Haloscan bulk | 1-2 crédits | 1 |
| OpenAI diagnostic | ~0.001 $ | 1 |

---

## Vue 2 — Score de visibilité — Présence commerciale SERP (2026-03-04)

### Objectif

Enrichir la Vue Score de visibilité avec la détection des acteurs qui capturent du trafic commercial via Google Ads, Google Hotels Pack et les sites OTA mis en avant (compare_sites), sur le SERP principal + les 7 SERPs commerciales.

### Problème initial — endpoint inexistant

Tentative d'utiliser `/serp/google/paid/live/advanced` → **erreur 40402 Invalid Path**. Cet endpoint n'existe pas dans l'API DataForSEO. Validation via script direct `test-paid-serp.js`.

**Solution** : les items payants (`paid`, `hotels_pack`, `compare_sites`) sont inclus dans la réponse de l'endpoint organique standard.

### Problème secondaire — paid items vides

Pour "hébergement les 7 laux", DataForSEO ne retourne pas d'items `paid` : les 4 annonces visibles dans le navigateur sont **géo-personnalisées** — DataForSEO crawle depuis des serveurs neutres qui ne les reçoivent pas.

**Solution** : étendre la détection aux 3 types de blocs commerciaux :
- `paid` → annonces Google Ads (si présentes)
- `hotels_pack` → Google Hotels Pack (agrégateurs hébergements)
- `compare_sites` → sites OTA mis en avant (Airbnb, Ski Planet, Booking…)

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `types/visibility.ts` | Ajout `HotelsPackItem`, `CompareSiteItem`, `SerpCommercialPresence` ; mise à jour `PaidAdByQuery` (`.ads` → `.presence`) ; ajout `hotelsPackMain`, `compareSitesMain` dans `VisibilityData` |
| `app/api/visibility/serp-main/route.ts` | Extraction `hotels_pack` + `compare_sites` depuis la réponse organique ; retour `hotelsPackMain`, `compareSitesMain` |
| `app/api/visibility/serp-commercial/route.ts` | Extraction `paid` + `hotels_pack` + `compare_sites` par requête → `SerpCommercialPresence` par query |
| `components/visibility/VisibilityView.tsx` | Propagation `hotelsPackMain`, `compareSitesMain` vers `SectionNominal` |
| `components/visibility/SectionNominal.tsx` | Remplacement du bloc "pub" par section unifiée "Présence commerciale" (amber/sky/violet) — s'affiche si au moins 1 type est présent |
| `components/visibility/SectionCommercial.tsx` | Remplacement `PaidAdsBlock` par `CommercialPresenceBlock` + `PresenceItem` — affiche paid/hotels/compare par requête |

### Règles d'affichage

- Le bloc "Présence commerciale" ne s'affiche que si au moins un des 3 types est non vide
- `hotels_pack.items` peuvent avoir `domain: null` et `url: null` → affichage texte-only
- `compare_sites.items` ont toujours `domain` et `url` → affichage avec lien cliquable
- Couleurs : Ads = amber, Hotels = sky, Compare sites = violet

---

## Correctifs Vue Score de visibilité (2026-03-04 — session 2)

### 1. Tourinsoft — priorité sur DATA Tourisme dans l'onglet Territoire

**Problème** : impossible de dédoublonner les données Tourinsoft et DATA Tourisme de manière fiable (pas de pivot commun entre les IDs SITRA2_XXX / 38AAHEB et les `dc:identifier` DATA Tourisme — ~10% de correspondance seulement).

**Décision** : si Tourinsoft retourne des données pour le code postal → les utiliser directement. Sinon → fallback DATA Tourisme.

**Implémentation** (`app/api/territoire/analyser/route.ts`) :
- Ajout de `tourinsofrVersEtablissements()` : convertit les items Tourinsoft en `Etablissement[]` (hebergements + poi = activites + commerces)
- Logique de priorité : `const { hebergements, poi } = tourinsoft ? tourinsofrVersEtablissements(tourinsoft) : stocks`
- Catégories : hébergements → `'hebergements'`, activités → `'activites'`, commerces → `'services'`
- ⚠️ Littéraux string doivent être castés `as const` pour satisfaire le type union

### 2. ETV calculé côté serveur pour ranked_keywords

**Problème** : DataForSEO Labs `ranked_keywords/live` ne retourne PAS de champ `etv` dans les items (uniquement `se_type`, `keyword_data`, `ranked_serp_element`).

**Solution** (`app/api/visibility/ranked/route.ts`) : ETV calculé via CTR × volume.

CTR par position (benchmarks Sistrix/AWR) :
```
pos1=28%, pos2=15%, pos3=11%, pos4=8%, pos5=7%
pos6=5%, pos7=4%, pos8=3%, pos9=3%, pos10=2%
pos11-20=1%, pos21+=0.5%
```

`etv: Math.round(searchVolume * ctrParPosition(position))`

Champ `etv: number` ajouté au type `RankedKeyword` dans `types/visibility.ts`.

### 3. Section sémantique — colonne droite refactorisée

**Avant** : colonne droite = "Positionnés TOP10" (liste statique des mots-clés en pos ≤ 10).

**Après** : colonne droite = "Top 20 mots-clés — page la plus trafiquée".
- Sélection de l'URL principale = celle qui cumule le plus d'ETV parmi tous les mots-clés positionnés
- Top 20 mots-clés de cette URL, triés par ETV décroissant
- Affichage : mot-clé + position + trafic estimé

### 4. Normalisation mots-clés — fix opportunités manquées

**Problème** : "station alpe d'huez" (apostrophe typographique de DataForSEO) n'était pas matché avec "alpe d'huez" (ASCII) du corpus de marché.

**Solution** (`components/visibility/SectionSemantic.tsx`) : fonction `norm()` appliquée aux deux ensembles avant comparaison :
```ts
function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // supprime accents
    .replace(/[''`]/g, ' ')                              // apostrophes → espace
    .replace(/\s+/g, ' ').trim()
}
```

**Colonne gauche** : mots-clés du marché (related keywords) **absents** de TOUS les mots-clés positionnés du domaine (toutes URLs), triés par volume décroissant, top 20.

### 5. Historique visibilité — bouton "Consulter"

**Problème** : le panneau historique permettait uniquement de sélectionner une analyse pour comparaison — impossible de la rouvrir directement.

**Solution** (`components/visibility/VisibilityView.tsx`) :
- `loadingId: string | null` : état de chargement
- `loadAnalysis(id)` : `GET /api/visibility/analysis/${id}` → récupère `resultats` JSONB → `setData(analysis.resultats)` → ferme le panneau historique
- Bouton œil (👁) ajouté à côté de chaque entrée dans `HistoryPanel` — distinct du bouton de comparaison
- Props ajoutées : `onLoad: (id) => void` + `loadingId: string | null`
- Route Supabase utilisée : `app/api/visibility/analysis/[id]/route.ts` (déjà existante)

---

## Correctifs audit Mégève (2026-02-26)

### Bug 1 — Phase B ne se lançait pas

- `handleConfirmKeywords` fire-and-forget → erreurs silencieuses
- `useEffect` modale se déclenchait à chaque tick polling pendant Segment B

Correction : états `segmentEnCours` + `erreurSegment`, `async/await` avec `try/catch`, bannière erreur + bouton "Réessayer".

### Bug 2 — Volume d'affaires — diagnostic EPCI

Ajout `diagnostic_epci?: 'epci_non_resolu' | 'epci_taxe_non_trouvee' | 'commune_taxe_non_trouvee' | 'ok'` dans `ResultatVolumeAffaires`.

### Bug 3 — Stock en ligne — getBbox non bloquant

`getBbox()` entouré `try/catch` → `bbox = null` si microservice indisponible → Airbnb passe en mode nom-de-ville.

### Prefetch bbox en Segment A

```
Segment A  →  GET localhost:3001/bbox  →  sauvegarderBbox(audit_id, bbox)  →  resultats.bbox
Segment C  →  lireBbox(audit_id)  →  scraperAirbnb(browser, bbox, destination)
```

Règle : on ne sauvegarde jamais `null` en Supabase. Si microservice indisponible en Segment A → Segment C retente directement.
