"""Adapter validation + the approval gate. Pure Python: no torch, safe to import from the API process.

An adapter is usable by the API only if ALL hold:
  1. adaptation.json says training completed for the configured base model at exactly the server's pinned revision;
  2. the weights file still has the SHA-256 recorded at training time;
  3. approval.json exists, is bound to that same SHA-256, and records a blind review that meets RULE below.
Anything else => the caller falls back to the base model. This is an integrity check against accidents
(wrong file, edited file, unreviewed adapter), NOT a security boundary: someone with write access to the
adapter folder can forge approval.json.
"""
import hashlib
import json
from pathlib import Path

from .data import DataError

BASE_MODEL = "stabilityai/sd-turbo"
SD15_BASE_MODEL = "stable-diffusion-v1-5/stable-diffusion-v1-5"
STATUS_DONE = "training_completed_not_validated"
LORA_WEIGHT_NAME = "pytorch_lora_weights.safetensors"  # shared by train, compare and the API so all load it identically
APPROVAL_FILE = "approval.json"
APPROVAL_SCHEMA = "p3b-approval-1"
# Written before any result existed (docs/ADAPTATION.md). Judgement calls, not statistics.
RULE = dict(required_steps=(30,), min_rated_pairs_per_steps=40, min_not_worse_fraction=0.70, max_new_failures=0)


class AdapterRejected(DataError):
    """The adapter must not be used. The message is safe to show to clients: it never contains paths."""


def sha256_file(p) -> str:
    h = hashlib.sha256()
    with Path(p).open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def validate_adapter(adapter_dir, expected_revision=None, expected_model=BASE_MODEL) -> dict:
    """Refuse adapters that are incomplete, mismatched, or altered since training. Returns adaptation.json."""
    adapter_dir = Path(adapter_dir)
    meta_file, weights = adapter_dir / "adaptation.json", adapter_dir / LORA_WEIGHT_NAME
    if not meta_file.is_file() or not weights.is_file():
        raise DataError(f"Adapter folder needs adaptation.json and {LORA_WEIGHT_NAME}")
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    if meta.get("status") != STATUS_DONE:
        raise DataError(f"Adapter status is {meta.get('status')!r}, expected {STATUS_DONE!r}")
    if meta.get("base_model") != expected_model:
        raise DataError("Adapter was trained for a different base model")
    if expected_revision and meta.get("base_revision") != expected_revision:
        raise DataError("Adapter base revision differs from the revision you asked to compare against")
    if sha256_file(weights) != meta.get("adapter_sha256"):
        raise DataError("Adapter file hash differs from adaptation.json (file changed after training)")
    return meta


# ---------------------------------------------------------------- review -> approval
def _steps_of(pair_id: str) -> int:
    for part in pair_id.split("|"):
        if part.startswith("steps"):
            return int(part[5:])
    raise DataError(f"Pair id has no steps: {pair_id!r}")


def tally_by_steps(sheet_rows: list, key: list) -> dict:
    """Map blind A/B/TIE votes back to base/adapted, separately for each step count. Unrated rows are counted, not guessed."""
    who = {k["pair"]: k for k in key}
    out = {}
    for r in sheet_rows:
        t = out.setdefault(_steps_of(r["pair"]), dict(adapted_better=0, base_better=0, tie=0, unrated=0))
        v, k = (r.get("better_A_B_tie") or "").strip().upper(), who.get(r["pair"])
        if v not in ("A", "B", "TIE") or not k:
            t["unrated"] += 1
        elif v == "TIE":
            t["tie"] += 1
        else:
            t["adapted_better" if k[v] == "adapted" else "base_better"] += 1
    for t in out.values():
        t["rated"] = t["adapted_better"] + t["base_better"] + t["tie"]
        t["not_worse_fraction"] = (t["adapted_better"] + t["tie"]) / t["rated"] if t["rated"] else None
    return out


def new_failures(records: list) -> int:
    """Pairs where the adapted run failed/was filtered but the base run for the same prompt/steps/seed was fine."""
    by = {}
    for r in records:
        by.setdefault((r["prompt_id"], r["steps"], r["seed"]), {})[r["variant"]] = r["status"]
    return sum(1 for v in by.values() if v.get("base") == "ok" and v.get("adapted") not in (None, "ok"))


def evaluate_rule(per_steps: dict, failures: int, rule: dict = None) -> tuple:
    """(passed, reasons). Every required step count must independently meet the thresholds."""
    rule = rule or RULE  # looked up at call time so a changed RULE really invalidates old approvals
    reasons = []
    for st in rule["required_steps"]:
        t = per_steps.get(st)
        if not t or t["rated"] < rule["min_rated_pairs_per_steps"]:
            reasons.append(f"steps={st}: {t['rated'] if t else 0} rated pairs, need {rule['min_rated_pairs_per_steps']}")
        elif t["not_worse_fraction"] < rule["min_not_worse_fraction"]:
            reasons.append(f"steps={st}: adapted better-or-tie on {t['not_worse_fraction']:.0%}, "
                           f"need {rule['min_not_worse_fraction']:.0%}")
    if failures > rule["max_new_failures"]:
        reasons.append(f"{failures} pair(s) where the adapted run failed/was filtered but the base run succeeded")
    return (not reasons), reasons


def write_approval(adapter_dir, *, per_steps: dict, failures: int, reviewer: str, sheet_sha256: str,
                   artifacts_confirmed: bool, expected_model=BASE_MODEL) -> dict:
    """Write approval.json ONLY if the rule passes and the human artefact check was confirmed. Raises otherwise."""
    meta = validate_adapter(adapter_dir, expected_model=expected_model)
    passed, reasons = evaluate_rule(per_steps, failures)
    if not artifacts_confirmed:
        reasons.append("reviewer did not confirm the absence of systematic artefacts (colour cast, texture collapse)")
    if not reviewer.strip():
        reasons.append("reviewer name is required")
    if reasons:
        raise AdapterRejected("; ".join(reasons))
    doc = dict(schema=APPROVAL_SCHEMA, adapter_sha256=meta["adapter_sha256"], base_model=meta["base_model"],
               base_revision=meta["base_revision"], rule=dict(RULE, required_steps=list(RULE["required_steps"])),
               per_steps={str(k): v for k, v in per_steps.items()}, new_failures=failures, reviewer=reviewer.strip(),
               review_sheet_sha256=sheet_sha256, artifacts_confirmed=True, passed=True)
    (Path(adapter_dir) / APPROVAL_FILE).write_text(json.dumps(doc, indent=2), encoding="utf-8")
    return doc


def load_approved_adapter(adapter_dir, expected_revision, expected_model=BASE_MODEL) -> dict:
    """What the API calls. Returns {path, sha256, bytes, base_revision, reviewer}; raises AdapterRejected otherwise.

    Re-evaluates the recorded tallies against the CURRENT rule, so tightening RULE later invalidates old approvals.
    """
    try:
        if not expected_revision:
            raise AdapterRejected("MODEL_REVISION must be pinned to the adapter's base revision before an adapter can be used")
        meta = validate_adapter(adapter_dir, expected_revision, expected_model)
        if meta.get("base_model") != expected_model:
            raise AdapterRejected("Adapter base model differs from the configured model")
        f = Path(adapter_dir) / APPROVAL_FILE
        if not f.is_file():
            raise AdapterRejected("Adapter has not been approved (no approval.json). Run ai_engine.training.approve after a blind review")
        a = json.loads(f.read_text(encoding="utf-8"))
        if a.get("schema") != APPROVAL_SCHEMA or a.get("passed") is not True or a.get("artifacts_confirmed") is not True:
            raise AdapterRejected("Approval record is not a passing approval")
        if a.get("adapter_sha256") != meta["adapter_sha256"] or a.get("base_revision") != meta["base_revision"]:
            raise AdapterRejected("Approval belongs to a different adapter or base revision")
        per = {int(k): v for k, v in a.get("per_steps", {}).items()}
        ok, reasons = evaluate_rule(per, int(a.get("new_failures", 1)))
        if not ok:
            raise AdapterRejected("Recorded review no longer satisfies the acceptance rule: " + "; ".join(reasons))
        return dict(path=str(Path(adapter_dir)), sha256=meta["adapter_sha256"],
                    bytes=(Path(adapter_dir) / LORA_WEIGHT_NAME).stat().st_size,
                    base_revision=meta["base_revision"], reviewer=a.get("reviewer", ""))
    except AdapterRejected:
        raise
    except DataError as e:  # plain validation failure: same safe message, normalised type
        raise AdapterRejected(str(e)) from None
    except (OSError, ValueError, KeyError, TypeError):  # unreadable/garbled metadata; details stay out of the message
        raise AdapterRejected("Adapter metadata is unreadable or malformed") from None
