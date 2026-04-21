import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  Download,
  Eye,
  EyeOff,
  Flag,
  Heart,
  MessageSquare,
  Minus,
  Moon,
  Phone,
  Pill,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Smartphone,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { buildPatientPool } from "./data/patients";
import {
  ACTION_LABELS,
  JAT_CONDITIONS,
  RISK_ORDER,
  aiUrgencyScore,
  buildChallengeMetrics,
  buildFallbackRecommendation,
  groundTruthUrgency,
} from "../shared/researchModel";

const ACTION_ICONS = {
  "no-action": CheckCircle2,
  "auto-checkin": Bell,
  "manual-outreach": Phone,
  "clinician-review": Stethoscope,
  "urgent-escalation": ShieldAlert,
};

const RISK_STYLES = {
  Stable: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    border: "border-emerald-300",
    accent: "bg-emerald-600",
    card: "bg-emerald-50/70",
  },
  Watch: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    border: "border-amber-300",
    accent: "bg-amber-500",
    card: "bg-amber-50/70",
  },
  Elevated: {
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    border: "border-orange-300",
    accent: "bg-orange-500",
    card: "bg-orange-50/70",
  },
  "Urgent Review": {
    badge: "bg-red-50 text-red-700 border-red-200",
    border: "border-red-300",
    accent: "bg-red-600",
    card: "bg-red-50/70",
  },
};

function initializePatients() {
  const now = new Date().toISOString();
  return buildPatientPool().map((patient) => ({
    ...patient,
    ai: buildFallbackRecommendation(patient),
    aiMeta: {
      source: "fallback",
      model: "research-heuristic",
      updatedAt: now,
      pending: false,
      error: null,
    },
  }));
}

function buildAssessmentPayload(patient) {
  const { ai: _ai, aiMeta: _aiMeta, groundTruth: _groundTruth, ...payload } = patient;
  return payload;
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

function formatUpdatedAt(value) {
  if (!value) return "Not run yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function App() {
  const [patients, setPatients] = useState(() => initializePatients());
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState("P-0142");
  const [patientViewId, setPatientViewId] = useState("P-0142");
  const [jatCondition, setJatCondition] = useState("FULL");
  const [patientLoad, setPatientLoad] = useState(14);
  const [showGroundTruth, setShowGroundTruth] = useState(false);
  const [showJatPanel, setShowJatPanel] = useState(false);
  const [actionLog, setActionLog] = useState([]);
  const [statusNote, setStatusNote] = useState(
    "Recommendations start in heuristic mode. Use Gemini refresh to generate live research assessments.",
  );
  const [refreshingVisible, setRefreshingVisible] = useState(false);

  const selectedPatient = patients.find((patient) => patient.id === selectedId) ?? patients[0];
  const patientForView = patients.find((patient) => patient.id === patientViewId) ?? patients[0];
  const visiblePatients = useMemo(
    () => patients.slice(0, Math.min(patientLoad, patients.length)),
    [patients, patientLoad],
  );
  const liveCount = visiblePatients.filter((patient) => patient.aiMeta.source === "gemini").length;

  const updatePatientMeta = (patientIds, patch) => {
    setPatients((current) =>
      current.map((patient) =>
        patientIds.includes(patient.id)
          ? { ...patient, aiMeta: { ...patient.aiMeta, ...patch } }
          : patient,
      ),
    );
  };

  const applyRecommendationResult = (result) => {
    startTransition(() => {
      setPatients((current) =>
        current.map((patient) =>
          patient.id === result.patientId
            ? {
                ...patient,
                ai: result.recommendation,
                aiMeta: {
                  ...patient.aiMeta,
                  ...result.meta,
                  pending: false,
                  error: null,
                },
              }
            : patient,
        ),
      );
    });
  };

  const refreshPatientFromSnapshot = async (snapshot) => {
    updatePatientMeta([snapshot.id], { pending: true, error: null });
    try {
      const data = await postJson("/api/recommendation", {
        patient: buildAssessmentPayload(snapshot),
      });
      applyRecommendationResult(data);
      setStatusNote(
        `${snapshot.name} assessed via ${data.meta.source === "gemini" ? "Gemini" : "fallback"} at ${formatUpdatedAt(data.meta.updatedAt)}.`,
      );
    } catch (error) {
      updatePatientMeta([snapshot.id], { pending: false, error: error.message });
      setStatusNote(`Unable to refresh ${snapshot.name}: ${error.message}`);
    }
  };

  const refreshPatient = async (patientId) => {
    const snapshot = patients.find((patient) => patient.id === patientId);
    if (!snapshot) return;
    await refreshPatientFromSnapshot(snapshot);
  };

  const refreshVisiblePatients = async () => {
    const snapshots = visiblePatients.map((patient) => buildAssessmentPayload(patient));
    const ids = visiblePatients.map((patient) => patient.id);
    setRefreshingVisible(true);
    updatePatientMeta(ids, { pending: true, error: null });

    try {
      const data = await postJson("/api/recommendations/batch", { patients: snapshots });
      startTransition(() => {
        setPatients((current) =>
          current.map((patient) => {
            const match = data.results.find((item) => item.patientId === patient.id);
            if (!match) return patient;
            return {
              ...patient,
              ai: match.recommendation,
              aiMeta: {
                ...patient.aiMeta,
                ...match.meta,
                pending: false,
                error: null,
              },
            };
          }),
        );
      });
      setStatusNote(
        `Refreshed ${data.results.length} visible patients. ${data.results.filter((item) => item.meta.source === "gemini").length} used Gemini.`,
      );
    } catch (error) {
      updatePatientMeta(ids, { pending: false, error: error.message });
      setStatusNote(`Batch refresh failed: ${error.message}`);
    } finally {
      setRefreshingVisible(false);
    }
  };

  const recordAction = (actionType, patient, rationale, clinicianUrgency, chosenAction = null) => {
    setActionLog((current) => [
      ...current,
      {
        timestamp: new Date().toISOString(),
        jatCondition,
        patientLoad,
        patientId: patient.id,
        patientName: patient.name,
        actionType,
        chosenAction,
        rationale,
        clinicianUrgency,
        aiUrgency: aiUrgencyScore(patient.ai),
        groundTruthUrgency: groundTruthUrgency(patient.groundTruth),
        aiLevel: patient.ai.riskLevel,
        aiAction: patient.ai.recommendedAction,
        truthLevel: patient.groundTruth.level,
        truthAction: patient.groundTruth.action,
        aiSource: patient.aiMeta.source,
        aiModel: patient.aiMeta.model,
      },
    ]);
  };

  const handleCheckinSubmit = async (patientId, submission) => {
    let snapshot = null;
    setPatients((current) =>
      current.map((patient) => {
        if (patient.id !== patientId) return patient;

        const updated = {
          ...patient,
          selfReport: {
            ...patient.selfReport,
            mood: submission.mood,
            energy: submission.energy,
            irritability: submission.mood >= 8 ? Math.max(patient.selfReport.irritability ?? 0, 6) : patient.selfReport.irritability,
            impulsivity: submission.mood >= 8 ? Math.max(patient.selfReport.impulsivity ?? 0, 5) : patient.selfReport.impulsivity,
            hopelessness: submission.safety === "yes" ? 8 : submission.mood <= 3 ? Math.max(patient.selfReport.hopelessness ?? 0, 5) : Math.min(patient.selfReport.hopelessness ?? 2, 3),
            anxiety: submission.safety === "yes" ? 8 : Math.max(patient.selfReport.anxiety ?? 3, submission.energy >= 8 ? 5 : 3),
            lastUpdate: "just now",
            missed: 0,
            note: submission.note,
          },
          patientResponse: "responsive",
          communications: [
            {
              date: "Now",
              type: submission.safety === "yes" ? "Patient help request" : "Patient check-in",
              status: "submitted",
              note: submission.note || `Mood ${submission.mood}/10, energy ${submission.energy}/10.`,
            },
            ...patient.communications,
          ].slice(0, 4),
        };
        snapshot = updated;
        return updated;
      }),
    );

    setSelectedId(patientId);
    setView("dashboard");
    setStatusNote("Patient check-in captured. Refreshing recommendation now.");

    if (snapshot) {
      await refreshPatientFromSnapshot(snapshot);
    }
  };

  const handleHelpRequest = (patientId) => {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;

    setPatients((current) =>
      current.map((item) =>
        item.id === patientId
          ? {
              ...item,
              communications: [
                {
                  date: "Now",
                  type: "Patient call request",
                  status: "submitted",
                  note: "Requested coordinator outreach from patient app.",
                },
                ...item.communications,
              ].slice(0, 4),
              patientResponse: "responsive",
            }
          : item,
      ),
    );
    recordAction("patient-help-request", patient, "Patient requested coordinator outreach.", 7, "manual-outreach");
    setStatusNote(`${patient.name} requested a coordinator callback.`);
    setView("dashboard");
    setSelectedId(patientId);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">MoodWatch JAT Console</div>
              <div className="text-xs text-slate-500">
                Research prototype for cognitive engineering, simulation, and human-machine teaming
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={() => setView("dashboard")}
              className={`rounded-full px-4 py-2 ${view !== "patient" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              <Users className="mr-2 inline h-4 w-4" />
              Care team view
            </button>
            <button
              onClick={() => setView("patient")}
              className={`rounded-full px-4 py-2 ${view === "patient" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              <User className="mr-2 inline h-4 w-4" />
              Patient app
            </button>
            <button
              onClick={() => setShowJatPanel(true)}
              className="rounded-full bg-slate-100 px-4 py-2 text-slate-700"
            >
              <Settings className="mr-2 inline h-4 w-4" />
              JAT controls
            </button>
          </nav>
        </div>

        <div className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-5 py-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <ClipboardList className="h-3.5 w-3.5" />
                <strong>Condition:</strong> {JAT_CONDITIONS[jatCondition].label}
              </span>
              <span>
                <strong>Visible patients:</strong> {visiblePatients.length} / {patients.length}
              </span>
              <span>
                <strong>Live Gemini results:</strong> {liveCount}
              </span>
              {showGroundTruth && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                  Ground-truth overlay on
                </span>
              )}
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1">
              Decision support only. Final judgment remains with the human care team.
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-5">
        <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Research status</div>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">{statusNote}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {view !== "patient" && (
                <button
                  onClick={() => void refreshVisiblePatients()}
                  disabled={refreshingVisible}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <RefreshCw className={`mr-2 inline h-4 w-4 ${refreshingVisible ? "animate-spin" : ""}`} />
                  Refresh visible with Gemini
                </button>
              )}
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-600">
                Synthetic data only. Not for clinical deployment.
              </span>
            </div>
          </div>
        </div>

        {view === "dashboard" && (
          <>
            {selectedPatient && (
              <PopulationDashboard
                patients={visiblePatients}
                allVisiblePatients={visiblePatients}
                jatCondition={jatCondition}
                showGroundTruth={showGroundTruth}
                onSelect={(patient) => {
                  setSelectedId(patient.id);
                  setView("detail");
                }}
              />
            )}
          </>
        )}

        {view === "detail" && selectedPatient && (
          <PatientDetail
            patient={selectedPatient}
            jatCondition={jatCondition}
            showGroundTruth={showGroundTruth}
            onBack={() => setView("dashboard")}
            onAction={recordAction}
            onRefresh={() => void refreshPatient(selectedPatient.id)}
          />
        )}

        {view === "patient" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-600">Simulate patient:</span>
              <select
                value={patientViewId}
                onChange={(event) => setPatientViewId(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                {patients.slice(0, 20).map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
            </div>
            <PatientFacingView
              patient={patientForView}
              onSubmitCheckin={handleCheckinSubmit}
              onHelpRequest={handleHelpRequest}
            />
          </div>
        )}
      </main>

      {showJatPanel && (
        <JatPanel
          actionLog={actionLog}
          jatCondition={jatCondition}
          onClose={() => setShowJatPanel(false)}
          patientLoad={patientLoad}
          patients={visiblePatients}
          setJatCondition={setJatCondition}
          setPatientLoad={setPatientLoad}
          setShowGroundTruth={setShowGroundTruth}
          showGroundTruth={showGroundTruth}
        />
      )}
    </div>
  );
}

function PopulationDashboard({
  patients,
  allVisiblePatients,
  jatCondition,
  onSelect,
  showGroundTruth,
}) {
  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState("all");
  const [sortBy, setSortBy] = useState("risk");
  const [missingOnly, setMissingOnly] = useState(false);
  const [noResponseOnly, setNoResponseOnly] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const filteredPatients = useMemo(() => {
    let next = [...patients];

    if (deferredSearch.trim()) {
      const query = deferredSearch.trim().toLowerCase();
      next = next.filter(
        (patient) =>
          patient.name.toLowerCase().includes(query) ||
          patient.id.toLowerCase().includes(query),
      );
    }

    if (filterRisk !== "all") {
      next = next.filter((patient) => patient.ai.riskLevel === filterRisk);
    }

    if (missingOnly) {
      next = next.filter(
        (patient) => patient.dataQuality !== "high" || patient.ai.missingInfo.length > 0,
      );
    }

    if (noResponseOnly) {
      next = next.filter((patient) => patient.patientResponse !== "responsive");
    }

    if (jatCondition === "NONE") {
      return next.sort((a, b) => a.id.localeCompare(b.id));
    }

    const sorters = {
      risk: (a, b) =>
        RISK_ORDER[a.ai.riskLevel] - RISK_ORDER[b.ai.riskLevel] ||
        b.ai.score - a.ai.score,
      name: (a, b) => a.name.localeCompare(b.name),
      confidence: (a, b) => {
        const order = { low: 0, moderate: 1, high: 2 };
        return order[a.ai.confidence] - order[b.ai.confidence];
      },
      source: (a, b) => a.aiMeta.source.localeCompare(b.aiMeta.source),
    };

    return next.sort(sorters[sortBy] ?? sorters.risk);
  }, [deferredSearch, filterRisk, jatCondition, missingOnly, noResponseOnly, patients, sortBy]);

  const stats = useMemo(
    () => ({
      total: allVisiblePatients.length,
      urgent: allVisiblePatients.filter((patient) => patient.ai.riskLevel === "Urgent Review").length,
      elevated: allVisiblePatients.filter((patient) => patient.ai.riskLevel === "Elevated").length,
      watch: allVisiblePatients.filter((patient) => patient.ai.riskLevel === "Watch").length,
      stable: allVisiblePatients.filter((patient) => patient.ai.riskLevel === "Stable").length,
      lowData: allVisiblePatients.filter((patient) => patient.dataQuality === "low").length,
      live: allVisiblePatients.filter((patient) => patient.aiMeta.source === "gemini").length,
      noResponse: allVisiblePatients.filter((patient) => patient.patientResponse === "no-response").length,
    }),
    [allVisiblePatients],
  );

  const challengeMetrics = buildChallengeMetrics(allVisiblePatients);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard label="Visible patients" value={stats.total} tone="slate" />
        <StatCard label="Urgent review" value={stats.urgent} tone="red" />
        <StatCard label="Elevated" value={stats.elevated} tone="orange" />
        <StatCard label="Watch" value={stats.watch} tone="amber" />
        <StatCard label="Stable" value={stats.stable} tone="emerald" />
        <StatCard label="Low data quality" value={stats.lowData} tone="orange" />
        <StatCard label="No response" value={stats.noResponse} tone="red" />
        <StatCard label="Gemini results" value={stats.live} tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none ring-0 focus:border-slate-400"
                placeholder="Search by patient name or ID"
              />
            </div>
            {jatCondition !== "NONE" && (
              <>
                <select
                  value={filterRisk}
                  onChange={(event) => setFilterRisk(event.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">All risks</option>
                  <option value="Urgent Review">Urgent Review</option>
                  <option value="Elevated">Elevated</option>
                  <option value="Watch">Watch</option>
                  <option value="Stable">Stable</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="risk">Sort by risk</option>
                  <option value="name">Sort by name</option>
                  <option value="confidence">Sort by confidence</option>
                  <option value="source">Sort by source</option>
                </select>
              </>
            )}
            <ToggleChip
              active={missingOnly}
              label="Missing data"
              onClick={() => setMissingOnly((value) => !value)}
            />
            <ToggleChip
              active={noResponseOnly}
              label="No response"
              onClick={() => setNoResponseOnly((value) => !value)}
            />
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <div className="grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <div className="col-span-3">Patient</div>
              {jatCondition === "NONE" ? (
                <>
                  <div className="col-span-2">Sleep</div>
                  <div className="col-span-2">Activity</div>
                  <div className="col-span-2">Self-report</div>
                  <div className="col-span-2">Medication</div>
                  <div className="col-span-1">Updated</div>
                </>
              ) : (
                <>
                  <div className="col-span-2">Risk</div>
                  <div className="col-span-3">{jatCondition === "FULL" ? "Factors" : "Summary"}</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Recommended action</div>
                </>
              )}
            </div>

            <div className="max-h-[64vh] divide-y divide-slate-100 overflow-y-auto">
              {filteredPatients.map((patient) => (
                <PatientRow
                  key={patient.id}
                  jatCondition={jatCondition}
                  onSelect={onSelect}
                  patient={patient}
                  showGroundTruth={showGroundTruth}
                />
              ))}
              {filteredPatients.length === 0 && (
                <div className="px-4 py-16 text-center text-sm text-slate-500">
                  No patients match the current filters.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                JAT challenge metrics
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetricCard
                label="Data overload"
                value={challengeMetrics.dataOverload}
                detail="Patients simultaneously visible to the operator."
              />
              <MetricCard
                label="Misleading indicators"
                value={challengeMetrics.misleadingIndicators}
                detail="AI output differs from hidden ground truth."
              />
              <MetricCard
                label="Ambiguous cues"
                value={challengeMetrics.ambiguousCues}
                detail="Low confidence or mixed/unknown patterns."
              />
              <MetricCard
                label="Incomplete advice"
                value={challengeMetrics.incompleteAdvice}
                detail="Uncertainty or missing-information flags present."
              />
              <MetricCard
                label="False priming cases"
                value={challengeMetrics.falsePriming}
                detail="Confounders that can bias human attention."
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Prototype design notes
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>AI recommendations are decision support only and are intentionally observable and overridable.</li>
              <li>Human rationale, urgency ratings, and chosen actions are logged for later JAT analysis.</li>
              <li>Ground truth is hidden during normal use and only available as a research overlay.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function PatientRow({ patient, onSelect, jatCondition, showGroundTruth }) {
  const mismatch =
    showGroundTruth &&
    (patient.ai.riskLevel !== patient.groundTruth.level ||
      patient.ai.recommendedAction !== patient.groundTruth.action);
  const ActionIcon = ACTION_ICONS[patient.ai.recommendedAction] ?? Bell;

  return (
    <button
      onClick={() => onSelect(patient)}
      className={`grid w-full grid-cols-12 gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${
        mismatch ? "bg-amber-50/70" : ""
      }`}
    >
      <div className="col-span-3 min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {patient.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900">{patient.name}</div>
            <div className="text-xs text-slate-500">
              {patient.id} | {patient.age}y
            </div>
          </div>
        </div>
      </div>

      {jatCondition === "NONE" ? (
        <>
          <div className="col-span-2 text-slate-700">
            {formatSignalValue(patient.sleep.avg, "h")}
            <div className="text-xs text-slate-500">base {patient.sleep.baseline ?? "?"}h</div>
          </div>
          <div className="col-span-2 text-slate-700">
            {patient.activity.avg != null ? patient.activity.avg.toLocaleString() : "No data"}
            <div className="text-xs text-slate-500">
              base {patient.activity.baseline != null ? patient.activity.baseline.toLocaleString() : "?"}
            </div>
          </div>
          <div className="col-span-2 text-slate-700">
            {patient.selfReport.mood != null ? `Mood ${patient.selfReport.mood}/10` : "No self-report"}
          </div>
          <div className="col-span-2 text-slate-700">
            {patient.medication.adherence != null
              ? `${Math.round(patient.medication.adherence * 100)}% adherence`
              : "Adherence unknown"}
          </div>
          <div className="col-span-1 text-xs text-slate-500">{patient.selfReport.lastUpdate}</div>
        </>
      ) : (
        <>
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <RiskBadge level={patient.ai.riskLevel} />
              {mismatch && <Flag className="h-3.5 w-3.5 text-amber-600" />}
            </div>
            <div className="mt-1">
              <UrgencyScale label="AI" value={aiUrgencyScore(patient.ai)} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <TrendGlyph trend={patient.ai.trend} />
              <span className="capitalize">{patient.ai.trend.replaceAll("-", " ")}</span>
            </div>
          </div>

          <div className="col-span-3">
            {jatCondition === "FULL" ? (
              <ul className="space-y-1 text-xs text-slate-600">
                {patient.ai.topFactors.slice(0, 2).map((factor) => (
                  <li key={factor} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-slate-600">{patient.ai.summary}</div>
            )}
          </div>

          <div className="col-span-2 space-y-1">
            {jatCondition === "FULL" && <DataQualityPill quality={patient.dataQuality} />}
            <ResponsePill status={patient.patientResponse} />
            <div className="text-[11px] text-slate-500">
              {patient.aiMeta.pending
                ? "Refreshing..."
                : `${patient.aiMeta.source} @ ${formatUpdatedAt(patient.aiMeta.updatedAt)}`}
            </div>
          </div>

          <div className="col-span-2">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <ActionIcon className="h-4 w-4" />
              <span>{ACTION_LABELS[patient.ai.recommendedAction]}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {patient.ai.needsHumanReview ? "Human review flagged" : "Routine monitoring"}
            </div>
          </div>
        </>
      )}
    </button>
  );
}

function PatientDetail({
  patient,
  jatCondition,
  onAction,
  onBack,
  onRefresh,
  showGroundTruth,
}) {
  const [showCoordination, setShowCoordination] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const ActionIcon = ACTION_ICONS[patient.ai.recommendedAction] ?? Bell;
  const riskStyle = RISK_STYLES[patient.ai.riskLevel];

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to dashboard
      </button>

      <section className={`rounded-3xl border bg-white p-5 shadow-sm ${riskStyle.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600">
              {patient.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <div className="text-2xl font-semibold">{patient.name}</div>
              <div className="mt-1 text-sm text-slate-500">
                {patient.id} | Age {patient.age} | {patient.baseline}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {jatCondition !== "NONE" && <RiskBadge level={patient.ai.riskLevel} large />}
                <SourceBadge meta={patient.aiMeta} />
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  Last self-report {patient.selfReport.lastUpdate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRefresh}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
            >
              <RefreshCw className={`mr-2 inline h-4 w-4 ${patient.aiMeta.pending ? "animate-spin" : ""}`} />
              Refresh recommendation
            </button>
            <button
              onClick={() => setShowCoordination(true)}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Open coordination panel
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="space-y-5">
          {jatCondition !== "NONE" && (
            <section className={`rounded-3xl border p-5 shadow-sm ${riskStyle.border} ${riskStyle.card}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${riskStyle.accent} text-white`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        AI recommendation
                      </div>
                      <div className="text-xl font-semibold text-slate-900">
                        {ACTION_LABELS[patient.ai.recommendedAction]}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 max-w-3xl text-sm text-slate-700">{patient.ai.summary}</p>
                </div>
                <div className="space-y-2">
                  <UrgencyScale label="AI urgency" large value={aiUrgencyScore(patient.ai)} />
                  <div className="text-xs text-slate-500">
                    Confidence: <strong className="capitalize">{patient.ai.confidence}</strong>
                  </div>
                </div>
              </div>

              {jatCondition === "FULL" && (
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <InfoCard title="Top factors" tone={patient.ai.riskLevel}>
                    <ul className="space-y-2 text-sm text-slate-700">
                      {patient.ai.topFactors.map((factor) => (
                        <li key={factor} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-500" />
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </InfoCard>
                  <InfoCard title="Uncertainty" tone={patient.ai.riskLevel}>
                    {patient.ai.uncertainty.length > 0 ? (
                      <ul className="space-y-2 text-sm text-slate-700">
                        {patient.ai.uncertainty.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-slate-600">No major caveats flagged in this pass.</div>
                    )}
                  </InfoCard>
                  <InfoCard title="Human review triggers" tone={patient.ai.riskLevel}>
                    {patient.ai.needsHumanReview ? (
                      <ul className="space-y-2 text-sm text-slate-700">
                        {patient.ai.humanReviewReasons.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-slate-600">No special human-review trigger was raised in this pass.</div>
                    )}
                  </InfoCard>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    onAction(
                      "confirm-ai",
                      patient,
                      "Confirmed the current AI recommendation.",
                      aiUrgencyScore(patient.ai),
                      patient.ai.recommendedAction,
                    )
                  }
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  <Check className="mr-2 inline h-4 w-4" />
                  Confirm AI recommendation
                </button>
                <button
                  onClick={() => setShowOverride(true)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
                >
                  Override / rate my own urgency
                </button>
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recent trends
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SignalCard
                icon={Moon}
                label="Sleep"
                value={formatSignalValue(patient.sleep.avg, "h")}
                baseline={`Baseline ${patient.sleep.baseline ?? "?"}h`}
                detail={`${patient.sleep.days} days of data | regularity ${patient.sleep.regularity}`}
                trend={patient.sleep.trend}
              />
              <SignalCard
                icon={Activity}
                label="Activity"
                value={patient.activity.avg != null ? `${patient.activity.avg.toLocaleString()} steps` : "No data"}
                baseline={`Baseline ${patient.activity.baseline != null ? patient.activity.baseline.toLocaleString() : "?"}`}
                detail={`${patient.activity.days} days of data`}
                trend={patient.activity.trend}
              />
              <SignalCard
                icon={Heart}
                label="HRV"
                value={patient.hrv.avg != null ? `${patient.hrv.avg} ms` : "No data"}
                baseline={`Baseline ${patient.hrv.baseline ?? "?"} ms`}
                detail={`${patient.hrv.days} days of data`}
                trend={patient.hrv.trend}
              />
              <SignalCard
                icon={Smartphone}
                label="Phone behavior"
                value={patient.phone.avg != null ? `${patient.phone.avg} hr/day` : "No data"}
                baseline={`Baseline ${patient.phone.baseline ?? "?"} hr/day`}
                detail={`${patient.phone.days} days | night use ${patient.phone.nightUse}`}
                trend={patient.phone.trend}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-500" />
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Most recent self-report
              </div>
            </div>
            {patient.selfReport.mood == null ? (
              <div className="text-sm text-slate-600">
                No self-report data is currently available. Last update: {patient.selfReport.lastUpdate}.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <SelfReportBar label="Mood" value={patient.selfReport.mood} />
                  <SelfReportBar label="Energy" value={patient.selfReport.energy} />
                  <SelfReportBar label="Irritability" value={patient.selfReport.irritability} />
                  <SelfReportBar label="Impulsivity" value={patient.selfReport.impulsivity} />
                  <SelfReportBar label="Hopelessness" value={patient.selfReport.hopelessness} invert />
                  <SelfReportBar label="Anxiety" value={patient.selfReport.anxiety} invert />
                </div>
                {patient.selfReport.note && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="mb-1 font-medium text-slate-900">Patient note</div>
                    "{patient.selfReport.note}"
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-500">
                  Last updated {patient.selfReport.lastUpdate}. Missed check-ins in window: {patient.selfReport.missed}.
                </div>
              </>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Medication and context
            </div>
            <div className="space-y-3 text-sm">
              <KeyValue label="Regimen" value={patient.medication.regimen} />
              <KeyValue
                label="Adherence"
                value={
                  patient.medication.adherence != null
                    ? `${Math.round(patient.medication.adherence * 100)}% in window`
                    : "Unknown"
                }
              />
              <KeyValue label="Last missed dose" value={patient.medication.lastMissed} />
              <KeyValue label="Episode history" value={`${patient.history.episodes} episodes`} />
              <KeyValue label="Last episode" value={patient.history.lastEpisode} />
              <KeyValue label="Predominant type" value={patient.history.type} />
              <KeyValue label="Coordinator" value={patient.coordinator} />
              <KeyValue label="Escalation" value={patient.escalation} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recent communications
            </div>
            <div className="space-y-3">
              {patient.communications.map((item, index) => (
                <div key={`${item.date}-${index}`} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">{item.type}</div>
                    <div className="text-xs text-slate-500">{item.date}</div>
                  </div>
                  <div className="mt-1 text-xs capitalize text-slate-500">{item.status}</div>
                  {item.note && <div className="mt-2 text-sm text-slate-600">{item.note}</div>}
                </div>
              ))}
            </div>
          </section>

          {jatCondition === "FULL" && patient.ai.missingInfo.length > 0 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Missing information
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                {patient.ai.missingInfo.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showGroundTruth && (
            <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
              <div className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
                Research overlay
              </div>
              <div className="space-y-2 text-sm text-amber-900">
                <div>
                  Hidden truth level: <strong>{patient.groundTruth.level}</strong>
                </div>
                <div>
                  Hidden truth action: <strong>{ACTION_LABELS[patient.groundTruth.action]}</strong>
                </div>
                <div>
                  AI vs truth urgency delta: <strong>{Math.abs(aiUrgencyScore(patient.ai) - groundTruthUrgency(patient.groundTruth))}</strong>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {showCoordination && (
        <CoordinationPanel
          patient={patient}
          onClose={() => setShowCoordination(false)}
          onSubmit={(selectedAction, urgency, rationale) => {
            onAction("coordination", patient, rationale, urgency, selectedAction);
            setShowCoordination(false);
          }}
        />
      )}

      {showOverride && (
        <OverrideDialog
          patient={patient}
          onClose={() => setShowOverride(false)}
          onSubmit={(selectedAction, urgency, rationale) => {
            onAction("override", patient, rationale, urgency, selectedAction);
            setShowOverride(false);
          }}
        />
      )}
    </div>
  );
}

function PatientFacingView({ onHelpRequest, onSubmitCheckin, patient }) {
  const [step, setStep] = useState("home");
  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [safety, setSafety] = useState(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_#e0f2fe,_#ffffff_55%,_#f8fafc)] p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Patient-facing touchpoint</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">Daily wellness check-in</div>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            This side of the prototype keeps the patient in the joint activity loop. The check-in updates the monitoring display and can trigger a fresh AI assessment.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">{patient.name}</div>
            <div className="text-xs text-slate-500">
              {patient.id} | Last check-in {patient.selfReport.lastUpdate}
            </div>
          </div>
          <SourceBadge meta={patient.aiMeta} />
        </div>

        {!submitted && step === "home" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setStep("checkin")}
              className="rounded-3xl bg-slate-900 px-5 py-4 text-left text-white"
            >
              <div className="text-sm font-semibold">Start daily check-in</div>
              <div className="mt-1 text-xs text-slate-200">
                Share mood, energy, and any concerns so your care team can monitor trends.
              </div>
            </button>
            <button
              onClick={() => setStep("help")}
              className="rounded-3xl border border-slate-300 bg-white px-5 py-4 text-left"
            >
              <div className="text-sm font-semibold text-slate-900">I need help right now</div>
              <div className="mt-1 text-xs text-slate-500">
                Request a call from the coordinator or view urgent support language.
              </div>
            </button>
          </div>
        )}

        {!submitted && step === "checkin" && (
          <div className="mt-5 space-y-5">
            <RangeQuestion
              label="How is your mood today?"
              helper="1 means very low. 10 means very high or activated."
              maxLabel="Very high"
              minLabel="Very low"
              value={mood}
              onChange={setMood}
            />
            <RangeQuestion
              label="How is your energy today?"
              helper="This helps the team detect both activation and depressive slowing."
              maxLabel="Very high"
              minLabel="Drained"
              value={energy}
              onChange={setEnergy}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Are you having thoughts of harming yourself or not wanting to be here?
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setSafety("no")}
                  className={`rounded-2xl border px-4 py-3 text-sm ${safety === "no" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  No
                </button>
                <button
                  onClick={() => setSafety("yes")}
                  className={`rounded-2xl border px-4 py-3 text-sm ${safety === "yes" ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  Yes / some
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Anything else you want the care team to know?
              </label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                rows={4}
                placeholder="Optional free-text note"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await onSubmitCheckin(patient.id, { mood, energy, note, safety });
                  setSubmitted(true);
                }}
                disabled={!safety}
                className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Submit check-in
              </button>
              <button
                onClick={() => setStep("home")}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {!submitted && step === "help" && (
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              This prototype routes urgent concerns to a human coordinator. It does not replace emergency services.
            </div>
            <button
              onClick={() => onHelpRequest(patient.id)}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
            >
              Request a coordinator callback
            </button>
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
              If this were a real system and you were in immediate danger, you would be directed to 988 or local emergency care.
            </div>
            <button
              onClick={() => setStep("home")}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
            >
              Back
            </button>
          </div>
        )}

        {submitted && (
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                Check-in submitted
              </div>
              <div className="mt-2">
                The care-team dashboard has been updated and a fresh recommendation request was triggered.
              </div>
            </div>
            <button
              onClick={() => {
                setSubmitted(false);
                setStep("home");
                setMood(5);
                setEnergy(5);
                setSafety(null);
                setNote("");
              }}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
            >
              Submit another check-in
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            How the patient app supports JAT
          </div>
          <ul className="space-y-3 text-sm text-slate-600">
            <li>The patient can push new information into the system rather than only being monitored passively.</li>
            <li>Submitted check-ins create new observable events for the care coordinator and the AI teammate.</li>
            <li>Urgent help requests support two-way coordination instead of one-way alerting.</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Current patient snapshot
          </div>
          <div className="space-y-3 text-sm">
            <KeyValue label="Latest AI level" value={patient.ai.riskLevel} />
            <KeyValue label="Recommended action" value={ACTION_LABELS[patient.ai.recommendedAction]} />
            <KeyValue label="Confidence" value={patient.ai.confidence} />
            <KeyValue label="Latest source" value={`${patient.aiMeta.source} @ ${formatUpdatedAt(patient.aiMeta.updatedAt)}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function JatPanel({
  actionLog,
  jatCondition,
  onClose,
  patientLoad,
  patients,
  setJatCondition,
  setPatientLoad,
  setShowGroundTruth,
  showGroundTruth,
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">JAT experimental controls</div>
            <div className="text-xs text-slate-500">Tune challenge conditions without changing the patient cases.</div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <section>
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              AI support condition
            </div>
            <div className="space-y-3">
              {Object.values(JAT_CONDITIONS).map((condition) => (
                <button
                  key={condition.id}
                  onClick={() => setJatCondition(condition.id)}
                  className={`w-full rounded-3xl border p-4 text-left ${
                    jatCondition === condition.id
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="font-medium text-slate-900">{condition.label}</div>
                  <div className="mt-1 text-sm text-slate-600">{condition.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Patient load
            </div>
            <input
              type="range"
              min="14"
              max="60"
              value={patientLoad}
              onChange={(event) => setPatientLoad(Number(event.target.value))}
              className="w-full"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>14</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                {patientLoad} visible patients
              </span>
              <span>60</span>
            </div>
          </section>

          <section>
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Research overlays
            </div>
            <button
              onClick={() => setShowGroundTruth(!showGroundTruth)}
              className={`flex w-full items-center justify-between rounded-3xl border p-4 ${
                showGroundTruth ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="text-left">
                <div className="font-medium text-slate-900">Ground-truth overlay</div>
                <div className="mt-1 text-sm text-slate-600">
                  Highlights mismatches between AI output and hidden outcome labels.
                </div>
              </div>
              {showGroundTruth ? <Eye className="h-5 w-5 text-amber-700" /> : <EyeOff className="h-5 w-5 text-slate-500" />}
            </button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Visible challenge summary
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="Low-confidence cases"
                value={patients.filter((patient) => patient.ai.confidence === "low").length}
                detail="Potentially harder calibration cases."
              />
              <MetricCard
                label="Human-review flags"
                value={patients.filter((patient) => patient.ai.needsHumanReview).length}
                detail="Cases where the AI explicitly asks for human judgment."
              />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Action log ({actionLog.length})
              </div>
              {actionLog.length > 0 && (
                <button
                  onClick={() => downloadActionLog(actionLog)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                >
                  <Download className="mr-2 inline h-4 w-4" />
                  Export CSV
                </button>
              )}
            </div>
            {actionLog.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No human actions have been logged yet. Open a patient and confirm, override, or submit a coordination decision.
              </div>
            ) : (
              <div className="space-y-3">
                {[...actionLog].reverse().map((entry, index) => (
                  <div key={`${entry.timestamp}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">
                          {entry.patientName} | {entry.actionType}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        {entry.chosenAction ? ACTION_LABELS[entry.chosenAction] ?? entry.chosenAction : "No action chosen"}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                      <span>Clinician urgency {entry.clinicianUrgency ?? "-"}/10</span>
                      <span>AI urgency {entry.aiUrgency}/10</span>
                      <span>Truth urgency {entry.groundTruthUrgency}/10</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {entry.rationale?.trim() ? entry.rationale : "No rationale entered."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function CoordinationPanel({ onClose, onSubmit, patient }) {
  const [selectedAction, setSelectedAction] = useState(patient.ai.recommendedAction);
  const [urgency, setUrgency] = useState(aiUrgencyScore(patient.ai));
  const [rationale, setRationale] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="font-semibold text-slate-900">Coordination panel</div>
            <div className="text-xs text-slate-500">
              {patient.name} | {patient.id}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Choose the operational response you would take. This action and your rationale are logged for joint activity analysis.
          </div>

          <ActionSelector selectedAction={selectedAction} setSelectedAction={setSelectedAction} />

          <UrgencyEditor urgency={urgency} setUrgency={setUrgency} label="Your urgency rating" />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Rationale</label>
            <textarea
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              className="w-full rounded-3xl border border-slate-300 px-4 py-3 text-sm"
              rows={5}
              placeholder="Why does this action make sense based on the available evidence?"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onSubmit(selectedAction, urgency, rationale)}
              disabled={!rationale.trim()}
              className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Submit action
            </button>
            <button
              onClick={onClose}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverrideDialog({ onClose, onSubmit, patient }) {
  const [selectedAction, setSelectedAction] = useState(patient.ai.recommendedAction);
  const [urgency, setUrgency] = useState(aiUrgencyScore(patient.ai));
  const [rationale, setRationale] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="font-semibold text-slate-900">Override AI assessment</div>
            <div className="text-xs text-slate-500">
              {patient.name} | AI currently recommends {ACTION_LABELS[patient.ai.recommendedAction]}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Override is a deliberate research feature. It captures disagreement, alternative actions, and workload effects for later JAT analysis.
          </div>

          <ActionSelector selectedAction={selectedAction} setSelectedAction={setSelectedAction} />
          <UrgencyEditor urgency={urgency} setUrgency={setUrgency} label="Your urgency rating" />

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Why are you overriding the AI? <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              className="w-full rounded-3xl border border-slate-300 px-4 py-3 text-sm"
              rows={5}
              placeholder="Optional: explain the cues, caveats, or context the AI underweighted."
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => onSubmit(selectedAction, urgency, rationale.trim())}
              className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Submit override
            </button>
            <button
              onClick={onClose}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionSelector({ selectedAction, setSelectedAction }) {
  return (
    <div className="grid gap-2">
      {Object.keys(ACTION_LABELS).map((action) => {
        const Icon = ACTION_ICONS[action] ?? Bell;
        return (
          <button
            key={action}
            onClick={() => setSelectedAction(action)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
              selectedAction === action ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
            }`}
          >
            <Icon className="h-4 w-4 text-slate-600" />
            <span className="text-sm text-slate-800">{ACTION_LABELS[action]}</span>
          </button>
        );
      })}
    </div>
  );
}

function UrgencyEditor({ label, setUrgency, urgency }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className={`text-sm font-semibold ${urgencyColorText(urgency)}`}>{urgency}/10</span>
      </div>
      <input
        type="range"
        min="1"
        max="10"
        value={urgency}
        onChange={(event) => setUrgency(Number(event.target.value))}
        className="w-full"
      />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index + 1}>{index + 1}</span>
        ))}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${urgencyColorFill(urgency)}`}
          style={{ width: `${urgency * 10}%` }}
        />
      </div>
    </div>
  );
}

function RangeQuestion({ helper, label, maxLabel, minLabel, onChange, value }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-4 w-full"
      />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{minLabel}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{value}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function SignalCard({ baseline, detail, icon, label, trend, value }) {
  const IconComponent = icon;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <IconComponent className="h-4 w-4" />
          {label}
        </div>
        <TrendGlyph trend={trend} />
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{baseline}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
      <div className="mt-4">
        <MiniSparkline trend={trend} />
      </div>
    </div>
  );
}

function SelfReportBar({ invert = false, label, value }) {
  const width = `${Math.max(0, Math.min(100, (value / 10) * 100))}%`;
  const color = invert
    ? value >= 7
      ? "bg-red-500"
      : value >= 4
        ? "bg-amber-500"
        : "bg-emerald-500"
    : value >= 8 || value <= 2
      ? "bg-orange-500"
      : value >= 7 || value <= 3
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs text-slate-500">{value}/10</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width }} />
      </div>
    </div>
  );
}

function StatCard({ label, tone, value }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-700",
    red: "border-red-200 bg-white text-red-700",
    orange: "border-orange-200 bg-white text-orange-700",
    amber: "border-amber-200 bg-white text-amber-700",
    emerald: "border-emerald-200 bg-white text-emerald-700",
  };
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function MetricCard({ detail, label, value }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function InfoCard({ children, title, tone }) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white/80 p-4 ${RISK_STYLES[tone].border}`}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function ToggleChip({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-sm ${
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function RiskBadge({ large = false, level }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        RISK_STYLES[level].badge
      } ${large ? "text-sm" : ""}`}
    >
      {level}
    </span>
  );
}

function DataQualityPill({ quality }) {
  const styles = {
    high: "bg-emerald-50 text-emerald-700 border-emerald-200",
    moderate: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium capitalize ${styles[quality]}`}>
      Data quality: {quality}
    </span>
  );
}

function ResponsePill({ status }) {
  const styles = {
    responsive: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-amber-50 text-amber-700 border-amber-200",
    "no-response": "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium capitalize ${styles[status]}`}>
      {status.replaceAll("-", " ")}
    </span>
  );
}

function SourceBadge({ meta }) {
  const live = meta.source === "gemini";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
        live
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {meta.pending ? "Refreshing..." : live ? "Gemini live" : "Fallback heuristic"}
    </span>
  );
}

function UrgencyScale({ label, large = false, value }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</span>}
      <div className={`font-semibold ${large ? "text-lg" : "text-sm"} ${urgencyColorText(value)}`}>{value}/10</div>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${urgencyColorFill(value)}`} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

function KeyValue({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-900">{value}</span>
    </div>
  );
}

function TrendGlyph({ trend }) {
  if (["worsening", "mild-worsening", "increasing"].includes(trend)) {
    return <TrendingUp className="h-4 w-4 text-orange-600" />;
  }
  if (["improving", "decreasing"].includes(trend)) {
    return <TrendingDown className="h-4 w-4 text-emerald-600" />;
  }
  return <Minus className="h-4 w-4 text-slate-400" />;
}

function MiniSparkline({ trend }) {
  const shapes = {
    worsening: [2, 3, 4, 5, 6, 7, 8],
    "mild-worsening": [4, 4, 5, 5, 6, 6, 7],
    improving: [8, 7, 6, 5, 4, 4, 3],
    increasing: [3, 4, 5, 6, 7, 8, 8],
    decreasing: [8, 7, 6, 5, 4, 3, 3],
    stable: [5, 5, 5, 5, 5, 5, 5],
    unknown: [5, 5, 4, 5, 6, 5, 5],
    variable: [4, 7, 3, 6, 4, 7, 5],
    "mixed-signals": [5, 6, 4, 6, 5, 7, 5],
    "slight-increase": [4, 4, 5, 5, 5, 6, 6],
    "slight-decrease": [6, 6, 5, 5, 5, 4, 4],
  };
  const points = shapes[trend] ?? shapes.stable;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const polyline = points
    .map((point, index) => `${index * 12},${20 - ((point - min) / range) * 16}`)
    .join(" ");
  const color =
    trend === "worsening" || trend === "mild-worsening" || trend === "increasing"
      ? "#ea580c"
      : trend === "improving" || trend === "decreasing"
        ? "#059669"
        : "#64748b";

  return (
    <svg width="84" height="22" aria-hidden>
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function urgencyColorFill(value) {
  if (value >= 8) return "bg-red-600";
  if (value >= 5) return "bg-amber-500";
  return "bg-emerald-500";
}

function urgencyColorText(value) {
  if (value >= 8) return "text-red-700";
  if (value >= 5) return "text-amber-700";
  return "text-emerald-700";
}

function formatSignalValue(value, unit) {
  return value != null ? `${value}${unit}` : "No data";
}

function downloadActionLog(actionLog) {
  const headers = [
    "timestamp",
    "jat_condition",
    "patient_load",
    "patient_id",
    "patient_name",
    "action_type",
    "chosen_action",
    "rationale",
    "clinician_urgency",
    "ai_urgency",
    "truth_urgency",
    "ai_level",
    "ai_action",
    "truth_level",
    "truth_action",
    "ai_source",
    "ai_model",
  ];

  const rows = actionLog.map((entry) =>
    [
      entry.timestamp,
      entry.jatCondition,
      entry.patientLoad,
      entry.patientId,
      entry.patientName,
      entry.actionType,
      entry.chosenAction ?? "",
      entry.rationale,
      entry.clinicianUrgency ?? "",
      entry.aiUrgency,
      entry.groundTruthUrgency,
      entry.aiLevel,
      entry.aiAction,
      entry.truthLevel,
      entry.truthAction,
      entry.aiSource,
      entry.aiModel,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );

  const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `moodwatch-jat-log-${new Date().toISOString().replaceAll(":", "-")}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default App;
