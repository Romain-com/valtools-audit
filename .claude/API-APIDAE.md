# API Apidae Tourisme — Documentation

> Source : https://dev.apidae-tourisme.com/documentation-technique/

---

## Authentification

Pas de header — les credentials sont inclus dans le JSON de la requête (`query`) :

```json
{
  "apiKey": "m1s2tMJ3",
  "projetId": "2537"
}
```

Variables d'environnement :
```
APIDAE_API_KEY=m1s2tMJ3
APIDAE_PROJECT_ID=2537
```

---

## Endpoint principal

```
GET https://api.apidae-tourisme.com/api/v002/recherche/list-objets-touristiques/
```

**Paramètre unique :** `query` = JSON stringifié contenant tous les filtres.

```javascript
const response = await axios.get(BASE_URL, {
  params: { query: JSON.stringify(query) },
  timeout: 30_000,
})
```

---

## Paramètres de requête valides

Liste complète des champs acceptés par l'API (29 paramètres) :

| Paramètre | Type | Description |
|-----------|------|-------------|
| `apiKey` | string | Clé API (obligatoire) |
| `projetId` | string | ID du projet (obligatoire) |
| `communeCodesInsee` | string[] | Codes INSEE des communes |
| `criteresQuery` | string | Filtre Lucene (voir ci-dessous) |
| `searchQuery` | string | Recherche fulltext |
| `searchFields` | string | Champ de recherche : `NOM`, `NOM_DESCRIPTION`, `NOM_DESCRIPTION_CRITERES` |
| `first` | int | Offset (0-based) |
| `count` | int | Nombre de résultats (max 200, défaut 20) |
| `order` | string | Tri : `NOM`, `IDENTIFIANT`, `PERTINENCE`, `DISTANCE`, `RANDOM`, `DATE_OUVERTURE` |
| `asc` | boolean | Ordre croissant |
| `locales` | string[] | Langues : `["fr"]` |
| `responseFields` | string[] | Champs à retourner (vide = tout) |
| `center` | object | GeoJSON Point `{"type":"Point","coordinates":[lng,lat]}` (objet direct, pas string) |
| `radius` | int | Rayon en mètres (à combiner avec `center`) |
| `territoireIds` | int[] | IDs de territoires Apidae |
| `selectionIds` | int[] | IDs de sélections Apidae |
| `identifiants` | int[] | IDs d'objets spécifiques |
| `identifiers` | string[] | Identifiants string |
| `identifiantsIgnores` | int[] | IDs à exclure |
| `membreProprietaireIds` | int[] | IDs membres propriétaires |
| `membreProprietaireIdGmcs` | int[] | IDs GMCS membres propriétaires |
| `dateDebut` | string | Date début `YYYY-MM-DD` |
| `dateFin` | string | Date fin `YYYY-MM-DD` |
| `modifieApres` | string | Modifié après cette date |
| `listeEnregistreeId` | int | ID de liste enregistrée |
| `dureeMin` | int | Durée minimum |
| `dureeMax` | int | Durée maximum |
| `randomSeed` | int | Graine pour tri RANDOM |
| `searchLocale` | string | Locale de recherche |

⚠️ **`type` n'est PAS un paramètre valide** — utiliser `criteresQuery: "type:HOTELLERIE"`.
⚠️ **`center` doit être un objet GeoJSON** directement dans le JSON (pas une string encodée).

---

## Filtrage par type d'objet (criteresQuery Lucene)

```javascript
criteresQuery: 'type:HOTELLERIE'
```

Types disponibles confirmés :

| Type | Description |
|------|-------------|
| `HEBERGEMENT_LOCATIF` | Gîtes, locations saisonnières |
| `HEBERGEMENT_COLLECTIF` | Auberges, résidences collectives |
| `HOTELLERIE` | Hôtels (avec classement étoiles) |
| `RESTAURATION` | Restaurants |
| `ACTIVITE` | Activités de loisir |
| `FETE_ET_MANIFESTATION` | Événements |
| `STRUCTURE` | Organismes, offices de tourisme |
| `EQUIPEMENT` | Équipements touristiques |
| `TERRITOIRE` | Entités géographiques |

---

## Format de réponse

```json
{
  "query": {...},
  "numFound": 5029,
  "objetsTouristiques": [...],
  "formatVersion": "v002"
}
```

### Structure d'un objet touristique

```javascript
{
  "type": "HOTELLERIE",
  "id": 105051,
  "identifier": "74AAHOT100024",     // identifiant métier
  "nom": {
    "libelleFr": "Best Western Plus Carlton"  // ⚠️ libelleFr, pas libelle ni fr
  },
  "presentation": {
    "descriptifCourt": { "libelleFr": "..." },
    "descriptifDetaille": { "libelleFr": "..." }
  },
  "localisation": {
    "adresse": {
      "adresse1": "5 rue des Glières",
      "codePostal": "74000",
      "commune": {
        "code": "74010",              // code INSEE
        "nom": "Annecy"
      }
    },
    "geolocalisation": {
      "geoJson": {
        "type": "Point",
        "coordinates": [6.12241, 45.900298]  // [lng, lat]
      }
    }
  },
  "informations": {
    "moyensCommunication": [
      { "type": { "id": 201 }, "coordonnees": { "fr": "04 50 10 09 09" } },  // Téléphone
      { "type": { "id": 204 }, "coordonnees": { "fr": "contact@hotel.com" } }, // Mél
      { "type": { "id": 205 }, "coordonnees": { "fr": "https://..." } },        // Site web
      { "type": { "id": 207 }, "coordonnees": { "fr": "https://facebook.com/..." } } // Facebook
    ]
  },
  "illustrations": [
    {
      "type": "IMAGE",
      "traductionFichiers": [{
        "locale": "fr",
        "url": "https://static.apidae-tourisme.com/...",       // original
        "urlListe": "...",      // miniature liste
        "urlFiche": "...",      // format fiche
        "urlDiaporama": "..."   // format diaporama
      }]
    }
  ],
  // Champs spécifiques selon le type :
  "informationsHotellerie": {
    "hotellerieType": { "libelleFr": "Hôtel" },
    "classement": { "libelleFr": "4 étoiles" },
    "chaines": [...],
    "capacite": {
      "nombreChambresClassees": 57,
      "nombreTotalPersonnes": 123
    }
  }
}
```

### IDs de moyens de communication

| ID | Type |
|----|------|
| 201 | Téléphone |
| 204 | Mél (email) |
| 205 | Site web (URL) |
| 207 | Page Facebook |

---

## Exemples de requêtes

### Hébergements hôteliers d'une commune
```javascript
const query = {
  projetId: process.env.APIDAE_PROJECT_ID,
  apiKey: process.env.APIDAE_API_KEY,
  communeCodesInsee: ['74010'],
  criteresQuery: 'type:HOTELLERIE',
  first: 0,
  count: 200,
  locales: ['fr'],
  responseFields: ['id', 'nom', 'localisation', 'informations', 'informationsHotellerie'],
}
```

### Objets dans un rayon géographique
```javascript
const query = {
  projetId: process.env.APIDAE_PROJECT_ID,
  apiKey: process.env.APIDAE_API_KEY,
  center: { type: 'Point', coordinates: [6.1228, 45.899] }, // objet direct
  radius: 10000, // 10 km
  criteresQuery: 'type:RESTAURATION',
  count: 50,
  locales: ['fr'],
}
```

### Recherche fulltext
```javascript
const query = {
  projetId: process.env.APIDAE_PROJECT_ID,
  apiKey: process.env.APIDAE_API_KEY,
  searchQuery: 'ski',
  searchFields: 'NOM_DESCRIPTION',
  count: 20,
  locales: ['fr'],
}
```

---

## Helper de parsing

```javascript
// Extrait le libellé depuis un champ nom Apidae
function getNom(obj) {
  return obj?.nom?.libelleFr ?? obj?.nom?.libelle ?? obj?.nom?.fr ?? '(sans nom)'
}

// Extrait les contacts depuis moyensCommunication
function getContacts(obj) {
  const moyens = obj?.informations?.moyensCommunication ?? []
  return {
    tel:  moyens.find(m => m.type?.id === 201)?.coordonnees?.fr ?? null,
    mail: moyens.find(m => m.type?.id === 204)?.coordonnees?.fr ?? null,
    site: moyens.find(m => m.type?.id === 205)?.coordonnees?.fr ?? null,
    facebook: moyens.find(m => m.type?.id === 207)?.coordonnees?.fr ?? null,
  }
}
```

---

## Pièges et limitations

- **Pas de filtre `type`** comme paramètre racine → toujours `criteresQuery: "type:XXX"`
- **`center` = objet GeoJSON**, pas une string JSON — le passer directement dans le query object
- **`nom.libelleFr`** et non `nom.libelle` ou `nom.fr`
- **Pas de clé API dans les headers** — tout passe dans le JSON `query`
- Le `count` max est 200 — pagination via `first` pour les grands volumes
- `criteresQuery` utilise la syntaxe Lucene — combinaisons possibles : `type:HOTELLERIE AND commune:74010`
