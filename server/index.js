import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import {
  buildFallbackRecommendation,
  normalizeRecommendation,
} from "../shared/researchModel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

function readRuntimeConfig() {
  dotenv.config({ override: true });
  const env = globalThis.process?.env ?? {};
  return {
    port: Number(env.PORT || 8787),
    geminiModel: env.GEMINI_MODEL || "gemini-2.5-flash",
    geminiApiKey: env.GEMINI_API_KEY?.trim() || "",
  };
}

const { port } = readRuntimeConfig();

const recommendationSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    score: { type: "integer", minimum: 0, maximum: 100 },
    riskLevel: {
      type: "string",
      enum: ["Stable", "Watch", "Elevated", "Urgent Review"],
    },
    recommendedAction: {
      type: "string",
      enum: [
        "no-action",
        "auto-checkin",
        "manual-outreach",
        "clinician-review",
        "urgent-escalation",
      ],
    },
    confidence: {
      type: "string",
      enum: ["low", "moderate", "high"],
    },
    trend: {
      type: "string",
      enum: [
        "improving",
        "stable",
        "worsening",
        "unknown",
        "mixed-signals",
        "mild-worsening",
        "increasing",
        "decreasing",
        "slight-increase",
        "slight-decrease",
      ],
    },
    topFactors: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4,
    },
    uncertainty: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
    missingInfo: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
    needsHumanReview: { type: "boolean" },
    humanReviewReasons: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
  },
  required: [
    "summary",
    "score",
    "riskLevel",
    "recommendedAction",
    "confidence",
    "trend",
    "topFactors",
    "uncertainty",
    "missingInfo",
    "needsHumanReview",
    "humanReviewReasons",
  ],
};

const systemInstruction = `
You are an AI teammate inside a graduate-level human-machine teaming research prototype.

Your role is decision support for synthetic bipolar mood monitoring scenarios. You are not diagnosing, prescribing, or autonomously managing care.

You must:
- summarize recent condition,
- identify concerning trends,
- assign one risk level: Stable, Watch, Elevated, or Urgent Review,
- recommend one next action: no-action, auto-checkin, manual-outreach, clinician-review, or urgent-escalation,
- explain top contributing factors,
- state uncertainty and missing information,
- explicitly flag when human review is especially necessary.

Safety and scope rules:
- Treat this as a simulation and interface prototype only.
- Do not claim a definitive diagnosis.
- Prefer stronger human-review language when data is incomplete, mixed, contradictory, or potentially safety-relevant.
- Use urgent-escalation only when the synthetic cues suggest immediate human attention is warranted.
- Keep the summary concise and operational for a care coordinator.
`.trim();

function stripPatientForModel(patient) {
  const {
    id,
    name,
    age,
    baseline,
    sleep,
    activity,
    hrv,
    phone,
    selfReport,
    medication,
    history,
    dataQuality,
    patientResponse,
    coordinator,
    escalation,
    communications,
    challengeTags,
  } = patient;

  return {
    id,
    name,
    age,
    baseline,
    sleep,
    activity,
    hrv,
    phone,
    selfReport,
    medication,
    history,
    dataQuality,
    patientResponse,
    coordinator,
    escalation,
    communications,
    challengeTags,
  };
}

function buildPrompt(patient) {
  const strippedPatient = stripPatientForModel(patient);
  return `
Assess the following synthetic patient for a research prototype care console.

Return structured JSON that matches the provided schema.

Action definitions:
- no-action: continue routine monitoring only
- auto-checkin: system-sent automated check-in
- manual-outreach: coordinator or nurse should contact the patient
- clinician-review: clinician should review the case soon
- urgent-escalation: immediate human attention and escalation workflow

Patient case:
${JSON.stringify(strippedPatient, null, 2)}
  `.trim();
}

async function assessPatient(patient, runtimeConfig = readRuntimeConfig()) {
  const fallback = buildFallbackRecommendation(patient);
  const updatedAt = new Date().toISOString();
  const aiClient = runtimeConfig.geminiApiKey
    ? new GoogleGenAI({ apiKey: runtimeConfig.geminiApiKey })
    : null;

  if (!aiClient) {
    return {
      patientId: patient.id,
      recommendation: fallback,
      meta: {
        source: "fallback",
        model: "research-heuristic",
        updatedAt,
      },
    };
  }

  try {
    const response = await aiClient.models.generateContent({
      model: runtimeConfig.geminiModel,
      contents: buildPrompt(patient),
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: recommendationSchema,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    const parsed = JSON.parse(response.text);
    const normalized = normalizeRecommendation(parsed, patient);

    return {
      patientId: patient.id,
      recommendation: normalized,
      meta: {
        source: "gemini",
        model: runtimeConfig.geminiModel,
        updatedAt,
      },
    };
  } catch (error) {
    return {
      patientId: patient.id,
      recommendation: fallback,
      meta: {
        source: "fallback",
        model: `research-heuristic`,
        updatedAt,
        error: error.message,
      },
    };
  }
}

async function assessBatch(patients) {
  const runtimeConfig = readRuntimeConfig();
  const results = new Array(patients.length);
  let nextIndex = 0;
  const workerCount = Math.min(3, patients.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < patients.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await assessPatient(patients[currentIndex], runtimeConfig);
    }
  });

  await Promise.all(workers);
  return results;
}

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  const runtimeConfig = readRuntimeConfig();
  response.json({
    ok: true,
    geminiConfigured: Boolean(runtimeConfig.geminiApiKey),
    model: runtimeConfig.geminiModel,
  });
});

app.post("/api/recommendation", async (request, response) => {
  const patient = request.body?.patient;
  if (!patient?.id) {
    response.status(400).json({ error: "A patient payload with an id is required." });
    return;
  }

  const result = await assessPatient(patient, readRuntimeConfig());
  response.json(result);
});

app.post("/api/recommendations/batch", async (request, response) => {
  const patients = request.body?.patients;
  if (!Array.isArray(patients) || patients.length === 0) {
    response.status(400).json({ error: "A non-empty patients array is required." });
    return;
  }

  const results = await assessBatch(patients);
  response.json({ results });
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
}

const server = app.listen(port, () => {
  const runtimeConfig = readRuntimeConfig();
  console.log(
    `MoodWatch server listening on http://localhost:${port} | Gemini configured: ${Boolean(runtimeConfig.geminiApiKey)}`,
  );
});

export default server;
