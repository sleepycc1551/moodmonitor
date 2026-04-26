"use client";

import { useState } from "react";

interface SetupValues {
  name: string;
  age?: number;
  pronouns?: string;
  consentWearableMonitoring: boolean;
  consentPhoneMonitoring: boolean;
  connectClinicianDashboard: boolean;
}

interface SetupScreenProps {
  onComplete: (values: SetupValues) => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [consentWearableMonitoring, setConsentWearableMonitoring] = useState(true);
  const [consentPhoneMonitoring, setConsentPhoneMonitoring] = useState(true);
  const [connectClinicianDashboard, setConnectClinicianDashboard] = useState(true);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e0f2fe,_#ffffff_50%,_#f8fafc)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-xl md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.9fr]">
          <section>
            <div className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
              MoodWatch prototype
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              AI-assisted proactive and preventive health management
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              This graduate-course research prototype explores how a patient, an AI assistant,
              and a clinician dashboard might work together to notice changes from a person’s
              usual pattern and support earlier follow-up.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "This is a prototype and not a medical device.",
                "The system does not diagnose bipolar disorder or other conditions.",
                "AI suggestions are decision support only.",
                "Only summarized behavioral metadata is shown, not private content.",
              ].map((note) => (
                <div
                  key={note}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
                >
                  {note}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-xl font-semibold text-slate-900">Welcome and setup</h2>
            <p className="mt-2 text-sm text-slate-600">
              Enter a patient profile for local testing. This profile is stored in browser
              storage and shared with the clinician side of the prototype.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                  placeholder="Enter a patient name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Age <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Pronouns <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    value={pronouns}
                    onChange={(event) => setPronouns(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <ToggleRow
                  checked={consentWearableMonitoring}
                  description="Allow simulated wearable summaries to be used for monitoring."
                  label="Consent to passive wearable monitoring"
                  onChange={setConsentWearableMonitoring}
                />
                <ToggleRow
                  checked={consentPhoneMonitoring}
                  description="Allow privacy-preserving phone behavior summaries to be used."
                  label="Consent to phone behavior monitoring"
                  onChange={setConsentPhoneMonitoring}
                />
                <ToggleRow
                  checked={connectClinicianDashboard}
                  description="Share data with the clinician dashboard in this local prototype."
                  label="Connect with clinician dashboard"
                  onChange={setConnectClinicianDashboard}
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  onComplete({
                    name: name.trim(),
                    age: age ? Number(age) : undefined,
                    pronouns: pronouns.trim() || undefined,
                    consentWearableMonitoring,
                    consentPhoneMonitoring,
                    connectClinicianDashboard,
                  })
                }
                disabled={!name.trim()}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Start prototype
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

interface ToggleRowProps {
  checked: boolean;
  description: string;
  label: string;
  onChange: (value: boolean) => void;
}

function ToggleRow({ checked, description, label, onChange }: ToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-sky-600" : "bg-slate-300"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </label>
  );
}
