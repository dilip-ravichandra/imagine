export interface ApiError {
  code?: string;
  message: string;
  retryable?: boolean;
  suggested_action?: string;
}

export interface GenerateResponse {
  status: 'success';
  request_id: string;
  image_url: string;
  generation: {
    model: string;
    model_revision: string;
    precision: string;
    scheduler: string;
    steps: number;
    width: number;
    height: number;
    seed: number;
  };
  performance?: {
    end_to_end_ms?: number;
    peak_gpu_mb?: number;
  };
  resource_decision: {
    fallback_used: boolean;
    reason?: string;
    explanation: string;
  };
}

export interface MultiModelResponse {
  status: 'success';
  request_id: string;
  image_url: string;
  model: string;
  model_choice: string;
  precision: string;
  steps: number;
  seed: number;
  resolution: number;
  latency_ms: number;
  peak_gpu_mb: number;
}

export interface ModelCatalogueEntry {
  id: string;
  display_name: string;
  task: string;
  role: string;
  checkpoint: string;
  license_reference: string;
  quality_modes: string[];
  available: boolean;
  availability_reason: string;
  configured: boolean;
}

export interface VisionReview {
  winner: 'A' | 'B' | 'TIE';
  confidence: number;
  prompt_accuracy_A: number;
  prompt_accuracy_B: number;
  anatomy_A: number;
  anatomy_B: number;
  artifacts_A: string[];
  artifacts_B: string[];
  objects_correct_A: boolean;
  objects_correct_B: boolean;
  reason: string;
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let error: ApiError = { message: `Request failed with status ${response.status}.` };
    try {
      const body = await response.json();
      error = body.error || body;
    } catch {
      // Preserve the HTTP status when the server does not return JSON.
    }
    throw new Error(error.message || `Request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export function generateImage(input: {
  prompt: string;
  qualityMode: 'quick' | 'balanced' | 'best';
  resolution?: number;
  seed?: number;
}): Promise<GenerateResponse> {
  return request<GenerateResponse>('/v1/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function generateWithModel(input: {
  prompt: string;
  modelChoice: 'sd_turbo' | 'sd15_baseline' | 'sd15_optimized' | 'sd15_adapted';
  resolution?: number;
  seed?: number;
  steps?: number;
}): Promise<MultiModelResponse> {
  return request<MultiModelResponse>('/v1/generate/multimodel', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      model_choice: input.modelChoice,
      resolution: input.resolution || 512,
      seed: input.seed,
      steps: input.steps,
    }),
  });
}

export function analyzePrompt(prompt: string) {
  return request('/v1/prompt/analysis', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export function getMetricsSummary() {
  return request('/v1/metrics/summary');
}

export function getModelCatalogue() {
  return request<{ models: ModelCatalogueEntry[] }>('/v1/models');
}

export function sendChat(messages: { role: 'user' | 'assistant'; content: string }[]) {
  return request<{ message: string; model: string }>('/v1/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

export function reviewImagePair(input: {
  prompt: string;
  imageA: string;
  imageB: string;
}): Promise<VisionReview> {
  return request<VisionReview>('/v1/review/pair', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      image_a: input.imageA,
      image_b: input.imageB,
    }),
  });
}
