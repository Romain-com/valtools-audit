# Diagnostic — Orchestrateur retourne 0 résultats
> Date : 2026-02-26
> Destinations testées : Chamonix-Mont-Blanc (74056), Megève (74173)

---

## Cause racine principale

**Les `lib/blocs/*.ts` font des appels HTTP vers `localhost:3000` qui échouent quand exécutés depuis un Route Handler Next.js.**

### Architecture du problème

```
Test scripts (test-bloc3.js, etc.)
  └─ axios → DataForSEO / OpenAI / Haloscan  (APIs externes DIRECTEMENT)
             ← NE PASSE JAMAIS PAR LOCALHOST ← tests ne reproduisent PAS le path orchestrateur

Orchestrateur (segment-a/route.ts)
  └─ lancerBloc3()
       └─ lancerBlocSchemaDigital()  [lib/blocs/schema-digital.ts:56]
            └─ fetch('http://localhost:3000/api/blocs/schema-digital/serp')
                 └─ Route Handler → DataForSEO
                 ↑ CE FETCH ÉCHOUE (appel auto-référentiel dans le même processus Node.js)
```

Les scripts de test n'ont jamais testé le même code que l'orchestrateur. Ils appellent les APIs externes directement via axios. Les `lib/blocs` ajoutent un saut HTTP vers `localhost:3000` qui n'existe pas dans les tests.

---

## Hypothèses classées par probabilité

### #1 — TRÈS PROBABLE (85%) : Deadlock / échec fetch auto-référentiel

Quand `segment-a/route.ts` exécute `lancerBlocSchemaDigital()`, cette fonction tente :
```typescript
// lib/blocs/schema-digital.ts:56
fetch('http://localhost:3000/api/blocs/schema-digital/serp', ...)
```
Le serveur Next.js se fait une requête à lui-même pendant qu'il traite `segment-a`. En mode dev Node.js, ce pattern peut échouer (deadlock, timeout immédiat, ou limite de concurrence du serveur dev).

**Preuve par le timing** : Bloc 3 prend **53s** en test direct (vrais appels DataForSEO) mais **~6s** dans l'orchestrateur. 6s = le catch global s'exécute sans faire aucun appel API réel.

**Le catch global avale l'erreur** — `lib/blocs/schema-digital.ts:233` :
```typescript
} catch (err) {
  console.error('[Bloc 3] Erreur fatale :', err)  // visible SEULEMENT dans le terminal Next.js
  return {
    serp_fusionne: [],
    domaine_ot_detecte: null,   // ← déclenche toute la cascade downstream
    haloscan: [],
    ...
  }
}
```
L'orchestrateur croit que Bloc 3 a réussi (pas de throw) avec des données vides.

**Pattern identique dans TOUS les lib/blocs** :
- `lib/blocs/schema-digital.ts:16`
- `lib/blocs/positionnement.ts:19`
- `lib/blocs/visibilite-seo-phase-a.ts:18`
- `lib/blocs/volume-affaires.ts:19`
- `lib/blocs/stocks-physiques.ts:18`
- `lib/blocs/stock-en-ligne.ts:22`
- `lib/blocs/concurrents-phase-a.ts:21`

### #2 — PROBABLE (10%) : `localhost` → `::1` (IPv6), résolution incompatible

Confirmé sur ce système : `dns.lookup('localhost')` résout vers `::1` (IPv6) en priorité. La `fetch` native Node.js 18+ suit ce comportement. Si une configuration réseau intermédiaire bloque `::1:3000`, les fetch échouent avec `ECONNREFUSED` immédiatement.

Le serveur écoute sur IPv6 (`TCP *:3000 IPv6`) donc probablement pas le problème ici — mais à vérifier.

**Fichier** : `.env.local` — `NEXT_PUBLIC_APP_URL` absent → fallback `http://localhost:3000`

### #3 — PEU PROBABLE (5%) : Route handlers retournent une erreur non-OK en contexte serveur

Les route handlers (`/api/blocs/schema-digital/serp`, etc.) pourraient retourner 500 si un header ou contexte spécifique manque lors d'appels internes.

---

## Cascade des effets — Confirmée par tests

```
Bloc 3 catch → domaine_ot_detecte: null
    │
    ├─ supabase-updates.ts:197 → lireParamsAudit() lit null
    │    └─ logInfo: domaine_ot_source = "null — Bloc 3 non terminé ou détection échouée"
    │
    ├─ Bloc 4 Phase A (bloc4.ts:24)
    │   └─ lancerPhaseA('Megève', '', audit_id)
    │       └─ DataForSEO ranked_keywords(domaine='') → 0 keywords positionnés
    │           └─ gap analysis vide → nb_gaps = 0
    │
    ├─ Bloc 6 (bloc6.ts:15) → domaine_ot='' → scraper site OT sans domaine → 0 fiches
    │
    └─ Bloc 7 (concurrents-phase-a.ts)
        └─ HTTP 500 : {"error":"Request failed with status code 400"}  ← CONFIRMÉ par test
```

---

## Résultats des tests blocs indépendants (Megève / 74173)

| Bloc | Durée | Résultat | Notes |
|------|-------|----------|-------|
| Bloc 1 | 20.2s | ✅ Maps OT: 4.3⭐/833 avis | Instagram postsCount=0 (hashtag #74173 = code INSEE, pas le nom) |
| Bloc 2 | 10.8s | ⚠️ Hardcodé Vanves+Annecy | Ignore les args Megève/74173 — test inutile pour valider cette destination |
| Bloc 3 | 53.1s | ✅ domaine_ot: www.megeve-tourisme.fr | Haloscan: 19 476 kw, 9 domaines SERP |
| Bloc 4 | 28.9s | ⚠️ 0 kw positionnés OT | 74173 n'est pas un domaine valide pour ranked_keywords |
| Bloc 5 | 17.4s | ✅ 406 établissements | DATA Tourisme + SIRENE fusionnés |
| Bloc 6 | 94s | ✅ Airbnb: 1934, Booking: 48 | Viator: 0, Site OT: 0 fiches (megeve.fr) |
| Bloc 7 | <2s | ❌ HTTP 500 → erreur 400 | Utilise `lac-annecy.com` en dur comme domaine_ot |

---

## Vérification immédiate pour confirmer la cause

**Ouvrir le terminal où tourne `npm run dev` et relancer un audit.**

Le message suivant doit apparaître dans les logs Next.js :
```
[Bloc 3] Erreur fatale : <erreur ici>
```
L'erreur exacte (ECONNREFUSED, ERR_FETCH_FAILED, timeout, HTTP 500...) confirmera la cause.

---

## Piste de correction probable

Remplacer le pattern `fetch(localhost:3000/api/...)` par des **imports directs des fonctions** des route handlers dans les lib/blocs. Exemple pour schema-digital :

```typescript
// AVANT (lib/blocs/schema-digital.ts)
const result = await fetch('http://localhost:3000/api/blocs/schema-digital/serp', {...})

// APRÈS
import { executerSERP } from '@/lib/modules/serp'
const result = await executerSERP({ destination })
```

Cela supprime le saut HTTP inutile et évite les problèmes d'appels auto-référentiels.

---

## Anomalie supplémentaire

**`test-bloc2.js` ignore ses arguments** : le script teste Vanves + Annecy en dur. Les `process.argv[2]`/`[3]` ne sont pas utilisés — les tests Bloc 2 ne valident pas la destination passée en paramètre.
