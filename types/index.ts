export type ConcernLevel = "stable" | "watch" | "elevated" | "urgent";

export type ConcernLabel = ConcernLevel;

export type JATChallengeTag =
  | "ai_correct"
  | "ai_overestimate"
  | "ai_underestimate"
  | "misleading_indicator"
  | "missing_information"
  | "signal_noise"
  | "false_prime"
  | "ambiguous_cues"
  | "data_overload"
  | "privacy_limited_data"
  | "sensor_artifact"
  | "context_change"
  | "conflicting_indicators"
  | "delayed_self_report"
  | "appointment_request"
  | "urgent_safety_case"
  | "high_action_urgency"
  | "data_quality_limited"
  | "delayed_or_incomplete_data"
  | "multiple_simultaneous_influences"
  | "uncertainty"
  | "ai_correct_but_low_confidence"
  | "unreliable_data";

export type JATTesterAction =
  | "no_action"
  | "monitor"
  | "send_message"
  | "request_follow_up_check_in"
  | "schedule_appointment"
  | "escalate_care";

export type MedicationStatus = "yes" | "no" | "partial" | "not-applicable";

export type AppointmentReason =
  | "Routine check-in"
  | "Sleep problem"
  | "Mood change"
  | "Medication question"
  | "Urgent concern";

export type EvidenceStrength = "low" | "moderate" | "high";

export type DataQualityLevel = "good" | "limited" | "missing";

export type ClinicianActionStatus =
  | "no-action-needed"
  | "review-needed"
  | "appointment-requested"
  | "message-sent"
  | "reviewed";

export type AppointmentRequestStatus =
  | "pending"
  | "approved"
  | "reviewed"
  | "more-info-requested";

export type ScheduledAppointmentStatus = "scheduled" | "completed" | "canceled";

export type ClinicianOverrideReason =
  | "AI overestimated concern"
  | "AI underestimated concern"
  | "Missing context"
  | "Patient already contacted"
  | "Data quality issue"
  | "Other";

export type EvaluationEventType =
  | "dashboard-opened"
  | "patient-opened"
  | "patient-panel-viewed"
  | "patient-reviewed"
  | "appointment-request-processed"
  | "clinician-message-sent"
  | "follow-up-check-in-requested"
  | "care-escalated"
  | "concern-overridden"
  | "jat-judgment-submitted"
  | "assistant-query";

export interface PatientGroundTruth {
  trueConcernScore: number;
  trueConcernLabel: ConcernLabel;
  trueActionUrgency: number;
  correctAction: JATTesterAction;
  correctActionText: string;
  aiEstimatedConcernScore: number;
  aiEstimatedConcernLabel: ConcernLabel;
  challengeTags: JATChallengeTag[];
  challengeScores: {
    aiError: number;
    absoluteAiError: number;
    dataMissingness: number;
    signalNoise: number;
    ambiguity: number;
    falsePrimeStrength: number;
    privacyLimitation: number;
    informationLoad: number;
  };
  scenarioPurpose: string;
  groundTruthRationale: string;
  expectedClinicianReasoning: string;
}

export interface JATTesterSubmission {
  id: string;
  patientId: string;
  submittedAt: string;
  testerConcernScore: number;
  testerConcernLabel: ConcernLabel;
  testerAction: JATTesterAction;
  testerActionUrgency: number;
  testerConfidence: number;
  agreedWithAI: boolean;
  testerNote?: string;
  openedDetailView?: boolean;
  viewedPanels?: string[];
  timeToDecisionMs?: number;
  computedMetrics: {
    signedTesterError: number;
    absoluteTesterError: number;
    signedAiError: number;
    absoluteAiError: number;
    actionError: number | null;
    appropriateOverride: boolean | null;
    confidenceCalibrationError: number | null;
  };
}

export interface SharingPreferences {
  shareDailyCheckInsWithClinician: boolean;
  shareWearableSummariesWithClinician: boolean;
  sharePhoneBehaviorSummariesWithClinician: boolean;
  allowAIToFlagConcerningPatterns: boolean;
  allowClinicianToSeeAISummaries: boolean;
  shareRawNotesWithClinician?: boolean;
}

export interface PatientProfile {
  id: string;
  name: string;
  age?: number;
  pronouns?: string;
  consentWearableMonitoring: boolean;
  consentPhoneMonitoring: boolean;
  connectClinicianDashboard: boolean;
  createdAt: string;
  sharingPreferences: SharingPreferences;
  isPrimaryPatient?: boolean;
}

export interface DailyCheckIn {
  id: string;
  patientId: string;
  timestamp: string;
  mood: number;
  energy: number;
  anxiety: number;
  irritability: number;
  sleepQuality: number;
  impulsivity: number;
  hoursSlept: number;
  medicationTakenToday: MedicationStatus;
  note?: string;
}

export interface WearableData {
  id: string;
  patientId: string;
  timestamp: string;
  sleepDuration: number;
  sleepQuality: number;
  restingHeartRate: number;
  activityLevel: number;
  stressEstimate: number;
  source: "simulated";
}

export interface PhoneBehaviorData {
  id: string;
  patientId: string;
  timestamp: string;
  screenTimeHours: number;
  nighttimePhoneUseMinutes: number;
  socialAppUsageMinutes: number;
  spendingAppVisits: number;
  unlockFrequency: number;
  privacySummary: string;
  source: "simulated";
}

export interface AIMessage {
  id: string;
  patientId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  concernLevel?: ConcernLevel;
  recommendedAction?: string;
  flagForClinician?: boolean;
}

export interface ClinicianMessage {
  id: string;
  patientId: string;
  message: string;
  timestamp: string;
  sender: "clinician";
  status: "sent";
}

export interface DataQualitySummary {
  level: DataQualityLevel;
  missingSources: string[];
  note: string;
}

export interface TrendDelta {
  metric: string;
  baseline: number;
  recent: number;
  unit: string;
  direction: "higher" | "lower" | "near";
  percentChange?: number;
  consecutiveDays?: number;
  explanation: string;
}

export interface PatientTrendSummary {
  cards: string[];
  trendDeltas: TrendDelta[];
}

export interface AIConcernAssessment {
  concernLevel: ConcernLevel;
  concernScore: number;
  changeFromBaselineScore: number;
  keyReasons: string[];
  evidenceStrength: EvidenceStrength;
  dataQuality: DataQualitySummary;
  recommendedAction: string;
  patientFacingSummary: string;
  clinicianFacingSummary: string;
  supportingSignals: string[];
  contradictingSignals: string[];
  trendSummary: PatientTrendSummary;
  lastDataSyncAt: string;
  timestamp: string;
}

export type RiskSummary = AIConcernAssessment;

export interface ClinicianAlert {
  id: string;
  patientId: string;
  createdAt: string;
  source: "risk-engine" | "ai-assistant" | "appointment-request" | "patient-help-request";
  concernLevel: ConcernLevel;
  reason: string;
  aiSummary?: string;
  status: "new" | "reviewed" | "actioned";
  recommendedAction: string;
  linkedAppointmentRequestId?: string;
}

export interface AppointmentRequest {
  id: string;
  patientId: string;
  createdAt: string;
  reason: AppointmentReason;
  note?: string;
  status: AppointmentRequestStatus;
  clinicianResponseNote?: string;
  updatedAt?: string;
}

export interface ScheduledAppointment {
  id: string;
  patientId: string;
  scheduledFor: string;
  reason: string;
  concernLevel: ConcernLevel;
  note?: string;
  source: "simulated" | "patient-request" | "clinician-created";
  status: ScheduledAppointmentStatus;
}

export interface CarePlan {
  patientId: string;
  warningSigns: string;
  calmingStrategies: string;
  trustedPeople: string;
  preferredClinicianContactMethod: string;
  dataSharingPreferencesNote: string;
}

export interface ClinicianAction {
  id: string;
  patientId: string;
  createdAt: string;
  actionType:
    | "mark-reviewed"
    | "send-supportive-message"
    | "request-follow-up-check-in"
    | "approve-appointment"
    | "request-appointment-info"
    | "review-appointment-request"
    | "escalate-care"
    | "change-concern-level";
  note: string;
  metadata?: Record<string, string>;
}

export interface ClinicianOverride {
  id: string;
  patientId: string;
  originalAIConcernLevel: ConcernLevel;
  originalAIConcernScore?: number;
  clinicianConcernLevel: ConcernLevel;
  clinicianConcernScore?: number;
  reason: ClinicianOverrideReason;
  note?: string;
  timestamp: string;
}

export interface PatientNotification {
  id: string;
  patientId: string;
  createdAt: string;
  title: string;
  message: string;
  type:
    | "clinician-message"
    | "appointment-update"
    | "care-update"
    | "ai-flag"
    | "review-status";
  read: boolean;
}

export interface PatientBaseline {
  mood: number;
  energy: number;
  anxiety: number;
  irritability: number;
  sleepQuality: number;
  impulsivity: number;
  hoursSlept: number;
  sleepDuration: number;
  restingHeartRate: number;
  activityLevel: number;
  stressEstimate: number;
  screenTimeHours: number;
  nighttimePhoneUseMinutes: number;
  socialAppUsageMinutes: number;
  spendingAppVisits: number;
  unlockFrequency: number;
}

export interface ClinicianViewPatientSummary {
  patientId: string;
  name: string;
  age?: number;
  lastCheckInAt?: string;
  aiEstimatedConcernLevel?: ConcernLevel;
  aiEstimatedConcernScore?: number;
  clinicianConfirmedConcernLevel?: ConcernLevel;
  clinicianConfirmedConcernScore?: number;
  changeFromBaselineScore?: number;
  keyReason: string;
  evidenceStrength?: EvidenceStrength;
  dataQuality: DataQualitySummary;
  actionStatus: ClinicianActionStatus;
  sleepSparkline: number[];
  moodSparkline: number[];
  energySparkline: number[];
  sleepBaseline: number;
  moodBaseline: number;
  energyBaseline: number;
  sleepTrendConcerning: boolean;
  moodTrendConcerning: boolean;
  energyTrendConcerning: boolean;
  hasPendingAppointmentRequest: boolean;
  hasAiFlag: boolean;
}

export interface EvaluationEvent {
  id: string;
  timestamp: string;
  type: EvaluationEventType;
  patientId?: string;
  details?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface PatientRecord {
  profile: PatientProfile;
  monitoringReason: string;
  baseline: PatientBaseline;
  carePlan: CarePlan;
  checkIns: DailyCheckIn[];
  wearableData: WearableData[];
  phoneBehaviorData: PhoneBehaviorData[];
  aiMessages: AIMessage[];
  clinicianMessages: ClinicianMessage[];
  clinicianAlerts: ClinicianAlert[];
  appointmentRequests: AppointmentRequest[];
  scheduledAppointments: ScheduledAppointment[];
  clinicianActions: ClinicianAction[];
  clinicianOverrides: ClinicianOverride[];
  notifications: PatientNotification[];
  aiConversationSummary?: string;
  clinicianSafeDailyNotes?: string[];
  groundTruth?: PatientGroundTruth;
  mockAIConcernAssessment?: AIConcernAssessment;
  latestRisk: AIConcernAssessment;
}

export interface PrototypeState {
  setupComplete: boolean;
  primaryPatientId?: string;
  selectedPatientId?: string;
  patients: PatientRecord[];
  selectedClinicianPatientId?: string;
  clinicianAiEnabled: boolean;
  evaluationLog: EvaluationEvent[];
  jatSubmissions: JATTesterSubmission[];
  updatedAt: string;
}

export interface TestUserScenarioInput {
  name: string;
  age?: number;
  pronouns?: string;
  baselineSleepDuration: number;
  baselineMood: number;
  baselineEnergy: number;
  concernLevel: ConcernLevel;
  keyReason: string;
  consentWearableMonitoring: boolean;
  consentPhoneMonitoring: boolean;
  shareDataWithClinician: boolean;
  latestMood: number;
  latestEnergy: number;
  latestHoursSlept: number;
  latestSleepQuality: number;
  latestNighttimePhoneUseMinutes: number;
  latestScreenTimeHours: number;
}

export type PatientAssistantRecommendedAction =
  | "none"
  | "self_care"
  | "request_check_in"
  | "request_appointment"
  | "contact_trusted_person"
  | "emergency_resources";

export interface PatientAssistantResponse {
  message: string;
  concernLevel: ConcernLevel;
  recommendedAction: PatientAssistantRecommendedAction;
  flagForClinician: boolean;
  clinicianSafeSummary: string;
  suggestedPatientNotification: string;
}

export type ClinicianAssistantActionType =
  | "review"
  | "message_patient"
  | "request_check_in"
  | "approve_appointment"
  | "escalate_care"
  | "no_action";

export interface ClinicianAssistantActionRecommendation {
  patientId: string;
  action: ClinicianAssistantActionType;
  rationale: string;
}

export interface ClinicianAssistantAlertSuggestion {
  patientId: string;
  concernLevel: ConcernLevel;
  reason: string;
}

export interface ClinicianAssistantResponse {
  response: string;
  patientsMentioned: string[];
  recommendedActions: ClinicianAssistantActionRecommendation[];
  alertsToCreate: ClinicianAssistantAlertSuggestion[];
  draftMessageToPatient: string;
}

export interface PatientAssistantRequestBody {
  mode: "patient";
  userMessage: string;
  patientProfile: PatientProfile;
  recentCheckIns: DailyCheckIn[];
  wearableSummary?: WearableData;
  phoneBehaviorSummary?: PhoneBehaviorData;
  currentRiskSummary: RiskSummary;
}

export interface ClinicianAssistantRequestBody {
  mode: "clinician";
  query: string;
  patients: PatientRecord[];
  selectedPatientId?: string;
}

export type GeminiRouteRequestBody =
  | PatientAssistantRequestBody
  | ClinicianAssistantRequestBody;

export type GeminiRouteResponseBody =
  | PatientAssistantResponse
  | ClinicianAssistantResponse;

export type GeminiAssistantResponse = PatientAssistantResponse;
