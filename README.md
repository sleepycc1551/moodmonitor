# MoodWatch JAT Prototype

Research prototype for a graduate Cognitive Engineering / Human-Machine Teaming project focused on large-scale monitoring of patients at risk of bipolar mood decompensation.

This system is intentionally a simulation and interface prototype. It is not intended for medical deployment or real clinical use.

## What is included

- Care-team dashboard for monitoring up to 60 synthetic patients.
- JAT controls for:
  - AI support condition (`No AI`, `AI score only`, `Full AI + coordination`)
  - patient-load manipulation
  - ground-truth overlay
  - human action logging and CSV export
- Patient detail screen with:
  - summary
  - risk level
  - recommended action
  - top contributing factors
  - uncertainty and missing information
  - human-review triggers
- Patient-facing check-in flow that updates the monitoring picture.
- Real-time server-side Gemini recommendation endpoint with a fallback research heuristic when no API key is configured.

## Tech stack

- React + Vite
- Tailwind CSS
- Express
- Google GenAI SDK (`@google/genai`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
copy .env.example .env
```

3. Add your Gemini API key to `.env`:

```env
GEMINI_API_KEY=your_google_ai_studio_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=8787
```

4. Start the prototype:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`.
Backend runs on `http://localhost:8787`.

## Recommended JAT sharing approach

If you want other participants to use the system, the easiest setup is:

1. Deploy one hosted copy of the app.
2. Put your Gemini API key on the server only.
3. Send participants the study URL.

That way, participants only need a browser. They do not need to install Node, npm, or any local dependencies.

## Build

```bash
npm run build
npm start
```

`npm start` serves the API and the built frontend from the same Express server.

## Deploy without participant setup

This repo now includes:

- [Dockerfile](C:/Users/30242/codex/Dockerfile)
- [.dockerignore](C:/Users/30242/codex/.dockerignore)
- [render.yaml](C:/Users/30242/codex/render.yaml)

### Option 1: Deploy to Render

1. Push this repo to GitHub.
2. Create a new Blueprint service in Render from the repo.
3. Render will read `render.yaml`.
4. Add `GEMINI_API_KEY` in the Render dashboard.
5. Deploy and share the resulting URL with participants.

### Option 2: Run with Docker

```bash
docker build -t moodwatch-jat .
docker run -p 8787:8787 --env-file .env moodwatch-jat
```

Then participants can open `http://<your-machine-or-server>:8787` if your network setup allows access.

## Notes on Gemini integration

- The API key is used only on the server.
- If `GEMINI_API_KEY` is missing, the app still works using a rule-based fallback model.
- The live refresh buttons are:
  - `Refresh visible with Gemini` on the dashboard
  - `Refresh recommendation` on the patient detail page

## JAT-oriented features retained

- Variable AI observability by condition
- Human override with urgency rating and optional rationale
- Action log export for later analysis
- Hidden ground truth for retrospective comparison
- Overload manipulation through patient-load scaling
- Patient participation through the check-in app

## Important reminder

All patient records in this prototype are fictional and synthetic. The output of the AI is decision support for coursework only.
