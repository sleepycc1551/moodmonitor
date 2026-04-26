"use client";

import { useMemo, useState } from "react";
import { Download, FlaskConical, ListChecks } from "lucide-react";
import { buildEvaluationSummary } from "@/lib/clinician";
import { formatTime } from "@/lib/dateFormat";
import {
  buildJATCsv,
  buildJATExportPayload,
  computeAggregateJATMetrics,
} from "@/lib/jatMetrics";
import type { EvaluationEvent, JATTesterSubmission, PatientRecord } from "@/types";

interface EvaluationPanelProps {
  events: EvaluationEvent[];
  jatSubmissions: JATTesterSubmission[];
  onResetJATSubmissions: () => void;
  patients: PatientRecord[];
}

export function EvaluationPanel({
  events,
  jatSubmissions,
  onResetJATSubmissions,
  patients,
}: EvaluationPanelProps) {
  const [showJson, setShowJson] = useState(false);
  const summary = useMemo(() => buildEvaluationSummary(events), [events]);
  const serialized = useMemo(() => JSON.stringify(events, null, 2), [events]);
  const jatAggregate = useMemo(
    () => computeAggregateJATMetrics(patients, jatSubmissions),
    [jatSubmissions, patients],
  );
  const jatExportPayload = useMemo(
    () => buildJATExportPayload({ events, patients, submissions: jatSubmissions }),
    [events, jatSubmissions, patients],
  );

  function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function exportLog() {
    downloadFile("moodwatch-evaluation-log.json", serialized, "application/json");
  }

  function exportJATJson() {
    downloadFile(
      "moodwatch-test-results.json",
      JSON.stringify(jatExportPayload, null, 2),
      "application/json",
    );
  }

  function exportJATCsv() {
    downloadFile(
      "moodwatch-test-results.csv",
      buildJATCsv(patients, jatSubmissions),
      "text/csv",
    );
  }

  function resetSubmittedJudgments() {
    if (
      window.confirm(
        `Reset all ${jatSubmissions.length} submitted test judgments? This keeps patient data but clears tester judgments.`,
      )
    ) {
      onResetJATSubmissions();
    }
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Evaluation Mode</h2>
          <p className="text-sm text-slate-500">
            Local interaction logging for class demonstration and test comparison.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Test cases" value={`${jatAggregate.numberOfCases}`} />
        <MetricCard
          label="Completed judgments"
          value={`${jatAggregate.numberOfCompletedSubmissions}`}
        />
        <MetricCard
          label="Mean AI abs. error"
          value={formatMaybeNumber(jatAggregate.meanAbsoluteAiError)}
        />
        <MetricCard
          label="Mean tester abs. error"
          value={formatMaybeNumber(jatAggregate.meanAbsoluteTesterError)}
        />
        <MetricCard
          label="Mean action error"
          value={formatMaybeNumber(jatAggregate.meanActionError)}
        />
        <MetricCard
          label="Appropriate override rate"
          value={
            jatAggregate.appropriateOverrideRate === null
              ? "N/A"
              : `${Math.round(jatAggregate.appropriateOverrideRate * 100)}%`
          }
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Dashboard opened"
          value={
            summary.dashboardOpenedAt
              ? formatTime(summary.dashboardOpenedAt)
              : "Not yet"
          }
        />
        <MetricCard label="Patients reviewed" value={`${summary.patientsReviewed}`} />
        <MetricCard
          label="Urgent/elevated opened"
          value={`${summary.urgentOrElevatedPatientsOpened}`}
        />
        <MetricCard
          label="False alarms dismissed"
          value={`${summary.falseAlarmsDismissed}`}
        />
        <MetricCard
          label="Appointment requests processed"
          value={`${summary.appointmentRequestsProcessed}`}
        />
        <MetricCard label="Concern overrides" value={`${summary.concernOverrides}`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportJATJson}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
        >
          <Download className="h-4 w-4" />
          Export test results
        </button>
        <button
          type="button"
          onClick={exportJATCsv}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
        <button
          type="button"
          disabled={jatSubmissions.length === 0}
          onClick={resetSubmittedJudgments}
          className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
        >
          Reset all submitted test judgments
        </button>
        <button
          type="button"
          onClick={exportLog}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
        >
          <Download className="h-4 w-4" />
          Export Evaluation Log
        </button>
        <button
          type="button"
          onClick={() => setShowJson((value) => !value)}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
        >
          <ListChecks className="h-4 w-4" />
          {showJson ? "Hide JSON" : "Show JSON"}
        </button>
      </div>

      {showJson ? (
        <textarea
          readOnly
          value={serialized}
          rows={12}
          className="mt-4 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-700"
        />
      ) : null}
    </section>
  );
}

function formatMaybeNumber(value: number | null): string {
  return typeof value === "number" ? value.toFixed(2) : "N/A";
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
