-- ============================================================
-- Seed — Données de test Annecy
-- Destination de référence : Annecy (INSEE 74010, SIREN 200063402)
-- Basé sur les résultats réels documentés dans CONTEXT.md
-- Valeurs marquées (estimé) = non testées directement sur Annecy
-- ============================================================
--
-- ⚠️ PRÉREQUIS : créer manuellement un utilisateur admin dans Supabase Auth
--   (Dashboard → Authentication → Users → Add user)
--   puis remplacer le UUID ci-dessous par celui de l'utilisateur créé.
--   En attendant, created_by = NULL (autorisé : FK nullable).
--
-- Ordre d'exécution : migrations 001 → 002 → 003 → ce fichier
-- ============================================================

-- UUIDs fixes pour cohérence des foreign keys dans les tests
-- (pas d'insertion dans auth.users — géré par Supabase Auth)

DO $$
DECLARE
  v_destination_id UUID := '10000000-0000-0000-0000-000000000001';
  v_audit_id       UUID := '20000000-0000-0000-0000-000000000001';
BEGIN

-- ─── Destination : Annecy ─────────────────────────────────────────────────────

INSERT INTO public.destinations (
  id, nom, siren, code_insee, code_postal,
  code_departement, code_region, epci, population, slug,
  created_by
) VALUES (
  v_destination_id,
  'Annecy',
  '200063402',
  '74010',
  '74000',
  '74',
  '84',
  '200066793',   -- SIREN CA Grand Annecy (collecteur taxe de séjour)
  132000,
  'annecy',
  NULL           -- remplacer par UUID utilisateur Auth après setup
)
ON CONFLICT (siren) DO UPDATE SET
  nom              = EXCLUDED.nom,
  code_insee       = EXCLUDED.code_insee,
  population       = EXCLUDED.population,
  updated_at       = NOW();

-- ─── Audit : Annecy — tous les blocs terminés ─────────────────────────────────

INSERT INTO public.audits (id, destination_id, statut, resultats, couts_api)
VALUES (
  v_audit_id,
  v_destination_id,
  'termine',

-- ══════════════════════════════════════════════════════════════
-- JSONB resultats — structure complète 7 blocs
-- ══════════════════════════════════════════════════════════════
  $resultats$
{
  "positionnement": {
    "google": {
      "ot": {
        "nom": "Office de Tourisme du Lac d'Annecy",
        "note": 4.2,
        "avis": 340,
        "adresse": "1 Rue Jean Jaurès, 74000 Annecy"
      },
      "poi": [
        {
          "nom": "Palais de l'Île",
          "note": 4.6,
          "avis": 8934,
          "adresse": "3 Passage de l'Île, 74000 Annecy"
        },
        {
          "nom": "Jardins de l'Europe",
          "note": 4.7,
          "avis": 2140,
          "adresse": "Quai des Vieilles Prisons, 74000 Annecy"
        },
        {
          "nom": "Château d'Annecy",
          "note": 4.5,
          "avis": 3210,
          "adresse": "Place du Château, 74000 Annecy"
        }
      ],
      "score_synthese": 4.45,
      "cout": {
        "dataforseo": { "nb_appels": 4, "cout_unitaire": 0.006, "cout_total": 0.024 }
      }
    },
    "instagram": {
      "hashtag": "annecy",
      "posts_count": 8500000,
      "posts_recents": [
        {
          "likes": 1240,
          "username": "travel_photography_fr",
          "timestamp": "2026-02-20T14:23:00Z",
          "caption": "Le lac d'Annecy sous le soleil hivernal 🏔️ #annecy #lacalpin #hautesavoie"
        },
        {
          "likes": 890,
          "username": "alpes_discovery",
          "timestamp": "2026-02-19T10:15:00Z",
          "caption": "Balade en vieille ville ce matin #annecy #vieilleville #france"
        },
        {
          "likes": 2100,
          "username": "lac_annecy_official",
          "timestamp": "2026-02-18T08:45:00Z",
          "caption": "Vue panoramique depuis le Semnoz ❄️ #annecy #montagne #alpes"
        }
      ],
      "ratio_ot_ugc": "1/2000",
      "cout": { "nb_appels": 2, "cout_unitaire": 0.05, "cout_total": 0.10 }
    },
    "positionnement": {
      "axe_principal": "Destination lacustre de montagne premium — ville d'eau entre Alpes et Préalpes",
      "mots_cles": ["lac", "montagne", "vieille ville", "randonnée", "cyclisme", "ski", "thermalisme"],
      "forces_faiblesses": {
        "forces": [
          "Notoriété nationale exceptionnelle (8,5M posts Instagram)",
          "Cadre naturel premium lac + montagne",
          "Accessibilité TGV Paris–Annecy 3h30",
          "Patrimoine médiéval remarquable (Palais de l'Île)"
        ],
        "faiblesses": [
          "Saisonnalité estivale marquée",
          "Fréquentation saturée en haute saison (tension logement)",
          "Prix hébergements élevés vs concurrents alpins"
        ]
      },
      "paragraphe_gdoc": "Annecy s'impose comme l'une des destinations lacustres alpines les plus reconnues de France, combinant un patrimoine médiéval exceptionnel avec un environnement naturel de premier plan. Sa notoriété digitale — plus de 8,5 millions de publications Instagram — témoigne d'une attractivité organique rare, portée principalement par le contenu utilisateur (UGC). Le défi principal réside dans la monétisation de cette visibilité au profit des prestataires locaux, notamment via des outils de réservation directe encore insuffisamment développés sur le site OT.",
      "cout": { "nb_appels": 2, "cout_unitaire": 0.003, "cout_total": 0.006 }
    },
    "couts_bloc": {
      "dataforseo": { "nb_appels": 4, "cout_unitaire": 0.006, "cout_total": 0.024 },
      "apify": { "nb_appels": 2, "cout_unitaire": 0.05, "cout_total": 0.100 },
      "openai": { "nb_appels": 2, "cout_unitaire": 0.003, "cout_total": 0.006 },
      "total_bloc": 0.130
    }
  },

  "volume_affaires": {
    "collecteur": {
      "siren": "200066793",
      "nom": "CA Grand Annecy",
      "type_collecteur": "epci",
      "type_epci": "CA",
      "population_epci": 210000,
      "annee_donnees": 2024,
      "montant_taxe_euros": 3440837,
      "nuitees_estimees": 2293891
    },
    "part_commune_estimee": {
      "pourcentage": 93.1,
      "montant_euros": 3203019,
      "raisonnement": "Annecy représente 93,1% du poids d'hébergement de la CA Grand Annecy selon le dispatch Mélodi (5 344 résidences secondaires + 12 hôtels + 7 campings sur 34 communes)."
    },
    "taxe_non_instituee": false,
    "dispatch_ts": {
      "mode": "dispatch_epci",
      "montant_ts_source": 3440837,
      "communes": [
        {
          "code_insee": "74010",
          "nom": "Annecy",
          "poids_brut": 12547000,
          "part_pct": 93.1,
          "ts_estimee": 3203030,
          "nuitees_estimees": 2135353,
          "detail": {
            "residences_secondaires": 5344,
            "hotels": 12,
            "residences_tourisme": 4,
            "campings": 7,
            "villages_vacances": 2,
            "meubles_classes": 25,
            "chambres_hotes": 2,
            "autres_hebergements": 0
          }
        },
        {
          "code_insee": "74037",
          "nom": "Cran-Gevrier",
          "poids_brut": 210000,
          "part_pct": 1.6,
          "ts_estimee": 55053,
          "nuitees_estimees": 36702,
          "detail": {
            "residences_secondaires": 580,
            "hotels": 2,
            "residences_tourisme": 0,
            "campings": 0,
            "villages_vacances": 0,
            "meubles_classes": 3,
            "chambres_hotes": 0,
            "autres_hebergements": 0
          }
        },
        {
          "code_insee": "74089",
          "nom": "Épagny-Metz-Tessy",
          "poids_brut": 125000,
          "part_pct": 0.9,
          "ts_estimee": 30967,
          "nuitees_estimees": 20645,
          "detail": {
            "residences_secondaires": 310,
            "hotels": 1,
            "residences_tourisme": 0,
            "campings": 0,
            "villages_vacances": 0,
            "meubles_classes": 2,
            "chambres_hotes": 0,
            "autres_hebergements": 0
          }
        }
      ],
      "commune_cible": {
        "code_insee": "74010",
        "nom": "Annecy",
        "poids_brut": 12547000,
        "part_pct": 93.1,
        "ts_estimee": 3203030,
        "nuitees_estimees": 2135353,
        "detail": {
          "residences_secondaires": 5344,
          "hotels": 12,
          "residences_tourisme": 4,
          "campings": 7,
          "villages_vacances": 2,
          "meubles_classes": 25,
          "chambres_hotes": 2,
          "autres_hebergements": 0
        }
      },
      "coefficients_utilises": {
        "residence_secondaire": 30,
        "hotel_etablissement": 2500,
        "tourisme_etablissement": 1800,
        "camping_etablissement": 600,
        "autres_etablissement": 800,
        "source": "openai_ajuste",
        "profil_destination": "bord_lac",
        "justification": "Annecy, destination lacustre premium, présente une forte densité de nuitées estivales justifiant des coefficients hôteliers et touristiques supérieurs aux valeurs fixes nationales."
      }
    },
    "openai": {
      "synthese_volume": "La CA Grand Annecy génère 3,44 M€ de taxe de séjour annuelle (2024), soit environ 2,29 millions de nuitées touristiques. Annecy concentre 93% de ce volume, confirmant son rôle de locomotive touristique de l'EPCI. Ce flux de nuitées positionne la destination parmi les 20 premières villes touristiques françaises hors Paris et témoigne d'une économie touristique robuste et structurée.",
      "indicateurs_cles": [
        "3 440 837 € de taxe de séjour (CA Grand Annecy 2024)",
        "~2,29 M de nuitées estimées",
        "93,1 % de l'EPCI concentré sur Annecy"
      ]
    },
    "meta": {
      "annee_donnees": 2024,
      "taux_moyen_utilise": 1.50,
      "dataset_source": "balances-comptables-des-groupements-a-fiscalite-propre-depuis-2010",
      "cout_total_euros": 0.003
    }
  },

  "schema_digital": {
    "serp_fusionne": [
      {
        "position": 1,
        "url": "https://www.booking.com/city/fr/annecy.fr.html",
        "domaine": "booking.com",
        "titre": "Annecy : les meilleurs hébergements",
        "meta_description": "Trouvez et réservez votre hébergement à Annecy sur Booking.com",
        "categorie": "ota",
        "requete_source": "hebergement"
      },
      {
        "position": 2,
        "url": "https://www.lac-annecy.com/",
        "domaine": "lac-annecy.com",
        "titre": "Office de Tourisme du Lac d'Annecy - Tourisme Annecy",
        "meta_description": "Découvrez Annecy et le lac d'Annecy : hébergements, activités, agenda et informations pratiques.",
        "categorie": "officiel_ot",
        "requete_source": "tourisme"
      },
      {
        "position": 3,
        "url": "https://www.tripadvisor.fr/Tourism-g187234-Annecy",
        "domaine": "tripadvisor.fr",
        "titre": "Annecy Tourisme — TripAdvisor",
        "meta_description": "Annecy Tourisme : trouvez les avis de voyageurs sur Annecy",
        "categorie": "ota",
        "requete_source": "destination"
      },
      {
        "position": 4,
        "url": "https://www.annecy.fr/",
        "domaine": "annecy.fr",
        "titre": "Ville d'Annecy — Site officiel",
        "meta_description": "Site officiel de la ville d'Annecy, capitale de la Haute-Savoie",
        "categorie": "officiel_mairie",
        "requete_source": "destination"
      },
      {
        "position": 5,
        "url": "https://www.airbnb.fr/annecy-france/stays",
        "domaine": "airbnb.fr",
        "titre": "Locations de vacances à Annecy — Airbnb",
        "meta_description": "Trouvez des hébergements uniques à Annecy sur Airbnb",
        "categorie": "ota",
        "requete_source": "hebergement"
      }
    ],
    "top3_officiels": [
      {
        "domaine": "lac-annecy.com",
        "categorie": "officiel_ot",
        "titre": "Office de Tourisme du Lac d'Annecy",
        "meta_description": "Découvrez Annecy et le lac d'Annecy",
        "position_serp": 2
      },
      {
        "domaine": "annecy.fr",
        "categorie": "officiel_mairie",
        "titre": "Ville d'Annecy — Site officiel",
        "meta_description": "Site officiel de la ville d'Annecy",
        "position_serp": 4
      },
      {
        "domaine": "hautesavoie.fr",
        "categorie": "officiel_autre",
        "titre": "Tourisme Haute-Savoie Mont-Blanc",
        "meta_description": "Découvrez la Haute-Savoie",
        "position_serp": 7
      }
    ],
    "domaine_ot_detecte": "lac-annecy.com",
    "haloscan": [
      {
        "domaine": "lac-annecy.com",
        "total_keywords": 53842,
        "total_traffic": 161645,
        "top_3_positions": 4821,
        "top_10_positions": 12340,
        "visibility_index": 0.42,
        "traffic_value": 18500,
        "site_non_indexe": false,
        "source": "haloscan"
      },
      {
        "domaine": "annecy.fr",
        "total_keywords": 12500,
        "total_traffic": 38000,
        "top_3_positions": 980,
        "top_10_positions": 3200,
        "visibility_index": 0.18,
        "traffic_value": 4200,
        "site_non_indexe": false,
        "source": "haloscan"
      },
      {
        "domaine": "hautesavoie.fr",
        "total_keywords": 8700,
        "total_traffic": 22000,
        "top_3_positions": 620,
        "top_10_positions": 2100,
        "visibility_index": 0.12,
        "traffic_value": 2800,
        "site_non_indexe": false,
        "source": "haloscan"
      }
    ],
    "pagespeed": [
      {
        "domaine": "lac-annecy.com",
        "mobile": {
          "score": 51,
          "lcp": 4.2,
          "cls": 0.08,
          "inp": 220
        },
        "desktop": {
          "score": 74,
          "lcp": 2.1,
          "cls": 0.05,
          "inp": 95
        }
      },
      {
        "domaine": "annecy.fr",
        "mobile": {
          "score": 63,
          "lcp": 3.5,
          "cls": 0.12,
          "inp": 180
        },
        "desktop": {
          "score": 82,
          "lcp": 1.8,
          "cls": 0.04,
          "inp": 78
        }
      }
    ],
    "analyse_site_ot": {
      "fonctionnalites_detectees": {
        "moteur_reservation": true,
        "blog_actualites": true,
        "newsletter": true,
        "agenda_evenements": true,
        "carte_interactive": "incertain",
        "application_mobile": false
      },
      "niveau_maturite_digital": "avance",
      "commentaire": "Le site lac-annecy.com présente un niveau de maturité digitale élevé avec moteur de réservation, blog, newsletter et agenda. L'absence d'application mobile et l'incertitude sur la carte interactive constituent les principaux axes d'amélioration."
    },
    "visibilite_ot_par_intention": {
      "destination": { "position": null, "categorie_pos1": "ota" },
      "tourisme": { "position": 2, "categorie_pos1": "officiel_ot" },
      "hebergement": { "position": null, "categorie_pos1": "ota" },
      "que_faire": { "position": null, "categorie_pos1": "media" },
      "restaurant": { "position": null, "categorie_pos1": "ota" }
    },
    "score_visibilite_ot": 1,
    "openai": {
      "synthese_schema": "Le schéma digital d'Annecy révèle une hégémonie des OTA (Booking, TripAdvisor, Airbnb) sur 4 des 5 intentions de recherche principales. Le site officiel lac-annecy.com n'apparaît en première position officielle que sur 'tourisme annecy'. Avec 53 842 mots-clés indexés et 161 645 visites mensuelles, le site OT dispose d'une base SEO solide mais perd la bataille des intentions transactionnelles face aux plateformes.",
      "indicateurs_cles": [
        "1/5 intentions avec OT en position officielle n°1",
        "53 842 mots-clés indexés (lac-annecy.com)",
        "Score PageSpeed mobile : 51/100 — à améliorer"
      ],
      "points_attention": [
        "Intentions 'hébergement' et 'destination' dominées par les OTA — risque de désintermédiation",
        "Score PageSpeed mobile de 51 impacte le référencement mobile",
        "Application mobile absente — manque dans l'offre de services numériques"
      ]
    },
    "meta": {
      "nb_sites_officiels_top10": 4,
      "nb_ota_top10": 8,
      "domaine_ot_source": "auto",
      "cout_total_euros": 0.065
    }
  },

  "visibilite_seo": {
    "phase_a": {
      "keywords_marche": [
        { "keyword": "annecy lac", "volume": 49500, "source": "keyword_match", "seed": "annecy", "cpc": 0.45 },
        { "keyword": "que faire à annecy", "volume": 40500, "source": "keyword_match", "seed": "que faire annecy", "cpc": 0.30 },
        { "keyword": "évènement annecy", "volume": 49500, "source": "keyword_match", "seed": "tourisme annecy", "cpc": 0.22 },
        { "keyword": "plage de annecy", "volume": 27100, "source": "keyword_match", "seed": "annecy", "cpc": 0.18 },
        { "keyword": "randonnée autour de moi annecy", "volume": 27100, "source": "related_question", "seed": "activités annecy", "cpc": null },
        { "keyword": "fromagerie autour de moi annecy", "volume": 22200, "source": "related_question", "seed": "annecy", "cpc": null },
        { "keyword": "hôtel annecy spa", "volume": 9900, "source": "keyword_match", "seed": "hébergement annecy", "cpc": 1.20 },
        { "keyword": "week end annecy", "volume": 8100, "source": "keyword_match", "seed": "week-end annecy", "cpc": 0.85 },
        { "keyword": "visiter annecy", "volume": 6600, "source": "keyword_match", "seed": "visiter annecy", "cpc": 0.12 },
        { "keyword": "tourisme annecy", "volume": 5400, "source": "keyword_match", "seed": "tourisme annecy", "cpc": 0.20 }
      ],
      "keywords_positionnes_ot": [
        { "keyword": "office de tourisme annecy", "volume": 2400, "position": 1, "url_positionnee": "https://www.lac-annecy.com/", "cpc": 0.25 },
        { "keyword": "que faire à annecy", "volume": 40500, "position": 1, "url_positionnee": "https://www.lac-annecy.com/que-faire/", "cpc": 0.30 },
        { "keyword": "visiter annecy", "volume": 6600, "position": 1, "url_positionnee": "https://www.lac-annecy.com/decouvrir/", "cpc": 0.12 },
        { "keyword": "tourisme à annecy", "volume": 3600, "position": 1, "url_positionnee": "https://www.lac-annecy.com/", "cpc": 0.20 },
        { "keyword": "week end a annecy", "volume": 8100, "position": 4, "url_positionnee": "https://www.lac-annecy.com/week-end/", "cpc": 0.85 }
      ],
      "keywords_classes": [
        { "keyword": "évènement annecy", "volume": 49500, "categorie": "activités", "intent_transactionnel": false, "position_ot": null, "gap": true },
        { "keyword": "plage de annecy", "volume": 27100, "categorie": "activités", "intent_transactionnel": false, "position_ot": null, "gap": true },
        { "keyword": "randonnée autour de moi annecy", "volume": 27100, "categorie": "activités", "intent_transactionnel": false, "position_ot": null, "gap": true },
        { "keyword": "fromagerie autour de moi annecy", "volume": 22200, "categorie": "restauration", "intent_transactionnel": true, "position_ot": null, "gap": true },
        { "keyword": "hôtel annecy spa", "volume": 9900, "categorie": "hébergements", "intent_transactionnel": true, "position_ot": null, "gap": true },
        { "keyword": "que faire à annecy", "volume": 40500, "categorie": "activités", "intent_transactionnel": false, "position_ot": 1, "gap": false },
        { "keyword": "week end annecy", "volume": 8100, "categorie": "hébergements", "intent_transactionnel": true, "position_ot": 4, "gap": false },
        { "keyword": "visiter annecy", "volume": 6600, "categorie": "culture", "intent_transactionnel": false, "position_ot": 1, "gap": false }
      ],
      "paa_detectes": [
        { "keyword": "que faire à annecy ce week-end", "volume": 5400, "source": "related_question", "seed": "que faire annecy", "cpc": null },
        { "keyword": "que faire à annecy quand il pleut", "volume": 3600, "source": "related_question", "seed": "que faire annecy", "cpc": null },
        { "keyword": "le lac d'annecy est-il artificiel", "volume": 2900, "source": "related_question", "seed": "annecy", "cpc": null },
        { "keyword": "où dormir à annecy pas cher", "volume": 2400, "source": "related_question", "seed": "hébergement annecy", "cpc": null },
        { "keyword": "annecy vaut-il le détour", "volume": 1900, "source": "related_question", "seed": "tourisme annecy", "cpc": null }
      ],
      "volume_marche_seeds": 640650,
      "volume_positionne_ot": 512484,
      "volume_transactionnel_gap": 187400,
      "note_volumes": "Ces 3 volumes ont des périmètres différents : volume_marche_seeds = demande totale autour de la destination (Haloscan 8 seeds) ; volume_positionne_ot = keywords où lac-annecy.com apparaît dans Google (DataForSEO ranked) ; volume_transactionnel_gap = potentiel commercial non capté (gap + intent transactionnel uniquement). Ne pas les additionner.",
      "trafic_capte_ot_estime": 512484,
      "statut": "en_attente_validation"
    },
    "phase_b": {
      "serp_results": [
        { "keyword": "évènement annecy", "position_ot": null, "url_ot": null, "concurrent_pos1": "agenda.annecy.fr", "concurrent_pos1_url": "https://agenda.annecy.fr/" },
        { "keyword": "plage de annecy", "position_ot": null, "url_ot": null, "concurrent_pos1": "annecy.fr", "concurrent_pos1_url": "https://www.annecy.fr/plages" },
        { "keyword": "randonnée autour de moi annecy", "position_ot": null, "url_ot": null, "concurrent_pos1": "visorando.com", "concurrent_pos1_url": "https://www.visorando.com/randonnee-annecy/" },
        { "keyword": "fromagerie autour de moi annecy", "position_ot": null, "url_ot": null, "concurrent_pos1": "google.maps", "concurrent_pos1_url": null },
        { "keyword": "hôtel annecy spa", "position_ot": null, "url_ot": null, "concurrent_pos1": "booking.com", "concurrent_pos1_url": "https://www.booking.com/annecy-spa" },
        { "keyword": "que faire à annecy", "position_ot": 1, "url_ot": "https://www.lac-annecy.com/que-faire/", "concurrent_pos1": "lac-annecy.com", "concurrent_pos1_url": "https://www.lac-annecy.com/que-faire/" },
        { "keyword": "visiter annecy", "position_ot": 1, "url_ot": "https://www.lac-annecy.com/decouvrir/", "concurrent_pos1": "lac-annecy.com", "concurrent_pos1_url": "https://www.lac-annecy.com/decouvrir/" },
        { "keyword": "week end a annecy", "position_ot": 4, "url_ot": "https://www.lac-annecy.com/week-end/", "concurrent_pos1": "tripadvisor.fr", "concurrent_pos1_url": "https://www.tripadvisor.fr/annecy-weekend" }
      ],
      "volume_marche_transactionnel": 187400,
      "trafic_estime_capte": 512484,
      "taux_captation": 80,
      "top_5_opportunites": [
        { "keyword": "évènement annecy", "volume": 49500, "categorie": "activités", "position_ot": null, "concurrent_pos1": "agenda.annecy.fr", "gain_potentiel_trafic": 13860 },
        { "keyword": "plage de annecy", "volume": 27100, "categorie": "activités", "position_ot": null, "concurrent_pos1": "annecy.fr", "gain_potentiel_trafic": 7588 },
        { "keyword": "randonnée autour de moi annecy", "volume": 27100, "categorie": "activités", "position_ot": null, "concurrent_pos1": "visorando.com", "gain_potentiel_trafic": 7588 },
        { "keyword": "fromagerie autour de moi annecy", "volume": 22200, "categorie": "restauration", "position_ot": null, "concurrent_pos1": null, "gain_potentiel_trafic": 6216 },
        { "keyword": "hôtel annecy spa", "volume": 9900, "categorie": "hébergements", "position_ot": null, "concurrent_pos1": "booking.com", "gain_potentiel_trafic": 2772 }
      ],
      "paa_sans_reponse": [
        "que faire à annecy ce week-end",
        "que faire à annecy quand il pleut",
        "le lac d'annecy est-il artificiel",
        "où dormir à annecy pas cher",
        "annecy vaut-il le détour"
      ],
      "score_gap": 8,
      "synthese_narrative": "Annecy présente un score de gap SEO de 8/10, révélant un potentiel de captation de trafic significatif non exploité. Les 35 gaps transactionnels confirmés représentent un volume mensuel estimé à 187 400 recherches sans positionnement OT. Les opportunités prioritaires se concentrent sur l'agenda événementiel (49 500 req/mois) et les activités de plein air, deux univers où le site lac-annecy.com est absent alors que la demande est forte. La mise en place de pages dédiées aux événements et aux plages/randonnées générerait un gain estimé à +38 000 visites/mois.",
      "statut": "terminé"
    },
    "couts": {
      "haloscan_market": { "nb_appels": 8, "cout": 0.080 },
      "dataforseo_related": { "nb_appels": 4, "cout": 0.024 },
      "dataforseo_ranked": { "nb_appels": 1, "cout": 0.006 },
      "dataforseo_serp_transac": { "nb_appels": 8, "cout": 0.048 },
      "openai": { "nb_appels": 7, "cout": 0.007 },
      "total": 0.165
    }
  },

  "stocks_physiques": {
    "stocks": {
      "hebergements": {
        "total_unique": 461,
        "dont_data_tourisme": 23,
        "dont_sirene": 419,
        "dont_deux_sources": 19,
        "detail": {
          "hotels":           { "volume": 137, "pct": 29.7 },
          "campings":         { "volume": 1,   "pct": 0.2  },
          "meubles_locations":{ "volume": 246, "pct": 53.4 },
          "collectifs":       { "volume": 8,   "pct": 1.7  },
          "autres":           { "volume": 69,  "pct": 15.0 }
        }
      },
      "activites": {
        "total_unique": 927,
        "dont_data_tourisme": 116,
        "dont_sirene": 774,
        "dont_deux_sources": 37,
        "detail": {
          "sports_loisirs":   { "volume": 380, "pct": 41.0 },
          "visites_tours":    { "volume": 125, "pct": 13.5 },
          "experiences":      { "volume": 340, "pct": 36.7 },
          "agences_activites":{ "volume": 82,  "pct": 8.8  }
        }
      },
      "culture": {
        "total_unique": 745,
        "dont_data_tourisme": 46,
        "dont_sirene": 690,
        "dont_deux_sources": 9,
        "detail": {
          "patrimoine":        { "volume": 46,  "pct": 6.2  },
          "religieux":         { "volume": 15,  "pct": 2.0  },
          "musees_galeries":   { "volume": 15,  "pct": 2.0  },
          "spectacle_vivant":  { "volume": 660, "pct": 88.6 },
          "nature":            { "volume": 9,   "pct": 1.2  }
        }
      },
      "services": {
        "total_unique": 80,
        "dont_data_tourisme": 14,
        "dont_sirene": 63,
        "dont_deux_sources": 3,
        "detail": {
          "offices_tourisme": { "volume": 14, "pct": 17.5 },
          "agences_voyage":   { "volume": 58, "pct": 72.5 },
          "location_materiel":{ "volume": 5,  "pct": 6.3  },
          "transport":        { "volume": 3,  "pct": 3.7  }
        }
      },
      "total_stock_physique": 2213,
      "couverture": {
        "hebergements": 9.6,
        "activites": 14.2,
        "culture": 6.6,
        "services": 22.2,
        "global": 3.0
      },
      "ratio_particuliers_hebergement": 56.2,
      "sources_disponibles": {
        "data_tourisme": true,
        "sirene": true
      }
    },
    "synthese": {
      "points_forts": [
        "Stock total de 2 213 établissements touristiques — destination à forte densité",
        "927 activités référencées — offre de loisirs très diversifiée",
        "Présence DATA Tourisme et SIRENE — double validation du stock"
      ],
      "points_attention": [
        "56,2% des hébergements sont des meublés particuliers — fort enjeu de commercialisation directe",
        "Culture dominée à 88,6% par le spectacle vivant (artistes SIRENE) — biais de mesure à mentionner",
        "Couverture DATA Tourisme de seulement 3% globale — les données numériques sous-représentent l'offre réelle"
      ],
      "indicateurs_cles": [
        { "label": "Total stock physique", "valeur": "2 213 établissements", "interpretation": "fort" },
        { "label": "Ratio meublés particuliers", "valeur": "56,2%", "interpretation": "moyen" },
        { "label": "Couverture DATA Tourisme", "valeur": "3,0%", "interpretation": "faible" }
      ],
      "synthese_narrative": "Annecy dispose d'un stock touristique physique dense avec 2 213 établissements référencés, dominé par les activités de loisirs (927) et la culture (745). La forte proportion de meublés particuliers (56,2% des hébergements) illustre l'importance de l'économie collaborative et représente un enjeu clé de commercialisation directe pour l'OT. La couverture DATA Tourisme de 3% révèle que la grande majorité des établissements n'est pas encore présente dans les bases de données touristiques officielles."
    },
    "meta": {
      "cout_total_euros": 0.003,
      "sources_utilisees": ["data_tourisme", "recherche_entreprises"],
      "erreurs_partielles": []
    }
  },

  "stock_en_ligne": {
    "site_ot": {
      "domaine": "lac-annecy.com",
      "url_hebergements": "https://www.lac-annecy.com/hebergements/",
      "url_activites": "https://www.lac-annecy.com/activites/",
      "hebergements": {
        "nb_fiches": 34,
        "est_reservable_direct": false,
        "liens_ota": ["booking"],
        "type": "listing_seul"
      },
      "activites": {
        "nb_fiches": 64,
        "est_reservable_direct": false,
        "liens_ota": [],
        "type": "listing_seul"
      },
      "moteur_resa_detecte": null,
      "duree_ms": 8500
    },
    "airbnb": {
      "total_annonces": 4246,
      "nb_requetes": 21,
      "nb_zones": 21,
      "bbox_utilisee": {
        "ne_lat": 45.9420,
        "ne_lng": 6.1730,
        "sw_lat": 45.8590,
        "sw_lng": 6.0640
      },
      "duree_ms": 95000
    },
    "booking": {
      "total_proprietes": 277,
      "detail": {
        "hotels": 0,
        "apparts": 0,
        "campings": 0,
        "bb": 0,
        "villas": 0
      },
      "duree_ms": 12000
    },
    "viator": {
      "total_activites": 0,
      "url_utilisee": "https://www.viator.com/fr-FR/Annecy/",
      "slug_detecte": "Annecy",
      "duree_ms": 15000,
      "erreur": "Cloudflare protection — headless blocked"
    },
    "indicateurs": {
      "taux_dependance_ota": 9.8,
      "taux_reservable_direct": 0.0075,
      "taux_visibilite_activites": 0.0,
      "total_ota_hebergements": 4523,
      "total_ot_hebergements": 34,
      "total_ot_activites": 64,
      "total_viator": 0,
      "site_ot_type_hebergements": "listing_seul",
      "site_ot_type_activites": "listing_seul",
      "site_ot_ota_detectees": ["booking"],
      "moteur_resa_detecte": null
    },
    "synthese": {
      "diagnostic": "Annecy est massivement dépendante des OTA pour la commercialisation de son hébergement : 4 523 annonces sur Airbnb et Booking contre seulement 34 fiches sur le site OT, sans possibilité de réservation directe. Cette situation génère une perte de revenu significative pour les prestataires locaux et fragilise la destination face aux politiques tarifaires des plateformes.",
      "points_cles": [
        { "label": "Dépendance OTA hébergements", "valeur": "9,8x plus d'annonces OTA que de fiches OT", "niveau": "critique" },
        { "label": "Réservation directe OT", "valeur": "0,75% des annonces OTA référencées sur le site OT", "niveau": "critique" },
        { "label": "Visibilité activités en ligne", "valeur": "Viator bloqué — données non disponibles", "niveau": "moyen" }
      ],
      "message_ot": "Votre destination génère 4 523 transactions touristiques sur Airbnb et Booking chaque nuit — et votre site OT n'en capte que 34. Chaque réservation perdue sur les OTA représente une commission de 15-25% qui ne revient pas aux prestataires locaux.",
      "recommandations": [
        "Intégrer un moteur de réservation directe (Bokun, Regiondo) sur le site OT",
        "Développer une offre packagée hébergement + activités réservable en direct",
        "Accompagner les prestataires locaux à rejoindre la plateforme OT"
      ]
    },
    "couts": {
      "openai": 0.003,
      "scraping": 0.000
    },
    "meta": {
      "erreurs_partielles": ["viator: Cloudflare protection — données à 0"],
      "duree_totale_ms": 143000
    }
  },

  "concurrents": {
    "phase_a": {
      "concurrents": [
        {
          "nom": "Chamonix-Mont-Blanc",
          "code_insee": "74056",
          "departement": "74",
          "type_destination": "station de montagne internationale",
          "raison_selection": "Destination alpine premium du même département, profil touristique similaire lac/montagne, même gamme de prix",
          "domaine_ot": "chamonix.com",
          "confiance_domaine": "certain",
          "domaine_valide": "chamonix.com",
          "metriques": {
            "total_keywords": 70755,
            "total_traffic": 176206,
            "source_seo": "haloscan",
            "site_non_indexe": false,
            "note_google": 4.4,
            "nb_avis_google": 1866,
            "position_serp_requete_principale": null
          },
          "haloscan_match": {
            "root_domain": "chamonix.com",
            "common_keywords": 8420,
            "total_traffic": 176206,
            "keywords_vs_max": 0.82,
            "exclusive_keywords": 32100,
            "missed_keywords": 18900,
            "bested": 5200,
            "keywords": 70755
          }
        },
        {
          "nom": "Évian-les-Bains",
          "code_insee": "74110",
          "departement": "74",
          "type_destination": "ville thermale lacustre",
          "raison_selection": "Destination lacustre du Lac Léman, même département, positionnement thermal similaire",
          "domaine_ot": "evian-tourisme.com",
          "confiance_domaine": "certain",
          "domaine_valide": "evian-tourisme.com",
          "metriques": {
            "total_keywords": 36,
            "total_traffic": 4,
            "source_seo": "haloscan",
            "site_non_indexe": false,
            "note_google": 4.3,
            "nb_avis_google": 749,
            "position_serp_requete_principale": null
          }
        },
        {
          "nom": "Aix-les-Bains",
          "code_insee": "73011",
          "departement": "73",
          "type_destination": "ville thermale lacustre",
          "raison_selection": "Destination lac de montagne comparable (Lac du Bourget), même positionnement thermal, clientèle similaire",
          "domaine_ot": "aixlesbains-rivieradesalpes.com",
          "confiance_domaine": "certain",
          "domaine_valide": "aixlesbains-rivieradesalpes.com",
          "metriques": {
            "total_keywords": 0,
            "total_traffic": 0,
            "source_seo": "inconnu",
            "site_non_indexe": true,
            "note_google": 4.3,
            "nb_avis_google": 553,
            "position_serp_requete_principale": null
          }
        },
        {
          "nom": "Saint-Gervais-les-Bains",
          "code_insee": "74262",
          "departement": "74",
          "type_destination": "station montagne 4 saisons",
          "raison_selection": "Station alpine 4 saisons du même département, population comparable, offre ski + été",
          "domaine_ot": "saintgervais.com",
          "confiance_domaine": "certain",
          "domaine_valide": "saintgervais.com",
          "metriques": {
            "total_keywords": 27788,
            "total_traffic": 40577,
            "source_seo": "haloscan",
            "site_non_indexe": false,
            "note_google": 4.3,
            "nb_avis_google": 361,
            "position_serp_requete_principale": null
          }
        },
        {
          "nom": "La Clusaz",
          "code_insee": "74065",
          "departement": "74",
          "type_destination": "station ski familiale",
          "raison_selection": "Station de ski familiale emblématique de Haute-Savoie, clientèle urbaine comparable à Annecy",
          "domaine_ot": "laclusaz.com",
          "confiance_domaine": "certain",
          "domaine_valide": "laclusaz.com",
          "metriques": {
            "total_keywords": 24322,
            "total_traffic": 1016314,
            "source_seo": "haloscan",
            "site_non_indexe": false,
            "note_google": 4.1,
            "nb_avis_google": 154,
            "position_serp_requete_principale": null
          }
        }
      ],
      "haloscan_suggestions": [
        {
          "root_domain": "chamonix.com",
          "common_keywords": 8420,
          "total_traffic": 176206,
          "keywords_vs_max": 0.82,
          "exclusive_keywords": 32100,
          "missed_keywords": 18900,
          "bested": 5200,
          "keywords": 70755
        },
        {
          "root_domain": "megeve.com",
          "common_keywords": 3200,
          "total_traffic": 45000,
          "keywords_vs_max": 0.61,
          "exclusive_keywords": 12400,
          "missed_keywords": 8700,
          "bested": 1800,
          "keywords": 18200
        }
      ],
      "analyse_paysage": "Annecy domine le paysage concurrentiel alpin avec 53 842 mots-clés indexés, dépassant la plupart de ses concurrents régionaux. Seul Chamonix-Mont-Blanc surpasse la destination en volume SEO (70 755 mots-clés). La Clusaz présente un trafic estimé anormalement élevé (1,01M — probablement surestimé par Haloscan). La présence quasi-nulle d'Évian en SEO et l'absence totale d'Aix-les-Bains illustrent les disparités digitales importantes entre destinations comparables.",
      "statut": "en_attente_validation",
      "couts": {
        "openai_identification": 0.001,
        "haloscan": 0.060,
        "haloscan_positions": 0.010,
        "haloscan_competitors": 0.010,
        "dataforseo_ranked": 0.030,
        "dataforseo_maps": 0.030,
        "dataforseo_serp_validation": 0.005
      }
    },
    "concurrents_valides": [
      { "nom": "Chamonix-Mont-Blanc", "code_insee": "74056", "departement": "74", "type_destination": "station de montagne internationale", "raison_selection": "Destination alpine premium du même département", "domaine_ot": "chamonix.com", "confiance_domaine": "certain", "domaine_valide": "chamonix.com" },
      { "nom": "Évian-les-Bains", "code_insee": "74110", "departement": "74", "type_destination": "ville thermale lacustre", "raison_selection": "Destination lacustre du Lac Léman, même département", "domaine_ot": "evian-tourisme.com", "confiance_domaine": "certain", "domaine_valide": "evian-tourisme.com" },
      { "nom": "Aix-les-Bains", "code_insee": "73011", "departement": "73", "type_destination": "ville thermale lacustre", "raison_selection": "Destination lac de montagne comparable", "domaine_ot": "aixlesbains-rivieradesalpes.com", "confiance_domaine": "certain", "domaine_valide": "aixlesbains-rivieradesalpes.com" },
      { "nom": "Saint-Gervais-les-Bains", "code_insee": "74262", "departement": "74", "type_destination": "station montagne 4 saisons", "raison_selection": "Station alpine 4 saisons du même département", "domaine_ot": "saintgervais.com", "confiance_domaine": "certain", "domaine_valide": "saintgervais.com" },
      { "nom": "La Clusaz", "code_insee": "74065", "departement": "74", "type_destination": "station ski familiale", "raison_selection": "Station de ski familiale emblématique de Haute-Savoie", "domaine_ot": "laclusaz.com", "confiance_domaine": "certain", "domaine_valide": "laclusaz.com" }
    ],
    "tableau_comparatif": {
      "destination_cible": {
        "nom": "Annecy",
        "total_keywords": 53842,
        "total_traffic": 161645,
        "note_google": 4.5,
        "nb_avis_google": 3200,
        "score_visibilite_ot": 1,
        "taux_dependance_ota": 9.8,
        "nuitees_estimees": 2293891
      },
      "concurrents": [
        { "nom": "Chamonix-Mont-Blanc", "total_keywords": 70755, "total_traffic": 176206, "note_google": 4.4, "nb_avis_google": 1866, "position_serp_requete_principale": null },
        { "nom": "Évian-les-Bains", "total_keywords": 36, "total_traffic": 4, "note_google": 4.3, "nb_avis_google": 749, "position_serp_requete_principale": null },
        { "nom": "Aix-les-Bains", "total_keywords": 0, "total_traffic": 0, "note_google": 4.3, "nb_avis_google": 553, "position_serp_requete_principale": null },
        { "nom": "Saint-Gervais-les-Bains", "total_keywords": 27788, "total_traffic": 40577, "note_google": 4.3, "nb_avis_google": 361, "position_serp_requete_principale": null },
        { "nom": "La Clusaz", "total_keywords": 24322, "total_traffic": 1016314, "note_google": 4.1, "nb_avis_google": 154, "position_serp_requete_principale": null }
      ]
    },
    "synthese": {
      "position_globale": "leader",
      "resume": "Annecy s'impose comme leader digital parmi ses concurrents alpins directs, avec le deuxième volume de mots-clés indexés (53 842 vs 70 755 pour Chamonix) et une note Google supérieure (4.5). La destination surclasse nettement Évian (36 mots-clés), Aix-les-Bains (non indexé) et Saint-Gervais. Le principal chantier reste la monétisation de cette visibilité via une offre de réservation directe.",
      "points_forts": [
        { "critere": "Volume SEO", "valeur": "53 842 mots-clés", "benchmark": "Moyenne concurrents : 24 580" },
        { "critere": "Note Google destination", "valeur": "4.5/5", "benchmark": "Moyenne concurrents : 4.3/5" },
        { "critere": "Volume nuitées", "valeur": "2,29 M nuitées/an", "benchmark": "Estimation Chamonix : ~1,5 M/an" }
      ],
      "points_faibles": [
        { "critere": "Visibilité OT sur intentions clés", "valeur": "1/5 intentions captées", "benchmark": "Chamonix : 3/5 estimé" },
        { "critere": "Réservation directe OT", "valeur": "0,75% des annonces OTA", "benchmark": "Objectif sectoriel : 15-20%" },
        { "critere": "Score PageSpeed mobile", "valeur": "51/100", "benchmark": "Recommandation Google : >70" }
      ],
      "opportunite_cle": "35 gaps transactionnels identifiés représentent un potentiel de +38 000 visites/mois sur des mots-clés à fort intent (événements, plages, randonnées) où Annecy est absente alors que Chamonix est bien positionnée.",
      "message_ot": "Annecy est en tête digitalement mais perd la bataille transactionnelle : 9,8x plus d'hébergements vendus sur les OTA que via votre site. C'est la prochaine frontière à conquérir."
    },
    "statut": "termine",
    "couts": {
      "openai_identification": 0.001,
      "haloscan": 0.060,
      "haloscan_positions": 0.010,
      "haloscan_competitors": 0.010,
      "dataforseo_ranked": 0.030,
      "dataforseo_maps": 0.030,
      "dataforseo_serp_validation": 0.005,
      "openai_synthese": 0.001,
      "total_bloc": 0.147
    }
  }
}
  $resultats$::jsonb,

-- ══════════════════════════════════════════════════════════════
-- JSONB couts_api — agrégat par bloc
-- ══════════════════════════════════════════════════════════════
  $couts$
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
    "haloscan_keywords":      { "nb_appels": 8, "cout": 0.080 },
    "dataforseo_related":     { "nb_appels": 4, "cout": 0.024 },
    "dataforseo_ranked":      { "nb_appels": 1, "cout": 0.006 },
    "dataforseo_serp_transac":{ "nb_appels": 8, "cout": 0.048 },
    "openai":                 { "nb_appels": 7, "cout": 0.007 },
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
    "openai_identification":      0.001,
    "haloscan":                   0.060,
    "haloscan_positions":         0.010,
    "haloscan_competitors":       0.010,
    "dataforseo_ranked":          0.030,
    "dataforseo_maps":            0.030,
    "dataforseo_serp_validation": 0.005,
    "openai_synthese":            0.001,
    "total_bloc": 0.147
  },
  "total_audit": 0.516
}
  $couts$::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  statut     = EXCLUDED.statut,
  resultats  = EXCLUDED.resultats,
  couts_api  = EXCLUDED.couts_api;

-- ─── Competitors : les 5 concurrents d'Annecy ─────────────────────────────────

-- Supprimer les anciens concurrents de cet audit avant réinsertion
DELETE FROM public.competitors WHERE audit_id = v_audit_id;

INSERT INTO public.competitors (audit_id, nom, type, metriques) VALUES
(
  v_audit_id,
  'Chamonix-Mont-Blanc',
  'direct',
  $m1${ "total_keywords": 70755, "total_traffic": 176206, "source_seo": "haloscan", "site_non_indexe": false, "note_google": 4.4, "nb_avis_google": 1866, "domaine_ot": "chamonix.com" }$m1$::jsonb
),
(
  v_audit_id,
  'Évian-les-Bains',
  'direct',
  $m2${ "total_keywords": 36, "total_traffic": 4, "source_seo": "haloscan", "site_non_indexe": false, "note_google": 4.3, "nb_avis_google": 749, "domaine_ot": "evian-tourisme.com" }$m2$::jsonb
),
(
  v_audit_id,
  'Aix-les-Bains',
  'indirect',
  $m3${ "total_keywords": 0, "total_traffic": 0, "source_seo": "inconnu", "site_non_indexe": true, "note_google": 4.3, "nb_avis_google": 553, "domaine_ot": "aixlesbains-rivieradesalpes.com" }$m3$::jsonb
),
(
  v_audit_id,
  'Saint-Gervais-les-Bains',
  'direct',
  $m4${ "total_keywords": 27788, "total_traffic": 40577, "source_seo": "haloscan", "site_non_indexe": false, "note_google": 4.3, "nb_avis_google": 361, "domaine_ot": "saintgervais.com" }$m4$::jsonb
),
(
  v_audit_id,
  'La Clusaz',
  'direct',
  $m5${ "total_keywords": 24322, "total_traffic": 1016314, "source_seo": "haloscan", "site_non_indexe": false, "note_google": 4.1, "nb_avis_google": 154, "domaine_ot": "laclusaz.com" }$m5$::jsonb
);

RAISE NOTICE 'Seed Annecy inséré avec succès — destination: %, audit: %', v_destination_id, v_audit_id;

END $$;
