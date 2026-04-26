"use client";

import { useState } from "react";
import { Activity, Moon, Smartphone, Watch } from "lucide-react";
import type { DailyCheckIn, PatientNotification, PatientRecord } from "@/types";

interface TodayCheckInProps {
  patient: PatientRecord;
  latestNotification?: PatientNotification;
  onGeneratePhoneData: () => void;
  onGenerateWearableData: () => void;
  onSubmitCheckIn: (
    values: Omit<DailyCheckIn, "id" | "patientId" | "timestamp">,
  ) => void;
  submissionMessage?: string;
}

export function TodayCheckIn({
  latestNotification,
  onGeneratePhoneData,
  onGenerateWearableData,
  onSubmitCheckIn,
  patient,
  submissionMessage,
}: TodayCheckInProps) {
  const latestWearable = patient.wearableData[patient.wearableData.length - 1];
  const latestPhone = patient.phoneBehaviorData[patient.phoneBehaviorData.length - 1];

  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [anxiety, setAnxiety] = useState(4);
  const [irritability, setIrritability] = useState(3);
  const [sleepQuality, setSleepQuality] = useState(6);
  const [impulsivity, setImpulsivity] = useState(2);
  const [hoursSlept, setHoursSlept] = useState("7.5");
  const [medicationTakenToday, setMedicationTakenToday] =
    useState<DailyCheckIn["medicationTakenToday"]>("yes");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_#dbeafe,_#eff6ff_55%,_#ffffff)] p-5 shadow-sm">
        <p className="text-sm text-sky-700">Hi, {patient.profile.name}.</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">
          How are you feeling today?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This is a consent-based research prototype. It looks for changes from your own usual
          pattern and does not diagnose a condition.
        </p>
      </section>

      {latestNotification ? (
        <section className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Message from care team
          </div>
          <div className="mt-2 text-sm text-slate-700">
            <strong>{latestNotification.title}</strong>
            <p className="mt-1">{latestNotification.message}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Daily check-in</h3>
            <p className="text-sm text-slate-500">
              Share how today feels. Your entries are stored locally in this browser.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            Prototype only
          </span>
        </div>

        <div className="grid gap-4">
          <SliderRow label="Mood" value={mood} onChange={setMood} />
          <SliderRow label="Energy" value={energy} onChange={setEnergy} />
          <SliderRow label="Anxiety" value={anxiety} onChange={setAnxiety} />
          <SliderRow label="Irritability" value={irritability} onChange={setIrritability} />
          <SliderRow label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
          <SliderRow
            label="Impulsivity / urge to do risky things"
            value={impulsivity}
            onChange={setImpulsivity}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Hours slept last night
            </label>
            <input
              type="number"
              min={0}
              max={16}
              step="0.5"
              value={hoursSlept}
              onChange={(event) => setHoursSlept(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Medication taken today?
            </label>
            <select
              value={medicationTakenToday}
              onChange={(event) =>
                setMedicationTakenToday(event.target.value as DailyCheckIn["medicationTakenToday"])
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="partial">Partial</option>
              <option value="not-applicable">Not applicable</option>
            </select>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Anything important today?
          </label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
            placeholder="Optional note"
          />
        </div>

        <button
          type="button"
          onClick={() =>
            onSubmitCheckIn({
              mood,
              energy,
              anxiety,
              irritability,
              sleepQuality,
              impulsivity,
              hoursSlept: Number(hoursSlept),
              medicationTakenToday,
              note,
            })
          }
          className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Submit check-in
        </button>

        {submissionMessage ? (
          <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {submissionMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Watch className="h-5 w-5 text-sky-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Simulated wearable data</h3>
              <p className="text-sm text-slate-500">{"Today's privacy-preserving sensor summary."}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={!patient.profile.consentWearableMonitoring}
            onClick={onGenerateWearableData}
            className="hidden rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            Generate new simulated wearable data
          </button>
        </div>

        {patient.profile.consentWearableMonitoring && latestWearable ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard icon={Moon} label="Sleep duration" value={`${latestWearable.sleepDuration} h`} />
            <MetricCard icon={Moon} label="Sleep quality" value={`${latestWearable.sleepQuality}/10`} />
            <MetricCard icon={Activity} label="Resting heart rate" value={`${latestWearable.restingHeartRate} bpm`} />
            <MetricCard icon={Activity} label="Activity level" value={`${latestWearable.activityLevel}/10`} />
            <MetricCard icon={Activity} label="Stress estimate" value={`${latestWearable.stressEstimate}/10`} />
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Wearable monitoring is currently turned off for this patient profile.
          </p>
        )}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-sky-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Simulated phone behavior</h3>
              <p className="text-sm text-slate-500">
                Only behavioral metadata is summarized. Private content is not displayed.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={!patient.profile.consentPhoneMonitoring}
            onClick={onGeneratePhoneData}
            className="hidden rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            Generate new simulated phone data
          </button>
        </div>

        {patient.profile.consentPhoneMonitoring && latestPhone ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard icon={Smartphone} label="Screen time" value={`${latestPhone.screenTimeHours} h`} />
            <MetricCard
              icon={Smartphone}
              label="Nighttime phone use"
              value={`${latestPhone.nighttimePhoneUseMinutes} min`}
            />
            <MetricCard
              icon={Smartphone}
              label="Social app usage"
              value={`${latestPhone.socialAppUsageMinutes} min`}
            />
            <MetricCard
              icon={Smartphone}
              label="Spending app visits"
              value={`${latestPhone.spendingAppVisits}/day`}
            />
            <MetricCard
              icon={Smartphone}
              label="Unlock frequency"
              value={`${latestPhone.unlockFrequency}/day`}
            />
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Phone behavior monitoring is currently turned off for this patient profile.
          </p>
        )}
      </section>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  onChange: (value: number) => void;
  value: number;
}

function SliderRow({ label, onChange, value }: SliderRowProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {value}/10
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-sky-600"
      />
    </div>
  );
}

interface MetricCardProps {
  icon: typeof Moon;
  label: string;
  value: string;
}

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
