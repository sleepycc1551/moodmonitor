"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { MiniTrendChart } from "@/components/Charts";
import {
  buildClinicianViewPatientSummary,
  buildPatientSparklineSeries,
  filterPatientSummaries,
  sortPatientSummaries,
  type ClinicianFilterOption,
  type ClinicianSortOption,
} from "@/lib/clinician";
import { formatDateTime } from "@/lib/dateFormat";
import {
  formatActionStatus,
  formatConcernLabel,
  formatDataQualityLevel,
  formatEvidenceStrength,
} from "@/lib/riskEngine";
import type { PatientRecord } from "@/types";

interface ClinicianDashboardProps {
  aiEnabled: boolean;
  highlightedPatientIds: string[];
  onSelectPatient: (patientId: string) => void;
  patients: PatientRecord[];
  selectedPatientId?: string;
}

export function ClinicianDashboard({
  aiEnabled,
  highlightedPatientIds,
  onSelectPatient,
  patients,
  selectedPatientId,
}: ClinicianDashboardProps) {
  const [filter, setFilter] = useState<ClinicianFilterOption>("all");
  const [sortBy, setSortBy] = useState<ClinicianSortOption>("ai-concern");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const summaries = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase();
    const effectiveFilter =
      !aiEnabled &&
      ["stable", "watch", "elevated", "urgent", "ai-flagged"].includes(filter)
        ? "all"
        : filter;

    const filteredPatients = filterPatientSummaries(
      patients,
      effectiveFilter as ClinicianFilterOption,
      aiEnabled,
    ).filter((patient) => {
      if (!normalizedQuery) return true;

      return (
        patient.profile.name.toLowerCase().includes(normalizedQuery) ||
        patient.profile.id.toLowerCase().includes(normalizedQuery)
      );
    });

    return sortPatientSummaries(
      filteredPatients.map((patient) => buildClinicianViewPatientSummary(patient, aiEnabled)),
      sortBy,
      aiEnabled,
    );
  }, [aiEnabled, deferredSearch, filter, patients, sortBy]);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Patient Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Prioritize review by concern level, appointments, and completeness of recent data.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {aiEnabled ? "AI-estimated concern visible" : "Manual review mode"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-10 py-3 text-sm outline-none transition focus:border-sky-500"
            placeholder="Search patient name"
          />
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
          <span className="whitespace-nowrap">Sort by</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as ClinicianSortOption)}
            className="w-full bg-transparent outline-none"
          >
            <option value="ai-concern">AI-estimated concern</option>
            <option value="last-check-in">Last check-in time</option>
            <option value="appointment-status">Appointment status</option>
            <option value="data-quality">Data quality</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { label: "All", value: "all" as ClinicianFilterOption, requiresAi: false },
          { label: "Stable", value: "stable" as ClinicianFilterOption, requiresAi: true },
          { label: "Watch", value: "watch" as ClinicianFilterOption, requiresAi: true },
          { label: "Elevated", value: "elevated" as ClinicianFilterOption, requiresAi: true },
          { label: "Urgent", value: "urgent" as ClinicianFilterOption, requiresAi: true },
          { label: "AI flagged", value: "ai-flagged" as ClinicianFilterOption, requiresAi: true },
          {
            label: "Appointment requested",
            value: "appointment-requested" as ClinicianFilterOption,
            requiresAi: false,
          },
          {
            label: "Needs review",
            value: "needs-review" as ClinicianFilterOption,
            requiresAi: false,
          },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={!aiEnabled && item.requiresAi}
            onClick={() => setFilter(item.value)}
            className={`rounded-full px-3 py-2 text-xs font-medium transition ${
              filter === item.value
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {summaries.map((summary) => {
          const highlighted = highlightedPatientIds.includes(summary.patientId);
          const selected = summary.patientId === selectedPatientId;
          const concernScore = summary.aiEstimatedConcernScore ?? 0;
          const concernLabel = summary.aiEstimatedConcernLevel
            ? formatConcernLabel(summary.aiEstimatedConcernLevel)
            : "Hidden";
          const concernHighSalience = concernScore >= 7;
          const ConcernIcon = getConcernIcon(summary.aiEstimatedConcernLevel);
          const concernIconClass = getConcernIconClass(summary.aiEstimatedConcernLevel);

          return (
            <button
              key={summary.patientId}
              type="button"
              onClick={() => onSelectPatient(summary.patientId)}
              className={`w-full rounded-[1.75rem] border p-4 text-left shadow-sm transition ${
                selected
                  ? "border-sky-500 bg-sky-50"
                  : highlighted
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50"
              }`}
            >
              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.95fr_0.9fr]">
                <div className="min-w-0 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">
                      {summary.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-950">
                          {summary.name}
                        </h3>
                        {summary.age ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            Age {summary.age}
                          </span>
                        ) : null}
                        {summary.clinicianConfirmedConcernLevel ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800">
                            Confirmed{" "}
                            {summary.clinicianConfirmedConcernScore
                              ? `${summary.clinicianConfirmedConcernScore} `
                              : ""}
                            {formatConcernLabel(summary.clinicianConfirmedConcernLevel)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Last check-in{" "}
                        {summary.lastCheckInAt
                          ? formatDateTime(summary.lastCheckInAt)
                          : "not available"}
                      </p>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-sm leading-6 text-slate-700">
                    {summary.keyReason}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {aiEnabled ? (
                    <>
                      <SummaryMetric
                        highSalience={concernHighSalience}
                        label="AI-estimated concern"
                        value={`${concernScore}  ${concernLabel}`}
                        icon={
                          ConcernIcon ? (
                            <ConcernIcon className={`h-4 w-4 ${concernIconClass}`} />
                          ) : undefined
                        }
                      />
                      <SummaryMetric
                        label="Evidence strength"
                        value={formatEvidenceStrength(summary.evidenceStrength ?? "low")}
                        icon={<Sparkles className="h-4 w-4 text-sky-600" />}
                      />
                    </>
                  ) : (
                    <>
                      <SummaryMetric
                        label="Review mode"
                        value="AI assistance off"
                        icon={<CheckCircle2 className="h-4 w-4 text-slate-500" />}
                      />
                      <SummaryMetric
                        label="Clinician concern"
                        value={
                          summary.clinicianConfirmedConcernLevel
                            ? `${
                                summary.clinicianConfirmedConcernScore
                                  ? `${summary.clinicianConfirmedConcernScore}  `
                                  : ""
                              }${formatConcernLabel(summary.clinicianConfirmedConcernLevel)}`
                            : "Not assigned"
                        }
                      />
                    </>
                  )}
                  <SummaryMetric
                    label="Data quality"
                    value={formatDataQualityLevel(summary.dataQuality.level)}
                  />
                  <SummaryMetric
                    label="Action status"
                    value={formatActionStatus(summary.actionStatus)}
                  />
                </div>

                <div className="space-y-2">
                  <TrendTile
                    alarming={summary.sleepTrendConcerning}
                    baseline={summary.sleepBaseline}
                    color="#0f766e"
                    label="Sleep"
                    values={summary.sleepSparkline}
                  />
                  <TrendTile
                    alarming={summary.moodTrendConcerning}
                    baseline={summary.moodBaseline}
                    color="#0f766e"
                    label="Mood"
                    values={summary.moodSparkline}
                  />
                  <TrendTile
                    alarming={summary.energyTrendConcerning}
                    baseline={summary.energyBaseline}
                    color="#0f766e"
                    label="Energy"
                    values={summary.energySparkline}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {summaries.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No patients match the current search or filter.
        </div>
      ) : null}
    </section>
  );
}

function getConcernIcon(level: PatientRecord["latestRisk"]["concernLevel"] | undefined) {
  if (level === "urgent" || level === "elevated") return AlertTriangle;
  if (level === "watch") return Info;
  if (level === "stable") return CheckCircle2;
  return undefined;
}

function getConcernIconClass(level: PatientRecord["latestRisk"]["concernLevel"] | undefined) {
  if (level === "urgent") return "text-red-700";
  if (level === "elevated") return "text-orange-700";
  if (level === "watch") return "text-sky-700";
  return "text-teal-700";
}

function SummaryMetric({
  highSalience,
  icon,
  label,
  value,
}: {
  highSalience?: boolean;
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div
        className={`mt-2 flex items-center gap-2 text-sm font-semibold ${
          highSalience ? "text-red-700" : "text-slate-800"
        }`}
      >
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}

function TrendTile({
  alarming,
  baseline,
  color,
  label,
  values,
}: {
  alarming: boolean;
  baseline: number;
  color: string;
  label: string;
  values: number[];
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="text-[10px] text-slate-400">Baseline</div>
      </div>
      <MiniTrendChart
        alarming={alarming}
        baseline={baseline}
        color={color}
        data={buildPatientSparklineSeries(values)}
        dataKey="value"
        heightClassName="h-12"
      />
    </div>
  );
}
