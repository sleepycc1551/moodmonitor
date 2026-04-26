import type {
  ConcernLabel,
  EvaluationEvent,
  JATTesterAction,
  JATTesterSubmission,
  PatientRecord,
} from "@/types";

export function concernScoreToLabel(score: number): ConcernLabel {
  if (score >= 9) return "urgent";
  if (score >= 7) return "elevated";
  if (score >= 4) return "watch";
  return "stable";
}

export function actionToUrgency(action: string): number {
  const normalized = action as JATTesterAction;

  if (normalized === "escalate_care") return 5;
  if (normalized === "schedule_appointment") return 4;
  if (
    normalized === "send_message" ||
    normalized === "request_follow_up_check_in"
  ) {
    return 3;
  }
  if (normalized === "monitor") return 2;
  return 1;
}

export function computeJATPerformance(input: {
  aiEstimatedConcernScore: number;
  aiWasOverridden?: boolean;
  testerActionUrgency?: number;
  testerConfidence?: number;
  testerSubmittedConcernScore: number;
  trueActionUrgency?: number;
  trueConcernScore: number;
}) {
  const signedTesterError =
    input.testerSubmittedConcernScore - input.trueConcernScore;
  const absoluteTesterError = Math.abs(signedTesterError);
  const signedAiError =
    input.aiEstimatedConcernScore - input.trueConcernScore;
  const absoluteAiError = Math.abs(signedAiError);
  const actionError =
    typeof input.testerActionUrgency === "number" &&
    typeof input.trueActionUrgency === "number"
      ? Math.abs(input.testerActionUrgency - input.trueActionUrgency)
      : null;

  let appropriateOverride: boolean | null = null;
  if (absoluteAiError > 0) {
    if (input.aiWasOverridden) {
      appropriateOverride = absoluteTesterError < absoluteAiError;
    } else if (absoluteAiError >= 2) {
      appropriateOverride = false;
    }
  } else if (input.aiWasOverridden) {
    appropriateOverride = false;
  }

  const confidenceCalibrationError =
    typeof input.testerConfidence === "number"
      ? absoluteTesterError * (input.testerConfidence / 10)
      : null;

  return {
    signedTesterError,
    absoluteTesterError,
    signedAiError,
    absoluteAiError,
    actionError,
    appropriateOverride,
    confidenceCalibrationError,
  };
}

export function latestSubmissionForPatient(
  submissions: JATTesterSubmission[],
  patientId: string,
): JATTesterSubmission | undefined {
  return submissions
    .filter((submission) => submission.patientId === patientId)
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))
    .at(-1);
}

export function computeAggregateJATMetrics(
  patients: PatientRecord[],
  submissions: JATTesterSubmission[],
) {
  const jatPatients = patients.filter((patient) => patient.groundTruth);
  const completedSubmissions = jatPatients
    .map((patient) => latestSubmissionForPatient(submissions, patient.profile.id))
    .filter(Boolean) as JATTesterSubmission[];

  const aiErrors = jatPatients.map(
    (patient) => patient.groundTruth?.challengeScores.absoluteAiError ?? 0,
  );
  const testerErrors = completedSubmissions.map(
    (submission) => submission.computedMetrics.absoluteTesterError,
  );
  const actionErrors = completedSubmissions
    .map((submission) => submission.computedMetrics.actionError)
    .filter((value): value is number => typeof value === "number");
  const appropriateOverrideValues = completedSubmissions
    .map((submission) => submission.computedMetrics.appropriateOverride)
    .filter((value): value is boolean => typeof value === "boolean");
  const calibrationErrors = completedSubmissions
    .map((submission) => submission.computedMetrics.confidenceCalibrationError)
    .filter((value): value is number => typeof value === "number");

  return {
    meanAbsoluteTesterError: average(testerErrors),
    meanAbsoluteAiError: average(aiErrors),
    meanActionError: average(actionErrors),
    appropriateOverrideRate: appropriateOverrideValues.length
      ? appropriateOverrideValues.filter(Boolean).length /
        appropriateOverrideValues.length
      : null,
    meanConfidenceCalibrationError: average(calibrationErrors),
    numberOfCases: jatPatients.length,
    numberOfCompletedSubmissions: completedSubmissions.length,
  };
}

export function buildJATExportPayload(input: {
  events: EvaluationEvent[];
  patients: PatientRecord[];
  submissions: JATTesterSubmission[];
}) {
  return {
    exportedAt: new Date().toISOString(),
    patients: input.patients.map((patient) => {
      const testerSubmission = latestSubmissionForPatient(
        input.submissions,
        patient.profile.id,
      );

      return {
        patientId: patient.profile.id,
        patientName: patient.profile.name,
        groundTruth: patient.groundTruth,
        aiEstimate: patient.groundTruth
          ? {
              concernScore: patient.groundTruth.aiEstimatedConcernScore,
              concernLabel: patient.groundTruth.aiEstimatedConcernLabel,
            }
          : {
              concernScore: patient.latestRisk.concernScore,
              concernLabel: patient.latestRisk.concernLevel,
            },
        latestRisk: patient.latestRisk,
        testerSubmission,
        computedMetrics: testerSubmission?.computedMetrics,
        challengeTags: patient.groundTruth?.challengeTags ?? [],
        challengeScores: patient.groundTruth?.challengeScores,
        scenarioPurpose: patient.groundTruth?.scenarioPurpose ?? "",
      };
    }),
    aggregateMetrics: computeAggregateJATMetrics(
      input.patients,
      input.submissions,
    ),
    rawInteractionLog: input.events,
  };
}

export function buildJATCsv(
  patients: PatientRecord[],
  submissions: JATTesterSubmission[],
): string {
  const columns = [
    "patientId",
    "patientName",
    "trueConcernScore",
    "aiEstimatedConcernScore",
    "testerConcernScore",
    "signedAiError",
    "absoluteAiError",
    "signedTesterError",
    "absoluteTesterError",
    "trueActionUrgency",
    "testerActionUrgency",
    "actionError",
    "testerConfidence",
    "confidenceCalibrationError",
    "agreedWithAI",
    "appropriateOverride",
    "challengeTags",
    "dataMissingness",
    "signalNoise",
    "ambiguity",
    "falsePrimeStrength",
    "privacyLimitation",
    "informationLoad",
    "scenarioPurpose",
  ];

  const rows = patients.map((patient) => {
    const groundTruth = patient.groundTruth;
    const submission = latestSubmissionForPatient(
      submissions,
      patient.profile.id,
    );

    return [
      patient.profile.id,
      patient.profile.name,
      groundTruth?.trueConcernScore ?? "",
      groundTruth?.aiEstimatedConcernScore ?? patient.latestRisk.concernScore,
      submission?.testerConcernScore ?? "",
      submission?.computedMetrics.signedAiError ??
        groundTruth?.challengeScores.aiError ??
        "",
      submission?.computedMetrics.absoluteAiError ??
        groundTruth?.challengeScores.absoluteAiError ??
        "",
      submission?.computedMetrics.signedTesterError ?? "",
      submission?.computedMetrics.absoluteTesterError ?? "",
      groundTruth?.trueActionUrgency ?? "",
      submission?.testerActionUrgency ?? "",
      submission?.computedMetrics.actionError ?? "",
      submission?.testerConfidence ?? "",
      submission?.computedMetrics.confidenceCalibrationError ?? "",
      submission?.agreedWithAI ?? "",
      submission?.computedMetrics.appropriateOverride ?? "",
      groundTruth?.challengeTags.join("|") ?? "",
      groundTruth?.challengeScores.dataMissingness ?? "",
      groundTruth?.challengeScores.signalNoise ?? "",
      groundTruth?.challengeScores.ambiguity ?? "",
      groundTruth?.challengeScores.falsePrimeStrength ?? "",
      groundTruth?.challengeScores.privacyLimitation ?? "",
      groundTruth?.challengeScores.informationLoad ?? "",
      groundTruth?.scenarioPurpose ?? "",
    ];
  });

  return [columns, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\n");
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
