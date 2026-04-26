import { buildRiskSummary } from "@/lib/riskEngine";
import { actionToUrgency, concernScoreToLabel } from "@/lib/jatMetrics";
import type {
  AIConcernAssessment,
  AIMessage,
  AppointmentRequest,
  CarePlan,
  ClinicianAction,
  ClinicianMessage,
  ClinicianOverride,
  DailyCheckIn,
  DataQualitySummary,
  JATChallengeTag,
  JATTesterAction,
  PatientBaseline,
  PatientGroundTruth,
  PatientProfile,
  PatientRecord,
  PhoneBehaviorData,
  PrototypeState,
  ScheduledAppointment,
  SharingPreferences,
  WearableData,
} from "@/types";

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function daysAgo(days: number, hour = 9): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function todayAt(hour: number, minute = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function defaultSharingPreferences(): SharingPreferences {
  return {
    shareDailyCheckInsWithClinician: true,
    shareWearableSummariesWithClinician: true,
    sharePhoneBehaviorSummariesWithClinician: true,
    allowAIToFlagConcerningPatterns: true,
    allowClinicianToSeeAISummaries: true,
    shareRawNotesWithClinician: false,
  };
}

export function createDefaultCarePlan(patientId: string): CarePlan {
  return {
    patientId,
    warningSigns:
      "Lower sleep, feeling unusually activated, withdrawing from support, or feeling overwhelmed.",
    calmingStrategies:
      "Reduce stimulation, dim lights, take a walk, use paced breathing, and keep a regular bedtime.",
    trustedPeople: "Partner, sibling, close friend, therapist.",
    preferredClinicianContactMethod: "Secure message first, then phone call if needed.",
    dataSharingPreferencesNote:
      "This prototype shares only summaries and does not display private message content or search history.",
  };
}

function buildBaseline(overrides?: Partial<PatientBaseline>): PatientBaseline {
  return {
    mood: 5,
    energy: 5,
    anxiety: 4,
    irritability: 3,
    sleepQuality: 7,
    impulsivity: 2,
    hoursSlept: 7.5,
    sleepDuration: 7.3,
    restingHeartRate: 67,
    activityLevel: 6,
    stressEstimate: 4,
    screenTimeHours: 4.5,
    nighttimePhoneUseMinutes: 22,
    socialAppUsageMinutes: 38,
    spendingAppVisits: 1,
    unlockFrequency: 58,
    ...overrides,
  };
}

function buildCheckIn(
  patientId: string,
  timestamp: string,
  values: Partial<DailyCheckIn>,
): DailyCheckIn {
  return {
    id: createId("checkin"),
    patientId,
    timestamp,
    mood: 5,
    energy: 5,
    anxiety: 4,
    irritability: 3,
    sleepQuality: 7,
    impulsivity: 2,
    hoursSlept: 7.5,
    medicationTakenToday: "yes",
    note: "",
    ...values,
  };
}

function buildWearable(
  patientId: string,
  timestamp: string,
  values: Partial<WearableData>,
): WearableData {
  return {
    id: createId("wearable"),
    patientId,
    timestamp,
    sleepDuration: 7.2,
    sleepQuality: 7,
    restingHeartRate: 67,
    activityLevel: 6,
    stressEstimate: 4,
    source: "simulated",
    ...values,
  };
}

function buildPhoneBehavior(
  patientId: string,
  timestamp: string,
  values: Partial<PhoneBehaviorData>,
): PhoneBehaviorData {
  return {
    id: createId("phone"),
    patientId,
    timestamp,
    screenTimeHours: 4.6,
    nighttimePhoneUseMinutes: 20,
    socialAppUsageMinutes: 35,
    spendingAppVisits: 1,
    unlockFrequency: 55,
    privacySummary:
      "Only behavioral metadata is summarized. Private content is not displayed.",
    source: "simulated",
    ...values,
  };
}

function buildScheduledAppointment(
  patientId: string,
  scheduledFor: string,
  values: Partial<ScheduledAppointment>,
): ScheduledAppointment {
  return {
    id: createId("scheduled-appointment"),
    patientId,
    scheduledFor,
    reason: "Routine check-in",
    concernLevel: "watch",
    source: "simulated",
    status: "scheduled",
    ...values,
  };
}

function buildAppointmentRequest(
  patientId: string,
  values: Partial<AppointmentRequest>,
): AppointmentRequest {
  return {
    id: createId("appointment-request"),
    patientId,
    createdAt: new Date().toISOString(),
    reason: "Routine check-in",
    status: "pending",
    ...values,
  };
}

function buildClinicianMessage(
  patientId: string,
  message: string,
  timestamp: string,
): ClinicianMessage {
  return {
    id: createId("clinician-message"),
    patientId,
    message,
    timestamp,
    sender: "clinician",
    status: "sent",
  };
}

function buildAiMessage(
  patientId: string,
  values: Omit<AIMessage, "id" | "patientId">,
): AIMessage {
  return {
    id: createId("ai-message"),
    patientId,
    ...values,
  };
}

function createProfile(name: string, options: Partial<PatientProfile>): PatientProfile {
  const id = createId("patient");

  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    consentWearableMonitoring: true,
    consentPhoneMonitoring: true,
    connectClinicianDashboard: true,
    sharingPreferences: defaultSharingPreferences(),
    ...options,
  };
}

function finalizeRecord(record: Omit<PatientRecord, "latestRisk">): PatientRecord {
  const nextRecord: PatientRecord = {
    ...record,
    latestRisk: {} as PatientRecord["latestRisk"],
  };

  nextRecord.latestRisk = nextRecord.mockAIConcernAssessment ?? buildRiskSummary(nextRecord);

  if (nextRecord.latestRisk.concernLevel !== "stable") {
    nextRecord.clinicianAlerts = [
      ...nextRecord.clinicianAlerts,
      {
        id: createId("alert"),
        patientId: nextRecord.profile.id,
        createdAt: new Date().toISOString(),
        source: "risk-engine",
        concernLevel: nextRecord.latestRisk.concernLevel,
        reason:
          nextRecord.latestRisk.keyReasons[0] ??
          nextRecord.latestRisk.clinicianFacingSummary,
        aiSummary: nextRecord.latestRisk.clinicianFacingSummary,
        status: "new",
        recommendedAction: nextRecord.latestRisk.recommendedAction,
      },
    ];
  }

  if (nextRecord.appointmentRequests.some((request) => request.status === "pending")) {
    nextRecord.clinicianAlerts = [
      ...nextRecord.clinicianAlerts,
      {
        id: createId("alert"),
        patientId: nextRecord.profile.id,
        createdAt: new Date().toISOString(),
        source: "appointment-request",
        concernLevel: nextRecord.latestRisk.concernLevel,
        reason: "Patient submitted a new appointment request.",
        aiSummary: "Patient requested follow-up in the app.",
        status: "new",
        recommendedAction: "Review appointment request",
      },
    ];
  }

  return nextRecord;
}

function createGroundTruth(input: {
  aiEstimatedConcernScore: number;
  challengeScores?: Partial<PatientGroundTruth["challengeScores"]>;
  challengeTags: JATChallengeTag[];
  correctAction: JATTesterAction;
  correctActionText: string;
  expectedClinicianReasoning: string;
  groundTruthRationale: string;
  scenarioPurpose: string;
  trueConcernScore: number;
  trueActionUrgency?: number;
}): PatientGroundTruth {
  const aiError = input.aiEstimatedConcernScore - input.trueConcernScore;

  return {
    trueConcernScore: input.trueConcernScore,
    trueConcernLabel: concernScoreToLabel(input.trueConcernScore),
    trueActionUrgency:
      input.trueActionUrgency ?? actionToUrgency(input.correctAction),
    correctAction: input.correctAction,
    correctActionText: input.correctActionText,
    aiEstimatedConcernScore: input.aiEstimatedConcernScore,
    aiEstimatedConcernLabel: concernScoreToLabel(input.aiEstimatedConcernScore),
    challengeTags: input.challengeTags,
    challengeScores: {
      aiError,
      absoluteAiError: Math.abs(aiError),
      dataMissingness: 0,
      signalNoise: 0,
      ambiguity: 0,
      falsePrimeStrength: 0,
      privacyLimitation: 0,
      informationLoad: 3,
      ...input.challengeScores,
    },
    scenarioPurpose: input.scenarioPurpose,
    groundTruthRationale: input.groundTruthRationale,
    expectedClinicianReasoning: input.expectedClinicianReasoning,
  };
}

function buildMockAIConcernAssessment(
  record: Omit<PatientRecord, "latestRisk">,
  groundTruth: PatientGroundTruth,
  overrides: Partial<AIConcernAssessment>,
): AIConcernAssessment {
  const computed = buildRiskSummary({
    ...record,
    latestRisk: {} as AIConcernAssessment,
  });
  const timestamp = new Date().toISOString();

  return {
    ...computed,
    concernLevel: groundTruth.aiEstimatedConcernLabel,
    concernScore: groundTruth.aiEstimatedConcernScore,
    changeFromBaselineScore:
      overrides.changeFromBaselineScore ??
      Math.max(0, Math.min(10, groundTruth.aiEstimatedConcernScore - 1)),
    keyReasons: overrides.keyReasons ?? computed.keyReasons,
    evidenceStrength: overrides.evidenceStrength ?? computed.evidenceStrength,
    dataQuality: overrides.dataQuality ?? computed.dataQuality,
    recommendedAction:
      overrides.recommendedAction ?? groundTruth.correctActionText,
    patientFacingSummary:
      overrides.patientFacingSummary ?? computed.patientFacingSummary,
    clinicianFacingSummary:
      overrides.clinicianFacingSummary ?? computed.clinicianFacingSummary,
    supportingSignals: overrides.supportingSignals ?? computed.supportingSignals,
    contradictingSignals:
      overrides.contradictingSignals ?? computed.contradictingSignals,
    trendSummary: overrides.trendSummary ?? computed.trendSummary,
    lastDataSyncAt: overrides.lastDataSyncAt ?? computed.lastDataSyncAt,
    timestamp: overrides.timestamp ?? timestamp,
  };
}

function dataQuality(
  level: DataQualitySummary["level"],
  note: string,
  missingSources: string[] = [],
): DataQualitySummary {
  return { level, missingSources, note };
}

export function createPrimaryPatientProfile(input: {
  name: string;
  age?: number;
  pronouns?: string;
  consentWearableMonitoring: boolean;
  consentPhoneMonitoring: boolean;
  connectClinicianDashboard: boolean;
}): PatientProfile {
  return createProfile(input.name, {
    age: input.age,
    pronouns: input.pronouns,
    consentWearableMonitoring: input.consentWearableMonitoring,
    consentPhoneMonitoring: input.consentPhoneMonitoring,
    connectClinicianDashboard: input.connectClinicianDashboard,
    sharingPreferences: {
      ...defaultSharingPreferences(),
      shareWearableSummariesWithClinician: input.consentWearableMonitoring,
      sharePhoneBehaviorSummariesWithClinician: input.consentPhoneMonitoring,
    },
    isPrimaryPatient: true,
  });
}

export function createPatientRecordFromProfile(profile: PatientProfile): PatientRecord {
  const baseline = buildBaseline();
  const initialCheckIn = buildCheckIn(profile.id, daysAgo(0), {
    mood: 5,
    energy: 5,
    anxiety: 4,
    irritability: 3,
    sleepQuality: 7,
    impulsivity: 2,
    hoursSlept: baseline.hoursSlept,
    medicationTakenToday: "yes",
    note: "Initial baseline check-in for the prototype.",
  });

  const wearableData = profile.consentWearableMonitoring
    ? [buildWearable(profile.id, daysAgo(0), { sleepDuration: baseline.sleepDuration })]
    : [];

  const phoneBehaviorData = profile.consentPhoneMonitoring
    ? [
        buildPhoneBehavior(profile.id, daysAgo(0), {
          screenTimeHours: baseline.screenTimeHours,
          nighttimePhoneUseMinutes: baseline.nighttimePhoneUseMinutes,
        }),
      ]
    : [];

  return finalizeRecord({
    profile,
    monitoringReason: "Mood stability monitoring",
    baseline,
    carePlan: createDefaultCarePlan(profile.id),
    checkIns: [initialCheckIn],
    wearableData,
    phoneBehaviorData,
    aiMessages: [],
    clinicianMessages: [],
    clinicianAlerts: [],
    appointmentRequests: [],
    scheduledAppointments: [],
    clinicianActions: [],
    clinicianOverrides: [],
    notifications: [],
  });
}

function createSimulatedPatientRecord(config: {
  name: string;
  age: number;
  pronouns?: string;
  monitoringReason?: string;
  sharingPreferences?: Partial<SharingPreferences>;
  baselineOverrides?: Partial<PatientBaseline>;
  checkIns: Array<Partial<DailyCheckIn> & { dayOffset: number; hour?: number }>;
  wearableData: Array<Partial<WearableData> & { dayOffset: number; hour?: number }>;
  phoneBehaviorData: Array<Partial<PhoneBehaviorData> & { dayOffset: number; hour?: number }>;
  carePlan?: Partial<CarePlan>;
  appointmentRequests?: Array<Partial<AppointmentRequest>>;
  aiMessages?: Array<Omit<AIMessage, "id" | "patientId" | "timestamp"> & { dayOffset: number; hour?: number }>;
  aiConversationSummary?: string;
  clinicianSafeDailyNotes?: string[];
  scheduledAppointments?: Array<Partial<ScheduledAppointment> & { hour: number; minute?: number }>;
  clinicianMessages?: Array<{ message: string; timestamp: string }>;
  clinicianActions?: Array<Omit<ClinicianAction, "id" | "patientId">>;
  clinicianOverrides?: Array<Omit<ClinicianOverride, "id" | "patientId">>;
  groundTruth?: PatientGroundTruth;
  mockAIConcernAssessment?: Partial<AIConcernAssessment>;
}): PatientRecord {
  const profile = createProfile(config.name, {
    age: config.age,
    pronouns: config.pronouns,
    sharingPreferences: {
      ...defaultSharingPreferences(),
      ...config.sharingPreferences,
    },
  });
  const baseline = buildBaseline(config.baselineOverrides);

  const checkIns = config.checkIns.map((entry) => {
    const { dayOffset, hour = 9, ...values } = entry;
    return buildCheckIn(profile.id, daysAgo(dayOffset, hour), values);
  });

  const wearableData = config.wearableData.map((entry) => {
    const { dayOffset, hour = 7, ...values } = entry;
    return buildWearable(profile.id, daysAgo(dayOffset, hour), values);
  });

  const phoneBehaviorData = config.phoneBehaviorData.map((entry) => {
    const { dayOffset, hour = 21, ...values } = entry;
    return buildPhoneBehavior(profile.id, daysAgo(dayOffset, hour), values);
  });

  const appointmentRequests = (config.appointmentRequests ?? []).map((request) =>
    buildAppointmentRequest(profile.id, request),
  );

  const scheduledAppointments = (config.scheduledAppointments ?? []).map((appointment) => {
    const { hour, minute = 0, ...values } = appointment;
    return buildScheduledAppointment(profile.id, todayAt(hour, minute), values);
  });

  const clinicianMessages = (config.clinicianMessages ?? []).map((message) =>
    buildClinicianMessage(profile.id, message.message, message.timestamp),
  );

  const aiMessages = (config.aiMessages ?? []).map((message) => {
    const { dayOffset, hour = 20, ...values } = message;
    return buildAiMessage(profile.id, {
      timestamp: daysAgo(dayOffset, hour),
      ...values,
    });
  });

  const clinicianActions = (config.clinicianActions ?? []).map((action) => ({
    id: createId("clinician-action"),
    patientId: profile.id,
    ...action,
  }));

  const clinicianOverrides = (config.clinicianOverrides ?? []).map((override) => ({
    id: createId("override"),
    patientId: profile.id,
    ...override,
  }));

  const record: Omit<PatientRecord, "latestRisk"> = {
    profile,
    monitoringReason: config.monitoringReason ?? "Mood stability monitoring",
    baseline,
    carePlan: {
      ...createDefaultCarePlan(profile.id),
      ...config.carePlan,
    },
    checkIns,
    wearableData,
    phoneBehaviorData,
    aiMessages,
    clinicianMessages,
    clinicianAlerts: [],
    appointmentRequests,
    scheduledAppointments,
    clinicianActions,
    clinicianOverrides,
    notifications: [],
    aiConversationSummary: config.aiConversationSummary,
    clinicianSafeDailyNotes: config.clinicianSafeDailyNotes,
    groundTruth: config.groundTruth,
  };

  const mockAIConcernAssessment =
    config.groundTruth && config.mockAIConcernAssessment
      ? buildMockAIConcernAssessment(
          record,
          config.groundTruth,
          config.mockAIConcernAssessment,
        )
      : undefined;

  return finalizeRecord({
    ...record,
    mockAIConcernAssessment,
  });
}

type UploadedPatientCaseConfig = Omit<
  Parameters<typeof createSimulatedPatientRecord>[0],
  "groundTruth"
> & {
  groundTruthInput: Parameters<typeof createGroundTruth>[0];
};

function createJATPatientCase(config: UploadedPatientCaseConfig): PatientRecord {
  const { groundTruthInput, ...patientConfig } = config;
  const groundTruth = createGroundTruth(groundTruthInput);

  return createSimulatedPatientRecord({
    ...patientConfig,
    groundTruth,
  });
}

function createUploadedJATPatientCases(): PatientRecord[] {
  return [
    createJATPatientCase({
      name: "Avery Kim",
      age: 29,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar II. Current medication: lamotrigine 200mg/day.",
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.5,
        sleepDuration: 7.4,
        restingHeartRate: 67,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 4.2,
        nighttimePhoneUseMinutes: 22,
        socialAppUsageMinutes: 38,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 7, impulsivity: 2, hoursSlept: 7.4, medicationTakenToday: "yes" },
        { dayOffset: 4, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 7, impulsivity: 2, hoursSlept: 7.6, medicationTakenToday: "yes" },
        { dayOffset: 2, mood: 6, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 7, impulsivity: 2, hoursSlept: 7.5, medicationTakenToday: "yes" },
        { dayOffset: 0, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 7, impulsivity: 2, hoursSlept: 7.6, medicationTakenToday: "yes" },
      ],
      wearableData: [
        { dayOffset: 6, sleepDuration: 7.4, sleepQuality: 7, restingHeartRate: 66, activityLevel: 6, stressEstimate: 4 },
        { dayOffset: 4, sleepDuration: 7.6, sleepQuality: 7, restingHeartRate: 67, activityLevel: 6, stressEstimate: 4 },
        { dayOffset: 2, sleepDuration: 7.5, sleepQuality: 8, restingHeartRate: 65, activityLevel: 7, stressEstimate: 3 },
        { dayOffset: 0, sleepDuration: 7.6, sleepQuality: 7, restingHeartRate: 66, activityLevel: 6, stressEstimate: 4 },
      ],
      phoneBehaviorData: [
        { dayOffset: 6, screenTimeHours: 4.3, nighttimePhoneUseMinutes: 24, socialAppUsageMinutes: 38, spendingAppVisits: 1, unlockFrequency: 56 },
        { dayOffset: 4, screenTimeHours: 4.0, nighttimePhoneUseMinutes: 18, socialAppUsageMinutes: 35, spendingAppVisits: 1, unlockFrequency: 58 },
        { dayOffset: 2, screenTimeHours: 4.5, nighttimePhoneUseMinutes: 22, socialAppUsageMinutes: 42, spendingAppVisits: 1, unlockFrequency: 59 },
        { dayOffset: 0, screenTimeHours: 4.1, nighttimePhoneUseMinutes: 19, socialAppUsageMinutes: 36, spendingAppVisits: 1, unlockFrequency: 55 },
      ],
      aiMessages: [
        { dayOffset: 6, role: "user", content: "Just submitted my check-in. Week's been pretty normal." },
        { dayOffset: 4, role: "user", content: "Productive day at work, slept fine." },
        { dayOffset: 0, role: "user", content: "My week has felt pretty normal and steady. Nothing much to report." },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "Thanks for checking in. Your recent check-ins and summaries look close to your usual pattern.",
          concernLevel: "stable",
          recommendedAction: "none",
          flagForClinician: false,
        },
      ],
      aiConversationSummary:
        "Avery described a steady week with no meaningful change from baseline.",
      clinicianSafeDailyNotes: [
        "Recent check-ins and passive summaries are consistent with Avery's usual baseline.",
        "No clinically relevant concerns are apparent in this simulated case.",
      ],
      groundTruthInput: {
        trueConcernScore: 2,
        aiEstimatedConcernScore: 2,
        correctAction: "no_action",
        trueActionUrgency: 1,
        correctActionText: "No action needed; continue routine monitoring.",
        challengeTags: ["ai_correct"],
        challengeScores: {
          dataMissingness: 0,
          signalNoise: 0,
          ambiguity: 1,
          falsePrimeStrength: 0,
          privacyLimitation: 0,
          informationLoad: 2,
        },
        scenarioPurpose:
          "This is a low-challenge baseline case. It tests whether the clinician avoids unnecessary intervention.",
        groundTruthRationale:
          "All metrics are within normal variation of baseline, with no impulsivity rise and no help-seeking behavior.",
        expectedClinicianReasoning:
          "Recognize converging stable signals and avoid unnecessary intervention.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["Data remain close to Avery's personal baseline."],
        evidenceStrength: "high",
        dataQuality: dataQuality("good", "Self-report, wearable, and phone summaries are available."),
        recommendedAction: "No action needed",
        patientFacingSummary: "Your recent patterns look similar to your usual baseline.",
        clinicianFacingSummary:
          "Recent check-ins and passive summaries are consistent with Avery's usual baseline. No clinically relevant concerns are apparent in this simulated case.",
        supportingSignals: ["Sleep, mood, energy, and phone summaries remain close to baseline."],
        contradictingSignals: ["No concerning change from baseline is apparent."],
        changeFromBaselineScore: 2,
      },
    }),
    createJATPatientCase({
      name: "Priya Chen",
      age: 40,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar II. Current medication: quetiapine 200mg/night.",
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.2,
        sleepDuration: 7.1,
        restingHeartRate: 67,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 4.5,
        nighttimePhoneUseMinutes: 22,
        socialAppUsageMinutes: 38,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 6, impulsivity: 2, hoursSlept: 7.1, medicationTakenToday: "yes" },
        { dayOffset: 4, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 6, impulsivity: 2, hoursSlept: 6.6, medicationTakenToday: "yes" },
        { dayOffset: 2, mood: 4, energy: 4, anxiety: 5, irritability: 4, sleepQuality: 5, impulsivity: 2, hoursSlept: 6.2, medicationTakenToday: "yes" },
        { dayOffset: 0, mood: 4, energy: 4, anxiety: 5, irritability: 4, sleepQuality: 5, impulsivity: 2, hoursSlept: 6.0, medicationTakenToday: "yes", note: "I would like to talk about my recent sleep changes. I want to request an appointment." },
      ],
      wearableData: [
        { dayOffset: 6, sleepDuration: 7.0, sleepQuality: 6, restingHeartRate: 68, activityLevel: 6, stressEstimate: 4 },
        { dayOffset: 4, sleepDuration: 6.5, sleepQuality: 5, restingHeartRate: 69, activityLevel: 5, stressEstimate: 5 },
        { dayOffset: 2, sleepDuration: 6.2, sleepQuality: 5, restingHeartRate: 70, activityLevel: 5, stressEstimate: 5 },
        { dayOffset: 0, sleepDuration: 6.1, sleepQuality: 5, restingHeartRate: 70, activityLevel: 5, stressEstimate: 5 },
      ],
      phoneBehaviorData: [
        { dayOffset: 6, screenTimeHours: 4.5, nighttimePhoneUseMinutes: 22, socialAppUsageMinutes: 38, spendingAppVisits: 1, unlockFrequency: 60 },
        { dayOffset: 4, screenTimeHours: 4.7, nighttimePhoneUseMinutes: 28, socialAppUsageMinutes: 40, spendingAppVisits: 1, unlockFrequency: 62 },
        { dayOffset: 2, screenTimeHours: 5.0, nighttimePhoneUseMinutes: 32, socialAppUsageMinutes: 42, spendingAppVisits: 1, unlockFrequency: 65 },
        { dayOffset: 0, screenTimeHours: 5.1, nighttimePhoneUseMinutes: 35, socialAppUsageMinutes: 45, spendingAppVisits: 1, unlockFrequency: 66 },
      ],
      appointmentRequests: [
        {
          createdAt: daysAgo(0, 8),
          reason: "Sleep problem",
          note: "Lower sleep for several days and I would like a check-in.",
          status: "pending",
        },
      ],
      aiMessages: [
        { dayOffset: 6, role: "user", content: "Sleep was a bit off last night." },
        { dayOffset: 4, role: "user", content: "Still not sleeping great. Mood feels a little flat." },
        { dayOffset: 2, role: "user", content: "Sleep keeps getting worse. Tired during the day." },
        { dayOffset: 0, role: "user", content: "I would like to talk about my recent sleep changes. I want to request an appointment." },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "It makes sense to ask your care team about sleep changes. I can help send a routine appointment request.",
          concernLevel: "stable",
          recommendedAction: "request_appointment",
          flagForClinician: true,
        },
      ],
      aiConversationSummary:
        "Priya described worsening sleep over several days and requested an appointment.",
      clinicianSafeDailyNotes: [
        "Priya reported difficulty sleeping and requested a routine appointment.",
        "Recent data suggests mild sleep disruption without urgent escalation indicators.",
      ],
      groundTruthInput: {
        trueConcernScore: 4,
        aiEstimatedConcernScore: 3,
        correctAction: "schedule_appointment",
        trueActionUrgency: 4,
        correctActionText: "Approve the appointment request or schedule a routine sleep-focused follow-up.",
        challengeTags: ["ai_underestimate", "appointment_request", "ambiguous_cues"],
        challengeScores: {
          dataMissingness: 1,
          signalNoise: 2,
          ambiguity: 3,
          falsePrimeStrength: 1,
          privacyLimitation: 0,
          informationLoad: 4,
        },
        scenarioPurpose:
          "This tests whether the clinician appropriately handles a low-to-moderate appointment request without over-escalating.",
        groundTruthRationale:
          "Mild numerical changes plus explicit help-seeking should move the case above stable.",
        expectedClinicianReasoning:
          "Weight the appointment request alongside mild sleep changes and approve or schedule routine follow-up without urgent escalation.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["Mild sleep change without an urgent passive-data signal."],
        evidenceStrength: "moderate",
        dataQuality: dataQuality("good", "Self-report, wearable, and phone summaries are available."),
        recommendedAction: "Continue routine monitoring",
        patientFacingSummary: "Your sleep has been a little lower than usual. A routine care-team check-in may help.",
        clinicianFacingSummary:
          "Mild sleep disruption is present, but the scripted AI estimate underweights the appointment request and rates the case stable.",
        supportingSignals: ["Sleep is mildly below baseline for several days."],
        contradictingSignals: ["Patient explicitly requested an appointment for sleep changes."],
        changeFromBaselineScore: 3,
      },
    }),
    createJATPatientCase({
      name: "Jordan Rivera",
      age: 34,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar I. Current medication: lithium 900mg/day.",
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.2,
        sleepDuration: 7.0,
        restingHeartRate: 67,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 4.6,
        nighttimePhoneUseMinutes: 24,
        socialAppUsageMinutes: 40,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 6, mood: 6, energy: 6, anxiety: 4, irritability: 4, sleepQuality: 5, impulsivity: 4, hoursSlept: 6.0, medicationTakenToday: "yes" },
        { dayOffset: 4, mood: 6, energy: 7, anxiety: 4, irritability: 5, sleepQuality: 4, impulsivity: 5, hoursSlept: 5.2, medicationTakenToday: "yes" },
        { dayOffset: 2, mood: 7, energy: 8, anxiety: 5, irritability: 5, sleepQuality: 3, impulsivity: 6, hoursSlept: 4.7, medicationTakenToday: "yes" },
        { dayOffset: 0, mood: 7, energy: 8, anxiety: 5, irritability: 6, sleepQuality: 3, impulsivity: 7, hoursSlept: 4.3, medicationTakenToday: "yes", note: "Sleeping much less than usual and still feeling very activated." },
      ],
      wearableData: [
        { dayOffset: 6, sleepDuration: 5.8, sleepQuality: 5, restingHeartRate: 70, activityLevel: 7, stressEstimate: 5 },
        { dayOffset: 4, sleepDuration: 5.0, sleepQuality: 4, restingHeartRate: 72, activityLevel: 8, stressEstimate: 6 },
        { dayOffset: 2, sleepDuration: 4.6, sleepQuality: 3, restingHeartRate: 73, activityLevel: 8, stressEstimate: 6 },
        { dayOffset: 0, sleepDuration: 4.2, sleepQuality: 3, restingHeartRate: 74, activityLevel: 8, stressEstimate: 7 },
      ],
      phoneBehaviorData: [
        { dayOffset: 6, screenTimeHours: 6.0, nighttimePhoneUseMinutes: 50, socialAppUsageMinutes: 60, spendingAppVisits: 2, unlockFrequency: 75 },
        { dayOffset: 4, screenTimeHours: 6.8, nighttimePhoneUseMinutes: 72, socialAppUsageMinutes: 75, spendingAppVisits: 3, unlockFrequency: 85 },
        { dayOffset: 2, screenTimeHours: 7.4, nighttimePhoneUseMinutes: 90, socialAppUsageMinutes: 85, spendingAppVisits: 4, unlockFrequency: 91 },
        { dayOffset: 0, screenTimeHours: 8.0, nighttimePhoneUseMinutes: 104, socialAppUsageMinutes: 92, spendingAppVisits: 4, unlockFrequency: 95 },
      ],
      aiMessages: [
        { dayOffset: 6, role: "user", content: "Slept 6 hours but feeling fine. Got a lot done." },
        { dayOffset: 4, role: "user", content: "Only 5 hours but I have so much energy! Started a new project." },
        { dayOffset: 2, role: "user", content: "Stayed up working on my project until 2am. Don't really feel tired." },
        { dayOffset: 0, role: "user", content: "Sleeping much less than usual and still feeling very activated. I've been making lots of plans and reaching out to old friends to start projects. Everything feels possible." },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "I am noticing a strong change from your usual sleep, energy, and activity pattern. A care-team review would be helpful.",
          concernLevel: "urgent",
          recommendedAction: "request_appointment",
          flagForClinician: true,
        },
      ],
      aiConversationSummary:
        "Jordan described reduced sleep with increased activation, productivity, plans, and outreach.",
      clinicianSafeDailyNotes: [
        "Recent self-report suggests increased activation and productivity while sleep decreased substantially.",
        "Wearable and phone summaries also show reduced sleep and increased nighttime phone use.",
      ],
      groundTruthInput: {
        trueConcernScore: 8,
        aiEstimatedConcernScore: 9,
        correctAction: "schedule_appointment",
        trueActionUrgency: 4,
        correctActionText: "Schedule a timely clinician appointment; do not escalate solely to urgent care without safety markers.",
        challengeTags: ["ai_overestimate", "misleading_indicator", "signal_noise"],
        challengeScores: {
          dataMissingness: 0,
          signalNoise: 3,
          ambiguity: 2,
          falsePrimeStrength: 2,
          privacyLimitation: 0,
          informationLoad: 6,
        },
        scenarioPurpose:
          "This tests whether clinicians recognize a classic concerning pattern from converging evidence.",
        groundTruthRationale:
          "Strong converging activation pattern is present, but no explicit safety language appears.",
        expectedClinicianReasoning:
          "Treat as elevated and schedule prompt follow-up while recognizing the scripted AI urgent estimate is slightly high.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["Low sleep + high energy + increased impulsivity + increased nighttime phone use."],
        evidenceStrength: "high",
        dataQuality: dataQuality("good", "Self-report, wearable, and phone summaries are available."),
        recommendedAction: "Urgent clinician review",
        patientFacingSummary: "Several recent patterns look different from usual. A care-team follow-up may be helpful.",
        clinicianFacingSummary:
          "Strong activation pattern with substantially reduced sleep, high energy, increased impulsivity, and increased nighttime phone use. No explicit safety language is present.",
        supportingSignals: [
          "Sleep decreased from baseline 7.2 h to about 4.2 h.",
          "Energy and impulsivity are meaningfully above baseline.",
          "Nighttime phone use is substantially above baseline.",
        ],
        contradictingSignals: ["No explicit safety language and spending-app visits are only mildly elevated."],
        changeFromBaselineScore: 9,
      },
    }),
    createJATPatientCase({
      name: "Chris Patel",
      age: 31,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar I with depressive predominance. Current medication: lurasidone 80mg/day + lamotrigine 200mg/day.",
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.1,
        sleepDuration: 7.0,
        restingHeartRate: 67,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 4.5,
        nighttimePhoneUseMinutes: 22,
        socialAppUsageMinutes: 38,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 3, mood: 4, energy: 4, anxiety: 6, irritability: 4, sleepQuality: 5, impulsivity: 2, hoursSlept: 6.2, medicationTakenToday: "yes", note: "Things feel heavy." },
        { dayOffset: 1, mood: 3, energy: 3, anxiety: 7, irritability: 5, sleepQuality: 4, impulsivity: 2, hoursSlept: 5.2, medicationTakenToday: "partial", note: "Medication adherence detail: partial, skipped lurasidone." },
        { dayOffset: 0, mood: 2, energy: 2, anxiety: 8, irritability: 5, sleepQuality: 3, impulsivity: 2, hoursSlept: 4.5, medicationTakenToday: "no", note: "Medication adherence detail: no, skipped both." },
      ],
      wearableData: [
        { dayOffset: 3, sleepDuration: 6.0, sleepQuality: 5, restingHeartRate: 70, activityLevel: 5, stressEstimate: 6 },
        { dayOffset: 1, sleepDuration: 5.0, sleepQuality: 4, restingHeartRate: 73, activityLevel: 4, stressEstimate: 7 },
        { dayOffset: 0, sleepDuration: 4.5, sleepQuality: 3, restingHeartRate: 76, activityLevel: 3, stressEstimate: 8 },
      ],
      phoneBehaviorData: [
        { dayOffset: 3, screenTimeHours: 5.0, nighttimePhoneUseMinutes: 60, socialAppUsageMinutes: 28, spendingAppVisits: 1, unlockFrequency: 70 },
        { dayOffset: 1, screenTimeHours: 5.6, nighttimePhoneUseMinutes: 75, socialAppUsageMinutes: 22, spendingAppVisits: 0, unlockFrequency: 78 },
        { dayOffset: 0, screenTimeHours: 6.2, nighttimePhoneUseMinutes: 92, socialAppUsageMinutes: 18, spendingAppVisits: 0, unlockFrequency: 86 },
      ],
      aiMessages: [
        { dayOffset: 3, role: "user", content: "Can't really sleep. Things feel heavy." },
        { dayOffset: 1, role: "user", content: "Worse. I haven't been taking my meds the last couple days." },
        { dayOffset: 0, role: "user", content: "I do not feel safe tonight and need someone from the care team to know. I keep thinking about ways out." },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "I am glad you told me. This prototype is not an emergency service, but it would flag urgent care-team review and suggest immediate safety resources.",
          concernLevel: "urgent",
          recommendedAction: "emergency_resources",
          flagForClinician: true,
        },
      ],
      aiConversationSummary:
        "Chris described poor sleep, worsening distress, missed medication, and safety-related language.",
      clinicianSafeDailyNotes: [
        "Recent patient input included safety-related language. Raw private text is not displayed.",
        "Medication non-adherence, low mood, high anxiety, and poor sleep are present.",
        "Prototype urgent review and escalation are recommended.",
      ],
      groundTruthInput: {
        trueConcernScore: 10,
        aiEstimatedConcernScore: 10,
        correctAction: "escalate_care",
        trueActionUrgency: 5,
        correctActionText: "Escalate care in the prototype and document urgent safety follow-up.",
        challengeTags: ["ai_correct", "urgent_safety_case", "high_action_urgency"],
        challengeScores: {
          dataMissingness: 0,
          signalNoise: 1,
          ambiguity: 1,
          falsePrimeStrength: 0,
          privacyLimitation: 0,
          informationLoad: 5,
        },
        scenarioPurpose:
          "This tests whether clinicians appropriately escalate urgent safety concerns.",
        groundTruthRationale:
          "Simulated safety-related language appears alongside medication non-adherence, low mood, high anxiety, and poor sleep.",
        expectedClinicianReasoning:
          "Treat safety-related language as immediate priority and escalate in the prototype.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["Safety-related language + medication non-adherence + low mood + high anxiety + poor sleep."],
        evidenceStrength: "high",
        dataQuality: dataQuality("good", "Recent self-report and passive summaries are available."),
        recommendedAction: "Escalate care",
        patientFacingSummary: "A concerning safety-related message was detected. This prototype would recommend urgent care-team follow-up.",
        clinicianFacingSummary:
          "Recent patient input included safety-related language. Raw private text is not displayed. Medication non-adherence, low mood, high anxiety, and poor sleep support urgent review.",
        supportingSignals: [
          "Safety-related language appeared in recent patient input.",
          "Mood and energy are below baseline while anxiety is elevated.",
          "Medication adherence declined over recent check-ins.",
        ],
        contradictingSignals: [],
        changeFromBaselineScore: 10,
      },
    }),
    createJATPatientCase({
      name: "Elena Garcia",
      age: 27,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar II. Current medication: lamotrigine 200mg/day + sertraline 100mg/day.",
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.4,
        sleepDuration: 7.2,
        restingHeartRate: 67,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 5.0,
        nighttimePhoneUseMinutes: 22,
        socialAppUsageMinutes: 40,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 7, impulsivity: 2, hoursSlept: 7.2, medicationTakenToday: "yes" },
        { dayOffset: 4, mood: 4, energy: 4, anxiety: 5, irritability: 4, sleepQuality: 5, impulsivity: 2, hoursSlept: 6.0, medicationTakenToday: "yes" },
        { dayOffset: 2, mood: 3, energy: 3, anxiety: 7, irritability: 5, sleepQuality: 4, impulsivity: 2, hoursSlept: 5.2, medicationTakenToday: "partial", note: "Medication adherence detail: partial, forgot sertraline once." },
        { dayOffset: 0, mood: 3, energy: 3, anxiety: 7, irritability: 5, sleepQuality: 4, impulsivity: 2, hoursSlept: 5.0, medicationTakenToday: "no", note: "Wearable still has not synced. Medication adherence detail: no, missed both, second day in a row." },
      ],
      wearableData: [],
      phoneBehaviorData: [
        { dayOffset: 6, screenTimeHours: 4.8, nighttimePhoneUseMinutes: 24, socialAppUsageMinutes: 40, spendingAppVisits: 1, unlockFrequency: 60 },
        { dayOffset: 4, screenTimeHours: 5.0, nighttimePhoneUseMinutes: 30, socialAppUsageMinutes: 35, spendingAppVisits: 1, unlockFrequency: 58 },
        { dayOffset: 2, screenTimeHours: 5.1, nighttimePhoneUseMinutes: 33, socialAppUsageMinutes: 28, spendingAppVisits: 1, unlockFrequency: 55 },
        { dayOffset: 0, screenTimeHours: 5.2, nighttimePhoneUseMinutes: 36, socialAppUsageMinutes: 25, spendingAppVisits: 1, unlockFrequency: 54 },
      ],
      aiMessages: [
        { dayOffset: 6, role: "user", content: "Wearable hasn't synced in a few days. Anyway, mood is okay." },
        { dayOffset: 4, role: "user", content: "Watch still won't connect. Feeling pretty low today." },
        { dayOffset: 2, role: "user", content: "Still no wearable. Skipped my evening meds yesterday because I forgot. Energy is really low." },
        { dayOffset: 0, role: "user", content: "My wearable still has not synced, but I feel much worse than usual and I am having trouble keeping up. I missed my meds again last night and tonight too. Just don't have the energy to remember." },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "Your self-report matters even when wearable data are missing. It may help to ask your care team for a check-in.",
          concernLevel: "stable",
          recommendedAction: "request_check_in",
          flagForClinician: false,
        },
      ],
      aiConversationSummary:
        "Elena described missing wearable data, lower mood and energy, and worsening medication adherence.",
      clinicianSafeDailyNotes: [
        "Elena has limited wearable data in recent days.",
        "Self-report shows lower mood, higher anxiety, lower energy, and medication adherence concerns.",
        "The passive data stream is incomplete, reducing confidence in the AI estimate.",
      ],
      groundTruthInput: {
        trueConcernScore: 7,
        aiEstimatedConcernScore: 2,
        correctAction: "schedule_appointment",
        trueActionUrgency: 4,
        correctActionText: "Schedule an appointment or request prompt follow-up because self-report and medication adherence show meaningful worsening.",
        challengeTags: ["ai_underestimate", "missing_information", "data_quality_limited", "delayed_or_incomplete_data"],
        challengeScores: {
          dataMissingness: 9,
          signalNoise: 4,
          ambiguity: 5,
          falsePrimeStrength: 6,
          privacyLimitation: 2,
          informationLoad: 6,
        },
        scenarioPurpose:
          "This tests whether clinicians notice that stable AI output may be unreliable when data is missing.",
        groundTruthRationale:
          "Wearable data are absent, while self-report and medication adherence show meaningful worsening.",
        expectedClinicianReasoning:
          "Recognize that missing passive data should reduce AI confidence, then schedule or request follow-up based on self-report.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["No recent wearable confirmation and only mild phone changes."],
        evidenceStrength: "low",
        dataQuality: dataQuality("limited", "Wearable data have not synced for recent days.", ["wearable"]),
        recommendedAction: "Continue routine monitoring",
        patientFacingSummary: "Some information is missing, so your check-ins are especially helpful right now.",
        clinicianFacingSummary:
          "Scripted AI estimate is falsely reassured by missing passive data and mild phone changes. Self-report and medication adherence are concerning.",
        supportingSignals: ["Wearable data are missing and phone changes are modest."],
        contradictingSignals: [
          "Mood, energy, anxiety, and medication adherence worsened in self-report.",
          "The missing wearable stream makes the stable estimate unreliable.",
        ],
        lastDataSyncAt: daysAgo(8, 7),
        changeFromBaselineScore: 2,
      },
    }),
    createJATPatientCase({
      name: "Maya Thompson",
      age: 38,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar II, well-controlled for 3 years. Current medication: lamotrigine 150mg/day. Context: hospital nurse on a 1-week night shift assignment.",
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.4,
        sleepDuration: 7.2,
        restingHeartRate: 65,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 4.4,
        nighttimePhoneUseMinutes: 20,
        socialAppUsageMinutes: 35,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 5, impulsivity: 2, hoursSlept: 6.0, medicationTakenToday: "yes" },
        { dayOffset: 4, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 4, impulsivity: 2, hoursSlept: 5.0, medicationTakenToday: "yes" },
        { dayOffset: 2, mood: 5, energy: 4, anxiety: 5, irritability: 3, sleepQuality: 4, impulsivity: 2, hoursSlept: 4.5, medicationTakenToday: "yes" },
        { dayOffset: 0, mood: 5, energy: 4, anxiety: 5, irritability: 3, sleepQuality: 4, impulsivity: 2, hoursSlept: 4.2, medicationTakenToday: "yes", note: "Night shift context. Feels normal." },
      ],
      wearableData: [
        { dayOffset: 6, sleepDuration: 5.8, sleepQuality: 5, restingHeartRate: 70, activityLevel: 7, stressEstimate: 5 },
        { dayOffset: 4, sleepDuration: 4.9, sleepQuality: 4, restingHeartRate: 72, activityLevel: 8, stressEstimate: 5 },
        { dayOffset: 2, sleepDuration: 4.4, sleepQuality: 4, restingHeartRate: 73, activityLevel: 8, stressEstimate: 5 },
        { dayOffset: 0, sleepDuration: 4.2, sleepQuality: 3, restingHeartRate: 73, activityLevel: 8, stressEstimate: 5 },
      ],
      phoneBehaviorData: [
        { dayOffset: 6, screenTimeHours: 5.5, nighttimePhoneUseMinutes: 70, socialAppUsageMinutes: 30, spendingAppVisits: 1, unlockFrequency: 80 },
        { dayOffset: 4, screenTimeHours: 6.2, nighttimePhoneUseMinutes: 95, socialAppUsageMinutes: 28, spendingAppVisits: 1, unlockFrequency: 88 },
        { dayOffset: 2, screenTimeHours: 6.8, nighttimePhoneUseMinutes: 110, socialAppUsageMinutes: 30, spendingAppVisits: 1, unlockFrequency: 92 },
        { dayOffset: 0, screenTimeHours: 7.0, nighttimePhoneUseMinutes: 125, socialAppUsageMinutes: 32, spendingAppVisits: 1, unlockFrequency: 95 },
      ],
      aiMessages: [
        { dayOffset: 6, role: "user", content: "Started night shift this week to cover a colleague. Just tired." },
        { dayOffset: 2, role: "user", content: "Almost done with this stretch." },
        { dayOffset: 0, role: "user", content: "Feels normal." },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "The night-shift context is important. Your sleep and phone-use summaries look different, but mood and impulsivity look close to usual.",
          concernLevel: "urgent",
          recommendedAction: "request_check_in",
          flagForClinician: true,
        },
      ],
      aiConversationSummary:
        "Maya explained temporary night-shift work while mood, energy, impulsivity, and spending stayed near baseline.",
      clinicianSafeDailyNotes: [
        "Maya's sleep and nighttime phone use increased during a documented temporary night-shift/deadline period.",
        "Mood and impulsivity remain near baseline.",
        "The elevated AI estimate may reflect a benign context change.",
      ],
      groundTruthInput: {
        trueConcernScore: 2,
        aiEstimatedConcernScore: 9,
        correctAction: "monitor",
        trueActionUrgency: 2,
        correctActionText: "Monitor after context review; do not escalate based only on passive data.",
        challengeTags: ["ai_overestimate", "misleading_indicator", "context_change", "false_prime", "signal_noise"],
        challengeScores: {
          dataMissingness: 0,
          signalNoise: 8,
          ambiguity: 5,
          falsePrimeStrength: 9,
          privacyLimitation: 0,
          informationLoad: 7,
        },
        scenarioPurpose:
          "This tests whether clinicians avoid automation bias and look for contextual explanations before escalating.",
        groundTruthRationale:
          "Passive metrics look alarming, but night-shift context plus stable mood, energy, impulsivity, and spending support stable/monitor.",
        expectedClinicianReasoning:
          "Use patient context to discount misleading passive indicators and choose monitoring rather than escalation.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["Low sleep + high nighttime phone use + increased activity."],
        evidenceStrength: "moderate",
        dataQuality: dataQuality("good", "Self-report, wearable, and phone summaries are available."),
        recommendedAction: "Urgent clinician review",
        patientFacingSummary: "Your sleep and phone-use pattern look different from usual. Context may help your care team interpret this.",
        clinicianFacingSummary:
          "Scripted AI estimate overweights passive low sleep, nighttime phone use, and activity. Patient context explains temporary night-shift work and core self-report indicators remain near baseline.",
        supportingSignals: ["Sleep duration is far below baseline.", "Nighttime phone use and activity are far above baseline."],
        contradictingSignals: [
          "Patient reported a temporary night-shift/deadline context.",
          "Mood, energy, impulsivity, and spending remain near baseline.",
        ],
        changeFromBaselineScore: 9,
      },
    }),
    createJATPatientCase({
      name: "Noah Brooks",
      age: 36,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar II with depressive predominance. Current medication: lamotrigine 200mg/day + bupropion 300mg/day. Privacy preference: summary-only diary sharing.",
      sharingPreferences: { shareRawNotesWithClinician: false },
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.3,
        sleepDuration: 7.2,
        restingHeartRate: 67,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 4.4,
        nighttimePhoneUseMinutes: 22,
        socialAppUsageMinutes: 38,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 7, impulsivity: 2, hoursSlept: 7.0, medicationTakenToday: "yes" },
        { dayOffset: 4, mood: 4, energy: 4, anxiety: 5, irritability: 3, sleepQuality: 6, impulsivity: 2, hoursSlept: 7.0, medicationTakenToday: "yes" },
        { dayOffset: 2, mood: 3, energy: 3, anxiety: 6, irritability: 4, sleepQuality: 5, impulsivity: 2, hoursSlept: 7.0, medicationTakenToday: "yes" },
        { dayOffset: 0, mood: 2, energy: 2, anxiety: 6, irritability: 5, sleepQuality: 5, impulsivity: 2, hoursSlept: 7.0, medicationTakenToday: "yes", note: "Summary-only sharing: withdrawing and motivation is much lower." },
      ],
      wearableData: [
        { dayOffset: 6, sleepDuration: 7.2, sleepQuality: 7, restingHeartRate: 67, activityLevel: 6, stressEstimate: 4 },
        { dayOffset: 4, sleepDuration: 7.1, sleepQuality: 7, restingHeartRate: 67, activityLevel: 5, stressEstimate: 4 },
        { dayOffset: 2, sleepDuration: 7.0, sleepQuality: 6, restingHeartRate: 67, activityLevel: 4, stressEstimate: 4 },
        { dayOffset: 0, sleepDuration: 7.0, sleepQuality: 6, restingHeartRate: 67, activityLevel: 4, stressEstimate: 4 },
      ],
      phoneBehaviorData: [
        { dayOffset: 6, screenTimeHours: 4.4, nighttimePhoneUseMinutes: 23, socialAppUsageMinutes: 38, spendingAppVisits: 1, unlockFrequency: 56 },
        { dayOffset: 4, screenTimeHours: 4.2, nighttimePhoneUseMinutes: 22, socialAppUsageMinutes: 30, spendingAppVisits: 0, unlockFrequency: 54 },
        { dayOffset: 2, screenTimeHours: 4.0, nighttimePhoneUseMinutes: 21, socialAppUsageMinutes: 22, spendingAppVisits: 0, unlockFrequency: 52 },
        { dayOffset: 0, screenTimeHours: 4.0, nighttimePhoneUseMinutes: 22, socialAppUsageMinutes: 18, spendingAppVisits: 0, unlockFrequency: 50 },
      ],
      aiMessages: [
        { dayOffset: 6, role: "assistant", content: "Clinician-safe summary: mood okay." },
        { dayOffset: 4, role: "assistant", content: "Clinician-safe summary: hard." },
        { dayOffset: 2, role: "assistant", content: "Clinician-safe summary: pulling away from people." },
        { dayOffset: 0, role: "user", content: "I do not want to share raw diary details, but I have been withdrawing and motivation is much lower. I'm still taking my meds." },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "You can keep private details private. I can summarize that motivation and connection feel lower than usual.",
          concernLevel: "watch",
          recommendedAction: "request_appointment",
          flagForClinician: false,
        },
      ],
      aiConversationSummary:
        "Noah uses summary-only sharing. Clinician-safe summaries indicate withdrawal and lower motivation while passive data look near baseline.",
      clinicianSafeDailyNotes: [
        "Noah's passive summaries appear near baseline, but clinician-safe self-report summary suggests a meaningful mood and motivation change.",
        "Social app use is declining, which may represent withdrawal rather than increased activity.",
        "Raw diary text is not displayed.",
      ],
      groundTruthInput: {
        trueConcernScore: 8,
        aiEstimatedConcernScore: 4,
        correctAction: "schedule_appointment",
        trueActionUrgency: 4,
        correctActionText: "Schedule an appointment or timely follow-up based on self-report summaries.",
        challengeTags: ["ai_underestimate", "privacy_limited_data", "ambiguous_cues", "missing_information"],
        challengeScores: {
          dataMissingness: 5,
          signalNoise: 5,
          ambiguity: 8,
          falsePrimeStrength: 5,
          privacyLimitation: 9,
          informationLoad: 6,
        },
        scenarioPurpose:
          "This tests whether clinicians attend to self-report summaries rather than relying only on wearable and phone data.",
        groundTruthRationale:
          "Passive data look near baseline, but self-report summaries show meaningful withdrawal, lower motivation, and mood decline.",
        expectedClinicianReasoning:
          "Give weight to clinician-safe self-report summaries and declining social app use despite normal passive metadata.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["Passive wearable and phone metadata are mostly near baseline."],
        evidenceStrength: "low",
        dataQuality: dataQuality("limited", "Raw diary content is hidden; only privacy-preserving summaries are available.", ["raw diary text"]),
        recommendedAction: "Monitor and request follow-up if changes persist",
        patientFacingSummary: "Your private details can stay private. Your check-in suggests a care-team check-in could help.",
        clinicianFacingSummary:
          "Scripted AI estimate underweights summary-only self-report. Passive data look near baseline, but privacy-preserving summaries suggest withdrawal and lower motivation.",
        supportingSignals: ["Wearable sleep and phone metadata are near baseline."],
        contradictingSignals: [
          "Clinician-safe self-report summary indicates withdrawal and lower motivation.",
          "Social app usage declined substantially from baseline.",
        ],
        changeFromBaselineScore: 4,
      },
    }),
    createJATPatientCase({
      name: "Sam Lee",
      age: 45,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar II, stable for 2 years. Current medication: lithium 600mg/day. Context: recent international travel across 8 time zones.",
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.0,
        sleepDuration: 6.9,
        restingHeartRate: 64,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 4.5,
        nighttimePhoneUseMinutes: 22,
        socialAppUsageMinutes: 35,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 6, impulsivity: 2, hoursSlept: 6.7, medicationTakenToday: "yes" },
        { dayOffset: 4, mood: 5, energy: 4, anxiety: 4, irritability: 3, sleepQuality: 6, impulsivity: 2, hoursSlept: 6.2, medicationTakenToday: "yes" },
        { dayOffset: 2, mood: 5, energy: 4, anxiety: 5, irritability: 3, sleepQuality: 5, impulsivity: 2, hoursSlept: 6.0, medicationTakenToday: "yes" },
        { dayOffset: 0, mood: 5, energy: 4, anxiety: 5, irritability: 3, sleepQuality: 6, impulsivity: 2, hoursSlept: 6.1, medicationTakenToday: "yes", note: "Jet lag and inconsistent device wear may make wearable data unreliable." },
      ],
      wearableData: [
        { dayOffset: 6, sleepDuration: 6.4, sleepQuality: 5, restingHeartRate: 67, activityLevel: 5, stressEstimate: 5 },
        { dayOffset: 4, sleepDuration: 3.8, sleepQuality: 2, restingHeartRate: 82, activityLevel: 4, stressEstimate: 6 },
        { dayOffset: 2, sleepDuration: 3.6, sleepQuality: 2, restingHeartRate: 84, activityLevel: 4, stressEstimate: 6 },
        { dayOffset: 0, sleepDuration: 3.9, sleepQuality: 3, restingHeartRate: 81, activityLevel: 5, stressEstimate: 6 },
      ],
      phoneBehaviorData: [
        { dayOffset: 6, screenTimeHours: 4.6, nighttimePhoneUseMinutes: 28, socialAppUsageMinutes: 35, spendingAppVisits: 2, unlockFrequency: 60 },
        { dayOffset: 4, screenTimeHours: 4.9, nighttimePhoneUseMinutes: 42, socialAppUsageMinutes: 38, spendingAppVisits: 3, unlockFrequency: 70 },
        { dayOffset: 2, screenTimeHours: 5.0, nighttimePhoneUseMinutes: 48, socialAppUsageMinutes: 36, spendingAppVisits: 4, unlockFrequency: 72 },
        { dayOffset: 0, screenTimeHours: 4.8, nighttimePhoneUseMinutes: 45, socialAppUsageMinutes: 32, spendingAppVisits: 3, unlockFrequency: 68 },
      ],
      aiMessages: [
        { dayOffset: 6, role: "user", content: "Heading on an international trip tomorrow." },
        { dayOffset: 4, role: "user", content: "Long flight. Forgot to charge my watch fully." },
        { dayOffset: 0, role: "user", content: "Jet lag is rough." },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "Travel and device wear can affect sensor summaries. I will note that data quality may be limited.",
          concernLevel: "elevated",
          recommendedAction: "request_check_in",
          flagForClinician: true,
        },
      ],
      aiConversationSummary:
        "Sam reported international travel, jet lag, and inconsistent device charging/wear.",
      clinicianSafeDailyNotes: [
        "Sam's wearable summaries show disrupted sleep and higher resting heart rate.",
        "Data quality is limited due to possible device wear inconsistency and travel context.",
        "Clinician review should consider sensor reliability.",
      ],
      groundTruthInput: {
        trueConcernScore: 4,
        aiEstimatedConcernScore: 8,
        correctAction: "monitor",
        trueActionUrgency: 2,
        correctActionText: "Monitor and check data quality before acting on elevated wearable signals.",
        challengeTags: ["ai_overestimate", "sensor_artifact", "unreliable_data", "signal_noise"],
        challengeScores: {
          dataMissingness: 5,
          signalNoise: 9,
          ambiguity: 6,
          falsePrimeStrength: 7,
          privacyLimitation: 0,
          informationLoad: 6,
        },
        scenarioPurpose:
          "This tests whether clinicians consider data quality before accepting AI concern.",
        groundTruthRationale:
          "Wearable sleep and heart rate appear alarming, but travel, jet lag, and device wear inconsistency reduce reliability.",
        expectedClinicianReasoning:
          "Check data quality and travel context, then monitor or clarify rather than escalating.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["Wearable sleep disruption + elevated resting heart rate."],
        evidenceStrength: "moderate",
        dataQuality: dataQuality("limited", "Travel and possible inconsistent device wear reduce wearable reliability.", ["wearable reliability"]),
        recommendedAction: "Clinician review recommended",
        patientFacingSummary: "Your wearable summary looks different, but travel or device wear may affect the reading.",
        clinicianFacingSummary:
          "Scripted AI estimate overweights wearable sleep disruption and elevated resting heart rate. Travel and possible sensor artifact reduce reliability.",
        supportingSignals: ["Wearable sleep detection is low and resting heart rate is above baseline."],
        contradictingSignals: [
          "Patient reported travel, jet lag, and inconsistent device wear.",
          "Self-report sleep is higher than wearable sleep and mood/impulsivity are stable.",
        ],
        changeFromBaselineScore: 8,
      },
    }),
    createJATPatientCase({
      name: "Harper Lewis",
      age: 32,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar II. Current medication: quetiapine 100mg/night.",
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.5,
        sleepDuration: 7.4,
        restingHeartRate: 67,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 4.5,
        nighttimePhoneUseMinutes: 24,
        socialAppUsageMinutes: 38,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 6, impulsivity: 2, hoursSlept: 7.0, medicationTakenToday: "yes" },
        { dayOffset: 4, mood: 6, energy: 6, anxiety: 5, irritability: 4, sleepQuality: 5, impulsivity: 4, hoursSlept: 6.4, medicationTakenToday: "yes" },
        { dayOffset: 2, mood: 6, energy: 7, anxiety: 5, irritability: 5, sleepQuality: 5, impulsivity: 5, hoursSlept: 5.9, medicationTakenToday: "yes" },
        { dayOffset: 0, mood: 7, energy: 7, anxiety: 6, irritability: 5, sleepQuality: 5, impulsivity: 7, hoursSlept: 5.5, medicationTakenToday: "yes", note: "Sleeping less, making more spontaneous decisions, and spending more time on shopping apps." },
      ],
      wearableData: [
        { dayOffset: 6, sleepDuration: 7.1, sleepQuality: 6, restingHeartRate: 68, activityLevel: 6, stressEstimate: 4 },
        { dayOffset: 4, sleepDuration: 6.5, sleepQuality: 5, restingHeartRate: 70, activityLevel: 6, stressEstimate: 5 },
        { dayOffset: 2, sleepDuration: 5.9, sleepQuality: 4, restingHeartRate: 71, activityLevel: 7, stressEstimate: 5 },
        { dayOffset: 0, sleepDuration: 5.5, sleepQuality: 4, restingHeartRate: 72, activityLevel: 7, stressEstimate: 6 },
      ],
      phoneBehaviorData: [
        { dayOffset: 6, screenTimeHours: 5.0, nighttimePhoneUseMinutes: 30, socialAppUsageMinutes: 42, spendingAppVisits: 2, unlockFrequency: 65 },
        { dayOffset: 4, screenTimeHours: 5.6, nighttimePhoneUseMinutes: 55, socialAppUsageMinutes: 55, spendingAppVisits: 4, unlockFrequency: 78 },
        { dayOffset: 2, screenTimeHours: 6.2, nighttimePhoneUseMinutes: 75, socialAppUsageMinutes: 65, spendingAppVisits: 6, unlockFrequency: 90 },
        { dayOffset: 0, screenTimeHours: 6.7, nighttimePhoneUseMinutes: 90, socialAppUsageMinutes: 72, spendingAppVisits: 8, unlockFrequency: 98 },
      ],
      aiMessages: [
        { dayOffset: 6, role: "user", content: "Sleep was a bit shorter but I feel okay." },
        { dayOffset: 4, role: "user", content: "Stayed up late shopping online. Bought a few things on a whim." },
        { dayOffset: 2, role: "user", content: "Feeling pretty good actually. More energy than usual." },
        { dayOffset: 0, role: "user", content: "Nothing feels extreme, but sleeping less, making more spontaneous decisions, and spending more time on shopping apps. Maybe just a busy week?" },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "Several small changes together can still be worth sharing with your care team.",
          concernLevel: "watch",
          recommendedAction: "request_appointment",
          flagForClinician: true,
        },
      ],
      aiConversationSummary:
        "Harper described several moderate changes across sleep, spontaneous decisions, energy, and shopping-app use.",
      clinicianSafeDailyNotes: [
        "Harper shows several moderate changes across impulsivity, nighttime phone use, spending-app visits, and sleep.",
        "No single indicator is extreme, but the combined pattern suggests elevated concern.",
      ],
      groundTruthInput: {
        trueConcernScore: 8,
        aiEstimatedConcernScore: 5,
        correctAction: "schedule_appointment",
        trueActionUrgency: 4,
        correctActionText: "Schedule an appointment because multiple moderate indicators converge.",
        challengeTags: ["ai_underestimate", "ambiguous_cues", "multiple_simultaneous_influences", "conflicting_indicators"],
        challengeScores: {
          dataMissingness: 0,
          signalNoise: 5,
          ambiguity: 8,
          falsePrimeStrength: 4,
          privacyLimitation: 1,
          informationLoad: 8,
        },
        scenarioPurpose:
          "This tests whether clinicians synthesize multiple moderate indicators instead of waiting for one obvious urgent indicator.",
        groundTruthRationale:
          "Multiple moderate cues converge: sleep down, mood/energy up, impulsivity up, spending up, and phone use up.",
        expectedClinicianReasoning:
          "Integrate moderate but converging indicators and schedule follow-up.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["Multiple moderate changes, but no single extreme indicator."],
        evidenceStrength: "moderate",
        dataQuality: dataQuality("good", "Self-report, wearable, and phone summaries are available."),
        recommendedAction: "Monitor and consider follow-up check-in",
        patientFacingSummary: "I am noticing some changes from your usual pattern. A care-team check-in may be useful.",
        clinicianFacingSummary:
          "Scripted AI estimate underweights a converging pattern because no single indicator is extreme.",
        supportingSignals: [
          "Impulsivity, spending app visits, nighttime phone use, mood, energy, and sleep all shift in the same direction.",
        ],
        contradictingSignals: ["No explicit safety language and no single signal is extreme."],
        changeFromBaselineScore: 5,
      },
    }),
    createJATPatientCase({
      name: "Olivia Martinez",
      age: 42,
      monitoringReason:
        "Mood stability monitoring. Simulated diagnosis: Bipolar II. Current medication: lamotrigine 200mg/day.",
      baselineOverrides: {
        mood: 5,
        energy: 5,
        anxiety: 4,
        irritability: 3,
        sleepQuality: 7,
        impulsivity: 2,
        hoursSlept: 7.3,
        sleepDuration: 7.2,
        restingHeartRate: 67,
        activityLevel: 6,
        stressEstimate: 4,
        screenTimeHours: 4.5,
        nighttimePhoneUseMinutes: 22,
        socialAppUsageMinutes: 38,
        spendingAppVisits: 1,
        unlockFrequency: 58,
      },
      checkIns: [
        { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, irritability: 3, sleepQuality: 6, impulsivity: 2, hoursSlept: 7.0, medicationTakenToday: "yes" },
        { dayOffset: 4, mood: 5, energy: 5, anxiety: 5, irritability: 3, sleepQuality: 5, impulsivity: 2, hoursSlept: 6.5, medicationTakenToday: "yes" },
        { dayOffset: 2, mood: 5, energy: 5, anxiety: 5, irritability: 4, sleepQuality: 5, impulsivity: 2, hoursSlept: 6.1, medicationTakenToday: "yes" },
        { dayOffset: 0, mood: 5, energy: 5, anxiety: 6, irritability: 4, sleepQuality: 5, impulsivity: 2, hoursSlept: 5.9, medicationTakenToday: "yes", note: "Sleep is a bit off and I feel more anxious, but mood and energy feel mostly steady." },
      ],
      wearableData: [
        { dayOffset: 6, sleepDuration: 7.0, sleepQuality: 6, restingHeartRate: 68, activityLevel: 6, stressEstimate: 4 },
        { dayOffset: 4, sleepDuration: 6.5, sleepQuality: 5, restingHeartRate: 69, activityLevel: 6, stressEstimate: 5 },
        { dayOffset: 2, sleepDuration: 6.1, sleepQuality: 5, restingHeartRate: 69, activityLevel: 6, stressEstimate: 5 },
        { dayOffset: 0, sleepDuration: 5.9, sleepQuality: 5, restingHeartRate: 69, activityLevel: 6, stressEstimate: 5 },
      ],
      phoneBehaviorData: [
        { dayOffset: 6, screenTimeHours: 4.5, nighttimePhoneUseMinutes: 22, socialAppUsageMinutes: 38, spendingAppVisits: 1, unlockFrequency: 58 },
        { dayOffset: 4, screenTimeHours: 4.6, nighttimePhoneUseMinutes: 24, socialAppUsageMinutes: 36, spendingAppVisits: 1, unlockFrequency: 60 },
        { dayOffset: 2, screenTimeHours: 4.8, nighttimePhoneUseMinutes: 23, socialAppUsageMinutes: 38, spendingAppVisits: 1, unlockFrequency: 58 },
        { dayOffset: 0, screenTimeHours: 4.7, nighttimePhoneUseMinutes: 25, socialAppUsageMinutes: 40, spendingAppVisits: 1, unlockFrequency: 59 },
      ],
      aiMessages: [
        { dayOffset: 6, role: "user", content: "Sleep was off last night." },
        { dayOffset: 4, role: "user", content: "Sleeping less and feeling more anxious than usual." },
        { dayOffset: 2, role: "user", content: "Same pattern. Mood is okay though, just sleep and anxiety." },
        { dayOffset: 0, role: "user", content: "Sleep is a bit off and I feel more anxious, but mood and energy feel mostly steady." },
        {
          dayOffset: 0,
          hour: 20,
          role: "assistant",
          content:
            "That sounds mixed rather than clear-cut. Monitoring and another check-in may help your care team see whether it settles.",
          concernLevel: "watch",
          recommendedAction: "request_check_in",
          flagForClinician: false,
        },
      ],
      aiConversationSummary:
        "Olivia described lower sleep and higher anxiety while mood and energy remained steady.",
      clinicianSafeDailyNotes: [
        "Olivia's data are mixed: sleep is lower and anxiety is somewhat elevated.",
        "Mood, energy, and phone behavior remain near baseline.",
        "Monitoring or follow-up check-in is appropriate.",
      ],
      groundTruthInput: {
        trueConcernScore: 5,
        aiEstimatedConcernScore: 5,
        correctAction: "request_follow_up_check_in",
        trueActionUrgency: 3,
        correctActionText: "Monitor and request a follow-up check-in if the sleep/anxiety pattern persists.",
        challengeTags: ["ai_correct", "ambiguous_cues", "conflicting_indicators", "uncertainty", "ai_correct_but_low_confidence"],
        challengeScores: {
          dataMissingness: 0,
          signalNoise: 4,
          ambiguity: 8,
          falsePrimeStrength: 2,
          privacyLimitation: 0,
          informationLoad: 5,
        },
        scenarioPurpose:
          "This tests whether clinicians recognize uncertainty and choose monitoring rather than overconfident escalation or dismissal.",
        groundTruthRationale:
          "Sleep is lower and anxiety is higher, but mood, energy, impulsivity, and phone behavior remain near baseline.",
        expectedClinicianReasoning:
          "Acknowledge mixed evidence, keep concern at watch, and monitor or request a follow-up check-in.",
      },
      mockAIConcernAssessment: {
        keyReasons: ["Mixed indicators: lower sleep and higher anxiety, but stable mood, energy, and phone behavior."],
        evidenceStrength: "low",
        dataQuality: dataQuality("good", "Self-report, wearable, and phone summaries are available."),
        recommendedAction: "Monitor and request follow-up check-in",
        patientFacingSummary: "Some patterns look a little different, while others look steady. Another check-in may help.",
        clinicianFacingSummary:
          "Olivia's data are mixed: sleep is lower and anxiety is somewhat elevated, but mood, energy, impulsivity, and phone behavior remain near baseline.",
        supportingSignals: ["Sleep is below baseline and anxiety is somewhat elevated."],
        contradictingSignals: ["Mood, energy, impulsivity, and phone behavior remain near baseline."],
        changeFromBaselineScore: 5,
      },
    }),
  ];
}

export function createSimulatedPatients(): PatientRecord[] {
  return createUploadedJATPatientCases();
}

export function createLegacySimulatedPatients(): PatientRecord[] {
  const averyTruth = createGroundTruth({
    trueConcernScore: 2,
    aiEstimatedConcernScore: 2,
    correctAction: "no_action",
    trueActionUrgency: 1,
    correctActionText: "No action needed; continue routine monitoring.",
    challengeTags: ["ai_correct"],
    challengeScores: { informationLoad: 2 },
    scenarioPurpose:
      "Low-challenge baseline case. Tests whether the clinician avoids unnecessary intervention.",
    groundTruthRationale:
      "Sleep, mood, energy, wearable summaries, and phone metadata remain close to Avery's baseline.",
    expectedClinicianReasoning:
      "Recognize converging stable signals and avoid overreacting to routine variation.",
  });
  const stablePatient = createSimulatedPatientRecord({
    name: "Avery Kim",
    age: 29,
    baselineOverrides: {
      hoursSlept: 7.6,
      sleepDuration: 7.4,
      screenTimeHours: 4.2,
    },
    checkIns: [
      { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, sleepQuality: 7, hoursSlept: 7.4 },
      { dayOffset: 4, mood: 5, energy: 5, anxiety: 4, sleepQuality: 7, hoursSlept: 7.8 },
      { dayOffset: 2, mood: 6, energy: 5, anxiety: 4, sleepQuality: 7, hoursSlept: 7.5 },
      { dayOffset: 0, mood: 5, energy: 5, anxiety: 4, sleepQuality: 7, hoursSlept: 7.6 },
    ],
    wearableData: [
      { dayOffset: 6, sleepDuration: 7.3, activityLevel: 6, stressEstimate: 4 },
      { dayOffset: 4, sleepDuration: 7.6, activityLevel: 6, stressEstimate: 4 },
      { dayOffset: 2, sleepDuration: 7.5, activityLevel: 6, stressEstimate: 4 },
      { dayOffset: 0, sleepDuration: 7.4, activityLevel: 6, stressEstimate: 4 },
    ],
    phoneBehaviorData: [
      { dayOffset: 6, screenTimeHours: 4.3, nighttimePhoneUseMinutes: 24 },
      { dayOffset: 4, screenTimeHours: 4.0, nighttimePhoneUseMinutes: 18 },
      { dayOffset: 2, screenTimeHours: 4.5, nighttimePhoneUseMinutes: 22 },
      { dayOffset: 0, screenTimeHours: 4.1, nighttimePhoneUseMinutes: 19 },
    ],
    scheduledAppointments: [
      {
        hour: 9,
        minute: 30,
        reason: "Routine sleep and wellness check-in",
        concernLevel: "stable",
      },
    ],
    aiMessages: [
      {
        dayOffset: 1,
        role: "user",
        content: "My week has felt pretty normal and steady.",
      },
      {
        dayOffset: 1,
        role: "assistant",
        content:
          "Your recent check-ins look similar to your usual pattern. Keep using the daily check-in when it feels helpful.",
        concernLevel: "stable",
        recommendedAction: "none",
        flagForClinician: false,
      },
    ],
    aiConversationSummary:
      "Avery described a steady week with no meaningful change from baseline.",
    clinicianSafeDailyNotes: [
      "Recent check-ins and passive summaries are consistent with Avery's usual baseline.",
      "No clinically relevant concerns are apparent in this simulated case.",
    ],
    groundTruth: averyTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Recent check-ins and passive summaries remain close to baseline."],
      evidenceStrength: "high",
      dataQuality: dataQuality("good", "Daily check-ins, wearable summaries, and phone summaries are available."),
      recommendedAction: "No action needed",
      patientFacingSummary: "Your recent patterns look similar to your usual baseline.",
      clinicianFacingSummary:
        "Recent check-ins and passive summaries are consistent with Avery's baseline. No intervention is indicated in this simulated case.",
      supportingSignals: ["Sleep, mood, energy, and phone summaries remain close to baseline."],
      contradictingSignals: ["No concerning change from baseline is apparent."],
    },
  });

  const priyaTruth = createGroundTruth({
    trueConcernScore: 4,
    aiEstimatedConcernScore: 4,
    correctAction: "schedule_appointment",
    trueActionUrgency: 4,
    correctActionText:
      "Approve or schedule a routine appointment while monitoring sleep.",
    challengeTags: ["ai_correct", "missing_information", "appointment_request"],
    challengeScores: { dataMissingness: 2, ambiguity: 3, informationLoad: 4 },
    scenarioPurpose:
      "Tests whether the clinician handles a low-to-moderate sleep-related appointment request without over-escalating.",
    groundTruthRationale:
      "Priya shows mild sleep disruption and requested a routine sleep appointment, without urgent escalation indicators.",
    expectedClinicianReasoning:
      "Approve the requested appointment or monitor sleep, but do not treat the case as urgent.",
  });
  const appointmentRequestPatient = createSimulatedPatientRecord({
    name: "Priya Chen",
    age: 40,
    baselineOverrides: {
      mood: 5,
      energy: 5,
      anxiety: 4,
      hoursSlept: 7.2,
      sleepDuration: 7.1,
    },
    checkIns: [
      { dayOffset: 5, mood: 5, energy: 5, anxiety: 4, hoursSlept: 7.0, sleepQuality: 6 },
      { dayOffset: 3, mood: 4, energy: 4, anxiety: 5, hoursSlept: 6.3, sleepQuality: 5 },
      { dayOffset: 1, mood: 4, energy: 4, anxiety: 5, hoursSlept: 5.9, sleepQuality: 5 },
      { dayOffset: 0, mood: 4, energy: 4, anxiety: 5, hoursSlept: 5.8, sleepQuality: 5, note: "I would like to talk about my recent sleep changes." },
    ],
    wearableData: [
      { dayOffset: 5, sleepDuration: 6.9, activityLevel: 6, stressEstimate: 4 },
      { dayOffset: 3, sleepDuration: 6.2, activityLevel: 5, stressEstimate: 5 },
      { dayOffset: 1, sleepDuration: 5.9, activityLevel: 5, stressEstimate: 5 },
      { dayOffset: 0, sleepDuration: 5.7, activityLevel: 5, stressEstimate: 5 },
    ],
    phoneBehaviorData: [
      { dayOffset: 5, screenTimeHours: 4.7, nighttimePhoneUseMinutes: 25 },
      { dayOffset: 3, screenTimeHours: 5.0, nighttimePhoneUseMinutes: 31 },
      { dayOffset: 1, screenTimeHours: 5.2, nighttimePhoneUseMinutes: 36 },
      { dayOffset: 0, screenTimeHours: 5.3, nighttimePhoneUseMinutes: 38 },
    ],
    appointmentRequests: [
      {
        createdAt: daysAgo(0, 8),
        reason: "Sleep problem",
        note: "Lower sleep for several days and I would like a check-in.",
        status: "pending",
      },
    ],
    aiMessages: [
      {
        dayOffset: 0,
        hour: 7,
        role: "user",
        content: "I am sleeping less than usual and want to request an appointment.",
      },
      {
        dayOffset: 0,
        hour: 7,
        role: "assistant",
        content:
          "It makes sense to ask your care team about sleep changes. I can help send a routine appointment request.",
        concernLevel: "watch",
        recommendedAction: "request_appointment",
        flagForClinician: true,
      },
    ],
    clinicianSafeDailyNotes: [
      "Priya reported difficulty sleeping and requested a routine appointment.",
      "Recent data suggests mild sleep disruption without urgent escalation indicators.",
    ],
    groundTruth: priyaTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Mild sleep decrease plus a patient-submitted appointment request."],
      evidenceStrength: "moderate",
      dataQuality: dataQuality("good", "Self-report, wearable, and phone summaries are available."),
      recommendedAction: "Review appointment request",
      patientFacingSummary:
        "Your sleep has been a little lower than usual. A routine care-team check-in may help.",
      clinicianFacingSummary:
        "Priya reported difficulty sleeping and requested a routine appointment. Recent data suggests mild sleep disruption without urgent escalation indicators.",
      supportingSignals: ["Sleep is mildly below baseline for several days."],
      contradictingSignals: ["Mood and energy changes are mild rather than severe."],
    },
  });

  const jordanTruth = createGroundTruth({
    trueConcernScore: 8,
    aiEstimatedConcernScore: 9,
    correctAction: "schedule_appointment",
    trueActionUrgency: 4,
    correctActionText:
      "Schedule a clinician appointment or request a timely follow-up check-in.",
    challengeTags: ["ai_correct", "ai_overestimate", "misleading_indicator", "signal_noise"],
    challengeScores: { aiError: 1, absoluteAiError: 1, signalNoise: 3, ambiguity: 2, informationLoad: 6 },
    scenarioPurpose:
      "Tests whether clinicians recognize a concerning pattern from converging evidence.",
    groundTruthRationale:
      "Sleep is substantially reduced while energy, mood, impulsivity, and nighttime phone use rise together.",
    expectedClinicianReasoning:
      "Treat the case as elevated and act promptly, while recognizing the AI's urgent label may be slightly high.",
  });
  const elevatedSleepMismatch = createSimulatedPatientRecord({
    name: "Jordan Rivera",
    age: 34,
    baselineOverrides: {
      hoursSlept: 7.2,
      sleepDuration: 7.0,
      energy: 5,
      impulsivity: 2,
      nighttimePhoneUseMinutes: 24,
    },
    checkIns: [
      { dayOffset: 6, mood: 6, energy: 7, anxiety: 4, impulsivity: 5, hoursSlept: 6.1, sleepQuality: 5 },
      { dayOffset: 4, mood: 7, energy: 8, anxiety: 4, impulsivity: 6, hoursSlept: 5.2, sleepQuality: 4 },
      { dayOffset: 2, mood: 7, energy: 8, anxiety: 5, impulsivity: 7, hoursSlept: 4.8, sleepQuality: 3 },
      { dayOffset: 0, mood: 7, energy: 9, anxiety: 5, impulsivity: 8, hoursSlept: 4.2, sleepQuality: 3, note: "Sleeping much less than usual and still feeling very activated." },
    ],
    wearableData: [
      { dayOffset: 6, sleepDuration: 5.8, activityLevel: 7, stressEstimate: 5, restingHeartRate: 71 },
      { dayOffset: 4, sleepDuration: 5.1, activityLevel: 8, stressEstimate: 6, restingHeartRate: 73 },
      { dayOffset: 2, sleepDuration: 4.9, activityLevel: 8, stressEstimate: 6, restingHeartRate: 74 },
      { dayOffset: 0, sleepDuration: 4.1, activityLevel: 8, stressEstimate: 7, restingHeartRate: 75 },
    ],
    phoneBehaviorData: [
      { dayOffset: 6, screenTimeHours: 6.2, nighttimePhoneUseMinutes: 58, spendingAppVisits: 3, unlockFrequency: 78 },
      { dayOffset: 4, screenTimeHours: 7.1, nighttimePhoneUseMinutes: 82, spendingAppVisits: 4, unlockFrequency: 88 },
      { dayOffset: 2, screenTimeHours: 7.6, nighttimePhoneUseMinutes: 97, spendingAppVisits: 4, unlockFrequency: 92 },
      { dayOffset: 0, screenTimeHours: 8.4, nighttimePhoneUseMinutes: 111, spendingAppVisits: 5, unlockFrequency: 96 },
    ],
    scheduledAppointments: [
      {
        hour: 11,
        reason: "Review change from baseline and sleep pattern",
        concernLevel: "elevated",
      },
    ],
    aiMessages: [
      {
        dayOffset: 0,
        hour: 6,
        role: "user",
        content:
          "I have only slept a few hours but feel unusually productive and energized.",
      },
      {
        dayOffset: 0,
        hour: 6,
        role: "assistant",
        content:
          "I am noticing a change from your usual sleep and energy pattern. Would you like help contacting your care team?",
        concernLevel: "elevated",
        recommendedAction: "request_check_in",
        flagForClinician: true,
      },
    ],
    clinicianSafeDailyNotes: [
      "Recent self-report suggests increased activation and productivity while sleep decreased substantially.",
      "Wearable and phone summaries show reduced sleep and increased nighttime phone use.",
    ],
    groundTruth: jordanTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Low sleep + high energy + increased impulsivity + increased nighttime phone use."],
      evidenceStrength: "high",
      dataQuality: dataQuality("good", "Converging self-report, wearable, and phone summaries are available."),
      recommendedAction: "Urgent clinician review",
      patientFacingSummary:
        "Several recent patterns look different from usual. A care-team follow-up may be helpful.",
      clinicianFacingSummary:
        "Patient reported high energy, low sleep, increased nighttime phone use, and elevated impulsivity across recent days. AI estimate may be slightly high but clinician review is warranted.",
      supportingSignals: [
        "Sleep duration decreased from baseline 7.2 h to 4.2 h.",
        "Energy increased from baseline 5/10 to 9/10.",
        "Impulsivity increased from baseline 2/10 to 8/10.",
        "Nighttime phone use increased substantially above baseline.",
      ],
      contradictingSignals: ["No explicit safety language is present in the simulated notes."],
    },
  });

  const chrisTruth = createGroundTruth({
    trueConcernScore: 10,
    aiEstimatedConcernScore: 10,
    correctAction: "escalate_care",
    trueActionUrgency: 5,
    correctActionText:
      "Escalate care in the prototype and document urgent safety follow-up.",
    challengeTags: ["ai_correct", "urgent_safety_case", "high_action_urgency"],
    challengeScores: { ambiguity: 1, informationLoad: 5 },
    scenarioPurpose:
      "Tests whether clinicians appropriately escalate urgent safety concerns.",
    groundTruthRationale:
      "The simulated patient input includes safety-related language alongside low mood, high anxiety, and poor sleep.",
    expectedClinicianReasoning:
      "Recognize safety language as urgent, escalate within the prototype, and avoid relying only on passive data.",
  });
  const urgentCrisisLanguage = createSimulatedPatientRecord({
    name: "Chris Patel",
    age: 31,
    baselineOverrides: {
      mood: 5,
      energy: 5,
      anxiety: 4,
      hoursSlept: 7.1,
      sleepDuration: 7.0,
    },
    checkIns: [
      { dayOffset: 3, mood: 4, energy: 4, anxiety: 6, hoursSlept: 6.2, sleepQuality: 5 },
      { dayOffset: 1, mood: 3, energy: 3, anxiety: 7, hoursSlept: 5.4, sleepQuality: 4 },
      { dayOffset: 0, mood: 2, energy: 2, anxiety: 8, hoursSlept: 4.8, sleepQuality: 3, note: "I do not feel safe tonight and need help." },
    ],
    wearableData: [
      { dayOffset: 3, sleepDuration: 6.0, activityLevel: 5, stressEstimate: 6 },
      { dayOffset: 1, sleepDuration: 5.1, activityLevel: 4, stressEstimate: 7 },
      { dayOffset: 0, sleepDuration: 4.7, activityLevel: 3, stressEstimate: 8 },
    ],
    phoneBehaviorData: [
      { dayOffset: 3, screenTimeHours: 5.1, nighttimePhoneUseMinutes: 61, unlockFrequency: 72 },
      { dayOffset: 1, screenTimeHours: 5.7, nighttimePhoneUseMinutes: 74, unlockFrequency: 80 },
      { dayOffset: 0, screenTimeHours: 6.3, nighttimePhoneUseMinutes: 95, unlockFrequency: 88 },
    ],
    scheduledAppointments: [
      {
        hour: 13,
        reason: "Urgent clinician review",
        concernLevel: "urgent",
      },
    ],
    aiMessages: [
      {
        dayOffset: 0,
        hour: 5,
        role: "user",
        content:
          "I do not feel safe tonight and need someone from the care team to know.",
      },
      {
        dayOffset: 0,
        hour: 5,
        role: "assistant",
        content:
          "I am really glad you told me. This prototype is not an emergency service, but I would flag this for urgent care-team review and suggest emergency resources if there is immediate danger.",
        concernLevel: "urgent",
        recommendedAction: "emergency_resources",
        flagForClinician: true,
      },
    ],
    clinicianSafeDailyNotes: [
      "Recent patient input included safety-related language. Raw private text is not displayed.",
      "Prototype urgent review and escalation are recommended.",
    ],
    groundTruth: chrisTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Safety-related language + low mood + high anxiety + poor sleep."],
      evidenceStrength: "high",
      dataQuality: dataQuality("good", "Recent self-report and passive summaries are available."),
      recommendedAction: "Escalate care",
      patientFacingSummary:
        "A concerning safety-related message was detected. This prototype would recommend urgent care-team follow-up.",
      clinicianFacingSummary:
        "Recent patient input included safety-related language. Raw private text is not displayed. Prototype urgent review and escalation are recommended.",
      supportingSignals: [
        "Safety-related language appeared in recent patient input.",
        "Mood and energy are below baseline while anxiety is elevated.",
        "Sleep is below baseline.",
      ],
      contradictingSignals: [],
    },
  });

  const elenaTruth = createGroundTruth({
    trueConcernScore: 6,
    aiEstimatedConcernScore: 3,
    correctAction: "request_follow_up_check_in",
    trueActionUrgency: 3,
    correctActionText:
      "Request a follow-up check-in because self-report concerns are present despite missing wearable data.",
    challengeTags: ["ai_underestimate", "missing_information", "data_quality_limited", "delayed_or_incomplete_data"],
    challengeScores: { dataMissingness: 8, ambiguity: 4, informationLoad: 5 },
    scenarioPurpose:
      "Tests whether clinicians notice that a stable AI output may be unreliable when data are missing.",
    groundTruthRationale:
      "Wearable data are missing, but self-report shows lower mood, higher anxiety, and reduced sleep.",
    expectedClinicianReasoning:
      "Downgrade confidence in the AI estimate and request more patient-provided information.",
  });
  const missingWearableData = createSimulatedPatientRecord({
    name: "Elena Garcia",
    age: 27,
    baselineOverrides: {
      hoursSlept: 7.4,
      sleepDuration: 7.2,
      screenTimeHours: 5,
    },
    checkIns: [
      { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, hoursSlept: 7.1, sleepQuality: 6 },
      { dayOffset: 2, mood: 4, energy: 4, anxiety: 5, hoursSlept: 6.0, sleepQuality: 5 },
      { dayOffset: 0, mood: 4, energy: 4, anxiety: 6, hoursSlept: 5.8, sleepQuality: 5, note: "My wearable has not synced for a few days." },
    ],
    wearableData: [],
    phoneBehaviorData: [
      { dayOffset: 6, screenTimeHours: 4.8, nighttimePhoneUseMinutes: 24 },
      { dayOffset: 2, screenTimeHours: 5.3, nighttimePhoneUseMinutes: 29 },
      { dayOffset: 0, screenTimeHours: 5.4, nighttimePhoneUseMinutes: 33 },
    ],
    clinicianMessages: [
      {
        message: "Please check whether your wearable has been charging and try another sync tonight.",
        timestamp: daysAgo(1, 16),
      },
    ],
    aiMessages: [
      {
        dayOffset: 0,
        hour: 10,
        role: "user",
        content:
          "My wearable has not synced, but I feel more anxious and lower than usual.",
      },
      {
        dayOffset: 0,
        hour: 10,
        role: "assistant",
        content:
          "Thanks for noting the missing wearable data. Your self-report still matters, and a follow-up check-in could help your care team understand the change.",
        concernLevel: "watch",
        recommendedAction: "request_check_in",
        flagForClinician: false,
      },
    ],
    clinicianSafeDailyNotes: [
      "Elena has limited wearable data in recent days.",
      "Self-report shows lower mood and higher anxiety, but the passive data stream is incomplete, reducing confidence in the AI estimate.",
    ],
    groundTruth: elenaTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Passive wearable data are missing; AI estimate may underweight self-report change."],
      evidenceStrength: "low",
      dataQuality: dataQuality("limited", "Wearable data are missing for recent days.", ["wearable"]),
      recommendedAction: "Continue routine monitoring",
      patientFacingSummary:
        "Some information is missing, so your check-ins are especially helpful right now.",
      clinicianFacingSummary:
        "Elena has limited wearable data in recent days. Self-report shows lower mood and higher anxiety, but the passive data stream is incomplete.",
      supportingSignals: ["Self-report mood is lower and anxiety is higher than baseline."],
      contradictingSignals: ["Wearable data are unavailable, making passive confirmation impossible."],
    },
  });

  const mayaTruth = createGroundTruth({
    trueConcernScore: 3,
    aiEstimatedConcernScore: 8,
    correctAction: "monitor",
    trueActionUrgency: 2,
    correctActionText:
      "Monitor after context review; no urgent escalation is needed in this simulated case.",
    challengeTags: ["ai_overestimate", "misleading_indicator", "context_change", "false_prime", "signal_noise"],
    challengeScores: { signalNoise: 6, ambiguity: 4, falsePrimeStrength: 8, informationLoad: 6 },
    scenarioPurpose:
      "Tests whether clinicians avoid automation bias by checking contextual explanations before escalating.",
    groundTruthRationale:
      "Low sleep and nighttime phone use are explained by a temporary night-shift/deadline context, while mood and impulsivity remain near baseline.",
    expectedClinicianReasoning:
      "Notice the contextual explanation and choose monitoring rather than accepting the elevated AI estimate at face value.",
  });
  const contextChangePatient = createSimulatedPatientRecord({
    name: "Maya Thompson",
    age: 38,
    baselineOverrides: {
      hoursSlept: 7.4,
      sleepDuration: 7.2,
      nighttimePhoneUseMinutes: 20,
      impulsivity: 2,
    },
    checkIns: [
      { dayOffset: 5, mood: 5, energy: 5, anxiety: 4, impulsivity: 2, hoursSlept: 6.4, sleepQuality: 5 },
      { dayOffset: 3, mood: 5, energy: 5, anxiety: 4, impulsivity: 2, hoursSlept: 5.2, sleepQuality: 4 },
      { dayOffset: 1, mood: 5, energy: 5, anxiety: 5, impulsivity: 2, hoursSlept: 4.8, sleepQuality: 4 },
      { dayOffset: 0, mood: 5, energy: 5, anxiety: 5, impulsivity: 2, hoursSlept: 4.6, sleepQuality: 4, note: "Night shift and deadline week are disrupting my sleep." },
    ],
    wearableData: [
      { dayOffset: 5, sleepDuration: 6.3, activityLevel: 7, stressEstimate: 4 },
      { dayOffset: 3, sleepDuration: 5.0, activityLevel: 8, stressEstimate: 5 },
      { dayOffset: 1, sleepDuration: 4.9, activityLevel: 8, stressEstimate: 5 },
      { dayOffset: 0, sleepDuration: 4.7, activityLevel: 8, stressEstimate: 5 },
    ],
    phoneBehaviorData: [
      { dayOffset: 5, screenTimeHours: 5.5, nighttimePhoneUseMinutes: 75, unlockFrequency: 80 },
      { dayOffset: 3, screenTimeHours: 6.2, nighttimePhoneUseMinutes: 96, unlockFrequency: 88 },
      { dayOffset: 1, screenTimeHours: 6.6, nighttimePhoneUseMinutes: 104, unlockFrequency: 91 },
      { dayOffset: 0, screenTimeHours: 6.9, nighttimePhoneUseMinutes: 112, unlockFrequency: 94 },
    ],
    scheduledAppointments: [
      {
        hour: 14,
        minute: 30,
        reason: "Context review after AI flag",
        concernLevel: "elevated",
      },
    ],
    aiMessages: [
      {
        dayOffset: 0,
        hour: 11,
        role: "user",
        content:
          "I am working nights during deadline week, so my sleep and phone use look strange.",
      },
      {
        dayOffset: 0,
        hour: 11,
        role: "assistant",
        content:
          "That context is useful. Your sleep pattern is different from usual, but the reason may matter for how your care team interprets it.",
        concernLevel: "watch",
        recommendedAction: "self_care",
        flagForClinician: false,
      },
    ],
    clinicianSafeDailyNotes: [
      "Maya's sleep and nighttime phone use increased during a documented temporary night-shift/deadline period.",
      "Mood and impulsivity remain near baseline. The elevated AI estimate may reflect a benign context change.",
    ],
    groundTruth: mayaTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Low sleep + increased nighttime phone use + increased activity."],
      evidenceStrength: "moderate",
      dataQuality: dataQuality("good", "Recent self-report and passive summaries are available."),
      recommendedAction: "Clinician review recommended",
      patientFacingSummary:
        "Your sleep and phone-use pattern look different from usual. Context may help your care team interpret this.",
      clinicianFacingSummary:
        "Maya's sleep and nighttime phone use increased during a documented temporary night-shift/deadline period. Mood and impulsivity remain near baseline.",
      supportingSignals: ["Sleep and nighttime phone use are substantially above baseline indicators."],
      contradictingSignals: [
        "Patient reported a temporary night-shift/deadline context.",
        "Mood and impulsivity remain near baseline.",
      ],
    },
  });

  const noahTruth = createGroundTruth({
    trueConcernScore: 7,
    aiEstimatedConcernScore: 4,
    correctAction: "schedule_appointment",
    trueActionUrgency: 4,
    correctActionText:
      "Schedule an appointment or request a timely follow-up based on self-report summaries.",
    challengeTags: ["ai_underestimate", "privacy_limited_data", "ambiguous_cues", "missing_information"],
    challengeScores: { dataMissingness: 5, ambiguity: 7, privacyLimitation: 8, informationLoad: 5 },
    scenarioPurpose:
      "Tests whether clinicians attend to self-report summaries rather than relying only on normal passive metadata.",
    groundTruthRationale:
      "Passive data look normal, but privacy-preserving self-report summaries indicate meaningful withdrawal and low motivation.",
    expectedClinicianReasoning:
      "Give weight to clinician-safe self-report summaries even when wearable and phone metadata look normal.",
  });
  const privacyLimitedPatient = createSimulatedPatientRecord({
    name: "Noah Brooks",
    age: 36,
    baselineOverrides: {
      hoursSlept: 7.3,
      sleepDuration: 7.2,
      screenTimeHours: 4.4,
      nighttimePhoneUseMinutes: 22,
    },
    checkIns: [
      { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, hoursSlept: 7.1, sleepQuality: 7 },
      { dayOffset: 4, mood: 4, energy: 4, anxiety: 4, hoursSlept: 7.0, sleepQuality: 6 },
      { dayOffset: 2, mood: 4, energy: 4, anxiety: 5, hoursSlept: 7.2, sleepQuality: 6 },
      { dayOffset: 0, mood: 3, energy: 3, anxiety: 5, hoursSlept: 7.1, sleepQuality: 6, note: "I prefer not to share raw notes, but things feel harder than usual." },
    ],
    wearableData: [
      { dayOffset: 6, sleepDuration: 7.2, activityLevel: 6, stressEstimate: 4 },
      { dayOffset: 4, sleepDuration: 7.1, activityLevel: 6, stressEstimate: 4 },
      { dayOffset: 2, sleepDuration: 7.3, activityLevel: 5, stressEstimate: 4 },
      { dayOffset: 0, sleepDuration: 7.0, activityLevel: 5, stressEstimate: 5 },
    ],
    phoneBehaviorData: [
      { dayOffset: 6, screenTimeHours: 4.4, nighttimePhoneUseMinutes: 23 },
      { dayOffset: 4, screenTimeHours: 4.2, nighttimePhoneUseMinutes: 20 },
      { dayOffset: 2, screenTimeHours: 4.5, nighttimePhoneUseMinutes: 24 },
      { dayOffset: 0, screenTimeHours: 4.3, nighttimePhoneUseMinutes: 23 },
    ],
    aiMessages: [
      {
        dayOffset: 0,
        hour: 12,
        role: "user",
        content:
          "I do not want to share raw diary text, but I have been withdrawing and motivation is much lower.",
      },
      {
        dayOffset: 0,
        hour: 12,
        role: "assistant",
        content:
          "You can keep private details private. I can summarize that your motivation and social connection feel lower than usual.",
        concernLevel: "watch",
        recommendedAction: "request_check_in",
        flagForClinician: false,
      },
    ],
    clinicianSafeDailyNotes: [
      "Noah's passive summaries appear near baseline, but clinician-safe self-report summary suggests a meaningful mood and motivation change.",
      "Raw diary text is not displayed.",
    ],
    groundTruth: noahTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Passive summaries are near baseline; self-report summary suggests a mood and motivation change."],
      evidenceStrength: "low",
      dataQuality: dataQuality("limited", "Raw private diary content is hidden; only summaries are available.", ["raw diary text"]),
      recommendedAction: "Request follow-up check-in",
      patientFacingSummary:
        "Your private details can stay private. Your check-in suggests a care-team check-in could help.",
      clinicianFacingSummary:
        "Passive summaries appear near baseline, but clinician-safe self-report summary suggests a meaningful mood and motivation change. Raw diary text is not displayed.",
      supportingSignals: ["Clinician-safe self-report summary suggests withdrawal and lower motivation."],
      contradictingSignals: ["Wearable and phone summaries remain close to baseline."],
    },
  });

  const samTruth = createGroundTruth({
    trueConcernScore: 5,
    aiEstimatedConcernScore: 8,
    correctAction: "monitor",
    trueActionUrgency: 2,
    correctActionText:
      "Monitor and check data quality before acting on elevated wearable signals.",
    challengeTags: ["ai_overestimate", "sensor_artifact", "unreliable_data", "signal_noise"],
    challengeScores: { dataMissingness: 5, signalNoise: 8, ambiguity: 5, falsePrimeStrength: 6, informationLoad: 6 },
    scenarioPurpose:
      "Tests whether clinicians consider data quality before accepting the AI concern estimate.",
    groundTruthRationale:
      "Wearable sleep and resting heart rate look concerning, but travel and inconsistent device wear reduce reliability.",
    expectedClinicianReasoning:
      "Check sensor reliability and travel context, then monitor or request clarification rather than escalating.",
  });
  const sensorArtifactPatient = createSimulatedPatientRecord({
    name: "Sam Lee",
    age: 45,
    baselineOverrides: {
      hoursSlept: 7.0,
      sleepDuration: 6.9,
      restingHeartRate: 64,
    },
    checkIns: [
      { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, hoursSlept: 6.7, sleepQuality: 6 },
      { dayOffset: 4, mood: 5, energy: 4, anxiety: 5, hoursSlept: 5.9, sleepQuality: 5 },
      { dayOffset: 2, mood: 5, energy: 4, anxiety: 5, hoursSlept: 5.4, sleepQuality: 4 },
      { dayOffset: 0, mood: 5, energy: 4, anxiety: 5, hoursSlept: 5.8, sleepQuality: 5, note: "Travel and jet lag made my wearable data messy." },
    ],
    wearableData: [
      { dayOffset: 6, sleepDuration: 6.4, sleepQuality: 5, restingHeartRate: 67, activityLevel: 5, stressEstimate: 5 },
      { dayOffset: 4, sleepDuration: 3.9, sleepQuality: 3, restingHeartRate: 78, activityLevel: 4, stressEstimate: 6 },
      { dayOffset: 2, sleepDuration: 4.1, sleepQuality: 3, restingHeartRate: 80, activityLevel: 4, stressEstimate: 6 },
      { dayOffset: 0, sleepDuration: 4.3, sleepQuality: 4, restingHeartRate: 79, activityLevel: 5, stressEstimate: 6 },
    ],
    phoneBehaviorData: [
      { dayOffset: 6, screenTimeHours: 4.7, nighttimePhoneUseMinutes: 28 },
      { dayOffset: 4, screenTimeHours: 5.0, nighttimePhoneUseMinutes: 45 },
      { dayOffset: 2, screenTimeHours: 5.2, nighttimePhoneUseMinutes: 51 },
      { dayOffset: 0, screenTimeHours: 4.9, nighttimePhoneUseMinutes: 47 },
    ],
    scheduledAppointments: [
      {
        hour: 15,
        reason: "Data quality and travel-context review",
        concernLevel: "watch",
      },
    ],
    aiMessages: [
      {
        dayOffset: 0,
        hour: 9,
        role: "user",
        content:
          "I traveled and did not wear the device consistently, so the sleep data may be wrong.",
      },
      {
        dayOffset: 0,
        hour: 9,
        role: "assistant",
        content:
          "Travel and device wear can affect sensor summaries. I will note that data quality may be limited.",
        concernLevel: "watch",
        recommendedAction: "self_care",
        flagForClinician: false,
      },
    ],
    clinicianSafeDailyNotes: [
      "Sam's wearable summaries show disrupted sleep and higher resting heart rate.",
      "Data quality is limited due to possible device wear inconsistency and travel context.",
      "Clinician review should consider sensor reliability.",
    ],
    groundTruth: samTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Wearable sleep disruption + elevated resting heart rate."],
      evidenceStrength: "moderate",
      dataQuality: dataQuality("limited", "Possible device wear inconsistency and travel context reduce reliability.", ["wearable reliability"]),
      recommendedAction: "Clinician review recommended",
      patientFacingSummary:
        "Your wearable summary looks different, but travel or device wear may affect the reading.",
      clinicianFacingSummary:
        "Wearable summaries show disrupted sleep and higher resting heart rate, but data quality is limited by travel and possible device wear inconsistency.",
      supportingSignals: ["Wearable sleep detection is low and resting heart rate is above baseline."],
      contradictingSignals: ["Patient reported travel and inconsistent device wear."],
    },
  });

  const harperTruth = createGroundTruth({
    trueConcernScore: 8,
    aiEstimatedConcernScore: 6,
    correctAction: "schedule_appointment",
    trueActionUrgency: 4,
    correctActionText:
      "Schedule an appointment because multiple moderate indicators combine into elevated concern.",
    challengeTags: ["ai_underestimate", "ambiguous_cues", "multiple_simultaneous_influences", "conflicting_indicators"],
    challengeScores: { ambiguity: 8, signalNoise: 4, informationLoad: 7 },
    scenarioPurpose:
      "Tests whether clinicians synthesize multiple moderate indicators instead of waiting for one obvious urgent indicator.",
    groundTruthRationale:
      "Impulsivity, spending-app visits, nighttime phone use, and sleep all shift moderately in the same concerning direction.",
    expectedClinicianReasoning:
      "Integrate several moderate cues into an elevated concern judgment and schedule follow-up.",
  });
  const ambiguousElevatedPatient = createSimulatedPatientRecord({
    name: "Harper Lewis",
    age: 32,
    baselineOverrides: {
      hoursSlept: 7.5,
      sleepDuration: 7.4,
      spendingAppVisits: 1,
      nighttimePhoneUseMinutes: 24,
    },
    checkIns: [
      { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, impulsivity: 2, hoursSlept: 7.0, sleepQuality: 6 },
      { dayOffset: 4, mood: 6, energy: 6, anxiety: 5, impulsivity: 4, hoursSlept: 6.4, sleepQuality: 5 },
      { dayOffset: 2, mood: 6, energy: 6, anxiety: 5, impulsivity: 5, hoursSlept: 6.0, sleepQuality: 5 },
      { dayOffset: 0, mood: 6, energy: 7, anxiety: 5, impulsivity: 6, hoursSlept: 5.8, sleepQuality: 5, note: "I made a few impulsive choices and stayed up late." },
    ],
    wearableData: [
      { dayOffset: 6, sleepDuration: 7.1, activityLevel: 6, stressEstimate: 4 },
      { dayOffset: 4, sleepDuration: 6.5, activityLevel: 6, stressEstimate: 5 },
      { dayOffset: 2, sleepDuration: 6.0, activityLevel: 7, stressEstimate: 5 },
      { dayOffset: 0, sleepDuration: 5.7, activityLevel: 7, stressEstimate: 5 },
    ],
    phoneBehaviorData: [
      { dayOffset: 6, screenTimeHours: 4.9, nighttimePhoneUseMinutes: 30, spendingAppVisits: 2, unlockFrequency: 65 },
      { dayOffset: 4, screenTimeHours: 5.8, nighttimePhoneUseMinutes: 52, spendingAppVisits: 4, unlockFrequency: 75 },
      { dayOffset: 2, screenTimeHours: 6.2, nighttimePhoneUseMinutes: 61, spendingAppVisits: 5, unlockFrequency: 81 },
      { dayOffset: 0, screenTimeHours: 6.7, nighttimePhoneUseMinutes: 68, spendingAppVisits: 6, unlockFrequency: 86 },
    ],
    aiMessages: [
      {
        dayOffset: 0,
        hour: 13,
        role: "user",
        content:
          "Nothing feels extreme, but I am staying up later and making more spontaneous choices.",
      },
      {
        dayOffset: 0,
        hour: 13,
        role: "assistant",
        content:
          "Several small changes together can still be worth sharing with your care team.",
        concernLevel: "watch",
        recommendedAction: "request_appointment",
        flagForClinician: true,
      },
    ],
    clinicianSafeDailyNotes: [
      "Harper shows several moderate changes across impulsivity, nighttime phone use, spending-app visits, and sleep.",
      "No single indicator is extreme, but the combined pattern suggests elevated concern.",
    ],
    groundTruth: harperTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Multiple moderate changes without one extreme single indicator."],
      evidenceStrength: "moderate",
      dataQuality: dataQuality("good", "Self-report, wearable, and phone summaries are available."),
      recommendedAction: "Request follow-up check-in",
      patientFacingSummary:
        "I am noticing some changes from your usual pattern. A care-team check-in may be useful.",
      clinicianFacingSummary:
        "Harper shows several moderate changes across impulsivity, nighttime phone use, spending-app visits, and sleep. No single indicator is extreme.",
      supportingSignals: [
        "Impulsivity increased from baseline.",
        "Spending app visits and nighttime phone use increased.",
        "Sleep is moderately below baseline.",
      ],
      contradictingSignals: ["Mood is not dramatically low and no safety language is present."],
    },
  });

  const oliviaTruth = createGroundTruth({
    trueConcernScore: 5,
    aiEstimatedConcernScore: 5,
    correctAction: "monitor",
    trueActionUrgency: 2,
    correctActionText:
      "Monitor or request a follow-up check-in if uncertainty persists.",
    challengeTags: ["ambiguous_cues", "conflicting_indicators", "uncertainty", "ai_correct_but_low_confidence"],
    challengeScores: { ambiguity: 7, signalNoise: 3, informationLoad: 5 },
    scenarioPurpose:
      "Tests whether clinicians recognize uncertainty and choose monitoring rather than overconfident escalation or dismissal.",
    groundTruthRationale:
      "Sleep and anxiety are mildly concerning while mood, energy, and phone summaries remain near baseline.",
    expectedClinicianReasoning:
      "Acknowledge mixed evidence, keep concern at watch, and monitor or request a follow-up check-in.",
  });
  const mixedUncertainPatient = createSimulatedPatientRecord({
    name: "Olivia Martinez",
    age: 42,
    baselineOverrides: {
      hoursSlept: 7.3,
      sleepDuration: 7.2,
      anxiety: 4,
    },
    checkIns: [
      { dayOffset: 6, mood: 5, energy: 5, anxiety: 4, hoursSlept: 7.0, sleepQuality: 6 },
      { dayOffset: 4, mood: 5, energy: 5, anxiety: 5, hoursSlept: 6.4, sleepQuality: 5 },
      { dayOffset: 2, mood: 5, energy: 5, anxiety: 5, hoursSlept: 6.1, sleepQuality: 5 },
      { dayOffset: 0, mood: 5, energy: 5, anxiety: 6, hoursSlept: 5.9, sleepQuality: 5, note: "Sleep is a bit off, but my mood and energy feel mostly steady." },
    ],
    wearableData: [
      { dayOffset: 6, sleepDuration: 6.9, activityLevel: 6, stressEstimate: 4 },
      { dayOffset: 4, sleepDuration: 6.3, activityLevel: 6, stressEstimate: 5 },
      { dayOffset: 2, sleepDuration: 6.0, activityLevel: 6, stressEstimate: 5 },
      { dayOffset: 0, sleepDuration: 5.9, activityLevel: 6, stressEstimate: 5 },
    ],
    phoneBehaviorData: [
      { dayOffset: 6, screenTimeHours: 4.5, nighttimePhoneUseMinutes: 22 },
      { dayOffset: 4, screenTimeHours: 4.6, nighttimePhoneUseMinutes: 24 },
      { dayOffset: 2, screenTimeHours: 4.8, nighttimePhoneUseMinutes: 23 },
      { dayOffset: 0, screenTimeHours: 4.7, nighttimePhoneUseMinutes: 25 },
    ],
    aiMessages: [
      {
        dayOffset: 0,
        hour: 14,
        role: "user",
        content:
          "My sleep is lower and I feel more anxious, but mood and energy seem steady.",
      },
      {
        dayOffset: 0,
        hour: 14,
        role: "assistant",
        content:
          "That sounds mixed rather than clear-cut. Monitoring and another check-in may help your care team see whether it settles.",
        concernLevel: "watch",
        recommendedAction: "request_check_in",
        flagForClinician: false,
      },
    ],
    clinicianSafeDailyNotes: [
      "Olivia's data are mixed: sleep is lower and anxiety is somewhat elevated.",
      "Mood, energy, and phone behavior remain near baseline. Monitoring or follow-up check-in is appropriate.",
    ],
    groundTruth: oliviaTruth,
    mockAIConcernAssessment: {
      keyReasons: ["Mixed indicators: lower sleep and higher anxiety, but stable mood and energy."],
      evidenceStrength: "low",
      dataQuality: dataQuality("good", "Self-report, wearable, and phone summaries are available."),
      recommendedAction: "Monitor and consider follow-up check-in",
      patientFacingSummary:
        "Some patterns look a little different, while others look steady. Another check-in may help.",
      clinicianFacingSummary:
        "Olivia's data are mixed: sleep is lower and anxiety is somewhat elevated, but mood, energy, and phone behavior remain near baseline.",
      supportingSignals: ["Sleep is below baseline and anxiety is somewhat elevated."],
      contradictingSignals: ["Mood, energy, and phone behavior remain near baseline."],
    },
  });

  return [
    stablePatient,
    appointmentRequestPatient,
    elevatedSleepMismatch,
    urgentCrisisLanguage,
    missingWearableData,
    contextChangePatient,
    privacyLimitedPatient,
    sensorArtifactPatient,
    ambiguousElevatedPatient,
    mixedUncertainPatient,
  ];
}

export function createInitialPrototypeState(): PrototypeState {
  const patients = createSimulatedPatients();
  const selectedPatientId = patients[0]?.profile.id;

  return {
    setupComplete: true,
    primaryPatientId: selectedPatientId,
    selectedPatientId,
    selectedClinicianPatientId: selectedPatientId,
    clinicianAiEnabled: true,
    evaluationLog: [],
    jatSubmissions: [],
    patients,
    updatedAt: new Date().toISOString(),
  };
}

export function generateSimulatedWearableData(
  patientId: string,
  baseline: PatientBaseline,
): WearableData {
  const variance = () => (Math.random() - 0.5) * 1.6;

  return buildWearable(patientId, new Date().toISOString(), {
    sleepDuration: Number(Math.max(3.5, baseline.sleepDuration + variance()).toFixed(1)),
    sleepQuality: Math.round(
      Math.max(0, Math.min(10, baseline.sleepQuality + variance() * 2)),
    ),
    restingHeartRate: Math.round(Math.max(48, baseline.restingHeartRate + variance() * 8)),
    activityLevel: Math.round(
      Math.max(0, Math.min(10, baseline.activityLevel + variance() * 2)),
    ),
    stressEstimate: Math.round(
      Math.max(0, Math.min(10, baseline.stressEstimate + variance() * 2)),
    ),
  });
}

export function generateSimulatedPhoneBehaviorData(
  patientId: string,
  baseline: PatientBaseline,
): PhoneBehaviorData {
  const variance = () => (Math.random() - 0.5) * 1.8;

  return buildPhoneBehavior(patientId, new Date().toISOString(), {
    screenTimeHours: Number(
      Math.max(1.5, baseline.screenTimeHours + variance() * 2).toFixed(1),
    ),
    nighttimePhoneUseMinutes: Math.round(
      Math.max(0, baseline.nighttimePhoneUseMinutes + variance() * 35),
    ),
    socialAppUsageMinutes: Math.round(
      Math.max(0, baseline.socialAppUsageMinutes + variance() * 25),
    ),
    spendingAppVisits: Math.max(
      0,
      Math.round(baseline.spendingAppVisits + variance() * 2),
    ),
    unlockFrequency: Math.max(
      10,
      Math.round(baseline.unlockFrequency + variance() * 18),
    ),
  });
}
