"""Generate publication-quality comparative charts for:
1. Baseline: SD 1.5 (FP32, 30 steps)
2. Adapted: SD 1.5 + LoRA (FP32, 30 steps)
3. Optimized: SD 1.5 + LoRA + FP16 + 8 steps
4. Distilled: SD-Turbo (FP16, 2 steps)
"""
import json
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

data = json.loads(Path("evaluation/reports/sd15_comparison_empirical.json").read_text())

models = [
    "Baseline\n(SD 1.5 fp32, 30s)",
    "Adapted\n(SD 1.5+LoRA, 30s)",
    "Optimized\n(SD 1.5+LoRA fp16, 8s)",
    "Distilled\n(SD-Turbo fp16, 2s)"
]

latencies_s = [
    data["baseline"]["latency_ms"] / 1000.0,
    data["adapted"]["latency_ms"] / 1000.0,
    data["optimized"]["latency_ms"] / 1000.0,
    data["sd_turbo"]["latency_ms"] / 1000.0
]

vram_gb = [
    data["baseline"]["peak_vram_mb"] / 1024.0,
    data["adapted"]["peak_vram_mb"] / 1024.0,
    data["optimized"]["peak_vram_mb"] / 1024.0,
    data["sd_turbo"]["peak_vram_mb"] / 1024.0
]

clip_scores = [
    data["baseline"]["clip_score"],
    data["adapted"]["clip_score"],
    data["optimized"]["clip_score"],
    data["sd_turbo"]["clip_score"]
]

steps = [
    data["baseline"]["steps"],
    data["adapted"]["steps"],
    data["optimized"]["steps"],
    data["sd_turbo"]["steps"]
]

# Set styling
plt.style.use('dark_background')
fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10), facecolor='#0d1117')

colors = ['#f0883e', '#a371f7', '#3fb950', '#58a6ff']

# 1. Latency (s)
bars1 = ax1.bar(models, latencies_s, color=colors, width=0.55, edgecolor='#30363d')
ax1.set_title("Inference Latency per Image (seconds) ↓", fontsize=13, fontweight='bold', pad=12, color='#f0f6fc')
ax1.set_ylabel("Seconds (Lower is Better)", fontsize=11, color='#8b949e')
ax1.grid(axis='y', linestyle='--', alpha=0.2)
ax1.set_facecolor('#161b22')
for bar in bars1:
    yval = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2.0, yval + 0.25, f"{yval:.2f}s", ha='center', va='bottom', fontsize=10, fontweight='bold', color='#fff')

# 2. Peak VRAM (GB)
bars2 = ax2.bar(models, vram_gb, color=colors, width=0.55, edgecolor='#30363d')
ax2.set_title("Peak GPU VRAM Allocation (GB) ↓", fontsize=13, fontweight='bold', pad=12, color='#f0f6fc')
ax2.set_ylabel("Gigabytes (Lower is Better)", fontsize=11, color='#8b949e')
ax2.grid(axis='y', linestyle='--', alpha=0.2)
ax2.set_facecolor('#161b22')
for bar in bars2:
    yval = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2.0, yval + 0.1, f"{yval:.2f} GB", ha='center', va='bottom', fontsize=10, fontweight='bold', color='#fff')

# 3. CLIP Score (Alignment)
bars3 = ax3.bar(models, clip_scores, color=colors, width=0.55, edgecolor='#30363d')
ax3.set_title("Semantic Alignment: CLIP Score (0-1) ↑", fontsize=13, fontweight='bold', pad=12, color='#f0f6fc')
ax3.set_ylabel("Cosine Similarity (Higher is Better)", fontsize=11, color='#8b949e')
ax3.set_ylim(0, 0.45)
ax3.grid(axis='y', linestyle='--', alpha=0.2)
ax3.set_facecolor('#161b22')
for bar in bars3:
    yval = bar.get_height()
    ax3.text(bar.get_x() + bar.get_width()/2.0, yval + 0.01, f"{yval:.3f}", ha='center', va='bottom', fontsize=10, fontweight='bold', color='#fff')

# 4. Sampling Steps
bars4 = ax4.bar(models, steps, color=colors, width=0.55, edgecolor='#30363d')
ax4.set_title("Sampling Steps (Computational Complexity) ↓", fontsize=13, fontweight='bold', pad=12, color='#f0f6fc')
ax4.set_ylabel("Inference Iterations (Lower is Better)", fontsize=11, color='#8b949e')
ax4.grid(axis='y', linestyle='--', alpha=0.2)
ax4.set_facecolor('#161b22')
for bar in bars4:
    yval = bar.get_height()
    ax4.text(bar.get_x() + bar.get_width()/2.0, yval + 0.5, f"{int(yval)} steps", ha='center', va='bottom', fontsize=10, fontweight='bold', color='#fff')

plt.suptitle("Problem Statement 3: Empirical Comparison\nBaseline (SD 1.5) vs Adapted (LoRA) vs Optimized (FP16+8 Steps) vs Distilled (SD-Turbo)\nNVIDIA GeForce RTX 5050 Laptop GPU (8GB VRAM)", fontsize=14, fontweight='bold', color='#f0f6fc', y=0.98)
plt.tight_layout(rect=[0, 0, 1, 0.94])

out1 = Path("evaluation/reports/sd15_vs_adapted_vs_optimized.png")
out2 = Path("backend/app/static/sd15_comparison.png")
plt.savefig(out1, dpi=200, bbox_inches='tight')
plt.savefig(out2, dpi=200, bbox_inches='tight')
print("Saved charts to:", out1, "and", out2)
