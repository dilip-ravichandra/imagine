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
  width?: number;
  height?: number;
  latency_ms: number;
  peak_gpu_mb: number;
}

export interface InpaintResponse {
  status: 'success';
  request_id: string;
  image_url: string;
  model: string;
  model_choice: string;
  precision: string;
  steps: number;
  seed: number;
  width: number;
  height: number;
  latency_ms: number;
  peak_gpu_mb: number;
  source_id?: string;
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

export interface CapabilitiesResponse {
  api_version: string;
  quality_modes: string[];
  min_resolution: number;
  max_resolution: number;
  generation_available: boolean;
  inpainting_available?: boolean;
  img2img_available?: boolean;
  deployment_mode: string;
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

export interface GalleryItem {
  id: string;
  image_url: string;
  prompt: string;
  category: 'single' | 'storybook' | 'inpaint';
  style: string;
  model: string;
  width: number;
  height: number;
  liked: boolean;
  source_id?: string;
  recreation_note?: string;
  timestamp: number;
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

/**
 * Normalizes full image URLs (e.g. http://localhost:8080/images/abc.png)
 * into same-origin paths (/images/abc.png) to leverage the local Vite proxy
 * and avoid CORS issues / canvas staining during inpainting.
 */
export function toSameOriginImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname.startsWith('/images/')) {
      return parsed.pathname;
    }
  } catch {
    // Relative URL already
  }
  return url;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/v1/auth/')) window.dispatchEvent(new Event('imagineai:unauth'));
    let errorMsg = `Request failed with status ${response.status}.`;
    try {
      const body = await response.json();
      if (body?.detail) {
        if (typeof body.detail === 'string') {
          errorMsg = body.detail;
        } else if (Array.isArray(body.detail)) {
          errorMsg = body.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        }
      } else if (body?.error?.message) {
        errorMsg = body.error.message;
      } else if (body?.message) {
        errorMsg = body.message;
      }
    } catch {
      // Preserve the HTTP status when the server does not return JSON.
    }
    throw new Error(errorMsg);
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
    body: JSON.stringify({
      prompt: input.prompt,
      quality_mode: input.qualityMode,
      resolution: input.resolution,
      seed: input.seed,
    }),
  });
}

export function enhancePrompt(prompt: string): Promise<{ prompt: string; model: string }> {
  return request<{ prompt: string; model: string }>('/v1/prompt/enhance', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export function generateWithModel(input: {
  prompt: string;
  modelChoice: 'sd_turbo' | 'sd15_baseline' | 'sd15_optimized' | 'sd15_adapted' | string;
  resolution?: number;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  category?: 'single' | 'storybook' | 'inpaint';
  style?: string;
  applyStyle?: boolean;
  negativePrompt?: string;
}): Promise<MultiModelResponse> {
  return request<MultiModelResponse>('/v1/generate/multimodel', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      model_choice: input.modelChoice,
      resolution: input.resolution || 512,
      width: input.width,
      height: input.height,
      seed: input.seed,
      steps: input.steps,
      category: input.category || 'single',
      style: input.style || 'Photorealistic',
      apply_style: input.applyStyle ?? true,
      negative_prompt: input.negativePrompt,
    }),
  });
}

export function generateInpaint(input: {
  prompt: string;
  imageBase64: string;
  maskBase64: string;
  modelChoice?: string;
  seed?: number;
  steps?: number;
  sourceId?: string;
  style?: string;
  recreationNote?: string;
  negativePrompt?: string;
  smartSelect?: boolean;
  harmonise?: boolean;
}): Promise<InpaintResponse> {
  return request<InpaintResponse>('/v1/generate/inpaint', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      image_base64: input.imageBase64,
      mask_base64: input.maskBase64,
      model_choice: input.modelChoice || 'sd_turbo',
      seed: input.seed,
      steps: input.steps,
      source_id: input.sourceId,
      style: input.style || 'Photorealistic',
      recreation_note: input.recreationNote,
      negative_prompt: input.negativePrompt,
      smart_select: input.smartSelect ?? false,
      harmonise: input.harmonise ?? true,
    }),
  });
}

export function generateImg2Img(input: {
  prompt: string;
  imageBase64: string;
  modelChoice?: string;
  strength?: number;
  seed?: number;
  steps?: number;
  style?: string;
}): Promise<InpaintResponse> {
  return request<InpaintResponse>('/v1/generate/img2img', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      image_base64: input.imageBase64,
      model_choice: input.modelChoice || 'sd_turbo',
      strength: input.strength ?? 0.75,
      seed: input.seed,
      steps: input.steps,
      style: input.style || 'Photorealistic',
    }),
  });
}

export function getCapabilities(): Promise<CapabilitiesResponse> {
  return request<CapabilitiesResponse>('/v1/capabilities');
}

export function analyzePrompt(prompt: string) {
  return request('/v1/prompt/analysis', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export interface BenchmarkVariant {
  label: string;
  n: number;
  fid: number;
  kid_mean: number;
  clip_mean: number;
  latency_median_ms: number;
  latency_p95_ms: number;
  peak_vram_mb: number;
  model_size_mb: number;
  steps: number;
  dtype: string;
  gpu: string;
}

export interface BenchmarkResponse {
  measured: boolean;
  variants: Record<string, BenchmarkVariant>;
  protocol: string;
}

export interface TrainingRun {
  name: string;
  base_model: string | null;
  status: string;
  steps: number | null;
  rank: number | null;
  learning_rate: number | null;
  resolution: number | null;
  approved: boolean;
  approved_scale: number | null;
  weights_mb: number | null;
  sha256: string;
}

export interface TrainingDatasetInfo {
  name: string;
  description: string | null;
  train: number | null;
  validation: number | null;
  licences: Record<string, number>;
  leakage_guard: string | null;
}

export interface TrainingRunsResponse {
  runs: TrainingRun[];
  datasets: TrainingDatasetInfo[];
  distillation: Record<string, unknown>[];
  reproduce: string;
}

export function getTrainingRuns() {
  return request<TrainingRunsResponse>('/v1/training/runs');
}

export function getBenchmark() {
  return request<BenchmarkResponse>('/v1/metrics/benchmark');
}

export function getMetricsSummary() {
  return request('/v1/metrics/summary');
}

export function getModelCatalogue() {
  return request<{ models: ModelCatalogueEntry[] }>('/v1/models');
}

export interface ServerUser { id: number; name: string; email: string; role: string }
export const authMe = () => request<{ user: ServerUser }>('/v1/auth/me');
export const authLogin = (email: string, password: string) => request<{ user: ServerUser }>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const authSignup = (name: string, email: string, password: string) => request<{ user: ServerUser }>('/v1/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
export const authLogout = () => request<{ status?: string }>('/v1/auth/logout', { method: 'POST', body: '{}' });
export const authChangePassword = (current_password: string, new_password: string) =>
  request<{ status?: string }>('/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) });

export interface LessonDiagram { type: 'flow' | 'cycle' | 'parts'; caption: string; nodes: { id: string; label: string; note: string }[]; edges: { from: string; to: string; label: string }[] }
export interface Lesson { topic: string; title: string; summary: string; key_points: string[]; steps: { title: string; text: string }[]; diagram: LessonDiagram; image_prompt: string; quiz: { q: string; a: string }[] }
export const explainTopic = (topic: string, level: string) => request<Lesson>('/v1/learn/explain', { method: 'POST', body: JSON.stringify({ topic, level }) });

export const getLanguages = () => request<{ languages: { code: string; name: string }[] }>('/v1/languages');
export const translateText = (text: string, target: string) => request<{ translation: string; target: string; target_name: string }>('/v1/translate', { method: 'POST', body: JSON.stringify({ text, target }) });
export const transcribeAudio = (audioBase64: string, mime: string, language?: string) =>
  request<{ text: string }>('/v1/speech/transcribe', { method: 'POST', body: JSON.stringify({ audio_base64: audioBase64, mime, language }) });
export const askAboutImage = (imageBase64: string, question: string) =>
  request<{ answer: string; source: string; measurements: Record<string, string>; palette: { hex: string }[] }>('/v1/vision/ask', { method: 'POST', body: JSON.stringify({ image_base64: imageBase64, question }) });

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

// ==================== GALLERY CRUD ====================
export function getGalleryItems(params?: {
  category?: string;
  favoritesOnly?: boolean;
  search?: string;
}): Promise<{ status: string; items: GalleryItem[] }> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.favoritesOnly) query.set('favorites_only', 'true');
  if (params?.search) query.set('search', params.search);
  const qStr = query.toString() ? `?${query.toString()}` : '';
  return request<{ status: string; items: GalleryItem[] }>(`/v1/gallery${qStr}`);
}

export function createGalleryItem(item: Partial<GalleryItem> & { image_url: string; prompt: string }): Promise<{ status: string; item: GalleryItem }> {
  return request<{ status: string; item: GalleryItem }>('/v1/gallery', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export function updateGalleryItem(id: string, updates: Partial<GalleryItem>): Promise<{ status: string; item: GalleryItem }> {
  return request<{ status: string; item: GalleryItem }>(`/v1/gallery/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteGalleryItem(id: string): Promise<{ status: string; deleted: boolean }> {
  return request<{ status: string; deleted: boolean }>(`/v1/gallery/${id}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------- creative: styles, smart selection, storybook
export interface StyleInfo { id: string; label: string; description: string; cv_finisher: boolean }
export function getStyles(): Promise<{ styles: StyleInfo[] }> {
  return request<{ styles: StyleInfo[] }>('/v1/styles');
}

export interface SelectResponse { status: string; mask_base64: string; bbox: number[] | null; area_fraction: number }
/** GrabCut: snap a rough box [x, y, w, h] (image pixels) or a painted stroke to the object boundary. */
export function smartSelect(input: { imageBase64: string; rect?: number[]; strokeBase64?: string }): Promise<SelectResponse> {
  return request<SelectResponse>('/v1/cv/select', {
    method: 'POST',
    body: JSON.stringify({ image_base64: input.imageBase64, rect: input.rect, stroke_base64: input.strokeBase64 }),
  });
}

export interface StoryDialogue { speaker: string; text: string; kind: 'speech' | 'thought' | 'shout' }
export interface StoryCharacter { name: string; role: string; look: string }
export interface StoryOutlineScene {
  n: number; title: string; narration: string; visual: string; shot: string; mood: string;
  characters: string[]; dialogue: StoryDialogue[]; sfx: string | null; image_prompt: string;
}
export interface StoryOutline {
  title: string; logline: string; world: string; source: string;
  characters: StoryCharacter[]; scenes: StoryOutlineScene[];
}
export function createStoryOutline(input: { idea: string; nScenes: number; genre: string; artStyle: string }): Promise<StoryOutline> {
  return request<StoryOutline>('/v1/story/outline', {
    method: 'POST',
    body: JSON.stringify({ idea: input.idea, n_scenes: input.nScenes, genre: input.genre, art_style: input.artStyle }),
  });
}

export interface StoryPanelIn { image_url: string; narration?: string | null; dialogue?: StoryDialogue[]; sfx?: string | null }
export function composeStoryPage(input: { title: string; panels: StoryPanelIn[]; mode: 'colour' | 'bw' | 'ink'; pageNo: number }):
  Promise<{ status: string; request_id: string; image_url: string; width: number; height: number }> {
  return request('/v1/story/page', {
    method: 'POST',
    body: JSON.stringify({ title: input.title, panels: input.panels, mode: input.mode, page_no: input.pageNo }),
  });
}

export async function downloadStoryPdf(imageUrls: string[], title: string): Promise<void> {
  const response = await fetch(`${apiBase}/v1/story/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_urls: imageUrls, title }),
  });
  if (!response.ok) throw new Error(`PDF export failed (${response.status}).`);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40) || 'storybook'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------- classical-CV image tools (no diffusion, no GPU)
export interface CvImageResult { status: string; request_id: string; image_url: string; width: number; height: number }
export function cvStylize(input: { imageBase64: string; style: string; strength?: number }): Promise<CvImageResult> {
  return request<CvImageResult>('/v1/cv/stylize', {
    method: 'POST',
    body: JSON.stringify({ image_base64: input.imageBase64, style: input.style, strength: input.strength ?? 1 }),
  });
}
export interface AdjustParams { brightness: number; contrast: number; saturation: number; warmth: number; sharpness: number; denoise: number; auto: boolean }
export function cvAdjust(imageBase64: string, p: AdjustParams): Promise<CvImageResult> {
  return request<CvImageResult>('/v1/cv/adjust', { method: 'POST', body: JSON.stringify({ image_base64: imageBase64, ...p }) });
}
export function cvUpscale(imageBase64: string, scale: number): Promise<CvImageResult> {
  return request<CvImageResult>('/v1/cv/upscale', { method: 'POST', body: JSON.stringify({ image_base64: imageBase64, scale }) });
}

export interface ImageStat { value: number; label: string }
export interface ImageAnalysis {
  width: number; height: number; sharpness: ImageStat; brightness: ImageStat; contrast: ImageStat; colourfulness: ImageStat; noise: ImageStat;
  palette: { hex: string; share: number }[];
}
export function cvAnalyze(imageBase64: string): Promise<ImageAnalysis> {
  return request<ImageAnalysis>('/v1/cv/analyze', { method: 'POST', body: JSON.stringify({ image_base64: imageBase64 }) });
}

// ---------------------------------------------------------------- research overview (everything derived from measured files)
export interface ResearchVariant {
  id: string; label: string; fid: number; kid: number; clip: number; latency_ms: number; vram_mb: number; size_mb: number; steps?: number;
  speedup?: number; vram_saved_pct?: number; size_saved_pct?: number; prompt_accuracy?: number;
}
export interface ResearchOverview {
  measured: boolean;
  sources: Record<string, boolean>;
  variants: ResearchVariant[];
  headlines: { label: string; value: string; sub: string; tone: string }[];
  insights: string[];
  prompt_accuracy?: { id: string; label: string; overall: number; per_category: Record<string, number | null>; n: Record<string, number> }[];
  best_of_n?: { rows: { n: number; overall: number; per_category: Record<string, number | null>; ceiling?: number; cost_ms_a10g: number; cost_ms_laptop_est: number | null }[]; protocol?: string; prompts?: number; steps?: number; note: string };
  tiny_vae?: { id: string; steps: number; tiny_vae: boolean; fid: number; kid: number; clip: number; latency_ms: number; size_mb: number }[];
  cv_ablation?: { name: string; fid: number; clip: number; ms: number | null; flagged: number | null }[];
  failures: { title: string; severity: string; status: string; cause: string; evidence: string; mitigation: string }[];
  protocol: Record<string, string>;
}
export function getResearchOverview(): Promise<ResearchOverview> {
  return request<ResearchOverview>('/v1/research/overview');
}
