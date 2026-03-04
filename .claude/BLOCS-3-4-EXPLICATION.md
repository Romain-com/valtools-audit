# Blocs 3 et 4 — Ce que l'outil fait et ce qu'on voit

> Document en langage simple. Objectif : comprendre ce que chaque bloc mesure, comment il collecte ses données, et ce que l'interface affiche.

---

## BLOC 3 — "Schéma digital & Santé technique"

### En une phrase
> Ce bloc répond à la question : **"Qui est présent sur Google quand on cherche cette destination, et est-ce que le site de l'OT est en bonne santé ?"**

---

### Les 4 chiffres affichés (KPI cards)

| Ce qu'on voit | Ce que ça mesure réellement | Comment c'est calculé |
|---|---|---|
| **Visibilité OT** `/5` | Combien de fois le site officiel de l'OT apparaît dans les 5 types de recherche Google | Sur 5 requêtes Google lancées, l'OT est en position 1 sur combien ? Ex : 3/5 = présent sur 3 intentions |
| **PageSpeed mobile** `/100` | Vitesse de chargement du site OT sur téléphone | Score Google PageSpeed Insights (0-100) |
| **PageSpeed desktop** `/100` | Vitesse de chargement sur ordinateur | Même outil, version desktop |
| **Maturité digitale** | Niveau global du site OT : Faible / Moyen / Avancé | ⚠️ Inféré par GPT à partir du titre et de la meta-description uniquement — pas un vrai audit du site |

---

### Ce qui se passe techniquement derrière

**Étape 1 — 5 recherches Google en parallèle**
L'outil lance 5 requêtes Google (via DataForSEO) pour la destination :
- `[destination]` → qui est connu ?
- `visiter [destination]` → qui guide les touristes ?
- `que faire [destination]` → qui propose des activités ?
- `hôtel [destination]` → qui capture les réservations ?
- `office de tourisme [destination]` → l'OT est-il visible sur son propre nom ?

Résultat : ~30-40 URLs récupérées au total (doublons supprimés).

**Étape 2 — GPT classe chaque URL**
GPT-5-mini regarde chaque URL et dit : c'est l'OT officiel ? la mairie ? Booking/TripAdvisor ? un blog ? autre chose ?
Il identifie aussi le domaine du site OT (ex : `lesdeuxalpes.com`) — **cette donnée est critique** pour la suite de l'audit.

**Étape 3 — Données SEO des 3 meilleurs sites officiels (Haloscan)**
Pour les 3 premiers sites officiels trouvés, l'outil interroge Haloscan :
- Combien de mots-clés Google ils captent
- Estimation du trafic mensuel
- Nombre de positions dans le top 3 Google

Si Haloscan ne connaît pas le site → fallback sur DataForSEO (données moins précises).

**Étape 4 — Vitesse du site (PageSpeed)**
2 mesures par domaine (mobile + desktop) via Google PageSpeed Insights.
Score 0-100. En dessous de 50 : site lent. Au dessus de 70 : correct.

**Étape 5 — Analyse du site OT (GPT)**
GPT reçoit le titre et la meta-description de la page d'accueil de l'OT et devine si le site a :
moteur de réservation / blog / newsletter / agenda / carte interactive / appli mobile.
⚠️ **C'est une déduction à partir de 2 lignes de texte, pas un scan du site.**
Si la meta-description est vide ou générique → tout s'affiche en "❓ incertain".

**Étape 6 — Synthèse GPT**
Un texte de 80-100 mots produit par GPT, prêt à copier dans un GDoc.

---

### Les sections dépliables

| Section | Ce qu'on y voit |
|---|---|
| **Métriques SEO Haloscan** | Tableau : domaine / nb keywords / trafic estimé / positions top 3 / indexé ou non |
| **Fonctionnalités site OT** | Grille ✅ / ❌ / ❓ pour les 6 fonctionnalités détectées par GPT |
| **Résultats SERP fusionnés** | Liste des ~30 URLs classées par GPT (OT / mairie / OTA / media / autre) |

---

### Problèmes fréquents à connaître

- **Maturité digitale souvent "incertain"** : normal si le site OT a une meta-description générique ou vide.
- **Haloscan vide** : les petits OT ne sont pas indexés par Haloscan. L'outil passe en fallback DataForSEO mais les données sont moins riches.
- **Score Visibilité OT bas (ex: 1/5)** : l'OT n'est pas en position 1 sur ses propres requêtes — c'est souvent Booking, TripAdvisor ou Maville.com qui écrasent.

---
---

## BLOC 4 — "Visibilité SEO & Gap Transactionnel"

### En une phrase
> Ce bloc répond à la question : **"Sur quels mots-clés l'OT est absent de Google alors que des gens cherchent ces choses ?"**

---

### Ce bloc fonctionne en 2 temps (Phase A puis Phase B)

---

### PHASE A — Cartographier le marché (automatique)

**Ce que ça fait :**
L'outil collecte tous les mots-clés que les gens tapent sur Google autour de la destination, puis compare avec ceux sur lesquels l'OT est déjà présent.

**Les 3 sources de mots-clés :**

| Source | Nb d'appels | Ce qu'elle donne |
|---|---|---|
| **Haloscan** (marché) | 8 appels | Volume de recherche, CPC, concurrence pour 8 thèmes : destination, tourisme, hébergement, que faire, restaurant, culture, activités, services |
| **DataForSEO Related** | 4 appels | Mots-clés associés / suggestions Google pour 4 thèmes |
| **DataForSEO Ranked** | 1 appel | Sur quels mots-clés le site OT est **déjà** positionné dans Google + trafic estimé capté |

Les résultats des 2 premières sources sont fusionnés + dédupliqués → corpus du marché.
GPT classifie ensuite chaque mot-clé : activités / hébergements / services / culture / restauration / transports.
Il marque aussi les mots-clés où le marché existe mais l'OT est absent → **gap SEO**.

**→ L'audit se met en pause ici.**
L'utilisateur voit la liste des mots-clés classifiés et peut en décocher avant de lancer Phase B.

---

### PHASE B — Vérifier les absences sur Google (après validation)

**Ce que ça fait :**
Pour chaque mot-clé transactionnel validé, l'outil lance une vraie recherche Google et vérifie :
- L'OT est-il dans les 10 premiers résultats ?
- Si non, qui est à sa place ?

Puis GPT produit un score et une synthèse.

---

### Les 4 chiffres affichés (KPI cards)

| Ce qu'on voit | Ce que ça mesure | Comment c'est calculé |
|---|---|---|
| **Score gap** `/10` | Ampleur des opportunités manquées | Score calculé par GPT : plus c'est haut, plus il y a de mots-clés à fort volume sans l'OT |
| **Taux captation** `%` | Part du trafic marché que l'OT capte déjà | Trafic estimé OT ÷ volume total du marché × 100 |
| **Volume marché** | Nb de recherches/mois total sur les mots-clés seeds | Somme des volumes Haloscan sur les 8 thèmes |
| **Top 5 opportunités** | Nombre de mots-clés prioritaires identifiés | Toujours 5 (sélectionnés par GPT en Phase B) |

---

### Les sections dépliables

| Section | Ce qu'on y voit |
|---|---|
| **Top 5 opportunités SEO** | Tableau : keyword / volume / catégorie / position actuelle de l'OT (ou "Absent") |
| **Keywords classifiés Phase A** | Les 20 premiers mots-clés du corpus avec : volume, catégorie, gap OUI/NON |

---

### Le message d'alerte orange

Si on voit **"Phase B non lancée — validation requise"** : Phase A est terminée mais personne n'a validé les keywords pour lancer Phase B. Les KPI score gap / taux captation / top 5 opportunités seront tous à `—` ou vides.

---

### Problèmes fréquents à connaître

- **Score gap élevé (7-8/10)** : normal pour les petits OT — ils sont absents de beaucoup de requêtes transactionnelles.
- **Taux captation très bas (5-10%)** : l'OT ne capte qu'une infime partie du trafic touristique potentiel.
- **Keywords classifiés Phase A peu pertinents** : Haloscan remonte parfois des keywords génériques hors-tourisme — d'où l'étape de validation manuelle.
- **Phase B bloquée** : si Phase A n'a pas été validée, Phase B ne se lance jamais. Les données de Phase B restent vides.

---

## Résumé visuel du flux

```
BLOC 3
  ↓ 5 recherches Google → qui est là ?
  ↓ GPT classe les URLs → quel est le site OT ?
  ↓ Haloscan → santé SEO des 3 meilleurs sites officiels
  ↓ PageSpeed → vitesse du site OT
  ↓ GPT devine les fonctionnalités du site OT
  → Affichage : Visibilité 3/5, PageSpeed 62/100, Maturité Moyen

BLOC 4 — Phase A
  ↓ Haloscan (8 seeds) + DataForSEO Related (4 seeds) → mots-clés du marché
  ↓ DataForSEO Ranked → mots-clés où l'OT est déjà présent
  ↓ Fusion + déduplication
  ↓ GPT classifie chaque mot-clé + marque les gaps
  ⏸️ PAUSE → validation manuelle

BLOC 4 — Phase B (après validation)
  ↓ Recherches Google live sur les mots-clés transactionnels
  ↓ GPT calcule score gap + top 5 opportunités + synthèse
  → Affichage : Gap 7/10, Captation 8%, Top 5 keywords manquants
```
