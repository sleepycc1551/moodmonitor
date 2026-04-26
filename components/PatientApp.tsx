"use client";

import { Bot, ChartNoAxesCombined, HeartHandshake, House } from "lucide-react";
import { AIAssistant } from "@/components/AIAssistant";
import { SupportCarePlan } from "@/components/SupportCarePlan";
import { TestUserDatabase } from "@/components/TestUserDatabase";
import { TodayCheckIn } from "@/components/TodayCheckIn";
import { TrendsPage } from "@/components/TrendsPage";
import type {
  AppointmentReason,
  CarePlan,
  DailyCheckIn,
  PatientRecord,
  SharingPreferences,
  TestUserScenarioInput,
} from "@/types";

export type PatientTab = "today" | "trends" | "assistant" | "support";

interface PatientAppProps {
  activeTab: PatientTab;
  aiLoading: boolean;
  latestNotificationMessage?: string;
  onAddTestUser: (input: TestUserScenarioInput) => void;
  onGeneratePhoneData: () => void;
  onGenerateWearableData: () => void;
  onLoadPatient: (patientId: string) => void;
  onRequestAppointment: (reason: AppointmentReason, note: string) => void;
  onRequestClinicianCheckIn: () => void;
  onResetMockData: () => void;
  onSaveCarePlan: (carePlan: CarePlan) => void;
  onSendAssistantMessage: (message: string) => Promise<void>;
  onSetTab: (tab: PatientTab) => void;
  onSubmitCheckIn: (
    values: Omit<DailyCheckIn, "id" | "patientId" | "timestamp">,
  ) => void;
  onUpdateSharingPreferences: (preferences: SharingPreferences) => void;
  onUpdateTestUser: (patientId: string, input: TestUserScenarioInput) => void;
  patient: PatientRecord;
  patients: PatientRecord[];
}

export function PatientApp({
  activeTab,
  aiLoading,
  latestNotificationMessage,
  onAddTestUser,
  onGeneratePhoneData,
  onGenerateWearableData,
  onLoadPatient,
  onRequestAppointment,
  onRequestClinicianCheckIn,
  onResetMockData,
  onSaveCarePlan,
  onSendAssistantMessage,
  onSetTab,
  onSubmitCheckIn,
  onUpdateSharingPreferences,
  onUpdateTestUser,
  patient,
  patients,
}: PatientAppProps) {
  const latestNotification = patient.notifications.find((notification) => !notification.read);

  return (
    <div className="space-y-6">
      <TestUserDatabase
        currentPatientId={patient.profile.id}
        key={patient.profile.id}
        onAddTestUser={onAddTestUser}
        onLoadPatient={onLoadPatient}
        onResetMockData={onResetMockData}
        onUpdateTestUser={onUpdateTestUser}
        patients={patients}
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="flex min-h-[720px] flex-col rounded-[2.5rem] border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Patient app
                </p>
                <h1 className="text-xl font-semibold text-slate-950">{patient.profile.name}</h1>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                Local prototype
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {activeTab === "today" ? (
              <TodayCheckIn
                latestNotification={latestNotification}
                onGeneratePhoneData={onGeneratePhoneData}
                onGenerateWearableData={onGenerateWearableData}
                onSubmitCheckIn={onSubmitCheckIn}
                patient={patient}
                submissionMessage={latestNotificationMessage}
              />
            ) : null}
            {activeTab === "trends" ? <TrendsPage patient={patient} /> : null}
            {activeTab === "assistant" ? (
              <AIAssistant
                isLoading={aiLoading}
                onSendMessage={onSendAssistantMessage}
                patient={patient}
              />
            ) : null}
            {activeTab === "support" ? (
              <SupportCarePlan
                onOpenAssistant={() => onSetTab("assistant")}
                onRequestAppointment={onRequestAppointment}
                onRequestClinicianCheckIn={onRequestClinicianCheckIn}
                onSaveCarePlan={onSaveCarePlan}
                onUpdateSharingPreferences={onUpdateSharingPreferences}
                patient={patient}
              />
            ) : null}
          </div>

          <nav className="grid grid-cols-4 border-t border-slate-200 px-3 py-3">
            <BottomTab
              active={activeTab === "today"}
              icon={House}
              label="Today"
              onClick={() => onSetTab("today")}
            />
            <BottomTab
              active={activeTab === "trends"}
              icon={ChartNoAxesCombined}
              label="Trends"
              onClick={() => onSetTab("trends")}
            />
            <BottomTab
              active={activeTab === "assistant"}
              icon={Bot}
              label="AI Assistant"
              onClick={() => onSetTab("assistant")}
            />
            <BottomTab
              active={activeTab === "support"}
              icon={HeartHandshake}
              label="Support"
              onClick={() => onSetTab("support")}
            />
          </nav>
        </section>

        <section className="space-y-4">
          <div className="rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_#dbeafe,_#ffffff_55%,_#f8fafc)] p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-950">
              Patient app workspace
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              The active test user controls the patient-facing name, check-ins, simulated wearable
              data, phone summaries, AI assistant context, appointment requests, and clinician
              messages.
            </p>
          </div>

          <details className="rounded-[2rem] border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Safety and privacy notes
            </summary>
            <ul className="mt-3 space-y-2">
              <li>- This is a prototype and not a medical device.</li>
              <li>- The system does not diagnose or replace a clinician.</li>
              <li>- Emergency services are not actually contacted.</li>
              <li>- Private content is not shown; only behavioral summaries are used.</li>
              <li>- Patient consent controls what data is shared.</li>
              <li>- AI recommendations are decision support only.</li>
            </ul>
          </details>
        </section>
      </div>
    </div>
  );
}

function BottomTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof House;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs font-medium transition ${
        active ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
