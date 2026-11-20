/* ============================================================
   IMAGINE AI — INTERACTIVE WALKTHROUGH
   app.js — All interactions, animations, data
   ============================================================ */

'use strict';

// ═══════════════════════════════════════
// DATA
// ═══════════════════════════════════════

const NODE_DATA = {
  react: {
    tag: 'Frontend Client', title: 'React Web App',
    purpose: '17-page single-page application providing the full user interface: Create, Edit, Storybook, Learn, Translate, Ask, Gallery, Results, Admin.',
    tech: 'React 18, Chakra UI, Vite, TypeScript',
    input: 'User interactions (clicks, text, voice, image uploads)',
    output: 'HTTP requests to FastAPI; renders image URLs returned from backend',
    file: 'frontend/src/'
  },
  android: {
    tag: 'Mobile Client', title: 'Android App',
    purpose: 'Native Android client communicating with the same FastAPI backend. Supports core image generation and gallery features.',
    tech: 'Jetpack Compose, Kotlin, Retrofit HTTP client',
    input: 'User touch input, text prompts, camera images',
    output: 'HTTP requests to same /api/v1/ endpoints',
    file: 'android/'
  },
  fastapi: {
    tag: 'API Gateway', title: 'FastAPI Application',
    purpose: 'Central orchestrator. All routes require signed-in session. Handles auth, rate limits, routes requests to appropriate service, assembles performance telemetry response.',
    tech: 'FastAPI, Uvicorn, Pydantic v2, Python 3.12',
    input: 'HTTP requests with session cookies',
    output: 'JSON responses with image URLs, performance data, quality metrics',
    file: 'backend/app/main.py'
  },
  sdturbo: {
    tag: 'Primary Model', title: 'SD-Turbo (1–2 Steps)',
    purpose: 'Default image generation model. Adversarial Diffusion Distillation enables single-step generation with sharp, coherent output. Guidance scale = 0.0 means only one conditional UNet pass per step.',
    tech: 'stabilityai/sd-turbo · diffusers AutoPipelineForText2Image · EulerDiscreteScheduler · FP16',
    input: 'Text prompt (77-token BPE), seed integer, resolution, num_inference_steps',
    output: 'PIL.Image (512×512 RGB)',
    file: 'backend/app/services/engine.py'
  },
  lcmlora: {
    tag: 'Balanced Model', title: 'SD 1.5 + LCM-LoRA',
    purpose: 'Consistency-distilled model for 4-step balanced generation. LCM-LoRA injects rank-decomposed adapter weights into cross-attention. Guidance scale = 1.0 → single UNet pass per step.',
    tech: 'stable-diffusion-v1-5 + latent-consistency/lcm-lora-sdv1-5 · LCMScheduler · FP16',
    input: 'Text prompt, seed, resolution, steps (4–8)',
    output: 'PIL.Image (512×512 RGB)',
    file: 'backend/app/services/multi_model.py'
  },
  inpaint: {
    tag: 'Edit Feature', title: 'Stable Diffusion Inpainting',
    purpose: 'Mask-guided selective image editing. Pixels outside the user-drawn mask stay bit-for-bit identical. GrabCut segmentation assists Smart Select mode.',
    tech: 'AutoPipelineForInpainting · SD-Turbo (2-step) or SD 1.5 (15-step) · OpenCV GrabCut',
    input: 'Source image PNG, binary mask PNG, text prompt',
    output: 'Inpainted image with original pixels preserved outside mask',
    file: 'backend/app/services/multi_model.py'
  },
  verifier: {
    tag: 'Quality Module', title: 'Best-of-N Verifier (DETR + OWL-ViT)',
    purpose: 'Generate N candidates, pick the best compositionally, verify with an independent model. Improves correctness from 62% (N=1) to 75% (N=8) on compositional prompts.',
    tech: 'facebook/detr-resnet-50 (selector) · google/owlvit-base-patch32 (independent verifier)',
    input: 'N generated PIL.Images, prompt metadata',
    output: 'Best-scoring image index + per-image correctness scores',
    file: 'ai_engine/ (verifier logic)',
    note: 'Different model selects vs verifies — prevents self-grading bias'
  },
  cv: {
    tag: 'Post-processing', title: 'Classical CV Quality Pipeline',
    purpose: 'Objective pixel quality gate. Measures 13 no-reference metrics. 38% of images bypass correction (dead-band). Prompt intent suppressions prevent false flags (e.g. "golden hour" → warm cast is intentional).',
    tech: 'OpenCV 4, NumPy, Laplacian/Crete/Immerkaer/Sobel algorithms',
    input: 'Generated PIL.Image, prompt analysis (intent suppressions)',
    output: 'QualityReport + corrected PIL.Image (or original if unchanged)',
    file: 'computer_vision/pipeline.py'
  },
  adaptive: {
    tag: 'Resource Manager', title: 'Adaptive Quality Controller',
    purpose: '4-rung deterministic fallback ladder. Reads live GPU budget, scores benchmarked profiles, selects safe config. If preferred is unsafe, steps down: Resolution → Precision → Steps → Model. Same inputs always give same decision.',
    tech: 'Pure Python (no torch), hashlib for input audit trail, ai_engine/adaptive/',
    input: 'ControllerRequest (quality_mode, resolution, complexity_level), ResourceSnapshot (gpu_budget_mb)',
    output: 'Decision (selected ProfileEntry, fallback_used, explanation, audit log)',
    file: 'ai_engine/adaptive/controller.py',
    note: 'V7 in P7 evaluation: NOT RUN — no measured profile exists yet'
  },
  sqlite: {
    tag: 'Database', title: 'SQLite Database',
    purpose: 'Stores user accounts (scrypt-hashed passwords) and generated image gallery metadata. Session tokens. Brute-force protection.',
    tech: 'SQLite · SQLAlchemy ORM · scrypt password hashing',
    input: 'User registration/login, image save requests',
    output: 'Auth tokens, gallery image list',
    file: 'backend/app/db/'
  },
  nlp: {
    tag: 'Semantic Parser', title: 'Zero-GPU NLP Prompt Parser',
    purpose: 'Deterministic rule-based parser. No LLM, no network. Extracts: objects, counts, attributes, spatial relations, lighting, style, negations, ambiguities, intent suppressions for CV. 100% reproducible.',
    tech: 'Pure Python regex + linguistic lookup tables (lexicon.py)',
    input: 'Prompt string (str)',
    output: 'PromptAnalysis: objects, relations, lighting, style, complexity, ambiguities',
    file: 'ai_engine/prompt/parser.py'
  },
  groq: {
    tag: 'External AI API', title: 'Groq Cloud API',
    purpose: 'Powers: chat assistant (Qwen/Llama), voice transcription (Whisper), multilingual translation (24 languages), image analysis (multimodal), and AI-generated SVG diagram lessons.',
    tech: 'Groq API · Whisper · Qwen 2.5 · LLaMA · Keys stored server-side only',
    input: 'Text/audio/image from server — API key NEVER reaches browser',
    output: 'Text completions, transcriptions, translations, SVG diagrams',
    file: 'backend/app/routes/ (groq.py, translate.py, learn.py)',
    note: 'Requires free Groq API key in docker/.env to enable AI features'
  },
  modal: {
    tag: 'Cloud Deployment', title: 'Modal A10G Cloud',
    purpose: 'Production cloud deployment. A10G GPU (24 GB VRAM) enables 125 ms generation (vs 247 ms on laptop). Persistent volume for accounts and images. HTTPS with secure cookies.',
    tech: 'Modal · A10G GPU · Persistent volume · HTTPS · modal_deploy.py',
    input: 'User HTTP requests at the public demo URL',
    output: 'Same API as local server, faster inference',
    file: 'modal_deploy.py · modal_app.py'
  },
  docker: {
    tag: 'Local Deployment', title: 'Docker Container',
    purpose: 'One-command local run on any laptop with Docker. No manual Python/CUDA setup. Models cached in Docker volume after first download.',
    tech: 'Docker Compose · NVIDIA GPU passthrough (optional) · start.sh / start.bat',
    input: 'docker compose up',
    output: 'Full app at http://localhost:8000',
    file: 'docker/'
  },
  coco: {
    tag: 'Dataset', title: 'MS-COCO Dataset',
    purpose: 'Used for two purposes: (1) 300 held-out COCO prompts for evaluation benchmarks; (2) COCO captions as training data for LCM-LoRA fine-tuning experiment.',
    tech: 'COCO 2017 · 300 evaluation prompts · ~500 training steps for LCM-LoRA',
    input: 'COCO caption dataset',
    output: 'Evaluation FID/CLIP metrics · LCM-LoRA fine-tuned weights',
    file: 'evaluation/ · ai_engine/training/',
    note: 'Custom LoRA tied the public adapter (FID 120.4 vs 121.2) — within noise'
  }
};

const STAGE_DETAILS = [
  { icon:'🌐', title:'Client Request', latency:'< 1 ms (network + validation)', input:'Prompt string, quality_mode, resolution, seed', output:'Validated GenerateRequest object (Pydantic)' },
  { icon:'🔒', title:'Single-Flight Guard', latency:'< 0.1 ms (mutex check)', input:'Lock acquisition attempt', output:'Acquired lock → proceed; or HTTP 429 Busy' },
  { icon:'🔤', title:'Semantic NLP Analysis', latency:'< 0.8 ms, 0 MB VRAM', input:'Raw prompt string', output:'PromptAnalysis: objects, relations, lighting, intent suppressions' },
  { icon:'🎛️', title:'Adaptive Controller', latency:'< 2 ms', input:'Quality mode, resolution, live GPU budget', output:'Selected ProfileEntry (model, precision, steps) + decision log' },
  { icon:'🔄', title:'GPU Lease & Model Load', latency:'0 ms (cached) or 3,000–6,000 ms (first load)', input:'Chosen model config', output:'Pipeline loaded on CUDA device in target precision' },
  { icon:'📝', title:'CLIP Text Encoding', latency:'~15–25 ms', input:'Prompt string (up to 77 BPE tokens)', output:'Text embedding tensor (1, 77, 768)' },
  { icon:'🌀', title:'Latent Denoising (UNet)', latency:'~200–400 ms (1–4 steps, fp16)', input:'Gaussian noise (1,4,64,64), text embeddings, timestep schedule', output:'Denoised latent (1,4,64,64) on CUDA' },
  { icon:'🖼️', title:'VAE Decoding', latency:'18 ms (TAESD) or 52 ms (AutoencoderKL)', input:'Latent tensor (1,4,64,64)', output:'RGB image tensor (1,3,512,512) → uint8 PNG' },
  { icon:'🔬', title:'CV Quality Gate', latency:'~18 ms (38% bypass); ~50 ms (correction)', input:'PIL.Image, intent suppressions from NLP', output:'Quality report + corrected image (or original if clean)' }
];

const MODEL_TABLE_DATA = [
  { name:'B0 — SD 1.5 (fp32, 30 steps)', prec:'fp32', steps:30, lat:'10,545 ms', vram:'5,066 MB', size:'4,068 MB', clip:'0.316', speed:'1×' },
  { name:'B1 — SD 1.5 + fp16',           prec:'fp16', steps:30, lat:'4,303 ms',  vram:'2,676 MB', size:'2,034 MB', clip:'0.316', speed:'2.5×' },
  { name:'O4 — LCM-LoRA (4 steps)',       prec:'fp16', steps:4,  lat:'451 ms',   vram:'2,816 MB', size:'2,163 MB', clip:'0.303', speed:'23×' },
  { name:'O4T — LCM + TAESD',            prec:'fp16', steps:4,  lat:'340 ms',   vram:'2,207 MB', size:'2,008 MB', clip:'0.303', speed:'31×' },
  { name:'T1 — SD-Turbo (1 step) ⭐',    prec:'fp16', steps:1,  lat:'247 ms',   vram:'3,098 MB', size:'2,461 MB', clip:'0.321', speed:'43×' }
];

const MODEL_DETAIL_DATA = {
  turbo: {
    tag: 'ADD Distilled · Default Model', title: 'SD-Turbo — Adversarial Diffusion Distillation',
    sections: [
      { label:'Training Method', text:'Adversarial Diffusion Distillation (ADD): combines score distillation from a frozen SD 2.1 teacher with an adversarial loss from a ViT discriminator. Enables sharp, coherent 1-step generation without diffusion blur.' },
      { label:'Why CFG = 0.0 Saves Compute', text:'Standard SD 1.5 at CFG=7.5 evaluates the UNet twice per step (conditional + unconditional). SD-Turbo uses a single conditional pass — 50% fewer FLOPs per step, then 1–2 steps instead of 30. Total: ~30× UNet reduction.' },
      { label:'Scheduler', text:'EulerDiscreteScheduler. Directly integrates from t=T to t=0 in 1–2 steps.' },
      { label:'Measured Performance', text:'247 ms (1 step, laptop GPU) · 125 ms (Modal A10G) · 56 ms (A10G + TAESD, 1 step) · Peak VRAM: 3,098 MB · CLIP: 0.321 · FID: 117.1' },
      { label:'Limitation', text:'Best with simple prompts. Complex spatial compositions and counting may require Best-of-N to reach acceptable accuracy.' },
      { label:'Source', text:'stabilityai/sd-turbo · backend/app/services/engine.py (SDTurboEngine class)' }
    ]
  },
  lcm: {
    tag: 'Consistency Distillation · Balanced Mode', title: 'SD 1.5 + LCM-LoRA',
    sections: [
      { label:'Consistency Distillation', text:'Trains a function f(z_t, t) = z_0 mapping any point on the PF-ODE trajectory directly to the clean image. The self-consistency property means 4 steps achieves quality similar to 30 DDPM steps.' },
      { label:'LoRA Architecture', text:'Rank-decomposition matrices (rank r=64, alpha=64) injected into cross-attention Q/K/V projections. Only 135 MB of adapter weights — the 860M UNet stays frozen. Weight scale: α/r = 1.0.' },
      { label:'Project LoRA Training', text:'We trained our own LCM-LoRA on COCO captions (~500 steps). Result: FID 120.4 vs public adapter FID 121.2 — within noise. Longer training (500→2000 steps) drifted slightly worse. Available as "ours" but not approved as better.' },
      { label:'Scheduler', text:'LCMScheduler. CFG = 1.0 → single UNet pass per step (same efficiency as SD-Turbo). 4–8 steps.' },
      { label:'Measured Performance', text:'4-step: 451 ms · 8-step: 1,647 ms · With TAESD: 340 ms · Peak VRAM: 2,816 MB · CLIP: 0.303 · FID: 121.2' },
      { label:'Source', text:'stable-diffusion-v1-5/stable-diffusion-v1-5 + latent-consistency/lcm-lora-sdv1-5 · backend/app/services/multi_model.py' }
    ]
  },
  taesd: {
    tag: 'Tiny VAE Decoder · Speed Accelerator', title: 'TAESD — Tiny AutoEncoder for Stable Diffusion',
    sections: [
      { label:'Architecture', text:'Ultra-compact convolutional autoencoder distilled from the standard 83.7M-parameter AutoencoderKL. Only 1.8M parameters — no attention layers. Upsamples 64×64×4 latent to 512×512×3 RGB.' },
      { label:'Speed Benefit', text:'VAE decode: 18 ms vs 52 ms (65% faster). When paired with LCM-LoRA (4 steps): total drops from 451 ms to 340 ms (31× speed-up vs SD 1.5 baseline).' },
      { label:'Memory Benefit', text:'Peak VRAM: 2,207 MB vs 2,816 MB (−22%). The combined LCM+TAESD stack achieves the best VRAM footprint of all measured variants.' },
      { label:'Quality Trade-off', text:'CLIP score 0.303 (same as LCM baseline — TAESD does not change semantic alignment). FID: 122.0 vs 121.2 — marginal, within noise.' },
      { label:'Usage', text:'Drop-in replacement for the AutoencoderKL decoder. Applied by swapping the VAE on the pipeline after loading.' },
      { label:'Source', text:'github.com/madebyollin/taesd · backend/app/services/multi_model.py' }
    ]
  },
  verify: {
    tag: 'Object Detection · Best-of-N', title: 'DETR + OWL-ViT Verification System',
    sections: [
      { label:'Why Two Separate Models', text:'Best-of-N generates N candidates with SD-Turbo, then DETR selects the best by detecting objects and checking colours. OWL-ViT independently verifies the selection. Using a different model for verification prevents self-grading bias.' },
      { label:'DETR (Selector)', text:'facebook/detr-resnet-50. DEtection TRansformer with ResNet-50 backbone. Detects required objects (from prompt parsing), checks colour correctness, and counts. Picks the highest-scoring candidate.' },
      { label:'OWL-ViT (Verifier)', text:'google/owlvit-base-patch32. Open-vocabulary object detector. Independently verifies that the DETR-selected image actually contains the required visual elements.' },
      { label:'Measured Accuracy', text:'N=1: 62%, N=2: 63%, N=4: 70%, N=8: 75%. On 100 compositional prompts (counting, colours, positions, two objects). 13 percentage-point improvement at N=8.' },
      { label:'Limitation', text:'Cost scales linearly with N. At N=8 with SD-Turbo: 8×247 ms ≈ 2 s generation + verification overhead. Practical for quality-critical use cases.' },
      { label:'Source', text:'ai_engine/ verifier logic · evaluation/ correctness measurement' }
    ]
  }
};

const TECH_STACK = [
  { icon:'⚡', name:'FastAPI',       desc:'Python async web framework. All backend routes, auth, rate limits.' },
  { icon:'⚛️', name:'React 18',     desc:'Frontend SPA. 17 pages + Chakra UI component library.' },
  { icon:'🔥', name:'PyTorch 2.11', desc:'GPU tensor operations, model inference, CUDA memory management.' },
  { icon:'🤗', name:'Diffusers 0.42',desc:'HuggingFace pipeline abstraction for SD-Turbo, LCM, Inpainting.' },
  { icon:'🎨', name:'OpenCV 4',     desc:'Computer vision operations: GrabCut, Bilateral, CLAHE, Sobel, Canny.' },
  { icon:'🔢', name:'NumPy',        desc:'Numerical operations throughout CV pipeline and metric computation.' },
  { icon:'📐', name:'PEFT',         desc:'Parameter-Efficient Fine-Tuning. LoRA adapter loading and injection.' },
  { icon:'🤖', name:'Groq API',     desc:'Cloud LLM/Whisper/translation. Keys stored server-side only.' },
  { icon:'🐳', name:'Docker',       desc:'One-command local deployment. GPU passthrough via docker-compose.' },
  { icon:'☁️', name:'Modal',        desc:'Cloud deployment on A10G. 125 ms generation, persistent storage.' },
  { icon:'🗄️', name:'SQLite',       desc:'User accounts, sessions, gallery. scrypt password hashing.' },
  { icon:'📱', name:'Jetpack Compose',desc:'Native Android client consuming the same FastAPI backend.' },
  { icon:'🧪', name:'pytest',       desc:'755 automated tests covering API, engine, CV, NLP, adaptive controller.' },
  { icon:'🎓', name:'PNDM/LCM/Euler',desc:'Schedulers for SD 1.5 (PNDM), LCM-LoRA (LCM), SD-Turbo (Euler).' },
  { icon:'🌐', name:'Vite',         desc:'Frontend build tooling. Fast HMR dev server for React.' },
  { icon:'🔗', name:'CLIP',         desc:'openai/clip-vit-base-patch32 for text-image alignment scoring.' }
];

const STATUS_ITEMS = [
  { status:'impl', color:'dot-green2', title:'Image Generation (SD-Turbo)', desc:'1-2 step generation, FP16, EulerScheduler. Default for the web app. Fully measured.' },
  { status:'impl', color:'dot-green2', title:'LCM-LoRA (Public Adapter)', desc:'4-8 step balanced mode. TAESD acceleration available.' },
  { status:'impl', color:'dot-green2', title:'Inpainting (Mask-guided)', desc:'GrabCut Smart Select + text-guided inpainting. Outside-mask pixels preserved bit-for-bit.' },
  { status:'impl', color:'dot-green2', title:'Classical CV Quality Pipeline', desc:'13 no-reference metrics, dead-band gating, intent suppression, guarded correction.' },
  { status:'impl', color:'dot-green2', title:'Zero-GPU NLP Prompt Parser', desc:'< 0.8 ms, pure Python, 100% deterministic. All 755 tests passing.' },
  { status:'impl', color:'dot-green2', title:'Best-of-N Verifier (DETR + OWL-ViT)', desc:'62% → 75% correctness at N=8. Independent verification model.' },
  { status:'impl', color:'dot-green2', title:'Groq AI Features', desc:'Chat, Whisper voice, translate (24 langs), image analysis, SVG diagram lessons.' },
  { status:'impl', color:'dot-green2', title:'Android App', desc:'Jetpack Compose client consuming the same API.' },
  { status:'part', color:'dot-orange', title:'Adaptive Controller (P6)', desc:'Controller logic implemented and tested. NOT wired into P7 evaluation harness. No measured profile sweep yet.' },
  { status:'part', color:'dot-orange', title:'Project LCM-LoRA (Ours)', desc:'Trained on COCO (~500 steps). Ties public adapter (FID 120.4 vs 121.2). Available but not approved as better.' },
  { status:'plan', color:'dot-gray', title:'On-device Mobile NPU (P8)', desc:'Architecture designed in docs/09_MOBILE_DEPLOYMENT.md. Qualcomm QNN ONNX compilation not yet done.' },
  { status:'plan', color:'dot-gray', title:'TensorRT INT8 (SmoothQuant)', desc:'INT8 dynamic PTQ was slower (495 ms vs 451 ms). True hardware INT8 via TensorRT is future work.' }
];

const LATENCY_BARS = [
  { label:'B0 — SD 1.5 Baseline', ms:10545, pct:100, cls:'bar-b0', color:'#94A3B8' },
  { label:'B1 — SD 1.5 + fp16',   ms:4303,  pct:40.8, cls:'bar-b1', color:'#60A5FA' },
  { label:'O4 — LCM-LoRA 4-step', ms:451,   pct:4.3,  cls:'bar-o4', color:'#A78BFA' },
  { label:'T1 — SD-Turbo 1-step ⭐',ms:247, pct:2.3,  cls:'bar-t1', color:'#F472B6' }
];

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

// ═══════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════

function initProgressBar() {
  const bar = qs('#progress-bar');
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (scrolled / max) * 100 : 0) + '%';
  }, { passive: true });
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════

function initNav() {
  const toggle = qs('#nav-toggle');
  const links  = qs('#nav-links');
  toggle.addEventListener('click', () => links.classList.toggle('open'));

  // Active link on scroll
  const sections = qsa('section[id]');
  const navLinks  = qsa('.nav-links a');

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => io.observe(s));

  // Close mobile menu on link click
  navLinks.forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}

// ═══════════════════════════════════════
// ANIMATE ON SCROLL
// ═══════════════════════════════════════

function initAOS() {
  const els = qsa('.aos-fade, .aos-slide-left, .aos-slide-right');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { rootMargin: '0px 0px -80px 0px' });
  els.forEach(el => io.observe(el));
}

// ═══════════════════════════════════════
// HERO ANIMATION
// ═══════════════════════════════════════

function initHeroAnim() {
  const steps = [
    { id: 'ha-1', label: 'Tokenizing prompt…' },
    { id: 'ha-2', label: 'Running NLP parser (< 0.8 ms, 0 VRAM)…' },
    { id: 'ha-3', label: 'SD-Turbo UNet denoising (2 steps, FP16)…' },
    { id: 'ha-4', label: 'Classical CV quality gate…' },
    { id: 'ha-5', label: '✅ Image ready! 289 ms total.' }
  ];
  let cur = 0;
  const label = qs('#hero-anim-label');

  function step() {
    // Reset
    steps.forEach(s => { const el = qs('#' + s.id); if (el) el.style.opacity = '0.2'; });
    if (cur < steps.length) {
      const el = qs('#' + steps[cur].id);
      if (el) el.style.opacity = '1';
      label.textContent = steps[cur].label;
      cur++;
      setTimeout(step, cur === steps.length ? 2500 : 1200);
    } else {
      setTimeout(() => { cur = 0; step(); }, 2000);
    }
  }
  setTimeout(step, 800);
}

// ═══════════════════════════════════════
// ARCHITECTURE INFO PANEL
// ═══════════════════════════════════════

function initArchNodes() {
  qsa('.arch-node').forEach(node => {
    node.addEventListener('click', () => {
      const key = node.dataset.node;
      const d = NODE_DATA[key];
      if (!d) return;
      qs('#ip-tag').textContent   = d.tag;
      qs('#ip-title').textContent = d.title;
      qs('#ip-purpose').textContent = d.purpose;
      qs('#ip-tech').textContent  = d.tech;
      qs('#ip-input').textContent = d.input;
      qs('#ip-output').textContent= d.output;
      qs('#ip-file').textContent  = d.file;
      const noteRow = qs('#ip-note-row');
      if (d.note) { qs('#ip-note').textContent = d.note; noteRow.style.display = 'block'; }
      else { noteRow.style.display = 'none'; }
      qs('#info-panel').classList.add('open');
      qsa('.arch-node').forEach(n => n.classList.remove('active'));
      node.classList.add('active');
    });
  });

  qs('#info-panel-close').addEventListener('click', () => {
    qs('#info-panel').classList.remove('open');
    qsa('.arch-node').forEach(n => n.classList.remove('active'));
  });
}

// ═══════════════════════════════════════
// PIPELINE — STAGE CONTROLLER
// ═══════════════════════════════════════

let pipelineTimer = null;
let currentStage = 0;
const TOTAL_STAGES = 9;

function initStageIndicators() {
  const container = qs('#step-indicators');
  container.innerHTML = '';
  for (let i = 0; i < TOTAL_STAGES; i++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    dot.addEventListener('click', () => goToStage(i));
    container.appendChild(dot);
  }
}

function updateStageUI(idx) {
  const d = STAGE_DETAILS[idx];
  // Highlight step cards
  qsa('.pipeline-step').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    if (i === idx) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
  // Update detail card
  qs('#sd-icon').textContent = d.icon;
  qs('#sd-title').textContent = d.title;
  qs('#sd-latency').textContent = 'Latency: ' + d.latency;
  qs('#sd-input').textContent  = d.input;
  qs('#sd-output').textContent = d.output;
  qs('#stage-detail .info-panel-tag, #stage-detail [style*="accent2"]') // find label
  const stageLabel = qs('#stage-detail div:first-child > div:first-child');
  if (stageLabel) stageLabel.textContent = `Stage ${idx + 1} of ${TOTAL_STAGES}`;

  // Update dots
  qsa('.step-dot', qs('#step-indicators')).forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
    dot.classList.toggle('done', i < idx);
  });
}

function goToStage(idx) {
  currentStage = Math.max(0, Math.min(idx, TOTAL_STAGES - 1));
  updateStageUI(currentStage);
}

function startPipeline() {
  if (pipelineTimer) return;
  pipelineTimer = setInterval(() => {
    currentStage = (currentStage + 1) % TOTAL_STAGES;
    updateStageUI(currentStage);
  }, 2200);
}

function pausePipeline() {
  clearInterval(pipelineTimer);
  pipelineTimer = null;
}

function initPipeline() {
  initStageIndicators();
  updateStageUI(0);

  qs('#btn-play').addEventListener('click',   () => startPipeline());
  qs('#btn-pause').addEventListener('click',  pausePipeline);
  qs('#btn-replay').addEventListener('click', () => { pausePipeline(); currentStage = 0; updateStageUI(0); });
  qs('#btn-prev').addEventListener('click',   () => { pausePipeline(); goToStage(currentStage - 1); });
  qs('#btn-next').addEventListener('click',   () => { pausePipeline(); goToStage(currentStage + 1); });

  qsa('.pipeline-step').forEach((el, i) => {
    el.addEventListener('click', () => { pausePipeline(); goToStage(i); });
  });
}

// ═══════════════════════════════════════
// MODEL TABLE
// ═══════════════════════════════════════

function initModelTable() {
  const tbody = qs('#model-table-body');
  tbody.innerHTML = MODEL_TABLE_DATA.map((r, i) => `
    <tr style="border-top:1px solid var(--border);${i % 2 ? 'background:#f8fafc' : ''}${r.name.includes('⭐') ? ';background:var(--pink)' : ''}">
      <td style="padding:.7rem 1rem;font-weight:${r.name.includes('⭐') ? '700' : '400'}">${r.name}</td>
      <td style="text-align:right;padding:.7rem 1rem">${r.prec}</td>
      <td style="text-align:right;padding:.7rem 1rem">${r.steps}</td>
      <td style="text-align:right;padding:.7rem 1rem;font-weight:700;color:${r.name.includes('⭐') ? 'var(--accent1)' : 'var(--dark)'}">${r.lat}</td>
      <td style="text-align:right;padding:.7rem 1rem">${r.vram}</td>
      <td style="text-align:right;padding:.7rem 1rem">${r.size}</td>
      <td style="text-align:right;padding:.7rem 1rem">${r.clip}</td>
      <td style="text-align:right;padding:.7rem 1rem;font-weight:700;color:var(--accent2)">${r.speed}</td>
    </tr>`).join('');
}

// ═══════════════════════════════════════
// MODEL EXPAND
// ═══════════════════════════════════════

function expandModel(key) {
  const d = MODEL_DETAIL_DATA[key];
  if (!d) return;
  const panel = qs('#model-detail-panel');
  qs('#mdp-tag').textContent   = d.tag;
  qs('#mdp-title').textContent = d.title;
  qs('#mdp-content').innerHTML = d.sections.map(s => `
    <div>
      <div style="font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem">${s.label}</div>
      <div style="font-size:.88rem;color:var(--dark)">${s.text}</div>
    </div>`).join('');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ═══════════════════════════════════════
// BACKEND FLOW DETAIL
// ═══════════════════════════════════════

const FLOW_DETAILS = {
  client: { title:'Browser Client', text:'React 18 SPA. HTTP POST to /api/v1/generate with JSON body. Response includes image_url, full performance telemetry, and quality metrics.' },
  auth:   { title:'Auth & Rate Limiting', text:'Every route requires a valid session cookie. Passwords are scrypt-hashed. Sign-in is brute-force rate-limited. Per-user generation rate limits protect the GPU.' },
  generation: { title:'GenerationService', text:'Orchestrates the full pipeline: NLP analysis → Adaptive controller → GPU lease → Engine generate → CV pipeline → store image. Single-flight mutex prevents concurrent GPU jobs.' },
  engine: { title:'DiffusionEngine (SDTurboEngine)', text:'Loads pipeline lazily. Applies FP16 precision. Attaches approved LoRA adapter if configured. Tracks peak_gpu_mb per generation. Returns EngineResult with image + metadata.' },
  storage:{ title:'ImageStore', text:'Saves PNG to disk. Files served at /images/{request_id}.png. Requires signed-in session to access — gallery images are not publicly reachable.' },
  cv2:    { title:'CV Pipeline', text:'Runs after generation. Measures 13 no-reference quality metrics. 38% of images bypass correction (dead-band). Prompt intent suppressions prevent false flags.' },
  vae:    { title:'VAE Decoder', text:'Upsamples 64×64×4 latent to 512×512×3 RGB. Standard AutoencoderKL: ~52 ms. TAESD (distilled, 1.8M params): ~18 ms (65% faster).' },
  unet:   { title:'UNet Denoiser', text:'Time-conditioned ResNet UNet operating in 64×64×4 latent space. Cross-attention keys/values from CLIP text embeddings. 1–2 steps (SD-Turbo) or 4–8 steps (LCM-LoRA).' }
};

function showFlowDetail(key) {
  const d = FLOW_DETAILS[key];
  if (!d) return;
  qs('#ip-tag').textContent = 'Backend Component';
  qs('#ip-title').textContent = d.title;
  qs('#ip-purpose').textContent = d.text;
  qs('#ip-tech').textContent = '—';
  qs('#ip-input').textContent = '—';
  qs('#ip-output').textContent = '—';
  qs('#ip-file').textContent = '—';
  qs('#ip-note-row').style.display = 'none';
  qs('#info-panel').classList.add('open');
}

// ═══════════════════════════════════════
// DEMO SIMULATION
// ═══════════════════════════════════════

function selectPreset(el, text) {
  qsa('.demo-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  qs('#demo-prompt-input').value = text;
}

const MODEL_PERF = {
  sdturbo:  { latency: { quick:'247 ms', balanced:'289 ms', best:'347 ms' }, vram:'3,678 MB', clip:'0.333' },
  lcmlora:  { latency: { quick:'340 ms', balanced:'451 ms', best:'890 ms' }, vram:'2,207 MB', clip:'0.303' },
  sd15base: { latency: { quick:'4,303 ms',balanced:'10,545 ms', best:'12,430 ms' }, vram:'5,066 MB', clip:'0.316' }
};

const DEMO_STAGES = [
  { icon:'✍️', label:'User Prompt',    desc: p => `"${p.substring(0, 50)}…"` },
  { icon:'🔒', label:'Guard Check',    desc: () => 'Single-flight mutex acquired. No concurrent GPU jobs.' },
  { icon:'🔤', label:'NLP Analysis',   desc: () => 'Extracting objects, attributes, relations, lighting intent…' },
  { icon:'🎛️', label:'Resource Check', desc: () => 'GPU budget read. Best config selected within VRAM limits.' },
  { icon:'💾', label:'Model Loaded',   desc: () => 'Pipeline on CUDA device in FP16. Cached after first load.' },
  { icon:'📝', label:'CLIP Encode',    desc: () => 'Prompt → 77 BPE tokens → embedding (1,77,768).' },
  { icon:'🌀', label:'UNet Denoise',   desc: (p, m, q) => `${m==='sdturbo'?'Euler 1-2 steps':'LCM 4-8 steps'}. Latent space 64×64×4.` },
  { icon:'🖼️', label:'VAE Decode',     desc: () => 'Latent → 512×512×3 RGB. TAESD if selected.' },
  { icon:'🔬', label:'CV Gate',        desc: () => 'Quality metrics checked. 38% bypass dead-band.'},
  { icon:'✅', label:'Image Ready',    desc: (p, m, q, perf) => `Done! ${perf.latency[q]} · ${perf.vram} VRAM · CLIP ${perf.clip}` }
];

let demoTimer = null;
let demoStage = -1;

function runDemoSimulation() {
  const prompt  = qs('#demo-prompt-input').value.trim() || 'A vintage leather hat';
  const model   = qs('#demo-model').value;
  const quality = qs('#demo-quality').value;
  const perf    = MODEL_PERF[model] || MODEL_PERF.sdturbo;

  // Reset
  clearInterval(demoTimer);
  demoStage = -1;
  qs('#demo-stage-status').textContent = 'Starting…';

  // Resource readout
  qs('#dr-latency').textContent = perf.latency[quality];
  qs('#dr-vram').textContent    = perf.vram;
  qs('#dr-clip').textContent    = perf.clip;

  // Build dot indicators
  const dotsEl = qs('#demo-step-dots');
  dotsEl.innerHTML = '';
  DEMO_STAGES.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    dot.style.width = '8px'; dot.style.height = '8px';
    dotsEl.appendChild(dot);
  });

  // NLP result
  const nlpPanel = qs('#demo-nlp-result');
  nlpPanel.style.display = 'none';

  function advance() {
    demoStage++;
    if (demoStage >= DEMO_STAGES.length) { clearInterval(demoTimer); return; }

    const s = DEMO_STAGES[demoStage];
    const desc = s.desc(prompt, model, quality, perf);

    // Visual
    qs('#demo-stage-visual').innerHTML = `
      <div class="stage-box" style="opacity:1;transform:scale(1.05)">
        <div class="stage-box-icon">${s.icon}</div>
        <div class="stage-box-label">${s.label}</div>
      </div>
      <div style="color:rgba(255,255,255,.8);max-width:300px;font-size:.88rem;text-align:left;line-height:1.6">${desc}</div>`;
    qs('#demo-stage-status').textContent = `Stage ${demoStage + 1} of ${DEMO_STAGES.length}: ${s.label}`;

    // Dots
    qsa('.step-dot', dotsEl).forEach((dot, i) => {
      dot.classList.toggle('active', i === demoStage);
      dot.classList.toggle('done', i < demoStage);
    });

    // Show NLP result at stage 2
    if (demoStage === 2) {
      const words = prompt.split(' ');
      const objects = words.filter(w => w.length > 4 && !['with','from','into','that','this','soft','golden','hour'].includes(w.toLowerCase())).slice(0, 3);
      qs('#demo-nlp-content').innerHTML = `
        <div style="margin-bottom:.5rem"><span style="font-weight:700">Objects detected:</span> ${objects.join(', ')}</div>
        <div style="margin-bottom:.5rem"><span style="font-weight:700">Lighting:</span> ${prompt.toLowerCase().includes('golden') ? 'golden hour (time_of_day)' : prompt.toLowerCase().includes('night') ? 'nighttime (time_of_day)' : 'unspecified'}</div>
        <div style="margin-bottom:.5rem"><span style="font-weight:700">Complexity:</span> ${words.length > 10 ? 'complex' : 'moderate'}</div>
        <div><span style="font-weight:700">Intent suppressions:</span> ${prompt.toLowerCase().includes('golden') ? 'colour_cast (warm tone is intentional)' : 'none'}</div>`;
      nlpPanel.style.display = 'block';
    }
  }

  advance();
  demoTimer = setInterval(advance, 1800);
}

// ═══════════════════════════════════════
// LATENCY BAR CHART
// ═══════════════════════════════════════

function initLatencyBars() {
  const container = qs('#latency-bars');
  container.innerHTML = LATENCY_BARS.map(b => `
    <div class="bar-row">
      <div class="bar-label">${b.label}</div>
      <div class="bar-track">
        <div class="bar-fill ${b.cls}" style="width:0%" data-pct="${b.pct}" data-ms="${b.ms}"></div>
      </div>
      <div style="min-width:85px;font-size:.83rem;font-weight:700;color:${b.color}">${b.ms.toLocaleString()} ms</div>
    </div>`).join('');

  // Animate on scroll
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        qsa('.bar-fill', e.target).forEach(bar => {
          bar.style.width = bar.dataset.pct + '%';
          bar.textContent = bar.dataset.ms > 999 ? Math.round(bar.dataset.ms / 1000) + 's' : bar.dataset.ms + 'ms';
        });
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -80px 0px' });
  io.observe(container);
}

// ═══════════════════════════════════════
// COUNTING ANIMATION
// ═══════════════════════════════════════

function initCounters() {
  qsa('.metric-value[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.id === 'm-vram' ? '%' : '×';
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        let val = 0;
        const step = target / 50;
        const timer = setInterval(() => {
          val = Math.min(val + step, target);
          el.textContent = Math.round(val) + suffix;
          if (val >= target) clearInterval(timer);
        }, 30);
        io.unobserve(e.target);
      });
    });
    io.observe(el);
  });
}

// ═══════════════════════════════════════
// TECH GRID
// ═══════════════════════════════════════

function initTechGrid() {
  qs('#tech-grid').innerHTML = TECH_STACK.map(t => `
    <div class="tech-card">
      <div class="tech-card-icon">${t.icon}</div>
      <div class="tech-card-name">${t.name}</div>
      <div class="tech-card-desc">${t.desc}</div>
    </div>`).join('');
}

// ═══════════════════════════════════════
// STATUS TIMELINE
// ═══════════════════════════════════════

function initTimeline() {
  const statusLabel = { impl:'Implemented', part:'Partially Implemented', plan:'Planned / Future' };
  const statusClass = { impl:'status-impl', part:'status-part', plan:'status-plan' };
  qs('#status-timeline').innerHTML = STATUS_ITEMS.map(s => `
    <div class="timeline-item">
      <div class="timeline-dot ${s.color}"></div>
      <div class="timeline-title">
        ${s.title}
        <span class="status-badge ${statusClass[s.status]}">${statusLabel[s.status]}</span>
      </div>
      <div class="timeline-desc">${s.desc}</div>
    </div>`).join('');
}

// ═══════════════════════════════════════
// STAGE DETAIL LABEL PATCH
// ═══════════════════════════════════════

function patchStageDetailLabel() {
  // Ensure the "Stage N of 9" label renders correctly after initPipeline
  const detail = qs('#stage-detail');
  if (!detail) return;
  // Insert a label div if not already there
  const existing = qs('#sd-stage-label');
  if (!existing) {
    const inner = detail.querySelector('div:first-child > div:first-child');
    if (inner) inner.id = 'sd-stage-label';
  }
}

// ═══════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initProgressBar();
  initNav();
  initAOS();
  initHeroAnim();
  initArchNodes();
  initPipeline();
  patchStageDetailLabel();
  initModelTable();
  initLatencyBars();
  initCounters();
  initTechGrid();
  initTimeline();
});

// ---------------------------------------
// SECTION D: INTERACTIVE FILTER SIMULATOR
// ---------------------------------------

function applySimFilter(type, el) {
  qsa('.filter-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const box = qs('#sim-filter-box');
  const title = qs('#sim-title');
  const desc = qs('#sim-desc');
  const tag = qs('#sim-tag');
  const icon = qs('#sim-icon');

  const configs = {
    raw: {
      title: 'Raw Generated Image',
      desc: 'Output directly from SD-Turbo UNet & VAE decode. Sharpness: 1420.5 | Noise s: 2.8 | Brightness: 0.58.',
      tag: 'Active: RAW',
      icon: '???',
      filter: 'none'
    },
    clahe: {
      title: 'Contrast-Limited Adaptive Histogram Equalisation (CLAHE)',
      desc: 'Applied strictly on the lightness channel (L in CIELAB or V in HSV). Enhances local micro-contrast without blowing out shadows or highlights.',
      tag: 'Active: CLAHE (clip_limit=1.5, lab_l)',
      icon: '??',
      filter: 'contrast(1.2) brightness(1.05)'
    },
    wb: {
      title: 'Gray-World White Balance',
      desc: 'Normalises channel means toward the overall luminance mean. Clamped to [1/1.25, 1.25] to prevent over-correction.',
      tag: 'Active: White Balance (gray-world, strength=0.6)',
      icon: '??',
      filter: 'sepia(0.1) saturate(1.1)'
    },
    bilateral: {
      title: 'Bilateral Edge-Preserving Smoothing',
      desc: 'Smooths flat spatial regions while preserving high-contrast gradients and structural edges.',
      tag: 'Active: Bilateral Filter (d=5, sigma=50)',
      icon: '?',
      filter: 'blur(0.5px) contrast(1.05)'
    },
    all: {
      title: 'Auto-Enhance Combined Pipeline',
      desc: 'Sequential execution: Dead-band Check ? Gray-World White Balance ? Log Gamma Exposure ? Mild CLAHE Contrast.',
      tag: 'Active: auto_enhance (Guarded)',
      icon: '??',
      filter: 'contrast(1.15) brightness(1.03) saturate(1.08)'
    }
  };

  const c = configs[type] || configs.raw;
  if (title) title.textContent = c.title;
  if (desc) desc.textContent = c.desc;
  if (tag) tag.textContent = c.tag;
  if (icon) icon.textContent = c.icon;
  if (box) box.style.filter = c.filter;
}
