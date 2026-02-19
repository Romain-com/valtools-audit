import { NextRequest, NextResponse } from "next/server";
import { runSchemaDigital } from "@/services/schema-digital.service";
import { supabase } from "@/lib/supabase";
import type { SchemaDigitalInput } from "@/types/audit";

export async function POST(request: NextRequest) {
  try {
    const body: SchemaDigitalInput = await request.json();

    if (!body.destination) {
      return NextResponse.json(
        { error: "Le champ 'destination' est requis." },
        { status: 400 }
      );
    }

    let auditId: string | null = null;
    try {
      const { data: audit } = await supabase
        .from("audits")
        .insert({ destination: body.destination, status: "running" })
        .select("id")
        .single();
      auditId = audit?.id || null;
    } catch {
      console.warn("[Schéma Digital] Supabase non disponible");
    }

    const result = await runSchemaDigital(body);

    if (auditId) {
      try {
        await supabase.from("audit_results").insert({
          audit_id: auditId,
          module: "schema-digital",
          data: result,
        });
        await supabase
          .from("audits")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", auditId);
      } catch {
        console.warn("[Schéma Digital] Échec sauvegarde Supabase");
      }
    }

    return NextResponse.json({
      success: true,
      module: "schema-digital",
      destination: body.destination,
      data: result,
      audit_id: auditId,
    });
  } catch (error) {
    console.error("[Schéma Digital] Erreur:", error);
    return NextResponse.json(
      {
        success: false,
        module: "schema-digital",
        error: error instanceof Error ? error.message : "Erreur interne",
      },
      { status: 500 }
    );
  }
}
