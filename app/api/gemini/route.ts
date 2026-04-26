import { GoogleGenAI } from "@google/genai";
import { buildCareCoordinationAssistantResponse } from "@/lib/clinician";
import {
  buildClinicianAssistantPrompt,
  buildPatientAssistantPrompt,
  CLINICIAN_ASSISTANT_RESPONSE_SCHEMA,
  CLINICIAN_ASSISTANT_SYSTEM_PROMPT,
  normalizeClinicianAssistantResponse,
  normalizePatientAssistantResponse,
  PATIENT_ASSISTANT_RESPONSE_SCHEMA,
  PATIENT_ASSISTANT_SYSTEM_PROMPT,
} from "@/lib/geminiPrompt";
import { detectSelfHarmLanguage } from "@/lib/riskEngine";
import type {
  ClinicianAssistantRequestBody,
  ClinicianAssistantResponse,
  GeminiRouteRequestBody,
  PatientAssistantRequestBody,
  PatientAssistantResponse,
  PatientAssistantRecommendedAction,
} from "@/types";

export const dynamic = "force-dynamic";

function isPatientAssistantRequestBody(
  payload: GeminiRouteRequestBody,
): payload is PatientAssistantRequestBody {
  return payload.mode === "patient";
}

function isClinicianAssistantRequestBody(
  payload: GeminiRouteRequestBody,
): payload is ClinicianAssistantRequestBody {
  return payload.mode === "clinician";
}

function mapRiskToPatientAction(
  concernLevel: PatientAssistantResponse["concernLevel"],
): PatientAssistantRecommendedAction {
  if (concernLevel === "urgent") return "emergency_resources";
  if (concernLevel === "elevated") return "request_appointment";
  if (concernLevel === "watch") return "request_check_in";
  return "self_care";
}

function fallbackPatientAssistantResponse(
  payload: PatientAssistantRequestBody,
): PatientAssistantResponse {
  if (detectSelfHarmLanguage(payload.userMessage)) {
    return normalizePatientAssistantResponse({
      message:
        "I'm concerned about your safety based on what you shared. This prototype does not contact real emergency services, but it would strongly encourage emergency resources and urgent clinician follow-up.",
      concernLevel: "urgent",
      recommendedAction: "emergency_resources",
      flagForClinician: true,
      clinicianSafeSummary:
        "Patient message included possible immediate safety concern. Prototype urgent clinician review is recommended.",
      suggestedPatientNotification:
        "Your message was marked for urgent prototype review. This prototype does not contact real emergency services.",
    });
  }

  const concernLevel = payload.currentRiskSummary.concernLevel;
  const recommendedAction = mapRiskToPatientAction(concernLevel);

  return normalizePatientAssistantResponse({
    message:
      concernLevel === "stable"
        ? "Thanks for checking in. Your recent pattern looks fairly close to usual, and I can still help you reflect on today."
        : concernLevel === "watch"
          ? "I'm noticing a mild change from your usual pattern. A grounding step and another check-in later could help."
          : "I'm noticing a stronger change from your usual pattern. It may help to reach out to your care team for extra support.",
    concernLevel,
    recommendedAction,
    flagForClinician: concernLevel === "elevated" || concernLevel === "urgent",
    clinicianSafeSummary:
      payload.currentRiskSummary.clinicianFacingSummary ||
      "A change from baseline was detected in recent summaries.",
    suggestedPatientNotification:
      concernLevel === "elevated" || concernLevel === "urgent"
        ? "A change from your usual pattern may be worth reviewing with your care team."
        : "",
  });
}

function fallbackClinicianAssistantResponse(
  payload: ClinicianAssistantRequestBody,
): ClinicianAssistantResponse {
  const fallbackSummary = buildCareCoordinationAssistantResponse(payload.query, payload.patients);

  const recommendedActions = payload.patients
    .filter((patient) => fallbackSummary.highlightedPatientIds.includes(patient.profile.id))
    .slice(0, 3)
    .map((patient) => ({
      patientId: patient.profile.id,
      action:
        patient.latestRisk.concernLevel === "urgent"
          ? ("escalate_care" as const)
          : patient.latestRisk.concernLevel === "elevated"
            ? ("review" as const)
            : patient.appointmentRequests.some((request) => request.status === "pending")
              ? ("approve_appointment" as const)
              : ("no_action" as const),
      rationale:
        patient.latestRisk.keyReasons[0] ?? patient.latestRisk.clinicianFacingSummary,
    }));

  const alertsToCreate = payload.patients
    .filter(
      (patient) =>
        fallbackSummary.highlightedPatientIds.includes(patient.profile.id) &&
        (patient.latestRisk.concernLevel === "elevated" ||
          patient.latestRisk.concernLevel === "urgent"),
    )
    .slice(0, 2)
    .map((patient) => ({
      patientId: patient.profile.id,
      concernLevel: patient.latestRisk.concernLevel,
      reason:
        patient.latestRisk.keyReasons[0] ?? "Prototype assistant suggested clinician review.",
    }));

  const draftMessageTarget = payload.selectedPatientId
    ? payload.patients.find((patient) => patient.profile.id === payload.selectedPatientId)
    : payload.patients.find((patient) => fallbackSummary.highlightedPatientIds.includes(patient.profile.id));

  return normalizeClinicianAssistantResponse({
    response: fallbackSummary.message,
    patientsMentioned: fallbackSummary.highlightedPatientIds,
    recommendedActions,
    alertsToCreate,
    draftMessageToPatient: draftMessageTarget
      ? `Hi ${draftMessageTarget.profile.name}, your care team would like you to complete another check-in and keep your routine as steady as possible tonight.`
      : "",
  });
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Empty Gemini response.");
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");

    if (start === -1) {
      throw new Error("No JSON object found in Gemini response.");
    }

    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let index = start; index < candidate.length; index += 1) {
      const char = candidate[index];

      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }

        if (char === "\\") {
          escaping = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;

        if (depth === 0) {
          return JSON.parse(candidate.slice(start, index + 1));
        }
      }
    }
  }

  throw new Error("Unable to safely extract JSON object from Gemini response.");
}

export async function POST(request: Request) {
  const payload = (await request.json()) as GeminiRouteRequestBody;

  if (!payload || (payload.mode !== "patient" && payload.mode !== "clinician")) {
    return Response.json({ error: "Invalid Gemini mode." }, { status: 400 });
  }

  if (isPatientAssistantRequestBody(payload)) {
    if (!payload.userMessage || !payload.patientProfile) {
      return Response.json({ error: "Missing required patient assistant payload." }, { status: 400 });
    }

    if (detectSelfHarmLanguage(payload.userMessage)) {
      return Response.json(fallbackPatientAssistantResponse(payload));
    }
  }

  if (isClinicianAssistantRequestBody(payload)) {
    if (!payload.query || !Array.isArray(payload.patients)) {
      return Response.json({ error: "Missing required clinician assistant payload." }, { status: 400 });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      isPatientAssistantRequestBody(payload)
        ? fallbackPatientAssistantResponse(payload)
        : fallbackClinicianAssistantResponse(payload),
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const isPatientMode = isPatientAssistantRequestBody(payload);

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: isPatientMode
        ? buildPatientAssistantPrompt(payload)
        : buildClinicianAssistantPrompt(payload),
      config: {
        systemInstruction: isPatientMode
          ? PATIENT_ASSISTANT_SYSTEM_PROMPT
          : CLINICIAN_ASSISTANT_SYSTEM_PROMPT,
        temperature: isPatientMode ? 0.3 : 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: isPatientMode
          ? PATIENT_ASSISTANT_RESPONSE_SCHEMA
          : CLINICIAN_ASSISTANT_RESPONSE_SCHEMA,
      },
    });

    const raw = response.text
      ? extractJsonObject(response.text)
      : isPatientMode
        ? fallbackPatientAssistantResponse(payload)
        : fallbackClinicianAssistantResponse(payload);

    return Response.json(
      isPatientMode
        ? normalizePatientAssistantResponse(raw as Partial<PatientAssistantResponse>)
        : normalizeClinicianAssistantResponse(raw as Partial<ClinicianAssistantResponse>),
    );
  } catch (error) {
    console.error("Gemini route error", error);

    return Response.json(
      isPatientAssistantRequestBody(payload)
        ? fallbackPatientAssistantResponse(payload)
        : fallbackClinicianAssistantResponse(payload),
    );
  }
}
