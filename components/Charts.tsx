"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SimpleLineChartProps {
  color: string;
  data: Array<Record<string, number | string>>;
  dataKey: string;
  subtitle?: string;
  title: string;
}

interface ComparisonLineChartProps extends SimpleLineChartProps {
  baseline?: number;
  baselineLabel?: string;
  baselineRange?: { lower: number; upper: number };
  heightClassName?: string;
  yDomain?: [number | "auto", number | "auto"];
}

interface MiniSparklineProps {
  color: string;
  data: Array<Record<string, number | string>>;
  dataKey: string;
}

interface MiniTrendChartProps extends MiniSparklineProps {
  alarming?: boolean;
  baseline: number;
  heightClassName?: string;
}

export function SimpleLineChart({
  color,
  data,
  dataKey,
  subtitle,
  title,
}: SimpleLineChartProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "16px",
                borderColor: "#cbd5e1",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ComparisonLineChart({
  baseline,
  baselineLabel = "Baseline",
  baselineRange,
  color,
  data,
  dataKey,
  heightClassName = "h-36",
  subtitle,
  title,
  yDomain,
}: ComparisonLineChartProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {typeof baseline === "number" ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
            {baselineLabel}: {baseline}
          </span>
        ) : null}
      </div>
      <div className={heightClassName}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "16px",
                borderColor: "#cbd5e1",
                fontSize: "12px",
              }}
            />
            {baselineRange ? (
              <ReferenceArea
                y1={baselineRange.lower}
                y2={baselineRange.upper}
                fill="#e5e7eb"
                fillOpacity={0.45}
                strokeOpacity={0}
              />
            ) : null}
            {typeof baseline === "number" ? (
              <ReferenceLine
                y={baseline}
                stroke="#64748b"
                strokeDasharray="4 4"
                label={{
                  fill: "#64748b",
                  fontSize: 11,
                  position: "insideTopRight",
                  value: baselineLabel,
                }}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MiniSparkline({ color, data, dataKey }: MiniSparklineProps) {
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Tooltip
            contentStyle={{
              borderRadius: "14px",
              borderColor: "#cbd5e1",
              fontSize: "11px",
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MiniTrendChart({
  alarming,
  baseline,
  color,
  data,
  dataKey,
  heightClassName = "h-16",
}: MiniTrendChartProps) {
  const values = data
    .map((point) => Number(point[dataKey]))
    .filter((value) => Number.isFinite(value));
  const minValue = Math.min(baseline, ...values);
  const maxValue = Math.max(baseline, ...values);
  const padding = Math.max(0.8, (maxValue - minValue) * 0.2);

  return (
    <div className={`${heightClassName} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 4, bottom: 2, left: 4 }}>
          <YAxis hide domain={[minValue - padding, maxValue + padding]} />
          <Tooltip
            contentStyle={{
              borderRadius: "14px",
              borderColor: "#cbd5e1",
              fontSize: "11px",
            }}
          />
          <ReferenceLine y={baseline} stroke="#94a3b8" strokeDasharray="5 5" />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={alarming ? "#dc2626" : color}
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
