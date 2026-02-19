import { NextRequest, NextResponse } from "next/server";
import { runNotoriete } from "@/services/notoriete.service";
import { supabase } from "@/lib/supabase";
import type { NotorieteInput } from "@/types/audit";

export async function POST(request: NextRequest) {
  let auditId: string | null = null;

  try {
    const body: NotorieteInput = await request.json();

    // Validation input
    if (!body.destination || !body.codePostal || !body.codeInsee) {
      return NextResponse.json(
        { error: "Les champs 'destination', 'codePostal' et 'codeInsee' sont requis." },
        { status: 400 }
      );
    }

    // Créer l'audit dans Supabase
    try {
      const { data: audit } = await supabase
        .from("audits")
        .insert({
          destination: body.destination,
          code_insee: body.codeInsee,
          status: "running",
        })
        .select("id")
        .single();
      auditId = audit?.id || null;
    } catch {
      console.warn("[Notoriété] Supabase non disponible, mode sans persistance");
    }

    // Exécuter le module Notoriété
    const result = await runNotoriete(body, auditId);

    // Sauvegarder le résultat dans Supabase
    if (auditId) {
      try {
        await supabase.from("audit_results").insert({
          audit_id: auditId,
          module: "notoriete",
          data: result,
        });
        await supabase
          .from("audits")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", auditId);
      } catch {
        console.warn("[Notoriété] Échec sauvegarde Supabase");
      }
    }

    return NextResponse.json({
      success: true,
      module: "notoriete",
      destination: body.destination,
      data: result,
      audit_id: auditId,
    });
  } catch (error) {
    console.error("[Notoriété] Erreur:", error);

    // Mettre à jour le statut en erreur si possible
    if (auditId) {
      try {
        await supabase
          .from("audits")
          .update({ status: "error" })
          .eq("id", auditId);
      } catch {
        // Silencieux
      }
    }

    const message =
      error instanceof Error ? error.message : "Erreur interne";

    return NextResponse.json(
      {
        success: false,
        module: "notoriete",
        error: message,
      },
      { status: 500 }
    );
  }
}
