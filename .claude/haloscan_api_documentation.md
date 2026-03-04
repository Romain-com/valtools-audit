# Haloscan API Documentation

> **Base URL:** `https://api.haloscan.com/api/`
>
> **Authentication:** Include header `haloscan-api-key: [your api key]` in every request.
>
> **Content-Type:** `application/json`

## Table of Contents

### User

- [user_credit](#user_credit) (GET)

### Keyword Explorer

- [keywords_overview](#keywords_overview) (POST)
- [keywords_match](#keywords_match) (POST)
- [keywords_similar](#keywords_similar) (POST)
- [keywords_highlights](#keywords_highlights) (POST)
- [keywords_related](#keywords_related) (POST)
- [keywords_questions](#keywords_questions) (POST)
- [keywords_synonyms](#keywords_synonyms) (POST)
- [keywords_find](#keywords_find) (POST)
- [keywords_site_structure](#keywords_site_structure) (POST)
- [keywords_serp_compare](#keywords_serp_compare) (POST)
- [keywords_serp_availableDates](#keywords_serp_availableDates) (POST)
- [keywords_serp_pageEvolution](#keywords_serp_pageEvolution) (POST)
- [keywords_bulk](#keywords_bulk) (POST)
- [keywords_scrap](#keywords_scrap) (POST)

### Site Explorer

- [domains_overview](#domains_overview) (POST)
- [domains_positions](#domains_positions) (POST)
- [domains_top_pages](#domains_top_pages) (POST)
- [domains_history_positions](#domains_history_positions) (POST)
- [domains_history_pages](#domains_history_pages) (POST)
- [page_best_keywords](#page_best_keywords) (POST)
- [domains_keywords](#domains_keywords) (POST)
- [domains_bulk](#domains_bulk) (POST)
- [domains_competitors](#domains_competitors) (POST)
- [domains_competitors_keywords_diff](#domains_competitors_keywords_diff) (POST)
- [domains_competitors_best_pages](#domains_competitors_best_pages) (POST)
- [domains_competitors_keywords_best_pos](#domains_competitors_keywords_best_pos) (POST)
- [domains_visibility_trends](#domains_visibility_trends) (POST)
- [domains_expired](#domains_expired) (POST)
- [domains_expired_reveal](#domains_expired_reveal) (POST)
- [domains_gmb_backlinks](#domains_gmb_backlinks) (POST)
- [domains_gmb_backlinks_map](#domains_gmb_backlinks_map) (POST)
- [domains_gmb_backlinks_categories](#domains_gmb_backlinks_categories) (POST)

### Projects

- [projects_create](#projects_create) (POST)
- [projects_update](#projects_update) (POST)
- [projects_delete](#projects_delete) (DELETE)
- [projects_list](#projects_list) (GET)
- [projects_details](#projects_details) (POST)
- [projects_overview](#projects_overview) (POST)
- [projects_single_overview](#projects_single_overview) (POST)
- [projects_keywords](#projects_keywords) (POST)
- [projects_tracking](#projects_tracking) (POST)

---

## User

### user_credit

- **Method:** GET
- **URL:** `https://api.haloscan.com/api/user/credit`
- **Description:** Retrieves the remaining credit for the user identified by the provided API key.

#### Example Response

```json
{
  "totalCredit": {
    "creditBulkKeyword": 1099,
    "creditBulkSite": 1000,
    "creditExport": 499164,
    "creditKeyword": 26059,
    "creditRefresh": 1000,
    "creditSite": 11998,
    "creditExpired": 503
  },
  "creditBreakdown": {
    "monthlySubscriptionCredit": {
      "creditBulkKeyword": 999,
      "creditBulkSite": 1000,
      "creditExport": 499119,
      "creditKeyword": 24959,
      "creditRefresh": 1000,
      "creditSite": 9993,
      "creditExpired": 500,
      "lastApplicationDate": "2024-03-07"
    },
    "additionalCredit": [
      {
        "creditBulkKeyword": 0,
        "creditBulkSite": 0,
        "creditExport": 15,
        "creditKeyword": 50,
        "creditRefresh": 0,
        "creditSite": 1000,
        "creditExpired": 1,
        "startDate": "2024-02-21",
        "expirationDate": "2024-04-15",
        "source": "ADMIN_CREDIT"
      },
      {
        "creditBulkKeyword": 100,
        "creditBulkSite": 0,
        "creditExport": 15,
        "creditKeyword": 1000,
        "creditRefresh": 0,
        "creditSite": 5,
        "creditExpired": 1,
        "startDate": "2024-03-21",
        "expirationDate": "2024-05-15",
        "source": "ADMIN_CREDIT"
      },
      {
        "creditBulkKeyword": 0,
        "creditBulkSite": 0,
        "creditExport": 15,
        "creditKeyword": 50,
        "creditRefresh": 0,
        "creditSite": 1000,
        "creditExpired": 1,
        "startDate": "2024-01-01",
        "expirationDate": null,
        "source": "ADMIN_CREDIT"
      }
    ]
  }
}
```

#### curl

```bash
curl -X GET -d '{}'\
  --url https://api.haloscan.com/api/user/credit \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/user/credit"

payload = {}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.get(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'GET',
    url: 'https://api.haloscan.com/api/user/credit',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

## Keyword Explorer

### keywords_overview

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/overview`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | Requested keyword |
| requested_data | Oui | String[] |  | Any combination of [keyword_match, related_search, related_question, similar_category, similar_serp, top_sites, similar_highlight, categories, synonym | Requested data for the given keyword, corresponding to the content of different sections of the haloscan overview page. Data will be sent back in a field with the same name in the response, except for |
| lang | Non | String |  | fr, en | Only used in conjunction with "categories" in requested_data, the label field will be translated if a different language than english is requested. Original value is also present. |

#### Example Response

```json
{
  "keyword": "loutre",
  "errors": [],
  "similar_highlight": {
    "response_time": "0.4877 secs",
    "keyword": "loutre",
    "response_code": null,
    "failure_reason": null,
    "results": [
      {
        "keyword": "loutre",
        "volume": 61700
      },
      {
        "keyword": "doudou loutre",
        "volume": 60500
      },
      {
        "keyword": "doudou loutre qui respire",
        "volume": 9900
      },
      {
        "keyword": "loutre de mer",
        "volume": 7400
      },
      {
        "keyword": "loutres de mer",
        "volume": 700
      },
      {
        "keyword": "loutres",
        "volume": 6200
      },
      {
        "keyword": "loutre de combat",
        "volume": 2900
      },
      {
        "keyword": "loutr",
        "volume": 2200
      },
      {
        "keyword": "loutre d'europe",
        "volume": 200
      },
      {
        "keyword": "loutre mignonne",
        "volume": 1900
      }
    ]
  },
  "keyword_match": {
    "response_time": "0.5455 secs",
    "keyword": "loutre",
    "response_code": null,
    "failure_reason": null,
    "results": [
      {
        "keyword": "loutre",
        "volume": 61700
      },
      {
        "keyword": "doudou loutre",
        "volume": 60500
      },
      {
        "keyword": "doudou loutre qui respire",
        "volume": 9900
      },
      {
        "keyword": "loutre de mer",
        "volume": 7400
      },
      {
        "keyword": "la loutre",
        "volume": 4400
      },
      {
        "keyword": "loutre géante",
        "volume": 3600
      },
      {
        "keyword": "loutre fisher price",
        "volume": 3000
      },
      {
        "keyword": "loutre de combat",
        "volume": 2900
      },
      {
        "keyword": "bebe loutre",
        "volume": 2600
      },
      {
        "keyword": "loutre d'europe",
        "volume": 200
      }
    ]
  },
  "serp": {
    "response_time": "0.2339 secs",
    "keyword": "loutre",
    "response_code": null,
    "failure_reason": null,
    "result_count": 99,
    "results": {
      "serp_date": "2024-09-21",
      "serp": [
        {
          "position": 1,
          "url": "https://fr.wikipedia.org/wiki/Loutre",
          "title": "Loutre",
          "description": "Contrairement à l'ours blanc ou au dauphin, la loutre ne dispose pas d'une épaisse couche de graisse sous la peau. C'est son pelage, composé de poils courts et ..."
        },
        {
          "position": 2,
          "url": "https://www.sfepm.org/presentation-de-la-loutre-deurope.html",
          "title": "Présentation de la Loutre d'Europe - SFEPM",
          "description": "Les empreintes de pas montrent 5 doigts placés en éventails avec de petites ... permet de distinguer l'empreinte de celle des animaux à 4 doigts, où l'axe ..."
        },
        {
          "position": 3,
          "url": "https://fr.wikipedia.org/wiki/Loutre_d%27Europe",
          "title": "Loutre d'Europe - Wikipédia",
          "description": 
```

#### curl

```bash
curl -X POST -d '{"keyword":"loutre","requested_data":["metrics","keyword_match","similar_highlight","top_sites","serp"]}'\
  --url https://api.haloscan.com/api/keywords/overview \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/overview"

payload = {
    "keyword": "loutre",
    "requested_data": [
        "metrics",
        "keyword_match",
        "similar_highlight",
        "top_sites",
        "serp"
    ]
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/overview',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "loutre",
         "requested_data": [
                  "metrics",
                  "keyword_match",
                  "similar_highlight",
                  "top_sites",
                  "serp"
         ]
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_match

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/match`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | requested keyword |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, keyword, volume, cpc, competition, kgr, allintitle | Field used for sorting results. Default sorts by descending volume. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| exact_match | Non | Boolean | true |  | When FALSE, always ignore accents, punctuation, case, special characters, etc. when matching the seed keyword. |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| include | Non | String |  |  | Regular expression for keywords to be included |
| exclude | Non | String |  |  | Regular expression for keywords to be excluded |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_result_count": 18432,
  "filtered_result_volume": 1210540,
  "keyword": "plombier",
  "remaining_result_count": 18430,
  "response_code": null,
  "response_time": "1.043 secs",
  "results": [
    {
      "allintitle": 3520000,
      "competition": 0.42,
      "cpc": 18.32,
      "google_indexed": 18100000,
      "keyword": "plombier",
      "kgr": 32,
      "volume": 110000,
      "word_count": 1
    },
    {
      "allintitle": 68000,
      "competition": 0.42,
      "cpc": 13.03,
      "google_indexed": 14300000,
      "keyword": "plombier chauffage",
      "kgr": 2.5092,
      "volume": 27100,
      "word_count": 2
    }
  ],
  "returned_result_count": 2,
  "source": "match",
  "total_result_count": 18432
}
```

#### curl

```bash
curl -X POST -d '{"keyword":"loutre","order_by":"volume","order":"desc","lineCount":20,"page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/keywords/match \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/match"

payload = {
    "keyword": "loutre",
    "order_by": "volume",
    "order": "desc",
    "lineCount": 20,
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/match',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "loutre",
         "order_by": "volume",
         "order": "desc",
         "lineCount": 20,
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_similar

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/similar`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | requested keyword |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, keyword, similarity, volume, cpc, competition, kgr, allintitle | Field used for sorting results. Default is by descending similarity. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| similarity_min | Non | Number |  |  |  |
| similarity_max | Non | Number |  |  |  |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| score_min | Non | Number |  |  | Min common top 100 |
| score_max | Non | Number |  |  | Max common top 100 |
| p1_score_min | Non | Number |  |  | Min common top 10 |
| p1_score_max | Non | Number |  |  | Max common top 10 |
| word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| include | Non | String |  |  | Regular expression for keywords to be included |
| exclude | Non | String |  |  | Regular expression for keywords to be excluded |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_result_count": 101,
  "filtered_result_volume": 338750,
  "keyword": "plombier",
  "remaining_result_count": 98,
  "response_code": null,
  "response_time": "0.6505 secs",
  "results": [
    {
      "allintitle": 3520000,
      "competition": 0.42,
      "cpc": 18.32,
      "google_indexed": 18100000,
      "keyword": "plombier",
      "kgr": 32,
      "p1_score": 10,
      "score": 99,
      "similarity": 1,
      "volume": 110000,
      "word_count": 1
    },
    {
      "allintitle": 184000,
      "competition": 0.42,
      "cpc": 18.32,
      "google_indexed": 4360000,
      "keyword": "plombiers",
      "kgr": 1.6727,
      "p1_score": 6,
      "score": 35,
      "similarity": 0.6214,
      "volume": 110000,
      "word_count": 1
    },
    {
      "allintitle": 1410,
      "competition": 0.22,
      "cpc": 8.18,
      "google_indexed": 30900000,
      "keyword": "installateur plomberie",
      "kgr": 2.9375,
      "p1_score": 5,
      "score": 17,
      "similarity": 0.5169,
      "volume": 480,
      "word_count": 2
    }
  ],
  "returned_result_count": 3,
  "source": "serp",
  "total_result_count": 101
}
```

#### curl

```bash
curl -X POST -d '{"keyword":"loutre","order_by":"default","order":"desc","lineCount":20,"page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/keywords/similar \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/similar"

payload = {
    "keyword": "loutre",
    "order_by": "default",
    "order": "desc",
    "lineCount": 20,
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/similar',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "loutre",
         "order_by": "default",
         "order": "desc",
         "lineCount": 20,
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_highlights

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/highlights`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | requested keyword |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, keyword, similarity, volume, cpc, competition, kgr, allintitle | Field used for sorting results. Default is by descending similarity. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| exact_match | Non | Boolean | true |  | When FALSE, always ignore accents, punctuation, case, special characters, etc. when matching the seed keyword. |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| similarity_min | Non | Number |  |  |  |
| similarity_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| include | Non | String |  |  | Regular expression for keywords to be included |
| exclude | Non | String |  |  | Regular expression for keywords to be excluded |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_result_count": 9215,
  "filtered_result_volume": 2259790,
  "keyword": "plombier",
  "remaining_result_count": 9212,
  "response_code": null,
  "response_time": "0.8194 secs",
  "results": [
    {
      "allintitle": 181,
      "competition": 0.47,
      "cpc": 26.25,
      "google_indexed": 104000,
      "keyword": "plombier coulommiers",
      "kgr": 0.3068,
      "similarity": 1,
      "volume": 590,
      "word_count": 2
    },
    {
      "allintitle": 3520000,
      "competition": 0.42,
      "cpc": 18.32,
      "google_indexed": 18100000,
      "keyword": "plombier",
      "kgr": 32,
      "similarity": 1,
      "volume": 110000,
      "word_count": 1
    },
    {
      "allintitle": "NA",
      "competition": 0.52,
      "cpc": 3.13,
      "google_indexed": 297000,
      "keyword": "alternance plombier chauffagiste",
      "kgr": "NA",
      "similarity": 0.6667,
      "volume": 110,
      "word_count": 3
    }
  ],
  "returned_result_count": 3,
  "source": "highlights",
  "total_result_count": 9215
}
```

#### curl

```bash
curl -X POST -d '{"keyword":"plombier","order_by":"default","order":"desc","lineCount":20,"page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/keywords/highlights \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/highlights"

payload = {
    "keyword": "plombier",
    "order_by": "default",
    "order": "desc",
    "lineCount": 20,
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/highlights',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "plombier",
         "order_by": "default",
         "order": "desc",
         "lineCount": 20,
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_related

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/related`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | requested keyword |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, depth, keyword, volume, cpc, competition, kgr, allintitle | Field used for sorting results. Default sorts by descending depth (absolute value). |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| exact_match | Non | Boolean | true |  | When FALSE, always ignore accents, punctuation, case, special characters, etc. when matching the seed keyword. |
| depth_min | Non | Number |  |  |  |
| depth_max | Non | Number |  |  |  |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| include | Non | String |  |  | Regular expression for keywords to be included |
| exclude | Non | String |  |  | Regular expression for keywords to be excluded |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_result_count": 26905,
  "filtered_result_volume": 90753610,
  "keyword": "plombier",
  "remaining_result_count": 26902,
  "response_code": null,
  "response_time": "0.9853 secs",
  "results": [
    {
      "allintitle": 3520000,
      "competition": 0.42,
      "cpc": 18.32,
      "depth": 1,
      "google_indexed": 18100000,
      "keyword": "plombier",
      "kgr": 32,
      "volume": 110000,
      "word_count": 1
    },
    {
      "allintitle": 9660,
      "competition": 0.72,
      "cpc": 19.27,
      "depth": 1,
      "google_indexed": 3500000,
      "keyword": "plombier pas cher",
      "kgr": 10.9773,
      "volume": 880,
      "word_count": 3
    },
    {
      "allintitle": 19600,
      "competition": 0.44,
      "cpc": 7.6,
      "depth": 1,
      "google_indexed": 8260000,
      "keyword": "plombier sanitaire",
      "kgr": 8.1667,
      "volume": 2400,
      "word_count": 2
    }
  ],
  "returned_result_count": 3,
  "source": "related",
  "total_result_count": 26905
}
```

#### curl

```bash
curl -X POST -d '{"keyword":"loutre","order_by":"default","order":"desc","lineCount":20,"page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/keywords/related \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/related"

payload = {
    "keyword": "loutre",
    "order_by": "default",
    "order": "desc",
    "lineCount": 20,
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/related',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "loutre",
         "order_by": "default",
         "order": "desc",
         "lineCount": 20,
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_questions

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/questions`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | requested keyword |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, depth, question_type, keyword, volume, cpc, competition, kgr, allintitle | Field used for sorting results. Default sorts by descending depth (absolute value). |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| exact_match | Non | Boolean | true |  | When FALSE, always ignore accents, punctuation, case, special characters, etc. when matching the seed keyword. |
| question_types | Non | String[] |  | An array containing any combination of [definition, how, how_expensive, how_many, what, when, where, who, why, yesno, how_long, unknown] |  |
| keep_only_paa | Non | boolean | false |  | Whether to include only PAA (People Also Ask) from google in the response. |
| depth_min | Non | Number |  |  |  |
| depth_max | Non | Number |  |  |  |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| include | Non | String |  |  | Regular expression for keywords to be included |
| exclude | Non | String |  |  | Regular expression for keywords to be excluded |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_result_count": 2082,
  "filtered_result_volume": 358020,
  "keyword": "plombier",
  "remaining_result_count": 2080,
  "response_code": null,
  "response_time": "4.717 secs",
  "results": [
    {
      "allintitle": "NA",
      "competition": "NA",
      "cpc": "NA",
      "depth": 1,
      "google_indexed": "NA",
      "keyword": "Comment trouver un bon plombier ?",
      "kgr": "NA",
      "question_type": "how",
      "volume": "NA",
      "word_count": 5
    },
    {
      "allintitle": "NA",
      "competition": "NA",
      "cpc": "NA",
      "depth": 1,
      "google_indexed": "NA",
      "keyword": "Quel est le tarif d'un plombier ?",
      "kgr": "NA",
      "question_type": "what",
      "volume": "NA",
      "word_count": 7
    }
  ],
  "returned_result_count": 2,
  "source": "questions",
  "total_result_count": 2082
}
```

#### curl

```bash
curl -X POST -d '{"keyword":"loutre","order_by":"default","order":"desc","lineCount":20,"page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/keywords/questions \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/questions"

payload = {
    "keyword": "loutre",
    "order_by": "default",
    "order": "desc",
    "lineCount": 20,
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/questions',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "loutre",
         "order_by": "default",
         "order": "desc",
         "lineCount": 20,
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_synonyms

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/synonyms`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | requested keyword |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, keyword, volume, cpc, competition, kgr, allintitle | Field used for sorting results. Default sorts by descending volume. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| exact_match | Non | Boolean | true |  | When FALSE, always ignore accents, punctuation, case, special characters, etc. when matching the seed keyword. |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| include | Non | String |  |  | Regular expression for keywords to be included |
| exclude | Non | String |  |  | Regular expression for keywords to be excluded |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_result_count": 12,
  "filtered_result_volume": 128240,
  "keyword": "plombier",
  "remaining_result_count": 9,
  "response_code": null,
  "response_time": "1.207 secs",
  "results": [
    {
      "allintitle": "NA",
      "competition": "NA",
      "cpc": "NA",
      "google_indexed": "NA",
      "keyword": "› plombier",
      "kgr": "NA",
      "volume": "NA",
      "word_count": 2
    },
    {
      "allintitle": 184000,
      "competition": 0.37,
      "cpc": 23.42,
      "google_indexed": 4840000,
      "keyword": "plombiers",
      "kgr": 1.6727,
      "volume": 110000,
      "word_count": 1
    },
    {
      "allintitle": 968,
      "competition": 0.46,
      "cpc": 27.85,
      "google_indexed": 3950000,
      "keyword": "plombier à proximité",
      "kgr": 1.1,
      "volume": 880,
      "word_count": 3
    }
  ],
  "returned_result_count": 3,
  "source": "synonyms",
  "total_result_count": 12
}
```

#### curl

```bash
curl -X POST -d '{"keyword":"loutre","order_by":"default","order":"desc","lineCount":20,"page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/keywords/synonyms \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/synonyms"

payload = {
    "keyword": "loutre",
    "order_by": "default",
    "order": "desc",
    "lineCount": 20,
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/synonyms',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "loutre",
         "order_by": "default",
         "order": "desc",
         "lineCount": 20,
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_find

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/find`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Non | String |  |  | requested keyword. Use to find a single keyword, or keywords to look for several keywords at once. |
| keywords | Non | String |  |  | requested keywords, ignore if keyword is present |
| keywords_sources | Non | String[] | [serp, related] | Any combination of [match, serp, related, highlights, categories, questions] | Which strategies to use to find keywords from input. |
| keep_seed | Non | Boolean | true |  | Whether to keep the input in the api's response |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, keyword, volume, cpc, competition, kgr, allintitle | Field used for sorting results. Default sorts by descending modality_count. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| exact_match | Non | Boolean | true |  | When FALSE, always ignore accents, punctuation, case, special characters, etc. when matching the seed keyword. |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| include | Non | String |  |  | Regular expression for keywords to be included |
| exclude | Non | String |  |  | Regular expression for keywords to be excluded |

#### Example Response

```json
{
  "response_code": null,
  "failure_reason": null,
  "total_result_count": 72212,
  "filtered_result_count": 72212,
  "filtered_result_volume": 14115740,
  "result_count": 5,
  "remaining_result_count": 72207,
  "results": [
    {
      "match_count": 1,
      "modalities": "match",
      "allintitle": "NA",
      "google_indexed": 62,
      "volume": 3350000,
      "cpc": 1.72,
      "competition": "NA",
      "keyword": "credit mutuelle",
      "word_count": 2,
      "kgr": "NA"
    },
    {
      "match_count": 1,
      "modalities": "match",
      "allintitle": "NA",
      "google_indexed": 2500000,
      "volume": 823000,
      "cpc": 2.34,
      "competition": "NA",
      "keyword": "mutuelle sociale agricole",
      "word_count": 3,
      "kgr": "NA"
    },
    {
      "match_count": 1,
      "modalities": "match",
      "allintitle": 732,
      "google_indexed": 560000,
      "volume": 450000,
      "cpc": 5.43,
      "competition": "NA",
      "keyword": "garantie mutuelle des fonctionnaires",
      "word_count": 4,
      "kgr": 0.0016
    },
    {
      "match_count": 1,
      "modalities": "match",
      "allintitle": 27500,
      "google_indexed": 96,
      "volume": 368000,
      "cpc": 3.94,
      "competition": 0.12,
      "keyword": "harmonie mutuelle",
      "word_count": 2,
      "kgr": 0.0747
    },
    {
      "match_count": 1,
      "modalities": "match",
      "allintitle": 3940,
      "google_indexed": 3510000,
      "volume": 135000,
      "cpc": 0.33,
      "competition": 0.13,
      "keyword": "mutuelle nationale territoriale",
      "word_count": 3,
      "kgr": 0.0292
    }
  ],
  "seed": "mutuelle",
  "response_time": "1.722 secs"
}
```

#### curl

```bash
curl -X POST -d '{"keyword":"mutuelle","order_by":"volume","order":"desc","keywords_sources":["match","serp"],"lineCount":5,"page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/keywords/find \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/find"

payload = {
    "keyword": "mutuelle",
    "order_by": "volume",
    "order": "desc",
    "keywords_sources": [
        "match",
        "serp"
    ],
    "lineCount": 5,
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/find',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "mutuelle",
         "order_by": "volume",
         "order": "desc",
         "keywords_sources": [
                  "match",
                  "serp"
         ],
         "lineCount": 5,
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_site_structure

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/siteStructure`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Non | String |  |  | requested keyword, ignored if keywords (bulk) is present |
| keywords | Non | String[] |  |  | Requested keywords in an array if requesting bulk data. Must contain at least 50 keywords. |
| exact_match | Non | Boolean | true |  | When FALSE, always ignore accents, punctuation, case, special characters, etc. when matching the seed keyword. |
| neighbours_sources | Non | String[] |  | Any combination of [ngram, serp, related, highlights, categories] | Which strategies should be used to find neighbours for keyword. (Ignored if keywords is used) |
| multipartite_modes | Non | String[] |  | Any combination of [ngram, serp, related, highlights, categories] | Which sources of data should be used to build the multipartite graph. This parameter is ignored if mode≠multi. |
| neighbours_sample_max_size | Non | Number | 1000 | Between 10 and 2000. Only used when requesting a single keyword. | Max number of returned results |
| mode | Non | String | multi | multi, manual | Defines how groups will be made. Manual means that keywords will be grouped when they share at least manual_common_10 URLs in their last SERP top 10 AND at least manual_common_100 URLS in their last S |
| granularity | Non | Number | 1 |  | Low granularity will lead to one big group, high granularity will lead to many smaller groups. For reference, Values used by Haloscan's UI values are: 0.001 (insufficient), 0.01 (very low), 0.05 (low) |
| manual_common_10 | Non | Number | 2 |  | In a manual grouping strategy, how many URLs should 2 keywords have in common in their top 10 to be in the same group. |
| manual_common_100 | Non | Number | 10 |  | In a manual grouping strategy, how many URLs should 2 keywords have in common in their top 100 to be in the same group. |

#### Example Response

```json
{
  "cannibalisation": [
    {
      "groupe": "plombier 77",
      "keyword": "plombier 77"
    },
    {
      "groupe": "plombier 77",
      "keyword": "plomberie 77"
    },
    {
      "groupe": "vout plomberie",
      "keyword": "vout plomberie"
    },
    {
      "groupe": "vout plomberie",
      "keyword": "vout et fils"
    },
    {
      "groupe": "compétence plombier",
      "keyword": "compétence plombier"
    },
    {
      "groupe": "compétence plombier",
      "keyword": "compétences plombier"
    },
    {
      "groupe": "compétence plombier",
      "keyword": "compétence plombier chauffagiste"
    },
    {
      "groupe": "métier plombier",
      "keyword": "métier plombier"
    },
    {
      "groupe": "métier plombier",
      "keyword": "fiche métier plombier"
    },
    {
      "groupe": "métier plombier",
      "keyword": "plombier métier"
    },
    {
      "groupe": "métier plombier",
      "keyword": "plombier fiche métier"
    },
    {
      "groupe": "métier plombier",
      "keyword": "plombier metier"
    },
    {
      "groupe": "métier plombier",
      "keyword": "fiche metier plombier"
    },
    {
      "groupe": "métier plombier",
      "keyword": "metier de plombier"
    },
    {
      "groupe": "métier plombier",
      "keyword": "metier plombier chauffagiste"
    },
    {
      "groupe": "métier plombier",
      "keyword": "metier plomberie"
    },
    {
      "groupe": "métier plombier",
      "keyword": "fiche metier plomberie"
    },
    {
      "groupe": "métier plombier",
      "keyword": "plombier sanitaire fiche métier"
    },
    {
      "groupe": "diplome plomberie",
      "keyword": "diplome plomberie"
    },
    {
      "groupe": "diplome plomberie",
      "keyword": "diplome plombier"
    }
  ],
  "failure_reason": null,
  "graph": {
    "children": [
      {
        "name": "atelier delaunay",
        "value": 1
      },
      {
        "name": "plomberie genève",
        "value": 1
      },
      {
        "name": "plomberie montreal",
        "value": 1
      },
      {
        "children": [
          {
            "children": [
              {
                "name": "expert plomberie",
                "value": 1
              },
              {
                "name": "expertise plomberie",
                "value": 1
              }
            ],
            "name": "L2_expert plomberie"
          },
          {
            "children": [
              {
                "name": "ab groupe plomberie",
                "value": 1
              },
              {
                "name": "assistance plomberie",
                "value": 1
              },
              {
                "name": "belmard batiment",
                "value": 1
              },
              {
                "name": "chauffagiste 54",
                "value": 1
              },
              {
                "name": "dépannage assainissement",
                "value": 1
              },
              {
                "n
```

#### curl

```bash
curl -X POST -d '{"granularity":0.1,"keyword":"plombier","mode":"multi","multipartite_modes":["serp"],"neighbour_sources":["serp"],"neighbours_sample_max_size":1000}'\
  --url https://api.haloscan.com/api/keywords/siteStructure \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/siteStructure"

payload = {
    "granularity": 0.1,
    "keyword": "plombier",
    "mode": "multi",
    "multipartite_modes": [
        "serp"
    ],
    "neighbour_sources": [
        "serp"
    ],
    "neighbours_sample_max_size": 1000
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/siteStructure',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "granularity": 0.1,
         "keyword": "plombier",
         "mode": "multi",
         "multipartite_modes": [
                  "serp"
         ],
         "neighbour_sources": [
                  "serp"
         ],
         "neighbours_sample_max_size": 1000
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_serp_compare

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/serp/compare`
- **Description:** Returns the SERPs for a given keyword at 2 different dates (old_serp, new_serp) and how the position of each page changed between these dates. Also returns available SERP dates for this keyword. More details about each page's evolution can be retrieved by calling the keywords/serp/pageEvolution endpoint
Crédit consommé
1 keyword credit per call. No credit is consumed in case of error.

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | Requested keyword. |
| period | Oui | String | 6 months | [1 month, 3 months, 6 months, 12 months, custom] | The comparison period for SERPs. If custom is used, first_date and second_date must be provided and be dates where the requested keyword's SERP is available, which you can get by calling the keywords/ |
| first_date | Non | String |  |  | Date in YYYY-MM-DD format. Only used if period = custom. |
| second_date | Non | String |  |  | Date in YYYY-MM-DD format. Only used if period = custom. |

#### Example Response

```json
{
  "response_time": "0.2099 secs",
  "keyword": "loutre",
  "dates": [
    "2023-08-06",
    "2024-01-28"
  ],
  "available_search_dates": [
    "2021-04-13",
    "2021-11-18",
    "2021-11-22",
    "2022-04-11",
    "2022-07-25",
    "2022-11-19",
    "2022-12-11",
    "2022-12-31",
    "2023-02-19",
    "2023-04-05",
    "2023-04-06",
    "2023-04-09",
    "2023-04-10",
    "2023-04-15",
    "2023-04-17",
    "2023-04-20",
    "2023-04-21",
    "2023-04-22",
    "2023-04-24",
    "2023-04-25",
    "2023-04-27",
    "2023-05-05",
    "2023-05-06",
    "2023-05-07",
    "2023-05-08",
    "2023-05-14",
    "2023-05-15",
    "2023-05-17",
    "2023-05-26",
    "2023-05-30",
    "2023-06-03",
    "2023-06-06",
    "2023-06-07",
    "2023-06-08",
    "2023-06-09",
    "2023-06-10",
    "2023-06-11",
    "2023-06-12",
    "2023-06-13",
    "2023-06-17",
    "2023-06-18",
    "2023-06-21",
    "2023-06-22",
    "2023-06-24",
    "2023-06-28",
    "2023-06-30",
    "2023-07-03",
    "2023-07-04",
    "2023-07-05",
    "2023-07-08",
    "2023-07-09",
    "2023-07-10",
    "2023-07-11",
    "2023-07-12",
    "2023-07-13",
    "2023-07-14",
    "2023-07-19",
    "2023-07-23",
    "2023-07-26",
    "2023-07-28",
    "2023-07-29",
    "2023-08-06",
    "2023-08-09",
    "2023-08-10",
    "2023-08-11",
    "2023-08-20",
    "2023-08-31",
    "2023-09-13",
    "2023-09-15",
    "2023-09-16",
    "2023-09-18",
    "2023-09-20",
    "2023-09-23",
    "2023-09-24",
    "2023-09-27",
    "2023-09-30",
    "2023-10-01",
    "2023-10-02",
    "2023-10-03",
    "2023-10-04",
    "2023-10-05",
    "2023-10-07",
    "2023-10-09",
    "2023-10-11",
    "2023-10-14",
    "2023-10-18",
    "2023-10-19",
    "2023-10-21",
    "2023-10-22",
    "2023-10-25",
    "2023-10-26",
    "2023-10-29",
    "2023-10-30",
    "2023-11-02",
    "2023-11-03",
    "2023-11-04",
    "2023-11-10",
    "2023-11-11",
    "2023-11-12",
    "2023-11-14",
    "2023-11-15",
    "2023-11-16",
    "2023-11-17",
    "2023-11-19",
    "2023-11-21",
    "2023-11-23",
    "2023-11-24",
    "2023-11-25",
    "2023-12-01",
    "2023-12-03",
    "2023-12-05",
    "2023-12-06",
    "2023-12-07",
    "2023-12-08",
    "2023-12-11",
    "2023-12-15",
    "2023-12-16",
    "2023-12-17",
    "2023-12-19",
    "2023-12-20",
    "2023-12-21",
    "2023-12-22",
    "2023-12-23",
    "2023-12-24",
    "2023-12-25",
    "2023-12-28",
    "2023-12-31",
    "2024-01-01",
    "2024-01-02",
    "2024-01-03",
    "2024-01-04",
    "2024-01-05",
    "2024-01-06",
    "2024-01-09",
    "2024-01-13",
    "2024-01-15",
    "2024-01-18",
    "2024-01-20",
    "2024-01-21",
    "2024-01-23",
    "2024-01-24",
    "2024-01-25",
    "2024-01-27",
    "2024-01-28"
  ],
  "response_code": null,
  "failure_reason": null,
  "results": {
    "old_serp": [
      {
        "url": "https://fr.wikipedia.org/wiki/Loutre_d%27Europe",
        "position": 1,
        "diff": "-1"
      },
      {
        "url": "https://lemagdesanimaux.oue
```

#### curl

```bash
curl -X POST -d '{"keyword":"loutre","period":"6 months"}'\
  --url https://api.haloscan.com/api/keywords/serp/compare \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/serp/compare"

payload = {
    "keyword": "loutre",
    "period": "6 months"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/serp/compare',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "loutre",
         "period": "6 months"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_serp_availableDates

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/serp/availableDates`
- **Description:** Returns the list of dates for which the SERP of the requested keyword is available
Crédit consommé
None.

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | Requested keyword. |

#### Example Response

```json
{
  "response_time": "0.1204 secs",
  "keyword": "loutre",
  "available_search_dates": [
    "2021-04-13",
    "2021-11-18",
    "2021-11-22",
    "2022-04-11",
    "2022-07-25",
    "2022-11-19",
    "2022-12-11",
    "2022-12-31",
    "2023-02-19",
    "2023-04-05",
    "2023-04-06",
    "2023-04-09",
    "2023-04-10",
    "2023-04-15",
    "2023-04-17",
    "2023-04-20",
    "2023-04-21",
    "2023-04-22",
    "2023-04-24",
    "2023-04-25",
    "2023-04-27",
    "2023-05-05",
    "2023-05-06",
    "2023-05-07",
    "2023-05-08",
    "2023-05-14",
    "2023-05-15",
    "2023-05-17",
    "2023-05-26",
    "2023-05-30",
    "2023-06-03",
    "2023-06-06",
    "2023-06-07",
    "2023-06-08",
    "2023-06-09",
    "2023-06-10",
    "2023-06-11",
    "2023-06-12",
    "2023-06-13",
    "2023-06-17",
    "2023-06-18",
    "2023-06-21",
    "2023-06-22",
    "2023-06-24",
    "2023-06-28",
    "2023-06-30",
    "2023-07-03",
    "2023-07-04",
    "2023-07-05",
    "2023-07-08",
    "2023-07-09",
    "2023-07-10",
    "2023-07-11",
    "2023-07-12",
    "2023-07-13",
    "2023-07-14",
    "2023-07-19",
    "2023-07-23",
    "2023-07-26",
    "2023-07-28",
    "2023-07-29",
    "2023-08-06",
    "2023-08-09",
    "2023-08-10",
    "2023-08-11",
    "2023-08-20",
    "2023-08-31",
    "2023-09-13",
    "2023-09-15",
    "2023-09-16",
    "2023-09-18",
    "2023-09-20",
    "2023-09-23",
    "2023-09-24",
    "2023-09-27",
    "2023-09-30",
    "2023-10-01",
    "2023-10-02",
    "2023-10-03",
    "2023-10-04",
    "2023-10-05",
    "2023-10-07",
    "2023-10-09",
    "2023-10-11",
    "2023-10-14",
    "2023-10-18",
    "2023-10-19",
    "2023-10-21",
    "2023-10-22",
    "2023-10-25",
    "2023-10-26",
    "2023-10-29",
    "2023-10-30",
    "2023-11-02",
    "2023-11-03",
    "2023-11-04",
    "2023-11-10",
    "2023-11-11",
    "2023-11-12",
    "2023-11-14",
    "2023-11-15",
    "2023-11-16",
    "2023-11-17",
    "2023-11-19",
    "2023-11-21",
    "2023-11-23",
    "2023-11-24",
    "2023-11-25",
    "2023-12-01",
    "2023-12-03",
    "2023-12-05",
    "2023-12-06",
    "2023-12-07",
    "2023-12-08",
    "2023-12-11",
    "2023-12-15",
    "2023-12-16",
    "2023-12-17",
    "2023-12-19",
    "2023-12-20",
    "2023-12-21",
    "2023-12-22",
    "2023-12-23",
    "2023-12-24",
    "2023-12-25",
    "2023-12-28",
    "2023-12-31",
    "2024-01-01",
    "2024-01-02",
    "2024-01-03",
    "2024-01-04",
    "2024-01-05",
    "2024-01-06",
    "2024-01-09",
    "2024-01-13",
    "2024-01-15",
    "2024-01-18",
    "2024-01-20",
    "2024-01-21",
    "2024-01-23",
    "2024-01-24",
    "2024-01-25",
    "2024-01-27",
    "2024-01-28"
  ],
  "response_code": null,
  "failure_reason": null
}
```

#### curl

```bash
curl -X POST -d '{"keyword":"loutre"}'\
  --url https://api.haloscan.com/api/keywords/serp/availableDates \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/serp/availableDates"

payload = {
    "keyword": "loutre"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/serp/availableDates',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keyword": "loutre"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_serp_pageEvolution

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/serp/pageEvolution`
- **Description:** Returns details about the history of positions of a given url in the SERP of a given keyword between two dates, along with the search volume history of that keyword
Crédit consommé
1 keyword credit per call. No credit is consumed in case of error.

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Oui | String |  |  | Requested keyword. |
| first_date | Oui | String |  |  | Date in YYYY-MM-DD format. |
| second_date | Oui | String |  |  | Date in YYYY-MM-DD format. |
| url | Oui | String |  |  |  |

#### Example Response

```json
{
  "response_time": "0.9916 secs",
  "keyword": "loutre",
  "url": "https://www.larousse.fr/encyclopedie/vie-sauvage/loutre_dEurope/184814",
  "dates": [
    "2023-08-06",
    "2024-01-28"
  ],
  "response_code": null,
  "failure_reason": null,
  "results": {
    "position_history": [
      {
        "search_date": "2023-08-06",
        "position": 4
      },
      {
        "search_date": "2023-08-09",
        "position": 4
      },
      {
        "search_date": "2023-08-10",
        "position": 4
      },
      {
        "search_date": "2023-08-11",
        "position": 4
      },
      {
        "search_date": "2023-08-20",
        "position": 4
      },
      {
        "search_date": "2023-08-31",
        "position": 4
      },
      {
        "search_date": "2023-09-13",
        "position": 4
      },
      {
        "search_date": "2023-09-15",
        "position": 4
      },
      {
        "search_date": "2023-09-16",
        "position": 4
      },
      {
        "search_date": "2023-09-18",
        "position": 4
      },
      {
        "search_date": "2023-09-20",
        "position": 3
      },
      {
        "search_date": "2023-09-23",
        "position": 4
      },
      {
        "search_date": "2023-09-24",
        "position": 4
      },
      {
        "search_date": "2023-09-27",
        "position": 4
      },
      {
        "search_date": "2023-09-30",
        "position": 5
      },
      {
        "search_date": "2023-10-01",
        "position": 5
      },
      {
        "search_date": "2023-10-02",
        "position": 4
      },
      {
        "search_date": "2023-10-03",
        "position": 4
      },
      {
        "search_date": "2023-10-04",
        "position": 4
      },
      {
        "search_date": "2023-10-05",
        "position": 4
      },
      {
        "search_date": "2023-10-07",
        "position": 4
      },
      {
        "search_date": "2023-10-09",
        "position": 4
      },
      {
        "search_date": "2023-10-11",
        "position": 4
      },
      {
        "search_date": "2023-10-14",
        "position": 4
      },
      {
        "search_date": "2023-10-18",
        "position": 4
      },
      {
        "search_date": "2023-10-19",
        "position": 4
      },
      {
        "search_date": "2023-10-21",
        "position": 4
      },
      {
        "search_date": "2023-10-22",
        "position": 4
      },
      {
        "search_date": "2023-10-25",
        "position": 4
      },
      {
        "search_date": "2023-10-26",
        "position": 4
      },
      {
        "search_date": "2023-10-29",
        "position": 4
      },
      {
        "search_date": "2023-10-30",
        "position": 4
      },
      {
        "search_date": "2023-11-02",
        "position": 4
      },
      {
        "search_date": "2023-11-03",
        "position": 4
      },
      {
        "search_date": "2023-11-04",
        "position": 5
      },
      {
        "search_date": "2023-11-10",
        
```

#### curl

```bash
curl -X POST -d '{"first_date":"2023-08-06","keyword":"loutre","second_date":"2024-01-28","url":"https://www.larousse.fr/encyclopedie/vie-sauvage/loutre_dEurope/184814"}'\
  --url https://api.haloscan.com/api/keywords/serp/pageEvolution \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/serp/pageEvolution"

payload = {
    "first_date": "2023-08-06",
    "keyword": "loutre",
    "second_date": "2024-01-28",
    "url": "https://www.larousse.fr/encyclopedie/vie-sauvage/loutre_dEurope/184814"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/serp/pageEvolution',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "first_date": "2023-08-06",
         "keyword": "loutre",
         "second_date": "2024-01-28",
         "url": "https://www.larousse.fr/encyclopedie/vie-sauvage/loutre_dEurope/184814"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_bulk

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/bulk`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keywords | Oui | String[] |  |  | Array containing the requested keywords |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | keep | keep, keyword, volume, cpc, competition, kgr, allintitle | Field used for sorting results. Value "keep" preserves the original input order |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| exact_match | Non | Boolean | true |  | [Ignored when order_by = keep or not specified] When FALSE, always ignore accents, punctuation, case, special characters, etc. when matching the seed keyword. |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| include | Non | String |  |  | Regular expression for keywords to be included |
| exclude | Non | String |  |  | Regular expression for keywords to be excluded |

#### Example Response

```json
{
  "keywords": [
    "loutre",
    "loutre géante",
    "loutre de mer"
  ],
  "response_code": null,
  "failure_reason": null,
  "response_time": "0.8528 secs",
  "total_result_count": 3,
  "filtered_result_count": 3,
  "filtered_result_volume": 70700,
  "returned_result_count": 3,
  "remaining_result_count": 0,
  "results": [
    {
      "keyword": "loutre",
      "allintitle": 73400,
      "google_indexed": 4440000,
      "volume": 60500,
      "cpc": 4.42,
      "competition": 0.01,
      "kgr": 1.2132,
      "word_count": 1
    },
    {
      "keyword": "loutre de mer",
      "allintitle": 4980,
      "google_indexed": 1210000,
      "volume": 6600,
      "cpc": "NA",
      "competition": "NA",
      "kgr": 0.7545,
      "word_count": 3
    },
    {
      "keyword": "loutre géante",
      "allintitle": 1370,
      "google_indexed": 203000,
      "volume": 3600,
      "cpc": "NA",
      "competition": "NA",
      "kgr": 0.3806,
      "word_count": 2
    }
  ]
}
```

#### curl

```bash
curl -X POST -d '{"keywords":["loutre","loutre géante","loutre de mer"],"order_by":"volume","order":"desc","lineCount":20,"page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/keywords/bulk \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/bulk"

payload = {
    "keywords": [
        "loutre",
        "loutre géante",
        "loutre de mer"
    ],
    "order_by": "volume",
    "order": "desc",
    "lineCount": 20,
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/bulk',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keywords": [
                  "loutre",
                  "loutre géante",
                  "loutre de mer"
         ],
         "order_by": "volume",
         "order": "desc",
         "lineCount": 20,
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### keywords_scrap

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/keywords/scrap`
- **Description:** Sends a request to scrap given keywords. Uses 1 keyword refresh credit per keyword in the list. A response with status 201 indicates that the request has been received and will be handled as soon as possible.
Crédit consommé
1 refresh credit per requested keyword.

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keywords | Oui | String[] |  |  | Array containing the requested keywords |

#### curl

```bash
curl -X POST -d '{"keywords":["loutre","loutre géante","loutre de mer"]}'\
  --url https://api.haloscan.com/api/keywords/scrap \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/keywords/scrap"

payload = {
    "keywords": [
        "loutre",
        "loutre géante",
        "loutre de mer"
    ]
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/keywords/scrap',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "keywords": [
                  "loutre",
                  "loutre géante",
                  "loutre de mer"
         ]
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

## Site Explorer

### domains_overview

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/overview`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url, domain or root domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| requested_data | Oui | String[] |  | Any combination of [metrics, positions_breakdown, traffic_value, categories, best_keywords, best_pages, gmb_backlinks, visibility_index_history, posit | Requested data for the given url or domain, corresponding to the content of different sections of the haloscan overview page. Data will be sent back in a field with the same name in the response. |
| lang | Non | String |  | fr, en | Only used in conjunction with "categories" in requested_data, the label field will be translated if a different language than english is requested. Original value is also present. |

#### Example Response

```json
{
  "input": "legorafi.fr",
  "mode": "auto",
  "errors": [],
  "gmb_backlinks": {
    "response_time": "0.3632 secs",
    "site": "legorafi.fr",
    "mode": "root",
    "response_code": null,
    "failure_reason": null,
    "maps_backlink_count": 1
  },
  "positions_breakdown": {
    "response_time": "0.3909 secs",
    "site": "legorafi.fr",
    "mode": "root",
    "response_code": null,
    "failure_reason": null,
    "results": [
      {
        "bucket": "0-1",
        "count": 73
      },
      {
        "bucket": "2-5",
        "count": 259
      },
      {
        "bucket": "6-10",
        "count": 510
      },
      {
        "bucket": "11-25",
        "count": 1838
      },
      {
        "bucket": "26-50",
        "count": 3961
      },
      {
        "bucket": "51-100",
        "count": 9463
      }
    ]
  },
  "categories": {
    "original_input": "legorafi.fr",
    "response_time": "4.727 secs",
    "input": "legorafi.fr",
    "mode": "root",
    "response_code": null,
    "failure_reason": null,
    "results": {
      "name": "ROOT",
      "value": 57339,
      "children": [
        {
          "name": "Apparel",
          "value": 936,
          "children": [
            {
              "name": "Apparel Accessories",
              "value": 74,
              "children": [
                {
                  "name": "Bags & Packs",
                  "value": 29,
                  "label": "Sacs et sacs à dos"
                },
                {
                  "name": "Belts & Suspenders",
                  "value": 4,
                  "label": "Ceintures et bretelles"
                },
                {
                  "name": "Billfolds & Wallets",
                  "value": 4,
                  "label": "Bracelets et portefeuilles"
                },
                {
                  "name": "Eyewear",
                  "value": 7,
                  "label": "Lunettes"
                },
                {
                  "name": "Gloves & Mittens",
                  "value": 1,
                  "label": "Gants et mitaines"
                },
                {
                  "name": "Hair Accessories",
                  "value": 5,
                  "label": "Accessoires pour cheveux"
                },
                {
                  "name": "Headwear",
                  "value": 17,
                  "label": "Chapeaux, foulards et bandanas"
                },
                {
                  "name": "Key Chains & Key Rings",
                  "value": 3,
                  "label": "Chaînes et porte-clés"
                },
                {
                  "name": "Scarves & Shawls",
                  "value": 1,
                  "label": "Echarpes et châles"
                },
                {
                  "name": "Ties",
                  "value": 1,
                  "label": "Cravates"
                }
              ],
              "label": "Accessoires pour vêtements"
            },
     
```

#### curl

```bash
curl -X POST -d '{"input":"legorafi.fr","mode":"auto","lang":"fr","requested_data":["gmb_backlinks","positions_breakdown","categories"]}'\
  --url https://api.haloscan.com/api/domains/overview \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/overview"

payload = {
    "input": "legorafi.fr",
    "mode": "auto",
    "lang": "fr",
    "requested_data": [
        "gmb_backlinks",
        "positions_breakdown",
        "categories"
    ]
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/overview',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "legorafi.fr",
         "mode": "auto",
         "lang": "fr",
         "requested_data": [
                  "gmb_backlinks",
                  "positions_breakdown",
                  "categories"
         ]
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_positions

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/positions`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, keyword, volume, traffic, position, url, cpc, competition, kgr, allintitle, last_scrap, word_count, result_count | Field used for sorting results. Defaut sort is by descending traffic, then ascending position. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| traffic_min | Non | Number |  |  |  |
| traffic_max | Non | Number |  |  |  |
| position_min | Non | Number |  |  |  |
| position_max | Non | Number |  |  |  |
| keyword_word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| keyword_word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| serp_date_min | Non | String |  |  |  |
| serp_date_max | Non | String |  |  |  |
| keyword_include | Non | String |  |  | Regular expression for keywords to be included |
| keyword_exclude | Non | String |  |  | Regular expression for keywords to be excluded |
| title_include | Non | String |  |  | Regular expression for titles to be included |
| title_exclude | Non | String |  |  | Regular expression for titles to be excluded |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_domain_count": 11,
  "filtered_keyword_count": 10595,
  "filtered_page_count": 1423,
  "filtered_result_count": 14961,
  "remaining_result_count": 14958,
  "response_code": null,
  "response_time": "2.939 secs",
  "results": [
    {
      "allintitle": 11500,
      "competition": "NA",
      "cpc": 2.46,
      "keyword": "page jaunes",
      "kgr": 0.0077,
      "last_scrap": "2023-09-26",
      "page_first_seen_date": "2023-01-29",
      "position": 2,
      "result_count": 72,
      "traffic": 98293.1195,
      "url": "https://www.solocal.com/landing/inscription-pagesjaunes",
      "volume": 1500000,
      "word_count": 2
    },
    {
      "allintitle": 355000,
      "competition": 0,
      "cpc": 2.46,
      "keyword": "pages jaunes",
      "kgr": 0.2367,
      "last_scrap": "2023-09-26",
      "page_first_seen_date": "2023-01-29",
      "position": 2,
      "result_count": 26600000,
      "traffic": 98293.1195,
      "url": "https://www.solocal.com/landing/inscription-pagesjaunes",
      "volume": 1500000,
      "word_count": 2
    },
    {
      "allintitle": 33000,
      "competition": "NA",
      "cpc": 2.46,
      "keyword": "page jaune",
      "kgr": 0.022,
      "last_scrap": "2023-09-27",
      "page_first_seen_date": "2023-01-29",
      "position": 3,
      "result_count": 692000000,
      "traffic": 65306.6946,
      "url": "https://www.solocal.com/landing/inscription-pagesjaunes",
      "volume": 1500000,
      "word_count": 2
    }
  ],
  "returned_result_count": 3,
  "total_domain_count": 11,
  "total_keyword_count": 10595,
  "total_page_count": 1423,
  "total_result_count": 14961
}
```

#### curl

```bash
curl -X POST -d '{"input":"legorafi.fr","lineCount":20,"mode":"root","order":"desc","order_by":"traffic","page":1}'\
  --url https://api.haloscan.com/api/domains/positions \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/positions"

payload = {
    "input": "legorafi.fr",
    "lineCount": 20,
    "mode": "root",
    "order": "desc",
    "order_by": "traffic",
    "page": 1
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/positions',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "legorafi.fr",
         "lineCount": 20,
         "mode": "root",
         "order": "desc",
         "order_by": "traffic",
         "page": 1
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_top_pages

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/topPages`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, domain, url, first_time_seen, last_time_seen, known_versions, total_traffic, unique_keywords, total_top_100, total_top_50, total_top_10, tota | Field used for sorting results. Default sorts by descending traffic and then ascending position. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| known_versions_min | Non | Number |  |  |  |
| known_versions_max | Non | Number |  |  |  |
| total_traffic_min | Non | Number |  |  |  |
| total_traffic_max | Non | Number |  |  |  |
| unique_keywords_min | Non | Number |  |  |  |
| unique_keywords_max | Non | Number |  |  |  |
| total_top_3_min | Non | Number |  |  |  |
| total_top_3_max | Non | Number |  |  |  |
| total_top_10_min | Non | Number |  |  |  |
| total_top_10_max | Non | Number |  |  |  |
| total_top_50_min | Non | Number |  |  |  |
| total_top_50_max | Non | Number |  |  |  |
| total_top_100_min | Non | Number |  |  |  |
| total_top_100_max | Non | Number |  |  |  |

#### Example Response

```json
{
  "original_input": "legorafi.fr",
  "response_time": "4.764 secs",
  "input": "legorafi.fr",
  "mode": "root",
  "response_code": null,
  "failure_reason": null,
  "total_result_count": 3144,
  "filtered_result_count": 3144,
  "returned_result_count": 20,
  "remaining_result_count": 3124,
  "results": [
    {
      "first_time_seen": "2024-03-10",
      "last_time_seen": "2024-12-12",
      "known_versions": 1,
      "unique_keywords": 1248,
      "total_traffic": 2234,
      "total_traffic_value": 18,
      "total_top_100": 1248,
      "total_top_50": 328,
      "total_top_10": 38,
      "total_top_3": 15,
      "top_keywords": "gorafi,le gorafi,site parodie",
      "url": "https://www.legorafi.fr/"
    },
    {
      "first_time_seen": "2024-06-02",
      "last_time_seen": "2024-12-12",
      "known_versions": 1,
      "unique_keywords": 53,
      "total_traffic": 890,
      "total_traffic_value": 209,
      "total_top_100": 53,
      "total_top_50": 46,
      "total_top_10": 1,
      "total_top_3": 0,
      "top_keywords": "copains davant,copain d'avant,copains d'avant",
      "url": "https://www.legorafi.fr/2024/04/24/apres-tiktok-lite-la-commission-europeenne-envisage-linterdiction-de-copains-davant/"
    },
    {
      "first_time_seen": "2024-03-13",
      "last_time_seen": "2024-12-11",
      "known_versions": 2,
      "unique_keywords": 82,
      "total_traffic": 768,
      "total_traffic_value": 0,
      "total_top_100": 82,
      "total_top_50": 56,
      "total_top_10": 31,
      "total_top_3": 23,
      "top_keywords": "narcos: mexico saison 4,narcos : mexico saison 4,narcos saison 4",
      "url": "https://www.legorafi.fr/2023/11/22/netflix-renouvelle-narcos-pour-une-saison-4-autour-du-cartel-du-senat/"
    },
    {
      "first_time_seen": "2024-10-02",
      "last_time_seen": "2024-12-10",
      "known_versions": 8,
      "unique_keywords": 85,
      "total_traffic": 500,
      "total_traffic_value": 144,
      "total_top_100": 85,
      "total_top_50": 62,
      "total_top_10": 13,
      "total_top_3": 9,
      "top_keywords": "attraction parc astérix nouvelle,parc astérix accident 11 morts,accidents parc asterix",
      "url": "https://www.legorafi.fr/2024/10/01/8-morts-et-30-blesses-apres-leffondrement-de-niclounivis-la-nouvelle-attraction-du-parc-asterix/"
    },
    {
      "first_time_seen": "2024-12-12",
      "last_time_seen": "2024-12-12",
      "known_versions": 1,
      "unique_keywords": 4,
      "total_traffic": 366,
      "total_traffic_value": 113,
      "total_top_100": 4,
      "total_top_50": 1,
      "total_top_10": 0,
      "total_top_3": 0,
      "top_keywords": "blague,blagues racistes,dentiste reims",
      "url": "https://www.legorafi.fr/2024/12/10/reims-il-explique-sa-blague-et-tout-le-monde-rigole/"
    },
    {
      "first_time_seen": "2024-05-27",
      "last_time_seen": "2024-12-12",
      "known_versions": 1,
      "unique_keywords": 52,
      "total_traffic": 311,
      "total_traffic_value": 0,

```

#### curl

```bash
curl -X POST -d '{"input":"legorafi.fr","lineCount":20,"mode":"auto","page":1}'\
  --url https://api.haloscan.com/api/domains/topPages \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/topPages"

payload = {
    "input": "legorafi.fr",
    "lineCount": 20,
    "mode": "auto",
    "page": 1
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/topPages',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "legorafi.fr",
         "lineCount": 20,
         "mode": "auto",
         "page": 1
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_history_positions

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/history`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| date_from | Oui | String |  |  | Date in YYYY-MM-DD format |
| date_to | Oui | String |  |  | Date in YYYY-MM-DD format |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, volume, traffic, position, keyword, url, cpc, competition, kgr, allintitle, last_scrap, word_count, result_count | Field used for sorting results. Default sorts by descending traffic and then ascending position. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| best_position_min | Non | Number |  |  |  |
| best_position_max | Non | Number |  |  |  |
| worst_position_min | Non | Number |  |  |  |
| worst_position_max | Non | Number |  |  |  |
| first_time_seen_min | Non | String |  |  | Date with YYYY-MM-DD format |
| first_time_seen_max | Non | String |  |  | Date with YYYY-MM-DD format |
| last_time_seen_min | Non | String |  |  | Date with YYYY-MM-DD format |
| last_time_seen_max | Non | String |  |  | Date with YYYY-MM-DD format |
| most_recent_position_min | Non | Number |  |  |  |
| most_recent_position_max | Non | Number |  |  |  |
| subdomain_count_min | Non | Number |  |  |  |
| subdomain_count_max | Non | Number |  |  |  |
| page_count_min | Non | Number |  |  |  |
| page_count_max | Non | Number |  |  |  |
| still_there | Non | Boolean |  |  | When TRUE, only keep positions that are still held. When FALSE, only keep positions that were lost. Leave empty if you don't want to filter. |
| keyword_include | Non | String |  |  | Regular expression for keywords to be included |
| keyword_exclude | Non | String |  |  | Regular expression for keywords to be excluded |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_result_count": 35663,
  "input": "solocal.com",
  "mode": "auto",
  "original_input": "solocal.com",
  "remaining_result_count": 35660,
  "response_code": null,
  "response_time": "8.492 secs",
  "results": [
    {
      "allintitle": 11500,
      "best_position": 2,
      "competition": "NA",
      "cpc": 2.46,
      "first_time_seen": "2021-11-21",
      "keyword": "page jaunes",
      "keyword_last_scrap_date": "2023-09-26",
      "kgr": 0.0077,
      "last_time_seen": "2023-09-26",
      "most_recent_position": 2,
      "most_recent_traffic": 98293,
      "page_count": 8,
      "result_count": 72,
      "root_domain": "solocal.com",
      "status": "2",
      "still_there": true,
      "subdomain_count": 2,
      "times_seen": 49,
      "url": "https://www.solocal.com/landing/inscription-pagesjaunes",
      "volume": 1500000,
      "word_count": 2,
      "worst_position": 94
    },
    {
      "allintitle": 355000,
      "best_position": 2,
      "competition": 0,
      "cpc": 2.46,
      "first_time_seen": "2021-04-13",
      "keyword": "pages jaunes",
      "keyword_last_scrap_date": "2023-09-26",
      "kgr": 0.2367,
      "last_time_seen": "2023-09-26",
      "most_recent_position": 2,
      "most_recent_traffic": 98293,
      "page_count": 3,
      "result_count": 26600000,
      "root_domain": "solocal.com",
      "status": "2",
      "still_there": true,
      "subdomain_count": 1,
      "times_seen": 83,
      "url": "https://www.solocal.com/landing/inscription-pagesjaunes",
      "volume": 1500000,
      "word_count": 2,
      "worst_position": 37
    },
    {
      "allintitle": 25600,
      "best_position": 3,
      "competition": 0.01,
      "cpc": 2.46,
      "first_time_seen": "2021-04-13",
      "keyword": "pages jaune",
      "keyword_last_scrap_date": "2023-09-27",
      "kgr": 0.0171,
      "last_time_seen": "2023-09-27",
      "most_recent_position": 3,
      "most_recent_traffic": 65307,
      "page_count": 4,
      "result_count": 148000000,
      "root_domain": "solocal.com",
      "status": "3",
      "still_there": true,
      "subdomain_count": 2,
      "times_seen": 51,
      "url": "https://www.solocal.com/landing/inscription-pagesjaunes",
      "volume": 1500000,
      "word_count": 2,
      "worst_position": 94
    }
  ],
  "returned_result_count": 3,
  "total_result_count": 35663
}
```

#### curl

```bash
curl -X POST -d '{"input":"legorafi.fr","date_from":"2022-10-19","date_to":"2023-10-19","lineCount":20,"mode":"auto","order":"desc","order_by":"most_recent_traffic","page":1}'\
  --url https://api.haloscan.com/api/domains/history \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/history"

payload = {
    "input": "legorafi.fr",
    "date_from": "2022-10-19",
    "date_to": "2023-10-19",
    "lineCount": 20,
    "mode": "auto",
    "order": "desc",
    "order_by": "most_recent_traffic",
    "page": 1
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/history',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "legorafi.fr",
         "date_from": "2022-10-19",
         "date_to": "2023-10-19",
         "lineCount": 20,
         "mode": "auto",
         "order": "desc",
         "order_by": "most_recent_traffic",
         "page": 1
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_history_pages

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/pagesHistory`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| date_from | Oui | String |  |  | Date in YYYY-MM-DD format |
| date_to | Oui | String |  |  | Date in YYYY-MM-DD format |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, domain, url, first_time_seen, last_time_seen, known_versions, total_traffic, unique_keywords, total_top_100, total_top_50, total_top_10, tota | Field used for sorting results. Default sorts by descending traffic and then ascending position. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| known_versions_min | Non | Number |  |  |  |
| known_versions_max | Non | Number |  |  |  |
| total_traffic_min | Non | Number |  |  |  |
| total_traffic_max | Non | Number |  |  |  |
| unique_keywords_min | Non | Number |  |  |  |
| unique_keywords_max | Non | Number |  |  |  |
| total_top_3_min | Non | Number |  |  |  |
| total_top_3_max | Non | Number |  |  |  |
| total_top_10_min | Non | Number |  |  |  |
| total_top_10_max | Non | Number |  |  |  |
| total_top_50_min | Non | Number |  |  |  |
| total_top_50_max | Non | Number |  |  |  |
| total_top_100_min | Non | Number |  |  |  |
| total_top_100_max | Non | Number |  |  |  |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_result_count": 1629,
  "input": "solocal.com",
  "mode": "auto",
  "original_input": "solocal.com",
  "remaining_result_count": 1626,
  "response_code": null,
  "response_time": "35.11 secs",
  "results": [
    {
      "active_keywords": 294,
      "domain": "www.solocal.com",
      "first_time_seen": "2021-11-22",
      "known_versions": 19,
      "last_time_seen": "2023-09-27",
      "lost_keywords": 141,
      "total_top_10": 217,
      "total_top_100": 435,
      "total_top_3": 159,
      "total_top_50": 299,
      "total_traffic": 450115.9884,
      "unique_keywords": 435,
      "url": "https://www.solocal.com/landing/inscription-pagesjaunes"
    },
    {
      "active_keywords": 291,
      "domain": "www.solocal.com",
      "first_time_seen": "2021-11-21",
      "known_versions": 60,
      "last_time_seen": "2023-09-27",
      "lost_keywords": 290,
      "total_top_10": 142,
      "total_top_100": 581,
      "total_top_3": 43,
      "total_top_50": 446,
      "total_traffic": 218949.8222,
      "unique_keywords": 581,
      "url": "https://www.solocal.com/ressources/articles/inscription-pages-jaunes"
    },
    {
      "active_keywords": 38,
      "domain": "help.solocal.com",
      "first_time_seen": "2021-11-26",
      "known_versions": 11,
      "last_time_seen": "2023-09-27",
      "lost_keywords": 21,
      "total_top_10": 12,
      "total_top_100": 59,
      "total_top_3": 4,
      "total_top_50": 39,
      "total_traffic": 126605.9683,
      "unique_keywords": 59,
      "url": "https://help.solocal.com/hc/fr/articles/360017512199-Connecter-Facebook-%C3%A0-mon-Solocal-Manager"
    }
  ],
  "returned_result_count": 3,
  "total_result_count": 1629
}
```

#### curl

```bash
curl -X POST -d '{"input":"legorafi.fr","date_from":"2022-10-19","date_to":"2023-10-19","lineCount":20,"mode":"auto","order":"desc","order_by":"total_traffic","page":1}'\
  --url https://api.haloscan.com/api/domains/pagesHistory \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/pagesHistory"

payload = {
    "input": "legorafi.fr",
    "date_from": "2022-10-19",
    "date_to": "2023-10-19",
    "lineCount": 20,
    "mode": "auto",
    "order": "desc",
    "order_by": "total_traffic",
    "page": 1
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/pagesHistory',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "legorafi.fr",
         "date_from": "2022-10-19",
         "date_to": "2023-10-19",
         "lineCount": 20,
         "mode": "auto",
         "order": "desc",
         "order_by": "total_traffic",
         "page": 1
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### page_best_keywords

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/pageBestKeywords`
- **Description:** Returns best positioned keywords for the given pages
Crédit consommé
1 keyword credit per call and 1 export credit per returned result. No credit is consumed in case of error.

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String[] |  |  | requested urls |
| lineCount | Non | Number | 3 | Between 1 and 10 | Number of keywords to return |
| strategy | Non | String | both | both, only_lost, only_active | Whether to return all positioned keywords, only active ones or only lost ones |

#### Example Response

```json
{
  "response_time": "2.373 secs",
  "results": [
    {
      "input": "https://www.legorafi.fr/",
      "best_keywords": "gorafi, le gorafi, gorafi magazine"
    },
    {
      "input": "https://mutuelle.fr",
      "best_keywords": "mutuelle, mutuel, mutuelles"
    }
  ]
}
```

#### curl

```bash
curl -X POST -d '{"input":["https://www.legorafi.fr/","https://mutuelle.fr"],"lineCount":3,"strategy":"only_active"}'\
  --url https://api.haloscan.com/api/domains/pageBestKeywords \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/pageBestKeywords"

payload = {
    "input": [
        "https://www.legorafi.fr/",
        "https://mutuelle.fr"
    ],
    "lineCount": 3,
    "strategy": "only_active"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/pageBestKeywords',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": [
                  "https://www.legorafi.fr/",
                  "https://mutuelle.fr"
         ],
         "lineCount": 3,
         "strategy": "only_active"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_keywords

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/keywords`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| keywords | Oui | String[] |  |  | Array containing the requested keywords |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, keyword, volume, cpc, competition, kgr, allintitle | Field used for sorting results |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| competition_min | Non | Number |  |  | between 0 and 1 |
| competition_max | Non | Number |  |  | between 0 and 1 |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| position_min | Non | Number |  |  |  |
| position_max | Non | Number |  |  |  |
| traffic_min | Non | Number |  |  |  |
| traffic_max | Non | Number |  |  |  |
| title_word_count_min | Non | Number |  |  | Min number of words making up the keyword |
| title_word_count_max | Non | Number |  |  | Max number of words making up the keyword |
| serp_date_min | Non | String |  |  |  |
| serp_date_max | Non | String |  |  |  |
| keyword_include | Non | String |  |  | Regular expression for keywords to be included |
| keyword_exclude | Non | String |  |  | Regular expression for keywords to be excluded |
| title_include | Non | String |  |  | Regular expression for titles to be included |
| title_exclude | Non | String |  |  | Regular expression for titles to be excluded |
| url_include | Non | String |  |  | Regular expression for urls to be included |
| url_exclude | Non | String |  |  | Regular expression for urls to be excluded |

#### Example Response

```json
{
  "response_time": "0.9893 secs",
  "response_code": null,
  "failure_reason": null,
  "total_result_count": 2,
  "total_keyword_count": 2,
  "total_page_count": 1,
  "total_domain_count": 1,
  "filtered_result_count": 2,
  "filtered_keyword_count": 2,
  "filtered_page_count": 1,
  "filtered_domain_count": 1,
  "returned_result_count": 2,
  "remaining_result_count": 0,
  "results": [
    {
      "last_scrap": "2024-04-29",
      "page_first_seen_date": "2023-01-07",
      "position": 2,
      "traffic": 2490.962,
      "keyword": "inlay core",
      "volume": 12100,
      "cpc": 0.89,
      "competition": 0.12,
      "allintitle": 4810,
      "result_count": 3860000,
      "kgr": 0.3975,
      "word_count": 2,
      "url": "https://mutuelle.fr/infos/dentaire/inlay-core/"
    },
    {
      "last_scrap": "2024-04-28",
      "page_first_seen_date": "2023-01-07",
      "position": 2,
      "traffic": 2490.962,
      "keyword": "inlay-core",
      "volume": 12100,
      "cpc": 0.89,
      "competition": 0.12,
      "allintitle": 1380,
      "result_count": 4150000,
      "kgr": 0.114,
      "word_count": 2,
      "url": "https://mutuelle.fr/infos/dentaire/inlay-core/"
    }
  ]
}
```

#### curl

```bash
curl -X POST -d '{"input":"mutuelle.fr","keywords":["inlay core","inlay-core"],"lineCount":10,"order":"desc","order_by":"volume","page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/domains/keywords \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/keywords"

payload = {
    "input": "mutuelle.fr",
    "keywords": [
        "inlay core",
        "inlay-core"
    ],
    "lineCount": 10,
    "order": "desc",
    "order_by": "volume",
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/keywords',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "mutuelle.fr",
         "keywords": [
                  "inlay core",
                  "inlay-core"
         ],
         "lineCount": 10,
         "order": "desc",
         "order_by": "volume",
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_bulk

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/bulk`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| inputs | Oui | String[] |  |  | Array containing the requested urls or domains |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | keep | keep, first_time_seen, last_time_seen, indexed_pages, unique_keywords, total_traffic, total_top_100, total_top_50, total_top_10, total_top_3, name, ty | Field used for sorting results. Value "keep" preserves the original input order |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| total_traffic_min | Non | Number |  |  |  |
| total_traffic_max | Non | Number |  |  |  |
| unique_keywords_min | Non | Number |  |  |  |
| unique_keywords_max | Non | Number |  |  |  |
| total_top_3_min | Non | Number |  |  |  |
| total_top_3_max | Non | Number |  |  |  |
| total_top_10_min | Non | Number |  |  |  |
| total_top_10_max | Non | Number |  |  |  |
| total_top_50_min | Non | Number |  |  |  |
| total_top_50_max | Non | Number |  |  |  |
| total_top_100_min | Non | Number |  |  |  |
| total_top_100_max | Non | Number |  |  |  |

#### Example Response

```json
{
  "keywords": {},
  "response_code": null,
  "failure_reason": null,
  "response_time": "0.7533 secs",
  "total_result_count": 1,
  "known_item_count": 1,
  "filtered_result_count": 1,
  "filtered_result_volume": -1,
  "returned_result_count": 1,
  "remaining_result_count": 0,
  "results": [
    {
      "first_time_seen": "2021-11-18",
      "last_time_seen": "2023-10-19",
      "indexed_pages": 2097,
      "unique_keywords": 8712,
      "total_traffic": 9977,
      "total_traffic_value": 320,
      "total_top_100": 9364,
      "total_top_50": 3832,
      "total_top_10": 413,
      "total_top_3": 96,
      "type": "Root Domain",
      "traffic_rank": 37758,
      "page_count_rank": 20458,
      "keyword_count_rank": 20447,
      "url": "legorafi.fr"
    }
  ]
}
```

#### curl

```bash
curl -X POST -d '{"inputs":["legorafi.fr"],"order_by":"total_traffic","order":"desc","lineCount":20,"page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/domains/bulk \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/bulk"

payload = {
    "inputs": [
        "legorafi.fr"
    ],
    "order_by": "total_traffic",
    "order": "desc",
    "lineCount": 20,
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/bulk',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "inputs": [
                  "legorafi.fr"
         ],
         "order_by": "total_traffic",
         "order": "desc",
         "lineCount": 20,
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_competitors

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/siteCompetitors`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |

#### Example Response

```json
{
  "failure_reason": null,
  "mode": "root",
  "response_code": null,
  "response_time": "27.89 secs",
  "results": [
    {
      "bested": 2417,
      "common_keywords": 4457,
      "exclusive_keywords": 34009,
      "keywords": 35293,
      "keywords_vs_max": 0.509263801910479,
      "missed_keywords": 30836,
      "positions": 40636,
      "positions_on_common_keywords": 5320,
      "positions_on_exclusive_keywords": 40782,
      "root_domain": "franceolympique.com",
      "total_traffic": 127513,
      "url": "franceolympique.com"
    },
    {
      "bested": 872,
      "common_keywords": 1743,
      "exclusive_keywords": 36723,
      "keywords": 9906,
      "keywords_vs_max": 0.142939597702808,
      "missed_keywords": 8163,
      "positions": 12251,
      "positions_on_common_keywords": 2200,
      "positions_on_exclusive_keywords": 45019,
      "root_domain": "handisport.org",
      "total_traffic": 28177,
      "url": "handisport.org"
    },
    {
      "bested": 913,
      "common_keywords": 1570,
      "exclusive_keywords": 36896,
      "keywords": 6507,
      "keywords_vs_max": 0.0938933941300395,
      "missed_keywords": 4937,
      "positions": 8824,
      "positions_on_common_keywords": 2377,
      "positions_on_exclusive_keywords": 44985,
      "root_domain": "profession-sport-loisirs.fr",
      "total_traffic": 4466,
      "url": "profession-sport-loisirs.fr"
    }
  ],
  "site": "sports.gouv.fr"
}
```

#### curl

```bash
curl -X POST -d '{"input":"legorafi.fr","lineCount":5,"mode":"auto","order":"desc","page":1}'\
  --url https://api.haloscan.com/api/domains/siteCompetitors \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/siteCompetitors"

payload = {
    "input": "legorafi.fr",
    "lineCount": 5,
    "mode": "auto",
    "order": "desc",
    "page": 1
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/siteCompetitors',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "legorafi.fr",
         "lineCount": 5,
         "mode": "auto",
         "order": "desc",
         "page": 1
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_competitors_keywords_diff

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/siteCompetitors/keywordsDiff`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| competitors | Non | String[] | auto |  | List of competitors to compare the input to |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| exclusive | Non | Boolean |  |  | Whether to include positions where only the search input is positioned, and none of the requested competitors is. |
| missing | Non | Boolean |  |  | Whether to include positions where the search input is not positioned, and at least one of the requested competitors is. |
| besting | Non | Boolean |  |  | Whether to include positions where the search input is positioned, and better positioned than at least one of the requested competitors. |
| bested | Non | Boolean |  |  | Whether to include positions where the search input is positioned, but at least one of the requested competitors is positioned better. |
| acceptedTypes | Non | String[] | auto | Any combination of [missing,exclusive,besting,bested,mixed] | That’s just a filter, it’s not necessary to use it if you used the matching boolean params (using the boolean params makes it faster). The only difference is that with this, you can separate mixed key |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, best_reference_position, best_reference_url, best_reference_traffic, best_competitor_position, best_competitor_traffic, competitors_positions | Field used for sorting results. "default" value first sorts by descending unique_competitors_count, then by descending best_competitor_traffic. |
| best_competitor_traffic_min | Non | Number |  |  |  |
| best_competitor_traffic_max | Non | Number |  |  |  |
| best_competitor_traffic_keep_na | Non | Boolean |  |  |  |
| best_competitor_position_min | Non | Number |  |  |  |
| best_competitor_position_max | Non | Number |  |  |  |
| best_reference_traffic_min | Non | Number |  |  |  |
| best_reference_traffic_max | Non | Number |  |  |  |
| best_reference_traffic_keep_na | Non | Boolean |  |  |  |
| best_reference_position_min | Non | Number |  |  |  |
| best_reference_position_max | Non | Number |  |  |  |
| competitors_positions_min | Non | Number |  |  |  |
| competitors_positions_max | Non | Number |  |  |  |
| unique_competitors_count_min | Non | Number |  |  |  |
| unique_competitors_count_max | Non | Number |  |  |  |
| keyword_word_count_min | Non | Number |  |  |  |
| keyword_word_count_max | Non | Number |  |  |  |
| keyword_include | Non | String |  |  | Regular expression for keywords to be included |
| keyword_exclude | Non | String |  |  | Regular expression for keywords to be excluded |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| volume_keep_na | Non | Boolean |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| cpc_keep_na | Non | Boolean |  |  |  |
| competition_min | Non | Number |  |  |  |
| competition_max | Non | Number |  |  |  |
| competition_keep_na | Non | Boolean |  |  |  |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kgr_keep_na | Non | Boolean |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| allintitle_keep_na | Non | Boolean |  |  |  |
| google_indexed_min | Non | Number |  |  |  |
| google_indexed_max | Non | Number |  |  |  |
| google_indexed_keep_na | Non | Boolean |  |  |  |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_domain_count": 0,
  "filtered_page_count": 14220,
  "filtered_result_count": 88221,
  "filtered_result_summary": [
    {
      "bested": 0,
      "besting": 0,
      "exclusive": 30578,
      "missing": 0,
      "mixed": 0,
      "unique_competitors_count": 0
    },
    {
      "bested": 2647,
      "besting": 3192,
      "exclusive": 0,
      "missing": 47302,
      "mixed": 124,
      "unique_competitors_count": 1
    },
    {
      "bested": 330,
      "besting": 774,
      "exclusive": 0,
      "missing": 2298,
      "mixed": 408,
      "unique_competitors_count": 2
    },
    {
      "bested": 52,
      "besting": 181,
      "exclusive": 0,
      "missing": 147,
      "mixed": 118,
      "unique_competitors_count": 3
    },
    {
      "bested": 2,
      "besting": 44,
      "exclusive": 0,
      "missing": 8,
      "mixed": 15,
      "unique_competitors_count": 4
    },
    {
      "bested": 0,
      "besting": 1,
      "exclusive": 0,
      "missing": 0,
      "mixed": 0,
      "unique_competitors_count": 5
    }
  ],
  "remaining_result_count": 88201,
  "response_code": null,
  "response_time": "21.48 secs",
  "result_summary": [
    {
      "bested": 0,
      "besting": 0,
      "exclusive": 30578,
      "missing": 0,
      "mixed": 0,
      "unique_competitors_count": 0
    },
    {
      "bested": 2647,
      "besting": 3192,
      "exclusive": 0,
      "missing": 47302,
      "mixed": 124,
      "unique_competitors_count": 1
    },
    {
      "bested": 330,
      "besting": 774,
      "exclusive": 0,
      "missing": 2298,
      "mixed": 408,
      "unique_competitors_count": 2
    },
    {
      "bested": 52,
      "besting": 181,
      "exclusive": 0,
      "missing": 147,
      "mixed": 118,
      "unique_competitors_count": 3
    },
    {
      "bested": 2,
      "besting": 44,
      "exclusive": 0,
      "missing": 8,
      "mixed": 15,
      "unique_competitors_count": 4
    },
    {
      "bested": 0,
      "besting": 1,
      "exclusive": 0,
      "missing": 0,
      "mixed": 0,
      "unique_competitors_count": 5
    }
  ],
  "results": [
    {
      "allintitle": 484,
      "best_competitor_position": 23,
      "best_competitor_traffic": 0.3454,
      "best_competitor_url": "https://www.insep.fr/fr",
      "best_reference_position": 13,
      "best_reference_traffic": 1.2147,
      "best_reference_url": "https://www.sports.gouv.fr/",
      "competition": 0,
      "competitors_positions": 5,
      "cpc": "NA",
      "keyword": "sport national français",
      "kgr": 0.6722,
      "result_count": 760000000,
      "type": "besting",
      "unique_competitors_count": 5,
      "volume": 720,
      "word_count": 3
    },
    {
      "allintitle": 13500,
      "best_competitor_position": 5,
      "best_competitor_traffic": 26.4582,
      "best_competitor_url": "https://www.sportspourtous.org/fr/se-former/le-metier-d-animateur-sportif/formations-continues-animateurs-sportifs.html",
      "bes
```

#### curl

```bash
curl -X POST -d '{"input":"legorafi.fr","competitors":["infopetitenation.ca","ecniouzes.fr"],"lineCount":20,"mode":"auto","page":1}'\
  --url https://api.haloscan.com/api/domains/siteCompetitors/keywordsDiff \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/siteCompetitors/keywordsDiff"

payload = {
    "input": "legorafi.fr",
    "competitors": [
        "infopetitenation.ca",
        "ecniouzes.fr"
    ],
    "lineCount": 20,
    "mode": "auto",
    "page": 1
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/siteCompetitors/keywordsDiff',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "legorafi.fr",
         "competitors": [
                  "infopetitenation.ca",
                  "ecniouzes.fr"
         ],
         "lineCount": 20,
         "mode": "auto",
         "page": 1
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_competitors_best_pages

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/siteCompetitors/bestPages`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| competitors | Non | String[] | auto |  | List of competitors to compare the input to |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, positions, total_traffic, keywords, exclusive_keywords, besting_keywords, bested_keywords, url, most_alike_url | Field used for sorting results. |
| total_traffic_min | Non | Number |  |  |  |
| total_traffic_max | Non | Number |  |  |  |
| total_traffic_keep_na | Non | Boolean |  |  |  |
| positions_min | Non | Number |  |  |  |
| positions_max | Non | Number |  |  |  |
| keywords_min | Non | Number |  |  |  |
| keywords_max | Non | Number |  |  |  |
| exclusive_keywords_min | Non | Number |  |  | Min value for keywords exclusive to the competitor's page |
| exclusive_keywords_max | Non | Number |  |  | Max value for keywords exclusive to the competitor's page |
| besting_keywords_min | Non | Number |  |  | Min value for keywords where the competitor's page is ranked better than any of the search input's pages |
| besting_keywords_max | Non | Number |  |  | Max value for keywords where the competitor's page is ranked better than any of the search input's pages |
| bested_keywords_min | Non | Number |  |  | Min value for keywords where the competitor's page is ranked worse than at least one of the search input's pages |
| bested_keywords_max | Non | Number |  |  | Max value for keywords where the competitor's page is ranked worse than at least one of the search input's pages |

#### Example Response

```json
{
  "failure_reason": null,
  "filtered_result_count": 17959,
  "remaining_result_count": 17939,
  "response_code": null,
  "response_time": "15.14 secs",
  "results": [
    {
      "bested": 0,
      "besting": 0,
      "exclusive_keywords": 719,
      "keywords": 719,
      "most_alike_url": "NA",
      "positions": 719,
      "total_traffic": 17943.5583,
      "url": "https://decathlondom.franceolympique.com/decathlondom/fichiers/pages/fiches_techniques/sante/muscles/muscles-jambes.htm"
    },
    {
      "bested": 0,
      "besting": 0,
      "exclusive_keywords": 423,
      "keywords": 423,
      "most_alike_url": "NA",
      "positions": 423,
      "total_traffic": 14003.8289,
      "url": "https://decathlondom.franceolympique.com/decathlondom/fichiers/pages/fiches_techniques/sante/muscles/muscles-dos.htm"
    },
    {
      "bested": 29,
      "besting": 61,
      "exclusive_keywords": 328,
      "keywords": 418,
      "most_alike_url": "https://www.sports.gouv.fr/",
      "positions": 418,
      "total_traffic": 12274.1887,
      "url": "https://cnosf.franceolympique.com/cnosf/actus/6129-jeux-en-france.html"
    },
    {
      "bested": 376,
      "besting": 100,
      "exclusive_keywords": 846,
      "keywords": 1322,
      "most_alike_url": "https://www.sports.gouv.fr/",
      "positions": 1322,
      "total_traffic": 3266.1275,
      "url": "https://www.insep.fr/fr"
    },
    {
      "bested": 0,
      "besting": 2,
      "exclusive_keywords": 272,
      "keywords": 274,
      "most_alike_url": "https://www.sports.gouv.fr/bras-de-fer-sportif-200",
      "positions": 274,
      "total_traffic": 4852.6864,
      "url": "https://decathlondom.franceolympique.com/decathlondom/fichiers/pages/fiches_techniques/sante/muscles/muscles-bras.htm"
    },
    {
      "bested": 135,
      "besting": 34,
      "exclusive_keywords": 283,
      "keywords": 452,
      "most_alike_url": "https://www.sports.gouv.fr/",
      "positions": 452,
      "total_traffic": 4219.3351,
      "url": "https://www.handisport.org/"
    },
    {
      "bested": 2,
      "besting": 4,
      "exclusive_keywords": 166,
      "keywords": 172,
      "most_alike_url": "https://www.sports.gouv.fr/",
      "positions": 172,
      "total_traffic": 3220.5299,
      "url": "https://cnosf.franceolympique.com/cnosf/actus/4929-les-anneaux-et-le-drapeau-olympique.html"
    },
    {
      "bested": 10,
      "besting": 35,
      "exclusive_keywords": 150,
      "keywords": 195,
      "most_alike_url": "https://www.sports.gouv.fr/IMG/pdf/sporteco_fichechine2022_maj.pdf",
      "positions": 195,
      "total_traffic": 2640.3379,
      "url": "https://cnosf.franceolympique.com/cnosf/actus/8563-les-sites-des-preuves-de-jeux-de-pkin-2022.html"
    },
    {
      "bested": 196,
      "besting": 31,
      "exclusive_keywords": 138,
      "keywords": 365,
      "most_alike_url": "https://www.sports.gouv.fr/",
      "positions": 365,
      "total_traffic": 2549.7917,
      "url": "https://www.sp
```

#### curl

```bash
curl -X POST -d '{"input":"legorafi.fr","competitors":["infopetitenation.ca","ecniouzes.fr"],"lineCount":20,"mode":"auto","order":"desc","page":1}'\
  --url https://api.haloscan.com/api/domains/siteCompetitors/bestPages \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/siteCompetitors/bestPages"

payload = {
    "input": "legorafi.fr",
    "competitors": [
        "infopetitenation.ca",
        "ecniouzes.fr"
    ],
    "lineCount": 20,
    "mode": "auto",
    "order": "desc",
    "page": 1
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/siteCompetitors/bestPages',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "legorafi.fr",
         "competitors": [
                  "infopetitenation.ca",
                  "ecniouzes.fr"
         ],
         "lineCount": 20,
         "mode": "auto",
         "order": "desc",
         "page": 1
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_competitors_keywords_best_pos

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/siteCompetitors/keywordsBestPos`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| competitors | Oui | String[] |  |  | List of competitor domains or root domains |
| keywords | Oui | String[] |  |  | List of keywords to look for |
| mode | Non | String | root | root, domain | Whether to look for a root domain or subdomain. |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, best_reference_position, best_competitor_position, best_competitor_traffic, competitors_positions, unique_competitors_count, type, keyword, v | Field used for sorting results. "default" value first sorts by descending unique_competitors_count, then by descending best_competitor_traffic. |
| best_competitor_traffic_min | Non | Number |  |  |  |
| best_competitor_traffic_max | Non | Number |  |  |  |
| best_competitor_traffic_keep_na | Non | Boolean |  |  |  |
| best_competitor_position_min | Non | Number |  |  |  |
| best_competitor_position_max | Non | Number |  |  |  |
| competitors_positions_min | Non | Number |  |  |  |
| competitors_positions_max | Non | Number |  |  |  |
| unique_competitors_count_min | Non | Number |  |  |  |
| unique_competitors_count_max | Non | Number |  |  |  |
| keyword_word_count_min | Non | Number |  |  |  |
| keyword_word_count_max | Non | Number |  |  |  |
| keyword_include | Non | String |  |  | Regular expression for keywords to be included |
| keyword_exclude | Non | String |  |  | Regular expression for keywords to be excluded |
| volume_min | Non | Number |  |  |  |
| volume_max | Non | Number |  |  |  |
| volume_keep_na | Non | Boolean |  |  |  |
| cpc_min | Non | Number |  |  |  |
| cpc_max | Non | Number |  |  |  |
| cpc_keep_na | Non | Boolean |  |  |  |
| competition_min | Non | Number |  |  |  |
| competition_max | Non | Number |  |  |  |
| competition_keep_na | Non | Boolean |  |  |  |
| kgr_min | Non | Number |  |  |  |
| kgr_max | Non | Number |  |  |  |
| kgr_keep_na | Non | Boolean |  |  |  |
| kvi_min | Non | Number |  |  |  |
| kvi_max | Non | Number |  |  |  |
| kvi_keep_na | Non | Boolean |  |  |  |
| allintitle_min | Non | Number |  |  |  |
| allintitle_max | Non | Number |  |  |  |
| allintitle_keep_na | Non | Boolean |  |  |  |

#### Example Response

```json
{
  "response_time": "0.3949 secs",
  "response_code": null,
  "failure_reason": null,
  "total_result_count": 4,
  "total_page_count": 4,
  "total_domain_count": 0,
  "filtered_result_count": 4,
  "filtered_page_count": 4,
  "filtered_domain_count": 0,
  "returned_result_count": 4,
  "remaining_result_count": 0,
  "results": [
    {
      "search_date": "2025-04-05",
      "best_competitor_position": 2,
      "best_competitor_traffic": 538,
      "unique_competitors_count": 5,
      "competitors_positions": 8,
      "competitor_id": 117360,
      "keyword": "mutuelle pas chère",
      "allintitle": 1440,
      "result_count": 6650000,
      "ads_volume": 14800,
      "cpc": 9.82,
      "competition": 0.88,
      "kvi": 42,
      "redirects_to": "NA",
      "suggested_spelling": "NA",
      "volume": 8200,
      "kgr": 0.1756,
      "best_competitor_url": "https://www.malakoffhumanis.com/particuliers/mutuelle/mutuelle-pas-chere/",
      "keywords_vs_max": null
    },
    {
      "search_date": "2025-04-04",
      "best_competitor_position": 8,
      "best_competitor_traffic": 76,
      "unique_competitors_count": 5,
      "competitors_positions": 10,
      "competitor_id": 117360,
      "keyword": "devis mutuelle",
      "allintitle": 4650,
      "result_count": 23700000,
      "ads_volume": 6600,
      "cpc": 11.7,
      "competition": 0.7,
      "kvi": 29,
      "redirects_to": "NA",
      "suggested_spelling": "NA",
      "volume": 5500,
      "kgr": 0.8455,
      "best_competitor_url": "https://www.malakoffhumanis.com/particuliers/mutuelle/pack-sante-particuliers/",
      "keywords_vs_max": null
    },
    {
      "search_date": "2025-04-03",
      "best_competitor_position": 1,
      "best_competitor_traffic": 12375,
      "unique_competitors_count": 4,
      "competitors_positions": 8,
      "competitor_id": 127286,
      "keyword": "mutuelle",
      "allintitle": 1180000,
      "result_count": 124000000,
      "ads_volume": 110000,
      "cpc": 9.5,
      "competition": 0.85,
      "kvi": 42,
      "redirects_to": "NA",
      "suggested_spelling": "NA",
      "volume": 100000,
      "kgr": 11.8,
      "best_competitor_url": "https://www.aesio.fr/",
      "keywords_vs_max": null
    },
    {
      "search_date": "2025-03-01",
      "best_competitor_position": 4,
      "best_competitor_traffic": 29,
      "unique_competitors_count": 4,
      "competitors_positions": 8,
      "competitor_id": 117360,
      "keyword": "tarif mutuelle",
      "allintitle": 2600,
      "result_count": 35600000,
      "ads_volume": 880,
      "cpc": 5.23,
      "competition": 0.49,
      "kvi": 25,
      "redirects_to": "NA",
      "suggested_spelling": "NA",
      "volume": 880,
      "kgr": 2.9545,
      "best_competitor_url": "https://www.malakoffhumanis.com/particuliers/mutuelle/prix-mutuelle/",
      "keywords_vs_max": null
    }
  ]
}
```

#### curl

```bash
curl -X POST -d '{"page":1,"order":"desc","mode":"root","lineCount":5,"competitors":["aesio.fr","ag2rlamondiale.fr","malakoffhumanis.com","april.fr","adpassurances.fr"],"keywords":["mutuelle","devis mutuelle","mutuelle pas chère","tarif mutuelle"]}'\
  --url https://api.haloscan.com/api/domains/siteCompetitors/keywordsBestPos \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/siteCompetitors/keywordsBestPos"

payload = {
    "page": 1,
    "order": "desc",
    "mode": "root",
    "lineCount": 5,
    "competitors": [
        "aesio.fr",
        "ag2rlamondiale.fr",
        "malakoffhumanis.com",
        "april.fr",
        "adpassurances.fr"
    ],
    "keywords": [
        "mutuelle",
        "devis mutuelle",
        "mutuelle pas chère",
        "tarif mutuelle"
    ]
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/siteCompetitors/keywordsBestPos',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "page": 1,
         "order": "desc",
         "mode": "root",
         "lineCount": 5,
         "competitors": [
                  "aesio.fr",
                  "ag2rlamondiale.fr",
                  "malakoffhumanis.com",
                  "april.fr",
                  "adpassurances.fr"
         ],
         "keywords": [
                  "mutuelle",
                  "devis mutuelle",
                  "mutuelle pas chère",
                  "tarif mutuelle"
         ]
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_visibility_trends

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/history/visibilityTrends`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String[] |  |  | Array containing the requested urls or domains |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| type | Non | String | trends | first, highest, trends, index | Determines how returned values are computed |

#### Example Response

```json
{
  "response_code": null,
  "failure_reason": null,
  "response_time": "0.4562 secs",
  "results": [
    {
      "name": "sports.gouv.fr",
      "data": [
        {
          "agg_date": "2023-12-02",
          "visibility_index": 68.9,
          "type": "Root Domain"
        },
        {
          "agg_date": "2023-12-09",
          "visibility_index": 70.6,
          "type": "Root Domain"
        },
        {
          "agg_date": "2023-12-16",
          "visibility_index": 67.3,
          "type": "Root Domain"
        },
        {
          "agg_date": "2023-12-23",
          "visibility_index": 70.4,
          "type": "Root Domain"
        },
        {
          "agg_date": "2023-12-30",
          "visibility_index": 30.5,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-01-06",
          "visibility_index": 32.1,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-01-13",
          "visibility_index": 34.2,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-01-20",
          "visibility_index": 33,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-01-27",
          "visibility_index": 70.6,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-02-03",
          "visibility_index": 72,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-02-10",
          "visibility_index": 66.9,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-02-17",
          "visibility_index": 67.9,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-02-24",
          "visibility_index": 76.2,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-03-02",
          "visibility_index": 80.7,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-03-09",
          "visibility_index": 80.7,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-03-16",
          "visibility_index": 80.6,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-03-23",
          "visibility_index": 81.5,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-03-30",
          "visibility_index": 76.4,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-04-06",
          "visibility_index": 67.3,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-04-13",
          "visibility_index": 65.9,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-04-20",
          "visibility_index": 66.8,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-04-27",
          "visibility_index": 67.7,
          "type": "Root Domain"
        },
        {
          "agg_date": "2024-05-04",
          "visibility_index": 69.8,
          "type"
```

#### curl

```bash
curl -X POST -d '{"input":["sports.gouv.fr"],"mode":"auto"}'\
  --url https://api.haloscan.com/api/domains/history/visibilityTrends \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/history/visibilityTrends"

payload = {
    "input": [
        "sports.gouv.fr"
    ],
    "mode": "auto"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/history/visibilityTrends',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": [
                  "sports.gouv.fr"
         ],
         "mode": "auto"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_expired

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/expired`
- **Description:** Returns a list of available domains. Domains are returned without their url unless you have already revealed them (in which case root_domain is filled), and a call to domains/expired/reveal is required to reveal domains you are interested in.
Crédit consommé
None.

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| keyword | Non | String |  |  | Only keep expired domains that were positioned on keywords matching this expression. |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, total_traffic, total_pages, total_keywords, total_domains, median_position_strength, first_seen, last_seen, median_position_date, total_top_3 | Field used for sorting results. Default sort is by descending matching_traffic if keyword is present, or total_traffic otherwise. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| total_pages_min | Non | Number |  |  |  |
| total_pages_max | Non | Number |  |  |  |
| total_domains_min | Non | Number |  |  |  |
| total_domains_max | Non | Number |  |  |  |
| referring_domains_min | Non | Number |  |  |  |
| referring_domains_max | Non | Number |  |  |  |
| total_keywords_min | Non | Number |  |  |  |
| total_keywords_max | Non | Number |  |  |  |
| total_traffic_min | Non | Number |  |  |  |
| total_traffic_max | Non | Number |  |  |  |
| total_top_100_positions_min | Non | Number |  |  |  |
| total_top_100_positions_max | Non | Number |  |  |  |
| total_top_50_positions_min | Non | Number |  |  |  |
| total_top_50_positions_max | Non | Number |  |  |  |
| total_top_10_positions_min | Non | Number |  |  |  |
| total_top_10_positions_max | Non | Number |  |  |  |
| total_top_3_positions_min | Non | Number |  |  |  |
| total_top_3_positions_max | Non | Number |  |  |  |
| total_top_100_traffic_min | Non | Number |  |  |  |
| total_top_100_traffic_max | Non | Number |  |  |  |
| total_top_50_traffic_min | Non | Number |  |  |  |
| total_top_50_traffic_max | Non | Number |  |  |  |
| total_top_10_traffic_min | Non | Number |  |  |  |
| total_top_10_traffic_max | Non | Number |  |  |  |
| total_top_3_traffic_min | Non | Number |  |  |  |
| total_top_3_traffic_max | Non | Number |  |  |  |
| matching_keywords_min | Non | Number |  |  |  |
| matching_keywords_max | Non | Number |  |  |  |
| matching_pages_min | Non | Number |  |  |  |
| matching_pages_max | Non | Number |  |  |  |
| matching_traffic_min | Non | Number |  |  |  |
| matching_traffic_max | Non | Number |  |  |  |
| matching_most_recent_position_min | Non | Number |  |  |  |
| matching_most_recent_position_max | Non | Number |  |  |  |
| matching_top_100_positions_min | Non | Number |  |  |  |
| matching_top_100_positions_max | Non | Number |  |  |  |
| matching_top_50_positions_min | Non | Number |  |  |  |
| matching_top_50_positions_max | Non | Number |  |  |  |
| matching_top_10_positions_min | Non | Number |  |  |  |
| matching_top_10_positions_max | Non | Number |  |  |  |
| matching_top_3_positions_min | Non | Number |  |  |  |
| matching_top_3_positions_max | Non | Number |  |  |  |
| first_time_available_min | Non | String |  |  | Date in YYYY-MM-DD format |
| first_time_available_max | Non | String |  |  | Date in YYYY-MM-DD format |
| last_time_available_min | Non | String |  |  | Date in YYYY-MM-DD format |
| last_time_available_max | Non | String |  |  | Date in YYYY-MM-DD format |
| firstseen_min | Non | String |  |  | Date in YYYY-MM-DD format |
| first_seen_max | Non | String |  |  | Date in YYYY-MM-DD format |
| last_seen_min | Non | String |  |  | Date in YYYY-MM-DD format |
| last_seen_max | Non | String |  |  | Date in YYYY-MM-DD format |
| fb_comments_min | Non | Number |  |  |  |
| fb_comments_max | Non | Number |  |  |  |
| fb_shares_min | Non | Number |  |  |  |
| fb_shares_max | Non | Number |  |  |  |
| pinterest_pins_min | Non | Number |  |  |  |
| pinterest_pins_max | Non | Number |  |  |  |
| root_domain_include | Non | String |  |  | Regular expression for root domains to be included |
| root_domain_exclude | Non | String |  |  | Regular expression for root domains to be excluded |

#### Example Response

```json
{
  "total_result_count": 1,
  "returned_result_count": 1,
  "remaining_result_count": 0,
  "response_code": null,
  "failure_reason": null,
  "results": [
    {
      "root_domain_key": 1222341,
      "total_traffic": 8966,
      "total_pages": 24781,
      "total_keywords": 31887,
      "total_domains": 2,
      "median_position_strength": 1,
      "first_seen": "2021-01-17",
      "last_seen": "2023-01-21",
      "median_position_date": "2022-12-03",
      "total_top_3_positions": 44,
      "total_top_10_positions": 1115,
      "total_top_50_positions": 17682,
      "total_top_100_positions": 32152,
      "total_top_3_traffic": 255,
      "total_top_10_traffic": 3132,
      "total_top_50_traffic": 8851,
      "total_top_100_traffic": 8966,
      "first_time_available": "2023-12-16",
      "last_time_available": "2023-12-16",
      "matching_keywords": 11,
      "matching_pages": 2,
      "matching_traffic": 10.1579,
      "matching_most_recent_position": "2022-12-18",
      "matching_top_3_positions": 0,
      "matching_top_10_positions": 0,
      "matching_top_50_positions": 10,
      "matching_top_100_positions": 11,
      "fb_comments": 0,
      "fb_shares": 0,
      "stumbles": 0,
      "pinterest_pins": 0,
      "linkedin": "NA",
      "googleplus": "NA",
      "tld": "fr",
      "referring_domains": 19
    }
  ],
  "response_time": "20.77 secs"
}
```

#### curl

```bash
curl -X POST -d '{"lineCount":3,"keyword":"loutre","matching_traffic_min":10}'\
  --url https://api.haloscan.com/api/domains/expired \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/expired"

payload = {
    "lineCount": 3,
    "keyword": "loutre",
    "matching_traffic_min": 10
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/expired',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "lineCount": 3,
         "keyword": "loutre",
         "matching_traffic_min": 10
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_expired_reveal

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/expired/reveal`
- **Description:** Reveals expired root domains using the provided keys retrieved from the domains/expired endpoint.
Crédit consommé
1 expired credit requested site. No credit is consumed in case of error.

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| root_domain_keys | Oui | Number[] |  |  | list of root_domain_key fields from items in the domains/expired endpoint which you want to reveal. 1 expired domain credit will be consumed for each item in this list that you haven't previously reve |

#### Example Response

```json
{
  "results": [
    {
      "root_domain_key": 12345,
      "root_domain": "toto.com"
    },
    {
      "root_domain_key": 11112,
      "root_domain": "abcd.fr"
    }
  ],
  "response_time": "0.2994 secs"
}
```

#### curl

```bash
curl -X POST -d '{"root_domain_keys":[12345,11112]}'\
  --url https://api.haloscan.com/api/domains/expired/reveal \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/expired/reveal"

payload = {
    "root_domain_keys": [
        12345,
        11112
    ]
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/expired/reveal',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "root_domain_keys": [
                  12345,
                  11112
         ]
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_gmb_backlinks

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/gmbBacklinks`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |
| order_by | Non | String | default | default, rating_count, rating_value, is_claimed, total_photos, name, address, phone, longitude, latitude, categories, url, domain, root_domain | Field used for sorting results. Default value first sorts by descending rating_count, then by descending rating_value. |
| order | Non | String | asc | asc, desc | Whether the results are sorted in ascending or descending order |
| rating_count_min | Non | Number |  |  |  |
| rating_count_max | Non | Number |  |  |  |
| rating_count_keep_na | Non | Boolean |  |  |  |
| rating_value_min | Non | Number |  |  |  |
| rating_value_max | Non | Number |  |  |  |
| rating_value_keep_na | Non | Boolean |  |  |  |
| latitude_min | Non | Number |  |  |  |
| latitude_max | Non | Number |  |  |  |
| latitude_keep_na | Non | Boolean |  |  |  |
| longitude_min | Non | Number |  |  |  |
| longitude_max | Non | Number |  |  |  |
| longitude_keep_na | Non | Boolean |  |  |  |
| categories_include | Non | String |  |  | Regular expression for keywords to be included |
| categories_exclude | Non | String |  |  | Regular expression for keywords to be excluded |
| is_claimed | Non | Boolean |  |  | When FALSE, only return unclaimed companies. When TRUE, only return claimed companies. Leave empty if you don't want to filter. |

#### Example Response

```json
{
  "response_time": "0.3474 secs",
  "response_code": null,
  "failure_reason": null,
  "total_result_count": 1845,
  "filtered_result_count": 1845,
  "returned_result_count": 2,
  "remaining_result_count": 1843,
  "results": [
    {
      "cid": "7663719431791646503",
      "name": "CIC",
      "address": "47 Rue du Général de Gaulle, 59400 Cambrai",
      "rating_count": 176,
      "rating_value": 4.7,
      "phone": "+33327780152",
      "longitude": 3.2391,
      "latitude": 50.1753,
      "categories": "Banque, Agence d'assurance",
      "is_claimed": 1,
      "total_photos": 4,
      "url": "https://www.cic.fr/fr/agences/30027/17243/00/000",
      "domain": "www.cic.fr",
      "root_domain": "cic.fr"
    },
    {
      "cid": "11572336188685110057",
      "name": "CIC",
      "address": "24 Pl. du Martroi, 45000 Orléans",
      "rating_count": 160,
      "rating_value": 4.6,
      "phone": "+33238143855",
      "longitude": 1.9033,
      "latitude": 47.9028,
      "categories": "Banque",
      "is_claimed": 1,
      "total_photos": 7,
      "url": "https://www.cic.fr/fr/agences/30047/14670/00/000",
      "domain": "www.cic.fr",
      "root_domain": "cic.fr"
    }
  ]
}
```

#### curl

```bash
curl -X POST -d '{"input":"cic.fr","lineCount":2,"order":"desc","order_by":"rating_count","page":1,"sortOrder":"desc"}'\
  --url https://api.haloscan.com/api/domains/gmbBacklinks \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/gmbBacklinks"

payload = {
    "input": "cic.fr",
    "lineCount": 2,
    "order": "desc",
    "order_by": "rating_count",
    "page": 1,
    "sortOrder": "desc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/gmbBacklinks',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "cic.fr",
         "lineCount": 2,
         "order": "desc",
         "order_by": "rating_count",
         "page": 1,
         "sortOrder": "desc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_gmb_backlinks_map

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/gmbBacklinks/map`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |

#### Example Response

```json
{
  "response_time": "0.2219 secs",
  "response_code": null,
  "failure_reason": null,
  "total_result_count": 1,
  "filtered_result_count": 1,
  "returned_result_count": 1,
  "results": [
    {
      "latitude": 45.7487,
      "longitude": 4.8626,
      "name": "PurConseil - Mutuelle.fr"
    }
  ]
}
```

#### curl

```bash
curl -X POST -d '{"input":"mutuelle.fr"}'\
  --url https://api.haloscan.com/api/domains/gmbBacklinks/map \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/gmbBacklinks/map"

payload = {
    "input": "mutuelle.fr"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/gmbBacklinks/map',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "mutuelle.fr"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### domains_gmb_backlinks_categories

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/domains/gmbBacklinks/categories`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| input | Oui | String |  |  | requested url or domain |
| mode | Non | String | auto | auto, root, domain, url | Whether to look for a domain or a full url. Leave empty for auto detection |

#### Example Response

```json
{
  "response_time": "0.4186 secs",
  "response_code": null,
  "failure_reason": null,
  "total_result_count": 9,
  "filtered_result_count": 9,
  "returned_result_count": 9,
  "results": [
    {
      "company_count": 1823,
      "seen_count": 1823,
      "category": "Banque"
    },
    {
      "company_count": 1304,
      "seen_count": 1304,
      "category": "Agence d'assurance"
    },
    {
      "company_count": 16,
      "seen_count": 16,
      "category": "Distributeur de billets"
    },
    {
      "company_count": 1,
      "seen_count": 1,
      "category": "Établissement de crédit"
    },
    {
      "company_count": 8,
      "seen_count": 8,
      "category": "Banque du secteur privé"
    },
    {
      "company_count": 1,
      "seen_count": 1,
      "category": "Compagnie d'assurance"
    },
    {
      "company_count": 1,
      "seen_count": 1,
      "category": "Bancomat"
    },
    {
      "company_count": 1,
      "seen_count": 1,
      "category": "Banque d'investissement"
    },
    {
      "company_count": 1,
      "seen_count": 1,
      "category": "Banque coopérative"
    }
  ]
}
```

#### curl

```bash
curl -X POST -d '{"input":"cic.fr"}'\
  --url https://api.haloscan.com/api/domains/gmbBacklinks/categories \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/domains/gmbBacklinks/categories"

payload = {
    "input": "cic.fr"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/domains/gmbBacklinks/categories',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "input": "cic.fr"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

## Projects

### projects_create

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/projects/create`

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| site | Oui | String |  |  | main domain to follow |
| name | Oui | String |  |  | Project's displayed name |
| keywords | Non | String[] |  |  | Array of tracked keywords for this project. Can enter tags separated by commas after each keyword |
| tags | Non | Tag[] |  |  | Optional array of tags for keywords. Structure is {tag: String, keywords: String[]}. |
| competitors | Non | String[] |  |  | Array of tracked competitors (domains/root domains) |

#### Example Response

```json
{
  "id": 1,
  "name": "gorafi",
  "site": "legorafi.fr",
  "creationDate": "2026-01-22T12:03:39.903Z"
}
```

#### curl

```bash
curl -X POST -d '{"site":"legorafi.fr","name":"gorafi","keywords":["gorafi","le gorafi","horoscope","faux horoscope","horoscope le gorafi","parodie actualité"],"tags":[{"tag":"horoscope","keywords":["horoscope","faux horoscope","horoscope le gorafi"]}],"competitors":["lamentable.fr"]}'\
  --url https://api.haloscan.com/api/projects/create \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/projects/create"

payload = {
    "site": "legorafi.fr",
    "name": "gorafi",
    "keywords": [
        "gorafi",
        "le gorafi",
        "horoscope",
        "faux horoscope",
        "horoscope le gorafi",
        "parodie actualité"
    ],
    "tags": [
        {
            "tag": "horoscope",
            "keywords": [
                "horoscope",
                "faux horoscope",
                "horoscope le gorafi"
            ]
        }
    ],
    "competitors": [
        "lamentable.fr"
    ]
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/projects/create',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "site": "legorafi.fr",
         "name": "gorafi",
         "keywords": [
                  "gorafi",
                  "le gorafi",
                  "horoscope",
                  "faux horoscope",
                  "horoscope le gorafi",
                  "parodie actualité"
         ],
         "tags": [
                  {
                           "tag": "horoscope",
                           "keywords": [
                                    "horoscope",
                                    "faux horoscope",
                                    "horoscope le gorafi"
                           ]
                  }
         ],
         "competitors": [
                  "lamentable.fr"
         ]
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### projects_update

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/projects/{project_id}`
- **Description:** Endpoint to update a project with a given id. (Replace {project_id} with actual id in the url)

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| site | Oui | String |  |  | main domain to follow |
| name | Oui | String |  |  | Project's displayed name |
| keywords | Non | String[] |  |  | Array of tracked keywords for this project. Can enter tags separated by commas after each keyword |
| tags | Non | Tag[] |  |  | Optional array of tags for keywords. Structure is {tag: String, keywords: String[]}. |
| competitors | Non | String[] |  |  | Array of tracked competitors (domains/root domains) |

#### Example Response

```json
{
  "id": 1,
  "name": "gorafi",
  "site": "legorafi.fr",
  "keywords": [
    "gorafi",
    "le gorafi",
    "horoscope",
    "faux horoscope",
    "horoscope le gorafi",
    "parodie actualité"
  ],
  "competitors": [
    "lamentable.fr"
  ],
  "tags": [
    {
      "id": 1,
      "tag": "horoscope",
      "keywords": [
        "horoscope",
        "faux horoscope",
        "horoscope le gorafi"
      ]
    }
  ]
}
```

#### curl

```bash
curl -X POST -d '{"site":"legorafi.fr","name":"gorafi","keywords":["gorafi","le gorafi","horoscope","faux horoscope","horoscope le gorafi","parodie actualité"],"tags":[{"tag":"horoscope","keywords":["horoscope","faux horoscope","horoscope le gorafi"]}],"competitors":["lamentable.fr"]}'\
  --url https://api.haloscan.com/api/projects/{project_id} \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/projects/{project_id}"

payload = {
    "site": "legorafi.fr",
    "name": "gorafi",
    "keywords": [
        "gorafi",
        "le gorafi",
        "horoscope",
        "faux horoscope",
        "horoscope le gorafi",
        "parodie actualité"
    ],
    "tags": [
        {
            "tag": "horoscope",
            "keywords": [
                "horoscope",
                "faux horoscope",
                "horoscope le gorafi"
            ]
        }
    ],
    "competitors": [
        "lamentable.fr"
    ]
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/projects/{project_id}',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "site": "legorafi.fr",
         "name": "gorafi",
         "keywords": [
                  "gorafi",
                  "le gorafi",
                  "horoscope",
                  "faux horoscope",
                  "horoscope le gorafi",
                  "parodie actualité"
         ],
         "tags": [
                  {
                           "tag": "horoscope",
                           "keywords": [
                                    "horoscope",
                                    "faux horoscope",
                                    "horoscope le gorafi"
                           ]
                  }
         ],
         "competitors": [
                  "lamentable.fr"
         ]
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### projects_delete

- **Method:** DELETE
- **URL:** `https://api.haloscan.com/api/projects/{project_id}`
- **Description:** Endpoint to delete project with a given id. (Replace {project_id} with actual id in the url). Deleting a project cannot be undone.

#### Example Response

```json
{}
```

#### curl

```bash
curl -X DELETE -d '{}'\
  --url https://api.haloscan.com/api/projects/{project_id} \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/projects/{project_id}"

payload = {}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.get(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'DELETE',
    url: 'https://api.haloscan.com/api/projects/{project_id}',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### projects_list

- **Method:** GET
- **URL:** `https://api.haloscan.com/api/projects/list`
- **Description:** Returns a list of existing projects with their keywords and tags

#### Example Response

```json
{
  "projects": [
    {
      "id": 1,
      "name": "gorafi",
      "site": "legorafi.fr",
      "tags": [
        {
          "id": 1,
          "tag": "horoscope",
          "keywords": [
            "horoscope",
            "faux horoscope",
            "horoscope le gorafi"
          ]
        }
      ],
      "keywords": [
        "gorafi",
        "le gorafi",
        "horoscope",
        "faux horoscope",
        "horoscope le gorafi",
        "parodie actualité"
      ]
    }
  ],
  "availableKeywordsCount": 794
}
```

#### curl

```bash
curl -X GET -d '{}'\
  --url https://api.haloscan.com/api/projects/list \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/projects/list"

payload = {}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.get(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'GET',
    url: 'https://api.haloscan.com/api/projects/list',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### projects_details

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/projects/{project_id}/details`
- **Description:** Returns all settings (name, site, competitors, keywords, tags) for a specific project (replace {project_id} by actual project id in url).

#### Example Response

```json
{
  "id": 1,
  "name": "gorafi",
  "site": "legorafi.fr",
  "keywords": [
    "gorafi",
    "le gorafi",
    "horoscope",
    "faux horoscope",
    "horoscope le gorafi",
    "parodie actualité"
  ],
  "competitors": [
    "lamentable.fr"
  ],
  "tags": [
    {
      "id": 224,
      "tag": "horoscope",
      "keywords": [
        "horoscope",
        "faux horoscope",
        "horoscope le gorafi"
      ]
    }
  ],
  "availableKeywordsCount": 794
}
```

#### curl

```bash
curl -X POST -d '{}'\
  --url https://api.haloscan.com/api/projects/{project_id}/details \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/projects/{project_id}/details"

payload = {}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/projects/{project_id}/details',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### projects_overview

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/projects/overview`
- **Description:** Returns overview data for projects, incuding position graphs on tracked keywords, visibility index data and general keyword stats.
Crédit consommé
1 site credit per call

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| date_from | Non | String |  |  | Date in YYYY-MM-DD format, initial date to consider for stats |
| date_to | Non | String |  |  | Date in YYYY-MM-DD format, final date to consider for stats |
| orderBy | Non | String | creation_date | custom_rank, creation_date, name | Field used for sorting. |
| order | Non | String | desc | asc, desc | Whether to sort by ascending or descending order |

#### Example Response

```json
{
  "projects": [
    {
      "input": "legorafi.fr",
      "keywords": {
        "first": 16439,
        "last": 11766,
        "detail": [
          {
            "search_date": "2025-02-23",
            "total_keyword_count": 16439
          },
          {
            "search_date": "2025-03-02",
            "total_keyword_count": 16349
          },
          {
            "search_date": "2025-03-08",
            "total_keyword_count": 16422
          },
          {
            "search_date": "2025-03-17",
            "total_keyword_count": 16381
          },
          {
            "search_date": "2025-03-23",
            "total_keyword_count": 16293
          },
          {
            "search_date": "2025-04-03",
            "total_keyword_count": 16278
          },
          {
            "search_date": "2025-04-13",
            "total_keyword_count": 16315
          },
          {
            "search_date": "2025-04-20",
            "total_keyword_count": 16400
          },
          {
            "search_date": "2025-04-27",
            "total_keyword_count": 16485
          },
          {
            "search_date": "2025-05-13",
            "total_keyword_count": 16711
          },
          {
            "search_date": "2025-05-19",
            "total_keyword_count": 16807
          },
          {
            "search_date": "2025-06-03",
            "total_keyword_count": 17184
          },
          {
            "search_date": "2025-06-07",
            "total_keyword_count": 17315
          },
          {
            "search_date": "2025-06-08",
            "total_keyword_count": 17328
          },
          {
            "search_date": "2025-06-14",
            "total_keyword_count": 17369
          },
          {
            "search_date": "2025-06-21",
            "total_keyword_count": 17489
          },
          {
            "search_date": "2025-06-29",
            "total_keyword_count": 17589
          },
          {
            "search_date": "2025-07-06",
            "total_keyword_count": 17641
          },
          {
            "search_date": "2025-07-13",
            "total_keyword_count": 17703
          },
          {
            "search_date": "2025-07-20",
            "total_keyword_count": 17602
          },
          {
            "search_date": "2025-07-26",
            "total_keyword_count": 17539
          },
          {
            "search_date": "2025-08-03",
            "total_keyword_count": 17367
          },
          {
            "search_date": "2025-08-09",
            "total_keyword_count": 17419
          },
          {
            "search_date": "2025-08-17",
            "total_keyword_count": 17802
          },
          {
            "search_date": "2025-08-24",
            "total_keyword_count": 17528
          },
          {
            "search_date": "2025-08-31",
            "total_keyword_count": 17298
          },
          {
            "search_date": "2025-09-06",
            "total_keywo
```

#### curl

```bash
curl -X POST -d '{"date_from":"2025-01-20","date_to":"2026-02-20","orderBy":"custom_rank","order":"asc"}'\
  --url https://api.haloscan.com/api/projects/overview \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/projects/overview"

payload = {
    "date_from": "2025-01-20",
    "date_to": "2026-02-20",
    "orderBy": "custom_rank",
    "order": "asc"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/projects/overview',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "date_from": "2025-01-20",
         "date_to": "2026-02-20",
         "orderBy": "custom_rank",
         "order": "asc"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### projects_single_overview

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/projects/{project_id}/overview`
- **Description:** Returns overview data and graphs for a specific project (replace {project_id} by actual project id in url).
Crédit consommé
1 site credit per call

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| date_from | Non | String |  |  | Date in YYYY-MM-DD format, initial date to consider for stats |
| date_to | Non | String |  |  | Date in YYYY-MM-DD format, final date to consider for stats |

#### Example Response

```json
{
  "response_time": "0.9758 secs",
  "original_parameters": {
    "input": [
      {
        "mode": "root",
        "item": "legorafi.fr"
      }
    ],
    "keywords": [
      "faux horoscope",
      "gorafi",
      "horoscope",
      "horoscope le gorafi",
      "le gorafi",
      "parodie actualité"
    ],
    "competitors": "lamentable.fr",
    "date_from": "2026-01-20",
    "date_to": "2026-02-23"
  },
  "response_code": null,
  "failure_reason": null,
  "overview_metrics": {
    "reference_metrics": {
      "first_visibility_index": 34.84,
      "last_visibility_index": 34.87,
      "first_page_count": 2896,
      "last_page_count": 2881,
      "first_traffic": 6305,
      "last_traffic": 5152,
      "first_keyword_count": 11947,
      "last_keyword_count": 11766,
      "first_position_count": 14611,
      "last_position_count": 14415
    },
    "competitors_metrics": {
      "lamentable.fr": {
        "first_visibility_index": 26.1,
        "last_visibility_index": 25.26,
        "first_page_count": 1397,
        "last_page_count": 1406,
        "first_traffic": 903,
        "last_traffic": 1008,
        "first_keyword_count": 4380,
        "last_keyword_count": 4411,
        "first_position_count": 4680,
        "last_position_count": 4714
      }
    }
  },
  "aggs_history": {
    "visibility": [
      {
        "search_date": "2026-01-25",
        "lamentable.fr": 26.1,
        "legorafi.fr": 34.9
      },
      {
        "search_date": "2026-02-01",
        "lamentable.fr": 26.6,
        "legorafi.fr": 34.9
      },
      {
        "search_date": "2026-02-08",
        "lamentable.fr": 26.5,
        "legorafi.fr": 35.6
      },
      {
        "search_date": "2026-02-15",
        "lamentable.fr": 26,
        "legorafi.fr": 35.5
      },
      {
        "search_date": "2026-02-22",
        "lamentable.fr": 25.3,
        "legorafi.fr": 34.9
      }
    ],
    "page_count": [
      {
        "search_date": "2026-01-25",
        "lamentable.fr": 1397,
        "legorafi.fr": 2896
      },
      {
        "search_date": "2026-02-01",
        "lamentable.fr": 1403,
        "legorafi.fr": 2890
      },
      {
        "search_date": "2026-02-08",
        "lamentable.fr": 1403,
        "legorafi.fr": 2894
      },
      {
        "search_date": "2026-02-15",
        "lamentable.fr": 1401,
        "legorafi.fr": 2892
      },
      {
        "search_date": "2026-02-22",
        "lamentable.fr": 1406,
        "legorafi.fr": 2881
      }
    ],
    "traffic": [
      {
        "search_date": "2026-01-25",
        "lamentable.fr": 903,
        "legorafi.fr": 6305
      },
      {
        "search_date": "2026-02-01",
        "lamentable.fr": 938,
        "legorafi.fr": 6338
      },
      {
        "search_date": "2026-02-08",
        "lamentable.fr": 1368,
        "legorafi.fr": 6284
      },
      {
        "search_date": "2026-02-15",
        "lamentable.fr": 908,
        "legorafi.fr": 5613
      },
      {
        "search_date": "2026-02-22",

```

#### curl

```bash
curl -X POST -d '{"date_from":"2026-01-20","date_to":"2026-02-20"}'\
  --url https://api.haloscan.com/api/projects/{project_id}/overview \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/projects/{project_id}/overview"

payload = {
    "date_from": "2026-01-20",
    "date_to": "2026-02-20"
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/projects/{project_id}/overview',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "date_from": "2026-01-20",
         "date_to": "2026-02-20"
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### projects_keywords

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/projects/{project_id}/keywords`
- **Description:** Returns rank tracking table data for keywords defined in specified project (replace {project_id} by actual project id in url).
Crédit consommé
1 site credit per call and 1 export/result count per returned result.

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| date_from | Non | String |  |  | Date in YYYY-MM-DD format, initial date to consider for stats |
| date_to | Non | String |  |  | Date in YYYY-MM-DD format, final date to consider for stats |
| tags | Non | String[] |  |  | Keep only keywords with specified tags. Tags must be defined within the project. |
| lineCount | Non | Number | 20 |  | Max number of returned results |
| page | Non | Number | 1 |  |  |

#### Example Response

```json
{
  "response_time": "1.203 secs",
  "response_code": null,
  "failure_reason": null,
  "total_result_count": 3,
  "total_keyword_count": 3,
  "total_page_count": 3,
  "total_domain_count": 0,
  "filtered_result_count": 3,
  "filtered_keyword_count": 2,
  "filtered_page_count": 2,
  "filtered_domain_count": 0,
  "returned_result_count": 2,
  "remaining_result_count": 1,
  "results": [
    {
      "first_position": 68,
      "last_position": "NA",
      "best_position": 17,
      "traffic": 1,
      "page_count": 8,
      "keyword": "horoscope",
      "status": "LOST",
      "allintitle": 7450000,
      "result_count": 48200000,
      "ads_volume": 673000,
      "cpc": 1.31,
      "competition": 0,
      "si_info": true,
      "si_nav": false,
      "si_trans": false,
      "si_comm": false,
      "si_local": false,
      "si_brand": false,
      "kvi": 27,
      "redirects_to": "NA",
      "suggested_spelling": "NA",
      "spell_keyword": "NA",
      "last_scrap_date": "2026-02-21",
      "volume": 607400,
      "kgr": 12.2654,
      "word_count": 1,
      "url": "https://www.legorafi.fr/2025/10/20/horoscope-du-20-octobre-2025/",
      "extra_data": [
        {
          "url": "https://www.legorafi.fr/2025/10/27/horoscope-du-27-octobre-2025/",
          "first_position": "NA",
          "best_position": 79,
          "last_position": "NA",
          "status": "IN&OUT"
        },
        {
          "url": "https://www.legorafi.fr/category/horoscope-2/",
          "first_position": "NA",
          "best_position": 17,
          "last_position": "NA",
          "status": "IN&OUT"
        },
        {
          "url": "https://www.legorafi.fr/2025/11/10/horoscope-du-10-novembre-2025/",
          "first_position": "NA",
          "best_position": 17,
          "last_position": "NA",
          "status": "IN&OUT"
        },
        {
          "url": "https://www.legorafi.fr/2026/01/05/horoscope-du-5-janvier-2026/",
          "first_position": "NA",
          "best_position": 58,
          "last_position": "NA",
          "status": "IN&OUT"
        },
        {
          "url": "https://www.legorafi.fr/2026/01/12/horoscope-du-12-janvier-2026/",
          "first_position": 68,
          "best_position": 68,
          "last_position": "NA",
          "status": "LOST"
        },
        {
          "url": "https://www.legorafi.fr/2026/02/02/horoscope-du-2-fevrier-2026/",
          "first_position": "NA",
          "best_position": 29,
          "last_position": "NA",
          "status": "IN&OUT"
        },
        {
          "url": "https://www.legorafi.fr/2026/02/09/horoscope-du-9-fevrier-2026/",
          "first_position": "NA",
          "best_position": 39,
          "last_position": "NA",
          "status": "IN&OUT"
        }
      ]
    },
    {
      "first_position": 1,
      "last_position": 1,
      "best_position": 1,
      "traffic": 51,
      "page_count": 43,
      "keyword": "horoscope le gorafi",
      "status": "=",
      "allintitle"
```

#### curl

```bash
curl -X POST -d '{"date_from":"2026-01-20","date_to":"2026-02-20","tags":["horoscope"],"lineCount":2,"page":1}'\
  --url https://api.haloscan.com/api/projects/{project_id}/keywords \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/projects/{project_id}/keywords"

payload = {
    "date_from": "2026-01-20",
    "date_to": "2026-02-20",
    "tags": [
        "horoscope"
    ],
    "lineCount": 2,
    "page": 1
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/projects/{project_id}/keywords',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "date_from": "2026-01-20",
         "date_to": "2026-02-20",
         "tags": [
                  "horoscope"
         ],
         "lineCount": 2,
         "page": 1
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

### projects_tracking

- **Method:** POST
- **URL:** `https://api.haloscan.com/api/projects/{project_id}/tracking`
- **Description:** Returns rank tracking graph data for keywords defined in specified project (replace {project_id} by actual project id in url). In the response, results contains ranking evolution between date_from and date_to, and lost_new contains data for the new and lost keywords graph.
Crédit consommé
1 site credit per call

#### Parameters

| Name | Required | Type | Default | Possible Values | Description |
|------|----------|------|---------|-----------------|-------------|
| date_from | Non | String |  |  | Date in YYYY-MM-DD format, initial date to consider for stats |
| date_to | Non | String |  |  | Date in YYYY-MM-DD format, final date to consider for stats |
| tags | Non | String[] |  |  | Keep only keywords with specified tags. Tags must be defined within the project. |

#### Example Response

```json
{
  "response_time": "2.392 secs",
  "response_code": null,
  "failure_reason": null,
  "returned_result_count": 32,
  "results": [
    {
      "search_date": "2026-01-20",
      "unique_keywords": 2,
      "no_position": 0,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 1,
      "unknown": 1
    },
    {
      "search_date": "2026-01-21",
      "unique_keywords": 2,
      "no_position": 0,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 1,
      "unknown": 1
    },
    {
      "search_date": "2026-01-22",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-01-23",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-01-24",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-01-25",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-01-26",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-01-27",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-01-28",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-01-29",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-01-30",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-01-31",
      "unique_keywords": 1,
      "no_position": 1,
      "top_3_positions": 1,
      "top_10_positions": 0,
      "top_50_positions": 0,
      "top_100_positions": 0,
      "unknown": 1
    },
    {
      "search_date": "2026-02-01",
      "
```

#### curl

```bash
curl -X POST -d '{"date_from":"2026-01-20","date_to":"2026-02-20","tags":["horoscope"]}'\
  --url https://api.haloscan.com/api/projects/{project_id}/tracking \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -H 'haloscan-api-key: [your api key]'
```

#### Python

```python
import requests

url = "https://api.haloscan.com/api/projects/{project_id}/tracking"

payload = {
    "date_from": "2026-01-20",
    "date_to": "2026-02-20",
    "tags": [
        "horoscope"
    ]
}
headers = {
    "accept": "application/json",
    "content-type": "application/json",
    'haloscan-api-key': "[your api key]"
}

response = requests.post(url, json=payload, headers=headers)
```

#### Node.js

```javascript
const axios = require('axios');
  const options = {
    method: 'POST',
    url: 'https://api.haloscan.com/api/projects/{project_id}/tracking',
    headers: {
      accept: 'application/json', 'content-type': 'application/json',
      'haloscan-api-key': '[your api key]',
      data: {
         "date_from": "2026-01-20",
         "date_to": "2026-02-20",
         "tags": [
                  "horoscope"
         ]
       }
    }
  };
  axios.request(options)
    .then(function (response) {
      console.log(response.data);
    })
      .catch(function (error) {
      console.error(error);
    });
```

---

