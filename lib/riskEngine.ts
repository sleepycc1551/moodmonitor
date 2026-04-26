import { formatChartDate } from "@/lib/dateFormat";
import type {
  AIConcernAssessment,
  ClinicianActionStatus,
  ConcernLevel,
  DailyCheckIn,
  DataQualityLevel,
  DataQualitySummary,
  EvidenceStrength,
  PatientBaseline,
  PatientRecord,
  PatientTrendSummary,
  TrendDelta,
  WearableData,
} from "@/types";

const CRISIS_PATTERNS = [
  "kill myself",
  "want to die",
  "hurt myself",
  "end my life",
  "not safe",
  "suicide",
  "self harm",
  "self-harm",
  "immediate danger",
  "can't stay safe",
  "do not feel safe",
];

const concernWeight: Record<ConcernLevel, number> = {
  stable: 0,
  watch: 1,
  elevated: 2,
  urgent: 3,
};

const defaultConcernScoreByLevel: Record<ConcernLevel, number> = {
  stable: 2,
  watch: 5,
  elevated: 8,
  urgent: 10,
};

const actionStatusLabels: Record<ClinicianActionStatus, string> = {
  "no-action-needed": "No action needed",
  "review-needed": "Review needed",
  "appointment-requested": "Appointment requested",
  "message-sent": "Message sent",
  reviewed: "Reviewed",
};

function latest<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

function recentSlice<T>(items: T[], count: number): T[] {
  return items.slice(Math.max(items.length - count, 0));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function differenceInHours(isoString: string): number {
  return Math.abs(Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatMetricLabel(metric: string): string {
  return metric.charAt(0).toUpperCase() + metric.slice(1).replace(/([A-Z])/g, " $1");
}

function percentDelta(recent: number, baseline: number): number {
  if (!baseline) return 0;
  return Math.round(((recent - baseline) / baseline) * 100);
}

function directionFromValues(
  recent: number,
  baseline: number,
): TrendDelta["direction"] {
  if (recent >= baseline + 0.75) return "higher";
  if (recent <= baseline - 0.75) return "lower";
  return "near";
}

function countConsecutiveDays(
  values: number[],
  predicate: (value: number) => boolean,
): number {
  let count = 0;

  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (!predicate(values[index])) break;
    count += 1;
  }

  return count;
}

export function detectSelfHarmLanguage(text?: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return CRISIS_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function buildDataQualitySummary(record: PatientRecord): DataQualitySummary {
  const latestCheckIn = latest(record.checkIns);
  const latestWearable = latest(record.wearableData);
  const latestPhone = latest(record.phoneBehaviorData);
  const missingSources: string[] = [];
  const staleSources: string[] = [];

  if (!latestCheckIn) {
    missingSources.push("self-report check-in");
  } else if (differenceInHours(latestCheckIn.timestamp) > 36) {
    staleSources.push("self-report check-in");
  }

  if (record.profile.consentWearableMonitoring) {
    if (!latestWearable) {
      missingSources.push("wearable summary");
    } else if (differenceInHours(latestWearable.timestamp) > 48) {
      staleSources.push("wearable summary");
    }
  }

  if (record.profile.consentPhoneMonitoring) {
    if (!latestPhone) {
      missingSources.push("phone behavior summary");
    } else if (differenceInHours(latestPhone.timestamp) > 48) {
      staleSources.push("phone behavior summary");
    }
  }

  let level: DataQualityLevel = "good";

  if (!latestCheckIn || missingSources.length >= 2) {
    level = "missing";
  } else if (missingSources.length > 0 || staleSources.length > 0) {
    level = "limited";
  }

  if (level === "good") {
    return {
      level,
      missingSources: [],
      note: "Recent self-report and monitoring summaries are available and current.",
    };
  }

  const notes = [
    missingSources.length
      ? `Missing: ${missingSources.join(", ")}.`
      : undefined,
    staleSources.length
      ? `Potentially stale: ${staleSources.join(", ")}.`
      : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    level,
    missingSources: [...missingSources, ...staleSources],
    note:
      notes ||
      "Recent monitoring data is incomplete and should be interpreted cautiously.",
  };
}

function buildTrendDelta(
  metric: string,
  baseline: number,
  recent: number,
  unit: string,
  consecutiveDays: number | undefined,
): TrendDelta {
  const direction = directionFromValues(recent, baseline);
  const signedPercent = percentDelta(recent, baseline);
  const directionText =
    direction === "higher"
      ? "increased"
      : direction === "lower"
        ? "decreased"
        : "stayed near";

  const consecutiveText =
    consecutiveDays && consecutiveDays > 1
      ? ` for ${consecutiveDays} consecutive days`
      : "";

  return {
    metric,
    baseline,
    recent,
    unit,
    direction,
    percentChange: signedPercent,
    consecutiveDays,
    explanation: `${formatMetricLabel(metric)} ${directionText} from baseline ${baseline}${unit} to ${recent}${unit}${consecutiveText}.`,
  };
}

function buildTrendSummary(record: PatientRecord): PatientTrendSummary {
  const latestCheckIn = latest(record.checkIns);
  const latestWearable = latest(record.wearableData);
  const latestPhone = latest(record.phoneBehaviorData);

  if (!latestCheckIn && !latestWearable && !latestPhone) {
    return {
      cards: ["Not enough recent data is available yet to describe trends."],
      trendDeltas: [],
    };
  }

  const trendDeltas: TrendDelta[] = [];
  const cards: string[] = [];

  if (latestWearable) {
    const recentSleepDurations = recentSlice(record.wearableData, 7).map(
      (entry) => entry.sleepDuration,
    );
    const lowSleepDays = countConsecutiveDays(
      recentSleepDurations,
      (value) => value <= record.baseline.sleepDuration - 1.2,
    );

    if (Math.abs(latestWearable.sleepDuration - record.baseline.sleepDuration) >= 1) {
      trendDeltas.push(
        buildTrendDelta(
          "sleep duration",
          record.baseline.sleepDuration,
          latestWearable.sleepDuration,
          " h",
          lowSleepDays || undefined,
        ),
      );
    }

    if (latestWearable.sleepDuration <= record.baseline.sleepDuration - 1.5) {
      cards.push(
        `Your sleep was lower than your usual pattern: about ${latestWearable.sleepDuration} h compared with ${record.baseline.sleepDuration} h.`,
      );
    }
  }

  if (latestPhone) {
    const recentNightUse = recentSlice(record.phoneBehaviorData, 7).map(
      (entry) => entry.nighttimePhoneUseMinutes,
    );
    const consecutiveNightUseDays = countConsecutiveDays(
      recentNightUse,
      (value) => value >= record.baseline.nighttimePhoneUseMinutes + 30,
    );

    if (
      Math.abs(latestPhone.nighttimePhoneUseMinutes - record.baseline.nighttimePhoneUseMinutes) >=
      20
    ) {
      trendDeltas.push(
        buildTrendDelta(
          "nighttime phone use",
          record.baseline.nighttimePhoneUseMinutes,
          latestPhone.nighttimePhoneUseMinutes,
          " min",
          consecutiveNightUseDays || undefined,
        ),
      );
    }

    if (
      latestPhone.nighttimePhoneUseMinutes >=
      Math.max(
        record.baseline.nighttimePhoneUseMinutes + 45,
        record.baseline.nighttimePhoneUseMinutes * 1.6,
      )
    ) {
      cards.push(
        `Your nighttime phone use was ${Math.max(
          0,
          percentDelta(
            latestPhone.nighttimePhoneUseMinutes,
            record.baseline.nighttimePhoneUseMinutes,
          ),
        )}% above your usual pattern.`,
      );
    }

    if (latestPhone.spendingAppVisits >= record.baseline.spendingAppVisits + 2) {
      cards.push(
        `Spending app visits were higher than usual: ${latestPhone.spendingAppVisits}/day compared with about ${record.baseline.spendingAppVisits}/day.`,
      );
    }
  }

  if (latestCheckIn) {
    const recentEnergy = recentSlice(record.checkIns, 7).map((entry) => entry.energy);
    const consecutiveHighEnergyDays = countConsecutiveDays(
      recentEnergy,
      (value) => value >= record.baseline.energy + 2,
    );

    if (Math.abs(latestCheckIn.energy - record.baseline.energy) >= 2) {
      trendDeltas.push(
        buildTrendDelta(
          "energy",
          record.baseline.energy,
          latestCheckIn.energy,
          "/10",
          consecutiveHighEnergyDays || undefined,
        ),
      );
    }

    if (Math.abs(latestCheckIn.impulsivity - record.baseline.impulsivity) >= 2) {
      trendDeltas.push(
        buildTrendDelta(
          "impulsivity",
          record.baseline.impulsivity,
          latestCheckIn.impulsivity,
          "/10",
          undefined,
        ),
      );
    }

    if (Math.abs(latestCheckIn.mood - latestCheckIn.energy) >= 3) {
      cards.push("Your mood and energy are moving in different directions.");
    }
  }

  if (cards.length === 0) {
    cards.push("Your recent check-ins look fairly steady compared with your usual pattern.");
  }

  return {
    cards,
    trendDeltas,
  };
}

export function concernLevelFromScore(score: number): ConcernLevel {
  if (score >= 9) return "urgent";
  if (score >= 7) return "elevated";
  if (score >= 4) return "watch";
  return "stable";
}

function concernScoreFromChangeScore(changeFromBaselineScore: number): number {
  if (changeFromBaselineScore <= 0) return 2;
  return clamp(Math.round(changeFromBaselineScore) + 2, 1, 10);
}

export function defaultConcernScore(concernLevel: ConcernLevel): number {
  return defaultConcernScoreByLevel[concernLevel];
}

export function getConcernScore(
  assessment: Pick<
    AIConcernAssessment,
    "changeFromBaselineScore" | "concernLevel" | "concernScore"
  >,
): number {
  if (
    typeof assessment.concernScore === "number" &&
    Number.isFinite(assessment.concernScore)
  ) {
    return clamp(Math.round(assessment.concernScore), 1, 10);
  }

  const derived = concernScoreFromChangeScore(assessment.changeFromBaselineScore);
  return concernLevelFromScore(derived) === assessment.concernLevel
    ? derived
    : defaultConcernScore(assessment.concernLevel);
}

export function formatConcernScore(
  assessment: Pick<
    AIConcernAssessment,
    "changeFromBaselineScore" | "concernLevel" | "concernScore"
  >,
): string {
  const score = getConcernScore(assessment);
  return `${score} / 10 - ${formatConcernLabel(concernLevelFromScore(score))}`;
}

function describeSleepMismatch(
  baseline: PatientBaseline,
  checkIn: DailyCheckIn | undefined,
  wearable: WearableData | undefined,
): Array<{ reason: string; weight: number }> {
  const reasons: Array<{ reason: string; weight: number }> = [];
  if (!checkIn || !wearable) return reasons;

  if (checkIn.hoursSlept <= baseline.hoursSlept - 2) {
    reasons.push({
      reason: `Hours slept decreased from baseline ${baseline.hoursSlept} h to ${checkIn.hoursSlept} h.`,
      weight: 2,
    });
  }

  if (wearable.sleepDuration <= baseline.sleepDuration - 1.5) {
    reasons.push({
      reason: `Wearable sleep duration decreased from baseline ${baseline.sleepDuration} h to ${wearable.sleepDuration} h.`,
      weight: 2,
    });
  }

  if (checkIn.sleepQuality <= baseline.sleepQuality - 2) {
    reasons.push({
      reason: `Sleep quality decreased from baseline ${baseline.sleepQuality}/10 to ${checkIn.sleepQuality}/10.`,
      weight: 1,
    });
  }

  return reasons;
}

function hasRepeatedLowSleep(
  baseline: PatientBaseline,
  checkIns: DailyCheckIn[],
  wearableData: WearableData[],
): boolean {
  const recentCheckIns = recentSlice(checkIns, 3);
  const recentWearable = recentSlice(wearableData, 3);

  const lowCheckInDays = recentCheckIns.filter(
    (checkIn) => checkIn.hoursSlept <= baseline.hoursSlept - 1.5,
  ).length;
  const lowWearableDays = recentWearable.filter(
    (wearable) => wearable.sleepDuration <= baseline.sleepDuration - 1.2,
  ).length;

  return lowCheckInDays >= 2 || lowWearableDays >= 2;
}

function buildEvidenceStrength(
  supportingSignals: string[],
  dataQuality: DataQualitySummary,
  concernLevel: ConcernLevel,
): EvidenceStrength {
  if (dataQuality.level === "missing") return "low";
  if (concernLevel === "urgent") return "high";
  if (dataQuality.level === "limited") {
    return supportingSignals.length >= 3 ? "moderate" : "low";
  }
  if (supportingSignals.length >= 4) return "high";
  if (supportingSignals.length >= 2) return "moderate";
  return "low";
}

function latestTimestamp(record: PatientRecord): string {
  return [
    latest(record.checkIns)?.timestamp,
    latest(record.wearableData)?.timestamp,
    latest(record.phoneBehaviorData)?.timestamp,
    latest(record.aiMessages)?.timestamp,
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? record.profile.createdAt;
}

export function buildRiskSummary(record: PatientRecord): AIConcernAssessment {
  const latestCheckIn = latest(record.checkIns);
  const latestWearable = latest(record.wearableData);
  const latestPhone = latest(record.phoneBehaviorData);
  const latestUserMessage = [...record.aiMessages]
    .reverse()
    .find((message) => message.role === "user");
  const dataQuality = buildDataQualitySummary(record);
  const trendSummary = buildTrendSummary(record);
  const now = new Date().toISOString();

  if (
    detectSelfHarmLanguage(latestUserMessage?.content) ||
    detectSelfHarmLanguage(latestCheckIn?.note)
  ) {
    return {
      concernLevel: "urgent",
      concernScore: 10,
      changeFromBaselineScore: 10,
      keyReasons: [
        "Possible self-harm or immediate danger language was detected.",
        "Prototype crisis guidance and urgent clinician review are recommended.",
      ],
      evidenceStrength: dataQuality.level === "missing" ? "moderate" : "high",
      dataQuality,
      patientFacingSummary:
        "A concerning safety-related message was noticed. In this prototype, I would suggest immediate care-team follow-up.",
      clinicianFacingSummary:
        "Possible self-harm or immediate danger language detected in recent patient input. Prototype urgent review and escalation recommended.",
      recommendedAction: "Escalate care and review immediately",
      supportingSignals: [
        "Safety-related language appears in recent patient input.",
        "Urgent clinician review is recommended for this prototype scenario.",
      ],
      contradictingSignals: dataQuality.level === "good" ? [] : [dataQuality.note],
      trendSummary,
      lastDataSyncAt: latestTimestamp(record),
      timestamp: now,
    };
  }

  if (!latestCheckIn && !latestWearable && !latestPhone) {
    return {
      concernLevel: "watch",
      concernScore: 4,
      changeFromBaselineScore: 3,
      keyReasons: ["Not enough recent information is available to compare against baseline."],
      evidenceStrength: "low",
      dataQuality,
      patientFacingSummary:
        "I need a little more recent information before I can describe changes from your usual pattern.",
      clinicianFacingSummary:
        "Recent check-in or simulated sensor summaries are incomplete, so this patient should remain on watch until more data arrives.",
      recommendedAction: "Request follow-up check-in",
      supportingSignals: ["Recent monitoring information is incomplete."],
      contradictingSignals: [],
      trendSummary,
      lastDataSyncAt: latestTimestamp(record),
      timestamp: now,
    };
  }

  const supportingSignals: Array<{ reason: string; weight: number }> = [];
  const contradictingSignals: string[] = [];
  let score = 0;

  describeSleepMismatch(record.baseline, latestCheckIn, latestWearable).forEach((signal) => {
    supportingSignals.push(signal);
    score += signal.weight;
  });

  const repeatedLowSleep = hasRepeatedLowSleep(
    record.baseline,
    record.checkIns,
    record.wearableData,
  );

  if (repeatedLowSleep) {
    supportingSignals.push({
      reason: "Sleep has remained lower than baseline across multiple recent days.",
      weight: 2,
    });
    score += 2;
  }

  if (latestCheckIn) {
    const highEnergy =
      latestCheckIn.energy >= 8 || latestCheckIn.energy >= record.baseline.energy + 2;
    const highImpulsivity =
      latestCheckIn.impulsivity >= 7 ||
      latestCheckIn.impulsivity >= record.baseline.impulsivity + 2;
    const lowMood =
      latestCheckIn.mood <= 3 || latestCheckIn.mood <= record.baseline.mood - 2;
    const lowEnergy =
      latestCheckIn.energy <= 3 || latestCheckIn.energy <= record.baseline.energy - 2;
    const highAnxiety =
      latestCheckIn.anxiety >= 7 || latestCheckIn.anxiety >= record.baseline.anxiety + 2;

    if (highEnergy && highImpulsivity) {
      supportingSignals.push({
        reason: `Energy increased from baseline ${record.baseline.energy}/10 to ${latestCheckIn.energy}/10 while impulsivity increased to ${latestCheckIn.impulsivity}/10.`,
        weight: 2,
      });
      score += 2;
    }

    if (lowMood && lowEnergy && highAnxiety) {
      supportingSignals.push({
        reason: `Mood and energy are below baseline while anxiety increased to ${latestCheckIn.anxiety}/10.`,
        weight: 2,
      });
      score += 2;
    }

    if (
      latestCheckIn.medicationTakenToday === "no" &&
      latestCheckIn.impulsivity >= 6
    ) {
      supportingSignals.push({
        reason: "Medication was not taken today and impulsivity is higher than usual.",
        weight: 1,
      });
      score += 1;
    } else if (latestCheckIn.medicationTakenToday === "partial") {
      supportingSignals.push({
        reason: "Medication adherence was reported as partial today.",
        weight: 0.5,
      });
      score += 0.5;
    } else if (latestCheckIn.medicationTakenToday === "yes") {
      contradictingSignals.push("Medication was reported as taken today.");
    }

    if (Math.abs(latestCheckIn.mood - record.baseline.mood) < 1.5) {
      contradictingSignals.push("Mood remains close to baseline.");
    }
  }

  if (latestPhone) {
    if (
      latestPhone.nighttimePhoneUseMinutes >=
      Math.max(
        record.baseline.nighttimePhoneUseMinutes + 45,
        record.baseline.nighttimePhoneUseMinutes * 1.6,
      )
    ) {
      supportingSignals.push({
        reason: `Nighttime phone use increased from baseline ${record.baseline.nighttimePhoneUseMinutes} min to ${latestPhone.nighttimePhoneUseMinutes} min.`,
        weight: 1,
      });
      score += 1;
    } else if (
      Math.abs(
        latestPhone.nighttimePhoneUseMinutes - record.baseline.nighttimePhoneUseMinutes,
      ) < 20
    ) {
      contradictingSignals.push("Nighttime phone use remains near baseline.");
    }

    if (
      latestPhone.screenTimeHours >=
      Math.max(record.baseline.screenTimeHours + 2, record.baseline.screenTimeHours * 1.5)
    ) {
      supportingSignals.push({
        reason: `Screen time increased from baseline ${record.baseline.screenTimeHours} h to ${latestPhone.screenTimeHours} h.`,
        weight: 1,
      });
      score += 1;
    }

    if (latestPhone.spendingAppVisits >= record.baseline.spendingAppVisits + 3) {
      supportingSignals.push({
        reason: `Spending app visits increased from baseline ${record.baseline.spendingAppVisits}/day to ${latestPhone.spendingAppVisits}/day.`,
        weight: 1,
      });
      score += 1;
    }
  }

  const recentMoods = recentSlice(record.checkIns, 4).map((checkIn) => checkIn.mood);
  const recentEnergies = recentSlice(record.checkIns, 4).map((checkIn) => checkIn.energy);
  const recentSleep = recentSlice(record.checkIns, 4).map((checkIn) => checkIn.hoursSlept);

  if (recentMoods.length >= 3) {
    const moodAverage = average(recentMoods);
    const energyAverage = average(recentEnergies);

    if (Math.abs(moodAverage - energyAverage) >= 2) {
      supportingSignals.push({
        reason: "Mood and energy have been moving in different directions across recent check-ins.",
        weight: 1,
      });
      score += 1;
    }
  }

  if (
    latestCheckIn &&
    recentSleep.length >= 3 &&
    recentSleep.every((sleepHours) => Math.abs(sleepHours - record.baseline.hoursSlept) < 1) &&
    Math.abs(latestCheckIn.mood - record.baseline.mood) < 2 &&
    Math.abs(latestCheckIn.energy - record.baseline.energy) < 2
  ) {
    contradictingSignals.push(
      "Recent sleep, mood, and energy remain close to the patient's usual pattern.",
    );
    score -= 2;
  }

  if (dataQuality.level === "limited") {
    score -= 1;
  } else if (dataQuality.level === "missing") {
    score -= 2;
  }

  const changeFromBaselineScore = clamp(Math.round(score), 0, 10);
  const concernScore = concernScoreFromChangeScore(changeFromBaselineScore);
  const concernLevel = concernLevelFromScore(concernScore);
  const keyReasons =
    supportingSignals.length > 0
      ? supportingSignals
          .sort((left, right) => right.weight - left.weight)
          .map((signal) => signal.reason)
          .slice(0, 4)
      : ["Recent check-ins appear stable and close to baseline."];

  const evidenceStrength = buildEvidenceStrength(
    supportingSignals.map((signal) => signal.reason),
    dataQuality,
    concernLevel,
  );

  const patientFacingSummaryMap: Record<ConcernLevel, string> = {
    stable:
      "Your recent check-ins look close to your usual pattern. I'll keep watching for changes from your baseline.",
    watch:
      "I'm noticing a few mild changes from your usual pattern, especially around sleep or phone use. A follow-up check-in could help.",
    elevated:
      "Several parts of your recent pattern look different from usual. A care team follow-up may be helpful.",
    urgent:
      "A concerning change from your recent pattern was detected. In this prototype, urgent care-team follow-up would be recommended.",
  };

  const clinicianFacingSummaryMap: Record<ConcernLevel, string> = {
    stable:
      "Recent check-ins, summarized wearable signals, and phone behavior remain close to baseline. Routine monitoring is appropriate.",
    watch:
      "Mild baseline-relative change detected. Consider a follow-up check-in and continued monitoring.",
    elevated:
      "Multiple baseline-relative changes detected across recent check-ins and behavioral summaries. Clinician review is recommended.",
    urgent:
      "High-concern pattern detected from recent self-report or message content. Prototype urgent review and escalation recommended.",
  };

  const recommendedActionMap: Record<ConcernLevel, string> = {
    stable: "Continue routine monitoring",
    watch: "Request follow-up check-in",
    elevated: "Request clinician review",
    urgent: "Escalate care",
  };

  return {
    concernLevel,
    concernScore,
    changeFromBaselineScore,
    keyReasons,
    evidenceStrength,
    dataQuality,
    recommendedAction: recommendedActionMap[concernLevel],
    patientFacingSummary: patientFacingSummaryMap[concernLevel],
    clinicianFacingSummary: clinicianFacingSummaryMap[concernLevel],
    supportingSignals: supportingSignals.map((signal) => signal.reason),
    contradictingSignals,
    trendSummary,
    lastDataSyncAt: latestTimestamp(record),
    timestamp: now,
  };
}

export function getTrendCards(record: PatientRecord): string[] {
  return buildTrendSummary(record).cards;
}

export function compareConcernLevel(left: ConcernLevel, right: ConcernLevel): number {
  return concernWeight[right] - concernWeight[left];
}

export function summarizeSharingAccess(record: PatientRecord): string[] {
  const notes: string[] = [];

  if (!record.profile.sharingPreferences.shareDailyCheckInsWithClinician) {
    notes.push("Daily check-ins are not shared with the clinician.");
  }

  if (!record.profile.sharingPreferences.shareWearableSummariesWithClinician) {
    notes.push("Wearable summaries are hidden from the clinician.");
  }

  if (!record.profile.sharingPreferences.sharePhoneBehaviorSummariesWithClinician) {
    notes.push("Phone behavior summaries are hidden from the clinician.");
  }

  if (!record.profile.sharingPreferences.allowClinicianToSeeAISummaries) {
    notes.push("AI summaries are hidden from the clinician.");
  }

  if (!notes.length) {
    notes.push("All enabled summaries are shared with the clinician for this prototype.");
  }

  return notes;
}

export function formatConcernLabel(concernLevel: ConcernLevel): string {
  return concernLevel.charAt(0).toUpperCase() + concernLevel.slice(1);
}

export function formatEvidenceStrength(strength: EvidenceStrength): string {
  return strength.charAt(0).toUpperCase() + strength.slice(1);
}

export function formatDataQualityLevel(level: DataQualityLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function formatActionStatus(status: ClinicianActionStatus): string {
  return actionStatusLabels[status];
}

export function buildChartSeries<T extends { timestamp: string }>(
  items: T[],
  getValues: (item: T) => Record<string, number>,
): Array<Record<string, number | string>> {
  return items.map((item) => ({
    date: formatChartDate(item.timestamp),
    ...getValues(item),
  }));
}
