import { NextRequest, NextResponse } from "next/server";
import { runStocksCommerciaux } from "@/services/stocks-commerciaux.service";
import { supabase } from "@/lib/supabase";
import type { StocksCommerciauxInput } from "@/types/audit";

export async function POST(request: NextRequest) {
  try {
    const body: StocksCommerciauxInput = await request.json();

    if (!body.destination || !body.stocksPhysiques) {
      return NextResponse.json(
        { error: "Les champs 'destination' et 'stocksPhysiques' sont requis." },
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
    } catch { console.warn("[Stocks Commerciaux] Supabase non disponible"); }

    const result = await runStocksCommerciaux(body);

    if (auditId) {
      try {
        await supabase.from("audit_results").insert({ audit_id: auditId, module: "stocks-commerciaux", data: result });
        await supabase.from("audits").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", auditId);
      } catch { console.warn("[Stocks Commerciaux] Échec sauvegarde Supabase"); }
    }

    return NextResponse.json({ success: true, module: "stocks-commerciaux", destination: body.destination, data: result, audit_id: auditId });
  } catch (error) {
    console.error("[Stocks Commerciaux] Erreur:", error);
    return NextResponse.json({ success: false, module: "stocks-commerciaux", error: error instanceof Error ? error.message : "Erreur interne" }, { status: 500 });
  }
}
