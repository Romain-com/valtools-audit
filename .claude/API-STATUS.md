# Documentation APIs — Destination Digital Audit
> Rédigée d'après les tests réels effectués en février 2026 (Rounds 1, 2, 3).
> Destination de test : **Annecy** | Domaine OT : `lac-annecy.com`

---

## Sommaire rapide

| API | Statut | Usage |
|-----|--------|-------|
| data.gouv.fr Géo | ✅ Sans clé | Code INSEE, population, département |
| DataForSEO SERP | ✅ Basic Auth | Résultats organiques Google |
| DataForSEO Maps | ✅ Basic Auth | Fiches Google Maps (OT, notes, avis) |
| OpenAI gpt-4o-mini | ✅ Bearer | Positionnement marketing IA |
| Apify instagram-hashtag-stats | ✅ Token | postsCount hashtag |
| Apify instagram-hashtag-scraper | ✅ Token | Posts individuels (likes, username) |
| Monitorank | ⚠️ Token | Algo updates Google seulement |
| Haloscan | ✅ Header | SEO keywords/trafic (pas backlinks) |
| RapidAPI Instagram | ⚠️ Header | Abonné mais endpoints hashtag inaccessibles |
| Apify Google Maps | ❌ Trop lent | Remplacé par DataForSEO Maps |

---

## 1. data.gouv.fr — Géo API

**Aucune clé requise.**

### Endpoint qui fonctionne
```
GET https://geo.api.gouv.fr/communes
  ?nom=Annecy
  &fields=nom,code,codesPostaux,codeDepartement,codeRegion,population
  &format=json
  &limit=3
```

### Ce que ça retourne
Tableau JSON. Exemple pour Annecy :
```json
[{ "nom": "Annecy", "code": "74010", "population": 132117,
   "codeDepartement": "74", "codeRegion": "84",
   "codesPostaux": ["74000", "74370"] }]
```

### Points clés
- Résultat `[0]` = commune la plus pertinente (parfois plusieurs homonymes).
- `code` = code INSEE (pas le code postal — attention à la confusion).
- Très rapide, aucune limite connue sur les tests.
- Parfait comme première étape pour valider qu'une destination existe.

---

## 2. DataForSEO — SERP Google Organique

**Auth : Basic Auth (login + password)**
```
DATAFORSEO_LOGIN=mickael.challet@top10-strategie.fr
DATAFORSEO_PASSWORD=4e494b70cde62abb
```

### Endpoint
```
POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced
```

### Payload exact
```json
[{
  "keyword": "Annecy tourisme",
  "language_code": "fr",
  "location_code": 2250,
  "depth": 10
}]
```

### Structure de réponse — ce qui compte
```
data.tasks[0].status_code       → doit être 20000
data.tasks[0].result[0].items   → tableau des résultats
  item.type === "organic"       → filtrer uniquement les résultats organiques
  item.url                      → URL du résultat
  item.title                    → titre SEO
  item.description              → méta-description
  item.rank_absolute            → position absolue (1, 2, 3...)
```

### Piège découvert
- L'array `items` contient des types mixtes : `organic`, `paid`, `featured_snippet`, etc.
- **Toujours filtrer `item.type === "organic"`** sinon le comptage est faux.
- Pour Annecy : 7 résultats organiques retournés sur les 10 demandés (certains SERP n'ont pas 10 organiques purs).

### Résultats Annecy (référence)
```
#1 lac-annecy.com        — "Office de Tourisme du Lac d'Annecy..."
#2 tourisme-annecy.net   — "Guide touristique du lac d'Annecy..."
#3 annecy-ville.fr       — "Annecy : guide du tourisme | Haute-Savoie"
```

---

## 3. DataForSEO — Google Maps

**Auth : même Basic Auth que SERP**

### Endpoint
```
POST https://api.dataforseo.com/v3/serp/google/maps/live/advanced
```

### Payload exact
```json
[{
  "keyword": "Office de tourisme Annecy",
  "language_code": "fr",
  "location_code": 2250,
  "depth": 10
}]
```

### PIÈGE CRITIQUE : une seule tâche à la fois
L'endpoint `live/advanced` **n'accepte qu'un seul objet dans l'array**.
Envoyer deux tâches simultanément → erreur `40000 — "You can set only one task at a time"`.

### Structure de réponse
```
data.tasks[0].result[0].items  → tableau des fiches
  item.type === "maps_search"  → filtrer ce type
  item.title                   → nom de l'établissement
  item.rating.value            → note (ex: 4.3)
  item.rating.votes_count      → nombre d'avis (ex: 1701)
  item.address                 → adresse complète
  item.phone                   → téléphone
```

### Timeout
L'endpoint live est lent : mettre **60 secondes minimum** de timeout axios.
Avec 30s → timeout fréquent.

### Résultat Annecy (référence)
```
Office de Tourisme du Lac d'Annecy — Note 4.3 — 1 701 avis
```

---

## 4. OpenAI — Positionnement marketing

**Auth : Bearer**
```
OPENAI_API_KEY=sk-proj-...
```

### Endpoint
```
POST https://api.openai.com/v1/chat/completions
```

### Payload exact
```json
{
  "model": "gpt-4o-mini",
  "messages": [{ "role": "user", "content": "..." }],
  "temperature": 0.2,
  "max_tokens": 300
}
```

### Prompt qui fonctionne
Demander un JSON pur (sans markdown, sans commentaires) avec cette structure :
```json
{
  "axes_principaux": ["Nature/Montagne", "Lac/Eau douce"],
  "axes_secondaires": ["Patrimoine/Culture/Histoire", "Sports&Aventure"],
  "resume_positioning": "Résumé en 2 phrases.",
  "confiance": 0.9
}
```
**Important dans le prompt** : écrire "Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires)".

### Parsing de la réponse
```javascript
const raw = data.choices[0].message.content;
const json = JSON.parse(raw.replace(/```json\n?|```/g, '').trim());
```
Le modèle glisse parfois des backticks markdown — le `.replace()` est indispensable.

### Résultat Annecy (référence)
```
Axes principaux  : Nature/Montagne, Lac/Eau douce
Axes secondaires : Patrimoine/Culture/Histoire, Sports&Aventure, Bien-être/Slow travel
Confiance        : 0.9
```

---

## 5. Apify — Instagram Hashtag Stats (`postsCount`)

**⚠️ Actor différent des autres tests Apify !**
```
Actor : apify~instagram-hashtag-stats
Token : APIFY_API_TOKEN
```

### Découverte clé
Après avoir testé `apify/instagram-hashtag-scraper` et `apify/instagram-scraper` sans trouver
`postsCount`, c'est **`apify/instagram-hashtag-stats`** qui le retourne.
Les deux autres actors retournent des posts individuels mais pas le volume total du hashtag.

### Endpoint run-sync
```
POST https://api.apify.com/v2/acts/apify~instagram-hashtag-stats/run-sync-get-dataset-items
  ?token=TOKEN
  &timeout=90
```

### Payload
```json
{ "hashtags": ["annecy"], "maxItems": 1 }
```

### Structure de réponse
```json
{
  "name": "annecy",
  "postsCount": 2750000,
  "posts": "2.75 M",
  "postsPerDay": "—",
  "url": "https://www.instagram.com/explore/tags/annecy",
  "related": [
    { "hash": "#lyon", "info": "11.99 m" },
    { "hash": "#hautesavoie", "info": "2.06 m" }
  ],
  "frequent": [{ "hash": "#annecy", "info": "2.75 m" }],
  "average": [{ "hash": "#annecylake", "info": "418.98 k" }],
  "rare":    [{ "hash": "#lakeannecy", "info": "91.69 k" }]
}
```

### Bonus inattendu
L'actor retourne aussi les hashtags associés (fréquents/moyens/rares) — très utile pour
l'analyse de la stratégie hashtag d'une destination et les recommandations d'hashtags
complémentaires.

### Timeout
`timeout=90` dans l'URL Apify + `timeout: 120000` en axios. L'actor tourne en ~30-60s.

### Résultat Annecy
```
postsCount : 2 750 000
```

---

## 6. Apify — Instagram Hashtag Scraper (posts individuels)

```
Actor : apify~instagram-hashtag-scraper
```

### Ce que ça retourne (posts individuels — PAS le volume total)
```
inputUrl, id, type, shortCode, caption, hashtags, mentions, url,
commentsCount, firstComment, latestComments, dimensionsHeight, dimensionsWidth,
displayUrl, images, likesCount, timestamp, childPosts, locationName,
locationId, ownerFullName, ownerUsername, ownerId, productType, taggedUsers, musicInfo
```

### Ce que ça NE retourne PAS
`postsCount`, `mediaCount`, `taggedPostsCount` → **absent**. Instagram bloque ce champ
depuis 2023/2024. Utiliser `apify~instagram-hashtag-stats` pour le volume total.

### Payload
```json
{ "hashtags": ["annecy"], "resultsLimit": 10 }
```

### Timeout
`timeout=90` + axios `120000ms`. Respecter le timeout Apify dans l'URL.

---

## 7. Apify — Google Maps Scraper

**⚠️ Remplacé par DataForSEO Maps — trop lent.**

```
Actor : compass~crawler-google-places
```

### Problème rencontré
L'actor run-sync dépasse le timeout Apify même à 300s.
```json
{ "error": { "type": "run-timeout-exceeded",
             "message": "Actor run exceeded the timeout of 300 seconds" } }
```

### Décision
→ Utiliser **DataForSEO Maps** à la place (résultats en <60s, même données).

---

## 8. Monitorank

**Auth : query param `key=API_KEY`**
```
MONITORANK_API_KEY=4648-80kpZC7othd7...
```

### Seul endpoint fonctionnel confirmé
```
GET https://api.monitorank.com/
  ?key=API_KEY
  &module=google
  &action=update
```

### Ce que ça retourne
Liste des mises à jour d'algorithme Google :
```json
{
  "result": true,
  "data": [
    { "name": "December 2025 core update", "date": "2025-12-11",
      "description": "https://status.search.google.com/..." },
    { "name": "August 2025 spam update", "date": "2025-08-26" }
  ]
}
```
36 updates disponibles au moment du test.

### Tous les autres endpoints → échec
Tous les modules testés (`sites`, `projects`, `keywords`, `positions`, `rankings`, etc.)
et toutes les actions (sauf `update`) retournent `"Non-existent action"`.

### Rate limit
~1 requête par minute. Dépasser → `"You have reached the call limit in one minute"`.
Mettre un délai de 1.2s minimum entre chaque appel.

### Conclusion d'architecture
Monitorank API publique = **données algo Google uniquement**.
Les positions keyword d'un domaine nécessitent un projet pré-configuré dans l'interface
web (account.monitorank.com) avec un délai de 24-48h. Non utilisable à la demande.

→ Pour les positions SEO en temps réel : **utiliser DataForSEO SERP** (déjà intégré).
→ Monitorank reste utile pour : "Y a-t-il eu un algo Google récent qui pourrait expliquer
  une chute de trafic ?"

---

## 9. Haloscan

**Auth : header `haloscan-api-key`**
```
HALOSCAN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### ⚠️ Haloscan = SEO keywords/trafic — PAS backlinks
Le nom prête à confusion. L'API Haloscan ne contient **aucun endpoint backlinks**.
C'est un outil de positionnement SEO (keywords positionnés, trafic organique estimé).

### Endpoints disponibles (OpenAPI vérifié)
```
GET  /api/user/credit              → crédits disponibles (test de connectivité)
POST /api/domains/overview         → métriques SEO d'un domaine
POST /api/domains/positions        → positions keyword détaillées
POST /api/domains/keywords         → keywords du domaine
POST /api/domains/topPages         → pages les plus performantes
POST /api/domains/history          → historique positions
POST /api/domains/siteCompetitors  → concurrents organiques
POST /api/keywords/overview        → données d'un keyword
POST /api/keywords/match           → keywords similaires
```

### Endpoint de vérification (sans consommer de crédit)
```
GET https://api.haloscan.com/api/user/credit
Headers: { "haloscan-api-key": "TOKEN" }
```
Retourne :
```json
{
  "totalCredit": {
    "creditSite": 2971, "creditKeyword": 13000, "creditExport": 762389,
    "creditRefresh": 13000, "creditBulkKeyword": 650, "creditBulkSite": 500
  }
}
```

### Endpoint principal : domains/overview
```
POST https://api.haloscan.com/api/domains/overview
Headers: { "haloscan-api-key": "TOKEN", "Content-Type": "application/json" }
Body: {
  "input": "tripadvisor.fr",
  "mode": "domain",
  "requested_data": ["metrics", "best_keywords", "best_pages"]
}
```

### Champs retournés dans `metrics.stats`
```
search_date          → date du dernier crawl
total_keyword_count  → nombre de mots-clés positionnés
total_traffic        → trafic organique estimé/mois
active_page_count    → pages indexées avec positions
top_3_positions      → nombre de mots-clés en top 3
top_10_positions     → nombre de mots-clés en top 10
top_50_positions     → nombre de mots-clés en top 50
top_100_positions    → nombre de mots-clés en top 100
visibility_index     → indice de visibilité calculé
traffic_value        → valeur estimée du trafic en €
gmb_bl               → backlinks depuis Google My Business
```

### Coût en crédits
- `1 crédit "site"` par appel à `domains/overview`.
- Budget mensuel : 2 972 crédits site → 2 972 domaines auditables/mois.
- Renouvellement mensuel automatique.

### Piège : SITE_NOT_FOUND pour les petits OT
Les domaines de petits offices de tourisme (`lac-annecy.com`, `tourisme-annecy.net`,
`annecy-ville.fr`) retournent `SITE_NOT_FOUND`.
Seuls les domaines suffisamment populaires sont dans l'index Haloscan.

**Solution** : prévoir un fallback explicite dans le code :
```javascript
if (data.metrics?.errorCode === 'SITE_NOT_FOUND') {
  // Afficher "Non indexé dans Haloscan" et continuer
}
```

### Résultat sur un grand domaine (tripadvisor.fr)
```
Mots-clés positionnés : 12
Top 50 positions       : 5
Top 100 positions      : 12
Trafic estimé          : 1 visite/mois (données FR sous-représentées)
```
Note : les données Haloscan semblent sous-représenter le trafic FR
(tripadvisor.fr devrait avoir beaucoup plus). À prendre avec précaution
pour l'évaluation absolue du trafic ; plus fiable pour les comparaisons relatives.

---

## 10. RapidAPI — Instagram

**Auth : header `X-RapidAPI-Key`**
```
RAPIDAPI_KEY=bc1b282ebamsh48402e13840f9c4p1394d9jsn48f616d9804f
```
(Note : le fichier .env source avait une apostrophe parasite en fin — à ne pas inclure)

### APIs abonnées avec cette clé (tier gratuit)
```
✅ instagram-data.p.rapidapi.com                  — endpoints hashtag non trouvés
✅ instagram-profile-and-biography.p.rapidapi.com — endpoints hashtag non trouvés
✅ rocketapi-for-instagram.p.rapidapi.com          — hashtag/get_info retourne 404
✅ save-from-insta.p.rapidapi.com                  — outil téléchargement (hors-sujet)
```

### APIs NON abonnées (403 immédiat)
```
❌ instagram120.p.rapidapi.com
❌ instagram-hashtags.p.rapidapi.com
❌ instagram-scraper-api2.p.rapidapi.com
❌ instagram-best-experience.p.rapidapi.com
```

### Diagnostic de souscription
Pour identifier rapidement si une API est souscrite, faire une requête quelconque :
- `403` → clé non abonnée à cette API
- `404` ou `429` → clé abonnée (mauvais endpoint ou rate limit)
- `200` → succès

### Rate limit du tier gratuit
~1 requête par minute par API. Les tests systématiques avec plusieurs endpoints
successifs heurtent le rate limit très rapidement. **Prévoir 65s de délai entre chaque
appel** en mode exploration.

### Conclusion
Aucune API RapidAPI abonnée ne retourne le `postsCount` d'un hashtag Instagram avec
les endpoints trouvés. La solution retenue est **`apify/instagram-hashtag-stats`**.

---

## Récapitulatif des actors Apify utilisés

| Actor | Slug API | Usage | Timeout conseillé |
|-------|----------|-------|-------------------|
| Instagram Hashtag Stats | `apify~instagram-hashtag-stats` | postsCount + hashtags associés | URL: 90s / axios: 120s |
| Instagram Hashtag Scraper | `apify~instagram-hashtag-scraper` | Posts individuels (likes, timestamp) | URL: 90s / axios: 120s |
| Google Maps Scraper | `compass~crawler-google-places` | ❌ Remplacé par DataForSEO | — |

### Pattern run-sync Apify (tous actors)
```
POST https://api.apify.com/v2/acts/ACTOR_SLUG/run-sync-get-dataset-items
  ?token=APIFY_API_TOKEN
  &timeout=90
```
Retourne directement le dataset (tableau JSON) sans polling.

---

## Variables d'environnement (.env.local)

```
MONITORANK_API_KEY=4648-80kpZC7othd7...
APIFY_API_TOKEN=apify_api_r47zaja0...
RAPIDAPI_KEY=bc1b282ebamsh48402e13840f9c4p1394d9jsn48f616d9804f
HALOSCAN_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-proj-V2iayBm71Rm...
DATAFORSEO_LOGIN=mickael.challet@top10-strategie.fr
DATAFORSEO_PASSWORD=4e494b70cde62abb
```

⚠️ Le fichier `.env` source (à la racine) n'est PAS au format KEY=VALUE standard.
Les clés ont été extraites manuellement et placées dans `.env.local` au bon format.
Toujours utiliser `dotenv.config({ path: '.env.local' })` dans les scripts.

---

## Scripts de test disponibles

| Fichier | Contenu |
|---------|---------|
| `test-apis.js` | Round 1 — Connectivité de base, 7 APIs |
| `test-round2.js` | Round 2 — Tests approfondis Monitorank, Haloscan, Instagram postsCount |
| `test-round3.js` | Round 3 — RapidAPI Instagram, scan des APIs abonnées |
| `test-hashtag-stats.js` | Validation finale — apify/instagram-hashtag-stats |

Pour relancer le test de connectivité complet :
```bash
node test-apis.js
```

---

## Décisions d'architecture

1. **Positions SEO** → DataForSEO SERP (live, à la demande, immédiat)
2. **Google Maps OT** → DataForSEO Maps (une seule tâche par requête)
3. **postsCount Instagram** → `apify~instagram-hashtag-stats`
4. **Posts Instagram récents** → `apify~instagram-hashtag-scraper`
5. **Positionnement marketing IA** → OpenAI gpt-4o-mini
6. **Code INSEE / population** → data.gouv.fr Géo API (gratuit)
7. **SEO keywords domaine** → Haloscan (1 crédit/domaine, fallback si SITE_NOT_FOUND)
8. **Algo Google récent** → Monitorank (module=google&action=update)
9. **Backlinks** → ❌ Aucune API disponible dans le stack actuel
   (Haloscan = SEO only, pas de backlinks)
