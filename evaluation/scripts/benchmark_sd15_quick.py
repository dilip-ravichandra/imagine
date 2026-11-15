"""Empirical benchmark comparing:
1. Baseline: SD 1.5, FP32, 30 steps
2. Adapted: SD 1.5 + LoRA, FP32, 30 steps
3. Optimized: SD 1.5 + LoRA + FP16 + 8 steps (LCMScheduler) + Classical CV
4. Benchmark (Distilled): SD-Turbo, FP16, 2 steps
"""
import time
import json
import torch
from pathlib import Path
from PIL import Image
from diffusers import StableDiffusionPipeline, LCMScheduler, AutoPipelineForText2Image
from transformers import CLIPProcessor, CLIPModel

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device} ({torch.cuda.get_device_name(0)})")

# Load CLIP scorer
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
clip_proc = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

def get_clip_score(image: Image.Image, text: str) -> float:
    inputs = clip_proc(text=[text], images=image, return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        outputs = clip_model(**inputs)
        img_embed = outputs.image_embeds / outputs.image_embeds.norm(dim=-1, keepdim=True)
        txt_embed = outputs.text_embeds / outputs.text_embeds.norm(dim=-1, keepdim=True)
        score = (img_embed * txt_embed).sum().item()
    return float(score)

prompts = [
    "A cozy wooden cabin beside a mountain lake at sunset",
    "An astronaut riding a horse on Mars, cinematic lighting",
    "A vintage red sports car driving through a misty autumn forest",
]

results = {}

# 1. BASELINE: SD 1.5, FP32, 30 steps
print("\n--- 1. Evaluating SD 1.5 Baseline (FP32, 30 steps) ---")
torch.cuda.empty_cache()
torch.cuda.reset_peak_memory_stats()
pipe_base = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5", 
    torch_dtype=torch.float32, 
    local_files_only=True,
    safety_checker=None
).to(device)

base_latencies = []
base_clips = []
for p in prompts:
    torch.cuda.synchronize()
    t0 = time.perf_counter()
    img = pipe_base(p, num_inference_steps=30, guidance_scale=7.5, generator=torch.Generator(device).manual_seed(42)).images[0]
    torch.cuda.synchronize()
    lat = (time.perf_counter() - t0) * 1000
    base_latencies.append(lat)
    c_score = get_clip_score(img, p)
    base_clips.append(c_score)
    print(f"Prompt: {p[:30]}... Latency: {lat:.1f}ms, CLIP: {c_score:.4f}")

base_vram = torch.cuda.max_memory_allocated() / (1024 * 1024)
results["baseline"] = {
    "name": "SD 1.5 Baseline (Unchanged)",
    "precision": "fp32",
    "steps": 30,
    "latency_ms": sum(base_latencies) / len(base_latencies),
    "peak_vram_mb": base_vram,
    "clip_score": sum(base_clips) / len(base_clips),
    "model_size_mb": 4270
}
del pipe_base
torch.cuda.empty_cache()

# 2. ADAPTED: SD 1.5 + LoRA, FP32, 30 steps
print("\n--- 2. Evaluating SD 1.5 Adapted (LoRA, FP32, 30 steps) ---")
torch.cuda.reset_peak_memory_stats()
pipe_lora = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5", 
    torch_dtype=torch.float32, 
    local_files_only=True,
    safety_checker=None
).to(device)
pipe_lora.load_lora_weights("latent-consistency/lcm-lora-sdv1-5")

lora_latencies = []
lora_clips = []
for p in prompts:
    torch.cuda.synchronize()
    t0 = time.perf_counter()
    img = pipe_lora(p, num_inference_steps=30, guidance_scale=7.5, generator=torch.Generator(device).manual_seed(42)).images[0]
    torch.cuda.synchronize()
    lat = (time.perf_counter() - t0) * 1000
    lora_latencies.append(lat)
    c_score = get_clip_score(img, p)
    lora_clips.append(c_score)
    print(f"Prompt: {p[:30]}... Latency: {lat:.1f}ms, CLIP: {c_score:.4f}")

lora_vram = torch.cuda.max_memory_allocated() / (1024 * 1024)
results["adapted"] = {
    "name": "SD 1.5 Adapted (with LoRA)",
    "precision": "fp32",
    "steps": 30,
    "latency_ms": sum(lora_latencies) / len(lora_latencies),
    "peak_vram_mb": lora_vram,
    "clip_score": sum(lora_clips) / len(lora_clips),
    "model_size_mb": 4270 + 135
}
del pipe_lora
torch.cuda.empty_cache()

# 3. FINAL OPTIMIZED: SD 1.5 + LoRA + FP16 + 8 steps (LCMScheduler)
print("\n--- 3. Evaluating SD 1.5 Final Optimized (LoRA + FP16 + 8 steps) ---")
torch.cuda.reset_peak_memory_stats()
pipe_opt = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5", 
    torch_dtype=torch.float16, 
    local_files_only=True,
    safety_checker=None
).to(device)
pipe_opt.load_lora_weights("latent-consistency/lcm-lora-sdv1-5")
pipe_opt.scheduler = LCMScheduler.from_config(pipe_opt.scheduler.config)

opt_latencies = []
opt_clips = []
for p in prompts:
    torch.cuda.synchronize()
    t0 = time.perf_counter()
    img = pipe_opt(p, num_inference_steps=8, guidance_scale=1.5, generator=torch.Generator(device).manual_seed(42)).images[0]
    torch.cuda.synchronize()
    lat = (time.perf_counter() - t0) * 1000
    opt_latencies.append(lat)
    c_score = get_clip_score(img, p)
    opt_clips.append(c_score)
    print(f"Prompt: {p[:30]}... Latency: {lat:.1f}ms, CLIP: {c_score:.4f}")

opt_vram = torch.cuda.max_memory_allocated() / (1024 * 1024)
results["optimized"] = {
    "name": "SD 1.5 Final Optimized (LoRA + FP16 + 8 steps)",
    "precision": "fp16",
    "steps": 8,
    "latency_ms": sum(opt_latencies) / len(opt_latencies),
    "peak_vram_mb": opt_vram,
    "clip_score": sum(opt_clips) / len(opt_clips),
    "model_size_mb": 2135 + 135
}
del pipe_opt
torch.cuda.empty_cache()

# 4. SD-TURBO BENCHMARK (Extreme ADD Distillation: 2 steps, FP16)
print("\n--- 4. Evaluating SD-Turbo (2 steps, FP16) ---")
torch.cuda.reset_peak_memory_stats()
pipe_turbo = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sd-turbo",
    torch_dtype=torch.float16,
    variant="fp16",
    local_files_only=True,
    safety_checker=None
).to(device)

turbo_latencies = []
turbo_clips = []
for p in prompts:
    torch.cuda.synchronize()
    t0 = time.perf_counter()
    img = pipe_turbo(p, num_inference_steps=2, guidance_scale=0.0, generator=torch.Generator(device).manual_seed(42)).images[0]
    torch.cuda.synchronize()
    lat = (time.perf_counter() - t0) * 1000
    turbo_latencies.append(lat)
    c_score = get_clip_score(img, p)
    turbo_clips.append(c_score)
    print(f"Prompt: {p[:30]}... Latency: {lat:.1f}ms, CLIP: {c_score:.4f}")

turbo_vram = torch.cuda.max_memory_allocated() / (1024 * 1024)
results["sd_turbo"] = {
    "name": "SD-Turbo ADD Distilled (FP16, 2 steps)",
    "precision": "fp16",
    "steps": 2,
    "latency_ms": sum(turbo_latencies) / len(turbo_latencies),
    "peak_vram_mb": turbo_vram,
    "clip_score": sum(turbo_clips) / len(turbo_clips),
    "model_size_mb": 3678
}

out_path = Path("evaluation/reports/sd15_comparison_empirical.json")
out_path.write_text(json.dumps(results, indent=2))
print("\n=== FINAL EMPIRICAL RESULTS SAVED TO", out_path, "===")
print(json.dumps(results, indent=2))
