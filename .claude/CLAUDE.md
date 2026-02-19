# Valtools-audit — Contexte de session
> Dernière mise à jour : 2026-02-19
> ⚠️ Lis ce fichier en entier avant toute action. Ne commence jamais à coder sans l'avoir lu.

---

## Description du projet
Application SaaS d'audit digital pour destinations touristiques françaises.
Objectif : générer des rapports structurés révélant le potentiel de transformation
digitale d'une destination, utilisés comme outil de vente de conseil.

---

## Stack technique
- Framework : Next.js 16 (App Router, TypeScript strict)
- Style : Tailwind CSS 4
- BDD : Supabase (PostgreSQL)
- APIs : DataForSEO, Datatourisme, HaloScan, PageSpeed, DuckDuckGo, DGFiP, Apify
- Export : Google Docs & Google Slides (templates dans `ressources/`)
- IA : OpenAI GPT-4o-mini (principal) + Gemini 2.0-flash (fallback)

---

## Dossier Ressources
Le dossier `ressources/` contient :
- `Charte graphique Valraiso.pdf` — Charte graphique
- `Philosophie et process.pdf` — Méthodologie détaillée par module
- `Boite a outils.pdf` — Clés API, credentials, templates export
- `identifiants-communes-2024.csv` — Référentiel communes INSEE
- `identifiants-epci-2024.csv` — Référentiel EPCI
- `identifiants-departements-2024.csv` — Référentiel départements
- `identifiants-regions-2024.csv` — Référentiel régions
- `identifiants-collectivites-2024.csv` — Référentiel collectivités

**Consulte ce dossier en priorité avant tout développement.**

---

## Les 7 Modules d'Audit

| # | Module | Route API | Outils principaux |
|---|--------|-----------|-------------------|
| 1 | Notoriété | `/api/audit/notoriete` | Datatourisme, DataForSEO, Apify/DuckDuckGo, OpenAI |
| 2 | Volume d'Affaires | `/api/audit/volume-affaires` | DGFiP (data.economie.gouv.fr), OpenAI |
| 3 | Schéma Digital | `/api/audit/schema-digital` | DataForSEO SERP, PageSpeed API, OpenAI |
| 4 | Audit SEO | `/api/audit/seo` | HaloScan, DataForSEO SERP+PAA, OpenAI |
| 5 | Stocks Physiques | `/api/audit/stocks-physiques` | Datatourisme (par Code INSEE), OpenAI |
| 6 | Stocks Commerciaux | `/api/audit/stocks-commerciaux` | DataForSEO (Google Dorking), OpenAI |
| 7 | Benchmark Concurrentiel | `/api/audit/benchmark` | CSV communes, DuckDuckGo, DataForSEO, OpenAI |

---

## Architecture des fichiers clés

```
src/
├── app/
│   ├── page.tsx                     # Page d'accueil (placeholder)
│   ├── monitoring/page.tsx          # Dashboard suivi conso API
│   └── api/
│       ├── audit/
│       │   ├── notoriete/route.ts
│       │   ├── volume-affaires/route.ts
│       │   ├── schema-digital/route.ts
│       │   ├── seo/route.ts
│       │   ├── stocks-physiques/route.ts
│       │   ├── stocks-commerciaux/route.ts
│       │   └── benchmark/route.ts
│       └── monitoring/route.ts      # API données monitoring
├── services/                        # Logique métier (1 fichier par module)
│   ├── notoriete.service.ts
│   ├── volume-affaires.service.ts
│   ├── schema-digital.service.ts
│   ├── seo.service.ts
│   ├── stocks-physiques.service.ts
│   ├── stocks-commerciaux.service.ts
│   └── benchmark.service.ts
├── lib/
│   ├── supabase.ts                  # Client Supabase
│   ├── llm.ts                       # OpenAI + Gemini (fallback)
│   ├── dataforseo.ts                # SERP, Maps, Reviews, Results Count
│   ├── datatourisme.ts              # POI, hébergements, activités
│   ├── haloscan.ts                  # Volumes mots-clés
│   ├── pagespeed.ts                 # Google PageSpeed Insights
│   ├── duckduckgo.ts                # Recherche web (sans clé)
│   ├── dgfip.ts                     # Taxes de séjour (data.economie.gouv.fr)
│   ├── apify-instagram.ts           # Scraping hashtags Instagram
│   ├── communes.ts                  # Chargement CSV communes/EPCI
│   ├── api-tracker.ts               # Wrapper trackApiCall()
│   └── api-costs.ts                 # Grille de coûts centralisée
└── types/
    └── audit.ts                     # Types Input/Output par module
```

---

## Schéma Supabase

```sql
audits        (id UUID, destination, code_insee, status, created_at, completed_at)
audit_results (id UUID, audit_id FK, module, data JSONB, error, created_at)
api_usage     (id UUID, audit_id FK, api_name, endpoint, tokens_used, cost_euros, response_time_ms, status, created_at)
```

Migrations : `supabase/migrations/001_init.sql`, `002_api_usage.sql`

---

## Règles strictes

### Usage IA (coûts)
- OpenAI autorisé **uniquement** pour les tâches qualitatives (sentiment, diagnostics, classification)
- Tout ce qui est calculable algorithmiquement → pas de LLM
- Gemini 2.0-flash en fallback automatique si OpenAI échoue

### Tracking API obligatoire
Chaque appel API doit être encapsulé dans `trackApiCall()` (src/lib/api-tracker.ts).
Les coûts sont estimés via la grille dans `api-costs.ts`.

### Test avant validation
1. Écrire le code
2. Tester avec une destination réelle (ex: Chamonix 74400)
3. Vérifier l'absence de régression
4. Ne valider que si tout est vert

### Exports
Tous les exports doivent utiliser les templates fournis dans `ressources/`.

### Sécurité
Clés API dans `.env.local` uniquement. Jamais en dur. Jamais committées.

---

## État d'avancement
> ⚠️ Section générée à partir de l'état réel du code. Mettre à jour à la fin de chaque session.

### ✅ Terminé
- 7 services backend complets (notoriété, volume d'affaires, schéma digital, SEO, stocks physiques, stocks commerciaux, benchmark)
- 7 routes API fonctionnelles (POST, avec création audit Supabase + sauvegarde résultats)
- 12 clients API dans src/lib/ (DataForSEO, Datatourisme, HaloScan, PageSpeed, DuckDuckGo, DGFiP, Apify, OpenAI, Gemini, communes)
- Types TypeScript complets (Input/Output pour chaque module)
- Schéma Supabase : tables audits, audit_results, api_usage
- Système de tracking API : wrapper trackApiCall(), grille de coûts, intégré dans les 7 services (43 appels trackés)
- Page monitoring `/monitoring` : KPIs globaux, détail par API, détail par audit, alertes automatiques (>2€, >70% LLM)
- API monitoring GET `/api/monitoring`
- **Module 2 réécrit** : DGFiP commune (7311/7321/7323) + EPCI/GFP (7346/7351/7352), fallback année 2024→2022, mapping commune→EPCI via geo.api.gouv.fr, diagnostic IA avec niveau, testé Chamonix (3.75M€ EPCI) et Saint-Bonnet-le-Froid

### 🔄 En cours
- Aucun chantier en cours

### ⏳ À faire
- Page d'accueil / interface utilisateur (formulaire de lancement d'audit)
- Système d'export Google Docs / Google Slides
- Tests unitaires et d'intégration
- Authentification utilisateur
- Gestion multi-utilisateurs / multi-organisation
- Orchestrateur d'audit complet (lancer les 7 modules en séquence)

---

## Comment démarrer une nouvelle session

1. Tu as lu ce fichier ✓
2. Vérifie la section **État d'avancement** pour savoir où on en est
3. Confirme avec l'utilisateur : *"Je reprends sur [SUJET], c'est bien ça ?"*
4. Attends la validation avant de coder
