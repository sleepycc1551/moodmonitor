const seedPatients = [
  {
    id: "P-0142",
    name: "Alex Rivera",
    age: 34,
    baseline: "Euthymic with prior manic relapses",
    sleep: { avg: 4.2, baseline: 7.5, trend: "decreasing", days: 6, regularity: "low" },
    activity: { avg: 14200, baseline: 6500, trend: "increasing", days: 7 },
    hrv: { avg: 32, baseline: 45, trend: "decreasing", days: 5 },
    phone: { avg: 9.2, baseline: 4.5, nightUse: "high", trend: "increasing", days: 7 },
    selfReport: {
      mood: 8,
      irritability: 7,
      energy: 9,
      impulsivity: 6,
      hopelessness: 2,
      anxiety: 4,
      lastUpdate: "1 day ago",
      missed: 0,
      note: "Feeling great and barely sleeping.",
    },
    medication: { adherence: 0.67, lastMissed: "3 days ago", regimen: "Lithium + quetiapine" },
    history: { episodes: 3, lastEpisode: "Aug 2025", type: "manic" },
    dataQuality: "moderate",
    patientResponse: "responsive",
    coordinator: "Jordan K.",
    escalation: "watchlist",
    groundTruth: { level: "Elevated", action: "manual-outreach" },
    challengeTags: ["classic-manic-prodrome", "moderate-data-quality"],
    communications: [
      { date: "Apr 15", type: "Auto check-in", status: "responded", note: "Slept 4 hours but feels excellent." },
      { date: "Apr 18", type: "Auto check-in", status: "responded", note: "Irritability higher than usual." },
    ],
  },
  {
    id: "P-0087",
    name: "Maya Thompson",
    age: 28,
    baseline: "Bipolar II with depressive predominance",
    sleep: { avg: 11.3, baseline: 8.2, trend: "increasing", days: 7, regularity: "moderate" },
    activity: { avg: 1800, baseline: 5200, trend: "decreasing", days: 7 },
    hrv: { avg: 38, baseline: 42, trend: "stable", days: 7 },
    phone: { avg: 1.2, baseline: 3.8, nightUse: "low", trend: "decreasing", days: 7 },
    selfReport: {
      mood: 2,
      irritability: 3,
      energy: 1,
      impulsivity: 1,
      hopelessness: 8,
      anxiety: 6,
      lastUpdate: "6 hours ago",
      missed: 0,
      note: "Hard to get out of bed and feels numb.",
    },
    medication: { adherence: 0.95, lastMissed: "12 days ago", regimen: "Lamotrigine" },
    history: { episodes: 5, lastEpisode: "Nov 2025", type: "depressive" },
    dataQuality: "high",
    patientResponse: "responsive",
    coordinator: "Sam T.",
    escalation: "reviewing",
    groundTruth: { level: "Urgent Review", action: "clinician-review" },
    challengeTags: ["depressive-decompensation", "complete-data"],
    communications: [
      { date: "Apr 16", type: "Auto check-in", status: "responded", note: "Mood 3, hopelessness 6." },
      { date: "Apr 19", type: "Coordinator outreach", status: "scheduled", note: "Call scheduled for 4pm." },
    ],
  },
  {
    id: "P-0231",
    name: "Sam Chen",
    age: 41,
    baseline: "Euthymic and stable for 18 months",
    sleep: { avg: 7.8, baseline: 7.6, trend: "stable", days: 7, regularity: "high" },
    activity: { avg: 6800, baseline: 6500, trend: "stable", days: 7 },
    hrv: { avg: 46, baseline: 45, trend: "stable", days: 7 },
    phone: { avg: 3.1, baseline: 3.2, nightUse: "low", trend: "stable", days: 7 },
    selfReport: {
      mood: 6,
      irritability: 2,
      energy: 6,
      impulsivity: 2,
      hopelessness: 1,
      anxiety: 3,
      lastUpdate: "12 hours ago",
      missed: 0,
      note: "Everything feels normal.",
    },
    medication: { adherence: 1, lastMissed: "None in 90 days", regimen: "Lithium" },
    history: { episodes: 2, lastEpisode: "Oct 2024", type: "manic" },
    dataQuality: "high",
    patientResponse: "responsive",
    coordinator: "Jordan K.",
    escalation: "none",
    groundTruth: { level: "Stable", action: "no-action" },
    challengeTags: ["stable-baseline", "complete-data"],
    communications: [
      { date: "Apr 17", type: "Auto check-in", status: "responded", note: "All well." },
    ],
  },
  {
    id: "P-0309",
    name: "Jordan Blake",
    age: 22,
    baseline: "Recently diagnosed; baseline still forming",
    sleep: { avg: 6.5, baseline: 7.8, trend: "decreasing", days: 7, regularity: "moderate" },
    activity: { avg: 7200, baseline: 6000, trend: "increasing", days: 7 },
    hrv: { avg: 42, baseline: 48, trend: "decreasing", days: 6 },
    phone: { avg: 5.8, baseline: 4.2, nightUse: "moderate", trend: "increasing", days: 7 },
    selfReport: {
      mood: 7,
      irritability: 4,
      energy: 7,
      impulsivity: 4,
      hopelessness: 2,
      anxiety: 3,
      lastUpdate: "2 days ago",
      missed: 1,
      note: "Busy and sleeping a bit less than usual.",
    },
    medication: { adherence: 0.85, lastMissed: "1 day ago", regimen: "Valproate" },
    history: { episodes: 1, lastEpisode: "Oct 2025", type: "manic" },
    dataQuality: "high",
    patientResponse: "partial",
    coordinator: "Jordan K.",
    escalation: "watchlist",
    groundTruth: { level: "Watch", action: "auto-checkin" },
    challengeTags: ["early-warning", "limited-baseline"],
    communications: [
      { date: "Apr 14", type: "Auto check-in", status: "responded", note: "Mood 6, sleep 7 hours." },
      { date: "Apr 18", type: "Auto check-in", status: "missed", note: "" },
    ],
  },
  {
    id: "P-0456",
    name: "Priya Patel",
    age: 36,
    baseline: "Bipolar I, usually steady with routine monitoring",
    sleep: { avg: null, baseline: 7.4, trend: "unknown", days: 2, regularity: "unknown" },
    activity: { avg: null, baseline: 5800, trend: "unknown", days: 2 },
    hrv: { avg: null, baseline: 44, trend: "unknown", days: 1 },
    phone: { avg: null, baseline: 3.5, nightUse: "unknown", trend: "unknown", days: 2 },
    selfReport: {
      mood: null,
      irritability: null,
      energy: null,
      impulsivity: null,
      hopelessness: null,
      anxiety: null,
      lastUpdate: "8 days ago",
      missed: 3,
      note: "",
    },
    medication: { adherence: null, lastMissed: "Unknown", regimen: "Lithium + olanzapine" },
    history: { episodes: 4, lastEpisode: "Mar 2025", type: "mixed" },
    dataQuality: "low",
    patientResponse: "no-response",
    coordinator: "Sam T.",
    escalation: "watchlist",
    groundTruth: { level: "Watch", action: "manual-outreach" },
    challengeTags: ["missing-data", "non-responsive", "data-quality-challenge"],
    communications: [
      { date: "Apr 14", type: "Auto check-in", status: "missed", note: "" },
      { date: "Apr 19", type: "Auto check-in", status: "missed", note: "" },
    ],
  },
  {
    id: "P-0518",
    name: "Marcus Johnson",
    age: 52,
    baseline: "Bipolar I with mixed-features history",
    sleep: { avg: 3.8, baseline: 7, trend: "decreasing", days: 7, regularity: "low" },
    activity: { avg: 2200, baseline: 5500, trend: "decreasing", days: 7 },
    hrv: { avg: 28, baseline: 42, trend: "decreasing", days: 7 },
    phone: { avg: 8.4, baseline: 3.8, nightUse: "high", trend: "increasing", days: 7 },
    selfReport: {
      mood: 3,
      irritability: 9,
      energy: 7,
      impulsivity: 8,
      hopelessness: 7,
      anxiety: 8,
      lastUpdate: "4 hours ago",
      missed: 0,
      note: "Feels agitated, exhausted, and unable to slow down.",
    },
    medication: { adherence: 0.5, lastMissed: "Today", regimen: "Lithium + lamotrigine" },
    history: { episodes: 7, lastEpisode: "Jan 2026", type: "mixed" },
    dataQuality: "high",
    patientResponse: "responsive",
    coordinator: "Dr. Nakamura",
    escalation: "escalated",
    groundTruth: { level: "Urgent Review", action: "urgent-escalation" },
    challengeTags: ["mixed-episode", "adherence-drop", "high-severity"],
    communications: [
      { date: "Apr 18", type: "Coordinator call", status: "completed", note: "Declined same-day visit." },
      { date: "Apr 19", type: "Clinician review", status: "in-progress", note: "Psychiatrist reviewing now." },
    ],
  },
  {
    id: "P-0622",
    name: "Elena Rodriguez",
    age: 29,
    baseline: "Cyclothymic presentation, previously steady",
    sleep: { avg: 6.2, baseline: 7.5, trend: "decreasing", days: 5, regularity: "moderate" },
    activity: { avg: 5500, baseline: 5800, trend: "stable", days: 5 },
    hrv: { avg: 40, baseline: 44, trend: "stable", days: 5 },
    phone: { avg: 4.1, baseline: 4, nightUse: "low", trend: "stable", days: 5 },
    selfReport: {
      mood: null,
      irritability: null,
      energy: null,
      impulsivity: null,
      hopelessness: null,
      anxiety: null,
      lastUpdate: "5 days ago",
      missed: 2,
      note: "",
    },
    medication: { adherence: 0.75, lastMissed: "2 days ago", regimen: "Monitoring only" },
    history: { episodes: 0, lastEpisode: "None", type: "subsyndromal" },
    dataQuality: "moderate",
    patientResponse: "no-response",
    coordinator: "Unassigned",
    escalation: "none",
    groundTruth: { level: "Watch", action: "manual-outreach" },
    challengeTags: ["non-responsive", "ambiguous-signal"],
    communications: [
      { date: "Apr 16", type: "Auto check-in", status: "missed", note: "" },
      { date: "Apr 19", type: "Auto check-in", status: "missed", note: "" },
    ],
  },
  {
    id: "P-0704",
    name: "Kai Nakamura",
    age: 45,
    baseline: "Post-discharge recovery after February hospitalization",
    sleep: { avg: 7.2, baseline: 7, trend: "stable", days: 7, regularity: "high" },
    activity: { avg: 4800, baseline: 4500, trend: "increasing", days: 7 },
    hrv: { avg: 41, baseline: 38, trend: "increasing", days: 7 },
    phone: { avg: 3.4, baseline: 3.6, nightUse: "low", trend: "stable", days: 7 },
    selfReport: {
      mood: 6,
      irritability: 2,
      energy: 5,
      impulsivity: 2,
      hopelessness: 2,
      anxiety: 3,
      lastUpdate: "1 day ago",
      missed: 0,
      note: "Feeling steady and trying to keep routine.",
    },
    medication: { adherence: 0.98, lastMissed: "15 days ago", regimen: "Lithium + quetiapine" },
    history: { episodes: 4, lastEpisode: "Feb 2026", type: "manic" },
    dataQuality: "high",
    patientResponse: "responsive",
    coordinator: "Sam T.",
    escalation: "watchlist",
    groundTruth: { level: "Watch", action: "auto-checkin" },
    challengeTags: ["post-discharge", "recovering"],
    communications: [
      { date: "Apr 18", type: "Auto check-in", status: "responded", note: "Mood 6, sleep stable." },
    ],
  },
  {
    id: "P-0815",
    name: "Riley Morgan",
    age: 31,
    baseline: "Bipolar II, stable for two years",
    sleep: { avg: 5.8, baseline: 7.6, trend: "decreasing", days: 4, regularity: "moderate" },
    activity: { avg: 6900, baseline: 6200, trend: "slight-increase", days: 7 },
    hrv: { avg: 43, baseline: 45, trend: "stable", days: 7 },
    phone: { avg: 4.8, baseline: 4, nightUse: "moderate", trend: "slight-increase", days: 7 },
    selfReport: {
      mood: 6,
      irritability: 3,
      energy: 6,
      impulsivity: 2,
      hopelessness: 1,
      anxiety: 4,
      lastUpdate: "10 hours ago",
      missed: 0,
      note: "Some trouble sleeping after medication increase.",
    },
    medication: { adherence: 1, lastMissed: "None in 60 days", regimen: "Lamotrigine; dose increased five days ago" },
    history: { episodes: 2, lastEpisode: "Mar 2024", type: "depressive" },
    dataQuality: "high",
    patientResponse: "responsive",
    coordinator: "Jordan K.",
    escalation: "none",
    groundTruth: { level: "Watch", action: "auto-checkin" },
    challengeTags: ["potential-false-positive", "medication-change-confounder"],
    communications: [
      { date: "Apr 14", type: "Medication adjustment", status: "completed", note: "Lamotrigine up-titration." },
      { date: "Apr 18", type: "Auto check-in", status: "responded", note: "Some trouble sleeping." },
    ],
  },
  {
    id: "P-0923",
    name: "Dana Foster",
    age: 38,
    baseline: "Bipolar II with slow-onset depressive episodes",
    sleep: { avg: 7, baseline: 7.4, trend: "slight-decrease", days: 7, regularity: "high" },
    activity: { avg: 5200, baseline: 5400, trend: "stable", days: 7 },
    hrv: { avg: 41, baseline: 43, trend: "slight-decrease", days: 7 },
    phone: { avg: 2.8, baseline: 3.9, nightUse: "low", trend: "decreasing", days: 7 },
    selfReport: {
      mood: 5,
      irritability: 2,
      energy: 4,
      impulsivity: 2,
      hopelessness: 4,
      anxiety: 4,
      lastUpdate: "2 days ago",
      missed: 1,
      note: "More withdrawn than usual but says things are okay.",
    },
    medication: { adherence: 0.92, lastMissed: "4 days ago", regimen: "Lamotrigine + sertraline" },
    history: { episodes: 3, lastEpisode: "Jun 2025", type: "depressive" },
    dataQuality: "high",
    patientResponse: "partial",
    coordinator: "Unassigned",
    escalation: "none",
    groundTruth: { level: "Watch", action: "manual-outreach" },
    challengeTags: ["potential-false-negative", "subtle-warning-signs"],
    communications: [
      { date: "Apr 19", type: "Auto check-in", status: "missed", note: "" },
    ],
  },
  {
    id: "P-1034",
    name: "Theo Williams",
    age: 26,
    baseline: "Bipolar I with variable adherence",
    sleep: { avg: 5.9, baseline: 7.2, trend: "variable", days: 7, regularity: "low" },
    activity: { avg: 8400, baseline: 5800, trend: "increasing", days: 5 },
    hrv: { avg: 37, baseline: 41, trend: "decreasing", days: 4 },
    phone: { avg: 6.2, baseline: 4.3, nightUse: "moderate", trend: "increasing", days: 6 },
    selfReport: {
      mood: 7,
      irritability: 5,
      energy: 7,
      impulsivity: 5,
      hopelessness: 3,
      anxiety: 5,
      lastUpdate: "3 days ago",
      missed: 1,
      note: "Feels restless and has skipped a few doses.",
    },
    medication: { adherence: 0.6, lastMissed: "2 days ago", regimen: "Valproate + risperidone" },
    history: { episodes: 3, lastEpisode: "Dec 2025", type: "manic" },
    dataQuality: "moderate",
    patientResponse: "partial",
    coordinator: "Jordan K.",
    escalation: "watchlist",
    groundTruth: { level: "Elevated", action: "manual-outreach" },
    challengeTags: ["ambiguous-signal", "adherence-risk"],
    communications: [
      { date: "Apr 16", type: "Auto check-in", status: "responded", note: "Mood 8, says he feels great." },
      { date: "Apr 19", type: "Auto check-in", status: "missed", note: "" },
    ],
  },
  {
    id: "P-1147",
    name: "Noor Hassan",
    age: 48,
    baseline: "Bipolar I, well stabilized on medication",
    sleep: { avg: 7.4, baseline: 7.3, trend: "stable", days: 7, regularity: "high" },
    activity: { avg: 5900, baseline: 5700, trend: "stable", days: 7 },
    hrv: { avg: 44, baseline: 43, trend: "stable", days: 7 },
    phone: { avg: 3.5, baseline: 3.4, nightUse: "low", trend: "stable", days: 7 },
    selfReport: {
      mood: 7,
      irritability: 2,
      energy: 6,
      impulsivity: 2,
      hopelessness: 1,
      anxiety: 2,
      lastUpdate: "5 hours ago",
      missed: 0,
      note: "Routine is intact and feels okay.",
    },
    medication: { adherence: 0.99, lastMissed: "None in 30 days", regimen: "Lithium + aripiprazole" },
    history: { episodes: 4, lastEpisode: "May 2024", type: "manic" },
    dataQuality: "high",
    patientResponse: "responsive",
    coordinator: "Sam T.",
    escalation: "none",
    groundTruth: { level: "Stable", action: "no-action" },
    challengeTags: ["stable-baseline"],
    communications: [
      { date: "Apr 18", type: "Auto check-in", status: "responded", note: "All baseline." },
    ],
  },
  {
    id: "P-1276",
    name: "Olivia Brooks",
    age: 27,
    baseline: "Recent travel disrupted routine; prior hypomanic episodes",
    sleep: { avg: 5.1, baseline: 7.1, trend: "decreasing", days: 4, regularity: "low" },
    activity: { avg: 9600, baseline: 6200, trend: "increasing", days: 6 },
    hrv: { avg: 35, baseline: 44, trend: "decreasing", days: 5 },
    phone: { avg: 7.1, baseline: 4.4, nightUse: "high", trend: "increasing", days: 6 },
    selfReport: {
      mood: 8,
      irritability: 4,
      energy: 8,
      impulsivity: 5,
      hopelessness: 1,
      anxiety: 5,
      lastUpdate: "9 hours ago",
      missed: 0,
      note: "Jet lag but also feeling unusually driven.",
    },
    medication: { adherence: 0.88, lastMissed: "5 days ago", regimen: "Lamotrigine" },
    history: { episodes: 2, lastEpisode: "Sep 2025", type: "hypomanic" },
    dataQuality: "high",
    patientResponse: "responsive",
    coordinator: "Jordan K.",
    escalation: "watchlist",
    groundTruth: { level: "Elevated", action: "manual-outreach" },
    challengeTags: ["travel-confounder", "classic-manic-prodrome"],
    communications: [
      { date: "Apr 18", type: "Auto check-in", status: "responded", note: "Traveling and sleeping poorly." },
    ],
  },
  {
    id: "P-1388",
    name: "Harper Lewis",
    age: 33,
    baseline: "Bipolar II, engaged but vulnerable to mixed low mood states",
    sleep: { avg: 5.6, baseline: 7.3, trend: "decreasing", days: 6, regularity: "moderate" },
    activity: { avg: 4100, baseline: 5600, trend: "decreasing", days: 6 },
    hrv: { avg: 36, baseline: 43, trend: "decreasing", days: 6 },
    phone: { avg: 6.4, baseline: 4, nightUse: "high", trend: "increasing", days: 6 },
    selfReport: {
      mood: 3,
      irritability: 8,
      energy: 7,
      impulsivity: 7,
      hopelessness: 6,
      anxiety: 7,
      lastUpdate: "2 hours ago",
      missed: 0,
      note: "Feels wired, upset, and can't settle.",
    },
    medication: { adherence: 0.72, lastMissed: "Yesterday", regimen: "Lithium + lurasidone" },
    history: { episodes: 4, lastEpisode: "Jan 2025", type: "mixed" },
    dataQuality: "high",
    patientResponse: "responsive",
    coordinator: "Dr. Nakamura",
    escalation: "reviewing",
    groundTruth: { level: "Urgent Review", action: "clinician-review" },
    challengeTags: ["mixed-episode", "high-severity"],
    communications: [
      { date: "Apr 19", type: "Coordinator outreach", status: "completed", note: "Agreed to same-day clinician review." },
    ],
  },
  {
    id: "P-1495",
    name: "Cameron Reed",
    age: 39,
    baseline: "Stable but often disengages during stressful work periods",
    sleep: { avg: 6.9, baseline: 7.2, trend: "stable", days: 7, regularity: "moderate" },
    activity: { avg: 6100, baseline: 6300, trend: "stable", days: 7 },
    hrv: { avg: 42, baseline: 42, trend: "stable", days: 7 },
    phone: { avg: 2.1, baseline: 3.8, nightUse: "low", trend: "decreasing", days: 7 },
    selfReport: {
      mood: 4,
      irritability: 3,
      energy: 3,
      impulsivity: 2,
      hopelessness: 5,
      anxiety: 6,
      lastUpdate: "4 days ago",
      missed: 2,
      note: "Overwhelmed with work and withdrawing socially.",
    },
    medication: { adherence: 0.9, lastMissed: "3 days ago", regimen: "Lamotrigine" },
    history: { episodes: 2, lastEpisode: "Jul 2024", type: "depressive" },
    dataQuality: "moderate",
    patientResponse: "partial",
    coordinator: "Unassigned",
    escalation: "none",
    groundTruth: { level: "Watch", action: "manual-outreach" },
    challengeTags: ["subtle-warning-signs", "potential-false-negative"],
    communications: [
      { date: "Apr 17", type: "Auto check-in", status: "missed", note: "" },
      { date: "Apr 20", type: "Auto check-in", status: "missed", note: "" },
    ],
  },
];

const firstNames = [
  "Avery",
  "Rowan",
  "Jamie",
  "Taylor",
  "Morgan",
  "Casey",
  "Parker",
  "Quinn",
  "Sydney",
  "Logan",
  "Reese",
  "Emerson",
  "Finley",
  "Skyler",
  "Sawyer",
  "Dakota",
];

const lastNames = [
  "Adams",
  "Bennett",
  "Cruz",
  "Diaz",
  "Ellis",
  "Flores",
  "Garcia",
  "Hayes",
  "Iqbal",
  "James",
  "Kim",
  "Lopez",
  "Martinez",
  "Nguyen",
  "Owens",
  "Perry",
];

const careTeams = ["Jordan K.", "Sam T.", "Dr. Nakamura", "Unassigned"];

const clone = (value) => JSON.parse(JSON.stringify(value));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function varyNumber(value, offset, digits = 1, minimum = 0) {
  if (value == null) return null;
  return Number(clamp(value + offset, minimum, Number.MAX_SAFE_INTEGER).toFixed(digits));
}

function varyPercent(value, offset) {
  if (value == null) return null;
  return Number(clamp(value + offset, 0.3, 1).toFixed(2));
}

function varyText(base, index) {
  const suffixes = [
    "Routine disrupted this week.",
    "Coordinator noted mild concern.",
    "Patient report remains synthetic for research only.",
    "Signals remain noisy in the current window.",
    "Family stress may be a contextual factor.",
  ];
  return `${base} ${suffixes[index % suffixes.length]}`.trim();
}

function buildGeneratedPatient(index) {
  const archetypes = [
    seedPatients[0],
    seedPatients[1],
    seedPatients[4],
    seedPatients[5],
    seedPatients[8],
    seedPatients[11],
    seedPatients[12],
    seedPatients[13],
  ];

  const template = clone(archetypes[index % archetypes.length]);
  const magnitude = ((index % 5) - 2) * 0.25;
  const stepMagnitude = ((index % 7) - 3) * 180;
  const ageOffset = (index % 9) - 4;
  const name = `${firstNames[index % firstNames.length]} ${lastNames[(index * 3) % lastNames.length]}`;

  template.id = `P-${String(2000 + index).padStart(4, "0")}`;
  template.name = name;
  template.age = clamp(template.age + ageOffset, 19, 68);
  template.coordinator = careTeams[index % careTeams.length];
  template.patientResponse =
    template.patientResponse === "responsive" && index % 6 === 0
      ? "partial"
      : template.patientResponse;

  template.sleep.avg = varyNumber(template.sleep.avg, magnitude, 1);
  template.sleep.baseline = varyNumber(template.sleep.baseline, magnitude / 2, 1, 4.5);
  template.activity.avg = varyNumber(template.activity.avg, stepMagnitude, 0, 1000);
  template.activity.baseline = varyNumber(template.activity.baseline, stepMagnitude / 2, 0, 1000);
  template.hrv.avg = varyNumber(template.hrv.avg, magnitude * 2, 0, 20);
  template.hrv.baseline = varyNumber(template.hrv.baseline, magnitude, 0, 20);
  template.phone.avg = varyNumber(template.phone.avg, magnitude, 1);
  template.phone.baseline = varyNumber(template.phone.baseline, magnitude / 2, 1, 1.5);
  template.medication.adherence = varyPercent(template.medication.adherence, magnitude / 10);

  if (template.selfReport.mood != null) template.selfReport.mood = clamp(template.selfReport.mood + Math.round(magnitude * 2), 1, 10);
  if (template.selfReport.energy != null) template.selfReport.energy = clamp(template.selfReport.energy + Math.round(magnitude * 2), 1, 10);
  if (template.selfReport.irritability != null) template.selfReport.irritability = clamp(template.selfReport.irritability + Math.round(magnitude * 2), 1, 10);
  if (template.selfReport.impulsivity != null) template.selfReport.impulsivity = clamp(template.selfReport.impulsivity + Math.round(magnitude * 2), 1, 10);
  if (template.selfReport.hopelessness != null) template.selfReport.hopelessness = clamp(template.selfReport.hopelessness + Math.round(-magnitude * 2), 0, 10);
  if (template.selfReport.anxiety != null) template.selfReport.anxiety = clamp(template.selfReport.anxiety + Math.round(magnitude * 2), 0, 10);
  template.selfReport.note = varyText(template.selfReport.note ?? "", index);

  if (template.dataQuality === "high" && index % 8 === 0) template.dataQuality = "moderate";
  if (template.dataQuality === "moderate" && index % 10 === 0) template.dataQuality = "low";

  if (template.dataQuality === "low") {
    template.sleep.avg = index % 2 === 0 ? null : template.sleep.avg;
    template.activity.avg = index % 3 === 0 ? null : template.activity.avg;
    template.hrv.avg = index % 4 === 0 ? null : template.hrv.avg;
  }

  template.communications = [
    {
      date: "Apr 18",
      type: "Auto check-in",
      status: template.patientResponse === "no-response" ? "missed" : "responded",
      note: template.patientResponse === "no-response" ? "" : template.selfReport.note,
    },
    {
      date: "Apr 20",
      type: template.groundTruth.action === "manual-outreach" ? "Coordinator outreach" : "Auto check-in",
      status: index % 3 === 0 ? "scheduled" : "responded",
      note: template.groundTruth.action === "clinician-review" ? "Escalated for review." : "",
    },
  ];

  return template;
}

export function buildPatientPool() {
  const extraPatients = Array.from({ length: 46 }, (_, index) => buildGeneratedPatient(index + 1));
  return [...clone(seedPatients), ...extraPatients];
}
