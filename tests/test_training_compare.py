import hashlib
import json

import pytest

from ai_engine.training import compare as C
from ai_engine.training.data import DataError
from ai_engine.training.train_lora import BASE_MODEL, STATUS_DONE

REV = "b" * 40


def make_adapter(tmp_path, **over):
    d = tmp_path / "adapter"
    d.mkdir()
    w = d / "pytorch_lora_weights.safetensors"
    w.write_bytes(b"weights")
    meta = dict(status=STATUS_DONE, base_model=BASE_MODEL, base_revision=REV,
                adapter_sha256=hashlib.sha256(b"weights").hexdigest())
    meta.update(over)
    (d / "adaptation.json").write_text(json.dumps(meta))
    return d, w


def test_valid_adapter_accepted(tmp_path):
    d, _ = make_adapter(tmp_path)
    assert C.validate_adapter(d, REV, BASE_MODEL)["base_revision"] == REV


@pytest.mark.parametrize("over,msg", [(dict(status="started"), "status"), (dict(status="failed"), "status"),
                                      (dict(base_model="other/model"), "different base model"),
                                      (dict(adapter_sha256="0" * 64), "hash")])
def test_bad_adapters_rejected(tmp_path, over, msg):
    d, _ = make_adapter(tmp_path, **over)
    with pytest.raises(DataError, match=msg):
        C.validate_adapter(d, REV, BASE_MODEL)


def test_revision_mismatch_and_modified_weights_and_missing_files(tmp_path):
    d, w = make_adapter(tmp_path)
    with pytest.raises(DataError, match="revision"):
        C.validate_adapter(d, "c" * 40, BASE_MODEL)
    w.write_bytes(b"tampered")
    with pytest.raises(DataError, match="hash"):
        C.validate_adapter(d, REV, BASE_MODEL)
    w.unlink()
    with pytest.raises(DataError, match="needs"):
        C.validate_adapter(d, REV, BASE_MODEL)


MAN = {"validation": [{"image_id": 1, "caption": "A red cup beside a blue plate"},
                      {"image_id": 2, "caption": "A green apple on a table"}]}
EVAL = [{"id": "D1", "split": "dev", "prompt": "dev prompt one here"},
        {"id": "T1", "split": "test", "prompt": "SECRET TEST PROMPT"}]


def test_plan_never_includes_test_prompts_and_is_a_full_grid():
    plan = C.plan_runs(MAN, EVAL, [1, 4], [42, 43])
    assert len(plan) == 3 * 2 * 2
    assert all("SECRET" not in r["prompt"] and r["prompt_id"] != "T1" for r in plan)
    assert {r["source"] for r in plan} == {"validation", "dev"}


def test_plan_limit_and_empty_and_duplicates():
    assert len({r["prompt_id"] for r in C.plan_runs(MAN, EVAL, [1], [1], limit=2)}) == 2
    with pytest.raises(DataError):
        C.plan_runs({"validation": []}, [], [1], [1])
    with pytest.raises(DataError, match="Duplicate"):
        C.plan_runs({"validation": [{"image_id": 1, "caption": "a"}, {"image_id": 1, "caption": "b"}]}, [], [1], [1])


def recs(n=8):
    out = []
    for i in range(n):
        for v in ("base", "adapted"):
            out.append(dict(prompt_id=f"p{i}", prompt=f"prompt {i}", steps=1, seed=42, variant=v, status="ok",
                            image=f"{v}/{i}.png"))
    return out


def test_review_sheet_is_blind_balanced_and_keyed():
    sheet, key = C.build_review(recs(40))
    assert len(sheet) == len(key) == 40
    for row in sheet:
        assert set(row) >= {"image_A", "image_B", "better_A_B_tie"}
        visible = " ".join(str(v) for v in row.values()).lower()
        assert "adapted" not in visible and "base/" not in visible  # nothing the reviewer sees names the variant
        assert row["image_A"].startswith("blind/") and row["image_B"].startswith("blind/")
    assert all(k["A_source"] != k["B_source"] for k in key)
    a_base = sum(k["A"] == "base" for k in key)
    assert 8 < a_base < 32  # randomised, not all one side
    assert all({k["A"], k["B"]} == {"base", "adapted"} for k in key)
    assert C.build_review(recs(40)) == (sheet, key)  # deterministic


def test_review_skips_unpaired_and_failed():
    r = recs(2)
    r[1]["status"] = "filtered"
    sheet, _ = C.build_review(r)
    assert len(sheet) == 1


def test_summarize_review_maps_blind_votes_back_correctly():
    sheet, key = C.build_review(recs(6))
    truth = {k["pair"]: k for k in key}
    filled = []
    for i, row in enumerate(sheet):
        k = truth[row["pair"]]
        # vote for whichever side is the ADAPTED image on even rows, BASE on odd rows, tie on the last
        want = "adapted" if i % 2 == 0 else "base"
        vote = "A" if k["A"] == want else "B"
        filled.append(dict(row, better_A_B_tie="TIE" if i == 5 else vote))
    t = C.summarize_review(filled, key)
    assert (t["adapted_better"], t["base_better"], t["tie"]) == (3, 2, 1)  # rows 0,2,4 adapted; 1,3 base; 5 tie
    assert t["rated"] == 6 and t["unrated"] == 0


def test_summarize_review_counts_unfilled_instead_of_guessing():
    sheet, key = C.build_review(recs(3))
    t = C.summarize_review(sheet, key)  # nothing filled in
    assert t["unrated"] == 3 and t["rated"] == 0 and t["adapted_not_worse_fraction"] is None


def test_blind_copies_have_neutral_names_and_the_right_content(tmp_path):
    out = tmp_path / "run"
    (out / "base").mkdir(parents=True)
    (out / "adapted").mkdir()
    records = recs(4)
    for r in records:
        (out / r["image"]).write_bytes(r["variant"].encode() + r["prompt_id"].encode())
    sheet, key = C.build_review(records)
    C.make_blind_copies(out, sheet, key)
    for row, k in zip(sheet, key):
        a, b = (out / row["image_A"]).read_bytes(), (out / row["image_B"]).read_bytes()
        assert a.startswith(k["A"].encode()) and b.startswith(k["B"].encode())  # key really maps A/B correctly
    assert sorted(p.name for p in (out / "blind").iterdir())[:2] == ["0001_A.png", "0001_B.png"]
