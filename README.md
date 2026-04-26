# MoodWatch Research Prototype

MoodWatch is a local full-stack research prototype for a graduate Cognitive Engineering / Human-Machine Teaming project. It simulates an AI-assisted proactive and preventive health management system for people at risk of bipolar mood episodes.

This app is for simulation, interface design, and Joint Activity Testing only.

It is **not** a medical device, does **not** diagnose, and does **not** contact real emergency services.

## What the prototype includes

- `Patient App`
  - test user database and active patient selector
  - daily self-report check-ins
  - simulated wearable summaries
  - simulated privacy-preserving phone behavior summaries
  - patient-facing trends and charts
  - Gemini-powered patient AI assistant with patient-safe, non-diagnostic responses
  - support, appointment request, care plan, and data sharing controls
- `Clinician App`
  - desktop-style three-column dashboard
  - schedule and appointment request column
  - risk-ranked patient overview with sorting and filters
  - Gemini-powered clinician care coordination assistant with AI ON / OFF toggle
  - simulated patient cohort plus the patient created in setup
  - detailed patient review panel with charts and baseline comparisons
  - clinician action workflows: review, message, follow-up, appointment approval, escalation, override
  - human override of AI-estimated concern
  - local evaluation logging with JSON export
  - patient notifications fed back into the patient interface
- Shared local state
  - patient and clinician views stay connected through browser local storage
  - storage updates also sync across open tabs for the same app origin
- Prototype safety framing
  - visible reminders that the system is not diagnostic
  - AI is framed as decision support only
  - only behavioral summaries are shown, not private content

## Tech stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Recharts
- Google Gemini via `@google/genai`

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

Copy the example file:

```bash
cp .env.local.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

Then add your Gemini key:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_SHOW_FACILITATOR_TOOLS=false
```

Notes:

- Do not hard-code the API key.
- The app reads the key server-side from `.env.local`.
- If you have an older `.env` from a previous prototype, `.env.local` should be the file you update for this Next.js app.
- Leave `NEXT_PUBLIC_SHOW_FACILITATOR_TOOLS` unset or `false` for public tester sessions. Set it to exactly `true` only for facilitator/debug sessions where ground truth should be visible.

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build check

```bash
npm run lint
npm run build
```

## Project structure

```text
app/
  api/gemini/route.ts
  globals.css
  layout.tsx
  page.tsx
components/
  AIAssistant.tsx
  CareCoordinationAssistant.tsx
  Charts.tsx
  ClinicianApp.tsx
  ClinicianDashboard.tsx
  ClinicianSchedulePanel.tsx
  EvaluationPanel.tsx
  PatientApp.tsx
  PatientDetail.tsx
  PrototypeShell.tsx
  SetupScreen.tsx
  SupportCarePlan.tsx
  TestUserDatabase.tsx
  TodayCheckIn.tsx
  TrendsPage.tsx
lib/
  clinician.ts
  dateFormat.ts
  geminiPrompt.ts
  jatMetrics.ts
  mockData.ts
  riskEngine.ts
  storage.ts
types/
  index.ts
```

## How the patient-clinician connection works

The prototype uses browser local storage as a shared local state layer. Both top-level interfaces live in the same Next.js app and read/write the same persisted prototype state.

That means you can:

1. Open the app and choose a simulated patient in `Patient App > Test User Database`.
2. Click `Load user` to make that patient active in the Patient App.
3. Submit a patient check-in or request an appointment.
3. Switch to `Clinician App` from the top navigation.
4. See the patient appear in the clinician dashboard alongside simulated patients.
5. Review the patient in the clinician detail panel, send a clinician message, approve an appointment request, or request a follow-up check-in.
6. Switch back to `Patient App` and see the notification card.

Use `Reset mock data` in the Patient App test-user panel to restore the default simulated cohort without manually clearing browser storage.

## How to test the main workflow

### 1. Select or create a test user

- Start the app.
- In `Patient App`, use `Test User Database`.
- Select an existing simulated user and click `Load user`.
- Or click `Add test user` to create a new local test user.
- Use `Edit user data` to change profile fields, baseline values, concern level, key reason, and simulated data.

### 2. Submit a daily check-in

- Stay in `Patient App > Today`.
- Fill out the sliders and sleep field.
- Optionally add a note.
- Click `Submit check-in`.

You should see a friendly confirmation message, and the clinician dashboard will receive the updated record.

### 3. Generate simulated data

- In `Today`, click `Generate new simulated wearable data`.
- Click `Generate new simulated phone data`.

These are useful for testing unusual-pattern scenarios.

### 4. Open the clinician dashboard

- Use the top navigation to switch to `Clinician App`.
- The desktop clinician workspace should show:
  - `Schedule and requests` on the left
  - `Patient Overview` in the middle
  - `Care Coordination Assistant` and `Evaluation Mode` on the right
- The simulated cohort includes 10 test-ready cases:
  - correct stable baseline
  - mild sleep concern with appointment request
  - elevated low-sleep/high-energy pattern
  - urgent safety-related case
  - AI underestimate with missing wearable data
  - AI overestimate from night-shift/deadline context
  - privacy-limited self-report case
  - sensor artifact/travel case
  - ambiguous multi-signal elevated case
  - mixed/uncertain watch case
- Click any patient card to open a dedicated detailed patient view, then use `Back to Clinician Dashboard` to return.

### 5. Send a clinician message back to the patient

- Select the created patient in the dashboard.
- In the detailed patient panel, click `Send message`.
- Submit a message from the modal.
- Switch back to `Patient App > Today`.

You should see a notification card with the care-team message.

### 6. Test appointment request handling

- In `Patient App > Support / Care Plan`, submit an appointment request.
- Switch to `Clinician App`.
- In the left column under `New appointment requests from app`, use:
  - `Approve`
  - `Request more information`
  - `Mark as reviewed`

If approved, the request becomes a scheduled appointment and the patient receives a notification.

### 7. Test clinician override / human-in-the-loop review

- Open a patient with `watch`, `elevated`, or `urgent` AI-estimated concern.
- In the detailed patient panel, click `Change concern level`.
- Select a clinician-confirmed concern level.
- Choose a reason for override.
- Optionally add a note.
- Save the override.

The patient detail view will show both AI-estimated concern and clinician-confirmed concern, and the action is logged in the evaluation history.

## Test evaluation workflow

The default mock data now includes ground-truth metadata for 10 fictional patient cases. Each case has a true concern score, AI-estimated concern score, correct action, challenge tags, challenge scores, scenario purpose, and clinician-safe daily notes.

During a tester session:

1. Use `Reset mock data` to restore the 10-case cohort.
2. Switch to `Clinician App`.
3. Open a patient card.
4. Review the detail panels.
5. Complete `Submit test judgment` with concern score, action, confidence, AI agreement, and optional reasoning note.
6. Keep `Facilitator View` hidden during testing.
7. Use `Evaluation Mode` to export `Export test results` JSON or `Export CSV`.

The export includes patient ground truth, AI estimates, tester submissions, computed error metrics, challenge dimensions, and raw interaction logs. The forced mock AI assessments are stored with each test case so intentionally misleading or incomplete AI estimates are not overwritten by the rule-based risk engine.

### 8. Test AI assistance ON / OFF

- In the right column, toggle `AI assistance` ON and OFF.

When AI is ON:

- AI-estimated concern is visible in the patient overview.
- AI rationale appears in the detailed view.
- The care coordination assistant is active.

When AI is OFF:

- AI concern and recommendation content is hidden.
- The overview falls back to manual review mode.
- Raw shared patient data remains visible.

### 9. Export the evaluation log

- In the right column, open `Evaluation Mode`.
- Click `Export Evaluation Log`.

This downloads a local JSON file containing dashboard-open, patient-open, review, override, appointment-processing, and assistant-query events.

## How to test the Gemini chatbot

### 1. Confirm `.env.local` is set

Use:

```env
GEMINI_API_KEY=your_real_key
```

### 2. Start the dev server

```bash
npm run dev
```

### 3. Open the AI assistant

- Go to `Patient App > AI Assistant`.
- Send a message like:
  - `I had a hard day and I only slept 4 hours.`
  - `My energy feels much higher than usual and I keep checking my phone at night.`

The assistant route sends the following context to `/api/gemini`:

- user message
- patient profile
- recent check-ins
- latest wearable summary
- latest phone behavior summary
- current risk summary
- mode: `patient`

### 4. Test clinician flagging

If Gemini returns `flagForClinician: true`, the app adds a clinician alert and a patient-side notification about suggested care-team review.

If Gemini is unavailable or no key is configured, the route falls back to a rule-based assistant response so the prototype still works locally.

## Gemini assistant modes

The project now uses two separate Gemini prompt systems in [lib/geminiPrompt.ts](C:/Users/30242/codex/lib/geminiPrompt.ts):

- `PATIENT_ASSISTANT_SYSTEM_PROMPT`
- `CLINICIAN_ASSISTANT_SYSTEM_PROMPT`

The shared route is [app/api/gemini/route.ts](C:/Users/30242/codex/app/api/gemini/route.ts), and it accepts:

- `mode: "patient"`
- `mode: "clinician"`

### Patient AI Assistant

- Warm, supportive, non-diagnostic daily reflection assistant
- Uses patient-facing language about changes from baseline
- Does not diagnose
- Does not provide medication advice
- Can flag the clinician dashboard when concerning patterns appear

### Clinician Care Coordination Assistant

- Clinician-facing triage and coordination assistant
- Summarizes patient status, appointment requests, missing data, and change-from-baseline patterns
- Can draft a supportive patient message
- Does not replace clinician judgment
- Does not show raw private diary text by default

### Privacy and safety notes

Both assistants are designed for prototype use only:

- They are non-diagnostic.
- They are privacy-preserving.
- Raw diary text, search text, transaction details, and unrelated personal details should not be shown to clinicians by default.
- If Gemini fails or returns malformed output, the route falls back to a safe JSON response instead of crashing the UI.

## How to simulate a higher-risk scenario

### Option 1: Edit a scenario directly

In `Patient App > Test User Database`, click `Edit user data` and set values like:

- `Current concern level`: `Elevated`
- `Key reason`: `Low sleep plus high energy and increased nighttime phone use`
- `Latest hours slept`: `3.5` to `4.5`
- `Latest energy`: `8` to `10`
- `Nighttime phone use`: `90` to `140`

This is the fastest way to prepare repeatable test cases without clearing local storage.

### Option 2: Check-in pattern change

In `Patient App > Today`, submit a check-in with values like:

- `Hours slept`: `3.5` to `4.5`
- `Energy`: `8` to `10`
- `Impulsivity`: `7` to `10`
- `Sleep quality`: `2` to `4`
- optional note: `Sleeping much less than usual and still feeling very activated.`

Then generate new simulated phone data a few times until you see higher nighttime phone use and screen time.

This should move the rule-based concern logic toward `elevated`.

You can then switch to the clinician dashboard and verify:

- the patient sorts higher in `Patient Overview`
- the detailed patient view shows stronger change-from-baseline rationale
- the care coordination assistant can surface the patient in `Highest concern patients`

### Option 3: Urgent safety language

In `Patient App > AI Assistant`, send a message like:

```text
I do not feel safe tonight and need help.
```

For this prototype:

- the assistant will show a crisis-oriented support message
- the case will be marked `urgent`
- a clinician alert will be created

The prototype still does **not** contact real emergency services.

## Risk logic

The prototype uses a simple non-diagnostic rule engine in [lib/riskEngine.ts](C:/Users/30242/codex/lib/riskEngine.ts).

It classifies:

- `stable`
- `watch`
- `elevated`
- `urgent`

Inputs include:

- sleep duration and sleep quality
- mood, energy, anxiety, irritability, impulsivity
- nighttime phone use, screen time, spending app visits
- self-harm or immediate-danger language in notes or chat

Outputs include:

- concern level
- change-from-baseline score
- key reasons
- evidence strength
- data quality summary
- patient-facing summary
- clinician-facing summary
- recommended action

## Safety and ethics notes in the UI

The interface explicitly communicates that:

1. This is a prototype and not a medical device.
2. The system does not diagnose.
3. AI recommendations are decision support only.
4. Emergency services are not actually contacted in this prototype.
5. Patient consent controls what data is shared.
6. Private content is not shown; only behavioral summaries are used.

## Suggested test demo flow

For a class demo or participant session, a simple script is:

1. Select a patient in `Test User Database` and click `Load user`.
2. Use `Edit user data` to set the scenario, or submit a new `Today` check-in.
3. Generate wearable and phone summaries.
4. Open `Trends` and explain baseline-relative language.
5. Ask the `AI Assistant` about the unusual pattern.
6. Trigger a clinician flag.
7. Switch to `Clinician App`.
8. Show the left-column requests and the middle-column triage cards.
9. Toggle AI assistance OFF, then ON again, to demonstrate comparison conditions.
10. Open a dedicated detailed patient view and review the rationale, raw trends, and communication history.
11. Return with `Back to Clinician Dashboard`.
12. Save a clinician override.
13. Send a supportive clinician message or approve an appointment request.
14. Switch back to the patient view and show the returned notification.
15. Export the evaluation log.

## Files to edit most often

- [app/api/gemini/route.ts](C:/Users/30242/codex/app/api/gemini/route.ts): Gemini server route
- [lib/clinician.ts](C:/Users/30242/codex/lib/clinician.ts): clinician summaries, scheduling helpers, assistant rules, and evaluation summaries
- [lib/riskEngine.ts](C:/Users/30242/codex/lib/riskEngine.ts): rule-based trend and concern logic
- [lib/mockData.ts](C:/Users/30242/codex/lib/mockData.ts): simulated patients and simulated sensor data
- [components/PrototypeShell.tsx](C:/Users/30242/codex/components/PrototypeShell.tsx): top-level state orchestration
- [components/PatientApp.tsx](C:/Users/30242/codex/components/PatientApp.tsx): patient-side shell
- [components/TestUserDatabase.tsx](C:/Users/30242/codex/components/TestUserDatabase.tsx): test user selection and scenario editing
- [components/ClinicianApp.tsx](C:/Users/30242/codex/components/ClinicianApp.tsx): clinician-side shell
- [components/PatientDetail.tsx](C:/Users/30242/codex/components/PatientDetail.tsx): expanded desktop patient review panel
