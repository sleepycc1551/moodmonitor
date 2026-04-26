import { createInitialPrototypeState } from "@/lib/mockData";
import type { PrototypeState } from "@/types";

const STORAGE_KEY = "moodwatch-research-prototype-v2";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizePrototypeState(state: PrototypeState): PrototypeState {
  if (!state.patients?.length) {
    return createInitialPrototypeState();
  }

  const selectedPatientId =
    state.selectedPatientId ??
    state.primaryPatientId ??
    state.selectedClinicianPatientId ??
    state.patients[0].profile.id;

  const selectedPatientExists = state.patients.some(
    (patient) => patient.profile.id === selectedPatientId,
  );
  const safeSelectedPatientId = selectedPatientExists
    ? selectedPatientId
    : state.patients[0].profile.id;

  const clinicianPatientExists = state.patients.some(
    (patient) => patient.profile.id === state.selectedClinicianPatientId,
  );

  return {
    ...state,
    setupComplete: true,
    primaryPatientId: state.primaryPatientId ?? safeSelectedPatientId,
    selectedPatientId: safeSelectedPatientId,
    selectedClinicianPatientId: clinicianPatientExists
      ? state.selectedClinicianPatientId
      : safeSelectedPatientId,
    clinicianAiEnabled: state.clinicianAiEnabled ?? true,
    evaluationLog: state.evaluationLog ?? [],
    jatSubmissions: state.jatSubmissions ?? [],
    updatedAt: state.updatedAt ?? new Date().toISOString(),
  };
}

export function loadPrototypeState(): PrototypeState {
  if (!isBrowser()) {
    return createInitialPrototypeState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return normalizePrototypeState(createInitialPrototypeState());
  }

  try {
    return normalizePrototypeState(JSON.parse(raw) as PrototypeState);
  } catch {
    return normalizePrototypeState(createInitialPrototypeState());
  }
}

export function savePrototypeState(state: PrototypeState): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearPrototypeState(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export { STORAGE_KEY };
