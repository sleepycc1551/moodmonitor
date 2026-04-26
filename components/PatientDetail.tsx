"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChartColumnIncreasing,
  CheckCircle2,
  FlaskConical,
  Info,
  MessageSquare,
  ShieldAlert,
  SlidersHorizontal,
  Stethoscope,
} from "lucide-react";
import { ComparisonLineChart } from "@/components/Charts";
import {
  buildClinicianSafeNoteSummary,
  buildCommunicationHistory,
  buildPhoneBehaviorInsights,
  getActionStatus,
  getClinicianConfirmedConcernScore,
  getClinicianConfirmedConcernLevel,
} from "@/lib/clinician";
import { formatDateTime } from "@/lib/dateFormat";
import {
  formatDeviationStatus,
  getBaselineBand,
  getDeviationBadgeClass,
  getDeviationStatus,
  getTrendColor,
  type DeviationMetricType,
  type DeviationStatus,
} from "@/lib/deviation";
import {
  buildChartSeries,
  concernLevelFromScore,
  formatActionStatus,
  formatConcernLabel,
  formatConcernScore,
  formatDataQualityLevel,
  formatEvidenceStrength,
  getConcernScore,
  summarizeSharingAccess,
} from "@/lib/riskEngine";
import type {
  AppointmentRequest,
  ClinicianOverrideReason,
  ConcernLevel,
  JATTesterAction,
  JATTesterSubmission,
  PatientRecord,
} from "@/types";

interface PatientDetailProps {
  aiEnabled: boolean;
  onApproveAppointment: (requestId: string) => void;
  onChangeConcernLevel: (input: {
    clinicianConcernLevel: ConcernLevel;
    clinicianConcernScore: number;
    note: string;
    reason: ClinicianOverrideReason;
  }) => void;
  onEscalateCare: (note: string) => void;
  onMarkReviewed: () => void;
  onPanelViewed: (panelId: string) => void;
  onRequestAppointmentInfo: (requestId: string) => void;
  onRequestFollowUpCheckIn: () => void;
  onReviewAppointmentRequest: (requestId: string) => void;
  onResetJATSubmissions: () => void;
  onSendSupportiveMessage: (message: string) => void;
  onSubmitJATJudgment: (input: {
    agreedWithAI: boolean;
    openedDetailView?: boolean;
    testerAction: JATTesterAction;
    testerConfidence: number;
    testerConcernScore: number;
    testerNote?: string;
    timeToDecisionMs?: number;
    viewedPanels?: string[];
  }) => void;
  detailOpenedAt: number;
  latestJATSubmission?: JATTesterSubmission;
  patient: PatientRecord;
  testSubmissionCount: number;
}

type TrendDefinition = {
  baseline: number;
  data: Array<Record<string, number | string>>;
  dataKey: string;
  latest?: number;
  metricType: DeviationMetricType;
  subtitle: string;
  title: string;
  unit?: string;
  yDomain?: [number | "auto", number | "auto"];
};

const overrideReasons: ClinicianOverrideReason[] = [
  "AI overestimated concern",
  "AI underestimated concern",
  "Missing context",
  "Patient already contacted",
  "Data quality issue",
  "Other",
];

const testerActions: JATTesterAction[] = [
  "no_action",
  "monitor",
  "send_message",
  "request_follow_up_check_in",
  "schedule_appointment",
  "escalate_care",
];

const showFacilitatorTools =
  process.env.NEXT_PUBLIC_SHOW_FACILITATOR_TOOLS === "true";

export function PatientDetail({
  aiEnabled,
  onApproveAppointment,
  onChangeConcernLevel,
  onEscalateCare,
  onMarkReviewed,
  onPanelViewed,
  onRequestAppointmentInfo,
  onRequestFollowUpCheckIn,
  onReviewAppointmentRequest,
  onResetJATSubmissions,
  onSendSupportiveMessage,
  onSubmitJATJudgment,
  detailOpenedAt,
  latestJATSubmission,
  patient,
  testSubmissionCount,
}: PatientDetailProps) {
  const [activeModal, setActiveModal] = useState<"message" | "override" | "escalate" | null>(
    null,
  );
  const [supportiveMessage, setSupportiveMessage] = useState(
    "Please try to keep sleep as regular as possible tonight and complete another check-in tomorrow morning.",
  );
  const [escalationNote, setEscalationNote] = useState(
    "Escalation documented in prototype due to concerning change from baseline.",
  );
  const [overrideScore, setOverrideScore] = useState(5);
  const [overrideReason, setOverrideReason] =
    useState<ClinicianOverrideReason>("Missing context");
  const [overrideNote, setOverrideNote] = useState("");
  const [showGroundTruth, setShowGroundTruth] = useState(false);
  const [showSharedNote, setShowSharedNote] = useState(false);
  const [testerConcernScore, setTesterConcernScore] = useState<number | null>(() =>
    aiEnabled ? getConcernScore(patient.latestRisk) : null,
  );
  const [testerAction, setTesterAction] = useState<JATTesterAction | "">(
    aiEnabled ? "monitor" : "",
  );
  const [testerConfidence, setTesterConfidence] = useState(6);
  const [agreedWithAI, setAgreedWithAI] = useState(aiEnabled);
  const [testerNote, setTesterNote] = useState("");
  const [viewedPanels, setViewedPanels] = useState<string[]>([]);

  const latestCheckIn = patient.checkIns.at(-1);
  const latestWearable = patient.wearableData.at(-1);
  const latestPhone = patient.phoneBehaviorData.at(-1);
  const clinicianConfirmedConcern = getClinicianConfirmedConcernLevel(patient);
  const clinicianConfirmedConcernScore = getClinicianConfirmedConcernScore(patient);
  const aiConcernScore = getConcernScore(patient.latestRisk);
  const overrideConcern = concernLevelFromScore(overrideScore);
  const pendingAppointments = patient.appointmentRequests.filter(
    (request) => request.status === "pending",
  );
  const communicationHistory = useMemo(() => buildCommunicationHistory(patient), [patient]);
  const clinicianSafeNoteSummary = useMemo(
    () => buildClinicianSafeNoteSummary(patient),
    [patient],
  );
  const phoneBehaviorInsights = useMemo(() => buildPhoneBehaviorInsights(patient), [patient]);
  const sharingNotes = useMemo(() => summarizeSharingAccess(patient), [patient]);
  const actionStatus = getActionStatus(patient);
  const canSubmitTestJudgment = testerConcernScore !== null && testerAction !== "";

  function trackPanel(panelId: string) {
    if (viewedPanels.includes(panelId)) return;
    setViewedPanels((current) => [...current, panelId]);
    onPanelViewed(panelId);
  }

  const wearableSeries = useMemo(
    () =>
      buildChartSeries(patient.wearableData.slice(-7), (entry) => ({
        activityLevel: entry.activityLevel,
        restingHeartRate: entry.restingHeartRate,
        sleepDuration: entry.sleepDuration,
        sleepQuality: entry.sleepQuality,
        stressEstimate: entry.stressEstimate,
      })),
    [patient.wearableData],
  );

  const phoneSeries = useMemo(
    () =>
      buildChartSeries(patient.phoneBehaviorData.slice(-7), (entry) => ({
        nighttimePhoneUseMinutes: entry.nighttimePhoneUseMinutes,
        screenTimeHours: entry.screenTimeHours,
        socialAppUsageMinutes: entry.socialAppUsageMinutes,
        spendingAppVisits: entry.spendingAppVisits,
        unlockFrequency: entry.unlockFrequency,
      })),
    [patient.phoneBehaviorData],
  );

  const selfReportSeries = useMemo(
    () =>
      buildChartSeries(patient.checkIns.slice(-7), (entry) => ({
        anxiety: entry.anxiety,
        energy: entry.energy,
        impulsivity: entry.impulsivity,
        irritability: entry.irritability,
        medicationAdherence: medicationValue(entry.medicationTakenToday),
        mood: entry.mood,
        sleepQuality: entry.sleepQuality,
      })),
    [patient.checkIns],
  );

  const coreTrends: TrendDefinition[] = [
    {
      baseline: patient.baseline.sleepDuration,
      data: wearableSeries.length
        ? wearableSeries
        : buildChartSeries(patient.checkIns.slice(-7), (entry) => ({
            sleepDuration: entry.hoursSlept,
          })),
      dataKey: "sleepDuration",
      latest: latestWearable?.sleepDuration ?? latestCheckIn?.hoursSlept,
      metricType: "sleepDuration",
      subtitle: "Hours; lower than usual is more concerning",
      title: "Sleep duration",
      unit: "h",
    },
    {
      baseline: patient.baseline.mood,
      data: selfReportSeries,
      dataKey: "mood",
      latest: latestCheckIn?.mood,
      metricType: "scaleBoth",
      subtitle: "0-10 self-report",
      title: "Mood",
      unit: "/10",
      yDomain: [0, 10],
    },
    {
      baseline: patient.baseline.energy,
      data: selfReportSeries,
      dataKey: "energy",
      latest: latestCheckIn?.energy,
      metricType: "scaleBoth",
      subtitle: "0-10 self-report",
      title: "Energy",
      unit: "/10",
      yDomain: [0, 10],
    },
  ];

  const activationTrends: TrendDefinition[] = [
    {
      baseline: patient.baseline.impulsivity,
      data: selfReportSeries,
      dataKey: "impulsivity",
      latest: latestCheckIn?.impulsivity,
      metricType: "scaleHigh",
      subtitle: "0-10 self-report",
      title: "Impulsivity",
      unit: "/10",
      yDomain: [0, 10],
    },
    {
      baseline: patient.baseline.nighttimePhoneUseMinutes,
      data: phoneSeries,
      dataKey: "nighttimePhoneUseMinutes",
      latest: latestPhone?.nighttimePhoneUseMinutes,
      metricType: "phoneHigh",
      subtitle: "Minutes after usual bedtime",
      title: "Nighttime phone use",
      unit: "min",
    },
    {
      baseline: patient.baseline.spendingAppVisits,
      data: phoneSeries,
      dataKey: "spendingAppVisits",
      latest: latestPhone?.spendingAppVisits,
      metricType: "countHigh",
      subtitle: "Visits per day",
      title: "Spending app visits",
      unit: "/day",
    },
  ];

  const supportingTrends: TrendDefinition[] = [
    {
      baseline: patient.baseline.sleepQuality,
      data: wearableSeries,
      dataKey: "sleepQuality",
      latest: latestWearable?.sleepQuality,
      metricType: "scaleLow",
      subtitle: "Wearable summary, 0-10",
      title: "Wearable sleep quality",
      unit: "/10",
      yDomain: [0, 10],
    },
    {
      baseline: patient.baseline.sleepQuality,
      data: selfReportSeries,
      dataKey: "sleepQuality",
      latest: latestCheckIn?.sleepQuality,
      metricType: "scaleLow",
      subtitle: "Self-report, 0-10",
      title: "Self-report sleep quality",
      unit: "/10",
      yDomain: [0, 10],
    },
    {
      baseline: patient.baseline.restingHeartRate,
      data: wearableSeries,
      dataKey: "restingHeartRate",
      latest: latestWearable?.restingHeartRate,
      metricType: "heartRateHigh",
      subtitle: "Beats per minute",
      title: "Resting heart rate",
      unit: "bpm",
    },
    {
      baseline: patient.baseline.activityLevel,
      data: wearableSeries,
      dataKey: "activityLevel",
      latest: latestWearable?.activityLevel,
      metricType: "scaleBoth",
      subtitle: "Wearable summary, 0-10",
      title: "Activity level",
      unit: "/10",
      yDomain: [0, 10],
    },
    {
      baseline: patient.baseline.stressEstimate,
      data: wearableSeries,
      dataKey: "stressEstimate",
      latest: latestWearable?.stressEstimate,
      metricType: "scaleHigh",
      subtitle: "Wearable summary, 0-10",
      title: "Stress estimate",
      unit: "/10",
      yDomain: [0, 10],
    },
    {
      baseline: patient.baseline.screenTimeHours,
      data: phoneSeries,
      dataKey: "screenTimeHours",
      latest: latestPhone?.screenTimeHours,
      metricType: "phoneHigh",
      subtitle: "Hours per day",
      title: "Screen time",
      unit: "h",
    },
    {
      baseline: patient.baseline.socialAppUsageMinutes,
      data: phoneSeries,
      dataKey: "socialAppUsageMinutes",
      latest: latestPhone?.socialAppUsageMinutes,
      metricType: "phoneHigh",
      subtitle: "Minutes per day",
      title: "Social app usage",
      unit: "min",
    },
    {
      baseline: patient.baseline.unlockFrequency,
      data: phoneSeries,
      dataKey: "unlockFrequency",
      latest: latestPhone?.unlockFrequency,
      metricType: "phoneHigh",
      subtitle: "Unlocks per day",
      title: "Unlock frequency",
      unit: "/day",
    },
    {
      baseline: 1,
      data: selfReportSeries,
      dataKey: "medicationAdherence",
      latest: latestCheckIn ? medicationValue(latestCheckIn.medicationTakenToday) : undefined,
      metricType: "adherence",
      subtitle: "1 yes, 0.5 partial, 0 no",
      title: "Medication adherence",
      yDomain: [0, 1],
    },
  ];

  return (
    <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="rounded-[1.75rem] bg-[radial-gradient(circle_at_top_left,_#dbeafe,_#ffffff_55%,_#f8fafc)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Detailed patient view
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-semibold text-slate-950">
                {patient.profile.name}
              </h2>
              {aiEnabled ? (
                <ConcernPill
                  level={patient.latestRisk.concernLevel}
                  score={aiConcernScore}
                />
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {patient.monitoringReason}. Last check-in{" "}
              {latestCheckIn ? formatDateTime(latestCheckIn.timestamp) : "not available"}.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <HeaderChip label="Action status" value={formatActionStatus(actionStatus)} />
            <HeaderChip
              label="Data quality"
              value={formatDataQualityLevel(patient.latestRisk.dataQuality.level)}
            />
            <HeaderChip
              label="Recommended action"
              value={aiEnabled ? patient.latestRisk.recommendedAction : "Manual clinician review"}
            />
            {aiEnabled ? (
              <HeaderChip
                label="Change from baseline"
                value={`${patient.latestRisk.changeFromBaselineScore}/10`}
              />
            ) : (
              <HeaderChip label="AI assistance" value="Off" />
            )}
            {clinicianConfirmedConcern ? (
              <HeaderChip
                label="Clinician-confirmed concern"
                value={`${
                  clinicianConfirmedConcernScore
                    ? `${clinicianConfirmedConcernScore} / 10 - `
                    : ""
                }${formatConcernLabel(clinicianConfirmedConcern)}`}
              />
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <ActionButton label="Mark reviewed" onClick={onMarkReviewed} />
          <ActionButton label="Send message" onClick={() => setActiveModal("message")} />
          <ActionButton label="Request follow-up check-in" onClick={onRequestFollowUpCheckIn} />
          <ActionButton
            disabled={!pendingAppointments.length}
            label="Approve appointment"
            onClick={() => {
              const firstPending = pendingAppointments[0];
              if (firstPending) onApproveAppointment(firstPending.id);
            }}
          />
          <ActionButton label="Escalate care" onClick={() => setActiveModal("escalate")} />
          <ActionButton
            label="Change concern level"
            onClick={() => {
              setOverrideScore(clinicianConfirmedConcernScore ?? aiConcernScore);
              setActiveModal("override");
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-4">
          <SectionCard
            icon={<Stethoscope className="h-4 w-4 text-sky-600" />}
            title="Patient risk snapshot"
          >
            <div className="grid gap-3 md:grid-cols-4">
              <InfoTile
                label="AI-estimated concern"
                value={aiEnabled ? formatConcernScore(patient.latestRisk) : "Hidden"}
              />
              <InfoTile
                label="Evidence strength"
                value={
                  aiEnabled
                    ? formatEvidenceStrength(patient.latestRisk.evidenceStrength)
                    : "Manual review"
                }
              />
              <InfoTile
                label="Data quality"
                value={formatDataQualityLevel(patient.latestRisk.dataQuality.level)}
              />
              <InfoTile
                label="Last data sync"
                value={formatDateTime(patient.latestRisk.lastDataSyncAt)}
              />
            </div>
            <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {aiEnabled
                ? patient.latestRisk.clinicianFacingSummary
                : "AI assistance is OFF. Use the shared data panels to assign concern and decide next steps."}
            </p>
          </SectionCard>

          {aiEnabled ? (
            <SectionCard
              icon={<ChartColumnIncreasing className="h-4 w-4 text-sky-600" />}
              onPanelViewed={trackPanel}
              panelId="ai_rationale"
              title="AI rationale / change from baseline"
            >
              <div className="rounded-2xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                AI rationale is decision support only and should not replace clinical judgment.
              </div>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <SignalList
                  emptyText="No strong supporting signals were detected."
                  title="Signals supporting concern"
                  values={patient.latestRisk.supportingSignals}
                />
                <SignalList
                  emptyText="No strong contradicting signals were detected."
                  title="Contradicting or stabilizing factors"
                  values={patient.latestRisk.contradictingSignals}
                />
              </div>
              {patient.clinicianOverrides.length ? (
                <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">Latest clinician override</div>
                  <p className="mt-1">
                    {patient.clinicianOverrides.at(-1)?.originalAIConcernScore ??
                      getConcernScore(patient.latestRisk)}
                    /10{" "}
                    {formatConcernLabel(
                      patient.clinicianOverrides.at(-1)?.originalAIConcernLevel ??
                        patient.latestRisk.concernLevel,
                    )}{" "}
                    to{" "}
                    {patient.clinicianOverrides.at(-1)?.clinicianConcernScore ??
                      getConcernScore(patient.latestRisk)}
                    /10{" "}
                    {formatConcernLabel(
                      patient.clinicianOverrides.at(-1)?.clinicianConcernLevel ??
                        patient.latestRisk.concernLevel,
                    )}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {patient.clinicianOverrides.at(-1)?.reason}
                    {patient.clinicianOverrides.at(-1)?.note
                      ? ` - ${patient.clinicianOverrides.at(-1)?.note}`
                      : ""}
                  </p>
                </div>
              ) : null}
            </SectionCard>
          ) : (
            <SectionCard
              icon={<SlidersHorizontal className="h-4 w-4 text-slate-600" />}
              onPanelViewed={trackPanel}
              panelId="ai_rationale"
              title="Manual review mode"
            >
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                AI assistance is OFF. Raw shared data and clinician-entered actions remain visible.
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {sharingNotes.map((note) => (
                  <InfoTile key={note} label="Sharing note" value={note} />
                ))}
              </div>
            </SectionCard>
          )}

          <TrendSection
            onPanelViewed={trackPanel}
            panelId="self_report"
            title="Core mood-risk trends"
            trends={coreTrends}
          />

          <TrendSection
            onPanelViewed={trackPanel}
            panelId="phone_behavior"
            title="Behavioral activation trends"
            trends={activationTrends}
          />

          <SectionCard
            icon={<MessageSquare className="h-4 w-4 text-sky-600" />}
            onPanelViewed={trackPanel}
            panelId="phone_behavior"
            title="Phone behavior summary"
          >
            <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              Only behavioral summaries are shown. Raw private content is not displayed.
            </p>
            {latestPhone ? (
              <>
                <PhoneSummaryGrid patient={patient} />
                <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">Summary insights</div>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
                    {phoneBehaviorInsights.map((insight) => (
                      <li key={insight}>- {insight}</li>
                    ))}
                  </ul>
                </div>
                <details className="mt-3 rounded-2xl border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                    Show supporting phone signals
                  </summary>
                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    {supportingTrends
                      .filter((trend) =>
                        ["screenTimeHours", "socialAppUsageMinutes", "unlockFrequency"].includes(
                          trend.dataKey,
                        ),
                      )
                      .map((trend) => (
                        <CompactTrendCard key={trend.dataKey} trend={trend} />
                      ))}
                  </div>
                </details>
              </>
            ) : (
              <MissingData message="No phone behavior summary is currently available." />
            )}
          </SectionCard>

          <SectionCard
            icon={<ChartColumnIncreasing className="h-4 w-4 text-sky-600" />}
            onPanelViewed={trackPanel}
            panelId="self_report"
            title="Self-report pattern view"
          >
            <div className="grid gap-3 lg:grid-cols-3">
              {[
                coreTrends[1],
                coreTrends[2],
                supportingTrends.find((trend) => trend.dataKey === "sleepQuality" && trend.data === selfReportSeries),
              ]
                .filter(Boolean)
                .map((trend) => (
                  <CompactTrendCard key={`${trend?.title}-${trend?.dataKey}`} trend={trend!} />
                ))}
              {["anxiety", "irritability", "impulsivity"].map((key) => {
                const baseline =
                  key === "anxiety"
                    ? patient.baseline.anxiety
                    : key === "irritability"
                      ? patient.baseline.irritability
                      : patient.baseline.impulsivity;
                const latest =
                  key === "anxiety"
                    ? latestCheckIn?.anxiety
                    : key === "irritability"
                      ? latestCheckIn?.irritability
                      : latestCheckIn?.impulsivity;

                return (
                  <CompactTrendCard
                    key={key}
                    trend={{
                      baseline,
                      data: selfReportSeries,
                      dataKey: key,
                      latest,
                      metricType: "scaleHigh",
                      subtitle: "0-10 self-report",
                      title: formatMetricTitle(key),
                      unit: "/10",
                      yDomain: [0, 10],
                    }}
                  />
                );
              })}
              <CompactTrendCard
                trend={{
                  baseline: 1,
                  data: selfReportSeries,
                  dataKey: "medicationAdherence",
                  latest: latestCheckIn ? medicationValue(latestCheckIn.medicationTakenToday) : undefined,
                  metricType: "adherence",
                  subtitle: "Yes / no / partial / not applicable",
                  title: "Medication adherence",
                  yDomain: [0, 1],
                }}
              />
            </div>
          </SectionCard>

          <details
            className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"
            onMouseEnter={() => trackPanel("wearable")}
            onFocusCapture={() => trackPanel("wearable")}
          >
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Show supporting signals
            </summary>
            <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              Wearable and supporting phone data may be noisy and should be interpreted with
              self-report and clinical context.
            </p>
            {patient.wearableData.length || patient.phoneBehaviorData.length ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {supportingTrends.map((trend) => (
                  <CompactTrendCard key={`${trend.title}-${trend.dataKey}`} trend={trend} />
                ))}
              </div>
            ) : (
              <MissingData message="No supporting signal data is currently available." />
            )}
          </details>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <SectionCard
            icon={<Stethoscope className="h-4 w-4 text-sky-600" />}
            title="Patient summary"
          >
            <div className="grid gap-2">
              <InfoTile label="Age" value={patient.profile.age ? `${patient.profile.age}` : "Not provided"} />
              <InfoTile label="Pronouns" value={patient.profile.pronouns ?? "Not provided"} />
              <InfoTile
                label="Current concern"
                value={
                  clinicianConfirmedConcern
                    ? `${
                        clinicianConfirmedConcernScore
                          ? `${clinicianConfirmedConcernScore} / 10 - `
                          : ""
                      }${formatConcernLabel(clinicianConfirmedConcern)}`
                    : aiEnabled
                      ? formatConcernScore(patient.latestRisk)
                      : "Manual review pending"
                }
              />
              <InfoTile label="Monitoring reason" value={patient.monitoringReason} />
            </div>
          </SectionCard>

          <SectionCard
            icon={<MessageSquare className="h-4 w-4 text-sky-600" />}
            onPanelViewed={trackPanel}
            panelId="ai_notes"
            title="AI-summarized daily notes"
          >
            <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              Raw private content is not displayed by default. Clinician-safe summaries only.
            </p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {clinicianSafeNoteSummary.map((line) => (
                <li key={line}>- {line}</li>
              ))}
            </ul>
            {patient.profile.sharingPreferences.shareRawNotesWithClinician && latestCheckIn?.note ? (
              <div className="mt-3 rounded-2xl border border-slate-200 p-3">
                <button
                  type="button"
                  onClick={() => setShowSharedNote((value) => !value)}
                  className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  {showSharedNote ? "Hide patient-shared note" : "View patient-shared note"}
                </button>
                {showSharedNote ? (
                  <p className="mt-3 text-sm leading-6 text-slate-700">{latestCheckIn.note}</p>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            icon={<CalendarClock className="h-4 w-4 text-sky-600" />}
            onPanelViewed={trackPanel}
            panelId="communication_history"
            title="Appointments and history"
          >
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Appointment requests
              </h4>
              <div className="mt-2 space-y-2">
                {patient.appointmentRequests.length ? (
                  patient.appointmentRequests
                    .slice()
                    .reverse()
                    .map((request) => (
                      <AppointmentRequestCard
                        key={request.id}
                        onApprove={() => onApproveAppointment(request.id)}
                        onRequestInformation={() => onRequestAppointmentInfo(request.id)}
                        onReview={() => onReviewAppointmentRequest(request.id)}
                        request={request}
                      />
                    ))
                ) : (
                  <MissingData message="No appointment requests are on file." />
                )}
              </div>
            </div>
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Communication and review history
              </h4>
              <div className="mt-2 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {communicationHistory.length ? (
                  communicationHistory.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                          {item.status}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDateTime(item.timestamp)}
                      </div>
                      <p className="mt-2 leading-6">{item.description}</p>
                    </div>
                  ))
                ) : (
                  <MissingData message="No communication or review history yet." />
                )}
              </div>
            </div>
          </SectionCard>

          <TestJudgmentPanel
            agreedWithAI={agreedWithAI}
            aiEnabled={aiEnabled}
            canSubmit={canSubmitTestJudgment}
            detailOpenedAt={detailOpenedAt}
            latestSubmission={latestJATSubmission}
            onAgreeWithAIChange={setAgreedWithAI}
            onConfidenceChange={setTesterConfidence}
            onConcernScoreChange={setTesterConcernScore}
            onNoteChange={setTesterNote}
            onResetAllSubmissions={onResetJATSubmissions}
            onSubmit={() => {
              if (!canSubmitTestJudgment) return;

              onSubmitJATJudgment({
                agreedWithAI,
                openedDetailView: true,
                testerAction,
                testerConfidence,
                testerConcernScore,
                testerNote: testerNote.trim() || undefined,
                timeToDecisionMs: Math.max(0, Date.now() - detailOpenedAt),
                viewedPanels,
              });
            }}
            onTesterActionChange={setTesterAction}
            testerAction={testerAction}
            testerConfidence={testerConfidence}
            testerConcernScore={testerConcernScore}
            testerNote={testerNote}
            totalSubmissionCount={testSubmissionCount}
          />

          {showFacilitatorTools ? (
            <FacilitatorPanel
              patient={patient}
              showGroundTruth={showGroundTruth}
              onToggle={() => setShowGroundTruth((value) => !value)}
            />
          ) : null}
        </aside>
      </div>

      {activeModal === "message" ? (
        <ModalShell
          title="Send message to patient"
          onClose={() => setActiveModal(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSendSupportiveMessage(supportiveMessage.trim());
                  setActiveModal(null);
                }}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
              >
                Send
              </button>
            </>
          }
        >
          <label className="mb-2 block text-sm font-medium text-slate-700">Message to patient</label>
          <textarea
            value={supportiveMessage}
            onChange={(event) => setSupportiveMessage(event.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
          />
        </ModalShell>
      ) : null}

      {activeModal === "escalate" ? (
        <ModalShell
          title="Escalate care"
          onClose={() => setActiveModal(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onEscalateCare(escalationNote.trim());
                  setActiveModal(null);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white"
              >
                <ShieldAlert className="h-4 w-4" />
                Confirm escalation
              </button>
            </>
          }
        >
          <div className="rounded-3xl bg-red-50 p-4 text-sm leading-6 text-red-900">
            Prototype only: real emergency services are not contacted from this action.
          </div>
          <label className="mb-2 mt-4 block text-sm font-medium text-slate-700">
            Escalation note
          </label>
          <textarea
            value={escalationNote}
            onChange={(event) => setEscalationNote(event.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-400"
          />
        </ModalShell>
      ) : null}

      {activeModal === "override" ? (
        <ModalShell
          title="Change concern level / override AI"
          onClose={() => setActiveModal(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeConcernLevel({
                    clinicianConcernLevel: overrideConcern,
                    clinicianConcernScore: overrideScore,
                    reason: overrideReason,
                    note: overrideNote.trim(),
                  });
                  setActiveModal(null);
                }}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
              >
                Save override
              </button>
            </>
          }
        >
          <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
            Current AI-estimated concern:{" "}
            <strong>
              {aiConcernScore} / 10 - {formatConcernLabel(patient.latestRisk.concernLevel)}
            </strong>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Clinician-selected concern score
              </label>
              <input
                max={10}
                min={1}
                type="range"
                value={overrideScore}
                onChange={(event) => setOverrideScore(Number(event.target.value))}
                className="w-full accent-sky-600"
              />
              <select
                value={overrideScore}
                onChange={(event) => setOverrideScore(Number(event.target.value))}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                  <option key={score} value={score}>
                    {score}
                  </option>
                ))}
              </select>
              <div className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Derived urgency label: <strong>{formatConcernLabel(overrideConcern)}</strong>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Reason for override
              </label>
              <select
                value={overrideReason}
                onChange={(event) =>
                  setOverrideReason(event.target.value as ClinicianOverrideReason)
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
              >
                {overrideReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="mb-2 mt-4 block text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={overrideNote}
            onChange={(event) => setOverrideNote(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
            placeholder="Optional contextual note for the review history."
          />
        </ModalShell>
      ) : null}
    </section>
  );
}

function TrendSection({
  onPanelViewed,
  panelId,
  title,
  trends,
}: {
  onPanelViewed: (panelId: string) => void;
  panelId: string;
  title: string;
  trends: TrendDefinition[];
}) {
  return (
    <SectionCard
      icon={<ChartColumnIncreasing className="h-4 w-4 text-sky-600" />}
      onPanelViewed={onPanelViewed}
      panelId={panelId}
      title={title}
    >
      <div className="grid gap-3 lg:grid-cols-3">
        {trends.map((trend) => (
          <CompactTrendCard key={`${trend.title}-${trend.dataKey}`} trend={trend} />
        ))}
      </div>
    </SectionCard>
  );
}

function CompactTrendCard({ trend }: { trend: TrendDefinition }) {
  const status = getDeviationStatus(trend.latest, trend.baseline, trend.metricType);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={status} />
        <span className="text-[11px] text-slate-500">
          Latest {formatMetricValue(trend.latest, trend.unit ?? "")}
        </span>
      </div>
      <ComparisonLineChart
        baseline={trend.baseline}
        baselineLabel="Base"
        baselineRange={getBaselineBand(trend.baseline, trend.metricType)}
        color={getTrendColor(status)}
        data={trend.data}
        dataKey={trend.dataKey}
        heightClassName="h-28"
        subtitle={trend.subtitle}
        title={trend.title}
        yDomain={trend.yDomain}
      />
    </div>
  );
}

function PhoneSummaryGrid({ patient }: { patient: PatientRecord }) {
  const latestPhone = patient.phoneBehaviorData.at(-1);
  if (!latestPhone) return null;

  const rows = [
    {
      baseline: patient.baseline.screenTimeHours,
      label: "Screen time",
      metricType: "phoneHigh" as DeviationMetricType,
      unit: "h",
      value: latestPhone.screenTimeHours,
    },
    {
      baseline: patient.baseline.nighttimePhoneUseMinutes,
      label: "Nighttime phone use",
      metricType: "phoneHigh" as DeviationMetricType,
      unit: "min",
      value: latestPhone.nighttimePhoneUseMinutes,
    },
    {
      baseline: patient.baseline.socialAppUsageMinutes,
      label: "Social app usage",
      metricType: "phoneHigh" as DeviationMetricType,
      unit: "min",
      value: latestPhone.socialAppUsageMinutes,
    },
    {
      baseline: patient.baseline.spendingAppVisits,
      label: "Spending app visits",
      metricType: "countHigh" as DeviationMetricType,
      unit: "/day",
      value: latestPhone.spendingAppVisits,
    },
    {
      baseline: patient.baseline.unlockFrequency,
      label: "Unlock frequency",
      metricType: "phoneHigh" as DeviationMetricType,
      unit: "/day",
      value: latestPhone.unlockFrequency,
    },
  ];

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-5">
      {rows.map((row) => {
        const status = getDeviationStatus(row.value, row.baseline, row.metricType);
        const percent =
          row.baseline === 0 ? 0 : Math.round(((row.value - row.baseline) / row.baseline) * 100);

        return (
          <div key={row.label} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {row.label}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {formatMetricValue(row.value, row.unit)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Base {formatMetricValue(row.baseline, row.unit)} | {percent >= 0 ? "+" : ""}
              {percent}%
            </div>
            <div className="mt-2">
              <StatusBadge status={status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SignalList({
  emptyText,
  title,
  values,
}: {
  emptyText: string;
  title: string;
  values: string[];
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h4>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
        {values.length ? values.map((signal) => <li key={signal}>- {signal}</li>) : <li>- {emptyText}</li>}
      </ul>
    </div>
  );
}

function TestJudgmentPanel({
  agreedWithAI,
  aiEnabled,
  canSubmit,
  detailOpenedAt,
  latestSubmission,
  onAgreeWithAIChange,
  onConfidenceChange,
  onConcernScoreChange,
  onNoteChange,
  onResetAllSubmissions,
  onSubmit,
  onTesterActionChange,
  testerAction,
  testerConfidence,
  testerConcernScore,
  testerNote,
  totalSubmissionCount,
}: {
  agreedWithAI: boolean;
  aiEnabled: boolean;
  canSubmit: boolean;
  detailOpenedAt: number;
  latestSubmission?: JATTesterSubmission;
  onAgreeWithAIChange: (value: boolean) => void;
  onConfidenceChange: (value: number) => void;
  onConcernScoreChange: (value: number | null) => void;
  onNoteChange: (value: string) => void;
  onResetAllSubmissions: () => void;
  onSubmit: () => void;
  onTesterActionChange: (value: JATTesterAction | "") => void;
  testerAction: JATTesterAction | "";
  testerConfidence: number;
  testerConcernScore: number | null;
  testerNote: string;
  totalSubmissionCount: number;
}) {
  const testerConcernLabel =
    testerConcernScore === null
      ? "Not selected"
      : `${testerConcernScore}/10 - ${formatConcernLabel(
          concernLevelFromScore(testerConcernScore),
        )}`;

  return (
    <SectionCard icon={<FlaskConical className="h-4 w-4 text-emerald-700" />} title="Submit test judgment">
      <div className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
        Submit the tester final judgment after reviewing the clinical evidence.
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Tester concern score: {testerConcernLabel}
          </label>
          <select
            value={testerConcernScore ?? ""}
            onChange={(event) =>
              onConcernScoreChange(
                event.target.value ? Number(event.target.value) : null,
              )
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
          >
            <option value="" disabled>
              Select concern score
            </option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
              <option key={score} value={score}>
                {score} - {formatConcernLabel(concernLevelFromScore(score))}
              </option>
            ))}
          </select>
          {testerConcernScore !== null ? (
            <input
              max={10}
              min={1}
              type="range"
              value={testerConcernScore}
              onChange={(event) => onConcernScoreChange(Number(event.target.value))}
              className="mt-3 w-full accent-sky-600"
            />
          ) : null}
          {!aiEnabled ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              AI assistance is off, so no AI score is preselected.
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Tester selected action
          </label>
          <select
            value={testerAction}
            onChange={(event) =>
              onTesterActionChange(event.target.value as JATTesterAction | "")
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
          >
            <option value="" disabled>
              Select action
            </option>
            {testerActions.map((action) => (
              <option key={action} value={action}>
                {formatTesterAction(action)}
              </option>
            ))}
          </select>
          {!aiEnabled ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Choose the action manually after reviewing the shared data.
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Tester confidence: {testerConfidence}/10
          </label>
          <input
            max={10}
            min={1}
            type="range"
            value={testerConfidence}
            onChange={(event) => onConfidenceChange(Number(event.target.value))}
            className="w-full accent-sky-600"
          />
        </div>

        {aiEnabled ? (
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={agreedWithAI}
              onChange={(event) => onAgreeWithAIChange(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Agree with AI estimate
          </label>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            AI assistance is off. Agreement with AI will be recorded as no for this
            judgment.
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Why did you make this decision? Optional
          </label>
          <textarea
            value={testerNote}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
          />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {canSubmit ? "Submit test judgment" : "Select score and action to submit"}
        </button>

        {latestSubmission ? (
          <div className="rounded-2xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">
            Latest test submission: {latestSubmission.testerConcernScore}/10 -{" "}
            {formatConcernLabel(latestSubmission.testerConcernLabel)}, action{" "}
            {formatTesterAction(latestSubmission.testerAction)}, confidence{" "}
            {latestSubmission.testerConfidence}/10.
          </div>
        ) : null}

        {detailOpenedAt ? (
          <div className="text-xs text-slate-400">
            Decision timer started when this detail view opened.
          </div>
        ) : null}

        <button
          type="button"
          disabled={totalSubmissionCount === 0}
          onClick={() => {
            if (
              window.confirm(
                `Reset all ${totalSubmissionCount} submitted test judgments? This will keep patient data but clear tester judgments.`,
              )
            ) {
              onResetAllSubmissions();
            }
          }}
          className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
        >
          Reset all submitted test judgments
        </button>
      </div>
    </SectionCard>
  );
}

function FacilitatorPanel({
  onToggle,
  patient,
  showGroundTruth,
}: {
  onToggle: () => void;
  patient: PatientRecord;
  showGroundTruth: boolean;
}) {
  return (
    <SectionCard icon={<SlidersHorizontal className="h-4 w-4 text-slate-600" />} title="Facilitator View">
      <button
        type="button"
        onClick={onToggle}
        className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
      >
        {showGroundTruth ? "Hide facilitator ground truth" : "Show facilitator ground truth"}
      </button>

      {showGroundTruth ? (
        patient.groundTruth ? (
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <InfoTile
              label="Ground truth concern"
              value={`${patient.groundTruth.trueConcernScore}/10 - ${formatConcernLabel(
                patient.groundTruth.trueConcernLabel,
              )}`}
            />
            <InfoTile
              label="AI estimate"
              value={`${patient.groundTruth.aiEstimatedConcernScore}/10 - ${formatConcernLabel(
                patient.groundTruth.aiEstimatedConcernLabel,
              )}`}
            />
            <InfoTile label="Correct action" value={patient.groundTruth.correctActionText} />
            <div className="rounded-2xl bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Challenge tags
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {patient.groundTruth.challengeTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <p>
              <strong>Scenario purpose:</strong> {patient.groundTruth.scenarioPurpose}
            </p>
            <p>
              <strong>Rationale:</strong> {patient.groundTruth.groundTruthRationale}
            </p>
            <p>
              <strong>Expected reasoning:</strong>{" "}
              {patient.groundTruth.expectedClinicianReasoning}
            </p>
          </div>
        ) : (
          <MissingData message="No ground truth is attached to this test user." />
        )
      ) : (
        <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          Keep this hidden during normal tester sessions.
        </div>
      )}
    </SectionCard>
  );
}

function SectionCard({
  children,
  icon,
  onPanelViewed,
  panelId,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  onPanelViewed?: (panelId: string) => void;
  panelId?: string;
  title: string;
}) {
  return (
    <section
      onFocusCapture={() => {
        if (panelId) onPanelViewed?.(panelId);
      }}
      onMouseEnter={() => {
        if (panelId) onPanelViewed?.(panelId);
      }}
      className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

function ActionButton({
  disabled,
  label,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-400 hover:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    >
      {label}
    </button>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium leading-6 text-slate-800">{value}</div>
    </div>
  );
}

function ConcernPill({ level, score }: { level: ConcernLevel; score: number }) {
  const label = formatConcernLabel(level);
  const iconClass =
    level === "urgent"
      ? "text-red-700"
      : level === "elevated"
        ? "text-orange-700"
        : level === "watch"
          ? "text-sky-700"
          : "text-teal-700";
  const pillClass =
    level === "urgent"
      ? "bg-red-50 text-red-800 ring-red-200"
      : level === "elevated"
        ? "bg-orange-50 text-orange-800 ring-orange-200"
        : level === "watch"
          ? "bg-sky-50 text-sky-800 ring-sky-200"
          : "bg-teal-50 text-teal-800 ring-teal-200";
  const Icon =
    level === "urgent" || level === "elevated"
      ? AlertTriangle
      : level === "watch"
        ? Info
        : CheckCircle2;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${pillClass}`}>
      <Icon className={`h-4 w-4 ${iconClass}`} />
      {score}/10 {label}
    </span>
  );
}

function StatusBadge({ status }: { status: DeviationStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${getDeviationBadgeClass(status)}`}>
      {formatDeviationStatus(status)}
    </span>
  );
}

function MissingData({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
      {message}
    </div>
  );
}

function AppointmentRequestCard({
  onApprove,
  onRequestInformation,
  onReview,
  request,
}: {
  onApprove: () => void;
  onRequestInformation: () => void;
  onReview: () => void;
  request: AppointmentRequest;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium text-slate-900">{request.reason}</div>
        <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] text-slate-700">
          {request.status}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-500">{formatDateTime(request.createdAt)}</div>
      {request.note ? <p className="mt-2 leading-6">{request.note}</p> : null}
      {request.clinicianResponseNote ? (
        <p className="mt-2 text-slate-600">Response: {request.clinicianResponseNote}</p>
      ) : null}

      {request.status === "pending" ? (
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-medium text-white"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onRequestInformation}
            className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
          >
            Request more information
          </button>
          <button
            type="button"
            onClick={onReview}
            className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
          >
            Mark as reviewed
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ModalShell({
  children,
  footer,
  onClose,
  title,
}: {
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <AlertTriangle className="h-5 w-5 text-sky-600" />
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600"
          >
            Close
          </button>
        </div>
        <div className="mt-5">{children}</div>
        <div className="mt-6 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function formatMetricTitle(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatMetricValue(value: number | undefined, unit: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  const formatted = Number.isInteger(value) ? `${value}` : value.toFixed(1);
  if (!unit) return formatted;
  if (unit.startsWith("/")) return `${formatted}${unit}`;
  return `${formatted} ${unit}`;
}

function formatTesterAction(action: JATTesterAction): string {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function medicationValue(status: PatientRecord["checkIns"][number]["medicationTakenToday"]): number {
  if (status === "yes" || status === "not-applicable") return 1;
  if (status === "partial") return 0.5;
  return 0;
}
