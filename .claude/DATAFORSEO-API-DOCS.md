# DataForSEO API v3 — Documentation de référence
> Synthèse des endpoints utiles pour l'audit digital de destinations touristiques.
> Source : https://docs.dataforseo.com/v3/

---

## Authentification

- **Méthode** : HTTP Basic Auth (login:password encodé en base64)
- **Header** : `Authorization: Basic <base64(login:password)>`
- **Credentials projet** :
  - Login : `mickael.challet@top10-strategie.fr`
  - Password : `4e494b70cde62abb`

```js
const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64');
// header : { Authorization: `Basic ${AUTH}` }
```

---

## Règles générales

- **Encodage** : UTF-8, réponses gzip
- **Format** : JSON par défaut (XML et HTML disponibles)
- **Une seule tâche par requête Maps** (array à 1 élément — sinon erreur `40000`)
- **Timeout axios recommandé** : 60 000ms minimum (30s provoque des timeouts)
- **Résultats standard** : stockés 30 jours | **Live** : pas de stockage
- **Rate limit** : headers `X-RateLimit-Limit` / `X-RateLimit-Remaining`
- **Max parallèle** : 30 requêtes simultanées, 2 000 appels/min

---

## 1. SERP API — Google Organic

### Endpoint
```
POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced
```

### Paramètres de requête

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `keyword` | string | — | Mot-clé (max 700 caractères) **obligatoire** |
| `location_code` | integer | — | Code de localisation (France = `2250`) |
| `language_code` | string | — | Code langue (`fr`, `en`…) |
| `depth` | integer | 10 | Nombre de résultats (max 200) |
| `device` | string | desktop | `desktop` ou `mobile` |
| `os` | string | — | `windows` / `macos` (desktop) · `android` / `ios` (mobile) |
| `people_also_ask_click_depth` | integer | — | Profondeur PAA : 1 à 4 |
| `calculate_rectangles` | boolean | false | Positions en pixels (coût premium) |
| `load_async_ai_overview` | boolean | false | Charger l'aperçu IA de Google |
| `tag` | string | — | Identifiant libre (max 255 chars) |

### Exemple de requête
```json
[{
  "keyword": "les 7 laux",
  "language_code": "fr",
  "location_code": 2250,
  "depth": 10
}]
```

### Types d'items retournés dans `result[0].items`

| Type | Description |
|------|-------------|
| `organic` | Résultat organique classique |
| `paid` | Résultat sponsorisé Google Ads |
| `featured_snippet` | Position 0 / encadré en haut |
| `people_also_ask` | Bloc "Les gens demandent aussi" |
| `knowledge_graph` | Panneau Knowledge Panel (droite) |
| `local_pack` | Pack local (3 fiches Google Maps) |
| `top_stories` | Actualités |
| `video` | Résultats vidéos |
| `images` | Résultats images |
| `shopping` | Produits Google Shopping |
| `carousel` | Carrousel d'entités |
| `jobs` | Offres d'emploi |
| `events` | Événements |
| `related_searches` | Recherches associées (bas de page) |
| `answer_box` | Boîte réponse directe |
| `app` | Applications mobiles |
| `google_reviews` | Avis Google (dans knowledge graph) |
| `third_party_reviews` | Avis tiers (dans knowledge graph) |

### Champs d'un item `organic`
```json
{
  "type": "organic",
  "rank_group": 1,
  "rank_absolute": 1,
  "domain": "www.example.com",
  "title": "Titre de la page",
  "url": "https://www.example.com/page",
  "description": "Meta description...",
  "breadcrumb": "https://www.example.com › page",
  "is_featured_snippet": false,
  "highlighted": ["mot-clé mis en gras"],
  "links": [{ "title": "...", "url": "...", "domain": "..." }],
  "faq": null,
  "rating": null
}
```

### Champs d'un item `people_also_ask`
```json
{
  "type": "people_also_ask",
  "items": [
    {
      "type": "people_also_ask_element",
      "title": "Quelle est l'altitude des 7 Laux ?",
      "expanded_element": [
        {
          "type": "people_also_ask_expanded_element",
          "featured_title": "Titre mis en avant",
          "url": "https://source.com",
          "domain": "source.com",
          "title": "Titre de la page source",
          "description": "Texte de la réponse...",
          "table": null
        }
      ]
    }
  ]
}
```
> ⚠️ La réponse PAA peut contenir un `table` (tableau de données) au lieu d'une `description`.

### Champs d'un item `knowledge_graph`
```json
{
  "type": "knowledge_graph",
  "title": "Les Sept Laux",
  "subtitle": "Station de sports d'hiver aux Adrets",
  "description": "Description Wikipedia...",
  "url": "https://www.les7laux.com/",
  "cid": "9319128220568329028",
  "items": [
    { "type": "knowledge_graph_description_item", "text": "..." },
    { "type": "knowledge_graph_row_item", "title": "Adresse", "text": "38190 Les Adrets" },
    { "type": "knowledge_graph_row_item", "title": "Téléphone", "text": "04 76 08 17 86" },
    { "type": "knowledge_graph_row_item", "title": "Nombre De Sentiers", "text": "51" },
    { "type": "knowledge_graph_carousel_item", "title": "Profils", "items": [
      { "type": "knowledge_graph_carousel_element", "title": "YouTube", "url": "..." },
      { "type": "knowledge_graph_carousel_element", "title": "Instagram", "url": "..." }
    ]}
  ]
}
```

---

## 2. SERP API — Google Maps

### Endpoint
```
POST https://api.dataforseo.com/v3/serp/google/maps/live/advanced
```

### Paramètres

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `keyword` | string | — | Ex : `"Office de tourisme Les 7 Laux"` |
| `location_code` | integer | — | `2250` pour la France |
| `language_code` | string | — | `fr` |
| `depth` | integer | 100 | Résultats (max 700 ; mobile = 20 max) |
| `device` | string | desktop | `desktop` ou `mobile` |

> ⚠️ **Une seule tâche par requête** — l'array ne doit contenir qu'1 objet.
> ⚠️ Timeout axios : **60 000ms minimum**.

### Types d'items retournés

| Type | Description |
|------|-------------|
| `maps_search` | Fiche locale organique |
| `maps_paid_item` | Annonce locale sponsorisée |

### Champs d'un item `maps_search`
```json
{
  "type": "maps_search",
  "title": "Nom de l'établissement",
  "url": "https://site-officiel.com",
  "domain": "site-officiel.com",
  "address": "38190 Les Adrets",
  "phone": "04 76 08 17 86",
  "rating": { "value": 4.5, "votes_count": 1142, "rating_max": 5 },
  "work_hours": { "timetable": {...} },
  "is_claimed": true,
  "place_id": "ChIJ...",
  "cid": "9319128220568329028",
  "latitude": 45.xxx,
  "longitude": 6.xxx,
  "category": "Station de sports d'hiver",
  "photos_count": 120
}
```

> ⚠️ Si la fiche OT est absente → retourner `{ ot_fiche_manquante: true }`, ne pas bloquer.

---

## 3. Keywords Data API — Volume de recherche Google Ads

### Endpoint
```
POST https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live
```

### Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| `keywords` | array | Max 1 000 mots-clés, 80 chars chacun |
| `location_code` | integer | `2250` pour la France |
| `language_code` | string | `fr` |
| `date_from` / `date_to` | string | Historique sur 24 mois max |
| `sort_by` | string | `relevance`, `search_volume`, `competition_index`… |

> ⚠️ Rate limit : **12 requêtes/minute** par compte.

### Champs de réponse par mot-clé
```json
{
  "keyword": "station de ski isère",
  "keyword_info": {
    "search_volume": 4400,
    "competition": "MEDIUM",
    "competition_index": 45,
    "cpc": 1.23,
    "monthly_searches": [
      { "year": 2025, "month": 12, "search_volume": 5400 },
      { "year": 2026, "month": 1, "search_volume": 8100 }
    ]
  }
}
```

---

## 4. DataForSEO Labs — Related Keywords

### Endpoint
```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live
```

### Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| `keyword` | string | Mot-clé seed |
| `location_code` | integer | `2250` |
| `language_code` | string | `fr` |
| `depth` | integer | 0-4 (profondeur, depth 4 = ~4 680 résultats) |
| `limit` | integer | Max 1 000 résultats retournés |
| `include_seed_keyword` | boolean | Inclure le seed dans les résultats |
| `include_serp_info` | boolean | Données SERP par mot-clé |
| `filters` | array | Jusqu'à 8 conditions de filtre |
| `order_by` | array | Max 3 règles de tri |

### Champs de réponse
```json
{
  "keyword_data": {
    "keyword": "que faire isère",
    "keyword_info": {
      "search_volume": 1300,
      "cpc": 0.87,
      "competition": "LOW",
      "monthly_searches": [...]
    }
  },
  "depth": 1,
  "related_keywords": ["activités isère", "randonnée isère", ...]
}
```

---

## 5. DataForSEO Labs — Ranked Keywords (mots-clés d'un domaine)

### Endpoint
```
POST https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live
```

### Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| `target` | string | Domaine sans `https://www.` (ex: `les7laux.com`) ou URL complète |
| `location_code` | integer | `2250` |
| `language_code` | string | `fr` |
| `limit` | integer | Max 1 000 (défaut 100) |
| `offset` | integer | Pagination |
| `item_types` | array | `organic`, `paid`, `featured_snippet`, `local_pack`, `ai_overview_reference` |
| `ignore_synonyms` | boolean | Exclure les variantes similaires |

### Champs de réponse
```json
{
  "keyword": "station ski belledonne",
  "ranked_serp_element": {
    "serp_item": {
      "type": "organic",
      "rank_group": 3,
      "rank_absolute": 3
    },
    "page_from_title": "Les 7 Laux | Station de ski",
    "page_from_url": "https://www.les7laux.com/"
  },
  "keyword_data": {
    "search_volume": 880,
    "cpc": 1.05,
    "competition": "MEDIUM"
  },
  "etv": 42
}
```

> **ETV** = Estimated Traffic Volume — trafic mensuel estimé selon CTR × volume.

---

## 6. OnPage API — Audit technique de site

### Endpoint principal
```
POST https://api.dataforseo.com/v3/on_page/task_post
```

### Endpoints disponibles

| Endpoint | Description |
|----------|-------------|
| `/on_page/summary` | Résumé global du crawl |
| `/on_page/pages` | Données page par page |
| `/on_page/resources` | Ressources (images, CSS, JS) |
| `/on_page/duplicate_tags` | Titres/metas en doublon |
| `/on_page/duplicate_content` | Contenus dupliqués |
| `/on_page/links` | Liens internes/externes |
| `/on_page/redirect_chains` | Chaînes de redirections |
| `/on_page/non_indexable` | Pages non-indexables |
| `/on_page/waterfall` | Performance de chargement |
| `/on_page/keyword_density` | Densité de mots-clés |
| `/on_page/instant_pages` | Analyse immédiate d'une URL (live) |

> ⚠️ Facturation à la page crawlée (remboursement si non utilisées).

---

## 7. Autres APIs disponibles (hors scope actuel)

| API | Usage |
|-----|-------|
| **Backlinks API** | Analyse de backlinks (non retenu — coût) |
| **AI Optimization API** | Mentions dans ChatGPT, Claude, Gemini, Perplexity |
| **Domain Analytics** | Technologies utilisées, données WHOIS |
| **Merchant API** | Google Shopping, Amazon |
| **App Data API** | Google Play, App Store |
| **Business Data API** | Données d'entreprises |
| **Content Analysis API** | Analyse sémantique de contenu |
| **Google Finance** | Données boursières |

---

## Codes de statut

| Code | Signification |
|------|---------------|
| `20000` | OK — succès |
| `40000` | Erreur de paramètre (ex : plusieurs tâches dans Maps) |
| `40402` | Invalid Path — endpoint inexistant |
| `40501` | Quota dépassé |
| `50000` | Erreur serveur DataForSEO |

---

## Patterns de code réutilisables

### Requête standard
```js
const response = await axios.post(
  'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
  [{ keyword, language_code: 'fr', location_code: 2250, depth: 10 }],
  {
    headers: {
      Authorization: `Basic ${AUTH}`,
      'Content-Type': 'application/json'
    },
    timeout: 60000
  }
);
const items = response.data?.tasks?.[0]?.result?.[0]?.items ?? [];
```

### Filtrer les PAA
```js
const paaItems = items.filter(i => i.type === 'people_also_ask');
const questions = paaItems.flatMap(paa =>
  (paa.items ?? []).map(el => ({
    question: el.title,
    answer: el.expanded_element?.[0]?.description,
    url: el.expanded_element?.[0]?.url
  }))
);
```

### Filtrer les résultats organiques uniquement
```js
// ⚠️ Toujours filtrer par type — jamais d'index fixe
const organic = items.filter(i => i.type === 'organic');
```
