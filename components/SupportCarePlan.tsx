"use client";

import { useState } from "react";
import {
  CalendarPlus2,
  CircleAlert,
  HeartHandshake,
  MessageCircleHeart,
  ShieldAlert,
  UserRoundPlus,
} from "lucide-react";
import type { AppointmentReason, CarePlan, PatientRecord, SharingPreferences } from "@/types";

interface SupportCarePlanProps {
  onOpenAssistant: () => void;
  onRequestAppointment: (reason: AppointmentReason, note: string) => void;
  onRequestClinicianCheckIn: () => void;
  onSaveCarePlan: (carePlan: CarePlan) => void;
  onUpdateSharingPreferences: (preferences: SharingPreferences) => void;
  patient: PatientRecord;
}

const appointmentReasons: AppointmentReason[] = [
  "Routine check-in",
  "Sleep problem",
  "Mood change",
  "Medication question",
  "Urgent concern",
];

export function SupportCarePlan({
  onOpenAssistant,
  onRequestAppointment,
  onRequestClinicianCheckIn,
  onSaveCarePlan,
  onUpdateSharingPreferences,
  patient,
}: SupportCarePlanProps) {
  const [selectedReason, setSelectedReason] = useState<AppointmentReason>("Routine check-in");
  const [appointmentNote, setAppointmentNote] = useState("");
  const [carePlanDraft, setCarePlanDraft] = useState<CarePlan>(patient.carePlan);
  const [sharingPreferences, setSharingPreferences] = useState<SharingPreferences>(
    patient.profile.sharingPreferences,
  );
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Support and care plan</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This page helps you request support, review coping preferences, and control what gets
          shared with your care team.
        </p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Need Help Now</h3>
            <p className="text-sm text-slate-500">
              Prototype actions only. Real emergency services are not contacted here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen((value) => !value)}
            className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white"
          >
            Need Help Now
          </button>
        </div>

        {helpOpen ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <HelpAction
              icon={MessageCircleHeart}
              label="Talk to AI assistant"
              onClick={onOpenAssistant}
            />
            <HelpAction
              icon={HeartHandshake}
              label="Request clinician check-in"
              onClick={onRequestClinicianCheckIn}
            />
            <HelpAction
              icon={UserRoundPlus}
              label="Contact trusted person"
              onClick={() => null}
              description={patient.carePlan.trustedPeople}
            />
            <HelpAction
              icon={CircleAlert}
              label="View coping plan"
              onClick={() => null}
              description={patient.carePlan.calmingStrategies}
            />
            <HelpAction
              icon={ShieldAlert}
              label="Emergency resources"
              onClick={() => null}
              description="If this were a deployed system, this action would connect the user to crisis or emergency resources. This prototype does not contact real emergency services."
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarPlus2 className="h-5 w-5 text-sky-600" />
          <h3 className="text-lg font-semibold text-slate-900">Request appointment</h3>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.5fr]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Reason</label>
            <select
              value={selectedReason}
              onChange={(event) => setSelectedReason(event.target.value as AppointmentReason)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
            >
              {appointmentReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Note <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={appointmentNote}
              onChange={(event) => setAppointmentNote(event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
              placeholder="Add context for the clinician."
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onRequestAppointment(selectedReason, appointmentNote.trim());
            setAppointmentNote("");
          }}
          className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Submit request
        </button>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">My care plan</h3>
        <div className="mt-4 grid gap-4">
          <TextAreaRow
            label="Warning signs I want the system to watch for"
            value={carePlanDraft.warningSigns}
            onChange={(value) =>
              setCarePlanDraft((current) => ({ ...current, warningSigns: value }))
            }
          />
          <TextAreaRow
            label="What helps me calm down"
            value={carePlanDraft.calmingStrategies}
            onChange={(value) =>
              setCarePlanDraft((current) => ({ ...current, calmingStrategies: value }))
            }
          />
          <TextAreaRow
            label="People I trust"
            value={carePlanDraft.trustedPeople}
            onChange={(value) =>
              setCarePlanDraft((current) => ({ ...current, trustedPeople: value }))
            }
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Preferred clinician contact method
            </label>
            <input
              value={carePlanDraft.preferredClinicianContactMethod}
              onChange={(event) =>
                setCarePlanDraft((current) => ({
                  ...current,
                  preferredClinicianContactMethod: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
            />
          </div>
          <TextAreaRow
            label="Data sharing preferences"
            value={carePlanDraft.dataSharingPreferencesNote}
            onChange={(value) =>
              setCarePlanDraft((current) => ({
                ...current,
                dataSharingPreferencesNote: value,
              }))
            }
          />
        </div>
        <button
          type="button"
          onClick={() => onSaveCarePlan(carePlanDraft)}
          className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Save care plan
        </button>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Data sharing settings</h3>
        <p className="mt-2 text-sm text-slate-500">
          Patient consent controls what is shared in this prototype.
        </p>

        <div className="mt-4 space-y-3">
          <ToggleOption
            checked={sharingPreferences.shareDailyCheckInsWithClinician}
            label="Share daily check-ins with clinician"
            onChange={(value) =>
              setSharingPreferences((current) => ({
                ...current,
                shareDailyCheckInsWithClinician: value,
              }))
            }
          />
          <ToggleOption
            checked={sharingPreferences.shareWearableSummariesWithClinician}
            label="Share wearable summaries with clinician"
            onChange={(value) =>
              setSharingPreferences((current) => ({
                ...current,
                shareWearableSummariesWithClinician: value,
              }))
            }
          />
          <ToggleOption
            checked={sharingPreferences.sharePhoneBehaviorSummariesWithClinician}
            label="Share phone behavior summaries with clinician"
            onChange={(value) =>
              setSharingPreferences((current) => ({
                ...current,
                sharePhoneBehaviorSummariesWithClinician: value,
              }))
            }
          />
          <ToggleOption
            checked={sharingPreferences.allowAIToFlagConcerningPatterns}
            label="Allow AI to flag concerning patterns"
            onChange={(value) =>
              setSharingPreferences((current) => ({
                ...current,
                allowAIToFlagConcerningPatterns: value,
              }))
            }
          />
          <ToggleOption
            checked={sharingPreferences.allowClinicianToSeeAISummaries}
            label="Allow clinician to see AI summaries"
            onChange={(value) =>
              setSharingPreferences((current) => ({
                ...current,
                allowClinicianToSeeAISummaries: value,
              }))
            }
          />
        </div>

        <button
          type="button"
          onClick={() => onUpdateSharingPreferences(sharingPreferences)}
          className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Save sharing settings
        </button>
      </section>
    </div>
  );
}

interface HelpActionProps {
  description?: string;
  icon: typeof CircleAlert;
  label: string;
  onClick: () => void;
}

function HelpAction({ description, icon: Icon, label, onClick }: HelpActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <Icon className="h-4 w-4 text-sky-600" />
        {label}
      </div>
      {description ? <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p> : null}
    </button>
  );
}

function TextAreaRow({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
      />
    </div>
  );
}

function ToggleOption({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-sky-600" : "bg-slate-300"
        }`}
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
