import { NextRequest, NextResponse } from "next/server";
import { runVolumeAffaires } from "@/services/volume-affaires.service";
import { supabase } from "@/lib/supabase";
import type { VolumeAffairesInput } from "@/types/audit";

export async function POST(request: NextRequest) {
  try {
    const body: VolumeAffairesInput = await request.json();

    if (!body.destination || !body.codeInsee) {
      return NextResponse.json(
        { error: "Les champs 'destination' et 'codeInsee' sont requis." },
        { status: 400 }
      );
    }

    // Persistance Supabase (optionnelle)
    let auditId: string | null = null;
    try {
      const { data: audit } = await supabase
        .from("audits")
        .insert({ destination: body.destination, code_insee: body.codeInsee, status: "running" })
        .select("id")
        .single();
      auditId = audit?.id || null;
    } catch {
      console.warn("[Volume Affaires] Supabase non disponible");
    }

    const result = await runVolumeAffaires(body, auditId);

    if (auditId) {
      try {
        await supabase.from("audit_results").insert({
          audit_id: auditId,
          module: "volume-affaires",
          data: result,
        });
        await supabase
          .from("audits")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", auditId);
      } catch {
        console.warn("[Volume Affaires] Échec sauvegarde Supabase");
      }
    }

    return NextResponse.json({
      success: true,
      module: "volume-affaires",
      destination: body.destination,
      data: result,
      audit_id: auditId,
    });
  } catch (error) {
    console.error("[Volume Affaires] Erreur:", error);
    return NextResponse.json(
      {
        success: false,
        module: "volume-affaires",
        error: error instanceof Error ? error.message : "Erreur interne",
      },
      { status: 500 }
    );
  }
}
