import {
  buildClinicianSafeNoteSummary,
  buildClinicianViewPatientSummary,
  getActionStatus,
  getClinicianConfirmedConcernLevel,
} from "@/lib/clinician";
import { formatConcernLabel } from "@/lib/riskEngine";
import type {
  ClinicianAssistantRequestBody,
  ClinicianAssistantResponse,
  PatientAssistantRequestBody,
  PatientAssistantResponse,
  PatientRecord,
} from "@/types";

export const PATIENT_ASSISTANT_SYSTEM_PROMPT = `
You are the Patient AI Assistant inside a research prototype for proactive and preventive health management.

Your role:
- Be warm, supportive, concise, and non-diagnostic.
- Help the user reflect on mood, sleep, energy, stress, irritability, impulsivity, and daily experiences.
- Notice possible changes from the user's personal baseline.
- Encourage grounding, routines, sleep protection, hydration, social support, and contacting the care team when appropriate.

Safety and boundary rules:
- This prototype is not a medical device.
- Do not diagnose bipolar disorder, mania, depression, or any psychiatric condition.
- Do not label the user with clinical terms such as manic or depressed.
- Do not provide medication advice or dosing advice.
- Do not replace a clinician or emergency service.
- If the user may be in immediate danger or expresses self-harm intent, use urgent supportive language, recommend emergency resources, and flag for clinician review.
- Make clear that this prototype does not contact real emergency services.

Privacy rules:
- Use only the summarized context provided.
- Return a privacy-preserving clinicianSafeSummary that contains clinically relevant patterns only.
- Do not include unnecessary private details.

Output rules:
- Return valid JSON only.
- No markdown.
- No code fences.
- Follow the exact response schema.
`.trim();

export const CLINICIAN_ASSISTANT_SYSTEM_PROMPT = `
You are the Clinician Care Coordination Assistant inside a research prototype for proactive and preventive health management.

Your role:
- Support clinician triage, summarization, and workflow coordination.
- Identify which patients may need review today.
- Explain change-from-baseline patterns in concise clinician-facing language.
- Identify missing, stale, contradictory, or low-quality data.
- Summarize appointment requests and suggest next workflow actions.
- Draft brief supportive patient messages when helpful.

Safety and boundary rules:
- This prototype is not a medical device.
- Do not diagnose bipolar disorder, mania, depression, or any psychiatric condition.
- Do not replace clinician judgment.
- Phrase outputs as recommendations or decision support.
- Use terms such as AI-estimated concern, concern level, change from baseline, review priority, and recommended action.
- Do not use labels such as manic, depressed, or episode prediction.

Privacy rules:
- Do not reveal raw diary text by default.
- Do not reveal raw chatbot text, private messages, search text, transaction details, or unrelated personal details.
- Only include clinically relevant, privacy-preserving summaries.

Output rules:
- Return valid JSON only.
- No markdown.
- No code fences.
- Follow the exact response schema.
`.trim();

export const PATIENT_ASSISTANT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    concernLevel: {
      type: "string",
      enum: ["stable", "watch", "elevated", "urgent"],
    },
    recommendedAction: {
      type: "string",
      enum: [
        "none",
        "self_care",
        "request_check_in",
        "request_appointment",
        "contact_trusted_person",
        "emergency_resources",
      ],
    },
    flagForClinician: { type: "boolean" },
    clinicianSafeSummary: { type: "string" },
    suggestedPatientNotification: { type: "string" },
  },
  required: [
    "message",
    "concernLevel",
    "recommendedAction",
    "flagForClinician",
    "clinicianSafeSummary",
    "suggestedPatientNotification",
  ],
};

export const CLINICIAN_ASSISTANT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    response: { type: "string" },
    patientsMentioned: {
      type: "array",
      items: { type: "string" },
    },
    recommendedActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          patientId: { type: "string" },
          action: {
            type: "string",
            enum: [
              "review",
              "message_patient",
              "request_check_in",
              "approve_appointment",
              "escalate_care",
              "no_action",
            ],
          },
          rationale: { type: "string" },
        },
        required: ["patientId", "action", "rationale"],
      },
    },
    alertsToCreate: {
      type: "array",
      items: {
        type: "object",
        properties: {
          patientId: { type: "string" },
          concernLevel: {
            type: "string",
            enum: ["stable", "watch", "elevated", "urgent"],
          },
          reason: { type: "string" },
        },
        required: ["patientId", "concernLevel", "reason"],
      },
    },
    draftMessageToPatient: { type: "string" },
  },
  required: [
    "response",
    "patientsMentioned",
    "recommendedActions",
    "alertsToCreate",
    "draftMessageToPatient",
  ],
};

function sanitizeClinicianPatient(record: PatientRecord) {
  const summary = buildClinicianViewPatientSummary(record, true);
  const latestCheckIn = record.checkIns.at(-1);
  const latestWearable = record.wearableData.at(-1);
  const latestPhone = record.phoneBehaviorData.at(-1);
  const pendingAppointments = record.appointmentRequests
    .filter((request) => request.status === "pending")
    .map((request) => ({
      id: request.id,
      reason: request.reason,
      submittedAt: request.createdAt,
      status: request.status,
    }));

  return {
    patientId: record.profile.id,
    name: record.profile.name,
    age: record.profile.age,
    aiEstimatedConcern:
      summary.aiEstimatedConcernLevel
        ? formatConcernLabel(summary.aiEstimatedConcernLevel)
        : "Hidden",
    clinicianConfirmedConcern: getClinicianConfirmedConcernLevel(record)
      ? formatConcernLabel(getClinicianConfirmedConcernLevel(record)!)
      : "Not assigned",
    changeFromBaselineScore: record.latestRisk.changeFromBaselineScore,
    actionStatus: getActionStatus(record),
    lastCheckInAt: latestCheckIn?.timestamp ?? null,
    dataQuality: record.latestRisk.dataQuality,
    evidenceStrength: record.latestRisk.evidenceStrength,
    recommendedAction: record.latestRisk.recommendedAction,
    keyReasons: record.latestRisk.keyReasons,
    supportingSignals: record.latestRisk.supportingSignals.slice(0, 4),
    contradictingSignals: record.latestRisk.contradictingSignals.slice(0, 3),
    appointmentRequests: pendingAppointments,
    latestCheckIn: latestCheckIn
      ? {
          timestamp: latestCheckIn.timestamp,
          mood: latestCheckIn.mood,
          energy: latestCheckIn.energy,
          anxiety: latestCheckIn.anxiety,
          irritability: latestCheckIn.irritability,
          impulsivity: latestCheckIn.impulsivity,
          sleepQuality: latestCheckIn.sleepQuality,
          hoursSlept: latestCheckIn.hoursSlept,
          medicationTakenToday: latestCheckIn.medicationTakenToday,
        }
      : null,
    latestWearable: latestWearable
      ? {
          timestamp: latestWearable.timestamp,
          sleepDuration: latestWearable.sleepDuration,
          sleepQuality: latestWearable.sleepQuality,
          restingHeartRate: latestWearable.restingHeartRate,
          activityLevel: latestWearable.activityLevel,
          stressEstimate: latestWearable.stressEstimate,
        }
      : null,
    latestPhoneBehavior: latestPhone
      ? {
          timestamp: latestPhone.timestamp,
          screenTimeHours: latestPhone.screenTimeHours,
          nighttimePhoneUseMinutes: latestPhone.nighttimePhoneUseMinutes,
          socialAppUsageMinutes: latestPhone.socialAppUsageMinutes,
          spendingAppVisits: latestPhone.spendingAppVisits,
          unlockFrequency: latestPhone.unlockFrequency,
        }
      : null,
    clinicianSafeSummaries: buildClinicianSafeNoteSummary(record),
  };
}

export function buildPatientAssistantPrompt(
  payload: PatientAssistantRequestBody,
): string {
  const safeContext = {
    timestamp: new Date().toISOString(),
    patientProfile: {
      name: payload.patientProfile.name,
      age: payload.patientProfile.age,
      pronouns: payload.patientProfile.pronouns,
      sharingPreferences: payload.patientProfile.sharingPreferences,
    },
    recentCheckIns: payload.recentCheckIns.slice(-5),
    wearableSummary: payload.wearableSummary ?? null,
    phoneBehaviorSummary: payload.phoneBehaviorSummary ?? null,
    currentRiskSummary: payload.currentRiskSummary,
    userMessage: payload.userMessage,
  };

  return `
Return JSON only.

Mode: patient

Context:
${JSON.stringify(safeContext, null, 2)}

Response requirements:
- The "message" must be warm, supportive, and non-diagnostic.
- Use gentle language such as "change from your usual pattern" or "worth checking in with your care team."
- Do not give medication advice.
- If concern is stable or watch, avoid alarming language.
- If concern is elevated or urgent, encourage reaching out to the care team.
- If safety risk is present, recommend emergency resources and explain that this prototype does not contact real emergency services.
- "clinicianSafeSummary" must contain only privacy-preserving, clinically relevant pattern information.
- "suggestedPatientNotification" should be short. Use an empty string when no notification is needed.
`.trim();
}

export function buildClinicianAssistantPrompt(
  payload: ClinicianAssistantRequestBody,
): string {
  const selectedPatient = payload.selectedPatientId
    ? payload.patients.find((patient) => patient.profile.id === payload.selectedPatientId)
    : undefined;

  const safeContext = {
    timestamp: new Date().toISOString(),
    query: payload.query,
    selectedPatientId: payload.selectedPatientId ?? null,
    selectedPatient: selectedPatient ? sanitizeClinicianPatient(selectedPatient) : null,
    patients: payload.patients.map(sanitizeClinicianPatient),
  };

  return `
Return JSON only.

Mode: clinician

Context:
${JSON.stringify(safeContext, null, 2)}

Response requirements:
- Answer the clinician's query directly and concisely in the "response" field.
- In prose, refer to patients by display name.
- "patientsMentioned" should contain patient IDs or patient names that are directly relevant.
- "recommendedActions" should focus on workflow suggestions, not final clinical decisions.
- For each recommended action, use the patientId field for internal routing and mention the patient's display name in the rationale when useful.
- "alertsToCreate" should only include clinically relevant, privacy-preserving alerts.
- "draftMessageToPatient" should be supportive, brief, and non-diagnostic. Use an empty string if not needed.
- Do not include raw diary text or raw private message content.
`.trim();
}

export function normalizePatientAssistantResponse(
  response: Partial<PatientAssistantResponse>,
): PatientAssistantResponse {
  const normalizedConcernLevel =
    response.concernLevel && ["stable", "watch", "elevated", "urgent"].includes(response.concernLevel)
      ? response.concernLevel
      : "watch";

  const normalizedAction =
    response.recommendedAction &&
    [
      "none",
      "self_care",
      "request_check_in",
      "request_appointment",
      "contact_trusted_person",
      "emergency_resources",
    ].includes(response.recommendedAction)
      ? response.recommendedAction
      : "self_care";

  return {
    message:
      response.message?.trim() ||
      "Thanks for sharing that. I'll keep looking for changes from your usual pattern.",
    concernLevel: normalizedConcernLevel,
    recommendedAction: normalizedAction,
    flagForClinician: Boolean(response.flagForClinician),
    clinicianSafeSummary:
      response.clinicianSafeSummary?.trim() ||
      "Patient described a possible change from baseline. Only privacy-preserving summary content is available.",
    suggestedPatientNotification: response.suggestedPatientNotification?.trim() || "",
  };
}

export function normalizeClinicianAssistantResponse(
  response: Partial<ClinicianAssistantResponse>,
): ClinicianAssistantResponse {
  return {
    response:
      response.response?.trim() ||
      "No clinician-facing answer was generated. Continue manual review of patient summaries.",
    patientsMentioned: Array.isArray(response.patientsMentioned)
      ? response.patientsMentioned.filter((value): value is string => Boolean(value))
      : [],
    recommendedActions: Array.isArray(response.recommendedActions)
      ? response.recommendedActions
          .filter(
            (item): item is ClinicianAssistantResponse["recommendedActions"][number] =>
              Boolean(item && typeof item.patientId === "string" && typeof item.action === "string"),
          )
          .map((item) => ({
            patientId: item.patientId,
            action: [
              "review",
              "message_patient",
              "request_check_in",
              "approve_appointment",
              "escalate_care",
              "no_action",
            ].includes(item.action)
              ? item.action
              : "review",
            rationale: item.rationale?.trim() || "Suggested review based on prototype summary.",
          }))
      : [],
    alertsToCreate: Array.isArray(response.alertsToCreate)
      ? response.alertsToCreate
          .filter(
            (item): item is ClinicianAssistantResponse["alertsToCreate"][number] =>
              Boolean(
                item &&
                  typeof item.patientId === "string" &&
                  typeof item.concernLevel === "string",
              ),
          )
          .map((item) => ({
            patientId: item.patientId,
            concernLevel: ["stable", "watch", "elevated", "urgent"].includes(item.concernLevel)
              ? item.concernLevel
              : "watch",
            reason: item.reason?.trim() || "Prototype assistant suggested review.",
          }))
      : [],
    draftMessageToPatient: response.draftMessageToPatient?.trim() || "",
  };
}
