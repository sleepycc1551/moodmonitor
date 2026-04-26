"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Stethoscope } from "lucide-react";
import { ClinicianApp } from "@/components/ClinicianApp";
import { PatientApp, type PatientTab } from "@/components/PatientApp";
import {
  createInitialPrototypeState,
  createPatientRecordFromProfile,
  createPrimaryPatientProfile,
  generateSimulatedPhoneBehaviorData,
  generateSimulatedWearableData,
} from "@/lib/mockData";
import { formatDateTime } from "@/lib/dateFormat";
import {
  actionToUrgency,
  computeJATPerformance,
  concernScoreToLabel,
} from "@/lib/jatMetrics";
import {
  buildRiskSummary,
  defaultConcernScore,
  detectSelfHarmLanguage,
  getConcernScore,
} from "@/lib/riskEngine";
import { loadPrototypeState, savePrototypeState } from "@/lib/storage";
import type {
  AIMessage,
  AppointmentReason,
  CarePlan,
  ClinicianAction,
  ClinicianAlert,
  ClinicianMessage,
  ClinicianOverride,
  DailyCheckIn,
  EvaluationEvent,
  JATTesterAction,
  JATTesterSubmission,
  PatientNotification,
  PatientAssistantResponse,
  PatientRecord,
  PrototypeState,
  ScheduledAppointment,
  SharingPreferences,
  TestUserScenarioInput,
} from "@/types";

type AppView = "patient" | "clinician";

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nextPrototypeAppointmentTime(): string {
  const appointmentTime = new Date(Date.now() + 90 * 60 * 1000);
  const minutes = appointmentTime.getMinutes();

  if (minutes <= 30) {
    appointmentTime.setMinutes(30, 0, 0);
  } else {
    appointmentTime.setHours(appointmentTime.getHours() + 1, 0, 0, 0);
  }

  return appointmentTime.toISOString();
}

function recalculateRecord(record: PatientRecord): PatientRecord {
  const nextRecord = {
    ...record,
    latestRisk: record.mockAIConcernAssessment ?? buildRiskSummary(record),
  };

  if (
    nextRecord.latestRisk.concernLevel !== "stable" &&
    nextRecord.profile.connectClinicianDashboard
  ) {
    const latestRiskAlert = [...nextRecord.clinicianAlerts]
      .reverse()
      .find((alert) => alert.source === "risk-engine");

    const nextReason =
      nextRecord.latestRisk.keyReasons[0] ?? nextRecord.latestRisk.clinicianFacingSummary;

    if (
      !latestRiskAlert ||
      latestRiskAlert.reason !== nextReason ||
      latestRiskAlert.concernLevel !== nextRecord.latestRisk.concernLevel
    ) {
      nextRecord.clinicianAlerts = [
        ...nextRecord.clinicianAlerts,
        {
          id: createId("alert"),
          patientId: nextRecord.profile.id,
          createdAt: new Date().toISOString(),
          source: "risk-engine",
          concernLevel: nextRecord.latestRisk.concernLevel,
          reason: nextReason,
          aiSummary: nextRecord.latestRisk.clinicianFacingSummary,
          status: "new",
          recommendedAction: nextRecord.latestRisk.recommendedAction,
        },
      ];
    }
  }

  return nextRecord;
}

function addNotification(
  record: PatientRecord,
  notification: Omit<PatientNotification, "id" | "patientId" | "createdAt" | "read">,
): PatientRecord {
  return {
    ...record,
    notifications: [
      {
        id: createId("notification"),
        patientId: record.profile.id,
        createdAt: new Date().toISOString(),
        read: false,
        ...notification,
      },
      ...record.notifications,
    ],
  };
}

function addClinicianAction(
  record: PatientRecord,
  action: Omit<ClinicianAction, "id" | "patientId" | "createdAt">,
): PatientRecord {
  return {
    ...record,
    clinicianActions: [
      {
        id: createId("action"),
        patientId: record.profile.id,
        createdAt: new Date().toISOString(),
        ...action,
      },
      ...record.clinicianActions,
    ],
  };
}

function addClinicianAlert(
  record: PatientRecord,
  alert: Omit<ClinicianAlert, "id" | "patientId" | "createdAt">,
): PatientRecord {
  return {
    ...record,
    clinicianAlerts: [
      ...record.clinicianAlerts,
      {
        id: createId("alert"),
        patientId: record.profile.id,
        createdAt: new Date().toISOString(),
        ...alert,
      },
    ],
  };
}

function addClinicianMessage(
  record: PatientRecord,
  message: Omit<ClinicianMessage, "id" | "patientId" | "timestamp" | "sender" | "status">,
): PatientRecord {
  return {
    ...record,
    clinicianMessages: [
      {
        id: createId("clinician-message"),
        patientId: record.profile.id,
        timestamp: new Date().toISOString(),
        sender: "clinician",
        status: "sent",
        ...message,
      },
      ...record.clinicianMessages,
    ],
  };
}

function addClinicianOverride(
  record: PatientRecord,
  override: Omit<ClinicianOverride, "id" | "patientId" | "timestamp">,
): PatientRecord {
  return {
    ...record,
    clinicianOverrides: [
      ...record.clinicianOverrides,
      {
        id: createId("override"),
        patientId: record.profile.id,
        timestamp: new Date().toISOString(),
        ...override,
      },
    ],
  };
}

function addScheduledAppointment(
  record: PatientRecord,
  appointment: Omit<ScheduledAppointment, "id" | "patientId">,
): PatientRecord {
  return {
    ...record,
    scheduledAppointments: [
      ...record.scheduledAppointments,
      {
        id: createId("scheduled-appointment"),
        patientId: record.profile.id,
        ...appointment,
      },
    ],
  };
}

function markAppointmentAlertsActioned(record: PatientRecord): PatientRecord {
  return {
    ...record,
    clinicianAlerts: record.clinicianAlerts.map((alert) =>
      alert.source === "appointment-request"
        ? { ...alert, status: "actioned" }
        : alert,
    ),
  };
}

function recommendationForConcern(concernLevel: TestUserScenarioInput["concernLevel"]): string {
  if (concernLevel === "urgent") return "Urgent clinician review";
  if (concernLevel === "elevated") return "Clinician review recommended";
  if (concernLevel === "watch") return "Follow-up check-in suggested";
  return "No action needed";
}

function applyTestUserScenario(
  record: PatientRecord,
  input: TestUserScenarioInput,
): PatientRecord {
  const timestamp = new Date().toISOString();
  const latestCheckIn = record.checkIns.at(-1);
  const latestWearable = record.wearableData.at(-1);
  const latestPhone = record.phoneBehaviorData.at(-1);
  const shareDataWithClinician = input.shareDataWithClinician;

  const nextCheckIn: DailyCheckIn = {
    id: latestCheckIn?.id ?? createId("checkin"),
    patientId: record.profile.id,
    timestamp,
    mood: input.latestMood,
    energy: input.latestEnergy,
    anxiety: latestCheckIn?.anxiety ?? record.baseline.anxiety,
    irritability: latestCheckIn?.irritability ?? record.baseline.irritability,
    sleepQuality: input.latestSleepQuality,
    impulsivity: latestCheckIn?.impulsivity ?? record.baseline.impulsivity,
    hoursSlept: input.latestHoursSlept,
    medicationTakenToday: latestCheckIn?.medicationTakenToday ?? "yes",
    note: latestCheckIn?.note ?? "Scenario edited for testing.",
  };

  const wearableData = input.consentWearableMonitoring
    ? [
        ...record.wearableData.slice(0, -1),
        {
          id: latestWearable?.id ?? createId("wearable"),
          patientId: record.profile.id,
          timestamp,
          sleepDuration: input.latestHoursSlept,
          sleepQuality: input.latestSleepQuality,
          restingHeartRate: latestWearable?.restingHeartRate ?? record.baseline.restingHeartRate,
          activityLevel: latestWearable?.activityLevel ?? record.baseline.activityLevel,
          stressEstimate: latestWearable?.stressEstimate ?? record.baseline.stressEstimate,
          source: "simulated" as const,
        },
      ]
    : [];

  const phoneBehaviorData = input.consentPhoneMonitoring
    ? [
        ...record.phoneBehaviorData.slice(0, -1),
        {
          id: latestPhone?.id ?? createId("phone"),
          patientId: record.profile.id,
          timestamp,
          screenTimeHours: input.latestScreenTimeHours,
          nighttimePhoneUseMinutes: input.latestNighttimePhoneUseMinutes,
          socialAppUsageMinutes:
            latestPhone?.socialAppUsageMinutes ?? record.baseline.socialAppUsageMinutes,
          spendingAppVisits: latestPhone?.spendingAppVisits ?? record.baseline.spendingAppVisits,
          unlockFrequency: latestPhone?.unlockFrequency ?? record.baseline.unlockFrequency,
          privacySummary:
            "Only behavioral metadata is summarized. Private content is not displayed.",
          source: "simulated" as const,
        },
      ]
    : [];

  const updatedRecord = recalculateRecord({
    ...record,
    groundTruth: undefined,
    mockAIConcernAssessment: undefined,
    clinicianSafeDailyNotes: undefined,
    aiConversationSummary: undefined,
    profile: {
      ...record.profile,
      name: input.name,
      age: input.age,
      pronouns: input.pronouns || undefined,
      consentWearableMonitoring: input.consentWearableMonitoring,
      consentPhoneMonitoring: input.consentPhoneMonitoring,
      connectClinicianDashboard: shareDataWithClinician,
      sharingPreferences: {
        ...record.profile.sharingPreferences,
        shareDailyCheckInsWithClinician: shareDataWithClinician,
        shareWearableSummariesWithClinician:
          shareDataWithClinician && input.consentWearableMonitoring,
        sharePhoneBehaviorSummariesWithClinician:
          shareDataWithClinician && input.consentPhoneMonitoring,
        allowAIToFlagConcerningPatterns: shareDataWithClinician,
        allowClinicianToSeeAISummaries: shareDataWithClinician,
      },
    },
    baseline: {
      ...record.baseline,
      sleepDuration: input.baselineSleepDuration,
      hoursSlept: input.baselineSleepDuration,
      mood: input.baselineMood,
      energy: input.baselineEnergy,
    },
    checkIns: [...record.checkIns.slice(0, -1), nextCheckIn],
    wearableData,
    phoneBehaviorData,
  });

  const keyReason = input.keyReason.trim();
  const keyReasons = keyReason
    ? [
        keyReason,
        ...updatedRecord.latestRisk.keyReasons.filter((reason) => reason !== keyReason),
      ].slice(0, 4)
    : updatedRecord.latestRisk.keyReasons;

  const scenarioRecord: PatientRecord = {
    ...updatedRecord,
    latestRisk: {
      ...updatedRecord.latestRisk,
      concernLevel: input.concernLevel,
      concernScore: defaultConcernScore(input.concernLevel),
      keyReasons,
      recommendedAction: recommendationForConcern(input.concernLevel),
      patientFacingSummary:
        input.concernLevel === "stable"
          ? "Recent information remains close to this user's usual pattern."
          : "Recent information shows a change from this user's usual pattern.",
      clinicianFacingSummary:
        keyReason || updatedRecord.latestRisk.clinicianFacingSummary,
      supportingSignals: keyReason
        ? [
            keyReason,
            ...updatedRecord.latestRisk.supportingSignals.filter(
              (signal) => signal !== keyReason,
            ),
          ].slice(0, 5)
        : updatedRecord.latestRisk.supportingSignals,
      timestamp,
      lastDataSyncAt: timestamp,
    },
  };

  if (
    scenarioRecord.latestRisk.concernLevel === "stable" ||
    !scenarioRecord.profile.connectClinicianDashboard
  ) {
    return {
      ...scenarioRecord,
      clinicianAlerts: scenarioRecord.clinicianAlerts.map((alert) =>
        alert.source === "risk-engine" ? { ...alert, status: "reviewed" } : alert,
      ),
    };
  }

  const latestScenarioAlert = [...scenarioRecord.clinicianAlerts]
    .reverse()
    .find((alert) => alert.source === "risk-engine");
  const alertReason =
    scenarioRecord.latestRisk.keyReasons[0] ??
    scenarioRecord.latestRisk.clinicianFacingSummary;

  if (
    latestScenarioAlert?.concernLevel === scenarioRecord.latestRisk.concernLevel &&
    latestScenarioAlert.reason === alertReason
  ) {
    return scenarioRecord;
  }

  return addClinicianAlert(scenarioRecord, {
    source: "risk-engine",
    concernLevel: scenarioRecord.latestRisk.concernLevel,
    reason: alertReason,
    aiSummary: scenarioRecord.latestRisk.clinicianFacingSummary,
    status: "new",
    recommendedAction: scenarioRecord.latestRisk.recommendedAction,
  });
}

export function PrototypeShell() {
  const [appView, setAppView] = useState<AppView>("patient");
  const [patientTab, setPatientTab] = useState<PatientTab>("today");
  const [state, setState] = useState<PrototypeState>(() => createInitialPrototypeState());
  const stateRef = useRef(state);
  const [hydrated, setHydrated] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");

  useEffect(() => {
    const nextState = loadPrototypeState();
    stateRef.current = nextState;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(nextState);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    stateRef.current = state;
    savePrototypeState(state);
  }, [hydrated, state]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = () => {
      const nextState = loadPrototypeState();
      stateRef.current = nextState;
      setState(nextState);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const primaryPatient = useMemo(
    () =>
      state.patients.find((patient) => patient.profile.id === state.selectedPatientId) ??
      state.patients.find((patient) => patient.profile.id === state.primaryPatientId) ??
      state.patients[0],
    [state.patients, state.primaryPatientId, state.selectedPatientId],
  );

  const selectedClinicianPatient = useMemo(
    () =>
      state.patients.find(
        (patient) => patient.profile.id === state.selectedClinicianPatientId,
      ) ?? primaryPatient ?? state.patients[0],
    [primaryPatient, state.patients, state.selectedClinicianPatientId],
  );

  function updatePrototypeState(
    updater: (current: PrototypeState) => PrototypeState,
  ): PrototypeState {
    const nextState = {
      ...updater(stateRef.current),
      updatedAt: new Date().toISOString(),
    };

    stateRef.current = nextState;

    startTransition(() => {
      setState(nextState);
    });

    return nextState;
  }

  function updatePatientRecord(
    patientId: string,
    updater: (record: PatientRecord) => PatientRecord,
  ): PatientRecord | undefined {
    let updatedSnapshot: PatientRecord | undefined;

    updatePrototypeState((current) => ({
      ...current,
      patients: current.patients.map((record) => {
        if (record.profile.id !== patientId) return record;
        updatedSnapshot = recalculateRecord(updater(record));
        return updatedSnapshot;
      }),
    }));

    return updatedSnapshot;
  }

  function logEvaluationEvent(
    type: EvaluationEvent["type"],
    options?: {
      details?: string;
      metadata?: EvaluationEvent["metadata"];
      patientId?: string;
    },
  ) {
    updatePrototypeState((current) => ({
      ...current,
      evaluationLog: [
        ...current.evaluationLog,
        {
          id: createId("evaluation-event"),
          timestamp: new Date().toISOString(),
          type,
          patientId: options?.patientId,
          details: options?.details,
          metadata: options?.metadata,
        },
      ],
    }));
  }

  function handleSubmitJATJudgment(
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
  ) {
    const patient = stateRef.current.patients.find(
      (record) => record.profile.id === patientId,
    );

    if (!patient) return;

    const trueConcernScore =
      patient.groundTruth?.trueConcernScore ?? patient.latestRisk.concernScore;
    const aiEstimatedConcernScore =
      patient.groundTruth?.aiEstimatedConcernScore ?? getConcernScore(patient.latestRisk);
    const testerActionUrgency = actionToUrgency(input.testerAction);
    const trueActionUrgency = patient.groundTruth?.trueActionUrgency;
    const aiWasOverridden =
      !input.agreedWithAI || input.testerConcernScore !== aiEstimatedConcernScore;

    const submission: JATTesterSubmission = {
      id: createId("jat-submission"),
      patientId,
      submittedAt: new Date().toISOString(),
      testerConcernScore: input.testerConcernScore,
      testerConcernLabel: concernScoreToLabel(input.testerConcernScore),
      testerAction: input.testerAction,
      testerActionUrgency,
      testerConfidence: input.testerConfidence,
      agreedWithAI: input.agreedWithAI,
      testerNote: input.testerNote,
      openedDetailView: input.openedDetailView,
      viewedPanels: input.viewedPanels,
      timeToDecisionMs: input.timeToDecisionMs,
      computedMetrics: computeJATPerformance({
        trueConcernScore,
        aiEstimatedConcernScore,
        testerSubmittedConcernScore: input.testerConcernScore,
        trueActionUrgency,
        testerActionUrgency,
        testerConfidence: input.testerConfidence,
        aiWasOverridden,
      }),
    };

    updatePrototypeState((current) => ({
      ...current,
      jatSubmissions: [...current.jatSubmissions, submission],
    }));

    logEvaluationEvent("jat-judgment-submitted", {
      patientId,
      details: "Tester submitted a test judgment.",
      metadata: {
        testerConcernScore: input.testerConcernScore,
        testerAction: input.testerAction,
        testerConfidence: input.testerConfidence,
        agreedWithAI: input.agreedWithAI,
        timeToDecisionMs: input.timeToDecisionMs ?? null,
      },
    });
  }

  function handleResetJATSubmissions() {
    updatePrototypeState((current) => ({
      ...current,
      jatSubmissions: [],
    }));
  }

  function handleLoadPatient(patientId: string) {
    updatePrototypeState((current) => ({
      ...current,
      selectedPatientId: patientId,
      primaryPatientId: current.primaryPatientId ?? patientId,
    }));
    setPatientTab("today");
  }

  function handleAddTestUser(input: TestUserScenarioInput) {
    const profile = createPrimaryPatientProfile({
      name: input.name,
      age: input.age,
      pronouns: input.pronouns,
      consentWearableMonitoring: input.consentWearableMonitoring,
      consentPhoneMonitoring: input.consentPhoneMonitoring,
      connectClinicianDashboard: input.shareDataWithClinician,
    });
    const newRecord = applyTestUserScenario(createPatientRecordFromProfile(profile), input);

    updatePrototypeState((current) => ({
      ...current,
      setupComplete: true,
      primaryPatientId: current.primaryPatientId ?? newRecord.profile.id,
      selectedPatientId: newRecord.profile.id,
      selectedClinicianPatientId: newRecord.profile.id,
      patients: [newRecord, ...current.patients],
    }));
    setPatientTab("today");
  }

  function handleUpdateTestUser(patientId: string, input: TestUserScenarioInput) {
    updatePrototypeState((current) => {
      let selectedPatientStillExists = false;

      const patients = current.patients.map((record) => {
        if (record.profile.id !== patientId) return record;
        selectedPatientStillExists = true;
        return applyTestUserScenario(record, input);
      });

      return {
        ...current,
        selectedPatientId: selectedPatientStillExists
          ? patientId
          : current.selectedPatientId,
        patients,
      };
    });
  }

  function handleResetMockData() {
    updatePrototypeState(() => createInitialPrototypeState());
    setPatientTab("today");
  }

  function handleSubmitCheckIn(
    patientId: string,
    values: Omit<DailyCheckIn, "id" | "patientId" | "timestamp">,
  ) {
    updatePatientRecord(patientId, (record) => ({
      ...record,
      checkIns: [
        ...record.checkIns,
        {
          id: createId("checkin"),
          patientId,
          timestamp: new Date().toISOString(),
          ...values,
        },
      ],
    }));

    setSubmissionMessage(
      "Thanks for checking in. I'll keep looking for changes from your usual pattern.",
    );
    setTimeout(() => setSubmissionMessage(""), 3500);
  }

  function handleGenerateWearable(patientId: string) {
    updatePatientRecord(patientId, (record) => {
      if (!record.profile.consentWearableMonitoring) return record;

      return {
        ...record,
        wearableData: [
          ...record.wearableData,
          generateSimulatedWearableData(patientId, record.baseline),
        ],
      };
    });
  }

  function handleGeneratePhone(patientId: string) {
    updatePatientRecord(patientId, (record) => {
      if (!record.profile.consentPhoneMonitoring) return record;

      return {
        ...record,
        phoneBehaviorData: [
          ...record.phoneBehaviorData,
          generateSimulatedPhoneBehaviorData(patientId, record.baseline),
        ],
      };
    });
  }

  async function handleSendAssistantMessage(patientId: string, message: string) {
    if (!primaryPatient) return;

    const userMessage: AIMessage = {
      id: createId("message"),
      patientId,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    const snapshot = updatePatientRecord(patientId, (record) => ({
      ...record,
      aiMessages: [...record.aiMessages, userMessage],
    }));

    if (!snapshot) return;

    setAiLoading(true);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "patient",
          userMessage: message,
          patientProfile: snapshot.profile,
          recentCheckIns: snapshot.checkIns.slice(-5),
          wearableSummary: snapshot.wearableData[snapshot.wearableData.length - 1],
          phoneBehaviorSummary:
            snapshot.phoneBehaviorData[snapshot.phoneBehaviorData.length - 1],
          currentRiskSummary: snapshot.latestRisk,
        }),
      });

      if (!response.ok) {
        throw new Error("Gemini request failed.");
      }

      const payload = (await response.json()) as PatientAssistantResponse;

      updatePatientRecord(patientId, (record) => {
        let nextRecord: PatientRecord = {
          ...record,
          aiMessages: [
            ...record.aiMessages,
            {
              id: createId("message"),
              patientId,
              role: "assistant",
              content: payload.message,
              timestamp: new Date().toISOString(),
              concernLevel: payload.concernLevel,
              recommendedAction: payload.recommendedAction,
              flagForClinician: payload.flagForClinician,
            },
          ],
        };

        if (
          payload.flagForClinician &&
          record.profile.sharingPreferences.allowAIToFlagConcerningPatterns
        ) {
          nextRecord = addClinicianAlert(nextRecord, {
            source: "ai-assistant",
            concernLevel: payload.concernLevel ?? "watch",
            reason:
              payload.recommendedAction ?? "AI assistant requested clinician review.",
            aiSummary: payload.clinicianSafeSummary,
            status: "new",
            recommendedAction: payload.recommendedAction ?? "Review patient status",
          });

          if (payload.suggestedPatientNotification) {
            nextRecord = addNotification(nextRecord, {
              title: "Care team follow-up suggested",
              message: payload.suggestedPatientNotification,
              type: "ai-flag",
            });
          }
        }

        return nextRecord;
      });
    } catch (error) {
      updatePatientRecord(patientId, (record) => ({
        ...record,
        aiMessages: [
          ...record.aiMessages,
          {
            id: createId("message"),
            patientId,
            role: "assistant",
            content:
              "I couldn't reach the AI service just now, but your recent summaries are still saved in this prototype.",
            timestamp: new Date().toISOString(),
            concernLevel: detectSelfHarmLanguage(message) ? "urgent" : "watch",
            recommendedAction: "Try again or request clinician review",
            flagForClinician: detectSelfHarmLanguage(message),
          },
        ],
      }));

      console.error(error);
    } finally {
      setAiLoading(false);
    }
  }

  function handleRequestClinicianCheckIn(patientId: string) {
    updatePatientRecord(patientId, (record) =>
      addNotification(
        addClinicianAlert(record, {
          source: "patient-help-request",
          concernLevel: "watch",
          reason: "Patient requested a clinician check-in from the support page.",
          aiSummary: "Patient requested care-team follow-up.",
          status: "new",
          recommendedAction: "Review patient request",
        }),
        {
          title: "Check-in request sent",
          message: "Your request for a clinician check-in has been added to the dashboard.",
          type: "care-update",
        },
      ),
    );
  }

  function handleRequestAppointment(
    patientId: string,
    reason: AppointmentReason,
    note: string,
  ) {
    updatePatientRecord(patientId, (record) =>
      addNotification(
        addClinicianAlert(
          {
            ...record,
            appointmentRequests: [
              ...record.appointmentRequests,
              {
                id: createId("appointment-request"),
                patientId,
                createdAt: new Date().toISOString(),
                reason,
                note,
                status: "pending",
              },
            ],
          },
          {
            source: "appointment-request",
            concernLevel: reason === "Urgent concern" ? "elevated" : "watch",
            reason: `Appointment requested: ${reason}`,
            aiSummary: note || `Patient requested an appointment for ${reason}.`,
            status: "new",
            recommendedAction: "Review appointment request",
          },
        ),
        {
          title: "Appointment request submitted",
          message: "Your care team can now see your appointment request.",
          type: "appointment-update",
        },
      ),
    );
  }

  function handleSaveCarePlan(patientId: string, carePlan: CarePlan) {
    updatePatientRecord(patientId, (record) => ({
      ...record,
      carePlan,
    }));
  }

  function handleUpdateSharingPreferences(
    patientId: string,
    preferences: SharingPreferences,
  ) {
    updatePatientRecord(patientId, (record) => ({
      ...record,
      profile: {
        ...record.profile,
        sharingPreferences: preferences,
      },
    }));
  }

  function clinicianUpdate(patientId: string, updater: (record: PatientRecord) => PatientRecord) {
    updatePatientRecord(patientId, updater);
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-slate-100 p-8 text-slate-500">
        Loading prototype...
      </main>
    );
  }

  if (!primaryPatient) {
    return (
      <main className="min-h-screen bg-slate-100 p-8 text-slate-500">
        No test users are available. Reset mock data to reload the simulated cohort.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 md:px-6">
      <div className="mx-auto max-w-[1700px] space-y-5">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Graduate research prototype
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                MoodWatch proactive health management system
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                A local full-stack simulation exploring how patient self-report, summarized
                wearable signals, phone metadata, AI assistance, and clinician review can work
                together without turning the AI into an autonomous diagnostic system.
              </p>
              <p className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                Prototype only &mdash; not a medical device. The system does not diagnose or
                contact emergency services.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setAppView("patient")}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  appView === "patient"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Bot className="h-4 w-4" />
                Patient App
              </button>
              <button
                type="button"
                onClick={() => {
                  setAppView("clinician");
                  logEvaluationEvent("dashboard-opened", {
                    details: "Clinician dashboard opened.",
                  });
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  appView === "clinician"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Stethoscope className="h-4 w-4" />
                Clinician App
              </button>
            </div>
          </div>
        </header>

        {appView === "patient" ? (
          <PatientApp
            activeTab={patientTab}
            aiLoading={aiLoading}
            latestNotificationMessage={submissionMessage}
            onAddTestUser={handleAddTestUser}
            onGeneratePhoneData={() => handleGeneratePhone(primaryPatient.profile.id)}
            onGenerateWearableData={() => handleGenerateWearable(primaryPatient.profile.id)}
            onLoadPatient={handleLoadPatient}
            onRequestAppointment={(reason, note) =>
              handleRequestAppointment(primaryPatient.profile.id, reason, note)
            }
            onRequestClinicianCheckIn={() =>
              handleRequestClinicianCheckIn(primaryPatient.profile.id)
            }
            onResetMockData={handleResetMockData}
            onSaveCarePlan={(carePlan) => handleSaveCarePlan(primaryPatient.profile.id, carePlan)}
            onSendAssistantMessage={(message) =>
              handleSendAssistantMessage(primaryPatient.profile.id, message)
            }
            onSetTab={setPatientTab}
            onSubmitCheckIn={(values) => handleSubmitCheckIn(primaryPatient.profile.id, values)}
            onUpdateSharingPreferences={(preferences) =>
              handleUpdateSharingPreferences(primaryPatient.profile.id, preferences)
            }
            onUpdateTestUser={handleUpdateTestUser}
            patient={primaryPatient}
            patients={state.patients}
          />
        ) : (
          <ClinicianApp
            aiEnabled={state.clinicianAiEnabled}
            evaluationLog={state.evaluationLog}
            jatSubmissions={state.jatSubmissions}
            onApproveAppointment={(patientId, requestId) => {
              clinicianUpdate(patientId, (record) => {
                const request = record.appointmentRequests.find(
                  (currentRequest) => currentRequest.id === requestId,
                );

                if (!request) return record;

                const scheduledFor = nextPrototypeAppointmentTime();

                return addNotification(
                  addClinicianAction(
                    addScheduledAppointment(
                      markAppointmentAlertsActioned({
                        ...record,
                        appointmentRequests: record.appointmentRequests.map((currentRequest) =>
                          currentRequest.id === requestId
                            ? {
                                ...currentRequest,
                                status: "approved",
                                clinicianResponseNote:
                                  "Approved and added to the prototype schedule.",
                                updatedAt: new Date().toISOString(),
                              }
                            : currentRequest,
                        ),
                      }),
                      {
                        scheduledFor,
                        reason: request.reason,
                        concernLevel: record.latestRisk.concernLevel,
                        note: request.note,
                        source: "patient-request",
                        status: "scheduled",
                      },
                    ),
                    {
                      actionType: "approve-appointment",
                      note: "Appointment request approved in clinician dashboard.",
                      metadata: { requestId },
                    },
                  ),
                  {
                    title: "Appointment request approved",
                    message: `Your appointment request was approved. A prototype appointment was added for ${formatDateTime(
                      scheduledFor,
                    )}.`,
                    type: "appointment-update",
                  },
                );
              });

              logEvaluationEvent("appointment-request-processed", {
                patientId,
                details: "Appointment request approved.",
                metadata: { requestId, status: "approved" },
              });
            }}
            onChangeConcernLevel={(patientId, input) => {
              clinicianUpdate(patientId, (record) =>
                addClinicianAction(
                  addClinicianOverride(record, {
                    originalAIConcernLevel: record.latestRisk.concernLevel,
                    originalAIConcernScore: getConcernScore(record.latestRisk),
                    clinicianConcernLevel: input.clinicianConcernLevel,
                    clinicianConcernScore: input.clinicianConcernScore,
                    reason: input.reason,
                    note: input.note,
                  }),
                  {
                    actionType: "change-concern-level",
                    note: input.note || input.reason,
                    metadata: {
                      originalConcernLevel: record.latestRisk.concernLevel,
                      originalConcernScore: `${getConcernScore(record.latestRisk)}`,
                      clinicianConcernLevel: input.clinicianConcernLevel,
                      clinicianConcernScore: `${input.clinicianConcernScore}`,
                      reason: input.reason,
                    },
                  },
                ),
              );

              logEvaluationEvent("concern-overridden", {
                patientId,
                details: input.reason,
                metadata: {
                  originalConcernLevel:
                    selectedClinicianPatient?.latestRisk.concernLevel ?? "stable",
                  originalConcernScore: selectedClinicianPatient
                    ? getConcernScore(selectedClinicianPatient.latestRisk)
                    : null,
                  clinicianConcernLevel: input.clinicianConcernLevel,
                  clinicianConcernScore: input.clinicianConcernScore,
                  reason: input.reason,
                },
              });
            }}
            onEscalateCare={(patientId, note) => {
              clinicianUpdate(patientId, (record) =>
                addNotification(
                  addClinicianAction(
                    addClinicianOverride(
                      addClinicianAlert(record, {
                        source: "risk-engine",
                        concernLevel: "urgent",
                        reason: note,
                        aiSummary: note,
                        status: "actioned",
                        recommendedAction: "Escalated care",
                      }),
                      {
                        originalAIConcernLevel: record.latestRisk.concernLevel,
                        originalAIConcernScore: getConcernScore(record.latestRisk),
                        clinicianConcernLevel: "urgent",
                        clinicianConcernScore: 10,
                        reason: "AI underestimated concern",
                        note,
                      },
                    ),
                    {
                      actionType: "escalate-care",
                      note,
                    },
                  ),
                  {
                    title: "Care escalation noted",
                    message:
                      "In this prototype, the clinician escalated care and documented an urgent follow-up. Real emergency services are not contacted from this prototype.",
                    type: "care-update",
                  },
                ),
              );

              logEvaluationEvent("care-escalated", {
                patientId,
                details: note,
                metadata: { concernLevel: "urgent" },
              });
            }}
            onLogAssistantQuery={(query, highlightedPatientIds) =>
              logEvaluationEvent("assistant-query", {
                details: query,
                metadata: {
                  highlightedCount: highlightedPatientIds.length,
                },
              })
            }
            onLogPatientPanelViewed={(patientId, panelId) =>
              logEvaluationEvent("patient-panel-viewed", {
                patientId,
                details: `Viewed panel: ${panelId}`,
                metadata: { panelId },
              })
            }
            onMarkReviewed={(patientId) => {
              clinicianUpdate(patientId, (record) =>
                addClinicianAction(
                  {
                    ...record,
                    clinicianAlerts: record.clinicianAlerts.map((alert) => ({
                      ...alert,
                      status: "reviewed",
                    })),
                  },
                  {
                    actionType: "mark-reviewed",
                    note: "Marked current alerts as reviewed.",
                  },
                ),
              );

              logEvaluationEvent("patient-reviewed", {
                patientId,
                details: "Patient marked reviewed.",
              });
            }}
            onRequestAppointmentInfo={(patientId, requestId) => {
              clinicianUpdate(patientId, (record) =>
                addNotification(
                  addClinicianAction(
                    {
                      ...record,
                      appointmentRequests: record.appointmentRequests.map((request) =>
                        request.id === requestId
                          ? {
                              ...request,
                              status: "more-info-requested",
                              clinicianResponseNote:
                                "Please share a little more detail about the recent change from baseline.",
                              updatedAt: new Date().toISOString(),
                            }
                          : request,
                      ),
                    },
                    {
                      actionType: "request-appointment-info",
                      note: "Requested more information before scheduling appointment.",
                      metadata: { requestId },
                    },
                  ),
                  {
                    title: "More information requested",
                    message:
                      "Your care team requested a little more information before scheduling this appointment.",
                    type: "appointment-update",
                  },
                ),
              );

              logEvaluationEvent("appointment-request-processed", {
                patientId,
                details: "Requested more appointment information.",
                metadata: { requestId, status: "more-info-requested" },
              });
            }}
            onRequestFollowUpCheckIn={(patientId) => {
              clinicianUpdate(patientId, (record) =>
                addNotification(
                  addClinicianAction(record, {
                    actionType: "request-follow-up-check-in",
                    note: "Requested another patient check-in.",
                  }),
                  {
                    title: "Follow-up check-in requested",
                    message:
                      "Your care team requested a follow-up check-in in this prototype.",
                    type: "care-update",
                  },
                ),
              );

              logEvaluationEvent("follow-up-check-in-requested", {
                patientId,
                details: "Clinician requested follow-up check-in.",
              });
            }}
            onReviewAppointmentRequest={(patientId, requestId) => {
              clinicianUpdate(patientId, (record) =>
                addNotification(
                  addClinicianAction(
                    {
                      ...record,
                      appointmentRequests: record.appointmentRequests.map((request) =>
                        request.id === requestId
                          ? {
                              ...request,
                              status: "reviewed",
                              clinicianResponseNote:
                                "Request reviewed. The care team may follow up soon.",
                              updatedAt: new Date().toISOString(),
                            }
                          : request,
                      ),
                    },
                    {
                      actionType: "review-appointment-request",
                      note: "Appointment request reviewed.",
                      metadata: { requestId },
                    },
                  ),
                  {
                    title: "Appointment request reviewed",
                    message:
                      "Your appointment request was reviewed in the prototype dashboard.",
                    type: "review-status",
                  },
                ),
              );

              logEvaluationEvent("appointment-request-processed", {
                patientId,
                details: "Appointment request marked as reviewed.",
                metadata: { requestId, status: "reviewed" },
              });
            }}
            onSelectPatient={(patientId) => {
              const selectedPatient = state.patients.find(
                (patient) => patient.profile.id === patientId,
              );

              updatePrototypeState((current) => ({
                ...current,
                selectedClinicianPatientId: patientId,
              }));

              logEvaluationEvent("patient-opened", {
                patientId,
                details: "Patient detail opened.",
                metadata: {
                  concernLevel: selectedPatient?.latestRisk.concernLevel ?? "stable",
                  changeFromBaselineScore:
                    selectedPatient?.latestRisk.changeFromBaselineScore ?? 0,
                },
              });
            }}
            onSendSupportiveMessage={(patientId, message) => {
              clinicianUpdate(patientId, (record) =>
                addNotification(
                  addClinicianAction(
                    addClinicianMessage(record, {
                      message,
                    }),
                    {
                      actionType: "send-supportive-message",
                      note: message,
                    },
                  ),
                  {
                    title: "Message from care team",
                    message,
                    type: "clinician-message",
                  },
                ),
              );

              logEvaluationEvent("clinician-message-sent", {
                patientId,
                details: message,
              });
            }}
            onResetJATSubmissions={handleResetJATSubmissions}
            onSubmitJATJudgment={handleSubmitJATJudgment}
            onToggleAiEnabled={(nextValue) =>
              updatePrototypeState((current) => ({
                ...current,
                clinicianAiEnabled: nextValue,
              }))
            }
            patients={state.patients}
            selectedPatientId={selectedClinicianPatient?.profile.id}
          />
        )}
      </div>
    </main>
  );
}
