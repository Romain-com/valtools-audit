# FLUX-AUDIT.md — Cheminement complet d'un audit

> Document de référence : décrit le parcours complet de l'utilisateur jusqu'aux résultats,
> bloc par bloc, sans code. Objectif : détecter les points de fragilité.

---

## Le parcours utilisateur — vue d'ensemble

```
0. La page /audit/nouveau charge le panneau health check (GET /api/health)
   → Services critiques vérifiés : microservice, Supabase, OpenAI, DataForSEO
   → Si un critique est ❌ → bouton "Lancer l'audit" désactivé
1. L'utilisateur saisit le nom de sa destination
2. L'app interroge le microservice local → propose une liste de communes avec SIREN
   ⚠️ Pas de fallback geo.api.gouv.fr — le microservice DOIT être démarré
3. L'utilisateur sélectionne la commune → code INSEE, SIREN (9 chiffres réel), département, population fixés
   ⚠️ Si SIREN absent ou invalide → bouton "Lancer l'audit" désactivé
4. Clic "Lancer l'audit" →
   a. /api/audits/lancer valide SIREN (/^\d{9}$/) — rejette HTTP 400 si invalide
   b. L'orchestrateur effectue un second health check des dépendances critiques
      avant de lancer le Segment A — si une dépendance est down, l'audit est bloqué
      avec un message explicite
   c. Segment A démarre
5. ⏸️  Bloc 4 Phase A terminée → l'utilisateur valide les keywords SEO
6. ⏸️  Bloc 7 Phase A terminée → l'utilisateur valide les concurrents
7. L'audit se termine → résultats affichés et stockés dans Supabase
```

**Durée typique** : 10-15 minutes pour les segments automatiques + temps de validation utilisateur.

---

## L'Orchestrateur — chef d'orchestre

### Ce qu'il reçoit en entrée
- `audit_id` (UUID Supabase de la ligne dans `audits`)
- `nom`, `siren`, `code_insee`, `code_departement`, `population`, `slug`

### Ce qu'il fait
L'orchestrateur divise l'audit en **3 segments** — tous en **séquencement strict** (jamais en parallèle entre blocs) :

| Segment | Blocs | Déclenchement |
|---------|-------|---------------|
| Segment A | 1 → 2 → 3 → 4A | Automatique au lancement |
| Segment B | 4B → 5 → 7A | Après validation keywords (Bloc 4A) |
| Segment C | 6 → 7B | Après validation concurrents (Bloc 7A) |

**Segment A** : Blocs 1, 2, 3, 4A exécutés **séquentiellement** (un à la fois). Après Bloc 3 : `lireDomaineOT()` + `logInfo('domaine_ot résolu après Bloc 3')` avant de lancer Bloc 4A.

**Segment B** : Se déclenche après validation des keywords par l'utilisateur.
- Bloc 4B → Bloc 5 → Bloc 7A (strictement séquentiel).
- Bloc 4A a besoin du `domaine_ot` détecté par le Bloc 3.
- Bloc 7A a besoin des résultats Blocs 1, 2, 3, 5 pour construire le contexte destination.
- ⚠️ Bloc 6 (Playwright) **n'est plus dans le Segment B** — déplacé en Segment C.

**Segment C** : Se déclenche après validation des concurrents par l'utilisateur.
- Bloc 6 (stock en ligne, Playwright) → Bloc 7B (séquentiellement).
- `maxDuration = 300` (Playwright peut prendre 3-4 min).
- Bloc 4B (Phase B) doit déjà être terminé depuis le Segment B.

### Gestion des statuts
Chaque bloc possède un statut enregistré dans Supabase :
`en_attente` → `en_cours` → `terminé` ou `erreur` ou `en_attente_validation`

Les statuts sont mis à jour en temps réel via Supabase Realtime (le front suit l'avancement).

### ⚠️ Points de fragilité orchestrateur
- Si le Bloc 3 échoue silencieusement (catch global) → `domaine_ot` = null → Bloc 4 Phase A tourne à vide. `lireDomaineOT()` logue explicitement ce cas.
- Si les variables Supabase sont manquantes (`NEXT_PUBLIC_SUPABASE_URL` vs `SUPABASE_URL`) → les coûts ne sont pas trackés mais l'audit continue
- Le Segment B nécessite une validation keywords — si l'utilisateur ne valide pas, Blocs 4B/5/7A ne tournent jamais
- Le Segment C nécessite une validation concurrents — si l'utilisateur ne valide pas, Blocs 6/7B ne tournent jamais
- ⚠️ Bloc 6 est maintenant en Segment C (après validation concurrents) — il s'exécute APRÈS Bloc 7A, pas avant

---

## BLOC 1 — Positionnement & Notoriété

### Objectif
Mesurer la présence sur Google Maps et Instagram. Comprendre comment la destination est perçue sur ces deux plateformes.

### Ce qu'il reçoit
- `nom` de la destination
- `code_insee`

### Étapes internes

**Étape 1 — Récupération des POI (microservice local)**
- Interroge le microservice local sur `http://localhost:3001/poi?code_insee=XXXXX`
- Retourne une liste de POI (lieux d'intérêt) liés à cette commune via DATA Tourisme
- ⚠️ Si le microservice n'est pas démarré → liste vide, l'étape suivante n'a pas de données

**Étape 2 — Sélection des POI pertinents (OpenAI)**
- Envoie la liste brute à GPT-5-mini
- GPT sélectionne les POI les plus pertinents à chercher sur Google Maps
- Retourne max 5 POI avec leur nom normalisé pour la recherche Google
- ⚠️ Si la liste POI est vide → GPT reçoit une liste vide → sélection vide → fiches Maps absentes

**Étape 3 — Données Google Maps (DataForSEO Maps) + Instagram en parallèle**
- **Google Maps** : 2 requêtes
  - Recherche du nom de la destination seule → fiche de la destination générale
  - Recherche "Office de tourisme [destination]" → fiche OT spécifique
  - Pour chaque POI sélectionné : 1 requête Maps supplémentaire
  - Retourne : note, nombre d'avis, catégorie, adresse, site web
  - ⚠️ Si fiche OT absente → flag `ot_fiche_manquante: true`, pas d'erreur
- **Instagram** : 2 requêtes Apify
  - `instagram-hashtag-stats` → `posts_count` pour `#[destination]`
  - `instagram-hashtag-scraper` → 10 posts récents avec likes, caption, username
  - Le hashtag est construit automatiquement : "megeve" (minuscules, sans accents, sans espaces)

**Étape 4 — Analyse OpenAI**
- Reçoit les notes Google + posts Instagram
- Produit : axe de positionnement perçu, mots-clés, forces/faiblesses, paragraphe prêt GDoc

### Ce qu'il produit
- Note OT Google Maps (ou absence)
- Notes des POI phares
- Score de synthèse Google /5
- Nombre de posts Instagram
- Ratio posts OT / UGC
- Analyse IA : axe principal, mots-clés, forces/faiblesses, paragraphe narratif

### ⚠️ Points de fragilité
- Microservice non démarré → étape 1 vide → Google Maps sans POI sélectionnés
- `gpt-5-mini` : timeout 3 min, reasoning tokens élevés → si `max_completion_tokens` trop bas → réponse vide → `parsing_failed`
- Instagram hashtag construit automatiquement → peut ne pas correspondre à l'usage réel (ex: `#chamonixt` vs `#chamonix`)
- DataForSEO Maps : **1 seule tâche par requête**, sinon erreur 40000

---

## BLOC 2 — Volume d'affaires (taxe de séjour)

### Objectif
Estimer le chiffre d'affaires généré par le tourisme via la taxe de séjour collectée.

### Ce qu'il reçoit
- `nom`, `siren` de la commune, `code_insee`, `code_departement`, `population`

### Étapes internes

**Étape 1 — Résolution de l'EPCI (microservice local)**
- Interroge `http://localhost:3001/epci?code_insee=XXXXX`
- Retourne : SIREN EPCI, nom, type (CC/CA/Métropole), population EPCI
- ⚠️ Si l'EPCI est inconnu → `siren_epci = null` → seule la commune est cherchée

**Étape 2 — Taxe de séjour commune + EPCI en parallèle**
- Interroge `data.economie.gouv.fr` (balances comptables 2024, puis 2023 si vide)
- Filtre les comptes `731721` (taxe séjour) et `731722` (taxe séjour forfait)
- Retourne montant annuel, année des données, libellé budget
- Fait la même recherche avec le SIREN EPCI si disponible
- ⚠️ Le SIREN doit être exact (format 9 chiffres, corresponde à la collectivité réelle)
- ⚠️ Certaines destinations collectent via budget annexe → pas dans ce dataset → montant = 0

**Étape 3 — Sélection du collecteur**
- Si la commune a un montant > 0 → collecteur = commune
- Sinon si l'EPCI a un montant > 0 → collecteur = EPCI
- Sinon → `taxe_non_instituee: true`, retour immédiat sans appel OpenAI

**Étape 4 — Analyse OpenAI**
- Reçoit les données du collecteur retenu
- Produit : synthèse narrative, indicateurs clés, estimation part commune si EPCI

**Étape 5 — Enrichissement Mélodi (INSEE)**
- Interroge `http://localhost:3001` pour les communes de l'EPCI
- Puis API INSEE (Mélodi) pour les données de logement par commune
- OpenAI calcule des coefficients de pondération
- Dispatch la taxe EPCI entre les communes selon leur capacité d'hébergement
- ⚠️ Si microservice non démarré → pas de communes → dispatch trivial sur la commune seule
- ⚠️ Gratuit (INSEE) mais OpenAI fait 2 appels si Mélodi OK

### Ce qu'il produit
- Montant taxe de séjour (commune ou EPCI)
- Type de collecteur (commune/EPCI)
- Nuitées estimées (montant ÷ 1,50€ taux moyen)
- Synthèse narrative OpenAI
- Dispatch de la taxe par commune (si EPCI)

### ⚠️ Points de fragilité
- **SIREN incorrect en base** → aucune donnée trouvée → `taxe_non_instituee` incorrecte
  - Mégève : SIREN stocké `217401730` ≠ SIREN réel `217401736`
- **Budget annexe** → taxe collectée hors balances comptables principales (cas Mégève)
- **EPCI non résolu** → si microservice arrêté, sirin_epci = null → peut manquer la vraie collectivité
- L'EPCI peut collecter pour toutes les communes → la commune seule semble sans taxe alors qu'elle en a via l'EPCI

---

## BLOC 3 — Schéma digital & Santé technique

### Objectif
Cartographier l'écosystème digital de la destination : qui se positionne sur Google, quelle est la santé technique des sites officiels.

### Ce qu'il reçoit
- `nom` de la destination

### Étapes internes

**Étape 1 — SERP Google (DataForSEO) : 5 requêtes en parallèle**
- 5 requêtes différentes sur des intentions de recherche variées :
  - Destination seule (notoriété)
  - "visiter [destination]" (informationnel)
  - "que faire [destination]" (activités)
  - "hôtel [destination]" (transactionnel)
  - "office de tourisme [destination]" (institutionnel)
- Retourne les 10 premiers résultats organiques pour chacune
- Fusionne et déduplique : résultat = liste unique de ~30-40 URLs classées

**Étape 2 — Classification OpenAI**
- Envoie toute la liste fusionnée à GPT-5-mini
- GPT catégorise chaque résultat :
  - `officiel_ot` : site de l'OT
  - `officiel_mairie` : site de la mairie
  - `officiel_autre` : autre site officiel
  - `ota` : Booking, Airbnb, TripAdvisor, etc.
  - `media` : presse, blogs
  - `autre`
- Identifie le `domaine_ot` (domaine du site de l'OT)
- Extrait les top 3 sites officiels
- ⚠️ **Donnée critique** : `domaine_ot` est utilisé par Blocs 4 et 7. Si null ou mal détecté → cascade d'erreurs

**Étape 3a — Haloscan (séquentiel sur les 3 top domaines)**
- Pour chaque des 3 sites officiels identifiés :
  - 1 appel Haloscan → keywords positionnés, trafic estimé, meilleures pages
  - Si Haloscan retourne `SITE_NOT_FOUND` → fallback DataForSEO domain analytics
- ⚠️ Consomme 1 crédit Haloscan par appel même en cas d'échec
- ⚠️ Petits OT souvent absents de l'index Haloscan

**Étape 3b — PageSpeed + Analyse OT en parallèle**
- **PageSpeed** : 2 appels par domaine (mobile + desktop) → score performance, accessibilité, SEO
- **Analyse OT** : si `domaine_ot` détecté → scrape des métadonnées (titre, meta-description) → OpenAI analyse la structure de la page

**Étape 4 — Synthèse OpenAI**
- Reçoit : top 3 officiels, données Haloscan, scores PageSpeed, nb sites OTA vs officiels
- Produit : synthèse schéma digital, indicateurs clés, points d'attention

### Ce qu'il produit
- Liste SERP fusionnée et classifiée
- `domaine_ot_detecte` (donnée critique transmise aux blocs suivants)
- Données SEO Haloscan pour les 3 sites officiels
- Scores PageSpeed mobile/desktop
- Analyse de la page OT
- Synthèse narrative

### ⚠️ Points de fragilité
- Si Classification OpenAI échoue → `domaine_ot` = null → Bloc 4 Phase A et Bloc 7 tournent sans domain OT
- Si `gpt-5-mini` timeout (3min) → catch → résultat vide retourné → le bloc "réussit" avec des données vides
- Haloscan : séquentiel (1 par 1) → si le premier site prend 5s → 15s juste pour Haloscan
- SERP 5 requêtes DataForSEO : ~50-60s en temps réel (normal)

---

## BLOC 4 — Visibilité SEO & Gap Transactionnel

### Objectif
Mesurer la performance SEO de l'OT sur son marché, identifier les opportunités manquées (gap transactionnel).

Ce bloc est en **2 phases** avec validation utilisateur entre les deux.

---

### BLOC 4 — Phase A (automatique)

### Ce qu'il reçoit
- `nom` de la destination
- `domaine_ot` (depuis Bloc 3) — **si null → erreur**

**Étape 1 — 3 sources en parallèle (avec filet de sécurité)**
Utilise `Promise.allSettled` : si une source échoue, les autres continuent.

- **Haloscan Market** (8 appels) : cherche les keywords de marché liés à 8 "seeds" (termes autour de la destination) → volumes de recherche, CPC, competition
- **DataForSEO Related** (4 appels) : keywords suggérés/associés pour 4 seeds → complète le corpus marché
- **DataForSEO Ranked** : keywords sur lesquels le domaine OT est actuellement positionné dans Google + trafic capté estimé
- ⚠️ `ranked` est **obligatoire** : si l'appel échoue → Phase A échoue complètement
- ⚠️ `haloscan_market` et `related` sont optionnels : si l'un échoue → corpus réduit mais Phase A continue

**Étape 2 — Fusion des corpus**
- Merge Haloscan + DataForSEO Related en dédupliquant
- Filtre pertinence : keywords contenant le nom de la destination OU ≥ 3 mots
- Trie par volume décroissant

**Étape 3 — Classification OpenAI**
- GPT-5-mini reçoit : keywords marché + keywords positionnés OT
- Classifie chaque keyword : informationnnel / transactionnel / gap / hors-sujet
- Marque les keywords où l'OT est absent mais le marché existe → **gap SEO**

**Résultat Phase A** : statut `en_attente_validation`
L'utilisateur voit les keywords classifiés et peut en décocher/valider avant Phase B.

---

### BLOC 4 — Phase B (après validation)

**Étape 1 — SERP live transactionnel**
- Pour chaque keyword transactionnel validé : 1 requête SERP DataForSEO
- Vérifie si l'OT apparaît dans le top 10
- Récupère qui se positionne à la place de l'OT

**Étape 2 — Synthèse OpenAI**
- Reçoit : résultats SERP, keywords classifiés, PAA détectés, volumes
- Calcule : taux de captation, score gap
- Produit : top 5 opportunités, PAA sans réponse, synthèse narrative

### Ce qu'il produit
- Corpus de keywords du marché (volume total)
- Keywords positionnés OT + trafic capté estimé
- Keywords classifiés avec gap identifié
- Score gap SEO
- Synthèse narrative prête GDoc

### ⚠️ Points de fragilité
- Phase B a besoin de `domaine_ot` — si null → `lancerPhaseB()` throw
- Phase A doit être validée manuellement → si l'utilisateur ne revient pas → Phase B jamais exécutée
- Phase A résultats lus depuis Supabase pour Phase B → si l'écriture Phase A a échoué → Phase B lit des données vides
- Haloscan Market : 8 appels × coût crédit → peut épuiser le quota rapidement

---

## BLOC 5 — Stocks physiques

### Objectif
Inventorier les hébergements et activités présents sur la destination (ce qui existe physiquement).

### Ce qu'il reçoit
- `code_insee`

### Étapes internes

**Étape 1 — DATA Tourisme (microservice local)**
- Interroge `http://localhost:3001/stocks?destination=XXX`
- Retourne les équipements touristiques enregistrés dans la base nationale DATA Tourisme
- Catégories : hôtels, campings, résidences tourisme, meublés, chambres d'hôtes, activités, restaurants, musées...

**Étape 2 — SIRENE (INSEE API)**
- Interroge l'API SIRENE pour les établissements actifs sur la commune
- Filtre par codes NAF touristiques (hôtellerie, restauration, activités loisirs...)
- Retourne : nombre d'établissements par catégorie

**Étape 3 — Fusion et déduplication**
- Merge DATA Tourisme + SIRENE en évitant les doublons
- Utilise similarité de nom + adresse (algorithme Levenshtein)
- Produit un stock consolidé par catégorie

**Étape 4 — Synthèse OpenAI**
- Reçoit le stock consolidé
- Produit : synthèse qualitative, indicateurs clés, points d'attention

### Ce qu'il produit
- Nombre d'hébergements par type (hôtels, campings, meublés, etc.)
- Nombre d'activités et d'équipements
- Sources des données (DT seul / SIRENE seul / fusionné)
- Synthèse narrative

### ⚠️ Points de fragilité
- Microservice non démarré → Étape 1 vide → stock très incomplet
- DATA Tourisme : données déclaratives → sous-représentation fréquente des petites structures
- SIRENE : établissements actifs mais pas toujours touristiques (faux positifs sur certains NAF)
- Déduplication par similarité : peut rater des doublons si noms très différents

---

## BLOC 6 — Stock commercialisé en ligne

### Objectif
Mesurer la présence en ligne des offres de la destination sur les grandes plateformes OTA.

### Ce qu'il reçoit
- `nom`, `domaine_ot`
- Stocks Bloc 5 (optionnels, pour calculer des taux)

### Étapes internes

**Extraction de la bounding box (microservice local)**
- `http://localhost:3001/bbox?destination=XXX`
- Retourne les coordonnées géographiques de la destination → utilisées pour les recherches Airbnb/Booking

**4 scrapers en parallèle (Playwright)**
- **Airbnb** : compte les annonces dans le bbox géographique
- **Booking** : compte les établissements listés pour la destination
- **Viator** : compte les activités/expériences disponibles à la vente
- **Site OT** : vérifie si le site OT a un module de réservation en ligne
- ⚠️ Playwright scrape de vraies pages web → fragile si les sites changent leur structure
- ⚠️ Peut être bloqué par les anti-bots (Cloudflare, etc.)

**Calcul des indicateurs croisés**
- Taux de dépendance OTA : part des hébergements sur Airbnb+Booking vs stock physique
- Taux de visibilité Viator : part des activités commercialisées en ligne
- Taux de réservation directe OT

**Synthèse OpenAI**
- Reçoit tous les indicateurs calculés
- Produit : diagnostic de la distribution en ligne, recommandations

### Ce qu'il produit
- Nombre d'annonces Airbnb / Booking / Viator
- Présence ou non d'un moteur de réservation OT
- Indicateurs de dépendance OTA
- Synthèse narrative

### ⚠️ Points de fragilité
- **Playwright le plus fragile de tous les blocs** — scraping réel susceptible de bloquer
- Microservice non démarré → bbox indisponible → scrapers sans périmètre géographique
- Résultats Airbnb/Booking varient selon les dates → snapshots non reproductibles
- Bloc 5 optionnel pour les indicateurs → si absent, taux non calculables

---

## BLOC 7 — Concurrents

### Objectif
Identifier les destinations concurrentes, mesurer leur performance digitale, calculer le gap.

Ce bloc est en **2 phases** avec validation utilisateur entre les deux.

---

### BLOC 7 — Phase A (automatique)

### Ce qu'il reçoit
Un **contexte enrichi** construit à partir des Blocs 1 à 6 :
- Position Google (note OT, avis)
- Chiffre d'affaires taxe de séjour
- Domaine OT + nombre de keywords positionnés
- Trafic OT estimé
- Score gap SEO
- Nombre d'hébergements / activités
- Taux de dépendance OTA
- `domaine_ot`

**Étape 1 — Identification des concurrents (OpenAI)**
- GPT-5-mini reçoit le contexte complet
- Identifie 5 destinations concurrentes pertinentes (taille comparable, même type)
- Retourne : nom, domaine probable, raison de la similarité

**Étape 2 — Enrichissement Haloscan (siteCompetitors)**
- Interroge l'endpoint Haloscan `siteCompetitors` pour le domaine OT
- Haloscan retourne directement les domaines concurrents dans son index
- Merge avec les 5 identifiés par OpenAI

**Étape 3 — Validation des domaines incertains (SERP)**
- Pour les domaines que Haloscan n'a pas confirmés → 1 requête SERP DataForSEO
- Vérifie que le domaine est bien un site OT de la destination identifiée

**Étape 4 — Métriques SEO des concurrents (Haloscan, séquentiel)**
- Pour chaque concurrent : 1 appel Haloscan → keywords positionnés, trafic, meilleures pages
- Séquentiel avec pause 500ms entre appels (rate limit Haloscan)

**Résultat Phase A** : statut `en_attente_validation`
L'utilisateur valide ou remplace les 5 concurrents identifiés.

---

### BLOC 7 — Phase B (après validation)

**Étape 1 — Construction du tableau comparatif**
- Compare la destination auditée vs chaque concurrent sur : trafic, keywords, gap, score

**Étape 2 — Insight Gap (Haloscan)**
- Si le concurrent principal a > 1000 keywords non captés par l'OT → appel Haloscan pour les voir
- Identifie les opportunités de mots-clés réelles

**Étape 3 — Synthèse OpenAI**
- Reçoit tableau comparatif + insight gap
- Produit : benchmark narrative, forces/faiblesses relatives, recommandations stratégiques

### Ce qu'il produit
- Liste des 5 concurrents validés avec leurs métriques
- Tableau comparatif destination vs concurrents
- Insight keywords manquants
- Synthèse narrative prête GDoc

### ⚠️ Points de fragilité
- **Dépend de tous les blocs précédents** pour construire le contexte
- Si `domaine_ot` = null → Haloscan siteCompetitors impossible → identification par OpenAI seul (moins précis)
- Phase B lit Phase A depuis Supabase → si écriture échouée → données vides
- Haloscan séquentiel × 5 concurrents = 5 appels × ~3s = 15s minimum + rate limit
- Validation utilisateur requise → si absent → Phase B jamais exécutée

---

## Schéma des dépendances entre blocs

```
Seg A (séquentiel strict) :
  Bloc 1 → [note_ot, posts_count, analyse_ia]
  Bloc 2 → [montant_taxe, type_collecteur]
  Bloc 3 → [domaine_ot ⭐, serp_fusionne, haloscan_ot]
           → lireDomaineOT() + logInfo AVANT Bloc 4A
  Bloc 4A ← domaine_ot (Bloc 3) ⭐
           → [keywords_marche, gap_seo] → ⏸️ VALIDATION keywords

Seg B (séquentiel strict, après validation keywords) :
  Bloc 4B ← Bloc 4A (Supabase) + domaine_ot ⭐
           → [score_gap, synthese_seo]
  Bloc 5  → [stocks_physiques]
  Bloc 7A ← Blocs 1+2+3+5 (contexte) + domaine_ot (Bloc 3) ⭐
           → [concurrents] → ⏸️ VALIDATION concurrents

Seg C (séquentiel strict, après validation concurrents) :
  Bloc 6  ← domaine_ot (Bloc 3)
           → [stocks_en_ligne]
  Bloc 7B ← Bloc 7A (Supabase)
           → [benchmark_concurrents]

⭐ = donnée critique — si manquante, cascade d'erreurs
```

**Changement clé vs ancienne architecture** : Bloc 6 est passé de Segment B → Segment C. Il s'exécute maintenant APRÈS la validation des concurrents (Bloc 7A), pas avant.

---

## Données stockées dans Supabase

### Table `audits`

Champ `resultats` (JSONB) — structure par bloc :
```
resultats.positionnement       → Bloc 1
resultats.volume_affaires      → Bloc 2
resultats.schema_digital       → Bloc 3
resultats.visibilite_seo       → Bloc 4 (phase_a + phase_b fusionnées)
resultats.stocks_physiques     → Bloc 5
resultats.stock_en_ligne       → Bloc 6
resultats.concurrents          → Bloc 7 (phase_a + phase_b fusionnées)
```

Champ `couts_api` (JSONB) — structure par service :
```
couts_api.positionnement.openai, .maps, .apify...
couts_api.schema_digital.dataforseo, .haloscan, .openai...
etc.
```

Champ `bloc_statuts` (JSONB) — statut de chaque bloc :
```
{ "bloc1": "terminé", "bloc2": "erreur", "bloc3": "en_cours", ... }
```

### Table `audit_logs`
Log structuré de chaque étape : niveau (info/warning/error), module, détails JSON.
Utilisé pour le diagnostic des bugs sans polluer les résultats.

---

## Récapitulatif des APIs par bloc

| Bloc | APIs appelées | Coût principal |
|------|--------------|----------------|
| 1 — Positionnement | Microservice local, DataForSEO Maps (×7), Apify Instagram (×2), OpenAI (×2) | DataForSEO Maps |
| 2 — Volume affaires | Microservice local, data.economie.gouv.fr (gratuit), INSEE Mélodi (gratuit), OpenAI (×1-2) | OpenAI |
| 3 — Schéma digital | DataForSEO SERP (×5), Haloscan (×3), DataForSEO Domain (×0-3 fallback), PageSpeed (×6), OpenAI (×2-3) | Haloscan |
| 4 — Visibilité SEO | Haloscan Keywords (×8), DataForSEO Related (×4), DataForSEO Ranked (×1), DataForSEO SERP Transac (×N), OpenAI (×2) | Haloscan Keywords |
| 5 — Stocks physiques | Microservice local, SIRENE INSEE (gratuit), OpenAI (×1) | OpenAI |
| 6 — Stock en ligne | Microservice local, Playwright ×4 (gratuit) | Infrastructure |
| 7 — Concurrents | Haloscan siteCompetitors + ×5 métriques, DataForSEO SERP validation, OpenAI (×2) | Haloscan |

---

## Les 5 bugs les plus probables à surveiller

1. **`domaine_ot` = null** après Bloc 3 → cascade Blocs 4 et 7 en erreur silencieuse
2. **SIREN incorrect** en base Supabase → Bloc 2 retourne `taxe_non_instituee` à tort
3. **Microservice local non démarré** → Blocs 1 (POI), 2 (EPCI/communes), 5 (stocks), 6 (bbox) incomplets
4. **GPT-5-mini** : `max_completion_tokens` trop bas → réponse vide → `parsing_failed` → données absentes
5. **Phase A non validée** par l'utilisateur → Blocs 4B, 6, 7B jamais exécutés → audit incomplet

---

*Dernière mise à jour : 2026-02-26 — Fix 3-en-1 : SIREN + Health check + Séquencement*
