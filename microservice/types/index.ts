// Types TypeScript partagés dans le microservice

// Commune issue du fichier CSV des identifiants communes
export interface Commune {
  nom: string
  siren: string
  code_insee: string
  code_postal: string
  code_departement: string
  code_region: string
  population: number
}

// Entrée légère dans l'index DATA Tourisme (on ne charge PAS le JSON complet en RAM)
export interface IndexPOI {
  nom: string
  types: string[]     // valeurs @type sans préfixe "schema:"
  code_insee: string
  latitude: number
  longitude: number
  filepath: string    // chemin absolu vers le fichier JSON source
}

// POI retourné par l'API au client Next.js
export interface POIResult {
  nom: string
  type_principal: string
  latitude: number
  longitude: number
}
