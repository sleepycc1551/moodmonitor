export type DeviationStatus = "stable" | "watch" | "concerning" | "missing";

export type DeviationMetricType =
  | "sleepDuration"
  | "scaleBoth"
  | "scaleHigh"
  | "scaleLow"
  | "phoneHigh"
  | "countHigh"
  | "heartRateHigh"
  | "adherence";

export function getDeviationStatus(
  value: number | null | undefined,
  baseline: number | null | undefined,
  metricType: DeviationMetricType,
): DeviationStatus {
  if (
    typeof value !== "number" ||
    typeof baseline !== "number" ||
    !Number.isFinite(value) ||
    !Number.isFinite(baseline)
  ) {
    return "missing";
  }

  const delta = value - baseline;
  const percentChange = baseline === 0 ? 0 : delta / Math.abs(baseline);

  if (metricType === "sleepDuration") {
    if (delta <= -1.5 || percentChange <= -0.2) return "concerning";
    if (delta <= -0.75 || percentChange <= -0.12) return "watch";
    return "stable";
  }

  if (metricType === "scaleHigh") {
    if (delta >= 3) return "concerning";
    if (delta >= 1.5) return "watch";
    return "stable";
  }

  if (metricType === "scaleLow") {
    if (delta <= -3) return "concerning";
    if (delta <= -1.5) return "watch";
    return "stable";
  }

  if (metricType === "scaleBoth") {
    if (Math.abs(delta) >= 3) return "concerning";
    if (Math.abs(delta) >= 1.5) return "watch";
    return "stable";
  }

  if (metricType === "phoneHigh") {
    if (delta >= 45 || percentChange >= 0.6) return "concerning";
    if (delta >= 20 || percentChange >= 0.3) return "watch";
    return "stable";
  }

  if (metricType === "countHigh") {
    if (delta >= 4) return "concerning";
    if (delta >= 2) return "watch";
    return "stable";
  }

  if (metricType === "heartRateHigh") {
    if (delta >= 12) return "concerning";
    if (delta >= 7) return "watch";
    return "stable";
  }

  if (metricType === "adherence") {
    if (value <= 0) return "concerning";
    if (value < 1) return "watch";
    return "stable";
  }

  return "stable";
}

export function getTrendColor(status: DeviationStatus): string {
  if (status === "concerning") return "#dc2626";
  if (status === "watch") return "#f97316";
  if (status === "missing") return "#94a3b8";
  return "#0f766e";
}

export function getDeviationBadgeClass(status: DeviationStatus): string {
  if (status === "concerning") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "watch") return "bg-orange-50 text-orange-700 ring-orange-200";
  if (status === "missing") return "bg-slate-100 text-slate-500 ring-slate-200";
  return "bg-teal-50 text-teal-700 ring-teal-200";
}

export function formatDeviationStatus(status: DeviationStatus): string {
  if (status === "concerning") return "Concerning";
  if (status === "watch") return "Watch";
  if (status === "missing") return "Missing";
  return "Stable";
}

export function getBaselineBand(
  baseline: number,
  metricType: DeviationMetricType,
): { lower: number; upper: number } {
  if (metricType === "sleepDuration") {
    return { lower: Math.max(0, baseline - 1), upper: baseline + 1 };
  }

  if (
    metricType === "scaleBoth" ||
    metricType === "scaleHigh" ||
    metricType === "scaleLow"
  ) {
    return { lower: Math.max(0, baseline - 1), upper: Math.min(10, baseline + 1) };
  }

  if (metricType === "countHigh") {
    return { lower: Math.max(0, baseline - 1), upper: baseline + 1 };
  }

  if (metricType === "heartRateHigh") {
    return { lower: Math.max(0, baseline - 5), upper: baseline + 5 };
  }

  if (metricType === "adherence") {
    return { lower: 0.8, upper: 1 };
  }

  const range = Math.max(1, Math.abs(baseline) * 0.2);
  return { lower: Math.max(0, baseline - range), upper: baseline + range };
}

export function describeDeviation(
  status: DeviationStatus,
  direction: "higher" | "lower" | "mixed" | "near",
): string {
  if (status === "missing") return "Data unavailable or low quality";
  if (status === "stable") return "Near personal baseline";
  if (direction === "lower") return "Below personal baseline";
  if (direction === "higher") return "Above personal baseline";
  return "Meaningful change from baseline";
}
