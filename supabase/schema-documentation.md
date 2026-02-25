# Documentation du schéma JSONB — `audits.resultats`

> Générée à partir des types TypeScript (`types/`) et des résultats de tests documentés dans CONTEXT.md
> Destination de référence : **Annecy** (INSEE 74010)
> Mise à jour : 2026-02-25

---

## Structure globale

```json
{
  "positionnement":  { … ResultatBlocPositionnement },
  "volume_affaires": { … ResultatVolumeAffaires },
  "schema_digital":  { … ResultatSchemaDigital },
  "visibilite_seo":  { … ResultatVisibiliteSEO },
  "stocks_physiques":{ … ResultatBloc5 },
  "stock_en_ligne":  { … ResultatBloc6 },
  "concurrents":     { … ResultatBlocConcurrents }
}
```

Chaque clé de premier niveau est nullable : un bloc absent (non encore calculé) est simplement manquant de l'objet.

---

## `couts_api` — structure globale

```jsonc
{
  "bloc1": {
    "dataforseo": { "nb_appels": 4, "cout_unitaire": 0.006, "cout_total": 0.024 },
    "apify":      { "nb_appels": 2, "cout_unitaire": 0.05,  "cout_total": 0.10  },
    "openai":     { "nb_appels": 2, "cout_unitaire": 0.003, "cout_total": 0.006 },
    "total": 0.130
  },
  "bloc2": {
    "openai": { "nb_appels": 1, "cout_unitaire": 0.003, "cout_total": 0.003 },
    "total": 0.003
  },
  "bloc3": {
    "dataforseo_serp":   { "nb_appels": 5, "cout_unitaire": 0.006, "cout_total": 0.030 },
    "haloscan":          { "nb_appels": 2, "cout_unitaire": 0.010, "cout_total": 0.020 },
    "dataforseo_domain": { "nb_appels": 1, "cout_unitaire": 0.006, "cout_total": 0.006 },
    "openai":            { "nb_appels": 3, "cout_unitaire": 0.003, "cout_total": 0.009 },
    "total": 0.065
  },
  "bloc4": {
    "haloscan_keywords":     { "nb_appels": 8, "cout": 0.080 },
    "dataforseo_related":    { "nb_appels": 4, "cout": 0.024 },
    "dataforseo_ranked":     { "nb_appels": 1, "cout": 0.006 },
    "dataforseo_serp_transac":{ "nb_appels": 8, "cout": 0.048 },
    "openai":                { "nb_appels": 7, "cout": 0.007 },
    "total": 0.165
  },
  "bloc5": {
    "openai": { "nb_appels": 1, "cout_unitaire": 0.003, "cout_total": 0.003 },
    "total": 0.003
  },
  "bloc6": {
    "openai":   { "cout": 0.003 },
    "scraping": { "cout": 0.000 },
    "total": 0.003
  },
  "bloc7": {
    "openai_identification":       0.001,
    "haloscan":                    0.060,
    "haloscan_positions":          0.010,
    "haloscan_competitors":        0.010,
    "dataforseo_ranked":           0.030,
    "dataforseo_maps":             0.030,
    "dataforseo_serp_validation":  0.005,
    "openai_synthese":             0.001,
    "total_bloc": 0.147
  },
  "total_audit": 0.519
}
```

---

## Bloc 1 — `positionnement` (`ResultatBlocPositionnement`)

### `positionnement.google` (`ResultatMaps`)

| Champ | Type | Source API | Exemple Annecy |
|---|---|---|---|
| `google.ot` | `FicheGoogle \| FicheGoogleAbsente` | DataForSEO Maps | `{ nom, note, avis, adresse }` |
| `google.ot.nom` | `string` | DataForSEO Maps — `item.title` | `"Office de Tourisme du Lac d'Annecy"` |
| `google.ot.note` | `number` | DataForSEO Maps — `item.rating.value` | `4.2` |
| `google.ot.avis` | `number` | DataForSEO Maps — `item.rating.votes_count` | `340` |
| `google.ot.adresse` | `string` | DataForSEO Maps — `item.address` | `"1 Rue Jean Jaurès, 74000 Annecy"` |
| `google.poi` | `FicheGooglePOI[]` | DataForSEO Maps (3 appels) | `[ { nom, note, avis, adresse }, … ]` |
| `google.score_synthese` | `number` | Calculé — `avg_POI × 0.7 + note_OT × 0.3` | `4.45` |
| `google.cout.dataforseo.nb_appels` | `number` | — | `4` |
| `google.cout.dataforseo.cout_unitaire` | `number` | — | `0.006` |
| `google.cout.dataforseo.cout_total` | `number` | — | `0.024` |

> ⚠️ Si l'OT est absent : `google.ot = { absent: true }` et `score_synthese = avg_POI`

### `positionnement.instagram` (`ResultatInstagram`)

| Champ | Type | Source API | Exemple Annecy (estimé) |
|---|---|---|---|
| `instagram.hashtag` | `string` | — (dérivé du nom commune) | `"annecy"` |
| `instagram.posts_count` | `number \| null` | Apify `instagram-hashtag-stats` — `postsCount` | `8500000` |
| `instagram.posts_recents` | `PostInstagram[]` | Apify `instagram-hashtag-scraper` — 10 posts | `[ { likes, username, timestamp, caption }, … ]` |
| `instagram.posts_recents[].likes` | `number` | Apify | `1240` |
| `instagram.posts_recents[].username` | `string` | Apify | `"travel_photography"` |
| `instagram.posts_recents[].timestamp` | `string` | Apify — ISO 8601 | `"2026-02-20T14:23:00Z"` |
| `instagram.posts_recents[].caption` | `string` | Apify | `"Le lac d'Annecy #annecy"` |
| `instagram.ratio_ot_ugc` | `string` | Calculé — posts OT / posts UGC | `"1/2000"` |
| `instagram.cout.nb_appels` | `number` | — | `2` |
| `instagram.cout.cout_unitaire` | `number` | — | `0.05` |
| `instagram.cout.cout_total` | `number` | — | `0.10` |
| `instagram.erreur` | `boolean?` | — | absent si succès |

> ⚠️ Test validé pour Trévoux : `posts_count = 1 585 000` (#trevoux). Annecy : valeur estimée.

### `positionnement.positionnement` (`AnalysePositionnement`)

| Champ | Type | Source API | Exemple Annecy |
|---|---|---|---|
| `positionnement.axe_principal` | `string` | OpenAI gpt-5-mini | `"Destination lacustre de montagne premium"` |
| `positionnement.mots_cles` | `string[]` | OpenAI gpt-5-mini | `["lac", "montagne", "vieille ville", "randonnée"]` |
| `positionnement.forces_faiblesses.forces` | `string[]` | OpenAI gpt-5-mini | `["Notoriété nationale exceptionnelle", …]` |
| `positionnement.forces_faiblesses.faiblesses` | `string[]` | OpenAI gpt-5-mini | `["Saisonnalité estivale marquée", …]` |
| `positionnement.paragraphe_gdoc` | `string` | OpenAI gpt-5-mini — 80-100 mots | Paragraphe prêt à copier |
| `positionnement.cout.nb_appels` | `number` | — | `2` |

> En cas d'erreur : `{ erreur: "parsing_failed", raw: "…", cout: { … } }`

### `positionnement.couts_bloc` (`CoutsBloc`)

| Champ | Type | Exemple Annecy |
|---|---|---|
| `couts_bloc.dataforseo` | `{ nb_appels, cout_unitaire, cout_total }` | `{ 4, 0.006, 0.024 }` |
| `couts_bloc.apify` | `{ nb_appels, cout_unitaire, cout_total }` | `{ 2, 0.05, 0.100 }` |
| `couts_bloc.openai` | `{ nb_appels, cout_unitaire, cout_total }` | `{ 2, 0.003, 0.006 }` |
| `couts_bloc.total_bloc` | `number` | `0.130` |

---

## Bloc 2 — `volume_affaires` (`ResultatVolumeAffaires`)

### `volume_affaires.collecteur` (`DonneesCollecteur`)

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `collecteur.siren` | `string` | Microservice CSV | `"200066793"` (CA Grand Annecy) |
| `collecteur.nom` | `string` | data.economie.gouv.fr | `"CA Grand Annecy"` |
| `collecteur.type_collecteur` | `"commune" \| "epci"` | Logique orchestrateur | `"epci"` |
| `collecteur.type_epci` | `string?` | Microservice CSV | `"CA"` |
| `collecteur.population_epci` | `number?` | Microservice CSV | `210000` |
| `collecteur.annee_donnees` | `number` | data.economie.gouv.fr | `2024` |
| `collecteur.montant_taxe_euros` | `number` | data.economie.gouv.fr — comptes 731721+731722 | `3440837` |
| `collecteur.nuitees_estimees` | `number` | Calculé — `round(montant / 1.50)` | `2293891` |

### `volume_affaires.part_commune_estimee`

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `part_commune_estimee.pourcentage` | `number` | Calculé via dispatch Mélodi | `93.1` |
| `part_commune_estimee.montant_euros` | `number` | Calculé | `3203019` |
| `part_commune_estimee.raisonnement` | `string` | OpenAI gpt-5-mini | `"Annecy représente 93% des hébergements…"` |

> Présent uniquement si `type_collecteur === "epci"`

### `volume_affaires.dispatch_ts` (`ResultatDispatchTS`)

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `dispatch_ts.mode` | `"dispatch_epci" \| "reconstitution_totale"` | Logique | `"dispatch_epci"` |
| `dispatch_ts.montant_ts_source` | `number` | data.economie.gouv.fr | `3440837` |
| `dispatch_ts.communes` | `DispatchTS[]` | Mélodi INSEE — 34 communes | 34 entrées |
| `dispatch_ts.commune_cible.code_insee` | `string` | — | `"74010"` |
| `dispatch_ts.commune_cible.part_pct` | `number` | Calculé | `93.1` |
| `dispatch_ts.commune_cible.ts_estimee` | `number` | Calculé | `3203030` |
| `dispatch_ts.commune_cible.nuitees_estimees` | `number` | Calculé | `2135353` |
| `dispatch_ts.commune_cible.detail.residences_secondaires` | `number` | Mélodi RP 2022 | `5344` |
| `dispatch_ts.commune_cible.detail.hotels` | `number` | Mélodi BPE D701 | `12` |
| `dispatch_ts.commune_cible.detail.residences_tourisme` | `number` | Mélodi BPE D703 | `4` |
| `dispatch_ts.commune_cible.detail.campings` | `number` | Mélodi BPE D702 | `7` |
| `dispatch_ts.commune_cible.detail.villages_vacances` | `number` | Mélodi BPE D705 | `2` |
| `dispatch_ts.commune_cible.detail.meubles_classes` | `number` | Mélodi BPE D710 | `25` |
| `dispatch_ts.commune_cible.detail.chambres_hotes` | `number` | Mélodi BPE D711 | `2` |
| `dispatch_ts.coefficients_utilises.profil_destination` | `string` | OpenAI gpt-5-mini | `"bord_lac"` |
| `dispatch_ts.coefficients_utilises.hotel_etablissement` | `number` | OpenAI ajusté | `2500` (vs fixe 2000) |
| `dispatch_ts.coefficients_utilises.source` | `"fixes" \| "openai_ajuste"` | — | `"openai_ajuste"` |

### `volume_affaires.openai`

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `openai.synthese_volume` | `string` | OpenAI gpt-5-mini — 80-100 mots | `"La CA Grand Annecy génère 3,44 M€…"` |
| `openai.indicateurs_cles` | `string[]` | OpenAI gpt-5-mini — 3 chiffres | `["3 440 837 € de taxe…", …]` |

### `volume_affaires.meta`

| Champ | Type | Exemple Annecy |
|---|---|---|
| `meta.annee_donnees` | `number` | `2024` |
| `meta.taux_moyen_utilise` | `number` | `1.50` (toujours) |
| `meta.dataset_source` | `string` | `"balances-comptables-des-groupements…"` |
| `meta.cout_total_euros` | `number` | `0.003` |

---

## Bloc 3 — `schema_digital` (`ResultatSchemaDigital`)

### Champs principaux

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `serp_fusionne` | `ResultatSERP[]` | DataForSEO SERP — 5 requêtes fusionnées | ~30-50 entrées dédupliquées |
| `serp_fusionne[].position` | `number` | DataForSEO | `1` |
| `serp_fusionne[].url` | `string` | DataForSEO | `"https://www.lac-annecy.com/"` |
| `serp_fusionne[].domaine` | `string` | DataForSEO | `"lac-annecy.com"` |
| `serp_fusionne[].titre` | `string` | DataForSEO | `"Office de Tourisme du Lac d'Annecy"` |
| `serp_fusionne[].meta_description` | `string` | DataForSEO | `"Découvrez Annecy et le lac…"` |
| `serp_fusionne[].categorie` | `CategorieResultatSERP` | OpenAI gpt-5-mini | `"officiel_ot"` |
| `serp_fusionne[].requete_source` | `string` | — | `"tourisme"` |
| `top3_officiels` | `SiteOfficiel[]` | OpenAI gpt-5-mini | `[ { domaine: "lac-annecy.com", position_serp: 2, … }, … ]` |
| `domaine_ot_detecte` | `string \| null` | OpenAI gpt-5-mini | `"lac-annecy.com"` |

### `schema_digital.haloscan` (`ResultatHaloscan[]`) — max 3 entrées

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `haloscan[0].domaine` | `string` | — | `"lac-annecy.com"` |
| `haloscan[0].total_keywords` | `number` | Haloscan `metrics.stats.total_keyword_count` | `53842` |
| `haloscan[0].total_traffic` | `number` | Haloscan `metrics.stats.total_traffic` | `161645` |
| `haloscan[0].top_3_positions` | `number` | Haloscan `metrics.stats.top_3_positions` | `4821` |
| `haloscan[0].top_10_positions` | `number` | Haloscan `metrics.stats.top_10_positions` | `12340` |
| `haloscan[0].visibility_index` | `number` | Haloscan `metrics.stats.visibility_index` | `0.42` |
| `haloscan[0].traffic_value` | `number` | Haloscan `metrics.stats.traffic_value` (normalisé 0 si "NA") | `18500` |
| `haloscan[0].site_non_indexe` | `boolean` | Logique fallback | `false` |
| `haloscan[0].source` | `"haloscan" \| "dataforseo" \| "inconnu"` | — | `"haloscan"` |

> ⚠️ Source réelle Annecy : `"haloscan"` (trouvé sur `www.lac-annecy.com` après retry). DataForSEO domain_rank_overview a été appelé en fallback mais Haloscan a retourné les données.

### `schema_digital.pagespeed` (`ResultatPageSpeed[]`) — max 3 entrées

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `pagespeed[0].domaine` | `string` | — | `"lac-annecy.com"` |
| `pagespeed[0].mobile.score` | `number` | Google PageSpeed | `51` |
| `pagespeed[0].mobile.lcp` | `number` | Google PageSpeed — secondes | `4.2` |
| `pagespeed[0].mobile.cls` | `number` | Google PageSpeed | `0.08` |
| `pagespeed[0].mobile.inp` | `number` | Google PageSpeed — ms | `220` |
| `pagespeed[0].desktop.score` | `number` | Google PageSpeed | `74` |
| `pagespeed[0].erreur` | `string?` | — | absent si succès |

### `schema_digital.analyse_site_ot` (`AnalyseSiteOT`)

| Champ | Type | Source API | Exemple Annecy (estimé) |
|---|---|---|---|
| `analyse_site_ot.fonctionnalites_detectees.moteur_reservation` | `boolean \| "incertain"` | OpenAI gpt-5-mini | `true` |
| `analyse_site_ot.fonctionnalites_detectees.blog_actualites` | `boolean \| "incertain"` | OpenAI gpt-5-mini | `true` |
| `analyse_site_ot.fonctionnalites_detectees.newsletter` | `boolean \| "incertain"` | OpenAI gpt-5-mini | `true` |
| `analyse_site_ot.fonctionnalites_detectees.agenda_evenements` | `boolean \| "incertain"` | OpenAI gpt-5-mini | `true` |
| `analyse_site_ot.fonctionnalites_detectees.carte_interactive` | `boolean \| "incertain"` | OpenAI gpt-5-mini | `"incertain"` |
| `analyse_site_ot.fonctionnalites_detectees.application_mobile` | `boolean \| "incertain"` | OpenAI gpt-5-mini | `false` |
| `analyse_site_ot.niveau_maturite_digital` | `"faible" \| "moyen" \| "avance"` | OpenAI gpt-5-mini | `"avance"` |
| `analyse_site_ot.commentaire` | `string` | OpenAI gpt-5-mini | `"Site bien structuré avec moteur de réservation…"` |

### `schema_digital.visibilite_ot_par_intention`

| Clé | Type | Exemple Annecy ✅ |
|---|---|---|
| `destination` | `{ position: number \| null, categorie_pos1: string }` | `{ position: null, categorie_pos1: "ota" }` |
| `tourisme` | idem | `{ position: 2, categorie_pos1: "officiel_ot" }` |
| `hebergement` | idem | `{ position: null, categorie_pos1: "ota" }` |
| `que_faire` | idem | `{ position: null, categorie_pos1: "media" }` |
| `restaurant` | idem | `{ position: null, categorie_pos1: "ota" }` |

### `schema_digital.openai` et `meta`

| Champ | Type | Exemple Annecy |
|---|---|---|
| `openai.synthese_schema` | `string` | Paragraphe 80-100 mots |
| `openai.indicateurs_cles` | `string[]` | 3 constats clés |
| `openai.points_attention` | `string[]` | 2-3 points d'amélioration |
| `meta.score_visibilite_ot` | `number` | `1` (Annecy : 1/5 — seulement "tourisme") |
| `meta.nb_sites_officiels_top10` | `number` | `4` |
| `meta.nb_ota_top10` | `number` | `8` |
| `meta.domaine_ot_source` | `"auto" \| "manuel"` | `"auto"` |
| `meta.cout_total_euros` | `number` | `0.065` |

> ⚠️ `score_visibilite_ot` est stocké à la fois dans `schema_digital.score_visibilite_ot` (racine du bloc) et dans `schema_digital.meta`. C'est une duplication volontaire héritée des types TypeScript.

---

## Bloc 4 — `visibilite_seo` (`ResultatVisibiliteSEO`)

### `visibilite_seo.phase_a` (`ResultatPhaseA`)

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `phase_a.keywords_marche` | `KeywordMarche[]` | Haloscan keywords + DataForSEO related — fusionnés | 223 keywords uniques |
| `phase_a.keywords_marche[].keyword` | `string` | Haloscan / DataForSEO | `"annecy lac"` |
| `phase_a.keywords_marche[].volume` | `number` | Haloscan / DataForSEO | `49500` |
| `phase_a.keywords_marche[].source` | `"keyword_match" \| "similar_highlight" \| "related_question" \| "dataforseo_related"` | — | `"keyword_match"` |
| `phase_a.keywords_marche[].seed` | `string` | — | `"annecy"` |
| `phase_a.keywords_marche[].cpc` | `number?` | Haloscan | `0.45` |
| `phase_a.keywords_positionnes_ot` | `KeywordPositionneOT[]` | DataForSEO ranked_keywords | Keywords où lac-annecy.com apparaît |
| `phase_a.keywords_classes` | `KeywordClassifie[]` | OpenAI gpt-5-mini — 160 classifiés | 160 keywords avec catégorie + gap |
| `phase_a.paa_detectes` | `KeywordMarche[]` | Haloscan keywords — `related_question` | `21` PAA |
| `phase_a.volume_marche_seeds` | `number` | Somme Haloscan 8 seeds | `640650` |
| `phase_a.volume_positionne_ot` | `number` | Somme DataForSEO ranked | `512484` |
| `phase_a.volume_transactionnel_gap` | `number` | Somme keywords gap + transac | Calculé |
| `phase_a.note_volumes` | `string` | — | Texte explicatif affiché dans l'UI |
| `phase_a.trafic_capte_ot_estime` | `number` | CTR par position depuis ranked | `512484` |
| `phase_a.statut` | `"en_attente_validation"` | — | `"en_attente_validation"` |

### `visibilite_seo.phase_b` (`ResultatPhaseB`)

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `phase_b.serp_results` | `ResultatSERPTransac[]` | DataForSEO SERP live — 8 requêtes | 8 entrées |
| `phase_b.serp_results[].keyword` | `string` | — | `"évènement annecy"` |
| `phase_b.serp_results[].position_ot` | `number \| null` | DataForSEO | `null` (absent) |
| `phase_b.serp_results[].url_ot` | `string \| null` | DataForSEO | `null` |
| `phase_b.serp_results[].concurrent_pos1` | `string \| null` | DataForSEO | `"agenda.annecy.fr"` |
| `phase_b.volume_marche_transactionnel` | `number` | Somme volumes gaps transac | Calculé |
| `phase_b.trafic_estime_capte` | `number` | CTR × volume (depuis ranked) | `512484` |
| `phase_b.taux_captation` | `number` | `trafic / volume_marche_seeds × 100`, max 100 | `80` |
| `phase_b.top_5_opportunites` | `Opportunite[]` | Calculé — vrais gaps Phase A ↔ SERP live | 5 entrées |
| `phase_b.top_5_opportunites[0].keyword` | `string` | — | `"évènement annecy"` |
| `phase_b.top_5_opportunites[0].volume` | `number` | — | `49500` |
| `phase_b.top_5_opportunites[0].categorie` | `CategorieKeyword` | OpenAI | `"activités"` |
| `phase_b.top_5_opportunites[0].position_ot` | `number \| null` | — | `null` |
| `phase_b.paa_sans_reponse` | `string[]` | Croisement PAA ↔ SERP live | `["que faire à annecy", "que faire ce week-end", …]` (5) |
| `phase_b.score_gap` | `number` | Calculé — 0-10 | `8` |
| `phase_b.synthese_narrative` | `string` | OpenAI gpt-5-mini | Paragraphe narratif |
| `phase_b.statut` | `"terminé"` | — | `"terminé"` |

### `visibilite_seo.couts` (`CoutsBloc4`)

| Champ | Type | Exemple Annecy ✅ |
|---|---|---|
| `couts.haloscan_market` | `{ nb_appels: 8, cout: 0.080 }` | — |
| `couts.dataforseo_related` | `{ nb_appels: 4, cout: 0.024 }` | — |
| `couts.dataforseo_ranked` | `{ nb_appels: 1, cout: 0.006 }` | — |
| `couts.dataforseo_serp_transac` | `{ nb_appels: 8, cout: 0.048 }` | — |
| `couts.openai` | `{ nb_appels: 7, cout: 0.007 }` | — |
| `couts.total` | `number` | `0.165` |

---

## Bloc 5 — `stocks_physiques` (`ResultatBloc5`)

### `stocks_physiques.stocks` (`StocksPhysiquesFinaux`)

#### Hébergements

| Champ | Type | Source API | Exemple Annecy ✅ |
|---|---|---|---|
| `stocks.hebergements.total_unique` | `number` | DT + SIRENE dédupliqués | `461` |
| `stocks.hebergements.dont_data_tourisme` | `number` | Microservice DT | `23` |
| `stocks.hebergements.dont_sirene` | `number` | Recherche Entreprises | `419` |
| `stocks.hebergements.dont_deux_sources` | `number` | Déduplication Levenshtein | `19` |
| `stocks.hebergements.detail.hotels.volume` | `number` | DT (Hotel) + SIRENE (55.10Z) | `137` |
| `stocks.hebergements.detail.hotels.pct` | `number` | % sur total hébergements | `29.7` |
| `stocks.hebergements.detail.campings.volume` | `number` | SIRENE (55.30Z) | `1` |
| `stocks.hebergements.detail.meubles_locations.volume` | `number` | DT (RentalAccommodation) + SIRENE (55.20Z) | `246` |
| `stocks.hebergements.detail.collectifs.volume` | `number` | DT (CollectiveAccommodation) | `8` |
| `stocks.hebergements.detail.autres.volume` | `number` | DT + SIRENE (55.90Z) | `69` |

#### Activités

| Champ | Exemple Annecy ✅ |
|---|---|
| `stocks.activites.total_unique` | `927` |
| `stocks.activites.dont_data_tourisme` | `116` |
| `stocks.activites.dont_sirene` | `774` |
| `stocks.activites.dont_deux_sources` | `37` |
| `stocks.activites.detail.sports_loisirs.volume` | `380` |
| `stocks.activites.detail.experiences.volume` | `340` |
| `stocks.activites.detail.visites_tours.volume` | `125` |
| `stocks.activites.detail.agences_activites.volume` | `82` |

#### Culture

| Champ | Exemple Annecy ✅ |
|---|---|
| `stocks.culture.total_unique` | `745` |
| `stocks.culture.detail.spectacle_vivant.volume` | `660` (NAF 90.01Z = artistes/auto-entrepreneurs) |
| `stocks.culture.detail.patrimoine.volume` | `46` |
| `stocks.culture.detail.religieux.volume` | `15` |
| `stocks.culture.detail.musees_galeries.volume` | `15` |
| `stocks.culture.detail.nature.volume` | `9` |

#### Services

| Champ | Exemple Annecy ✅ |
|---|---|
| `stocks.services.total_unique` | `80` |
| `stocks.services.detail.agences_voyage.volume` | `58` |
| `stocks.services.detail.offices_tourisme.volume` | `14` |

#### Totaux et couverture

| Champ | Type | Exemple Annecy ✅ |
|---|---|---|
| `stocks.total_stock_physique` | `number` | `2213` |
| `stocks.couverture.global` | `number` | `3.0` (% DT / total, DT sous-représente SIRENE) |
| `stocks.couverture.hebergements` | `number` | `9.6` |
| `stocks.ratio_particuliers_hebergement` | `number` | `56.2` (% NAF 55.20Z / total SIRENE héb.) |
| `stocks.sources_disponibles.data_tourisme` | `boolean` | `true` |
| `stocks.sources_disponibles.sirene` | `boolean` | `true` |

### `stocks_physiques.synthese` (`SyntheseStocksPhysiques`)

| Champ | Type | Exemple Annecy |
|---|---|---|
| `synthese.points_forts` | `string[]` | `["Stock hébergements diversifié…"]` |
| `synthese.points_attention` | `string[]` | `["Forte dépendance meublés particuliers (56%)…"]` |
| `synthese.indicateurs_cles` | `{ label, valeur, interpretation }[]` | 3 indicateurs |
| `synthese.synthese_narrative` | `string` | Paragraphe OpenAI |

---

## Bloc 6 — `stock_en_ligne` (`ResultatBloc6`)

### Sources scrapées

| Champ | Type | Source | Exemple Annecy ✅ |
|---|---|---|---|
| `airbnb.total_annonces` | `number` | Playwright Airbnb — découpage quadrant | `4246` |
| `airbnb.nb_requetes` | `number` | — | `21` |
| `airbnb.nb_zones` | `number` | — | `21` |
| `airbnb.bbox_utilisee` | `BoundingBox` | geo.api.gouv.fr contour | `{ ne_lat, ne_lng, sw_lat, sw_lng }` |
| `airbnb.duree_ms` | `number` | — | `95000` |
| `booking.total_proprietes` | `number` | Playwright Booking — `h1` | `277` |
| `booking.detail.hotels` | `number` | Non extractible — toujours 0 | `0` |
| `booking.duree_ms` | `number` | — | `12000` |
| `viator.total_activites` | `number` | Playwright Viator — bloqué Cloudflare | `0` |
| `viator.url_utilisee` | `string` | — | `"https://www.viator.com/fr-FR/Annecy/"` |

### Site OT

| Champ | Type | Source | Exemple Annecy ✅ |
|---|---|---|---|
| `site_ot.domaine` | `string` | — | `"lac-annecy.com"` |
| `site_ot.hebergements.nb_fiches` | `number` | Playwright | `34` |
| `site_ot.hebergements.est_reservable_direct` | `boolean` | Playwright | `false` |
| `site_ot.hebergements.type` | `TypeSection` | Logique | `"listing_seul"` |
| `site_ot.activites.nb_fiches` | `number` | Playwright | `64` |
| `site_ot.activites.type` | `TypeSection` | Logique | `"listing_seul"` |
| `site_ot.moteur_resa_detecte` | `string \| null` | Playwright | `null` |

### Indicateurs croisés

| Champ | Type | Exemple Annecy ✅ |
|---|---|---|
| `indicateurs.taux_dependance_ota` | `number \| null` | `9.8` (ratio brut, **pas %** — (4246+277)/461) |
| `indicateurs.taux_reservable_direct` | `number \| null` | `0.008` (34 / (4246+277)) |
| `indicateurs.taux_visibilite_activites` | `number \| null` | `0.0` (Viator bloqué) |
| `indicateurs.total_ota_hebergements` | `number` | `4523` (4246+277) |
| `indicateurs.site_ot_type_hebergements` | `TypeSection` | `"listing_seul"` |
| `indicateurs.moteur_resa_detecte` | `string \| null` | `null` |

> ⚠️ `taux_dependance_ota` est un **ratio** (ex: 9.8x), pas un pourcentage. Ne pas multiplier par 100.

### Synthèse et meta

| Champ | Type | Exemple Annecy |
|---|---|---|
| `synthese.diagnostic` | `string` | OpenAI — constat principal |
| `synthese.points_cles` | `PointCle[]` | 3 points `{ label, valeur, niveau }` |
| `synthese.message_ot` | `string` | Message percutant |
| `synthese.recommandations` | `string[]` | 3 recommandations |
| `couts.openai` | `number` | `0.003` |
| `couts.scraping` | `number` | `0.000` |
| `meta.duree_totale_ms` | `number` | `143000` |
| `meta.erreurs_partielles` | `string[]` | `["viator: Cloudflare block"]` |

---

## Bloc 7 — `concurrents` (`ResultatBlocConcurrents`)

### `concurrents.phase_a.concurrents` — 5 entrées

| Champ | Type | Source | Exemple (Chamonix) ✅ |
|---|---|---|---|
| `nom` | `string` | OpenAI gpt-5-mini | `"Chamonix-Mont-Blanc"` |
| `code_insee` | `string` | OpenAI gpt-5-mini | `"74056"` |
| `departement` | `string` | OpenAI | `"74"` |
| `type_destination` | `string` | OpenAI | `"station montagne internationale"` |
| `raison_selection` | `string` | OpenAI | `"Destination alpine premium, profil touristique similaire"` |
| `domaine_ot` | `string` | OpenAI | `"chamonix.com"` |
| `confiance_domaine` | `"certain" \| "incertain"` | OpenAI | `"certain"` |
| `domaine_valide` | `string` | SERP DataForSEO si incertain | `"chamonix.com"` |
| `metriques.total_keywords` | `number` | Séquence SEO 5 étapes | `70755` |
| `metriques.total_traffic` | `number` | Haloscan | `176206` |
| `metriques.source_seo` | `SourceSEO` | — | `"haloscan"` |
| `metriques.site_non_indexe` | `boolean` | — | `false` |
| `metriques.note_google` | `number \| null` | DataForSEO Maps | `4.4` |
| `metriques.nb_avis_google` | `number \| null` | DataForSEO Maps | `1866` |
| `metriques.position_serp_requete_principale` | `number \| null` | Cache SERP Bloc 3 | `null` |

**Les 5 concurrents Annecy ✅** :
| Concurrent | Keywords | Trafic | Note Google | Indexé |
|---|---|---|---|---|
| Chamonix-Mont-Blanc | 70 755 | 176 206 | 4.4/5 (1866 avis) | ✅ haloscan |
| Évian-les-Bains | 36 | 4 | 4.3/5 (749 avis) | ✅ haloscan |
| Aix-les-Bains | 0 | 0 | 4.3/5 (553 avis) | ❌ inconnu |
| Saint-Gervais-les-Bains | 27 788 | 40 577 | 4.3/5 (361 avis) | ✅ haloscan |
| La Clusaz | 24 322 | 1 016 314 | 4.1/5 (154 avis) | ✅ haloscan |

### `concurrents.tableau_comparatif` (`TableauComparatif`)

| Champ | Type | Exemple Annecy ✅ |
|---|---|---|
| `tableau_comparatif.destination_cible.nom` | `string` | `"Annecy"` |
| `tableau_comparatif.destination_cible.total_keywords` | `number` | `53842` |
| `tableau_comparatif.destination_cible.total_traffic` | `number` | `161645` |
| `tableau_comparatif.destination_cible.note_google` | `number` | `4.5` |
| `tableau_comparatif.destination_cible.score_visibilite_ot` | `number` | `1` |
| `tableau_comparatif.destination_cible.taux_dependance_ota` | `number` | `9.8` |
| `tableau_comparatif.destination_cible.nuitees_estimees` | `number` | `2293891` |

### `concurrents.synthese` (`SyntheseConcurrents`)

| Champ | Type | Exemple Annecy ✅ |
|---|---|---|
| `synthese.position_globale` | `"leader" \| "dans_la_moyenne" \| "en_retard"` | `"leader"` |
| `synthese.resume` | `string` | OpenAI — résumé positionnel |
| `synthese.points_forts` | `{ critere, valeur, benchmark }[]` | Comparatif vs concurrents |
| `synthese.points_faibles` | `{ critere, valeur, benchmark }[]` | Comparatif vs concurrents |
| `synthese.opportunite_cle` | `string` | OpenAI | `"35 gaps transactionnels identifiés…"` |
| `synthese.message_ot` | `string` | OpenAI | Message percutant |

### `concurrents.couts` (`CoutsBlocConcurrents`)

| Champ | Exemple Annecy ✅ |
|---|---|
| `openai_identification` | `0.001` |
| `haloscan` (étapes 1-2) | `0.060` |
| `haloscan_positions` (étape 3) | `0.010` |
| `haloscan_competitors` | `0.010` |
| `dataforseo_ranked` (étapes 4-5) | `0.030` |
| `dataforseo_maps` | `0.030` |
| `dataforseo_serp_validation` | `0.005` |
| `openai_synthese` | `0.001` |
| `total_bloc` | `0.147` |

---

## Champs ambigus ou interprétés

| Champ | Ambiguïté | Interprétation retenue |
|---|---|---|
| `competitors.type` (table SQL) | Non présent dans les types TypeScript — spécifié dans CONTEXT.md schéma | `ENUM('direct', 'indirect')` comme indiqué dans CONTEXT.md |
| `schema_digital.score_visibilite_ot` | Présent à la fois à la racine du bloc et dans `schema_digital.meta` | Duplication héritée des types — les deux champs sont renseignés |
| `instagram.posts_count` Annecy | Aucun test Annecy documenté (testé sur Trévoux : 1 585 000) | Estimé à 8 500 000 dans le seed — à remplacer lors d'un vrai audit |
| `pagespeed[].mobile.lcp`, `.cls`, `.inp` Annecy | Seul le score (51) est documenté pour Annecy | Valeurs LCP/CLS/INP estimées dans le seed sur base de benchmarks PageSpeed |
| `analyse_site_ot` Annecy | Non documenté explicitement dans les tests | Inféré depuis les infos site lac-annecy.com dans CONTEXT.md |
| `booking.detail` | Documenté comme non extractible via h1 | Toujours `{ hotels:0, apparts:0, campings:0, bb:0, villas:0 }` dans le seed |
