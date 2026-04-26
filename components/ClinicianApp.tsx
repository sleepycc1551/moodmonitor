"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { CareCoordinationAssistant } from "@/components/CareCoordinationAssistant";
import { ClinicianDashboard } from "@/components/ClinicianDashboard";
import { ClinicianSchedulePanel } from "@/components/ClinicianSchedulePanel";
import { EvaluationPanel } from "@/components/EvaluationPanel";
import { PatientDetail } from "@/components/PatientDetail";
import {
  flattenPendingAppointmentRequests,
  flattenTodaysAppointments,
} from "@/lib/clinician";
import type {
  ClinicianAssistantResponse,
  ClinicianOverrideReason,
  ConcernLevel,
  EvaluationEvent,
  JATTesterAction,
  JATTesterSubmission,
  PatientRecord,
} from "@/types";

interface ClinicianAppProps {
  aiEnabled: boolean;
  evaluationLog: EvaluationEvent[];
  jatSubmissions: JATTesterSubmission[];
  onApproveAppointment: (patientId: string, requestId: string) => void;
  onChangeConcernLevel: (
    patientId: string,
    input: {
      clinicianConcernLevel: ConcernLevel;
      clinicianConcernScore: number;
      note: string;
      reason: ClinicianOverrideReason;
    },
  ) => void;
  onEscalateCare: (patientId: string, note: string) => void;
  onLogAssistantQuery: (query: string, highlightedPatientIds: string[]) => void;
  onLogPatientPanelViewed: (patientId: string, panelId: string) => void;
  onMarkReviewed: (patientId: string) => void;
  onRequestAppointmentInfo: (patientId: string, requestId: string) => void;
  onRequestFollowUpCheckIn: (patientId: string) => void;
  onReviewAppointmentRequest: (patientId: string, requestId: string) => void;
  onSelectPatient: (patientId: string) => void;
  onSendSupportiveMessage: (patientId: string, message: string) => void;
  onResetJATSubmissions: () => void;
  onSubmitJATJudgment: (
    patientId: string,
    input: {
      agreedWithAI: boolean;
      openedDetailView?: boolean;
      testerAction: JATTesterAction;
      testerConfidence: number;
      testerConcernScore: number;
      testerNote?: string;
      timeToDecisionMs?: number;
      viewedPanels?: string[];
    },
  ) => void;
  onToggleAiEnabled: (nextValue: boolean) => void;
  patients: PatientRecord[];
  selectedPatientId?: string;
}

const defaultAssistantResponse: ClinicianAssistantResponse = {
  response:
    "Ask for highest concern patients, appointment requests, low sleep patterns, or a seven-day summary for a named patient.",
  patientsMentioned: [],
  recommendedActions: [],
  alertsToCreate: [],
  draftMessageToPatient: "",
};

export function ClinicianApp({
  aiEnabled,
  evaluationLog,
  jatSubmissions,
  onApproveAppointment,
  onChangeConcernLevel,
  onEscalateCare,
  onLogAssistantQuery,
  onLogPatientPanelViewed,
  onMarkReviewed,
  onRequestAppointmentInfo,
  onRequestFollowUpCheckIn,
  onReviewAppointmentRequest,
  onSelectPatient,
  onSendSupportiveMessage,
  onResetJATSubmissions,
  onSubmitJATJudgment,
  onToggleAiEnabled,
  patients,
  selectedPatientId,
}: ClinicianAppProps) {
  const [viewMode, setViewMode] = useState<"dashboard" | "detail">("dashboard");
  const [detailPatientId, setDetailPatientId] = useState<string | undefined>(selectedPatientId);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantResponse, setAssistantResponse] =
    useState<ClinicianAssistantResponse>(defaultAssistantResponse);
  const [detailOpenedAt, setDetailOpenedAt] = useState<number>(0);
  const dashboardScrollPosition = useRef(0);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.profile.id === selectedPatientId) ?? patients[0],
    [patients, selectedPatientId],
  );
  const detailPatient = useMemo(
    () =>
      patients.find((patient) => patient.profile.id === detailPatientId) ??
      selectedPatient,
    [detailPatientId, patients, selectedPatient],
  );

  const todayAppointments = useMemo(() => flattenTodaysAppointments(patients), [patients]);
  const pendingRequests = useMemo(
    () => flattenPendingAppointmentRequests(patients),
    [patients],
  );
  const highlightedPatientIds = useMemo(() => {
    const ids = new Set<string>();

    assistantResponse.recommendedActions.forEach((action) => {
      if (action.patientId) ids.add(action.patientId);
    });

    assistantResponse.alertsToCreate.forEach((alert) => {
      if (alert.patientId) ids.add(alert.patientId);
    });

    assistantResponse.patientsMentioned.forEach((mentioned) => {
      const matchingPatient = patients.find(
        (patient) =>
          patient.profile.id === mentioned ||
          patient.profile.name.toLowerCase() === mentioned.toLowerCase(),
      );

      if (matchingPatient) ids.add(matchingPatient.profile.id);
    });

    return [...ids];
  }, [assistantResponse, patients]);

  async function runAssistantQuery(query: string) {
    setAssistantLoading(true);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "clinician",
          query,
          patients,
          selectedPatientId,
        }),
      });

      if (!response.ok) {
        throw new Error("Clinician Gemini request failed.");
      }

      const payload = (await response.json()) as ClinicianAssistantResponse;
      setAssistantResponse(payload);

      const nextHighlightedIds = new Set<string>();
      payload.recommendedActions.forEach((action) => {
        if (action.patientId) nextHighlightedIds.add(action.patientId);
      });
      payload.alertsToCreate.forEach((alert) => {
        if (alert.patientId) nextHighlightedIds.add(alert.patientId);
      });
      payload.patientsMentioned.forEach((mentioned) => {
        const matchingPatient = patients.find(
          (patient) =>
            patient.profile.id === mentioned ||
            patient.profile.name.toLowerCase() === mentioned.toLowerCase(),
        );
        if (matchingPatient) nextHighlightedIds.add(matchingPatient.profile.id);
      });

      onLogAssistantQuery(query, [...nextHighlightedIds]);
    } catch (error) {
      console.error(error);
      setAssistantResponse({
        response:
          "The clinician assistant could not reach Gemini just now. Continue manual review using the dashboard and patient detail panels.",
        patientsMentioned: [],
        recommendedActions: [],
        alertsToCreate: [],
        draftMessageToPatient: "",
      });
      onLogAssistantQuery(query, []);
    } finally {
      setAssistantLoading(false);
    }
  }

  function openPatientDetail(patientId: string) {
    if (typeof window !== "undefined") {
      dashboardScrollPosition.current = window.scrollY;
      window.scrollTo({ top: 0 });
    }

    setDetailPatientId(patientId);
    setDetailOpenedAt(Date.now());
    onSelectPatient(patientId);
    setViewMode("detail");
  }

  function returnToDashboard() {
    setViewMode("dashboard");

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: dashboardScrollPosition.current });
      });
    }
  }

  if (viewMode === "detail" && detailPatient) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={returnToDashboard}
          className="sticky top-3 z-30 inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white/95 px-4 py-3 text-sm font-medium text-slate-700 shadow-lg shadow-slate-200/70 backdrop-blur transition hover:border-sky-400 hover:bg-sky-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clinician Dashboard
        </button>

        <PatientDetail
          key={`${detailPatient.profile.id}-${aiEnabled ? "ai-on" : "ai-off"}`}
          aiEnabled={aiEnabled}
          onApproveAppointment={(requestId) =>
            onApproveAppointment(detailPatient.profile.id, requestId)
          }
          onChangeConcernLevel={(input) =>
            onChangeConcernLevel(detailPatient.profile.id, input)
          }
          onEscalateCare={(note) => onEscalateCare(detailPatient.profile.id, note)}
          onMarkReviewed={() => onMarkReviewed(detailPatient.profile.id)}
          onRequestAppointmentInfo={(requestId) =>
            onRequestAppointmentInfo(detailPatient.profile.id, requestId)
          }
          onRequestFollowUpCheckIn={() =>
            onRequestFollowUpCheckIn(detailPatient.profile.id)
          }
          onReviewAppointmentRequest={(requestId) =>
            onReviewAppointmentRequest(detailPatient.profile.id, requestId)
          }
          onResetJATSubmissions={onResetJATSubmissions}
          onSendSupportiveMessage={(message) =>
            onSendSupportiveMessage(detailPatient.profile.id, message)
          }
          onPanelViewed={(panelId) =>
            onLogPatientPanelViewed(detailPatient.profile.id, panelId)
          }
          onSubmitJATJudgment={(input) =>
            onSubmitJATJudgment(detailPatient.profile.id, input)
          }
          patient={detailPatient}
          detailOpenedAt={detailOpenedAt}
          latestJATSubmission={jatSubmissions
            .filter((submission) => submission.patientId === detailPatient.profile.id)
            .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
            .at(-1)}
          testSubmissionCount={jatSubmissions.length}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_#dbeafe,_#ffffff_55%,_#f8fafc)] p-6 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Clinician App
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          The clinician dashboard supports desktop triage, review, care coordination, and human
          override of AI recommendations. This prototype is for research and interface design
          only.
        </p>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {[
          "Prototype only - not a medical device.",
          "AI recommendations are decision support only. Clinicians remain responsible for final judgment.",
          "Wearable and phone summaries may be incomplete or noisy. Raw private content is hidden by default.",
        ].map((note) => (
          <div
            key={note}
            className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>{note}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.2fr_0.88fr]">
        <ClinicianSchedulePanel
          onApproveAppointment={onApproveAppointment}
          onMarkRequestReviewed={onReviewAppointmentRequest}
          onRequestMoreInformation={onRequestAppointmentInfo}
          onSelectPatient={openPatientDetail}
          pendingRequests={pendingRequests}
          todayAppointments={todayAppointments}
        />

        <ClinicianDashboard
          aiEnabled={aiEnabled}
          highlightedPatientIds={highlightedPatientIds}
          onSelectPatient={openPatientDetail}
          patients={patients}
          selectedPatientId={selectedPatient?.profile.id}
        />

        <div className="space-y-4">
          <CareCoordinationAssistant
            aiEnabled={aiEnabled}
            isLoading={assistantLoading}
            onRunQuery={runAssistantQuery}
            onToggleAiEnabled={onToggleAiEnabled}
            patients={patients}
            response={assistantResponse}
          />
          <EvaluationPanel
            events={evaluationLog}
            jatSubmissions={jatSubmissions}
            onResetJATSubmissions={onResetJATSubmissions}
            patients={patients}
          />
        </div>
      </div>
    </div>
  );
}
