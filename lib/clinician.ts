import {
  buildChartSeries,
  compareConcernLevel,
  formatActionStatus,
  formatConcernLabel,
  getConcernScore,
} from "@/lib/riskEngine";
import { formatDateTime } from "@/lib/dateFormat";
import type {
  AppointmentRequest,
  ClinicianActionStatus,
  ClinicianOverride,
  ClinicianViewPatientSummary,
  ConcernLevel,
  EvaluationEvent,
  PatientRecord,
  ScheduledAppointment,
} from "@/types";

export type ClinicianSortOption =
  | "ai-concern"
  | "last-check-in"
  | "appointment-status"
  | "data-quality";

export type ClinicianFilterOption =
  | "all"
  | ConcernLevel
  | "ai-flagged"
  | "appointment-requested"
  | "needs-review";

export interface TodayAppointmentItem {
  appointment: ScheduledAppointment;
  patient: PatientRecord;
}

export interface PendingAppointmentItem {
  patient: PatientRecord;
  request: AppointmentRequest;
}

export interface MiniTrendPoint extends Record<string, number | string> {
  date: string;
  value: number;
}

export interface CareAssistantResponse {
  title: string;
  message: string;
  highlightedPatientIds: string[];
}

export interface CommunicationHistoryItem {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  status: string;
}

export interface EvaluationSummary {
  dashboardOpenedAt?: string;
  patientsReviewed: number;
  urgentOrElevatedPatientsOpened: number;
  falseAlarmsDismissed: number;
  appointmentRequestsProcessed: number;
  concernOverrides: number;
}

function latest<T extends { timestamp?: string; createdAt?: string }>(
  items: T[],
): T | undefined {
  return items[items.length - 1];
}

export function getLatestClinicianOverride(
  record: PatientRecord,
): ClinicianOverride | undefined {
  return [...record.clinicianOverrides]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .at(-1);
}

export function getClinicianConfirmedConcernLevel(
  record: PatientRecord,
): ConcernLevel | undefined {
  return getLatestClinicianOverride(record)?.clinicianConcernLevel;
}

export function getClinicianConfirmedConcernScore(
  record: PatientRecord,
): number | undefined {
  return getLatestClinicianOverride(record)?.clinicianConcernScore;
}

export function isTrendConcerning(
  values: number[],
  baseline: number,
  direction: "above" | "below" | "both",
): boolean {
  if (!values.length) return false;

  const latestValue = values.at(-1) ?? baseline;
  const firstValue = values[0] ?? latestValue;
  const deltaFromBaseline = latestValue - baseline;
  const deltaFromStart = latestValue - firstValue;

  if (direction === "below") {
    return deltaFromBaseline <= -1.2 || deltaFromStart <= -1.2;
  }

  if (direction === "above") {
    return deltaFromBaseline >= 2 || deltaFromStart >= 2;
  }

  return Math.abs(deltaFromBaseline) >= 2 || Math.abs(deltaFromStart) >= 2;
}

function estimateDailyConcernScore(record: PatientRecord, index: number): number {
  const checkIn = record.checkIns[index];
  if (!checkIn) return getConcernScore(record.latestRisk);

  if (
    checkIn.note?.toLowerCase().includes("not safe") ||
    checkIn.note?.toLowerCase().includes("need help")
  ) {
    return 10;
  }

  const phone = record.phoneBehaviorData[index] ?? record.phoneBehaviorData.at(-1);
  let score = 2;

  if (checkIn.hoursSlept <= record.baseline.hoursSlept - 2) score += 2;
  else if (checkIn.hoursSlept <= record.baseline.hoursSlept - 1) score += 1;

  if (checkIn.energy >= record.baseline.energy + 2) score += 2;
  if (checkIn.impulsivity >= record.baseline.impulsivity + 2) score += 1;
  if (
    checkIn.mood <= record.baseline.mood - 2 &&
    checkIn.energy <= record.baseline.energy - 2
  ) {
    score += 2;
  }

  if (
    phone &&
    phone.nighttimePhoneUseMinutes >=
      Math.max(
        record.baseline.nighttimePhoneUseMinutes + 40,
        record.baseline.nighttimePhoneUseMinutes * 1.5,
      )
  ) {
    score += 1;
  }

  return Math.max(1, Math.min(10, Math.round(score)));
}

export function getActionStatus(record: PatientRecord): ClinicianActionStatus {
  const latestAction = [...record.clinicianActions]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1);

  if (record.appointmentRequests.some((request) => request.status === "pending")) {
    return "appointment-requested";
  }

  if (latestAction?.actionType === "send-supportive-message") {
    return "message-sent";
  }

  if (latestAction?.actionType === "mark-reviewed") {
    return "reviewed";
  }

  if (record.clinicianAlerts.some((alert) => alert.status === "new")) {
    return "review-needed";
  }

  if (record.latestRisk.concernLevel === "stable") {
    return "no-action-needed";
  }

  return "review-needed";
}

export function buildClinicianViewPatientSummary(
  record: PatientRecord,
  aiEnabled: boolean,
): ClinicianViewPatientSummary {
  const latestCheckIn = latest(record.checkIns);
  const latestOverride = getLatestClinicianOverride(record);
  const sleepSparkline =
    record.wearableData.length > 0
      ? record.wearableData.slice(-7).map((entry) => entry.sleepDuration)
      : record.checkIns.slice(-7).map((entry) => entry.hoursSlept);
  const moodSparkline = record.checkIns.slice(-7).map((entry) => entry.mood);
  const energySparkline = record.checkIns.slice(-7).map((entry) => entry.energy);
  const aiEstimatedConcernScore = getConcernScore(record.latestRisk);
  const clinicianConfirmedConcernScore = latestOverride?.clinicianConcernScore;

  const keyReason = aiEnabled
    ? record.latestRisk.keyReasons[0] ?? record.latestRisk.clinicianFacingSummary
    : latestCheckIn
      ? `Last check-in ${formatDateTime(latestCheckIn.timestamp)} with ${latestCheckIn.hoursSlept} h sleep and ${latestCheckIn.energy}/10 energy.`
      : "Manual review mode - no recent self-report available.";

  return {
    patientId: record.profile.id,
    name: record.profile.name,
    age: record.profile.age,
    lastCheckInAt: latestCheckIn?.timestamp,
    aiEstimatedConcernLevel: aiEnabled ? record.latestRisk.concernLevel : undefined,
    aiEstimatedConcernScore: aiEnabled ? aiEstimatedConcernScore : undefined,
    clinicianConfirmedConcernLevel: latestOverride?.clinicianConcernLevel,
    clinicianConfirmedConcernScore,
    changeFromBaselineScore: aiEnabled
      ? record.latestRisk.changeFromBaselineScore
      : undefined,
    keyReason,
    evidenceStrength: aiEnabled ? record.latestRisk.evidenceStrength : undefined,
    dataQuality: record.latestRisk.dataQuality,
    actionStatus: getActionStatus(record),
    sleepSparkline,
    moodSparkline,
    energySparkline,
    sleepBaseline: record.baseline.sleepDuration,
    moodBaseline: record.baseline.mood,
    energyBaseline: record.baseline.energy,
    sleepTrendConcerning: isTrendConcerning(
      sleepSparkline,
      record.baseline.sleepDuration,
      "below",
    ),
    moodTrendConcerning: isTrendConcerning(moodSparkline, record.baseline.mood, "both"),
    energyTrendConcerning: isTrendConcerning(
      energySparkline,
      record.baseline.energy,
      "above",
    ),
    hasPendingAppointmentRequest: record.appointmentRequests.some(
      (request) => request.status === "pending",
    ),
    hasAiFlag:
      aiEnabled &&
      record.clinicianAlerts.some((alert) => alert.source === "ai-assistant"),
  };
}

export function filterPatientSummaries(
  patients: PatientRecord[],
  filter: ClinicianFilterOption,
  aiEnabled: boolean,
): PatientRecord[] {
  return patients.filter((patient) => {
    if (filter === "all") return true;
    if (filter === "ai-flagged") {
      return aiEnabled && patient.clinicianAlerts.some((alert) => alert.source === "ai-assistant");
    }
    if (filter === "appointment-requested") {
      return patient.appointmentRequests.some((request) => request.status === "pending");
    }
    if (filter === "needs-review") {
      return getActionStatus(patient) === "review-needed";
    }
    return patient.latestRisk.concernLevel === filter;
  });
}

function dataQualitySortValue(level: ClinicianViewPatientSummary["dataQuality"]["level"]): number {
  if (level === "good") return 0;
  if (level === "limited") return 1;
  return 2;
}

export function sortPatientSummaries(
  summaries: ClinicianViewPatientSummary[],
  sortBy: ClinicianSortOption,
  aiEnabled: boolean,
): ClinicianViewPatientSummary[] {
  return [...summaries].sort((left, right) => {
    if (sortBy === "last-check-in") {
      return (right.lastCheckInAt ?? "").localeCompare(left.lastCheckInAt ?? "");
    }

    if (sortBy === "appointment-status") {
      if (left.hasPendingAppointmentRequest !== right.hasPendingAppointmentRequest) {
        return left.hasPendingAppointmentRequest ? -1 : 1;
      }
      return (right.lastCheckInAt ?? "").localeCompare(left.lastCheckInAt ?? "");
    }

    if (sortBy === "data-quality") {
      return dataQualitySortValue(left.dataQuality.level) - dataQualitySortValue(right.dataQuality.level);
    }

    if (!aiEnabled) {
      return (right.lastCheckInAt ?? "").localeCompare(left.lastCheckInAt ?? "");
    }

    const concernSort = compareConcernLevel(
      left.aiEstimatedConcernLevel ?? "stable",
      right.aiEstimatedConcernLevel ?? "stable",
    );

    if (concernSort !== 0) return concernSort;

    return (right.changeFromBaselineScore ?? 0) - (left.changeFromBaselineScore ?? 0);
  });
}

export function flattenTodaysAppointments(
  patients: PatientRecord[],
): TodayAppointmentItem[] {
  const today = new Date().toDateString();

  return patients
    .flatMap((patient) =>
      patient.scheduledAppointments
        .filter(
          (appointment) =>
            appointment.status === "scheduled" &&
            new Date(appointment.scheduledFor).toDateString() === today,
        )
        .map((appointment) => ({
          appointment,
          patient,
        })),
    )
    .sort((left, right) => left.appointment.scheduledFor.localeCompare(right.appointment.scheduledFor));
}

export function flattenPendingAppointmentRequests(
  patients: PatientRecord[],
): PendingAppointmentItem[] {
  return patients
    .flatMap((patient) =>
      patient.appointmentRequests
        .filter((request) => request.status === "pending")
        .map((request) => ({
          patient,
          request,
        })),
    )
    .sort((left, right) => right.request.createdAt.localeCompare(left.request.createdAt));
}

export function buildPatientSparklineSeries(values: number[]) {
  return values.map((value, index) => ({
    date: `${index + 1}`,
    value,
  }));
}

export function buildConcernTrendChart(record: PatientRecord): MiniTrendPoint[] {
  const recentCheckIns = record.checkIns.slice(-7);

  if (!recentCheckIns.length) {
    return [{ date: "Now", value: getConcernScore(record.latestRisk) }];
  }

  return recentCheckIns.map((checkIn, index) => ({
    date: `${index + 1}`,
    value: estimateDailyConcernScore(record, Math.max(0, record.checkIns.indexOf(checkIn))),
  }));
}

export function isConcernTrendConcerning(record: PatientRecord): boolean {
  const values = buildConcernTrendChart(record).map((entry) => entry.value);
  return isTrendConcerning(values, 3, "above") || getConcernScore(record.latestRisk) >= 7;
}

function lowSleepPatients(patients: PatientRecord[]): PatientRecord[] {
  return patients.filter((patient) => {
    const latestCheckIn = patient.checkIns.at(-1);
    const latestWearable = patient.wearableData.at(-1);

    return Boolean(
      (latestCheckIn &&
        latestCheckIn.hoursSlept <= patient.baseline.hoursSlept - 1.5) ||
        (latestWearable &&
          latestWearable.sleepDuration <= patient.baseline.sleepDuration - 1.2),
    );
  });
}

function patientsMissingCheckInToday(patients: PatientRecord[]): PatientRecord[] {
  const today = new Date().toDateString();

  return patients.filter((patient) => {
    const latestCheckIn = patient.checkIns.at(-1);
    return !latestCheckIn || new Date(latestCheckIn.timestamp).toDateString() !== today;
  });
}

function findPatientByNameQuery(
  query: string,
  patients: PatientRecord[],
): PatientRecord | undefined {
  const normalized = query.toLowerCase();

  return patients.find((patient) =>
    normalized.includes(patient.profile.name.toLowerCase().split(" ")[0]) ||
    normalized.includes(patient.profile.name.toLowerCase()),
  );
}

export function buildCareCoordinationAssistantResponse(
  query: string,
  patients: PatientRecord[],
): CareAssistantResponse {
  const normalized = query.trim().toLowerCase();
  const highestConcernPatients = [...patients]
    .sort((left, right) =>
      compareConcernLevel(left.latestRisk.concernLevel, right.latestRisk.concernLevel),
    )
    .slice(0, 3);

  if (
    normalized.includes("highest concern") ||
    normalized.includes("who needs review") ||
    normalized.includes("show highest")
  ) {
    const highlightedPatientIds = highestConcernPatients.map((patient) => patient.profile.id);

    return {
      title: "Highest concern patients",
      message: highestConcernPatients
        .map(
          (patient) =>
            `${patient.profile.name}: ${formatConcernLabel(patient.latestRisk.concernLevel)} concern. ${patient.latestRisk.keyReasons[0] ?? patient.latestRisk.clinicianFacingSummary}`,
        )
        .join(" "),
      highlightedPatientIds,
    };
  }

  if (normalized.includes("appointment request")) {
    const requests = flattenPendingAppointmentRequests(patients);

    return {
      title: "Appointment requests",
      message: requests.length
        ? requests
            .map(
              ({ patient, request }) =>
                `${patient.profile.name} requested an appointment for ${request.reason}.`,
            )
            .join(" ")
        : "There are no pending appointment requests right now.",
      highlightedPatientIds: requests.map(({ patient }) => patient.profile.id),
    };
  }

  if (normalized.includes("low sleep")) {
    const matchingPatients = lowSleepPatients(patients);

    return {
      title: "Low sleep patterns",
      message: matchingPatients.length
        ? matchingPatients
            .map((patient) => {
              const latestSleep =
                patient.wearableData.at(-1)?.sleepDuration ??
                patient.checkIns.at(-1)?.hoursSlept ??
                patient.baseline.hoursSlept;

              return `${patient.profile.name} has recent sleep around ${latestSleep} h versus baseline ${patient.baseline.sleepDuration} h.`;
            })
            .join(" ")
        : "No patients currently show a clear low-sleep pattern relative to baseline.",
      highlightedPatientIds: matchingPatients.map((patient) => patient.profile.id),
    };
  }

  if (normalized.includes("low data quality")) {
    const matchingPatients = patients.filter(
      (patient) => patient.latestRisk.dataQuality.level !== "good",
    );

    return {
      title: "Low data quality",
      message: matchingPatients.length
        ? matchingPatients
            .map(
              (patient) =>
                `${patient.profile.name}: ${patient.latestRisk.dataQuality.note}`,
            )
            .join(" ")
        : "All patients currently have good data quality in the prototype.",
      highlightedPatientIds: matchingPatients.map((patient) => patient.profile.id),
    };
  }

  if (normalized.includes("not checked in today")) {
    const matchingPatients = patientsMissingCheckInToday(patients);

    return {
      title: "Patients without a check-in today",
      message: matchingPatients.length
        ? matchingPatients
            .map((patient) => `${patient.profile.name} has not checked in today.`)
            .join(" ")
        : "All tracked patients have a check-in for today.",
      highlightedPatientIds: matchingPatients.map((patient) => patient.profile.id),
    };
  }

  if (normalized.includes("escalating")) {
    const matchingPatients = patients.filter(
      (patient) =>
        patient.latestRisk.changeFromBaselineScore >= 6 &&
        patient.latestRisk.concernLevel !== "stable",
    );

    return {
      title: "Escalating patients",
      message: matchingPatients.length
        ? matchingPatients
            .map(
              (patient) =>
                `${patient.profile.name} has a change-from-baseline score of ${patient.latestRisk.changeFromBaselineScore}/10 and ${formatConcernLabel(patient.latestRisk.concernLevel)} concern.`,
            )
            .join(" ")
        : "No patients currently meet the escalating-pattern threshold.",
      highlightedPatientIds: matchingPatients.map((patient) => patient.profile.id),
    };
  }

  if (normalized.includes("draft a message")) {
    const matchedPatient = findPatientByNameQuery(normalized, patients) ?? patients[0];

    return {
      title: "Draft message",
      message: `Suggested message for ${matchedPatient.profile.name}: Please check in again later today, try to keep sleep as regular as possible tonight, and reply in the app if you would like a sooner appointment.`,
      highlightedPatientIds: [matchedPatient.profile.id],
    };
  }

  if (normalized.includes("summarize")) {
    const matchedPatient = findPatientByNameQuery(normalized, patients) ?? patients[0];
    const latestCheckIn = matchedPatient.checkIns.at(-1);
    const recentSleepAverage = averageSafe(
      matchedPatient.checkIns.slice(-7).map((entry) => entry.hoursSlept),
    ).toFixed(1);

    return {
      title: `Seven-day summary: ${matchedPatient.profile.name}`,
      message: `${matchedPatient.profile.name} is currently ${formatConcernLabel(matchedPatient.latestRisk.concernLevel)} with a change-from-baseline score of ${matchedPatient.latestRisk.changeFromBaselineScore}/10. Average recent sleep is ${recentSleepAverage} h. Latest concern reason: ${matchedPatient.latestRisk.keyReasons[0] ?? matchedPatient.latestRisk.clinicianFacingSummary} Latest check-in: ${latestCheckIn ? formatDateTime(latestCheckIn.timestamp) : "not available"}.`,
      highlightedPatientIds: [matchedPatient.profile.id],
    };
  }

  return {
    title: "Care coordination assistant",
    message:
      "Try asking for highest concern patients, low sleep patterns, appointment requests, patients not checked in today, or a seven-day summary for a named patient.",
    highlightedPatientIds: [],
  };
}

function averageSafe(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildCommunicationHistory(
  record: PatientRecord,
): CommunicationHistoryItem[] {
  const clinicianMessages = record.clinicianMessages.map((message) => ({
    id: message.id,
    timestamp: message.timestamp,
    title: "Clinician message",
    description: message.message,
    status: "sent",
  }));

  const appointmentHistory = record.appointmentRequests.map((request) => ({
    id: request.id,
    timestamp: request.updatedAt ?? request.createdAt,
    title: "Appointment request",
    description: request.note || request.reason,
    status: request.status,
  }));

  const alertHistory = record.clinicianAlerts.map((alert) => ({
    id: alert.id,
    timestamp: alert.createdAt,
    title: `${formatConcernLabel(alert.concernLevel)} alert`,
    description: alert.reason,
    status: alert.status,
  }));

  const actionHistory = record.clinicianActions.map((action) => ({
    id: action.id,
    timestamp: action.createdAt,
    title: formatActionStatus(getActionStatusFromAction(action.actionType)),
    description: action.note,
    status: action.actionType,
  }));

  return [...clinicianMessages, ...appointmentHistory, ...alertHistory, ...actionHistory].sort(
    (left, right) => right.timestamp.localeCompare(left.timestamp),
  );
}

function getActionStatusFromAction(
  actionType: PatientRecord["clinicianActions"][number]["actionType"],
): ClinicianActionStatus {
  if (actionType === "mark-reviewed") return "reviewed";
  if (actionType === "send-supportive-message") return "message-sent";
  if (actionType === "approve-appointment") return "appointment-requested";
  return "review-needed";
}

export function buildClinicianSafeNoteSummary(record: PatientRecord): string[] {
  if (record.clinicianSafeDailyNotes?.length) {
    return record.clinicianSafeDailyNotes;
  }

  const summaryLines: string[] = [];
  const latestCheckIn = record.checkIns.at(-1);
  const latestUserMessage = [...record.aiMessages]
    .reverse()
    .find((message) => message.role === "user");

  if (record.latestRisk.supportingSignals.length > 0) {
    summaryLines.push(
      `Clinician-safe summary: ${record.latestRisk.supportingSignals
        .slice(0, 2)
        .join(" ")}`,
    );
  }

  if (latestCheckIn?.note) {
    if (
      latestCheckIn.note.toLowerCase().includes("productive") ||
      latestCheckIn.note.toLowerCase().includes("activated")
    ) {
      summaryLines.push(
        "Recent self-report suggests increased productivity or activation relative to baseline.",
      );
    } else if (latestCheckIn.note.toLowerCase().includes("sleep")) {
      summaryLines.push("Recent self-report highlights concern about lower sleep.");
    } else if (latestCheckIn.note.toLowerCase().includes("safe")) {
      summaryLines.push("Recent self-report includes a safety-related concern.");
    } else {
      summaryLines.push(
        "A recent patient note was summarized into clinically relevant change-from-baseline observations.",
      );
    }
  }

  if (latestUserMessage) {
    summaryLines.push(
      "Patient also used the in-app assistant recently; only summary-level content is shown here.",
    );
  }

  if (!summaryLines.length) {
    summaryLines.push(
      "No recent patient-shared notes or chatbot summaries are available for clinician-safe review.",
    );
  }

  return summaryLines;
}

export function buildPhoneBehaviorInsights(record: PatientRecord): string[] {
  const latestPhone = record.phoneBehaviorData.at(-1);

  if (!latestPhone) {
    return ["No phone behavior summary is available."];
  }

  const insights: string[] = [];

  if (
    latestPhone.nighttimePhoneUseMinutes >
    record.baseline.nighttimePhoneUseMinutes + 20
  ) {
    insights.push(
      `Nighttime phone use increased ${Math.max(
        0,
        Math.round(
          ((latestPhone.nighttimePhoneUseMinutes - record.baseline.nighttimePhoneUseMinutes) /
            record.baseline.nighttimePhoneUseMinutes) *
            100,
        ),
      )}% above baseline.`,
    );
  }

  if (latestPhone.spendingAppVisits > record.baseline.spendingAppVisits + 1) {
    insights.push(
      `Spending app visits increased from baseline ${record.baseline.spendingAppVisits}/day to ${latestPhone.spendingAppVisits}/day.`,
    );
  }

  if (latestPhone.socialAppUsageMinutes > record.baseline.socialAppUsageMinutes + 20) {
    insights.push("Social app use increased for multiple recent days relative to baseline.");
  }

  if (!insights.length) {
    insights.push("Recent phone behavior remains close to baseline.");
  }

  return insights;
}

export function buildEvaluationSummary(
  events: EvaluationEvent[],
): EvaluationSummary {
  const dashboardOpenedAt = events.find((event) => event.type === "dashboard-opened")?.timestamp;
  const reviewedPatientIds = new Set(
    events
      .filter((event) => event.type === "patient-reviewed")
      .map((event) => event.patientId)
      .filter(Boolean),
  );
  const urgentOrElevatedOpened = new Set(
    events
      .filter((event) => event.type === "patient-opened")
      .filter(
        (event) =>
          event.metadata?.concernLevel === "urgent" ||
          event.metadata?.concernLevel === "elevated",
      )
      .map((event) => event.patientId)
      .filter(Boolean),
  );
  const falseAlarmsDismissed = events.filter(
    (event) =>
      event.type === "concern-overridden" &&
      typeof event.metadata?.originalConcernLevel === "string" &&
      typeof event.metadata?.clinicianConcernLevel === "string" &&
      isLowerConcern(
        event.metadata.originalConcernLevel as ConcernLevel,
        event.metadata.clinicianConcernLevel as ConcernLevel,
      ),
  ).length;

  return {
    dashboardOpenedAt,
    patientsReviewed: reviewedPatientIds.size,
    urgentOrElevatedPatientsOpened: urgentOrElevatedOpened.size,
    falseAlarmsDismissed,
    appointmentRequestsProcessed: events.filter(
      (event) => event.type === "appointment-request-processed",
    ).length,
    concernOverrides: events.filter((event) => event.type === "concern-overridden").length,
  };
}

function isLowerConcern(
  originalConcernLevel: ConcernLevel,
  clinicianConcernLevel: ConcernLevel,
): boolean {
  return compareConcernLevel(originalConcernLevel, clinicianConcernLevel) < 0;
}

export function buildSleepSparklineChart(record: PatientRecord) {
  const values =
    record.wearableData.length > 0
      ? record.wearableData.slice(-7).map((entry) => ({
          timestamp: entry.timestamp,
          value: entry.sleepDuration,
        }))
      : record.checkIns.slice(-7).map((entry) => ({
          timestamp: entry.timestamp,
          value: entry.hoursSlept,
        }));

  return buildChartSeries(values, (entry) => ({
    sleep: entry.value,
  }));
}
