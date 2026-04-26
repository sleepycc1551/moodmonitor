"use client";

import { useState } from "react";
import { Bot, Send, ShieldAlert, User } from "lucide-react";
import { formatConcernLabel } from "@/lib/riskEngine";
import type { AIMessage, PatientRecord } from "@/types";

interface AIAssistantProps {
  isLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
  patient: PatientRecord;
}

export function AIAssistant({
  isLoading,
  onSendMessage,
  patient,
}: AIAssistantProps) {
  const [message, setMessage] = useState("");

  const latestMessages = patient.aiMessages.slice(-12);

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-sky-600" />
          <div>
            <h2 className="text-xl font-semibold text-slate-900">AI Assistant</h2>
            <p className="text-sm text-slate-500">
              A supportive companion that uses your recent summaries as context.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          This assistant does not diagnose, replace a clinician, or contact emergency services.
          If it notices a concerning change from your usual pattern, it may suggest contacting
          your care team.
        </div>

        <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
          Current prototype concern level:{" "}
          <strong className="text-slate-900">
            {formatConcernLabel(patient.latestRisk.concernLevel)}
          </strong>
          <p className="mt-1">{patient.latestRisk.patientFacingSummary}</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[24rem] space-y-4 overflow-y-auto p-5">
          {latestMessages.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
              Try describing your day, asking for grounding ideas, or asking whether your recent
              pattern looks different from usual.
            </div>
          ) : null}

          {latestMessages.map((entry) => (
            <MessageBubble key={entry.id} entry={entry} />
          ))}

          {isLoading ? (
            <div className="rounded-3xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
              The assistant is reviewing recent summaries...
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 p-4">
          <div className="flex gap-3">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-sky-500"
              placeholder="Describe your day or ask for support."
            />
            <button
              type="button"
              disabled={!message.trim() || isLoading}
              onClick={async () => {
                await onSendMessage(message.trim());
                setMessage("");
              }}
              className="self-end rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function MessageBubble({ entry }: { entry: AIMessage }) {
  const isAssistant = entry.role === "assistant";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
          isAssistant
            ? "border border-slate-200 bg-white text-slate-700"
            : "bg-slate-950 text-white"
        }`}
      >
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
          {isAssistant ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
          <span>{isAssistant ? "AI assistant" : "You"}</span>
          {entry.concernLevel ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] normal-case text-slate-600">
              {formatConcernLabel(entry.concernLevel)}
            </span>
          ) : null}
        </div>
        <p className="leading-6">{entry.content}</p>
        {entry.flagForClinician ? (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] text-amber-800">
            <ShieldAlert className="h-3.5 w-3.5" />
            Care team follow-up suggested
          </div>
        ) : null}
      </div>
    </div>
  );
}
