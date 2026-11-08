"""Turn a FILLED blind-review sheet into approval.json (the only way an adapter becomes usable by the API).

    python -m ai_engine.training.approve --adapter adapters\\small --compare evaluation\\results\\p3a_compare_small ^
        --reviewer "Your Name" --confirm-no-systematic-artifacts

Refuses unless: the comparison was run on THIS adapter, the tallies meet the rule for 30 steps
(>= 40 rated pairs each, >= 70% adapted-better-or-tie), no pair where only the adapted run failed, and you
explicitly confirm you saw no systematic artefact. Exit 0 = approved, 1 = rule not met, 2 = bad input.
"""
import argparse
import csv
import json
import sys
from pathlib import Path

from .adapter import (RULE, SD15_BASE_MODEL, AdapterRejected, new_failures, sha256_file, tally_by_steps,
                      validate_adapter, write_approval)
from .data import DataError


def run(a) -> int:
    cmp_dir, adapter = Path(a.compare), Path(a.adapter)
    try:
        meta = validate_adapter(adapter, expected_model=SD15_BASE_MODEL)
        cm = json.loads((cmp_dir / "compare_meta.json").read_text(encoding="utf-8"))
        if cm.get("adapter_sha256") != meta["adapter_sha256"] or cm.get("base_revision") != meta["base_revision"]:
            raise DataError("This comparison was run on a different adapter/base revision; compare again")
        sheet_path = cmp_dir / "review_sheet.csv"
        with sheet_path.open(newline="", encoding="utf-8") as f:
            sheet = list(csv.DictReader(f))
        key = json.loads((cmp_dir / "review_key.json").read_text(encoding="utf-8"))
        records = json.loads((cmp_dir / "comparison.json").read_text(encoding="utf-8"))
    except (DataError, OSError, KeyError, json.JSONDecodeError, ValueError) as e:
        print("ERROR:", e, file=sys.stderr)
        return 2
    per = tally_by_steps(sheet, key)
    fails = new_failures(records)
    for st in sorted(per):
        t = per[st]
        frac = "n/a" if t["not_worse_fraction"] is None else f"{t['not_worse_fraction']:.0%}"
        print(f"steps={st}: rated={t['rated']} adapted_better={t['adapted_better']} base_better={t['base_better']} "
              f"tie={t['tie']} unrated={t['unrated']} adapted_not_worse={frac}")
    print(f"pairs where only the adapted run failed/was filtered: {fails}")
    try:
        doc = write_approval(adapter, per_steps=per, failures=fails, reviewer=a.reviewer,
                             sheet_sha256=sha256_file(sheet_path), artifacts_confirmed=a.confirm_no_systematic_artifacts,
                             expected_model=SD15_BASE_MODEL)
    except AdapterRejected as e:
        print("NOT APPROVED:", e)
        print("The base model stays the default. Record this outcome in docs/ADAPTATION_RESULT.md.")
        return 1
    print(f"APPROVED: wrote {Path(a.adapter) / 'approval.json'} (bound to adapter {doc['adapter_sha256'][:12]}).")
    print("Rule used:", json.dumps({k: (list(v) if isinstance(v, tuple) else v) for k, v in RULE.items()}))
    return 0


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--adapter", required=True)
    p.add_argument("--compare", required=True, help="the folder written by ai_engine.training.compare")
    p.add_argument("--reviewer", required=True)
    p.add_argument("--confirm-no-systematic-artifacts", action="store_true",
                   help="you looked at the images and saw no colour cast / texture collapse / other systematic artefact")
    return p


if __name__ == "__main__":
    sys.exit(run(parser().parse_args()))
