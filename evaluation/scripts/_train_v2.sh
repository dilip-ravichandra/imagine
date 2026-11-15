#!/usr/bin/env bash
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8 HF_HUB_OFFLINE=1
T=C:/Users/dilip/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5/snapshots/451f4fe16113bff5a5d2269ed5ad43b0592e9a14
rm -rf adapters/lcm_coco_curated_run; L=evaluation/results/fid/train_lcm_curated.log; : > $L
.venv/Scripts/python.exe -m accelerate.commands.launch --num_processes=1 --mixed_precision=fp16 ai_engine/training/lcm_warmstart.py \
  --pretrained_teacher_model=$T --teacher_revision=451f4fe16113bff5a5d2269ed5ad43b0592e9a14 \
  --init_lora_from=latent-consistency/lcm-lora-sdv1-5 --output_dir=adapters/lcm_coco_curated_run \
  --train_shards_path_or_url=training_data/coco_sd15_curated/wds/coco_train.tar \
  --resolution=512 --train_batch_size=1 --gradient_accumulation_steps=4 --max_train_steps=1500 --max_train_samples=7000 \
  --learning_rate=1e-5 --lr_scheduler=cosine --lr_warmup_steps=50 --lora_rank=64 --lora_alpha=8 --mixed_precision=fp16 \
  --cast_teacher_unet --gradient_checkpointing --vae_encode_batch_size=1 --dataloader_num_workers=0 \
  --checkpointing_steps=500 --checkpoints_total_limit=3 --validation_steps=1000000 --report_to=tensorboard --seed=2026 >> $L 2>&1
echo "[train_v2] exit=$? $(date)" >> evaluation/results/fid/chain9.log
