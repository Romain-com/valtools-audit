# Contexte Projet — Valtools-audit

## Description
Application SaaS d'audit digital pour destinations touristiques.
Objectif : générer des rapports structurés révélant le potentiel de transformation
digitale d'une destination, utilisés comme outil de vente de conseil.

## Dossier Ressources
Un dossier `ressources/` est présent à la racine du projet. Il contient :
- La charte graphique
- Le référentiel des communes
- La méthodologie détaillée par bloc d'audit
- La boîte à outils (clés API, credentials, templates)

**Tu dois consulter ce dossier en priorité avant tout développement.**
Tes choix de design, structure de données et logique métier doivent s'y conformer.

## Les 7 Modules d'Audit

| # | Module | Sources de données |
|---|--------|--------------------|
| 1 | Notoriété | Instagram, avis Google/TripAdvisor |
| 2 | Volume d'Affaires | Taxe de séjour (DGFiP) |
| 3 | Schéma Digital | PageSpeed Insights, inventaire URLs |
| 4 | Audit SEO | DataForSEO (HaloScan), SERP |
| 5 | Stocks Physiques | API Datatourisme |
| 6 | Stocks Commerciaux | Airbnb / Booking (via DuckDuckGo scraping) |
| 7 | Benchmark Concurrentiel | Algorithme INSEE |

## Stack Technique

- **Framework** : Next.js 14+ (App Router, TypeScript)
- **Style** : Tailwind CSS
- **BDD** : Supabase (PostgreSQL)
- **APIs principales** : DataForSEO, Datatourisme, DuckDuckGo, PageSpeed
- **Export** : Google Docs & Google Slides (via templates dans `ressources/`)
- **IA** : OpenAI API (usage restreint — voir règle ci-dessous)

## Règles Strictes

### Règle 1 — Usage de l'IA (OpenAI)
L'API OpenAI (avec web browsing) est autorisée **uniquement** pour des tâches
qualitatives ciblées (ex : analyser l'ambiance visuelle d'une page d'accueil).
Pour toutes les données quantitatives (comptages, classements, métriques SEO),
utilise **exclusivement** la stack technique définie. Objectif : maîtrise des coûts.

### Règle 2 — Test obligatoire avant validation
À chaque nouvelle feature, tu dois :
1. Écrire le code
2. Exécuter les tests (unitaires et/ou d'intégration)
3. Vérifier qu'aucune régression n'est introduite
4. **Valider seulement si tout est vert**

### Règle 3 — Exports
Tous les exports de données doivent utiliser les templates fournis dans `ressources/`
pour être compatibles avec Google Docs et Google Slides.

### Règle 4 — Sécurité des credentials
Toutes les clés API, tokens et credentials se trouvent dans la boîte à outils
du dossier `ressources/` et dans le fichier `.env.local`.
Ne jamais les coder en dur dans le code source. Ne jamais les committer.
