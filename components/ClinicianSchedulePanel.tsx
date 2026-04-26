"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  Clock3,
  Info,
  MessageSquareMore,
  TimerReset,
} from "lucide-react";
import { MiniSparkline, MiniTrendChart } from "@/components/Charts";
import {
  buildConcernTrendChart,
  buildPatientSparklineSeries,
  isConcernTrendConcerning,
  type PendingAppointmentItem,
  type TodayAppointmentItem,
} from "@/lib/clinician";
import { formatDateTime, formatLongDate, formatTime } from "@/lib/dateFormat";
import { formatConcernLabel } from "@/lib/riskEngine";

interface ClinicianSchedulePanelProps {
  onApproveAppointment: (patientId: string, requestId: string) => void;
  onMarkRequestReviewed: (patientId: string, requestId: string) => void;
  onRequestMoreInformation: (patientId: string, requestId: string) => void;
  onSelectPatient: (patientId: string) => void;
  pendingRequests: PendingAppointmentItem[];
  todayAppointments: TodayAppointmentItem[];
}

export function ClinicianSchedulePanel({
  onApproveAppointment,
  onMarkRequestReviewed,
  onRequestMoreInformation,
  onSelectPatient,
  pendingRequests,
  todayAppointments,
}: ClinicianSchedulePanelProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Schedule and requests
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              {formatLongDate(now)}
            </h2>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Current time
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {formatTime(now)}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-sky-600" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Upcoming appointments</h3>
            <p className="text-sm text-slate-500">Today&apos;s scheduled appointments and follow-up slots.</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {todayAppointments.length ? (
            todayAppointments.map(({ appointment, patient }) => (
              <button
                key={appointment.id}
                type="button"
                onClick={() => onSelectPatient(patient.profile.id)}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{patient.profile.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatTime(appointment.scheduledFor)}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${concernBadgeClass(appointment.concernLevel)}`}>
                    {formatConcernLabel(appointment.concernLevel)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-700">{appointment.reason}</p>
                <div className="mt-3 rounded-2xl bg-white p-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    AI concern trend
                  </div>
                  <MiniTrendChart
                    alarming={isConcernTrendConcerning(patient)}
                    baseline={3}
                    color="#2563eb"
                    data={buildConcernTrendChart(patient)}
                    dataKey="value"
                  />
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No appointments are scheduled for today yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <TimerReset className="h-5 w-5 text-amber-600" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900">New appointment requests from app</h3>
            <p className="text-sm text-slate-500">
              Requests submitted by patients through the support page.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {pendingRequests.length ? (
            pendingRequests.map(({ patient, request }) => (
              <div
                key={request.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{patient.profile.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Submitted {formatDateTime(request.createdAt)}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${concernBadgeClass(patient.latestRisk.concernLevel)}`}>
                    {formatConcernLabel(patient.latestRisk.concernLevel)}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div>
                    <span className="font-medium text-slate-900">Reason:</span> {request.reason}
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">Patient note:</span>{" "}
                    {request.note || "No note provided."}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => onApproveAppointment(patient.profile.id, request.id)}
                    className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-medium text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestMoreInformation(patient.profile.id, request.id)}
                    className="inline-flex items-center justify-center gap-1 rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                  >
                    <MessageSquareMore className="h-3.5 w-3.5" />
                    Request more information
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkRequestReviewed(patient.profile.id, request.id)}
                    className="inline-flex items-center justify-center gap-1 rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                  >
                    <Info className="h-3.5 w-3.5" />
                    Mark as reviewed
                  </button>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    Mini trend
                  </div>
                  <MiniSparkline
                    color="#2563eb"
                    data={buildPatientSparklineSeries(
                      patient.checkIns.slice(-6).map((entry) => entry.mood),
                    )}
                    dataKey="value"
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No pending appointment requests.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function concernBadgeClass(level: "stable" | "watch" | "elevated" | "urgent"): string {
  if (level === "urgent") return "bg-red-50 text-red-800 ring-1 ring-red-200";
  if (level === "elevated") return "bg-orange-50 text-orange-800 ring-1 ring-orange-200";
  if (level === "watch") return "bg-sky-50 text-sky-800 ring-1 ring-sky-200";
  return "bg-teal-50 text-teal-800 ring-1 ring-teal-200";
}
