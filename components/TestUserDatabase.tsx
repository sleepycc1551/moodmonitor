"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Database, Pencil, RotateCcw, UserCheck, UserPlus, X } from "lucide-react";
import { formatConcernLabel } from "@/lib/riskEngine";
import type { ConcernLevel, PatientRecord, TestUserScenarioInput } from "@/types";

interface TestUserDatabaseProps {
  currentPatientId: string;
  onAddTestUser: (input: TestUserScenarioInput) => void;
  onLoadPatient: (patientId: string) => void;
  onResetMockData: () => void;
  onUpdateTestUser: (patientId: string, input: TestUserScenarioInput) => void;
  patients: PatientRecord[];
}

type ModalMode = "add" | "edit" | null;

const concernLevels: ConcernLevel[] = ["stable", "watch", "elevated", "urgent"];
const showFacilitatorTools =
  process.env.NEXT_PUBLIC_SHOW_FACILITATOR_TOOLS === "true";

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function latestOrBaseline(patient: PatientRecord): TestUserScenarioInput {
  const latestCheckIn = patient.checkIns.at(-1);
  const latestPhone = patient.phoneBehaviorData.at(-1);

  return {
    name: patient.profile.name,
    age: patient.profile.age,
    pronouns: patient.profile.pronouns ?? "",
    baselineSleepDuration: patient.baseline.sleepDuration,
    baselineMood: patient.baseline.mood,
    baselineEnergy: patient.baseline.energy,
    concernLevel: patient.latestRisk.concernLevel,
    keyReason:
      patient.latestRisk.keyReasons[0] ?? patient.latestRisk.clinicianFacingSummary,
    consentWearableMonitoring: patient.profile.consentWearableMonitoring,
    consentPhoneMonitoring: patient.profile.consentPhoneMonitoring,
    shareDataWithClinician: patient.profile.connectClinicianDashboard,
    latestMood: latestCheckIn?.mood ?? patient.baseline.mood,
    latestEnergy: latestCheckIn?.energy ?? patient.baseline.energy,
    latestHoursSlept: latestCheckIn?.hoursSlept ?? patient.baseline.hoursSlept,
    latestSleepQuality: latestCheckIn?.sleepQuality ?? patient.baseline.sleepQuality,
    latestNighttimePhoneUseMinutes:
      latestPhone?.nighttimePhoneUseMinutes ?? patient.baseline.nighttimePhoneUseMinutes,
    latestScreenTimeHours: latestPhone?.screenTimeHours ?? patient.baseline.screenTimeHours,
  };
}

function blankScenario(): TestUserScenarioInput {
  return {
    name: "New Test User",
    age: undefined,
    pronouns: "",
    baselineSleepDuration: 7.3,
    baselineMood: 5,
    baselineEnergy: 5,
    concernLevel: "stable",
    keyReason: "Recent data remains close to baseline.",
    consentWearableMonitoring: true,
    consentPhoneMonitoring: true,
    shareDataWithClinician: true,
    latestMood: 5,
    latestEnergy: 5,
    latestHoursSlept: 7.2,
    latestSleepQuality: 7,
    latestNighttimePhoneUseMinutes: 22,
    latestScreenTimeHours: 4.5,
  };
}

export function TestUserDatabase({
  currentPatientId,
  onAddTestUser,
  onLoadPatient,
  onResetMockData,
  onUpdateTestUser,
  patients,
}: TestUserDatabaseProps) {
  const [draftPatientId, setDraftPatientId] = useState(currentPatientId);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.profile.id === draftPatientId) ?? patients[0],
    [draftPatientId, patients],
  );
  const currentPatient = useMemo(
    () => patients.find((patient) => patient.profile.id === currentPatientId),
    [currentPatientId, patients],
  );

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Test controls
            </p>
            <h2 className="text-xl font-semibold text-slate-950">Test User Database</h2>
            <p className="mt-1 text-sm text-slate-600">
              Current simulated user:{" "}
              <span className="font-medium text-slate-950">
                {currentPatient?.profile.name ?? "None selected"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[260px] items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
            <span className="whitespace-nowrap font-medium">Select user</span>
            <select
              value={draftPatientId}
              onChange={(event) => setDraftPatientId(event.target.value)}
              className="w-full bg-transparent outline-none"
            >
              {patients.map((patient) => (
                <option key={patient.profile.id} value={patient.profile.id}>
                  {patient.profile.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => onLoadPatient(draftPatientId)}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
          >
            <UserCheck className="h-4 w-4" />
            Load user
          </button>
          {showFacilitatorTools ? (
            <>
              <button
                type="button"
                onClick={() => setModalMode("edit")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
              >
                <Pencil className="h-4 w-4" />
                Edit user data
              </button>
              <button
                type="button"
                onClick={() => setModalMode("add")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
              >
                <UserPlus className="h-4 w-4" />
                Add test user
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset all local test users to the default mock data?")) {
                onResetMockData();
              }
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700"
          >
            <RotateCcw className="h-4 w-4" />
            Reset mock data
          </button>
        </div>
      </div>

      {modalMode ? (
        <TestUserEditor
          key={`${modalMode}-${selectedPatient?.profile.id ?? "new"}`}
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onSave={(values) => {
            if (modalMode === "add") {
              onAddTestUser(values);
            } else if (selectedPatient) {
              onUpdateTestUser(selectedPatient.profile.id, values);
            }
            setModalMode(null);
          }}
          patient={modalMode === "edit" ? selectedPatient : undefined}
        />
      ) : null}
    </section>
  );
}

function TestUserEditor({
  mode,
  onClose,
  onSave,
  patient,
}: {
  mode: "add" | "edit";
  onClose: () => void;
  onSave: (values: TestUserScenarioInput) => void;
  patient?: PatientRecord;
}) {
  const [values, setValues] = useState<TestUserScenarioInput>(() =>
    patient ? latestOrBaseline(patient) : blankScenario(),
  );

  function update<Key extends keyof TestUserScenarioInput>(
    key: Key,
    value: TestUserScenarioInput[Key],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
      <div className="my-8 w-full max-w-5xl rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Test scenario editor
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-950">
              {mode === "add" ? "Add test user" : `Edit ${patient?.profile.name ?? "test user"}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <EditorSection title="Profile">
            <TextField
              label="Name"
              value={values.name}
              onChange={(value) => update("name", value)}
            />
            <NumberField
              label="Age"
              max={120}
              min={0}
              value={values.age ?? 0}
              onChange={(value) => update("age", value || undefined)}
            />
            <TextField
              label="Pronouns"
              value={values.pronouns ?? ""}
              onChange={(value) => update("pronouns", value)}
            />
            <CheckboxField
              checked={values.consentWearableMonitoring}
              label="Wearable monitoring enabled"
              onChange={(value) => update("consentWearableMonitoring", value)}
            />
            <CheckboxField
              checked={values.consentPhoneMonitoring}
              label="Phone behavior monitoring enabled"
              onChange={(value) => update("consentPhoneMonitoring", value)}
            />
            <CheckboxField
              checked={values.shareDataWithClinician}
              label="Share summaries with clinician"
              onChange={(value) => update("shareDataWithClinician", value)}
            />
          </EditorSection>

          <EditorSection title="Baseline and concern">
            <NumberField
              label="Baseline sleep duration"
              max={12}
              min={0}
              step={0.1}
              value={values.baselineSleepDuration}
              onChange={(value) => update("baselineSleepDuration", clamp(value, 0, 12))}
            />
            <NumberField
              label="Baseline mood"
              max={10}
              min={0}
              value={values.baselineMood}
              onChange={(value) => update("baselineMood", clamp(value, 0, 10))}
            />
            <NumberField
              label="Baseline energy"
              max={10}
              min={0}
              value={values.baselineEnergy}
              onChange={(value) => update("baselineEnergy", clamp(value, 0, 10))}
            />
            <label className="block text-sm font-medium text-slate-700">
              Current concern level
              <select
                value={values.concernLevel}
                onChange={(event) =>
                  update("concernLevel", event.target.value as ConcernLevel)
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
              >
                {concernLevels.map((level) => (
                  <option key={level} value={level}>
                    {formatConcernLabel(level)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Key reason
              <textarea
                value={values.keyReason}
                onChange={(event) => update("keyReason", event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
              />
            </label>
          </EditorSection>

          <EditorSection title="Recent simulated data">
            <NumberField
              label="Latest mood"
              max={10}
              min={0}
              value={values.latestMood}
              onChange={(value) => update("latestMood", clamp(value, 0, 10))}
            />
            <NumberField
              label="Latest energy"
              max={10}
              min={0}
              value={values.latestEnergy}
              onChange={(value) => update("latestEnergy", clamp(value, 0, 10))}
            />
            <NumberField
              label="Latest hours slept"
              max={12}
              min={0}
              step={0.1}
              value={values.latestHoursSlept}
              onChange={(value) => update("latestHoursSlept", clamp(value, 0, 12))}
            />
            <NumberField
              label="Latest sleep quality"
              max={10}
              min={0}
              value={values.latestSleepQuality}
              onChange={(value) => update("latestSleepQuality", clamp(value, 0, 10))}
            />
            <NumberField
              label="Nighttime phone use"
              max={240}
              min={0}
              value={values.latestNighttimePhoneUseMinutes}
              onChange={(value) =>
                update("latestNighttimePhoneUseMinutes", clamp(value, 0, 240))
              }
            />
            <NumberField
              label="Screen time hours"
              max={18}
              min={0}
              step={0.1}
              value={values.latestScreenTimeHours}
              onChange={(value) =>
                update("latestScreenTimeHours", clamp(value, 0, 18))
              }
            />
          </EditorSection>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                ...values,
                name: values.name.trim() || "Unnamed Test User",
                pronouns: values.pronouns?.trim(),
                keyReason: values.keyReason.trim() || "Scenario edited for testing.",
              })
            }
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
          >
            Save user data
          </button>
        </div>
      </div>
    </div>
  );
}

function EditorSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h4>
      {children}
    </section>
  );
}

function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
      />
    </label>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        max={max}
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
      />
    </label>
  );
}

function CheckboxField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-sky-600"
      />
      {label}
    </label>
  );
}
