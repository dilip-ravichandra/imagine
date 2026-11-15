# Colab speed fine-tune: SD 1.5 LCM-LoRA

## Why this training method

The existing project LoRA uses ordinary diffusion denoising training. That learns an adaptation, but it does not teach the model to use fewer denoising steps. This guide uses **Latent Consistency Distillation (LCD)** with a LoRA student adapter. The Stable Diffusion 1.5 teacher guides the student so the resulting adapter can be sampled in a small number of steps. Hugging Face's Diffusers training guide describes this teacher-prediction/LCM-prediction loss and the separate LCM-LoRA trainer: [LCM distillation guide](https://huggingface.co/docs/diffusers/training/lcm_distill).

The repo's 10,000 leakage-checked COCO train pairs are used for training. The 1,000 validation pairs are excluded from the archive. The resulting adapter is experimental and must be compared against the approved 30-step adapter before it is enabled in the app.

## Why use a Colab T4

The local RTX 5050 laptop GPU has 8 GB VRAM. An NVIDIA T4 has 16 GB, which gives the teacher, student, VAE, text encoder, and training activations more room. The T4 is **not guaranteed to finish faster per step**; it is primarily a better memory fit. Colab's GPU types, usage limits, and runtime lifetime vary, and its free tier can run for at most 12 hours depending on availability. Save checkpoints and resume if the runtime ends. See [Colab resource limits](https://research.google.com/colaboratory/faq.html#resource-limits) and the [NVIDIA T4 specifications](https://www.nvidia.com/content/dam/en-zz/Solutions/Data-Center/tesla-t4/t4-tensor-core-datasheet-951643.pdf).

## 1. Make and upload the training archive

From the repository root in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m ai_engine.training.build_lcm_webdataset
```

This creates `training_data/coco_sd15_lenbalanced/wds/coco_train.tar` plus a hash manifest. Upload both files to a private Google Drive folder called `ImagineAI_LCM`:

- `coco_train.tar`
- `coco_train.manifest.json`

The tar is a WebDataset shard with one COCO JPEG and caption text per sample. It contains only the 10,000 training rows.

## 2. Create a Colab notebook

In Colab, select **Runtime → Change runtime type → T4 GPU** (or another GPU with at least 16 GB VRAM). Paste and run these cells. If Colab does not offer a T4, do not assume that a GPU runtime means a T4; inspect the reported GPU and VRAM first.

### Cell A — Mount Drive and check hardware

```python
from google.colab import drive
drive.mount('/content/drive')

from pathlib import Path
import torch

assert torch.cuda.is_available(), 'Select a GPU runtime first.'
gpu_name = torch.cuda.get_device_name(0)
gpu_vram_gib = torch.cuda.get_device_properties(0).total_memory / 2**30
print(f'{gpu_name}: {gpu_vram_gib:.1f} GiB VRAM')
if gpu_vram_gib < 14:
    raise RuntimeError('This LCD training recipe expects a GPU with about 16 GiB VRAM. Use a smaller pilot only if you intentionally change the recipe.')

DRIVE_DIR = Path('/content/drive/MyDrive/ImagineAI_LCM')
ARCHIVE_DRIVE = DRIVE_DIR / 'coco_train.tar'
MANIFEST_DRIVE = DRIVE_DIR / 'coco_train.manifest.json'
assert ARCHIVE_DRIVE.is_file() and MANIFEST_DRIVE.is_file(), 'Upload both archive and manifest to MyDrive/ImagineAI_LCM.'
```

### Cell B — Install the pinned trainer environment

Do not reinstall PyTorch; use the CUDA-enabled build provided by the Colab runtime.

```python
%pip install -q "diffusers==0.35.1" "transformers<5" "peft>=0.14" "accelerate>=0.30" "webdataset==1.0.2" "braceexpand==0.1.7" safetensors
```

### Cell C — Verify and copy the dataset to the VM

The notebook copies the tar from Drive to Colab's local disk. Training from a mounted Drive archive can be slow.

```python
import hashlib, json, shutil

meta = json.loads(MANIFEST_DRIVE.read_text())
h = hashlib.sha256()
with ARCHIVE_DRIVE.open('rb') as f:
    for chunk in iter(lambda: f.read(1 << 20), b''):
        h.update(chunk)
assert h.hexdigest() == meta['archive_sha256'], 'Archive hash does not match its manifest.'
assert meta['training_pairs'] == 10000 and not meta['contains_validation_split']
ARCHIVE_LOCAL = Path('/content/coco_train.tar')
shutil.copy2(ARCHIVE_DRIVE, ARCHIVE_LOCAL)
print('Verified and copied', ARCHIVE_LOCAL.stat().st_size, 'bytes')
```

### Cell D — Fetch the pinned LCD trainer

```python
import hashlib, urllib.request

TRAINER_URL = 'https://raw.githubusercontent.com/huggingface/diffusers/v0.35.1/examples/consistency_distillation/train_lcm_distill_lora_sd_wds.py'
TRAINER_SHA256 = '91574a77355539f44cacb229596eeb97e59da20ab969b2fe868132aaeb1047ec'
TRAINER = Path('/content/train_lcm_distill_lora_sd_wds.py')
urllib.request.urlretrieve(TRAINER_URL, TRAINER)
assert hashlib.sha256(TRAINER.read_bytes()).hexdigest() == TRAINER_SHA256, 'Trainer source hash mismatch.'
print('Pinned trainer verified.')
```

### Cell E — Run a 250-step pilot

Start with 250 optimizer updates at batch size 1 and accumulation 4. This confirms that the T4 fits the teacher/student job and gives a first wall-clock estimate. Checkpoint 250 is saved to Drive. If this pilot is too slow or runs out of memory, stop before the full run.

```python
import os, subprocess

OUTPUT_DIR = DRIVE_DIR / 'lcm_lora_coco_sd15_rank4'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
env = os.environ.copy()
env['PYTHONIOENCODING'] = 'utf-8'

def run_lcm_training(total_steps):
    cmd = [
        'accelerate', 'launch', '--mixed_precision=fp16', str(TRAINER),
        '--pretrained_teacher_model=stable-diffusion-v1-5/stable-diffusion-v1-5',
        '--teacher_revision=451f4fe16113bff5a5d2269ed5ad43b0592e9a14',
        f'--output_dir={OUTPUT_DIR}', f'--train_shards_path_or_url={ARCHIVE_LOCAL}',
        '--resolution=512', '--train_batch_size=1', '--gradient_accumulation_steps=4',
        f'--max_train_steps={total_steps}', '--max_train_samples=10000',
        '--learning_rate=1e-4', '--lr_warmup_steps=50',
        '--lora_rank=4', '--lora_alpha=4', '--mixed_precision=fp16', '--cast_teacher_unet',
        '--gradient_checkpointing', '--vae_encode_batch_size=1', '--dataloader_num_workers=1',
        '--checkpointing_steps=250', '--checkpoints_total_limit=2', '--resume_from_checkpoint=latest',
        '--validation_steps=2500', '--report_to=none', '--seed=2026',
    ]
    subprocess.run(cmd, check=True, env=env)

print('Pilot: 250 total optimizer updates. Output:', OUTPUT_DIR)
run_lcm_training(250)
```

Record the time for the pilot. If it fits and the projected full run is acceptable, run a second cell:

```python
print('Continuing from checkpoint-250 to 2,500 total optimizer updates.')
run_lcm_training(2500)
```

The second run resumes from `checkpoint-250`; 2,500 is the total step count, not 2,750. If Colab ends a later session, rerun the 2,500-step cell to resume from the most recent checkpoint.

## 3. What to do with the output

The final adapter is saved under `MyDrive/ImagineAI_LCM/lcm_lora_coco_sd15_rank4/unet_lora/`. Keep it as a **new experimental artifact**. Do not replace the approved 30-step adapter or mark this one approved automatically.

Next, benchmark the same prompts and seeds at 4, 8, and 30 steps. Compare GPU generation latency after warm-up, in an interleaved order, and record image quality and failures. A four-step result can be faster while being less faithful; keep the speed and quality results separate. The project API needs a compatible LCMScheduler and explicit model route to serve this adapter. The ordinary SD 1.5 LoRA path does not enable low-step inference by itself.

## Limits

- Colab free GPU availability and session duration are not guaranteed.
- T4's extra VRAM improves the chance that the teacher/student job fits, but does not guarantee faster wall-clock training.
- One training run cannot establish that the new adapter is better. Evaluate on a fresh, untouched test set before making that claim.
- This notebook does not upload weights to Hugging Face or deploy them to the website.
