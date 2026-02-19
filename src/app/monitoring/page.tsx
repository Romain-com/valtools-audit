"use client";

import { useEffect, useState } from "react";

interface ApiStats {
  count: number;
  cost: number;
}

interface AuditCall {
  api_name: string;
  endpoint: string | null;
  cost_euros: number;
  response_time_ms: number;
  status: string;
  tokens_used: number | null;
  created_at: string;
}

interface AuditData {
  audit_id: string;
  calls: AuditCall[];
  coutTotal: number;
}

interface Alerte {
  type: "danger" | "warning";
  message: string;
}

interface MonitoringData {
  global: {
    coutTotal: number;
    coutMoyenParAudit: number;
    nbAudits: number;
    nbAppelsTotal: number;
    appelsParApi: Record<string, ApiStats>;
    pourcentageLLM: number;
  };
  parAudit: AuditData[];
  alertes: Alerte[];
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/monitoring")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Erreur inconnue");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500">Chargement des donnees de monitoring...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-red-500">Erreur : {error || "Donnees indisponibles"}</p>
      </div>
    );
  }

  const { global, parAudit, alertes } = data;
  const selectedAuditData = selectedAudit
    ? parAudit.find((a) => a.audit_id === selectedAudit)
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Monitoring API — Valtools-audit
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Couts estimes — Les montants affiches sont des estimations basees sur les grilles tarifaires connues.
        </p>

        {/* Alertes */}
        {alertes.length > 0 && (
          <div className="mb-6 flex flex-col gap-2">
            {alertes.map((alerte, i) => (
              <div
                key={i}
                className={`rounded-lg px-4 py-3 text-sm font-medium ${
                  alerte.type === "danger"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                }`}
              >
                {alerte.type === "danger" ? "ALERTE" : "ATTENTION"} : {alerte.message}
              </div>
            ))}
          </div>
        )}

        {/* Vue globale */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Cout total cumule"
            value={`${global.coutTotal.toFixed(4)} EUR`}
          />
          <StatCard
            label="Cout moyen / audit"
            value={`${global.coutMoyenParAudit.toFixed(4)} EUR`}
          />
          <StatCard
            label="Nombre d'audits"
            value={String(global.nbAudits)}
          />
          <StatCard
            label="Appels API total"
            value={String(global.nbAppelsTotal)}
          />
        </div>

        {/* Appels par API */}
        <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Appels par API
        </h2>
        <div className="mb-8 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">API</th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Appels</th>
                <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">Cout estime</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(global.appelsParApi)
                .sort(([, a], [, b]) => b.cost - a.cost)
                .map(([api, stats]) => (
                  <tr
                    key={api}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-4 py-2 font-mono text-zinc-900 dark:text-zinc-100">
                      {api}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {stats.count}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {stats.cost.toFixed(4)} EUR
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* LLM % */}
        <div className="mb-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Part LLM (OpenAI + Gemini) dans le cout total :{" "}
            <span
              className={`font-semibold ${
                global.pourcentageLLM > 70
                  ? "text-orange-600"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {global.pourcentageLLM.toFixed(1)}%
            </span>
          </p>
        </div>

        {/* Vue par audit */}
        <h2 className="mb-3 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Detail par audit
        </h2>

        {parAudit.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun appel API enregistre.</p>
        ) : (
          <>
            {/* Sélecteur d'audit */}
            <div className="mb-4">
              <select
                value={selectedAudit || ""}
                onChange={(e) => setSelectedAudit(e.target.value || null)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">Selectionner un audit...</option>
                {parAudit.map((a) => (
                  <option key={a.audit_id} value={a.audit_id}>
                    {a.audit_id === "sans-audit"
                      ? "Sans audit"
                      : `${a.audit_id.slice(0, 8)}...`}{" "}
                    — {a.calls.length} appels — {a.coutTotal.toFixed(4)} EUR
                  </option>
                ))}
              </select>
            </div>

            {/* Tableau détaillé */}
            {selectedAuditData && (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 dark:bg-zinc-900">
                    <tr>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">API</th>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Endpoint</th>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Cout</th>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Temps (ms)</th>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Statut</th>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Tokens</th>
                      <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAuditData.calls.map((call, i) => (
                      <tr
                        key={i}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        <td className="px-3 py-2 font-mono text-zinc-900 dark:text-zinc-100">
                          {call.api_name}
                        </td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                          {call.endpoint || "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                          {call.cost_euros.toFixed(4)}
                        </td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                          {call.response_time_ms ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                              call.status === "success"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {call.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                          {call.tokens_used ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-500">
                          {new Date(call.created_at).toLocaleString("fr-FR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}
