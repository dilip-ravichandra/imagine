"""Create a reproducibly length-balanced COCO imagefolder from an existing P3A dataset.

The current P2 caption parser placed almost every selected caption in its rich bucket. This
tool reuses only the source TRAIN split and keeps its original validation split intact, assigning
training captions of at most --simple-max-words words to plain and longer captions to rich.
Images are hard-linked where possible (copied across filesystems as a fallback).
"""
import argparse
import json
import shutil
from pathlib import Path

from .data import DataError, _public


def _read_rows(dataset: Path, split: str) -> list:
    manifest = json.loads((dataset / "manifest.json").read_text(encoding="utf-8"))
    rows = manifest[split]
    folder = dataset / split
    for row in rows:
        row["path"] = str((folder / row["file"]).resolve())
    return rows


def _link_or_copy(source: Path, target: Path) -> None:
    try:
        target.hardlink_to(source)
    except OSError:
        shutil.copyfile(source, target)


def rebalance(source: Path, out: Path, simple_max_words: int = 10) -> dict:
    source, out = Path(source), Path(out)
    if out.exists():
        raise DataError(f"Output directory already exists, choose a new one: {out}")
    old = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    train, val = _read_rows(source, "train"), _read_rows(source, "validation")
    for row in train:
        length = len(row["caption"].split())
        row["stratum"] = "plain" if length <= simple_max_words else "rich"
        row["level"] = "simple" if length <= simple_max_words else "complex"
    counts = {name: sum(row["stratum"] == name for row in train) for name in ("plain", "rich")}
    old["dataset"] += " (length-balanced derivative)"
    old["params"] = dict(old.get("params", {}),
                         derived_from=str(source), mix_method="caption word count",
                         simple_max_words=simple_max_words)
    old["parser"]["use"] = ("original leakage-safe COCO train split rebalanced by caption word count; "
                              "plain <= threshold, rich > threshold")
    old["counts"] = dict(old.get("counts", {}), train=len(train), validation=len(val),
                         plain_selected=counts["plain"], rich_selected=counts["rich"],
                         candidates_plain=counts["plain"], candidates_rich=counts["rich"])
    out.mkdir(parents=True)
    for split, rows in (("train", train), ("validation", val)):
        folder = out / split
        folder.mkdir()
        metadata = []
        for index, row in enumerate(rows):
            suffix = Path(row["file_name"]).suffix.lower() or ".jpg"
            target_name = f"{index:06d}{suffix}"
            _link_or_copy(Path(row["path"]), folder / target_name)
            row["file"] = target_name
            metadata.append(json.dumps({"file_name": target_name, "text": row["caption"]}))
        (folder / "metadata.jsonl").write_text("\n".join(metadata) + "\n", encoding="utf-8")
    old["train"] = [_public(row) for row in train]
    old["validation"] = [_public(row) for row in val]
    (out / "manifest.json").write_text(json.dumps(old, indent=2), encoding="utf-8")
    return {"train": len(train), "validation": len(val), **counts,
            "simple_max_words": simple_max_words}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--simple-max-words", type=int, default=10)
    args = parser.parse_args()
    if args.simple_max_words < 1:
        parser.error("--simple-max-words must be positive")
    try:
        print(json.dumps(rebalance(Path(args.source), Path(args.out), args.simple_max_words), indent=2))
    except (DataError, OSError, KeyError, json.JSONDecodeError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
