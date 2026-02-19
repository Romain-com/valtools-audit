import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    // Vue globale : coût total, nombre d'appels par API
    const { data: allUsage, error: usageError } = await supabase
      .from("api_usage")
      .select("*")
      .order("created_at", { ascending: false });

    if (usageError) {
      return NextResponse.json(
        { success: false, error: usageError.message },
        { status: 500 }
      );
    }

    const rows = allUsage || [];

    // Coût total cumulé
    const coutTotal = rows.reduce(
      (sum, r) => sum + (parseFloat(r.cost_euros) || 0),
      0
    );

    // Nombre d'audits distincts
    const auditIds = new Set(rows.filter((r) => r.audit_id).map((r) => r.audit_id));
    const nbAudits = auditIds.size;
    const coutMoyenParAudit = nbAudits > 0 ? coutTotal / nbAudits : 0;

    // Appels par API
    const appelsParApi: Record<string, { count: number; cost: number }> = {};
    for (const row of rows) {
      if (!appelsParApi[row.api_name]) {
        appelsParApi[row.api_name] = { count: 0, cost: 0 };
      }
      appelsParApi[row.api_name].count++;
      appelsParApi[row.api_name].cost += parseFloat(row.cost_euros) || 0;
    }

    // Coût OpenAI en % du total
    const coutOpenai = (appelsParApi["openai"]?.cost || 0) + (appelsParApi["gemini"]?.cost || 0);
    const pourcentageLLM = coutTotal > 0 ? (coutOpenai / coutTotal) * 100 : 0;

    // Vue par audit
    const parAudit: Record<
      string,
      {
        audit_id: string;
        calls: Array<{
          api_name: string;
          endpoint: string | null;
          cost_euros: number;
          response_time_ms: number;
          status: string;
          tokens_used: number | null;
          created_at: string;
        }>;
        coutTotal: number;
      }
    > = {};

    for (const row of rows) {
      const aid = row.audit_id || "sans-audit";
      if (!parAudit[aid]) {
        parAudit[aid] = { audit_id: aid, calls: [], coutTotal: 0 };
      }
      parAudit[aid].calls.push({
        api_name: row.api_name,
        endpoint: row.endpoint,
        cost_euros: parseFloat(row.cost_euros) || 0,
        response_time_ms: row.response_time_ms,
        status: row.status,
        tokens_used: row.tokens_used,
        created_at: row.created_at,
      });
      parAudit[aid].coutTotal += parseFloat(row.cost_euros) || 0;
    }

    // Alertes
    const alertes: Array<{ type: "danger" | "warning"; message: string }> = [];

    for (const [aid, data] of Object.entries(parAudit)) {
      if (data.coutTotal > 2) {
        alertes.push({
          type: "danger",
          message: `Audit ${aid.slice(0, 8)}... a coute ${data.coutTotal.toFixed(4)} EUR (> 2 EUR)`,
        });
      }
    }

    if (pourcentageLLM > 70) {
      alertes.push({
        type: "warning",
        message: `LLM (OpenAI+Gemini) represente ${pourcentageLLM.toFixed(1)}% du cout total (> 70%)`,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        global: {
          coutTotal: Math.round(coutTotal * 1000000) / 1000000,
          coutMoyenParAudit: Math.round(coutMoyenParAudit * 1000000) / 1000000,
          nbAudits,
          nbAppelsTotal: rows.length,
          appelsParApi,
          pourcentageLLM: Math.round(pourcentageLLM * 10) / 10,
        },
        parAudit: Object.values(parAudit),
        alertes,
      },
    });
  } catch (error) {
    console.error("[Monitoring] Erreur:", error);
    return NextResponse.json(
      { success: false, error: "Erreur lors de la recuperation des donnees de monitoring" },
      { status: 500 }
    );
  }
}
