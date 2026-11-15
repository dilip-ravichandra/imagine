#!/usr/bin/env bash
# waits for the curated training, exports checkpoints, benchmarks them (4 steps), then the best at 2 steps
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8 HF_HUB_OFFLINE=1
P=.venv/Scripts/python.exe; L=evaluation/results/fid/chain9.log
until grep -aq "train_v2\] exit" $L 2>/dev/null; do sleep 30; done
R=adapters/lcm_coco_curated_run
for n in 500 1000 1500; do
  src=$R/checkpoint-$n/unet_lora; [ $n = 1500 ] && [ ! -d $src ] && src=$R/unet_lora
  $P -m ai_engine.training.export_lcm_adapter $src adapters/lcm_curated_$n --alpha 8 --rank 64 >> $L 2>&1
done
$P evaluation/scripts/run_fid_benchmark.py --generate --latency --variants E500,E1000,E1500 --n 300 >> $L 2>&1
$P evaluation/scripts/run_fid_benchmark.py --score --n 300 --variants O4,D4,E500,E1000,E1500 >> $L 2>&1
echo "[chain9] stage1 scored $(date)" >> $L
