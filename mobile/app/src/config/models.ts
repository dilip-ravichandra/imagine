// mobile/app/src/config/models.ts
export interface ModelInfo {
  id: string;
  displayName: string;
  family: string;
  task: string;
  hardware: string;
  defaults?: Record<string, any>;
}

export const MODEL_CATALOG: ModelInfo[] = [
  {
    id: 'sd_1.5',
    displayName: 'Stable Diffusion 1.5',
    family: 'diffusion',
    task: 'text-to-image',
    hardware: 'GPU ≥ 8 GB',
    defaults: { steps: 30, cfg_scale: 7.0 },
  },
  {
    id: 'sd_turbo',
    displayName: 'SD‑Turbo (fast)',
    family: 'diffusion',
    task: 'text-to-image',
    hardware: 'GPU ≥ 6 GB',
  },
  {
    id: 'sdxl',
    displayName: 'Stable Diffusion XL',
    family: 'diffusion',
    task: 'text-to-image',
    hardware: 'GPU ≥ 12 GB',
  },
  // add remaining entries as needed …
];
