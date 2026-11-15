#!/usr/bin/env bash
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8 HF_HUB_OFFLINE=1
P=.venv/Scripts/python.exe; L=evaluation/results/fid/chain10.log
$P evaluation/scripts/run_fid_benchmark.py --generate --latency --variants E500,E1000,E1500,E2000 --n 300 >> $L 2>&1
echo "[chain10] gen done $(date)" >> $L
$P evaluation/scripts/run_fid_benchmark.py --score --n 300 --variants E500,E1000,E1500,E2000 >> $L 2>&1
echo "[chain10] ALL DONE $(date)" >> $L
