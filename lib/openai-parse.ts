// Helper partagé — parsing des réponses OpenAI Responses API
// Responsabilité : extraire le texte brut d'une réponse, quel que soit le format retourné

/**
 * Extrait le texte de la réponse OpenAI Responses API.
 * Le contenu est dans output[].type === 'message' → content[0].text
 * (output_text n'existe pas dans l'API Responses)
 *
 * Fallback sur Chat Completions pour compatibilité descendante.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOpenAIResponse(data: any): string {
  // Format Responses API : output[] contient les blocs de réponse
  if (data?.output) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageBlock = data.output.find((o: any) => o.type === 'message')
    return messageBlock?.content?.[0]?.text ?? ''
  }
  // Fallback Chat Completions (ne devrait plus arriver)
  return data?.choices?.[0]?.message?.content ?? ''
}
