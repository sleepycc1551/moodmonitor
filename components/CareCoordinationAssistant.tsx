"use client";

import { useState } from "react";
import { Bot, Power, Search, Sparkles } from "lucide-react";
import { formatConcernLabel } from "@/lib/riskEngine";
import type { ClinicianAssistantResponse, PatientRecord } from "@/types";

interface CareCoordinationAssistantProps {
  aiEnabled: boolean;
  isLoading: boolean;
  onRunQuery: (query: string) => Promise<void>;
  onToggleAiEnabled: (nextValue: boolean) => void;
  patients: PatientRecord[];
  response: ClinicianAssistantResponse;
}

const quickPrompts = [
  "Highest concern patients",
  "Escalating patients",
  "Appointment requests",
  "Low sleep patterns",
  "Low data quality",
  "Patients not checked in today",
];

export function CareCoordinationAssistant({
  aiEnabled,
  isLoading,
  onRunQuery,
  onToggleAiEnabled,
  patients,
  response,
}: CareCoordinationAssistantProps) {
  const [query, setQuery] = useState("");
  const patientById = new Map(patients.map((patient) => [patient.profile.id, patient]));

  function patientNameFor(reference: string): { debugId?: string; name: string } {
    const byId = patientById.get(reference);
    if (byId) return { debugId: reference, name: byId.profile.name };

    const byName = patients.find(
      (patient) => patient.profile.name.toLowerCase() === reference.toLowerCase(),
    );
    if (byName) return { debugId: byName.profile.id, name: byName.profile.name };

    return { debugId: reference, name: "Unknown patient" };
  }

  function replacePatientIds(text: string): string {
    return patients.reduce(
      (current, patient) => current.replaceAll(patient.profile.id, patient.profile.name),
      text,
    );
  }

  function formatAssistantAction(action: string): string {
    const label = action.replaceAll("_", " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Care Coordination Assistant
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Workflow support only. Recommendations do not replace clinician judgment.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
          <Power className="h-4 w-4" />
          AI assistance
          <button
            type="button"
            aria-pressed={aiEnabled}
            onClick={() => onToggleAiEnabled(!aiEnabled)}
            className={`relative h-7 w-12 rounded-full transition ${
              aiEnabled ? "bg-sky-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                aiEnabled ? "left-6" : "left-1"
              }`}
            />
          </button>
          <span>{aiEnabled ? "ON" : "OFF"}</span>
        </label>
      </div>

      {aiEnabled ? (
        <>
          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Search or ask
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Show highest concern patients"
                  className="w-full rounded-2xl border border-slate-300 px-10 py-3 text-sm outline-none transition focus:border-sky-500"
                />
              </div>
              <button
                type="button"
                disabled={!query.trim() || isLoading}
                onClick={async () => {
                  if (!query.trim()) return;
                  await onRunQuery(query.trim());
                }}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Ask
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Try: &quot;Who needs review today?&quot;, &quot;Summarize Jordan Rivera&apos;s last 7 days&quot;, or
              &quot;Find patients with low sleep.&quot;
            </p>
          </div>

          <div className="mt-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Quick action prompts
            </div>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isLoading}
                  onClick={async () => onRunQuery(prompt)}
                  className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-3xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Sparkles className="h-4 w-4 text-sky-600" />
              Assistant output
            </div>
            {isLoading ? (
              <p className="mt-3 text-sm leading-6 text-sky-700">
                The clinician assistant is reviewing the shared patient summaries...
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {replacePatientIds(response.response)}
                </p>

                {response.patientsMentioned.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {response.patientsMentioned.map((reference) => {
                      const patient = patientNameFor(reference);

                      return (
                        <span
                          key={reference}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {patient.name}
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                {response.recommendedActions.length ? (
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Recommended actions
                    </div>
                    <div className="mt-3 space-y-2">
                      {response.recommendedActions.map((action, index) => {
                        const patient = patientNameFor(action.patientId);

                        return (
                          <div
                            key={`${action.patientId}-${index}`}
                            className="rounded-2xl bg-white p-3 text-sm text-slate-700"
                          >
                            <div className="font-medium text-slate-900">{patient.name}</div>
                            {patient.name === "Unknown patient" && patient.debugId ? (
                              <div className="mt-1 break-all text-xs text-slate-400">
                                {patient.debugId}
                              </div>
                            ) : null}
                            <div className="mt-1 text-xs font-medium text-slate-500">
                              {formatAssistantAction(action.action)}
                            </div>
                            <p className="mt-2 leading-6">
                              {replacePatientIds(action.rationale)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {response.alertsToCreate.length ? (
                  <div className="mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Suggested alerts
                    </div>
                    <div className="mt-3 space-y-2">
                      {response.alertsToCreate.map((alert, index) => {
                        const patient = patientNameFor(alert.patientId);

                        return (
                          <div
                            key={`${alert.patientId}-${index}`}
                            className="rounded-2xl bg-white p-3 text-sm text-slate-700"
                          >
                            <div className="font-medium text-slate-900">
                              {patient.name} - {formatConcernLabel(alert.concernLevel)}
                            </div>
                            {patient.name === "Unknown patient" && patient.debugId ? (
                              <div className="mt-1 break-all text-xs text-slate-400">
                                {patient.debugId}
                              </div>
                            ) : null}
                            <p className="mt-2 leading-6">
                              {replacePatientIds(alert.reason)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {response.draftMessageToPatient ? (
                  <div className="mt-4 rounded-2xl bg-white p-3 text-sm text-slate-700">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Draft message to patient
                    </div>
                    <p className="mt-2 leading-6">
                      {replacePatientIds(response.draftMessageToPatient)}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          AI assistance is turned off for this evaluation condition. The patient overview and
          detailed view will show raw summaries, shared data, and clinician-entered information
          without AI-estimated concern or assistant recommendations.
        </div>
      )}
    </section>
  );
}
