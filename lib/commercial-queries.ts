// Requêtes commerciales — hébergement et activités
// S'applique identiquement pour type=destination et type=place

export interface CommercialQuery {
  id: string
  label: string
  keyword: string
}

export function getHebergementQueries(keyword: string): CommercialQuery[] {
  return [
    { id: 'serp1', label: 'hébergements',     keyword: `hébergements ${keyword}` },
    { id: 'serp2', label: 'hébergement',       keyword: `hébergement ${keyword}` },
    { id: 'serp3', label: 'location vacances', keyword: `location vacances ${keyword}` },
    { id: 'serp4', label: 'hôtel',             keyword: `hotel ${keyword}` },
    { id: 'serp5', label: 'camping',           keyword: `camping ${keyword}` },
  ]
}

export function getActivitesQueries(keyword: string): CommercialQuery[] {
  return [
    { id: 'serp1', label: 'que faire à',  keyword: `que faire à ${keyword}` },
    { id: 'serp2', label: 'activités à',  keyword: `activités ${keyword}` },
  ]
}
