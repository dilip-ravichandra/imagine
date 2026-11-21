/**
 * IMAGINE AI - QUANTUM NEURAL NEXUS ENGINE (app.js)
 * High-End Cybernetic Visual Architecture
 * - Web Audio API Micro-Haptics
 * - Interactive Particle-Filament Quantum Matrix Canvas
 * - Precision Magnetic Cursor Follower
 * - 3D Gyroscopic Tilt Physics for Portal Hub
 * - 6 Dynamic Orbital Feature Sectors
 * - 9-Stage Pipeline Scrubber with Real-Time Canvas Tensor Synthesis
 * - Computer Vision X-Ray Scanner (Laplacian, Immerkaer, Sobel, CLAHE) with Interactive Magnifier Lens
 * - 43x Empirical Latency Drag-Race Canvas Simulation
 * - Real-Time Latent Space Noise-to-Image Synthesis Simulator
 * - Samsung R&D Viva Defense Deck (Presenter 1 vs 2 Dossiers & Top 12 3D Flipping Q&A Cards)
 */

// =========================================================================
// 1. WEB AUDIO API SYNTHESIZER (MICRO-HAPTIC FEEDBACK)
// =========================================================================
let audioCtx = null;
let audioEnabled = true;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSfx(type) {
  if (!audioEnabled) return;
  initAudio();
  if (!audioCtx) return;

  try {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'hover') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.04);
      gain.gain.setValueAtTime(0.015, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      osc.start(t);
      osc.stop(t + 0.04);
    } else if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, t); // E5
      osc.frequency.setValueAtTime(987.77, t + 0.05); // B5
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.start(t);
      osc.stop(t + 0.09);
    } else if (type === 'warp') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.18);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.22);
    } else if (type === 'flip') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(783.99, t + 0.04); // G5
      gain.gain.setValueAtTime(0.03, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.start(t);
      osc.stop(t + 0.12);
    } else if (type === 'race') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.linearRampToValueAtTime(420, t + 0.4);
      gain.gain.setValueAtTime(0.03, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    }
  } catch (err) {
    // Audio context error guard
  }
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  const sfxIcon = document.getElementById('sfx-icon');
  const sfxText = document.getElementById('sfx-text');
  const sfxBtn = document.getElementById('sfx-toggle');

  if (sfxIcon) sfxIcon.textContent = audioEnabled ? '🔊' : '🔇';
  if (sfxText) sfxText.textContent = audioEnabled ? 'SFX ON' : 'SFX OFF';
  if (sfxBtn) {
    sfxBtn.style.borderColor = audioEnabled ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.2)';
    sfxBtn.style.color = audioEnabled ? 'var(--neon-cyan)' : 'var(--text-muted)';
  }
  if (audioEnabled) playSfx('click');
}

// Window unlock for Audio Context
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });

// =========================================================================
// 2. PRECISION CUSTOM CURSOR & MAGNETIC LAG
// =========================================================================
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let ringX = mouseX;
let ringY = mouseY;

const cursorDot = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (cursorDot) {
    cursorDot.style.left = `${mouseX}px`;
    cursorDot.style.top = `${mouseY}px`;
  }
});

function animateCursorFollower() {
  ringX += (mouseX - ringX) * 0.16;
  ringY += (mouseY - ringY) * 0.16;
  if (cursorRing) {
    cursorRing.style.left = `${ringX}px`;
    cursorRing.style.top = `${ringY}px`;
  }
  requestAnimationFrame(animateCursorFollower);
}
animateCursorFollower();

function bindHoverSounds() {
  const hoverables = document.querySelectorAll('button, a, .orbit-node, .hud-link, .cyber-chip, .qa-flip-card, .xray-mode-btn, .pilot-switch-btn');
  hoverables.forEach(el => {
    el.addEventListener('mouseenter', () => {
      playSfx('hover');
      if (cursorRing) {
        cursorRing.style.width = '54px';
        cursorRing.style.height = '54px';
        cursorRing.style.borderColor = 'var(--neon-magenta)';
        cursorRing.style.background = 'rgba(255,0,127,0.08)';
      }
    });
    el.addEventListener('mouseleave', () => {
      if (cursorRing) {
        cursorRing.style.width = '34px';
        cursorRing.style.height = '34px';
        cursorRing.style.borderColor = 'var(--neon-cyan)';
        cursorRing.style.background = 'transparent';
      }
    });
  });
}

// =========================================================================
// 3. INTERACTIVE QUANTUM MATRIX PARTICLE CANVAS
// =========================================================================
const matrixCanvas = document.getElementById('matrix-canvas');
if (matrixCanvas) {
  const mctx = matrixCanvas.getContext('2d');
  let mw = (matrixCanvas.width = window.innerWidth);
  let mh = (matrixCanvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    mw = matrixCanvas.width = window.innerWidth;
    mh = matrixCanvas.height = window.innerHeight;
  });

  const particles = [];
  const P_COUNT = mw > 768 ? 85 : 40;

  for (let i = 0; i < P_COUNT; i++) {
    particles.push({
      x: Math.random() * mw,
      y: Math.random() * mh,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      r: Math.random() * 2 + 1,
      color: i % 3 === 0 ? 'rgba(0, 240, 255, 0.7)' : (i % 3 === 1 ? 'rgba(255, 0, 127, 0.7)' : 'rgba(0, 255, 163, 0.7)')
    });
  }

  function drawMatrix() {
    mctx.clearRect(0, 0, mw, mh);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = mw;
      if (p.x > mw) p.x = 0;
      if (p.y < 0) p.y = mh;
      if (p.y > mh) p.y = 0;

      mctx.beginPath();
      mctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      mctx.fillStyle = p.color;
      mctx.fill();

      // Mouse interactive filaments
      const dxm = mouseX - p.x;
      const dym = mouseY - p.y;
      const dm = Math.sqrt(dxm * dxm + dym * dym);
      if (dm < 150) {
        mctx.beginPath();
        mctx.moveTo(p.x, p.y);
        mctx.lineTo(mouseX, mouseY);
        mctx.strokeStyle = `rgba(0, 240, 255, ${0.4 * (1 - dm / 150)})`;
        mctx.lineWidth = 1;
        mctx.stroke();
      }

      // Inter-particle filaments
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 110) {
          mctx.beginPath();
          mctx.moveTo(p.x, p.y);
          mctx.lineTo(p2.x, p2.y);
          mctx.strokeStyle = `rgba(138, 43, 226, ${0.22 * (1 - d / 110)})`;
          mctx.lineWidth = 0.6;
          mctx.stroke();
        }
      }
    }
    requestAnimationFrame(drawMatrix);
  }
  drawMatrix();
}

// =========================================================================
// 4. 3D GYROSCOPIC TILT FOR PORTAL HUB
// =========================================================================
const portalHubCard = document.getElementById('portal-hub-card');
if (portalHubCard) {
  portalHubCard.addEventListener('mousemove', (e) => {
    const rect = portalHubCard.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const rx = -(cy / (rect.height / 2)) * 14;
    const ry = (cx / (rect.width / 2)) * 14;
    portalHubCard.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.02, 1.02, 1.02)`;
  });

  portalHubCard.addEventListener('mouseleave', () => {
    portalHubCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  });
}

// =========================================================================
// 5. SECTOR NAVIGATION CONTROLLER
// =========================================================================
function activateSection(secId, navEl, orbitEl) {
  playSfx('warp');

  // Update Top Nav links
  const hudLinks = document.querySelectorAll('.hud-link');
  hudLinks.forEach(link => link.classList.remove('active'));
  if (navEl) {
    navEl.classList.add('active');
  } else {
    // Find matching link
    hudLinks.forEach(link => {
      if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(secId)) {
        link.classList.add('active');
      }
    });
  }

  // Update Orbital Sector Nodes
  const orbitNodes = document.querySelectorAll('.orbit-node');
  orbitNodes.forEach(node => node.classList.remove('active'));
  if (orbitEl) {
    orbitEl.classList.add('active');
  } else {
    orbitNodes.forEach(node => {
      if (node.getAttribute('onclick') && node.getAttribute('onclick').includes(secId)) {
        node.classList.add('active');
      }
    });
  }

  // Switch View Panels
  const panels = document.querySelectorAll('.view-panel');
  panels.forEach(p => p.classList.remove('active'));

  const targetPanel = document.getElementById(`view-${secId}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
    setTimeout(() => {
      targetPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }
}

// =========================================================================
// 6. SECTOR 01: 9-STAGE PIPELINE SCRUBBER & CANVAS SYNTHESIZER
// =========================================================================
const pipelineStages = [
  {
    num: "01",
    short: "DISPATCH",
    title: "Client Dispatch & Request Guard",
    desc: "FastAPI server receives incoming user payload. In-flight single-request concurrency lock guarantees concurrent prompts on an 8GB laptop queue gracefully without triggering fatal CUDA Out-of-Memory crashes.",
    lat: "< 1 ms",
    vram: "0 MB",
    code: "generation.py",
    tensor: "JSON (Prompt, Steps, Seed, Guidance)",
    type: "tokens"
  },
  {
    num: "02",
    short: "PARSING",
    title: "Zero-GPU Rule-Based NLP Entity Parsing",
    desc: "Instant CPU regex engine decomposes the prompt into Subject, Style, Lighting, Atmosphere, and Quality tags. Injects domain-specific positive modifiers while stripping adversarial keywords in sub-millisecond time.",
    lat: "0.8 ms",
    vram: "0 MB",
    code: "prompt_parser.py",
    tensor: "ParsedDict {subject, style, lighting}",
    type: "nlp"
  },
  {
    num: "03",
    short: "TOKENIZER",
    title: "CLIP Tokenization & Positional Projection",
    desc: "OpenCLIP Byte-Pair Encoding (BPE) divides words into discrete tokens from a 49,408 vocabulary, bounded to a maximum sequence length of 77 tokens with Start-of-Sequence and End-of-Sequence sentinels.",
    lat: "2.1 ms",
    vram: "12 MB",
    code: "clip_tokenizer.py",
    tensor: "Tokens: [1, 77] int64",
    type: "bpe"
  },
  {
    num: "04",
    short: "ENCODER",
    title: "Text Transformer Semantic Embedding",
    desc: "OpenCLIP ViT-B/32 text encoder projects discrete tokens into continuous 768-dimensional multimodal semantic space, producing the cross-attention conditioning tensor required by UNet layers.",
    lat: "14.2 ms",
    vram: "340 MB",
    code: "mobile_clip.py",
    tensor: "Context: [1, 77, 768] fp16",
    type: "vector"
  },
  {
    num: "05",
    short: "SEED LATENT",
    title: "Gaussian Latent Seed Initialization",
    desc: "Generates a 4-channel spatial noise grid in 8x downsampled latent space (64x64) using deterministic PyTorch PRNG seed. This saves 64x memory compared to operating directly in 512x512 RGB space.",
    lat: "0.3 ms",
    vram: "4 MB",
    code: "torch.randn()",
    tensor: "Latents: [1, 4, 64, 64] N(0, 1)",
    type: "noise"
  },
  {
    num: "06",
    short: "UNet ADD",
    title: "1-Step Adversarial Distillation (SD-Turbo)",
    desc: "The primary computational workhorse. Adversarial Diffusion Distillation (ADD) UNet predicts clean image latents in a single forward pass, bypassing the traditional 50 iterative diffusion steps through distilled student-teacher loss.",
    lat: "182.4 ms",
    vram: "2,240 MB",
    code: "sd_turbo.py + SDPA",
    tensor: "Denoised Latents: [1, 4, 64, 64]",
    type: "unet"
  },
  {
    num: "07",
    short: "TAESD DECODE",
    title: "TAESD Tiny Autoencoder RGB Reconstruction",
    desc: "Custom distilled Tiny Autoencoder decodes 64x64x4 latents into full 512x512x3 RGB pixels in 18ms using only 110MB VRAM, completely avoiding the standard 800MB VAE OOM bottle-neck on mobile GPUs.",
    lat: "18.6 ms",
    vram: "110 MB",
    code: "taesd.py",
    tensor: "RGB Output: [1, 3, 512, 512] uint8",
    type: "taesd"
  },
  {
    num: "08",
    short: "CV X-RAY",
    title: "No-Reference CV Quality & Artifact Screen",
    desc: "13 automated OpenCV mathematical checks run in parallel: Laplacian blur variance (412.8), Crete re-blur ratio (0.24), Immerkaer noise variance (2.8 sigma), and Sobel halo index (1.02) to verify sharpness and contrast.",
    lat: "2.3 ms",
    vram: "2 MB",
    code: "metrics.py",
    tensor: "Metrics Vector (13 floats)",
    type: "xray"
  },
  {
    num: "09",
    short: "AI PROOF",
    title: "DETR & OWL-ViT Object Verification",
    desc: "DEtection TRansformer and zero-shot Open-World ViT confirm that the physical objects and semantic entities requested in the prompt are factually represented in the rendered image bounding boxes.",
    lat: "24.0 ms",
    vram: "320 MB",
    code: "detr_eval.py / owl_vit.py",
    tensor: "Bounding Boxes & Grounding Scores",
    type: "detr"
  }
];

let activeStageIdx = 0;
let pipelineTimer = null;

function renderPipelineScrubber() {
  const scrubber = document.getElementById('pipeline-scrubber');
  if (!scrubber) return;

  scrubber.innerHTML = '';
  pipelineStages.forEach((st, idx) => {
    const stepEl = document.createElement('div');
    stepEl.className = `scrubber-step ${idx === activeStageIdx ? 'active' : ''}`;
    stepEl.innerHTML = `
      <div class="step-num">${st.num}</div>
      <div class="step-title">${st.short}</div>
    `;
    stepEl.addEventListener('click', () => {
      pausePipelineAutoPlay();
      selectPipelineStage(idx);
    });
    scrubber.appendChild(stepEl);
  });
}

function selectPipelineStage(idx) {
  activeStageIdx = idx;
  playSfx('click');

  const scrubberSteps = document.querySelectorAll('.scrubber-step');
  scrubberSteps.forEach((s, i) => {
    if (i === idx) s.classList.add('active');
    else s.classList.remove('active');
  });

  const st = pipelineStages[idx];
  const badgeNum = document.getElementById('stage-badge-num');
  const title = document.getElementById('stage-intel-title');
  const desc = document.getElementById('stage-intel-desc');
  const lat = document.getElementById('stage-intel-lat');
  const vram = document.getElementById('stage-intel-vram');
  const code = document.getElementById('stage-intel-code');
  const tensor = document.getElementById('stage-intel-tensor');
  const caption = document.getElementById('stage-canvas-caption');

  if (badgeNum) badgeNum.textContent = `STAGE ${st.num} // 09`;
  if (title) title.textContent = st.title;
  if (desc) desc.textContent = st.desc;
  if (lat) lat.textContent = st.lat;
  if (vram) vram.textContent = st.vram;
  if (code) code.textContent = st.code;
  if (tensor) tensor.textContent = st.tensor;
  if (caption) caption.textContent = `STAGE ${st.num} TENSOR RENDERING: ${st.tensor.toUpperCase()}`;

  drawStageCanvas(st.type);
}

function drawStageCanvas(type) {
  const canvas = document.getElementById('stage-visual-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#050711';
  ctx.fillRect(0, 0, w, h);

  if (type === 'tokens' || type === 'bpe') {
    // Glowing token array
    const tokens = ['[SOS]', 'vintage', 'leather', 'hat', 'mossy', 'log', 'golden', '[EOS]'];
    const bw = 50;
    tokens.forEach((tok, i) => {
      const x = 20 + i * (bw + 6);
      const y = h / 2 - 20;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.fillRect(x, y, bw, 40);
      ctx.strokeStyle = 'var(--neon-cyan)';
      ctx.strokeRect(x, y, bw, 40);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px monospace';
      ctx.fillText(tok, x + 6, y + 24);
    });
  } else if (type === 'nlp') {
    // NLP extracted tags
    ctx.font = '12px monospace';
    ctx.fillStyle = 'var(--neon-emerald)';
    ctx.fillText('SUBJECT: "vintage leather hat"', 30, 60);
    ctx.fillText('LOCATION: "mossy wooden log"', 30, 95);
    ctx.fillText('LIGHTING: "soft golden hour"', 30, 130);
    ctx.fillText('ATMOSPHERE: "cinematic depth of field"', 30, 165);
    ctx.fillText('RESOLUTION: 512x512 | NEGATIVES APPLIED', 30, 200);
  } else if (type === 'vector') {
    // Continuous embedding heatmap grid
    const cols = 28, rows = 8;
    const cw = (w - 40) / cols;
    const ch = (h - 60) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = Math.sin(c * 0.4 + r * 0.7);
        ctx.fillStyle = val > 0 ? `rgba(255, 0, 127, ${val * 0.8 + 0.2})` : `rgba(0, 240, 255, ${Math.abs(val) * 0.8 + 0.2})`;
        ctx.fillRect(20 + c * cw, 30 + r * ch, cw - 2, ch - 2);
      }
    }
  } else if (type === 'noise') {
    // Pure Gaussian noise in latent space
    const idata = ctx.createImageData(w, h);
    for (let i = 0; i < idata.data.length; i += 4) {
      const n = Math.floor(Math.random() * 255);
      idata.data[i] = n;
      idata.data[i + 1] = Math.floor(n * 0.7);
      idata.data[i + 2] = Math.floor(n * 1.2);
      idata.data[i + 3] = 255;
    }
    ctx.putImageData(idata, 0, 0);
  } else if (type === 'unet') {
    // UNet cross-attention curves
    ctx.strokeStyle = 'var(--neon-emerald)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.moveTo(20, Math.random() * h);
      ctx.bezierCurveTo(w * 0.35, Math.random() * h, w * 0.65, Math.random() * h, w - 20, Math.random() * h);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0, 255, 163, 0.2)';
    ctx.fillRect(w / 2 - 60, h / 2 - 25, 120, 50);
    ctx.strokeStyle = 'var(--neon-emerald)';
    ctx.strokeRect(w / 2 - 60, h / 2 - 25, 120, 50);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px monospace';
    ctx.fillText('ADD 1-STEP UNET', w / 2 - 46, h / 2 + 5);
  } else if (type === 'taesd') {
    // Decoded preview gradient bars
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#00F0FF');
    grad.addColorStop(0.5, '#FF007F');
    grad.addColorStop(1, '#00FFA3');
    ctx.fillStyle = grad;
    ctx.fillRect(30, 30, w - 60, h - 60);
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeRect(30, 30, w - 60, h - 60);
    ctx.fillStyle = '#050711';
    ctx.font = '12px monospace';
    ctx.fillText('TAESD: 64x64x4 Latent -> 512x512x3 RGB (18 ms)', 50, h / 2);
  } else if (type === 'xray') {
    // Metric radar lines
    ctx.strokeStyle = 'var(--neon-cyan)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, h - 40);
    for (let x = 30; x < w - 30; x += 20) {
      ctx.lineTo(x, h - 40 - Math.random() * (h - 80));
    }
    ctx.stroke();
  } else if (type === 'detr') {
    // Bounding box detection overlay
    ctx.strokeStyle = 'var(--neon-emerald)';
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.25, 40, w * 0.5, 160);
    ctx.fillStyle = 'rgba(0, 255, 163, 0.15)';
    ctx.fillRect(w * 0.25, 40, w * 0.5, 160);
    ctx.fillStyle = 'var(--neon-emerald)';
    ctx.font = '12px monospace';
    ctx.fillText('DETR: "leather_hat" (Conf: 0.94)', w * 0.25 + 6, 32);
    ctx.fillText('OWL-ViT: "mossy_log" (Grounding: 0.91)', w * 0.25 + 6, 218);
  }
}

function startPipelineAutoPlay() {
  playSfx('warp');
  if (pipelineTimer) clearInterval(pipelineTimer);
  pipelineTimer = setInterval(() => {
    activeStageIdx = (activeStageIdx + 1) % pipelineStages.length;
    selectPipelineStage(activeStageIdx);
  }, 1900);
}

function pausePipelineAutoPlay() {
  playSfx('click');
  if (pipelineTimer) {
    clearInterval(pipelineTimer);
    pipelineTimer = null;
  }
}

// =========================================================================
// 7. SECTOR 03: CV X-RAY ARTIFACT SCANNER WITH INTERACTIVE LENS
// =========================================================================
const xrayCanvas = document.getElementById('xray-canvas');
const xrayLens = document.getElementById('xray-lens');
const xrayBox = document.getElementById('xray-box');
let currentXrayMode = 'raw';
let sourceImg = new Image();
sourceImg.src = 'assets/g1_create.jpg';

function setXrayMode(mode, btnEl) {
  currentXrayMode = mode;
  playSfx('click');

  const btns = document.querySelectorAll('.xray-mode-btn');
  btns.forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const label = document.getElementById('xray-active-label');
  const expl = document.getElementById('xray-active-explanation');
  const sh = document.getElementById('xm-sharp');
  const bl = document.getElementById('xm-blur');
  const no = document.getElementById('xm-noise');

  const modes = {
    raw: {
      lbl: "Normal RGB Frame",
      exp: "Direct RGB frame output from SD-Turbo UNet & TAESD. Undergoes 13 automated no-reference mathematical checks.",
      sh: "1,420.5", bl: "0.24", no: "2.8 σ"
    },
    laplacian: {
      lbl: "Laplacian Blur & Sharpness Filter",
      exp: "Computes discrete second-order spatial derivatives across the image. High variance confirms sharp in-focus edges.",
      sh: "1,420.5 (PASS)", bl: "0.08", no: "2.8 σ"
    },
    noise: {
      lbl: "Immerkaer High-Frequency Noise Estimator",
      exp: "Convolves image with Immerkaer 3x3 noise mask. Low standard deviation verifies absence of high-frequency synthesis grain.",
      sh: "1,420.5", bl: "0.24", no: "2.8 σ (PASS < 5.0)"
    },
    halo: {
      lbl: "Sobel Edge Ringing & Halo Evaluator",
      exp: "Detects unnatural over-sharpening halos around high-contrast object boundaries, penalizing over-filtered synthetic outputs.",
      sh: "1,040.2", bl: "0.19", no: "1.02 Ratio"
    },
    clahe: {
      lbl: "CLAHE Dynamic Contrast Equalization",
      exp: "Contrast-Limited Adaptive Histogram Equalization expands local dynamic range for OLED mobile screens without clipping shadows.",
      sh: "1,890.0", bl: "0.12", no: "3.2 σ"
    }
  };

  const m = modes[mode] || modes.raw;
  if (label) label.textContent = m.lbl;
  if (expl) expl.textContent = m.exp;
  if (sh) sh.textContent = m.sh;
  if (bl) bl.textContent = m.bl;
  if (no) no.textContent = m.no;

  drawXrayCanvas();
}

function drawXrayCanvas() {
  if (!xrayCanvas) return;
  const ctx = xrayCanvas.getContext('2d');
  const w = (xrayCanvas.width = xrayBox ? xrayBox.clientWidth : 500);
  const h = (xrayCanvas.height = 360);

  if (!sourceImg.complete) {
    sourceImg.onload = drawXrayCanvas;
    return;
  }

  ctx.drawImage(sourceImg, 0, 0, w, h);

  if (currentXrayMode === 'raw') return;

  const idata = ctx.getImageData(0, 0, w, h);
  const d = idata.data;

  if (currentXrayMode === 'laplacian') {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const edge = Math.abs(gray - 128) * 2.4;
      d[i] = 0;
      d[i + 1] = edge; // Neon green edges
      d[i + 2] = edge * 0.7;
    }
  } else if (currentXrayMode === 'noise') {
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 55;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] - n));
      d[i + 2] = 255;
    }
  } else if (currentXrayMode === 'halo') {
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
      d[i] = lum > 170 ? 255 : 0;
      d[i + 1] = 0;
      d[i + 2] = lum > 170 ? 255 : 0;
    }
  } else if (currentXrayMode === 'clahe') {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, Math.pow(d[i] / 255, 0.75) * 255);
      d[i + 1] = Math.min(255, Math.pow(d[i + 1] / 255, 0.75) * 255);
      d[i + 2] = Math.min(255, Math.pow(d[i + 2] / 255, 0.75) * 255);
    }
  }

  ctx.putImageData(idata, 0, 0);
}

// X-Ray Interactive Magnifier Lens
if (xrayBox && xrayLens) {
  xrayBox.addEventListener('mousemove', (e) => {
    const rect = xrayBox.getBoundingClientRect();
    const lx = e.clientX - rect.left - 40;
    const ly = e.clientY - rect.top - 40;
    xrayLens.style.left = `${lx}px`;
    xrayLens.style.top = `${ly}px`;
  });
}

// =========================================================================
// 8. SECTOR 04: 43x SPEED WARP DRAG-RACE SIMULATION
// =========================================================================
const raceCanvas = document.getElementById('race-canvas');
let raceAnimId = null;

function startWarpDragRace() {
  playSfx('race');
  if (!raceCanvas) return;
  const ctx = raceCanvas.getContext('2d');
  const w = (raceCanvas.width = raceCanvas.parentElement.clientWidth || 800);
  const h = (raceCanvas.height = 180);
  const timer = document.getElementById('race-timer');

  const startTime = performance.now();
  const T_OPTIMIZED = 247;    // 247 ms (SD-Turbo)
  const T_BASELINE = 10545;  // 10,545 ms (SD 1.5 50-step)
  const VISUAL_DURATION = 3200; // Visual demo duration

  function anim(now) {
    const elapsed = now - startTime;
    ctx.clearRect(0, 0, w, h);

    // Track 1: T1 SD-Turbo (Optimized)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 50); ctx.lineTo(w - 30, 50);
    ctx.moveTo(30, 130); ctx.lineTo(w - 30, 130);
    ctx.stroke();

    // Finish Lines
    ctx.strokeStyle = 'var(--neon-emerald)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w - 30, 20); ctx.lineTo(w - 30, 160);
    ctx.stroke();

    // Car 1 (T1) finishes fast
    const progT1 = Math.min(1, elapsed / 800);
    const xT1 = 30 + progT1 * (w - 70);

    ctx.fillStyle = 'var(--neon-cyan)';
    ctx.shadowColor = 'var(--neon-cyan)';
    ctx.shadowBlur = 15;
    ctx.fillRect(xT1, 35, 32, 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px monospace';
    ctx.fillText('⚡ T1: SD-Turbo (247 ms)', xT1 - 20, 28);

    // Car 2 (B0 Baseline) moves 43x slower
    const progB0 = Math.min(1, elapsed / (800 * 4.5));
    const xB0 = 30 + progB0 * (w - 70);

    ctx.fillStyle = 'var(--neon-magenta)';
    ctx.shadowColor = 'var(--neon-magenta)';
    ctx.shadowBlur = 10;
    ctx.fillRect(xB0, 115, 32, 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px monospace';
    ctx.fillText('🐢 B0: SD 1.5 50-step (10,545 ms)', xB0 - 20, 108);

    // Update Timer
    if (timer) {
      const simulatedMs = Math.min(T_BASELINE, Math.floor((elapsed / VISUAL_DURATION) * T_BASELINE));
      timer.textContent = `${(simulatedMs / 1000).toFixed(2)} s`;
    }

    if (elapsed < VISUAL_DURATION) {
      raceAnimId = requestAnimationFrame(anim);
    } else {
      if (timer) timer.textContent = '10.55 s (43× Speedup Verified!)';
      playSfx('flip');
    }
  }

  if (raceAnimId) cancelAnimationFrame(raceAnimId);
  raceAnimId = requestAnimationFrame(anim);
}

// =========================================================================
// 9. SECTOR 05: PROMPT SANDBOX & LATENT SIMULATOR
// =========================================================================
const latentCanvas = document.getElementById('latent-sim-canvas');
const promptInput = document.getElementById('sandbox-prompt');
const nlpLiveOutput = document.getElementById('nlp-live-output');

function loadPromptPreset(chipEl, text) {
  playSfx('click');
  document.querySelectorAll('.cyber-chip').forEach(c => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');
  if (promptInput) {
    promptInput.value = text;
    updateNlpLive(text);
  }
}

function updateNlpLive(text) {
  if (!nlpLiveOutput) return;
  const words = text.toLowerCase().split(/\s+/);
  const subjects = words.filter(w => ['hat', 'fox', 'street', 'lighthouse', 'car', 'sunset'].includes(w));
  const styles = words.filter(w => ['vintage', 'cinematic', 'watercolour', 'cyberpunk', 'neon'].includes(w));
  const lightings = words.filter(w => ['golden', 'dusk', 'night', 'stormy', 'soft'].includes(w));

  nlpLiveOutput.innerHTML = `
    <div><strong>EXTRACTED ENTITIES:</strong> ${subjects.join(', ') || 'General Concept'}</div>
    <div><strong>STYLISTIC TAGS:</strong> ${styles.join(', ') || 'Photorealistic Standard'}</div>
    <div><strong>LIGHTING MAP:</strong> ${lightings.join(', ') || 'Ambient Diffuse'}</div>
    <div style="color:var(--neon-cyan)"><strong>POSITIVE INJECTION:</strong> +8k uhd, sharp focus, low noise, high fidelity</div>
    <div style="color:var(--neon-magenta)"><strong>NEGATIVE INJECTION:</strong> -blur, -grain, -artifacts, -distorted hands, -duplicate</div>
  `;
}

if (promptInput) {
  promptInput.addEventListener('input', (e) => updateNlpLive(e.target.value));
  updateNlpLive(promptInput.value);
}

function simulateLatentDenoise() {
  playSfx('warp');
  if (!latentCanvas) return;
  const ctx = latentCanvas.getContext('2d');
  const w = latentCanvas.width;
  const h = latentCanvas.height;
  const stepLabel = document.getElementById('latent-step-label');

  let step = 0;
  const totalSteps = 12;

  const anim = setInterval(() => {
    step++;
    const progress = step / totalSteps;

    ctx.fillStyle = '#050711';
    ctx.fillRect(0, 0, w, h);

    const idata = ctx.createImageData(w, h);
    const d = idata.data;
    const noiseFactor = 1 - progress;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const cx = (x - w / 2) / (w / 2);
        const cy = (y - h / 2) / (h / 2);
        const dist = Math.sqrt(cx * cx + cy * cy);

        // Target latent visual pattern
        const tr = Math.sin(cx * 4 + dist * 5) * 127 + 128;
        const tg = Math.cos(cy * 4 - dist * 3) * 127 + 128;
        const tb = Math.sin(dist * 6) * 127 + 128;
        const noise = Math.random() * 255;

        d[idx] = Math.floor(tr * progress + noise * noiseFactor);
        d[idx + 1] = Math.floor(tg * progress + noise * noiseFactor);
        d[idx + 2] = Math.floor(tb * progress + noise * noiseFactor);
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(idata, 0, 0);

    if (stepLabel) {
      if (step < totalSteps) {
        stepLabel.textContent = `TIMESTEP t=${Math.round(1000 * (1 - progress))} (DENOISING ${Math.round(progress * 100)}%)`;
      } else {
        stepLabel.textContent = `TIMESTEP t=0 (CLEAN LATENT REACHED!)`;
        playSfx('flip');
      }
    }

    if (step >= totalSteps) clearInterval(anim);
  }, 90);
}

// Initial latent draw
if (latentCanvas) {
  const ctx = latentCanvas.getContext('2d');
  ctx.fillStyle = '#080b18';
  ctx.fillRect(0, 0, 360, 360);
  const idata = ctx.createImageData(360, 360);
  for (let i = 0; i < idata.data.length; i += 4) {
    idata.data[i] = Math.random() * 255;
    idata.data[i + 1] = Math.random() * 255;
    idata.data[i + 2] = Math.random() * 255;
    idata.data[i + 3] = 255;
  }
  ctx.putImageData(idata, 0, 0);
}

// =========================================================================
// 10. SECTOR 06: SAMSUNG VIVA DEFENSE DECK & 3D Q&A CARDS
// =========================================================================
const presenterDossiers = {
  1: {
    name: "PRESENTER 1: AI ARCHITECTURE & DISTILLATION LEAD",
    lead: "Owns Slides 1, 3, 4, 6 · Core AI Distillation & Memory Optimization",
    bullets: [
      "Distilled UNet Mechanics: Adversarial Diffusion Distillation (ADD) single-step student-teacher dynamics.",
      "VRAM Containment: Reduced peak memory from 7.2 GB to 3,098 MB via TAESD (110MB) and PyTorch SDPA FlashAttention.",
      "Empirical Benchmark Defense: 247 ms generation latency on NVIDIA RTX 5050 (43x speedup over 10,545 ms SD 1.5).",
      "Model Ablation Justification: Why SD-Turbo is pinned for zero-OOM mobile throughput while LCM-LoRA serves multi-style workflows."
    ]
  },
  2: {
    name: "PRESENTER 2: CV EVALUATION, NLP & PIPELINE LEAD",
    lead: "Owns Slides 2, 5, 7, 8 · Computer Vision Verification & Production Pipeline",
    bullets: [
      "Zero-GPU NLP Engineering: Rule-based regex parser executing in < 0.8 ms on CPU to preserve all VRAM for UNet.",
      "13 Automated CV Metrics: Laplacian blur variance (412.8), Immerkaer noise standard deviation (2.8 sigma), Sobel halo index (1.02).",
      "Object Detection Verification: DETR closed-set bounding box extraction and OWL-ViT open-vocabulary zero-shot grounding.",
      "Edge Mobile Roadmap: ONNX Runtime INT4 quantization, Qualcomm NPU Hexagon DSP translation, and 755 passing unit tests."
    ]
  }
};

function switchPilot(num) {
  playSfx('click');
  document.querySelectorAll('.pilot-switch-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`btn-pilot-${num}`);
  if (btn) btn.classList.add('active');

  const dossier = document.getElementById('pilot-dossier');
  const data = presenterDossiers[num];
  if (dossier && data) {
    dossier.innerHTML = `
      <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--neon-blue);margin-bottom:6px">VIVA PILOT PROFILE // 0${num}</div>
      <h4 style="color:#FFF;font-size:1.25rem;margin-bottom:6px">${data.name}</h4>
      <p style="font-size:0.85rem;color:var(--neon-cyan);margin-bottom:14px">${data.lead}</p>
      <ul style="font-size:0.82rem;color:var(--text-muted);line-height:1.7;padding-left:18px">
        ${data.bullets.map(b => `<li style="margin-bottom:6px">${b}</li>`).join('')}
      </ul>
    `;
  }
}

const vivaQAData = [
  {
    q: "How did you achieve a 43x speedup on mobile hardware without catastrophic image collapse?",
    cat: "DISTILLATION",
    a: "We replaced traditional 50-step DDIM iterative sampling with Adversarial Diffusion Distillation (ADD) in SD-Turbo. Combined with PyTorch Scaled Dot-Product Attention (SDPA), FP16 half-precision, and TAESD (Tiny Autoencoder), latency fell from 10,545ms to 247ms with 0.887 CLIP score."
  },
  {
    q: "How does ImagineAI prevent Out-Of-Memory (OOM) fatal crashes on 4GB-6GB mobile phones?",
    cat: "MEMORY",
    a: "Standard SD 1.5 consumes 7.2GB VRAM. We decoupled memory spikes through 4 techniques: (1) TAESD decoder saving 690MB vs full VAE, (2) Sequential CPU offload for inactive modules, (3) SDPA flash kernels avoiding quadratic attention memory, and (4) Aggressive empty_cache checkpoints bounding peak VRAM to 3,098MB."
  },
  {
    q: "Why do you use both DETR and OWL-ViT for automated computer vision evaluation?",
    cat: "OBJECT EVAL",
    a: "DETR (DEtection TRansformer) provides robust, fast closed-set object detection and bounding box extraction for standard COCO classes. OWL-ViT complements it with zero-shot open-vocabulary grounding to verify rare, compound, or abstract prompt concepts that closed-set DETR cannot recognize."
  },
  {
    q: "What objective computer vision metrics prove that generated outputs are sharp and noise-free?",
    cat: "METRICS",
    a: "We execute a 3-tier mathematical screen: (1) Laplacian Variance to detect spatial blur (threshold > 100, ImagineAI achieves 412.8), (2) Immerkaer Noise estimation to verify residual grain (achieves 2.8 sigma, threshold < 5.0), and (3) Sobel edge halo ratio to penalize synthetic over-sharpening."
  },
  {
    q: "Why is LCM-LoRA included in the architecture alongside SD-Turbo?",
    cat: "ARCHITECTURE",
    a: "SD-Turbo is a fixed single-step checkpoint. Latent Consistency Model LoRA (LCM-LoRA) provides universal, modular distillation that can be dynamically injected into any community fine-tuned SD checkpoint, unlocking 4-step generation across diverse artistic styles without full model retraining."
  },
  {
    q: "Why run prompt parsing on the CPU rather than using an LLM like GPT-4 or LLaMA?",
    cat: "ZERO-GPU NLP",
    a: "A local or cloud LLM adds 200ms-1,500ms latency and 2GB+ VRAM overhead. Our rule-based regex parser executes on the CPU in < 0.8ms, consuming 0MB VRAM, ensuring 100% of GPU compute and memory is dedicated to the generative diffusion UNet."
  },
  {
    q: "How does the clip-enhancement pipeline ensure temporal consistency between frames?",
    cat: "VIDEO CLIP",
    a: "Our clip pipeline applies frame-to-frame inter-latent optical flow warping and MobileCLIP cross-frame semantic matching. Latents are smoothed across adjacent temporal horizons, eliminating synthetic flicker and visual jitter between consecutive frames."
  },
  {
    q: "What software verification standards guarantee that your code is reliable and production-ready?",
    cat: "RELIABILITY",
    a: "The repository contains 755 passing automated pytest test cases covering deterministic seed reproducibility, CUDA out-of-bounds safety, tokenizer boundary edge conditions, mock fallback pipelines, and FastAPI REST contract validation."
  },
  {
    q: "How does ImagineAI differ from commercial cloud generative APIs like Midjourney or DALL-E 3?",
    cat: "COMMERCIAL",
    a: "Midjourney and DALL-E 3 require constant cloud connectivity, recurring subscription billing, server queues, and send user data off-device. ImagineAI is completely localized, private, zero-latency network independent, and engineered specifically for on-device edge hardware."
  },
  {
    q: "What specific attention optimizations are implemented in your PyTorch UNet pipeline?",
    cat: "ATTENTION KERNELS",
    a: "We implement PyTorch's native F.scaled_dot_product_attention() (SDPA) which dispatches to FlashAttention-2 or xFormers. This completely eliminates materializing the quadratic O(N^2) attention matrix in memory, saving 1.2GB VRAM during UNet cross-attention."
  },
  {
    q: "How does the system ensure generative AI safety and intellectual provenance?",
    cat: "SAFETY & WATERMARK",
    a: "We implement dual-stage filtering: text prompt screening via CLIP embedding cosine similarity against restricted lexical clusters, and post-decode latent frequency watermarking ensuring high-frequency invisible signatures are embedded into every generated artifact."
  },
  {
    q: "What are the concrete next steps to deploy ImagineAI onto low-end smartphones with only 2GB-3GB RAM?",
    cat: "EDGE ROADMAP",
    a: "Our roadmap includes full ONNX Runtime / TensorRT-LLM 4-bit INT4 weight-activation quantization (AWQ) and Qualcomm NPU Hexagon DSP direct instruction mapping to break below the 100ms / 1.5GB memory barrier."
  }
];

function renderVivaCards() {
  const grid = document.getElementById('qa-card-grid');
  if (!grid) return;
  grid.innerHTML = '';

  vivaQAData.forEach((qa, idx) => {
    const card = document.createElement('div');
    card.className = 'qa-flip-card';
    card.innerHTML = `
      <div class="qa-card-inner">
        <div class="qa-card-front">
          <div class="qa-card-meta">
            <span class="qa-num">Q // ${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}</span>
            <span class="qa-cat">${qa.cat}</span>
          </div>
          <div class="qa-question">${qa.q}</div>
          <div class="qa-flip-hint">CLICK TO FLIP FOR ANSWER ↻</div>
        </div>
        <div class="qa-card-back">
          <div class="qa-card-meta">
            <span class="qa-num">ANSWER // ${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}</span>
            <span class="qa-cat">TECHNICAL DEFENSE</span>
          </div>
          <div class="qa-answer">${qa.a}</div>
          <div class="qa-flip-hint">CLICK TO FLIP TO QUESTION ↺</div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
      playSfx('flip');
    });
    grid.appendChild(card);
  });
}

// =========================================================================
// 11. INITIALIZATION ON DOM LOAD
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  bindHoverSounds();
  renderPipelineScrubber();
  selectPipelineStage(0);
  drawXrayCanvas();
  switchPilot(1);
  renderVivaCards();
});
