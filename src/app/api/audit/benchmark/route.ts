import { NextRequest, NextResponse } from "next/server";
import { runBenchmark } from "@/services/benchmark.service";
import { supabase } from "@/lib/supabase";
import type { BenchmarkInput } from "@/types/audit";

export async function POST(request: NextRequest) {
  try {
    const body: BenchmarkInput = await request.json();

    if (!body.destination || !body.codeInsee || !body.departement) {
      return NextResponse.json(
        { error: "Les champs 'destination', 'codeInsee', 'population' et 'departement' sont requis." },
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
    } catch { console.warn("[Benchmark] Supabase non disponible"); }

    const result = await runBenchmark(body, auditId);

    if (auditId) {
      try {
        await supabase.from("audit_results").insert({ audit_id: auditId, module: "benchmark", data: result });
        await supabase.from("audits").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", auditId);
      } catch { console.warn("[Benchmark] Échec sauvegarde Supabase"); }
    }

    return NextResponse.json({ success: true, module: "benchmark", destination: body.destination, data: result, audit_id: auditId });
  } catch (error) {
    console.error("[Benchmark] Erreur:", error);
    return NextResponse.json({ success: false, module: "benchmark", error: error instanceof Error ? error.message : "Erreur interne" }, { status: 500 });
  }
}
