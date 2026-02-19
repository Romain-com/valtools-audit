import { VolumeAffairesInput, VolumeAffairesOutput } from "@/types/audit";
import { askLLMJson } from "@/lib/llm";
import { getTaxeDeSejour } from "@/lib/dgfip";
import { findCommuneByInsee } from "@/lib/communes";
import { trackApiCall } from "@/lib/api-tracker";
import { API_COSTS } from "@/lib/api-costs";

// ============================================
// MODULE 2 — VOLUME D'AFFAIRES
// ============================================

export async function runVolumeAffaires(
  input: VolumeAffairesInput,
  auditId?: string | null
): Promise<VolumeAffairesOutput> {
  const { destination, codeInsee } = input;

  const commune = await findCommuneByInsee(codeInsee);
  if (!commune) {
    throw new Error(
      `Commune non trouvée pour le code INSEE "${codeInsee}". Vérifiez le code.`
    );
  }

  // DGFiP — taxe de séjour
  const taxeData = await trackApiCall({
    auditId,
    apiName: "dgfip",
    endpoint: "balances-comptables-communes-2024",
    call: () => getTaxeDeSejour(commune.siren),
    estimateCost: () => 0,
  });
  const taxePercue = taxeData.totalTaxe;

  if (taxePercue === 0) {
    return {
      taxePercue: 0,
      volumeAffaires: 0,
      nuiteesEstimees: 0,
      ratioPressionTouristique: 0,
      diagnostic: `Aucune taxe de séjour trouvée pour ${destination} (INSEE: ${codeInsee}). La commune ne perçoit peut-être pas de taxe, ou elle est gérée au niveau intercommunal.`,
      source: taxeData.source,
    };
  }

  const volumeAffaires = taxePercue * 25;
  const nuiteesEstimees = Math.round(taxePercue / 1.5);
  const population = commune.population || 1;
  const ratioPressionTouristique =
    Math.round((taxePercue / population) * 100) / 100;

  // LLM — diagnostic
  const llmPrompt = `Voici les données financières pour la destination ${destination} :
Taxe de séjour encaissée : ${taxePercue.toLocaleString("fr-FR")} €
Volume d'affaires estimé (Hébergement) : ${volumeAffaires.toLocaleString("fr-FR")} €
Nuitées estimées : ${nuiteesEstimees.toLocaleString("fr-FR")}
Population locale : ${population.toLocaleString("fr-FR")} habitants
Ratio Pression Touristique : ${ratioPressionTouristique}€ par habitant

Tâche :
Calcule le ratio 'Pression Touristique' (Montant Taxe / Population).
Rédige un paragraphe de diagnostic orienté opportunité :
Si le Volume d'Affaires est > 10M€ : Félicite pour la puissance économique.
Si le ratio par habitant est faible (<10€) : Souligne que le tourisme est une manne sous-exploitée par rapport à la taille de la commune.
Compare ces chiffres à une "moyenne" théorique pour donner du relief (ex: 'Vous générez l'équivalent de X€ par habitant, ce qui révèle une forte dépendance/opportunité...').
Sortie JSON : { "diagnostic": "..." }`;

  let diagnostic: string;
  try {
    const llmResult = await trackApiCall({
      auditId,
      apiName: "openai",
      endpoint: "chat/completions",
      call: () => askLLMJson<{ diagnostic: string }>(llmPrompt, "Agis comme un analyste économique touristique."),
      estimateCost: () => {
        const tokens = Math.ceil(llmPrompt.length / 4);
        return tokens * API_COSTS.openai.promptTokenCost + 200 * API_COSTS.openai.completionTokenCost;
      },
    });
    diagnostic = llmResult.diagnostic;
  } catch {
    if (volumeAffaires > 10_000_000) {
      diagnostic = `${destination} génère un volume d'affaires hébergement estimé à ${(volumeAffaires / 1_000_000).toFixed(1)}M€, ce qui en fait une destination économiquement puissante. Avec ${nuiteesEstimees.toLocaleString("fr-FR")} nuitées estimées et un ratio de ${ratioPressionTouristique}€/habitant, le tourisme représente un levier économique majeur.`;
    } else if (ratioPressionTouristique < 10) {
      diagnostic = `Avec seulement ${ratioPressionTouristique}€ de taxe par habitant, ${destination} présente un potentiel touristique sous-exploité. Le volume d'affaires hébergement estimé (${(volumeAffaires / 1_000).toFixed(0)}k€) laisse entrevoir une marge de croissance significative.`;
    } else {
      diagnostic = `${destination} perçoit ${taxePercue.toLocaleString("fr-FR")}€ de taxe de séjour, soit un volume d'affaires hébergement estimé à ${(volumeAffaires / 1_000).toFixed(0)}k€ pour ${nuiteesEstimees.toLocaleString("fr-FR")} nuitées estimées.`;
    }
  }

  return {
    taxePercue,
    volumeAffaires,
    nuiteesEstimees,
    ratioPressionTouristique,
    diagnostic,
    source: taxeData.source,
  };
}
