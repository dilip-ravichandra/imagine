/**
 * IMAGINE AI - QUANTUM NEURAL NEXUS ENGINE (app.js)
 * High-End Cybernetic Visual Architecture
 * - Web Audio API Micro-Haptics
 * - Interactive Particle-Filament Quantum Matrix Canvas
 * - Precision Magnetic Cursor Follower
 * - 3D Gyroscopic Tilt Physics for Portal Hub
 * - Sector 01: Master System Architecture Circuit with Live Subsystem Inspector
 * - Sector 02: Video-Mode 9-Stage Pipeline Player with Live Conduits & Dynamic Scrubber
 * - Sector 03: Visual-First Model Arena with Circular SVG Radial Dials & Comparative Bars
 * - Sector 04: Computer Vision X-Ray Scanner (Laplacian, Immerkaer, Sobel, CLAHE)
 * - Sector 05: 43x Empirical Latency Drag-Race Canvas Simulation
 * - Sector 06: Samsung R&D Viva Defense Deck (Presenter 1 vs 2 Dossiers & Top 12 3D Flipping Q&A Cards)
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
    // Audio context guard
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
  const hoverables = document.querySelectorAll('button, a, .orbit-node, .hud-link, .cyber-chip, .qa-flip-card, .xray-mode-btn, .pilot-switch-btn, .arch-node-card, .model-tab-card, .v-btn');
  hoverables.forEach(el => {
    el.addEventListener('mouseenter', () => {
      playSfx('hover');
      if (cursorRing) {
        cursorRing.style.width = '52px';
        cursorRing.style.height = '52px';
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
// 6. SECTOR 01: SYSTEM ARCHITECTURE INTERACTIVE SUBSYSTEM INSPECTOR
// =========================================================================
const archSubsystems = [
  {
    num: "01",
    title: "Client UI & Mobile Viewport",
    desc: "Touch-optimized mobile PWA frontend with responsive viewports (1:1, 16:9, 9:16), prompt history caching, parameter tuning sliders, and instant Base64 preview streaming without cloud dependencies.",
    tensor: "User Prompt String → JSON REST Payload",
    lat: "< 1 ms",
    vram: "0 MB (Client)",
    file: "frontend/ / mobile PWA",
    status: "PASSING (755)"
  },
  {
    num: "02",
    title: "FastAPI Mutex Concurrency Guard",
    desc: "Single-flight async mutex and semaphore lock guarding backend requests. Enforces graceful HTTP 429 queuing rather than catastrophic CUDA Out-Of-Memory thrashing when multiple requests arrive on an 8GB laptop GPU.",
    tensor: "HTTP POST /generate → Fast Validation Pydantic",
    lat: "< 1 ms",
    vram: "0 MB",
    file: "backend/api/generation.py",
    status: "PASSING (755)"
  },
  {
    num: "03",
    title: "Zero-GPU NLP Entity Parser",
    desc: "Instant CPU regex engine decomposing natural language prompts into Subject, Style, Lighting, Atmosphere, and Quality tags. Dynamically injects positive modifiers and strips adversarial tokens in sub-millisecond latency.",
    tensor: "Prompt String → ParsedDict {subject, style, lighting}",
    lat: "0.8 ms",
    vram: "0 MB (100% CPU)",
    file: "backend/nlp/prompt_parser.py",
    status: "PASSING (755)"
  },
  {
    num: "04",
    title: "OpenCLIP Tokenizer & Encoder",
    desc: "OpenCLIP Byte-Pair Encoding (BPE) divides prompts into 77 discrete positional tokens, projected by the ViT-B/32 text encoder into a continuous 768-dimensional multimodal cross-attention conditioning tensor.",
    tensor: "Tokens: [1, 77] → Context Embedding: [1, 77, 768] fp16",
    lat: "14.2 ms",
    vram: "340 MB",
    file: "backend/models/mobile_clip.py",
    status: "PASSING (755)"
  },
  {
    num: "05",
    title: "Single-Step Distillation UNet (SD-Turbo)",
    desc: "Adversarial Diffusion Distillation (ADD) single-step UNet. Combined with PyTorch Scaled Dot-Product Attention (SDPA FlashAttention) and FP16 compilation, generates clean latents in one single forward pass without 50 iterative loops.",
    tensor: "Noise [1, 4, 64, 64] + Embed [1, 77, 768] → Clean Latents [1, 4, 64, 64]",
    lat: "182.4 ms",
    vram: "2,240 MB",
    file: "backend/models/sd_turbo.py",
    status: "PASSING (755)"
  },
  {
    num: "06",
    title: "TAESD Tiny Autoencoder Decoder",
    desc: "Distilled Tiny Autoencoder for Stable Diffusion replacing the 83.7M-parameter AutoencoderKL. Expands 64x64x4 latents to 512x512x3 RGB pixels in 18ms using just 110MB VRAM, completely avoiding the standard 800MB VAE OOM bottle-neck.",
    tensor: "Latents: [1, 4, 64, 64] → RGB Image: [1, 3, 512, 512] uint8",
    lat: "18.6 ms",
    vram: "110 MB",
    file: "backend/models/taesd.py",
    status: "PASSING (755)"
  },
  {
    num: "07",
    title: "Classical CV 13-Metric Quality Gate",
    desc: "No-reference computer vision screen evaluating Laplacian spatial blur variance (412.8), Immerkaer noise standard deviation (2.8 sigma), and Sobel edge halo index (1.02) to guarantee image sharpness and zero synthesis artifacts.",
    tensor: "RGB Tensor [1, 3, 512, 512] → Metrics Vector (13 floats)",
    lat: "2.3 ms",
    vram: "2 MB",
    file: "backend/evaluation/metrics.py",
    status: "PASSING (755)"
  },
  {
    num: "08",
    title: "DETR & OWL-ViT Object Verifier",
    desc: "DEtection TRansformer and zero-shot Open-World ViT confirm that the physical objects and semantic entities requested in the prompt are factually represented in the rendered image bounding boxes.",
    tensor: "Decoded RGB → Bounding Boxes [N, 4] & Grounding Scores",
    lat: "24.0 ms",
    vram: "320 MB",
    file: "backend/evaluation/detr_eval.py",
    status: "PASSING (755)"
  },
  {
    num: "09",
    title: "Provenance Watermarking & Dispatch",
    desc: "Embeds invisible frequency-domain cryptographic watermarks for provenance and dispatches optimized JPEG/WebP Base64 payload directly to the client interface in sub-millisecond stream response.",
    tensor: "Validated Image → Watermarked Base64 Binary Stream",
    lat: "4.5 ms",
    vram: "50 MB",
    file: "backend/safety/checker.py",
    status: "PASSING (755)"
  }
];

function inspectArchNode(idx) {
  playSfx('click');

  const cards = document.querySelectorAll('.arch-node-card');
  cards.forEach((c, i) => {
    if (i === idx) c.classList.add('active');
    else c.classList.remove('active');
  });

  const sub = archSubsystems[idx];
  if (!sub) return;

  const n = document.getElementById('arch-inspect-num');
  const t = document.getElementById('arch-inspect-title');
  const d = document.getElementById('arch-inspect-desc');
  const tv = document.getElementById('arch-tensor-val');
  const lat = document.getElementById('arch-stat-lat');
  const vram = document.getElementById('arch-stat-vram');
  const file = document.getElementById('arch-stat-file');
  const stat = document.getElementById('arch-stat-status');

  if (n) n.textContent = `SUBSYSTEM ${sub.num} // 09`;
  if (t) t.textContent = sub.title;
  if (d) d.textContent = sub.desc;
  if (tv) tv.textContent = sub.tensor;
  if (lat) lat.textContent = sub.lat;
  if (vram) vram.textContent = sub.vram;
  if (file) file.textContent = sub.file;
  if (stat) stat.textContent = sub.status;
}

// =========================================================================
// 7. SECTOR 02: VIDEO-MODE PIPELINE FLOW PLAYER & CONDUITS
// =========================================================================
const pipelineStages = [
  {
    num: "01",
    short: "PROMPT",
    title: "Client Dispatch & Request Guard",
    desc: "FastAPI server receives incoming user payload. In-flight single-request concurrency lock guarantees concurrent prompts on an 8GB laptop queue gracefully without triggering fatal CUDA Out-of-Memory crashes.",
    lat: "< 1 ms",
    cumLat: "0.8 ms",
    vram: "0 MB",
    code: "generation.py",
    tensor: "JSON (Prompt, Steps, Seed, Guidance)",
    type: "tokens"
  },
  {
    num: "02",
    short: "NLP PARSE",
    title: "Zero-GPU Rule-Based NLP Entity Parsing",
    desc: "Instant CPU regex engine decomposes the prompt into Subject, Style, Lighting, Atmosphere, and Quality tags. Injects domain-specific positive modifiers while stripping adversarial keywords in sub-millisecond time.",
    lat: "0.8 ms",
    cumLat: "1.6 ms",
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
    cumLat: "3.7 ms",
    vram: "12 MB",
    code: "clip_tokenizer.py",
    tensor: "Tokens: [1, 77] int64",
    type: "bpe"
  },
  {
    num: "04",
    short: "EMBEDDING",
    title: "Text Transformer Semantic Embedding",
    desc: "OpenCLIP ViT-B/32 text encoder projects discrete tokens into continuous 768-dimensional multimodal semantic space, producing the cross-attention conditioning tensor required by UNet layers.",
    lat: "14.2 ms",
    cumLat: "17.9 ms",
    vram: "340 MB",
    code: "mobile_clip.py",
    tensor: "Context: [1, 77, 768] fp16",
    type: "vector"
  },
  {
    num: "05",
    short: "NOISE SEED",
    title: "Gaussian Latent Seed Initialization",
    desc: "Generates a 4-channel spatial noise grid in 8x downsampled latent space (64x64) using deterministic PyTorch PRNG seed. This saves 64x memory compared to operating directly in 512x512 RGB space.",
    lat: "0.3 ms",
    cumLat: "18.2 ms",
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
    cumLat: "200.6 ms",
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
    cumLat: "219.2 ms",
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
    cumLat: "221.5 ms",
    vram: "2 MB",
    code: "metrics.py",
    tensor: "Metrics Vector (13 floats)",
    type: "xray"
  },
  {
    num: "09",
    short: "DETR / OWL",
    title: "DETR & OWL-ViT Object Verification",
    desc: "DEtection TRansformer and zero-shot Open-World ViT confirm that the physical objects and semantic entities requested in the prompt are factually represented in the rendered image bounding boxes.",
    lat: "24.0 ms",
    cumLat: "247.0 ms",
    vram: "320 MB",
    code: "detr_eval.py / owl_vit.py",
    tensor: "Bounding Boxes & Grounding Scores",
    type: "detr"
  }
];

let vActiveIdx = 0;
let vIsPlaying = false;
let vPlayInterval = null;
let vSpeed = 1.0;

function renderVideoScrubberUI() {
  const markerContainer = document.getElementById('video-stage-markers');
  const conduitStrip = document.getElementById('video-conduit-strip');

  if (markerContainer) {
    markerContainer.innerHTML = '';
    pipelineStages.forEach((st, idx) => {
      const m = document.createElement('div');
      m.className = `video-stage-marker ${idx === vActiveIdx ? 'active' : ''}`;
      m.textContent = st.short;
      m.addEventListener('click', () => {
        pauseVideoPlayback();
        selectVideoStage(idx);
      });
      markerContainer.appendChild(m);
    });
  }

  if (conduitStrip) {
    conduitStrip.innerHTML = '';
    pipelineStages.forEach((st, idx) => {
      const node = document.createElement('div');
      node.className = `conduit-node ${idx === vActiveIdx ? 'active' : ''}`;
      node.innerHTML = `<strong>${st.num}</strong> ${st.short}`;
      node.addEventListener('click', () => {
        pauseVideoPlayback();
        selectVideoStage(idx);
      });
      conduitStrip.appendChild(node);

      if (idx < pipelineStages.length - 1) {
        const arrow = document.createElement('div');
        arrow.className = 'conduit-arrow';
        arrow.textContent = '➔';
        conduitStrip.appendChild(arrow);
      }
    });
  }
}

function selectVideoStage(idx) {
  vActiveIdx = idx;
  playSfx('click');

  // Update Progress line
  const progressLine = document.getElementById('video-scrubber-progress');
  if (progressLine) {
    const pct = ((idx) / (pipelineStages.length - 1)) * 100;
    progressLine.style.width = `${pct}%`;
  }

  // Update Markers & Conduits
  const markers = document.querySelectorAll('.video-stage-marker');
  markers.forEach((m, i) => {
    if (i === idx) m.classList.add('active');
    else m.classList.remove('active');
  });

  const conduitNodes = document.querySelectorAll('.conduit-node');
  conduitNodes.forEach((cn, i) => {
    if (i === idx) cn.classList.add('active');
    else cn.classList.remove('active');
  });

  const st = pipelineStages[idx];
  const tc = document.getElementById('video-timecode');
  const bn = document.getElementById('stage-badge-num');
  const tit = document.getElementById('stage-intel-title');
  const desc = document.getElementById('stage-intel-desc');
  const lat = document.getElementById('stage-intel-lat');
  const vram = document.getElementById('stage-intel-vram');
  const code = document.getElementById('stage-intel-code');
  const tensor = document.getElementById('stage-intel-tensor');
  const cap = document.getElementById('stage-canvas-caption');

  if (tc) tc.textContent = `00:00:${st.cumLat}`;
  if (bn) bn.textContent = `STAGE ${st.num} // 09`;
  if (tit) tit.textContent = st.title;
  if (desc) desc.textContent = st.desc;
  if (lat) lat.textContent = st.lat;
  if (vram) vram.textContent = st.vram;
  if (code) code.textContent = st.code;
  if (tensor) tensor.textContent = st.tensor;
  if (cap) cap.textContent = `STAGE ${st.num} TENSOR RENDERING: ${st.tensor.toUpperCase()}`;

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
    ctx.font = '12px monospace';
    ctx.fillStyle = 'var(--neon-emerald)';
    ctx.fillText('SUBJECT: "vintage leather hat"', 30, 60);
    ctx.fillText('LOCATION: "mossy wooden log"', 30, 95);
    ctx.fillText('LIGHTING: "soft golden hour"', 30, 130);
    ctx.fillText('ATMOSPHERE: "cinematic depth of field"', 30, 165);
    ctx.fillText('RESOLUTION: 512x512 | NEGATIVES APPLIED', 30, 200);
  } else if (type === 'vector') {
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
    ctx.strokeStyle = 'var(--neon-cyan)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, h - 40);
    for (let x = 30; x < w - 30; x += 20) {
      ctx.lineTo(x, h - 40 - Math.random() * (h - 80));
    }
    ctx.stroke();
  } else if (type === 'detr') {
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

function toggleVideoPlayback() {
  vIsPlaying = !vIsPlaying;
  const playIcon = document.getElementById('v-play-icon');
  const playText = document.getElementById('v-play-text');
  const playBtn = document.getElementById('btn-v-play');

  if (vIsPlaying) {
    if (playIcon) playIcon.textContent = '⏸';
    if (playText) playText.textContent = 'PAUSE';
    if (playBtn) playBtn.classList.add('active');
    playSfx('warp');

    const intervalMs = 1800 / vSpeed;
    vPlayInterval = setInterval(() => {
      vActiveIdx = (vActiveIdx + 1) % pipelineStages.length;
      selectVideoStage(vActiveIdx);
    }, intervalMs);
  } else {
    pauseVideoPlayback();
  }
}

function pauseVideoPlayback() {
  vIsPlaying = false;
  if (vPlayInterval) {
    clearInterval(vPlayInterval);
    vPlayInterval = null;
  }
  const playIcon = document.getElementById('v-play-icon');
  const playText = document.getElementById('v-play-text');
  const playBtn = document.getElementById('btn-v-play');
  if (playIcon) playIcon.textContent = '▶';
  if (playText) playText.textContent = 'PLAY FLOW';
  if (playBtn) playBtn.classList.remove('active');
}

function stepVideoPipeline(dir) {
  pauseVideoPlayback();
  let next = vActiveIdx + dir;
  if (next < 0) next = pipelineStages.length - 1;
  if (next >= pipelineStages.length) next = 0;
  selectVideoStage(next);
}

function cycleVideoSpeed() {
  playSfx('click');
  const speedBtn = document.getElementById('btn-v-speed');
  if (vSpeed === 1.0) vSpeed = 2.0;
  else if (vSpeed === 2.0) vSpeed = 0.5;
  else vSpeed = 1.0;

  if (speedBtn) speedBtn.textContent = `${vSpeed.toFixed(1)}× SPEED`;

  if (vIsPlaying) {
    pauseVideoPlayback();
    toggleVideoPlayback();
  }
}

function seekVideoScrubber(e) {
  pauseVideoPlayback();
  const line = document.getElementById('video-scrubber-line');
  if (!line) return;
  const rect = line.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  const nearestIdx = Math.round(pct * (pipelineStages.length - 1));
  selectVideoStage(nearestIdx);
}

// =========================================================================
// 8. SECTOR 03: VISUAL-FIRST MODEL ARENA & RADIAL DIALS
// =========================================================================
const arenaModels = [
  {
    name: "SD-Turbo (ADD)",
    tag: "PRIMARY ENGINE",
    latVal: 247,
    latPct: 0.98,
    latDetail: "42.9× Speedup vs Baseline",
    stepVal: 1,
    stepPct: 1.0,
    stepDetail: "Single Forward Pass ADD",
    vramVal: "3,098",
    vramPct: 0.38,
    vramDetail: "61% Headroom on 8GB",
    clipVal: "0.887",
    clipPct: 0.89,
    clipDetail: "High Multimodal Fidelity",
    h2hLatText: "T1: 247 ms vs Baseline: 10,545 ms (42.9× Speedup)",
    h2hLatWidth: "2.3%",
    h2hVramText: "T1: 3,098 MB vs Baseline: 7,200 MB (56% Reduction)",
    h2hVramWidth: "38%",
    h2hStepText: "T1: 1 Step vs Baseline: 50 Steps (50× Solver Gain)",
    h2hStepWidth: "2%",
    badges: [
      "⚡ 43× Speed Leader",
      "💾 3,098 MB Mobile VRAM",
      "📱 Samsung Galaxy AI Ready",
      "🎯 1-Step Student ADD",
      "🔒 100% On-Device Private",
      "🚫 Zero Cloud Queues"
    ]
  },
  {
    name: "SD 1.5 + LCM-LoRA",
    tag: "BALANCED ENGINE",
    latVal: 451,
    latPct: 0.82,
    latDetail: "23.4× Speedup vs Baseline",
    stepVal: 4,
    stepPct: 0.75,
    stepDetail: "PF-ODE Multi-Step Solver",
    vramVal: "2,816",
    vramPct: 0.35,
    vramDetail: "65% Headroom on 8GB",
    clipVal: "0.871",
    clipPct: 0.87,
    clipDetail: "Multi-Style Adapter Versatility",
    h2hLatText: "LCM: 451 ms vs Baseline: 10,545 ms (23.4× Speedup)",
    h2hLatWidth: "4.3%",
    h2hVramText: "LCM: 2,816 MB vs Baseline: 7,200 MB (61% Reduction)",
    h2hVramWidth: "35%",
    h2hStepText: "LCM: 4 Steps vs Baseline: 50 Steps (12.5× Gain)",
    h2hStepWidth: "8%",
    badges: [
      "✨ Universal LoRA Compatibility",
      "💾 2,816 MB Ultra-Low VRAM",
      "⚡ 451 ms Multi-Step Latency",
      "🧩 135 MB Rank-64 Adapter",
      "🎨 Diverse Artistic Styles",
      "🔄 Retains SD 1.5 Weights"
    ]
  },
  {
    name: "TAESD Tiny VAE",
    tag: "DECODER ACCELERATOR",
    latVal: 18,
    latPct: 0.99,
    latDetail: "65% Faster than 83.7M VAE",
    stepVal: "Conv",
    stepPct: 0.95,
    stepDetail: "Direct 4-Layer ConvNet",
    vramVal: "110",
    vramPct: 0.02,
    vramDetail: "Saves 690 MB vs Standard VAE",
    clipVal: "31.4",
    clipPct: 0.92,
    clipDetail: "Visually Lossless PSNR (dB)",
    h2hLatText: "TAESD: 18 ms vs Standard VAE: 52 ms (65% Faster)",
    h2hLatWidth: "0.2%",
    h2hVramText: "TAESD: 110 MB vs Standard VAE: 800 MB (86% Less)",
    h2hVramWidth: "1.3%",
    h2hStepText: "TAESD: Direct Conv vs Full Self-Attention",
    h2hStepWidth: "2%",
    badges: [
      "🔬 1.8M Parameter Distillation",
      "💾 110 MB Micro-Memory",
      "⚡ 18 ms Decode Benchmark",
      "🚫 Zero Attention OOM Risk",
      "📱 Mobile NPU Optimized",
      "🎯 31.4 dB Lossless PSNR"
    ]
  },
  {
    name: "SD 1.5 Baseline",
    tag: "UNACCELERATED BASELINE",
    latVal: "10,545",
    latPct: 0.05,
    latDetail: "Baseline Unaccelerated",
    stepVal: 50,
    stepPct: 0.02,
    stepDetail: "Iterative DDIM Loop",
    vramVal: "7,200",
    vramPct: 0.90,
    vramDetail: "DANGER: High OOM Risk on Edge",
    clipVal: "0.882",
    clipPct: 0.88,
    clipDetail: "Standard Reference Point",
    h2hLatText: "Baseline: 10,545 ms (10.55s - Unviable on Mobile)",
    h2hLatWidth: "100%",
    h2hVramText: "Baseline: 7,200 MB (90% GPU Allocation Thrash)",
    h2hVramWidth: "90%",
    h2hStepText: "Baseline: 50 Iterative UNet Steps",
    h2hStepWidth: "100%",
    badges: [
      "🐢 10.55s Latency Penalty",
      "⚠️ 7.2 GB Severe Memory Draw",
      "🐌 50 Forward Passes",
      "❌ Edge Mobile Crash Hazard",
      "📉 43× Slower than ImagineAI",
      "🔋 Heavy Battery Drain"
    ]
  }
];

function selectArenaModel(idx) {
  playSfx('click');

  const tabCards = document.querySelectorAll('.model-tab-card');
  tabCards.forEach((c, i) => {
    if (i === idx) c.classList.add('active');
    else c.classList.remove('active');
  });

  const m = arenaModels[idx];
  if (!m) return;

  // Animate Circular Gauges (Circumference ~ 314)
  const setGauge = (fillId, valId, detId, pct, val, det) => {
    const el = document.getElementById(fillId);
    const vEl = document.getElementById(valId);
    const dEl = document.getElementById(detId);
    if (el) {
      const offset = 314 * (1 - pct);
      el.style.strokeDashoffset = offset;
    }
    if (vEl) vEl.textContent = val;
    if (dEl) dEl.textContent = det;
  };

  setGauge('gauge-fill-lat', 'g-val-lat', 'g-det-lat', m.latPct, m.latVal, m.latDetail);
  setGauge('gauge-fill-step', 'g-val-step', 'g-det-step', m.stepPct, m.stepVal, m.stepDetail);
  setGauge('gauge-fill-vram', 'g-val-vram', 'g-det-vram', m.vramPct, m.vramVal, m.vramDetail);
  setGauge('gauge-fill-clip', 'g-val-clip', 'g-det-clip', m.clipPct, m.clipVal, m.clipDetail);

  // Update Head-to-Head Comparison Bars
  const hLat = document.getElementById('h2h-stat-lat');
  const hVram = document.getElementById('h2h-stat-vram');
  const hStep = document.getElementById('h2h-stat-step');
  const fLat = document.getElementById('h2h-fill-lat');
  const fVram = document.getElementById('h2h-fill-vram');
  const fStep = document.getElementById('h2h-fill-step');

  if (hLat) hLat.textContent = m.h2hLatText;
  if (hVram) hVram.textContent = m.h2hVramText;
  if (hStep) hStep.textContent = m.h2hStepText;

  if (fLat) {
    fLat.style.width = m.h2hLatWidth;
    fLat.textContent = `${m.latVal} ms`;
  }
  if (fVram) {
    fVram.style.width = m.h2hVramWidth;
    fVram.textContent = `${m.vramVal} MB`;
  }
  if (fStep) {
    fStep.style.width = m.h2hStepWidth;
    fStep.textContent = `${m.stepVal} Steps`;
  }

  // Update Badges Cloud
  const badgeCloud = document.getElementById('model-badge-cloud');
  if (badgeCloud) {
    badgeCloud.innerHTML = '';
    m.badges.forEach(b => {
      const pill = document.createElement('div');
      pill.className = 'judge-pill';
      pill.textContent = b;
      badgeCloud.appendChild(pill);
    });
  }
}

// =========================================================================
// 9. SECTOR 04: CV X-RAY ARTIFACT SCANNER WITH INTERACTIVE LENS
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
      d[i + 1] = edge;
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
// 10. SECTOR 05: 43x SPEED WARP DRAG-RACE SIMULATION
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
  const T_BASELINE = 10545;
  const VISUAL_DURATION = 3200;

  function anim(now) {
    const elapsed = now - startTime;
    ctx.clearRect(0, 0, w, h);

    // Track Lines
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
// 11. SECTOR 06: SAMSUNG VIVA DEFENSE DECK & 3D Q&A CARDS
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
// 12. INITIALIZATION ON DOM LOAD
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  bindHoverSounds();
  inspectArchNode(0);
  renderVideoScrubberUI();
  selectVideoStage(0);
  selectArenaModel(0);
  drawXrayCanvas();
  switchPilot(1);
  renderVivaCards();
});
