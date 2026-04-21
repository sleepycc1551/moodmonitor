export const RISK_LEVELS = ["Stable", "Watch", "Elevated", "Urgent Review"];

export const ACTIONS = [
  "no-action",
  "auto-checkin",
  "manual-outreach",
  "clinician-review",
  "urgent-escalation",
];

export const ACTION_LABELS = {
  "no-action": "No action",
  "auto-checkin": "Automated check-in",
  "manual-outreach": "Manual outreach",
  "clinician-review": "Clinician review",
  "urgent-escalation": "Urgent escalation",
};

export const JAT_CONDITIONS = {
  NONE: {
    id: "NONE",
    label: "No AI prioritization",
    description:
      "Hide AI triage and force operators to work from the raw patient signals alone.",
  },
  SCORE: {
    id: "SCORE",
    label: "AI score only",
    description:
      "Show risk level and next-step recommendation, but withhold explanation and uncertainty.",
  },
  FULL: {
    id: "FULL",
    label: "Full AI + coordination",
    description:
      "Expose summary, contributing factors, uncertainty, missing information, and human-review cues.",
  },
};

export const RISK_ORDER = {
  "Urgent Review": 0,
  Elevated: 1,
  Watch: 2,
  Stable: 3,
};

export function aiUrgencyScore(recommendation) {
  if (!recommendation) return 0;
  const fromScore = recommendation.score != null
    ? Math.max(1, Math.min(10, Math.round(recommendation.score / 10)))
    : null;

  if (fromScore) {
    return fromScore;
  }

  const fallback = {
    "Urgent Review": 9,
    Elevated: 7,
    Watch: 4,
    Stable: 2,
  };
  return fallback[recommendation.riskLevel] ?? 0;
}

export function groundTruthUrgency(groundTruth) {
  return aiUrgencyScore({ riskLevel: groundTruth?.level });
}

export function buildChallengeMetrics(patients) {
  const misleadingIndicators = patients.filter((patient) => {
    if (!patient.ai) return false;
    return (
      patient.ai.riskLevel !== patient.groundTruth.level ||
      patient.ai.recommendedAction !== patient.groundTruth.action
    );
  }).length;

  const ambiguousCues = patients.filter(
    (patient) =>
      patient.ai?.confidence === "low" ||
      patient.ai?.trend === "mixed-signals" ||
      patient.ai?.trend === "unknown",
  ).length;

  const incompleteAdvice = patients.filter(
    (patient) =>
      (patient.ai?.missingInfo?.length ?? 0) > 0 ||
      (patient.ai?.uncertainty?.length ?? 0) > 0,
  ).length;

  const falsePriming = patients.filter((patient) =>
    patient.challengeTags.some((tag) =>
      ["potential-false-positive", "potential-false-negative", "medication-change-confounder"].includes(tag),
    ),
  ).length;

  return {
    dataOverload: patients.length,
    misleadingIndicators,
    ambiguousCues,
    incompleteAdvice,
    falsePriming,
  };
}

export function buildFallbackRecommendation(patient) {
  const factors = [];
  const uncertainty = [];
  const missingInfo = [];
  const humanReviewReasons = [];

  let score = 8;
  let worseningSignals = 0;
  let stabilizingSignals = 0;
  let conflictingSignals = 0;

  const addFactor = (text, points, direction = "worsening") => {
    factors.push(text);
    score += points;
    if (direction === "worsening") worseningSignals += 1;
    if (direction === "stabilizing") stabilizingSignals += 1;
    if (direction === "conflicting") conflictingSignals += 1;
  };

  const addMissing = (text, points = 5) => {
    missingInfo.push(text);
    score += points;
  };

  const addUncertainty = (text) => {
    if (!uncertainty.includes(text)) uncertainty.push(text);
  };

  const pctDelta = (avg, baseline) => {
    if (avg == null || baseline == null || baseline === 0) return null;
    return (avg - baseline) / baseline;
  };

  const sleepDelta = pctDelta(patient.sleep.avg, patient.sleep.baseline);
  if (sleepDelta == null || patient.sleep.days < 3) {
    addMissing("Sleep coverage is incomplete for the last week.");
  } else if (sleepDelta <= -0.3) {
    addFactor(
      `Sleep is ${Math.abs(Math.round(sleepDelta * 100))}% below baseline for ${patient.sleep.days} days.`,
      24,
    );
  } else if (sleepDelta <= -0.15) {
    addFactor(`Sleep is trending below baseline (${Math.abs(Math.round(sleepDelta * 100))}% lower).`, 13);
  } else if (sleepDelta >= 0.25) {
    addFactor(`Sleep is ${Math.round(sleepDelta * 100)}% above baseline.`, 18);
  } else {
    stabilizingSignals += 1;
  }

  const activityDelta = pctDelta(patient.activity.avg, patient.activity.baseline);
  if (activityDelta == null || patient.activity.days < 3) {
    addMissing("Activity data is incomplete.");
  } else if (activityDelta >= 0.6) {
    addFactor(`Activity is ${Math.round(activityDelta * 100)}% above baseline.`, 14);
  } else if (activityDelta <= -0.45) {
    addFactor(`Activity is ${Math.abs(Math.round(activityDelta * 100))}% below baseline.`, 16);
  } else if (Math.abs(activityDelta) < 0.1) {
    stabilizingSignals += 1;
  }

  const hrvDelta = pctDelta(patient.hrv.avg, patient.hrv.baseline);
  if (patient.hrv.avg == null || patient.hrv.days < 3) {
    addMissing("HRV coverage is sparse.");
  } else if (hrvDelta <= -0.2) {
    addFactor(`HRV is ${Math.abs(Math.round(hrvDelta * 100))}% below baseline.`, 8);
  } else if (Math.abs(hrvDelta) < 0.08) {
    stabilizingSignals += 1;
  }

  const phoneDelta = pctDelta(patient.phone.avg, patient.phone.baseline);
  if (patient.phone.avg == null || patient.phone.days < 3) {
    addMissing("Smartphone behavior data is incomplete.");
  } else if (phoneDelta >= 0.5) {
    addFactor(`Phone use is ${Math.round(phoneDelta * 100)}% above baseline.`, 10);
  } else if (phoneDelta <= -0.45) {
    addFactor(`Phone and messaging activity are ${Math.abs(Math.round(phoneDelta * 100))}% below baseline.`, 10);
  } else if (Math.abs(phoneDelta) < 0.12) {
    stabilizingSignals += 1;
  }

  if (patient.phone.nightUse === "high") {
    addFactor("Night-time phone use is high.", 7);
  }

  const report = patient.selfReport;
  if (report.mood == null) {
    addMissing("Self-report is missing.");
    addUncertainty("Wearable-only cues are less diagnostic than combined wearable and self-report data.");
  } else {
    if (report.mood >= 8) addFactor(`Mood is elevated at ${report.mood}/10.`, 14);
    if (report.mood <= 3) addFactor(`Mood is low at ${report.mood}/10.`, 18);
    if (report.energy >= 8) addFactor(`Energy is elevated at ${report.energy}/10.`, 10);
    if (report.energy <= 2) addFactor(`Energy is low at ${report.energy}/10.`, 9);
    if (report.irritability >= 7) addFactor(`Irritability is high at ${report.irritability}/10.`, 10);
    if (report.impulsivity >= 7) addFactor(`Impulsivity is high at ${report.impulsivity}/10.`, 12);
    if (report.hopelessness >= 7) {
      addFactor(`Hopelessness is elevated at ${report.hopelessness}/10.`, 28);
      humanReviewReasons.push("High hopelessness warrants human review.");
    }
    if (report.anxiety >= 7) addFactor(`Anxiety is elevated at ${report.anxiety}/10.`, 8);

    const mixedPattern =
      report.mood <= 4 &&
      (report.energy >= 7 || report.impulsivity >= 7 || report.irritability >= 8);

    if (mixedPattern) {
      addFactor("Signals suggest a possible mixed-state pattern.", 22, "conflicting");
      humanReviewReasons.push("Mixed-state patterns are hard to interpret without clinician judgment.");
    }

    if (report.note) {
      const normalized = report.note.toLowerCase();
      if (
        normalized.includes("can't slow down") ||
        normalized.includes("barely slept") ||
        normalized.includes("racing")
      ) {
        addFactor("Patient note describes activation or reduced need for sleep.", 8);
      }
      if (
        normalized.includes("hopeless") ||
        normalized.includes("don't want to be here") ||
        normalized.includes("not wanting to be here")
      ) {
        addFactor("Patient note includes concerning safety language.", 34);
        humanReviewReasons.push("Free-text includes concerning safety language.");
      }
    }
  }

  if (report.missed >= 2) {
    addFactor(`There have been ${report.missed} missed self-report check-ins recently.`, 9);
    addUncertainty("Repeated missed check-ins reduce observability.");
  }

  if (patient.medication.adherence == null) {
    addMissing("Medication adherence has not been confirmed.");
  } else if (patient.medication.adherence < 0.6) {
    addFactor(`Medication adherence has dropped to ${Math.round(patient.medication.adherence * 100)}%.`, 18);
  } else if (patient.medication.adherence < 0.8) {
    addFactor(`Medication adherence is below target at ${Math.round(patient.medication.adherence * 100)}%.`, 10);
  } else {
    stabilizingSignals += 1;
  }

  if (patient.dataQuality === "moderate") {
    score += 5;
    addUncertainty("Some signals are present, but coverage is incomplete.");
  }

  if (patient.dataQuality === "low") {
    score += 12;
    addUncertainty("Low data quality reduces confidence in the recommendation.");
    humanReviewReasons.push("Low data quality makes the state hard to assess.");
  }

  if (patient.patientResponse === "partial") {
    score += 5;
    addUncertainty("The patient is only partially responsive to outreach.");
  }

  if (patient.patientResponse === "no-response") {
    score += 12;
    addFactor("The patient is not responding to outreach.", 4);
    humanReviewReasons.push("No-response cases often need manual follow-up.");
  }

  if (patient.challengeTags.includes("post-discharge")) {
    score += 6;
    humanReviewReasons.push("Recent discharge raises monitoring priority.");
  }

  if (patient.challengeTags.includes("medication-change-confounder")) {
    addUncertainty("A recent medication change could confound the observed pattern.");
  }

  if (patient.challengeTags.includes("potential-false-negative")) {
    addUncertainty("Subtle deterioration may be easy to under-call in this case.");
  }

  if (patient.challengeTags.includes("potential-false-positive")) {
    addUncertainty("Some activation cues could reflect a benign explanation.");
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  let riskLevel = "Stable";
  if (score >= 75) riskLevel = "Urgent Review";
  else if (score >= 52) riskLevel = "Elevated";
  else if (score >= 28) riskLevel = "Watch";

  let trend = "stable";
  if (missingInfo.length >= 3) trend = "unknown";
  else if (conflictingSignals >= 1 && worseningSignals >= 2) trend = "mixed-signals";
  else if (worseningSignals >= 4) trend = "worsening";
  else if (worseningSignals >= 2) trend = "mild-worsening";
  else if (stabilizingSignals >= 4 && score < 28) trend = "improving";

  let confidence = "high";
  if (
    patient.dataQuality === "moderate" ||
    uncertainty.length > 0 ||
    conflictingSignals > 0
  ) {
    confidence = "moderate";
  }
  if (patient.dataQuality === "low" || missingInfo.length >= 2) {
    confidence = "low";
  }

  const urgentSafetyCue =
    report.hopelessness >= 8 ||
    report.note?.toLowerCase().includes("not wanting to be here") ||
    report.note?.toLowerCase().includes("don't want to be here");

  let recommendedAction = "no-action";
  if (urgentSafetyCue || (riskLevel === "Urgent Review" && report.impulsivity >= 7)) {
    recommendedAction = "urgent-escalation";
    humanReviewReasons.push("Safety or severe instability cues need immediate human attention.");
  } else if (riskLevel === "Urgent Review") {
    recommendedAction = "clinician-review";
  } else if (riskLevel === "Elevated") {
    recommendedAction =
      patient.patientResponse === "no-response" || patient.medication.adherence < 0.65
        ? "clinician-review"
        : "manual-outreach";
  } else if (riskLevel === "Watch") {
    recommendedAction =
      patient.patientResponse === "no-response" || missingInfo.length >= 2
        ? "manual-outreach"
        : "auto-checkin";
  }

  const needsHumanReview =
    recommendedAction === "clinician-review" ||
    recommendedAction === "urgent-escalation" ||
    confidence === "low" ||
    humanReviewReasons.length > 0;

  const topFactors = factors.slice(0, 4);
  const summaryFragments = [];

  if (riskLevel === "Stable") summaryFragments.push("Recent signals remain close to baseline.");
  if (riskLevel === "Watch") summaryFragments.push("There are mild early-warning signals worth monitoring.");
  if (riskLevel === "Elevated") summaryFragments.push("Multiple signals suggest elevated decompensation risk.");
  if (riskLevel === "Urgent Review") summaryFragments.push("This case shows a cluster of high-concern indicators.");

  if (topFactors[0]) summaryFragments.push(topFactors[0]);
  if (needsHumanReview) summaryFragments.push("Human review is advised before taking action.");

  return {
    summary: summaryFragments.join(" "),
    score,
    riskLevel,
    recommendedAction,
    confidence,
    trend,
    topFactors,
    uncertainty: uncertainty.slice(0, 3),
    missingInfo: missingInfo.slice(0, 3),
    needsHumanReview,
    humanReviewReasons: [...new Set(humanReviewReasons)].slice(0, 3),
  };
}

export function normalizeRecommendation(candidate, patient) {
  const fallback = buildFallbackRecommendation(patient);
  const merged = {
    ...fallback,
    ...(candidate ?? {}),
  };

  if (!RISK_LEVELS.includes(merged.riskLevel)) {
    merged.riskLevel = fallback.riskLevel;
  }

  if (!ACTIONS.includes(merged.recommendedAction)) {
    merged.recommendedAction = fallback.recommendedAction;
  }

  if (!["low", "moderate", "high"].includes(merged.confidence)) {
    merged.confidence = fallback.confidence;
  }

  if (
    ![
      "improving",
      "stable",
      "worsening",
      "unknown",
      "mixed-signals",
      "mild-worsening",
      "increasing",
      "decreasing",
      "slight-increase",
      "slight-decrease",
    ].includes(merged.trend)
  ) {
    merged.trend = fallback.trend;
  }

  merged.score = Number.isFinite(Number(merged.score))
    ? Math.max(0, Math.min(100, Math.round(Number(merged.score))))
    : fallback.score;

  merged.topFactors = Array.isArray(merged.topFactors)
    ? merged.topFactors.filter(Boolean).slice(0, 4)
    : fallback.topFactors;

  merged.uncertainty = Array.isArray(merged.uncertainty)
    ? merged.uncertainty.filter(Boolean).slice(0, 3)
    : fallback.uncertainty;

  merged.missingInfo = Array.isArray(merged.missingInfo)
    ? merged.missingInfo.filter(Boolean).slice(0, 3)
    : fallback.missingInfo;

  merged.humanReviewReasons = Array.isArray(merged.humanReviewReasons)
    ? merged.humanReviewReasons.filter(Boolean).slice(0, 3)
    : fallback.humanReviewReasons;

  merged.needsHumanReview = Boolean(merged.needsHumanReview);
  merged.summary = typeof merged.summary === "string" && merged.summary.trim()
    ? merged.summary.trim()
    : fallback.summary;

  return merged;
}
