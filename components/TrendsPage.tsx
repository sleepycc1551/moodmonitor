"use client";

import { SimpleLineChart } from "@/components/Charts";
import { buildChartSeries, getTrendCards } from "@/lib/riskEngine";
import type { PatientRecord } from "@/types";

interface TrendsPageProps {
  patient: PatientRecord;
}

export function TrendsPage({ patient }: TrendsPageProps) {
  const trendCards = getTrendCards(patient);
  const moodSeries = buildChartSeries(patient.checkIns.slice(-7), (checkIn) => ({
    mood: checkIn.mood,
  }));
  const energySeries = buildChartSeries(patient.checkIns.slice(-7), (checkIn) => ({
    energy: checkIn.energy,
  }));
  const sleepSeries = buildChartSeries(patient.checkIns.slice(-7), (checkIn) => ({
    sleep: checkIn.hoursSlept,
  }));
  const screenTimeSeries = buildChartSeries(patient.phoneBehaviorData.slice(-7), (phoneSummary) => ({
    screenTime: phoneSummary.screenTimeHours,
  }));

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Changes from your usual pattern</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This page shows changes from your own usual pattern. It does not diagnose a condition.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {trendCards.map((card) => (
          <div
            key={card}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm"
          >
            {card}
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SimpleLineChart
          color="#2563eb"
          data={moodSeries}
          dataKey="mood"
          title="Mood over time"
          subtitle="Self-report scale from 0 to 10"
        />
        <SimpleLineChart
          color="#7c3aed"
          data={energySeries}
          dataKey="energy"
          title="Energy over time"
          subtitle="Self-report scale from 0 to 10"
        />
        <SimpleLineChart
          color="#0f766e"
          data={sleepSeries}
          dataKey="sleep"
          title="Sleep duration over time"
          subtitle="Hours slept per night"
        />
        <SimpleLineChart
          color="#ea580c"
          data={screenTimeSeries}
          dataKey="screenTime"
          title="Screen time over time"
          subtitle="Daily screen time summary"
        />
      </section>
    </div>
  );
}
