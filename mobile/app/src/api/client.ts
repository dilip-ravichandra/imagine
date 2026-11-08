// mobile/app/src/api/client.ts
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Resolve backend URL:
// - In Expo Go on Android emulator: 10.0.2.2 points to host machine localhost
// - On iOS simulator: localhost works
// - For physical devices you can set EXPO_PUBLIC_BACKEND_URL in app.json extra
export const getBackendUrl = (): string => {
  const envUrl = Constants?.manifest?.extra?.backendUrl as string | undefined;
  if (envUrl) return envUrl;
  // fallback defaults
  if (Platform.OS === 'android') return 'http://10.0.2.2:8080';
  return 'http://localhost:8080';
};

const BASE = getBackendUrl();

export async function fetchJson(path: string, options?: RequestInit) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`HTTP ${response.status}: ${txt}`);
  }
  return response.json();
}

// ------- Generation ----------------------------------------------------
export interface GeneratePayload {
  model_id: string;
  prompt: string;
  steps?: number;
  cfg_scale?: number;
  negative_prompt?: string;
}
export async function generateImage(payload: GeneratePayload) {
  return fetchJson('/api/v1/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ------- Inpaint ------------------------------------------------------
export interface InpaintPayload {
  model_id: string;
  image_id: string; // asset id stored in Gallery
  mask: { x: number; y: number; w: number; h: number };
  prompt: string;
}
export async function inpaint(payload: InpaintPayload) {
  return fetchJson('/api/v1/inpaint', { method: 'POST', body: JSON.stringify(payload) });
}

// ------- Speech -------------------------------------------------------
export async function transcribeAudio(fileUri: string) {
  const form = new FormData();
  // @ts-ignore – React Native FormData works with uri
  form.append('file', { uri: fileUri, name: 'audio.wav', type: 'audio/wav' } as any);
  const response = await fetch(`${BASE}/api/v1/transcribe`, {
    method: 'POST',
    body: form as any,
    headers: {}, // let fetch set multipart headers
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Transcribe failed: ${txt}`);
  }
  return response.json();
}

// ------- Translation ---------------------------------------------------
export async function translateText({ text, target_lang }: { text: string; target_lang: string }) {
  return fetchJson('/api/v1/translate', {
    method: 'POST',
    body: JSON.stringify({ text, target_lang }),
  });
}

// ------- Text‑to‑Speech ------------------------------------------------
export async function tts({ text, voice }: { text: string; voice?: string }) {
  return fetchJson('/api/v1/tts', {
    method: 'POST',
    body: JSON.stringify({ text, voice }),
  });
}

// ------- Chat (Groq) -------------------------------------------------
export async function chat(messages: { role: string; content: string }[]) {
  return fetchJson('/api/v1/chat', { method: 'POST', body: JSON.stringify({ messages }) });
}
