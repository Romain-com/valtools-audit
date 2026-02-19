import { NextRequest, NextResponse } from "next/server";
import { runAuditSeo } from "@/services/seo.service";
import { supabase } from "@/lib/supabase";
import type { AuditSeoInput } from "@/types/audit";

export async function POST(request: NextRequest) {
  try {
    const body: AuditSeoInput = await request.json();

    if (!body.destination || !body.urlOT) {
      return NextResponse.json(
        { error: "Les champs 'destination' et 'urlOT' sont requis." },
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
      console.warn("[SEO] Supabase non disponible");
    }

    const result = await runAuditSeo(body, auditId);

    if (auditId) {
      try {
        await supabase.from("audit_results").insert({
          audit_id: auditId, module: "seo", data: result,
        });
        await supabase.from("audits")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", auditId);
      } catch { console.warn("[SEO] Échec sauvegarde Supabase"); }
    }

    return NextResponse.json({
      success: true, module: "seo", destination: body.destination,
      data: result, audit_id: auditId,
    });
  } catch (error) {
    console.error("[SEO] Erreur:", error);
    return NextResponse.json(
      { success: false, module: "seo", error: error instanceof Error ? error.message : "Erreur interne" },
      { status: 500 }
    );
  }
}
