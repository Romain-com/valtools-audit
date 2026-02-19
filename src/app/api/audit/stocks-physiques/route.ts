import { NextRequest, NextResponse } from "next/server";
import { runStocksPhysiques } from "@/services/stocks-physiques.service";
import { supabase } from "@/lib/supabase";
import type { StocksPhysiquesInput } from "@/types/audit";

export async function POST(request: NextRequest) {
  try {
    const body: StocksPhysiquesInput = await request.json();

    if (!body.destination || !body.codeInsee) {
      return NextResponse.json(
        { error: "Les champs 'destination' et 'codeInsee' sont requis." },
        { status: 400 }
      );
    }

    let auditId: string | null = null;
    try {
      const { data: audit } = await supabase
        .from("audits")
        .insert({ destination: body.destination, code_insee: body.codeInsee, status: "running" })
        .select("id")
        .single();
      auditId = audit?.id || null;
    } catch { console.warn("[Stocks Physiques] Supabase non disponible"); }

    const result = await runStocksPhysiques(body);

    if (auditId) {
      try {
        await supabase.from("audit_results").insert({ audit_id: auditId, module: "stocks-physiques", data: result });
        await supabase.from("audits").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", auditId);
      } catch { console.warn("[Stocks Physiques] Échec sauvegarde Supabase"); }
    }

    return NextResponse.json({ success: true, module: "stocks-physiques", destination: body.destination, data: result, audit_id: auditId });
  } catch (error) {
    console.error("[Stocks Physiques] Erreur:", error);
    return NextResponse.json({ success: false, module: "stocks-physiques", error: error instanceof Error ? error.message : "Erreur interne" }, { status: 500 });
  }
}
