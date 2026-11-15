#!/usr/bin/env bash
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8 HF_HUB_OFFLINE=1
P=.venv/Scripts/python.exe; L=evaluation/results/fid/chain7.log
$P evaluation/scripts/run_fid_benchmark.py --latency --variants T1,T2,O4T,A4,D4,D2 >> $L 2>&1
echo "[chain7] latency done $(date)" >> $L
$P evaluation/scripts/run_fid_benchmark.py --score --n 300 --variants B0,B1,O8,O4,O2,Q4,O4T,T1,T2,A4,D4,D2 >> $L 2>&1
echo "[chain7] fid scored $(date)" >> $L
$P evaluation/scripts/run_compositional_eval.py --variants T1,T2,O4,Q4,B0,D4 --score >> $L 2>&1
echo "[chain7] ALL DONE $(date)" >> $L
