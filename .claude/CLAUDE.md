# Valtools-audit — Contexte de session
> Dernière mise à jour : 2026-02-19

## Description du projet
Application SaaS d'audit digital pour destinations touristiques françaises.
Objectif : générer des rapports structurés révélant le potentiel de transformation
digitale d'une destination, utilisés comme outil de vente de conseil.

---

## Stack technique
- Framework : Next.js (App Router, TypeScript strict)
- Style : Tailwind CSS
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

## Règles strictes
- OpenAI uniquement pour les tâches qualitatives (sentiment, diagnostics, classification)
- Tout ce qui est calculable algorithmiquement → pas de LLM
- Gemini 2.0-flash en fallback automatique si OpenAI échoue
- Clés API dans `.env.local` uniquement. Jamais en dur. Jamais committées.
- Tester avec une destination réelle (ex: Chamonix 74400) avant de valider

---

## État d'avancement

### ✅ Terminé
- RAZ complète du projet (2026-02-19)

### ⏳ À faire
- Tout est à reconstruire

---

## Comment démarrer une nouvelle session

1. Tu as lu ce fichier ✓
2. Vérifie la section **État d'avancement** pour savoir où on en est
3. Consulte `ressources/Philosophie et process.pdf` pour la méthodologie
4. Confirme avec l'utilisateur le chantier du jour avant de coder
