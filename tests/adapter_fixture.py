"""Builds on-disk adapters in every state the gate must distinguish. No torch."""
import csv
import hashlib
import json
from pathlib import Path

from ai_engine.training import adapter as A

REV = "c" * 40


def make_adapter(tmp: Path, name="adapter", weights=b"lora-weights", rev=REV, **meta_over) -> Path:
    d = tmp / name
    d.mkdir(parents=True)
    (d / A.LORA_WEIGHT_NAME).write_bytes(weights)
    meta = dict(status=A.STATUS_DONE, base_model=A.BASE_MODEL, base_revision=rev,
                adapter_sha256=hashlib.sha256(weights).hexdigest(), adapter_bytes=len(weights))
    meta.update(meta_over)
    (d / "adaptation.json").write_text(json.dumps(meta))
    return d


def good_tally(n=40, adapted=30, base=6):
    return dict(adapted_better=adapted, base_better=base, tie=n - adapted - base, unrated=0, rated=n,
                not_worse_fraction=(n - base) / n)


def approve(d: Path, per=None, failures=0, reviewer="R. Viewer", confirmed=True):
    per = per or {30: good_tally()}
    return A.write_approval(d, per_steps=per, failures=failures, reviewer=reviewer, sheet_sha256="s" * 64,
                            artifacts_confirmed=confirmed)


def make_approved(tmp: Path, **kw) -> Path:
    d = make_adapter(tmp, **kw)
    approve(d)
    return d


def make_compare_dir(tmp: Path, adapter: Path, *, pairs_per_steps=40, adapted_wins=30, base_wins=5, name="cmp",
                     adapted_only_failures=0, sha=None):
    """A synthetic filled review: for each steps in (1,4), `pairs_per_steps` pairs, votes mapped through a random-ish key."""
    meta = json.loads((adapter / "adaptation.json").read_text())
    out = tmp / name
    out.mkdir()
    sheet, key, records = [], [], []
    for st in (30,):
        for i in range(pairs_per_steps):
            pid = f"p{i}|steps{st}|seed42"
            a_is_base = (i % 2 == 0)
            key.append(dict(pair=pid, A="base" if a_is_base else "adapted", B="adapted" if a_is_base else "base"))
            want = "adapted" if i < adapted_wins else ("base" if i < adapted_wins + base_wins else None)
            vote = "TIE" if want is None else ("A" if key[-1]["A"] == want else "B")
            sheet.append(dict(pair=pid, prompt="x", image_A="blind/a.png", image_B="blind/b.png",
                              better_A_B_tie=vote, objects_correct_A="", objects_correct_B="", artifacts_A="",
                              artifacts_B="", notes=""))
            for v in ("base", "adapted"):
                status = "ok" if not (v == "adapted" and st == 30 and i < adapted_only_failures) else "failed:RuntimeError"
                records.append(dict(prompt_id=f"p{i}", prompt="x", steps=st, seed=42, variant=v, status=status))
    with (out / "review_sheet.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(sheet[0]))
        w.writeheader()
        w.writerows(sheet)
    (out / "review_key.json").write_text(json.dumps(key))
    (out / "comparison.json").write_text(json.dumps(records))
    (out / "compare_meta.json").write_text(json.dumps(dict(adapter_sha256=sha or meta["adapter_sha256"],
                                                           base_revision=meta["base_revision"])))
    return out
