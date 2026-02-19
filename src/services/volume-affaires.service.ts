import { VolumeAffairesInput, VolumeAffairesResult } from "@/types/audit";
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
): Promise<VolumeAffairesResult> {
  const { destination, codeInsee, population } = input;

  // Récupérer le SIREN commune depuis le référentiel CSV
  const commune = await findCommuneByInsee(codeInsee);
  if (!commune) {
    throw new Error(
      `Commune non trouvée pour le code INSEE "${codeInsee}". Vérifiez le code.`
    );
  }

  // --- ÉTAPE A+B : DGFiP — taxe de séjour (commune + EPCI) ---
  const taxeData = await trackApiCall({
    auditId,
    apiName: "dgfip",
    endpoint: `balances-comptables-communes/${codeInsee}`,
    call: () => getTaxeDeSejour(codeInsee, commune.siren),
    estimateCost: () => 0,
  });

  // Cas "non disponible"
  if (taxeData.totalTaxe === 0) {
    return {
      taxeTotale: 0,
      compte7311: 0,
      compte7321: 0,
      volumeAffaires: 0,
      nuiteesEstimees: 0,
      ratioPressionTouristique: 0,
      source: "non_disponible",
      anneeReference: taxeData.anneeReference,
      diagnostic: `Taxe de séjour non déclarée ou inférieure au seuil de publication pour ${destination} (INSEE: ${codeInsee}).`,
      niveau: "non_disponible",
    };
  }

  // --- ÉTAPE C : Calculs algorithmiques (pas de LLM) ---
  const taxeTotale = taxeData.totalTaxe;
  const compte7311 = taxeData.compte7311;
  const compte7321 = taxeData.compte7321;
  const volumeAffaires = taxeTotale * 25;
  const nuiteesEstimees = Math.round(taxeTotale / 1.5);
  const ratioPressionTouristique =
    Math.round((taxeTotale / population) * 100) / 100;

  // --- ÉTAPE D : Diagnostic narratif (LLM) ---
  const llmPrompt = `Agis comme un analyste économique touristique.
Voici les données financières pour la destination ${destination} :
- Taxe de séjour encaissée : ${taxeTotale.toLocaleString("fr-FR")} €
- Volume d'affaires estimé (Hébergement) : ${volumeAffaires.toLocaleString("fr-FR")} €
- Nuitées estimées : ${nuiteesEstimees.toLocaleString("fr-FR")}
- Population locale : ${population.toLocaleString("fr-FR")}
- Ratio pression touristique : ${ratioPressionTouristique} €/habitant
- Source : ${taxeData.source}

Tâche :
Rédige un paragraphe de diagnostic de 3-4 phrases orienté "opportunité commerciale" pour un élu.
- Si Volume d'Affaires > 10M€ : félicite pour la puissance économique, mentionne le poids dans l'économie locale
- Si ratio/habitant < 10€ : souligne que le tourisme est une manne sous-exploitée
- Si ratio/habitant > 50€ : souligne la dépendance économique au tourisme (risque et opportunité)
- Compare toujours à une moyenne nationale fictive de référence (15€/habitant) pour donner du relief

Sortie JSON stricte : { "diagnostic": "...", "niveau": "puissant | moyen | sous-exploite" }`;

  let diagnostic: string;
  let niveau: "puissant" | "moyen" | "sous-exploite";

  try {
    const llmResult = await trackApiCall({
      auditId,
      apiName: "openai",
      endpoint: "chat/completions",
      call: () =>
        askLLMJson<{ diagnostic: string; niveau: string }>(llmPrompt),
      estimateCost: () => {
        const tokens = Math.ceil(llmPrompt.length / 4);
        return (
          tokens * API_COSTS.openai.promptTokenCost +
          200 * API_COSTS.openai.completionTokenCost
        );
      },
    });
    diagnostic = llmResult.diagnostic;
    niveau = parseNiveau(llmResult.niveau);
  } catch {
    // Fallback algorithmique si LLM échoue
    const fallback = buildFallbackDiagnostic(
      destination,
      taxeTotale,
      volumeAffaires,
      nuiteesEstimees,
      ratioPressionTouristique
    );
    diagnostic = fallback.diagnostic;
    niveau = fallback.niveau;
  }

  return {
    taxeTotale,
    compte7311,
    compte7321,
    volumeAffaires,
    nuiteesEstimees,
    ratioPressionTouristique,
    source: taxeData.source,
    anneeReference: taxeData.anneeReference,
    diagnostic,
    niveau,
  };
}

function parseNiveau(
  raw: string
): "puissant" | "moyen" | "sous-exploite" {
  const normalized = raw.toLowerCase().replace(/[-_\s]/g, "");
  if (normalized.includes("puissant")) return "puissant";
  if (normalized.includes("sousexploit")) return "sous-exploite";
  return "moyen";
}

function buildFallbackDiagnostic(
  destination: string,
  taxeTotale: number,
  volumeAffaires: number,
  nuiteesEstimees: number,
  ratio: number
): { diagnostic: string; niveau: "puissant" | "moyen" | "sous-exploite" } {
  if (volumeAffaires > 10_000_000) {
    return {
      diagnostic: `${destination} génère un volume d'affaires hébergement estimé à ${(volumeAffaires / 1_000_000).toFixed(1)}M€, ce qui en fait une destination économiquement puissante. Avec ${nuiteesEstimees.toLocaleString("fr-FR")} nuitées estimées et un ratio de ${ratio}€/habitant (moyenne nationale : 15€), le tourisme représente un levier économique majeur.`,
      niveau: "puissant",
    };
  }
  if (ratio < 10) {
    return {
      diagnostic: `Avec seulement ${ratio}€ de taxe par habitant (contre 15€ en moyenne nationale), ${destination} présente un potentiel touristique sous-exploité. Le volume d'affaires hébergement estimé à ${(volumeAffaires / 1_000).toFixed(0)}k€ pour ${taxeTotale.toLocaleString("fr-FR")}€ de taxe perçue laisse entrevoir une marge de croissance significative.`,
      niveau: "sous-exploite",
    };
  }
  return {
    diagnostic: `${destination} perçoit ${taxeTotale.toLocaleString("fr-FR")}€ de taxe de séjour, soit un volume d'affaires hébergement estimé à ${(volumeAffaires / 1_000).toFixed(0)}k€ pour ${nuiteesEstimees.toLocaleString("fr-FR")} nuitées estimées. Le ratio de ${ratio}€/habitant est proche de la moyenne nationale (15€).`,
    niveau: "moyen",
  };
}
