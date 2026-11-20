# Imagine AI — Interactive System Walkthrough

An interactive, animated product documentary and technical system walkthrough for **Imagine AI** (Problem Statement No. 3: Resource-Efficient Text-to-Image Generation).

---

## 🚀 How to Open and View Locally

You can view the interactive walkthrough in any web browser:

### Option 1: Direct File Opening
Double-click `index.html` or open it directly in Google Chrome, Microsoft Edge, Firefox, or Safari:
```bash
# Windows
start index.html

# Mac
open index.html

# Linux
xdg-open index.html
```

### Option 2: Local HTTP Server (Recommended)
From this directory (`interactive-walkthrough/`):
```bash
python -m http.server 8080
```
Then navigate to: **[http://localhost:8080](http://localhost:8080)**

---

## 🎨 Design & Palette
Designed with a light pastel aesthetic:
- **Light Pink**: `#FCE7F3` (Accents, badges, SD-Turbo highlights)
- **Soft Purple**: `#EDE9FE` (Cards, background gradients, LCM-LoRA theme)
- **Light Green**: `#DCFCE7` (Computer vision stages, verified badges, success indicators)
- **White**: `#FFFFFF` (Cards, surfaces)
- **Dark Text**: `#273047` (High readability typography)

---

## 🗺️ Sections & Interactive Features

| Section | ID | Key Interactive Features |
| :--- | :--- | :--- |
| **A. Opening Experience** | `#hero` | Animated flow diagram, key performance metrics (43× speed-up, 247 ms), quick links. |
| **B. Complete Architecture** | `#architecture` | **Interactive SVG Architecture Map**: Click any node (React, Android, FastAPI, SD-Turbo, LCM-LoRA, Inpainting, CV, Verifier, Groq, Modal, Docker) to open the slide-out detail panel showing inputs, outputs, technologies, and source files. |
| **C. Image Generation Pipeline** | `#pipeline` | **9-Stage Interactive Timeline**: Traces the prompt *"A vintage leather hat resting on a mossy wooden log..."* with Play, Pause, Step Next/Prev controls, visual progress indicators, and per-stage latency/tensor specifications. |
| **D. Clip & Image Enhancement** | `#cv-pipeline` | **Interactive Filter Simulator**: Switch between Raw, CLAHE, Gray-World White Balance, Bilateral Smoothing, and Auto-Enhance. Includes audio clip transcription workflow and video frame enhancement specification. |
| **E. AI Models Explained** | `#models` | **Expandable Model Cards**: Click cards for SD-Turbo, SD 1.5 + LCM-LoRA, TAESD, and DETR + OWL-ViT to inspect training objectives, CFG math, schedulers, and limitations. Full empirical benchmark comparison table. |
| **F. Backend & Data Flow** | `#backend` | Animated request/response pipeline, API endpoint reference, and sample telemetry JSON payload. |
| **G. Interactive Demonstrations** | `#demo` | **Live Pipeline Simulator**: Select preset prompts or type custom text, choose models and quality modes, and run a step-by-step visual simulation with live NLP entity and intent extraction. |
| **H. Performance Evaluation** | `#metrics` | Animated counter metrics, interactive latency bar chart, P7 ablation study table, and Best-of-N accuracy breakdown. |
| **I. Full Technology Stack** | `#tech` | Grid of confirmed dependencies (PyTorch 2.11, Diffusers 0.42, FastAPI, OpenCV, React 18, Chakra UI, PEFT, Groq, Docker, Modal). |
| **J. Limitations & Status** | `#limitations` | Implementation status timeline (Implemented vs Partially Implemented vs Planned) and honest disclosure of negative results (LoRA scale bug, INT8 slowdown, CV FID plateau). |
| **K. Final Project Summary** | `#summary` | End-to-end visual journey from prompt to picture and future roadmap. |

---

## 📁 File Structure
```text
interactive-walkthrough/
├── index.html       # Complete HTML structure with semantic sections & SVG diagrams
├── styles.css       # Responsive styling, pastel theme, animations, scroll effects
├── app.js          # Interactive controllers, simulation logic, SVG click bindings
└── README.md        # Documentation and running guide
```

*Built strictly using empirical evidence and verified source code from the Imagine AI repository.*
