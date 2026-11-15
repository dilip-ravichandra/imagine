import json

from ai_engine.training import adapter as A
from ai_engine.training.approve import parser, run
from ai_engine.training.adapter import SD15_BASE_MODEL as SD15
from tests.adapter_fixture import REV, make_adapter, make_compare_dir


def go(adapter, cmp_dir, confirm=True, reviewer="R. Viewer"):
    argv = ["--adapter", str(adapter), "--compare", str(cmp_dir), "--reviewer", reviewer]
    if confirm:
        argv.append("--confirm-no-systematic-artifacts")
    return run(parser().parse_args(argv))


def test_good_review_is_approved_and_the_api_gate_then_accepts_it(tmp_path, capsys):
    d = make_adapter(tmp_path, base_model=SD15)
    cmp_dir = make_compare_dir(tmp_path, d)  # 40 pairs/step, 30 adapted wins + 5 base wins + 5 ties => 87.5% not-worse
    assert go(d, cmp_dir) == 0
    assert "APPROVED" in capsys.readouterr().out
    assert A.load_approved_adapter(d, REV, SD15)["sha256"]  # end to end: CLI output is accepted by the API-side gate
    doc = json.loads((d / A.APPROVAL_FILE).read_text())
    assert doc["review_sheet_sha256"] and doc["per_steps"]["30"]["rated"] == 40


def test_missing_confirmation_flag_blocks_approval(tmp_path):
    d = make_adapter(tmp_path, base_model=SD15)
    assert go(d, make_compare_dir(tmp_path, d), confirm=False) == 1
    assert not (d / A.APPROVAL_FILE).exists()


def test_weak_review_is_not_approved(tmp_path, capsys):
    d = make_adapter(tmp_path, base_model=SD15)
    cmp_dir = make_compare_dir(tmp_path, d, adapted_wins=5, base_wins=30)  # adapted clearly worse
    assert go(d, cmp_dir) == 1
    out = capsys.readouterr().out
    assert "NOT APPROVED" in out and "base model stays the default" in out
    assert not (d / A.APPROVAL_FILE).exists()


def test_too_few_rated_pairs_is_not_approved(tmp_path):
    d = make_adapter(tmp_path, base_model=SD15)
    assert go(d, make_compare_dir(tmp_path, d, pairs_per_steps=20, adapted_wins=20, base_wins=0)) == 1


def test_adapted_only_failures_block_approval(tmp_path):
    d = make_adapter(tmp_path, base_model=SD15)
    assert go(d, make_compare_dir(tmp_path, d, adapted_only_failures=1)) == 1


def test_comparison_of_a_different_adapter_is_refused(tmp_path, capsys):
    d = make_adapter(tmp_path, base_model=SD15)
    cmp_dir = make_compare_dir(tmp_path, d, sha="0" * 64)
    assert go(d, cmp_dir) == 2
    assert "different adapter" in capsys.readouterr().err
    assert not (d / A.APPROVAL_FILE).exists()


def test_missing_or_broken_inputs_exit_2(tmp_path):
    d = make_adapter(tmp_path, base_model=SD15)
    empty = tmp_path / "empty"
    empty.mkdir()
    assert go(d, empty) == 2
    assert go(tmp_path / "nope", empty) == 2


def test_blank_reviewer_is_refused(tmp_path):
    d = make_adapter(tmp_path, base_model=SD15)
    assert go(d, make_compare_dir(tmp_path, d), reviewer="  ") == 1
