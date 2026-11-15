#!/usr/bin/env bash
# Stage 2: TAESD variant, then warm-start LCM distillation on COCO (8 GB laptop GPU settings).
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8 HF_HUB_OFFLINE=1
PY=.venv/Scripts/python.exe
LOG=evaluation/results/fid/chain2.log
while ! grep -q "compositional done" evaluation/results/fid/chain.log 2>/dev/null; do sleep 30; done
echo "[chain2] start $(date)" >> $LOG
$PY evaluation/scripts/run_fid_benchmark.py --generate --latency --variants O4T --n 300 >> $LOG 2>&1
echo "[chain2] O4T done $(date)" >> $LOG
rm -rf adapters/lcm_coco_warmstart_run
$PY -m accelerate.commands.launch --num_processes=1 --mixed_precision=fp16 ai_engine/training/lcm_warmstart.py \
  --pretrained_teacher_model=runwayml/stable-diffusion-v1-5 --teacher_revision=451f4fe16113bff5a5d2269ed5ad43b0592e9a14 \
  --init_lora_from=latent-consistency/lcm-lora-sdv1-5 \
  --output_dir=adapters/lcm_coco_warmstart_run \
  --train_shards_path_or_url=training_data/coco_sd15_lenbalanced/wds/coco_train.tar \
  --resolution=512 --train_batch_size=1 --gradient_accumulation_steps=4 \
  --max_train_steps=500 --max_train_samples=10000 \
  --learning_rate=2e-5 --lr_scheduler=constant --lr_warmup_steps=0 \
  --lora_rank=64 --lora_alpha=64 --mixed_precision=fp16 --cast_teacher_unet \
  --gradient_checkpointing --vae_encode_batch_size=1 --dataloader_num_workers=0 \
  --checkpointing_steps=250 --checkpoints_total_limit=2 --validation_steps=1000000 \
  --report_to=tensorboard --seed=2026 >> evaluation/results/fid/train_lcm_warmstart.log 2>&1
echo "[chain2] training exit=$? $(date)" >> $LOG
