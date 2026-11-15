import json
from argparse import Namespace

import pytest

from ai_engine.training import train_lora as T
from ai_engine.training.build_dataset import build, main as build_main
from ai_engine.training.data import DataError
from tests.coco_fixture import make_coco, make_eval

REV = "a" * 40


@pytest.fixture
def dataset(tmp_path):
    ann, img_dir, _ = make_coco(tmp_path)
    ev = make_eval(tmp_path, [{"source_image_id": "1000", "prompt": "nothing relevant here at all"}])
    out = tmp_path / "ds"
    code = build_main(["--coco-annotations", str(ann), "--coco-images", str(img_dir), "--out", str(out),
                       "--n-train", "20", "--n-val", "4", "--eval-prompts", str(ev)])
    assert code == 0
    return out, ev


def args(data, out, **kw):
    base = dict(data=str(data), out=str(out), revision=REV, preset="smoke", steps=None, accum=None, warmup=None,
                rank=4, learning_rate=5e-5, resolution=512, seed=1, checkpoint_every=None, eval_prompts=None, dry_run=True)
    base.update(kw)
    return Namespace(**base)


# ---- settings
def test_presets_and_overrides():
    s = T.resolve_settings(args("d", "o", preset="small"))
    assert (s["steps"], s["accum"], s["warmup"]) == (150, 4, 15)
    s = T.resolve_settings(args("d", "o", preset="small", steps=40, warmup=4))
    assert (s["steps"], s["warmup"]) == (40, 4)


@pytest.mark.parametrize("kw", [dict(preset=None), dict(steps=0), dict(rank=0), dict(learning_rate=0),
                                dict(resolution=256), dict(preset="small", warmup=100),
                                dict(preset="small", steps=20, warmup=15)])
def test_bad_settings_rejected(kw):
    with pytest.raises(DataError):
        T.resolve_settings(args("d", "o", **kw))


def test_warmup_is_always_explicit_and_cannot_be_upstream_default():
    """Upstream defaults to 500 warm-up steps, which would never finish in a 150-step run."""
    for preset in T.PRESETS:
        s = T.resolve_settings(args("d", "o", preset=preset))
        cmd = T.build_command(args("d", "o", preset=preset), s)
        flag = [c for c in cmd if c.startswith("--lr_warmup_steps=")]
        assert flag and int(flag[0].split("=")[1]) <= s["steps"] // 2


# ---- command
def test_command_has_required_flags_and_none_of_the_harmful_ones(tmp_path):
    a = args(tmp_path / "d", tmp_path / "o")
    cmd = T.build_command(a, T.resolve_settings(a))
    joined = " ".join(cmd)
    for must in ("--pretrained_model_name_or_path=stable-diffusion-v1-5/stable-diffusion-v1-5", f"--revision={REV}", "--variant=fp16",
                 "--center_crop", "--gradient_checkpointing", "--train_batch_size=1", "--report_to=none",
                 "--lr_scheduler=constant", "--max_grad_norm=1.0", "--caption_column=text", "--image_column=image"):
        assert must in cmd, must
    assert "random_flip" not in joined  # would swap left/right in spatial captions
    assert "validation_prompt" not in joined  # upstream validation settings are wrong for SD-Turbo
    assert str(T.TRAINER) in cmd and any(c.startswith("--train_data_dir=") and c.endswith("train") for c in cmd)


# ---- preflight
def test_preflight_passes_on_a_good_dataset(dataset, tmp_path):
    d, ev = dataset
    a = args(d, tmp_path / "adapter", eval_prompts=[str(ev)])
    assert T.preflight(a, T.resolve_settings(a), check_cuda=False) == []


def test_preflight_bad_revisions(dataset, tmp_path):
    d, ev = dataset
    for rev in ("main", "", "A" * 40, "a" * 39, "g" * 40):
        a = args(d, tmp_path / "o", revision=rev, eval_prompts=[str(ev)])
        assert any("40-character" in p for p in T.preflight(a, T.resolve_settings(a), check_cuda=False)), rev


def test_preflight_rejects_non_dataset_and_existing_output(dataset, tmp_path):
    d, ev = dataset
    a = args(tmp_path / "empty", tmp_path / "o", eval_prompts=[str(ev)])
    assert any("not a P3A dataset" in p for p in T.preflight(a, T.resolve_settings(a), check_cuda=False))
    existing = tmp_path / "adapter"
    existing.mkdir()
    a = args(d, existing, eval_prompts=[str(ev)])
    assert any("never overwritten" in p for p in T.preflight(a, T.resolve_settings(a), check_cuda=False))


def test_launcher_rechecks_leakage_against_the_current_eval_file(dataset, tmp_path):
    """Eval prompts added AFTER the dataset was built must still block training on them."""
    d, _ = dataset
    man = json.loads((d / "manifest.json").read_text())
    victim = man["train"][0]
    later = make_eval(tmp_path / "later", [{"source_image_id": str(victim["image_id"]), "prompt": "q w e r t"}]) \
        if (tmp_path / "later").mkdir() is None else None
    a = args(d, tmp_path / "o", eval_prompts=[str(later)])
    problems = T.preflight(a, T.resolve_settings(a), check_cuda=False)
    assert any("leakage" in p.lower() for p in problems)


def test_preflight_detects_tampered_trainer(dataset, tmp_path, monkeypatch):
    d, ev = dataset
    fake = tmp_path / "trainer.py"
    fake.write_text("print('evil')")
    monkeypatch.setattr(T, "TRAINER", fake)
    a = args(d, tmp_path / "o", eval_prompts=[str(ev)])
    assert any("hash differs" in p for p in T.preflight(a, T.resolve_settings(a), check_cuda=False))


def test_vendored_trainer_matches_pinned_hash():
    assert T.sha256_file(T.TRAINER) == T.TRAINER_SHA256


def test_under_half_epoch_blocks_real_runs_but_not_smoke(dataset, tmp_path):
    d, ev = dataset  # 20 training images
    a = args(d, tmp_path / "o", preset=None, steps=4, accum=1, warmup=0, eval_prompts=[str(ev)])
    assert any("half an epoch" in p for p in T.preflight(a, T.resolve_settings(a), check_cuda=False))
    a = args(d, tmp_path / "o2", preset="smoke", eval_prompts=[str(ev)])
    assert T.preflight(a, T.resolve_settings(a), check_cuda=False) == []


def test_cuda_and_packages_checked_when_not_dry_run(dataset, tmp_path):
    d, ev = dataset
    a = args(d, tmp_path / "o", eval_prompts=[str(ev)])
    problems = T.preflight(a, T.resolve_settings(a), check_cuda=True, cuda_available=False)
    assert any("Missing packages" in p or "No CUDA" in p for p in problems)  # torch is absent in CI sandbox


# ---- run() / dry run
def test_dry_run_prints_command_and_writes_nothing(dataset, tmp_path, capsys):
    d, ev = dataset
    out = tmp_path / "adapter"
    rc = T.run(args(d, out, eval_prompts=[str(ev)]))
    text = capsys.readouterr().out
    assert rc == 0 and "DRY RUN" in text and "--lr_warmup_steps=0" in text and not out.exists()


def test_dry_run_reports_problems_with_nonzero_exit(dataset, tmp_path, capsys):
    d, ev = dataset
    rc = T.run(args(d, tmp_path / "o", revision="main", eval_prompts=[str(ev)]))
    assert rc == 1 and "40-character" in capsys.readouterr().out


def test_real_run_refuses_to_launch_without_gpu_stack(dataset, tmp_path, capsys, monkeypatch):
    _pre = T.preflight
    monkeypatch.setattr(T, "preflight", lambda a, s, **k: _pre(a, s, **dict(k, cuda_available=False)))
    d, ev = dataset
    out = tmp_path / "adapter"
    rc = T.run(args(d, out, dry_run=False, eval_prompts=[str(ev)]))
    assert rc == 2 and not out.exists()  # nothing created when preflight fails


# ---- build_dataset CLI
def test_build_cli_errors_are_clean(tmp_path, capsys):
    ann, img_dir, _ = make_coco(tmp_path)
    ev = make_eval(tmp_path, [{"prompt": "a b c d e"}])
    base = ["--coco-annotations", str(ann), "--coco-images", str(img_dir), "--eval-prompts", str(ev)]
    assert build_main(base + ["--out", str(tmp_path / "a")]) == 2  # no size/preset
    assert build_main(base + ["--out", str(tmp_path / "b"), "--n-train", "100", "--n-val", "10"]) == 2  # shortfall
    assert "Only" in capsys.readouterr().err
    assert not (tmp_path / "b").exists()  # failed build leaves nothing half-written


def test_presets_exist_and_are_small():
    from ai_engine.training.build_dataset import PRESETS
    assert PRESETS["smoke"]["n_train"] < PRESETS["small"]["n_train"] <= 1000
