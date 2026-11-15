#!/usr/bin/env bash
# Runs after the main benchmark finishes: controlled latency -> compositional eval -> rescore.
cd "$(dirname "$0")/../.."
export PYTHONIOENCODING=utf-8
PY=.venv/Scripts/python.exe
LOG=evaluation/results/fid/chain.log
while [ ! -f evaluation/results/fid/fid_results.md ]; do sleep 30; done
echo "[chain] main benchmark done $(date)" >> $LOG
$PY evaluation/scripts/run_fid_benchmark.py --latency --variants T1,T2,O4,O2,O8,A4,Q4,B1,B0 >> $LOG 2>&1
echo "[chain] latency done $(date)" >> $LOG
$PY evaluation/scripts/run_fid_benchmark.py --score --n 300 >> $LOG 2>&1
echo "[chain] rescore done $(date)" >> $LOG
$PY evaluation/scripts/run_compositional_eval.py --generate --score --variants T1,T2,O4,Q4,B0 --per-category 20 >> $LOG 2>&1
echo "[chain] compositional done $(date)" >> $LOG
