# CLAUDE.md — Destination Digital Audit App
> Fichier lu automatiquement par Claude Code à chaque session.
> Ne pas modifier sans mettre à jour CONTEXT.md en parallèle.

---

## Ce que fait cette application

Outil interne d'audit du potentiel de transformation digitale d'une destination touristique française. L'utilisateur saisit un nom de commune, l'app collecte des données via plusieurs APIs et affiche des résultats structurés par bloc, avec des contenus texte générés par OpenAI prêts à copier-coller dans des templates GDoc/GSlides.

---

## Stack technique

- **Framework** : Next.js (App Router)
- **Style** : Tailwind CSS
- **Base de données** : Supabase (Postgres + Realtime + Auth)
- **Authentification** : Supabase Auth (rôles : admin / collaborateur)
- **Environnement** : Mac local uniquement — pas de déploiement public prévu

---

## Règles de code — à respecter absolument

1. **Tous les appels API côté serveur** via Route Handlers Next.js. Jamais de clé API côté client.
2. **Un fichier = un module = une responsabilité.** Ne pas regrouper plusieurs logiques dans un même fichier.
3. **Commentaires en français** dans tout le code.
4. **Chaque phase de développement est rangée dans une section dédiée** — ne jamais mélanger le code de plusieurs phases.
5. **Tester chaque module indépendamment** avant de passer au suivant.
6. **À chaque fin de phase** : mettre à jour CONTEXT.md + push GitHub.
7. **Économiser les tokens OpenAI** : requêtes courtes, JSON structuré, modèle `gpt-5-mini` uniquement.
8. **Toujours prévoir un fallback** sur chaque appel API — une erreur ne doit jamais bloquer tout l'audit.

---

## Structure de dossiers

Claude Code définit la structure. Elle doit respecter les conventions Next.js App Router et isoler chaque module API dans son propre fichier.

---

## SIREN — clé centrale

- Le SIREN est l'identifiant unique de chaque destination en base.
- Il est verrouillé dès la sélection de la commune — ne jamais le modifier après.
- **Pas de doublon** : si le SIREN existe déjà en base, proposer mise à jour ou annulation.
- Source : fichiers CSV locaux lus par le microservice (jamais uploadés sur Supabase).

---

## APIs — Référence rapide

### DataForSEO — Basic Auth
```
LOGIN=mickael.challet@top10-strategie.fr
PASSWORD=4e494b70cde62abb
```
**SERP organique**
```
POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced
{ "keyword": "...", "language_code": "fr", "location_code": 2250, "depth": 10 }
```
⚠️ Toujours filtrer `item.type === "organic"` — jamais d'index fixe sur le tableau.

**Google Maps**
```
POST https://api.dataforseo.com/v3/serp/google/maps/live/advanced
{ "keyword": "Office de tourisme [destination]", "language_code": "fr", "location_code": 2250, "depth": 10 }
```
⚠️ **Une seule tâche par requête** (array à 1 élément) — sinon erreur `40000`.
⚠️ Timeout axios : **60 000ms minimum** (30s provoque des timeouts).
⚠️ Pattern : 2 appels par audit — destination seule + "Office de tourisme [destination]".
⚠️ Si fiche OT absente → flag `ot_fiche_manquante: true`, ne pas bloquer.

---

### OpenAI — Bearer
```
OPENAI_API_KEY=sk-proj-V2iayBm71Rm...
```
```
POST https://api.openai.com/v1/chat/completions
{ "model": "gpt-5-mini", "temperature": 0.2, "max_tokens": 300 }
```
⚠️ Toujours demander du JSON pur dans le prompt : "Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires)".
⚠️ Parser systématiquement : `JSON.parse(raw.replace(/```json\n?|```/g, '').trim())`

---

### Apify — Token
```
APIFY_API_TOKEN=apify_api_r47zaja0...
```
**Pattern run-sync (tous actors)**
```
POST https://api.apify.com/v2/acts/ACTOR_SLUG/run-sync-get-dataset-items?token=TOKEN&timeout=90
Axios timeout : 120 000ms
```
**postsCount hashtag** → actor `apify~instagram-hashtag-stats`
```json
{ "hashtags": ["nom_destination"], "maxItems": 1 }
```
**Posts individuels** → actor `apify~instagram-hashtag-scraper`
```json
{ "hashtags": ["nom_destination"], "resultsLimit": 10 }
```
⚠️ Ne jamais utiliser `apify/instagram-scraper` (pas de postsCount) ni `compass~crawler-google-places` (trop lent).

---

### Haloscan — Header
```
HALOSCAN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
```
POST https://api.haloscan.com/api/domains/overview
Headers: { "haloscan-api-key": "TOKEN" }
Body: { "input": "domaine.com", "mode": "domain", "requested_data": ["metrics", "best_keywords", "best_pages"] }
```
⚠️ Coût : 1 crédit site par appel.
⚠️ Fallback obligatoire :
```javascript
if (data.metrics?.errorCode === 'SITE_NOT_FOUND') {
  // Retourner { statut: "non_indexe" } et continuer
}
```
⚠️ PAS un outil backlinks — SEO keywords/trafic uniquement.
Doc de référence : YAML OpenAPI GitHub `occirank/haloscan`.

---

### Monitorank — Query param
```
MONITORANK_API_KEY=4648-80kpZC7othd7...
GET https://api.monitorank.com/?key=API_KEY&module=google&action=update
```
⚠️ Seul endpoint fonctionnel : `module=google&action=update`.
⚠️ Rate limit : 1 req/minute — délai 1.2s minimum entre appels.
⚠️ Tous les autres modules/actions → `"Non-existent action"` — ne pas tenter.

---

### data.economie.gouv.fr — Pas d'auth
```
GET https://data.economie.gouv.fr/explore/dataset/balances-comptables-des-communes-en-2024/api/
Filtrer par code INSEE de la commune.
```

---

### geo.api.gouv.fr — Pas d'auth
```
GET https://geo.api.gouv.fr/communes?nom=XXX&fields=nom,code,codesPostaux,codeDepartement,codeRegion,population&format=json&limit=3
```
⚠️ `code` = code INSEE — pas le code postal.

---

### Google PageSpeed — Clé Google Cloud
```
PAGESPEED_API_KEY= (à créer)
```
Pattern : 2 appels par domaine (mobile + desktop).

---

### Microservice DATA Tourisme local
```
DATA_TOURISME_API_URL=http://localhost:3001
GET /stocks?destination=XXX
```
Microservice Node.js Express tournant en local sur Mac.
Indexation légère au démarrage — ne jamais tout charger en RAM.

---

## Base de données Supabase

### Table `destinations` (1 ligne par SIREN — unique)
```sql
id UUID PK, nom TEXT, siren TEXT UNIQUE, code_insee TEXT,
code_postal TEXT, code_departement TEXT, code_region TEXT,
epci TEXT, population INT, slug TEXT UNIQUE,
created_at TIMESTAMP, updated_at TIMESTAMP, created_by UUID FK
```

### Table `audits`
```sql
id UUID PK, destination_id UUID FK, statut ENUM(en_cours/terminé/erreur),
resultats JSONB, couts_api JSONB, created_at TIMESTAMP
```
`resultats` contient un objet par bloc : positionnement, seo, social, technique, stocks, concurrents, contenus.
`couts_api` contient par API : nb_appels, cout_unitaire, cout_total.

### Table `competitors`
```sql
id UUID PK, audit_id UUID FK, nom TEXT, type ENUM(direct/indirect), metriques JSONB
```

### Table `users`
Gérée par Supabase Auth + champ `role ENUM(admin/collaborateur)`.

---

## Tracking des coûts API

Chaque module API doit retourner avec ses données :
```javascript
{ donnees: {...}, cout: { nb_appels: N, cout_unitaire: X, cout_total: Y } }
```
Ces valeurs sont agrégées dans le champ `couts_api` de la table `audits`.
Affichage dans l'interface : coût par audit + coût cumulé total.

---

## APIs abandonnées — ne pas utiliser

- ❌ **RapidAPI Instagram** : aucun endpoint hashtag accessible
- ❌ **Apify Google Maps** (`compass~crawler-google-places`) : timeout systématique
- ❌ **Google Docs/Slides/Drive API** : supprimé du scope — les contenus sont copiés-collés manuellement
- ❌ **Backlinks** : aucune API disponible dans le stack

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
PAGESPEED_API_KEY=
DATA_TOURISME_API_URL=http://localhost:3001
```
⚠️ Toujours utiliser `dotenv.config({ path: '.env.local' })` dans les scripts Node.
