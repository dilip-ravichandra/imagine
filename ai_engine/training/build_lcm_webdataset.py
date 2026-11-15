"""Package the existing leakage-checked COCO train split as a local WebDataset tar.

Example:
    python -m ai_engine.training.build_lcm_webdataset

The output is a plain tar containing one <key>.jpg and <key>.txt per image-caption pair.
It is intended for upload to a Colab runtime; validation images are never included.
"""
import argparse
import hashlib
import json
import tarfile
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
DEFAULT_DATA = REPO / "training_data" / "coco_sd15_lenbalanced"
DEFAULT_OUT = DEFAULT_DATA / "wds" / "coco_train.tar"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def package(data_dir: Path, out: Path) -> dict:
    manifest = data_dir / "manifest.json"
    metadata = data_dir / "train" / "metadata.jsonl"
    if not manifest.is_file() or not metadata.is_file():
        raise ValueError(f"Expected {manifest} and {metadata}")
    rows = [json.loads(line) for line in metadata.read_text(encoding="utf-8").splitlines() if line.strip()]
    expected = json.loads(manifest.read_text(encoding="utf-8"))["counts"]["train"]
    if len(rows) != expected:
        raise ValueError(f"Train metadata has {len(rows)} rows; manifest expects {expected}")
    if out.exists():
        raise FileExistsError(f"Refusing to overwrite existing archive: {out}")
    out.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(out, mode="w") as archive:
        for index, row in enumerate(rows):
            image_path = data_dir / "train" / row["file_name"]
            if not image_path.is_file():
                raise ValueError(f"Missing training image: {image_path.name}")
            with Image.open(image_path) as im:
                im.verify()
            key = f"{index:06d}"
            image_info = tarfile.TarInfo(f"{key}.jpg")
            image_info.size = image_path.stat().st_size
            image_info.mtime = 0
            with image_path.open("rb") as image_file:
                archive.addfile(image_info, image_file)
            caption = row["text"].encode("utf-8")
            text_info = tarfile.TarInfo(f"{key}.txt")
            text_info.size = len(caption)
            text_info.mtime = 0
            import io
            archive.addfile(text_info, io.BytesIO(caption))
    return {
        "schema": "imagineai-lcm-wds-1",
        "dataset_manifest_sha256": sha256(manifest),
        "training_pairs": len(rows),
        "archive": out.name,
        "archive_bytes": out.stat().st_size,
        "archive_sha256": sha256(out),
        "contains_validation_split": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    result = package(args.data.resolve(), args.out.resolve())
    manifest_path = args.out.with_suffix(".manifest.json")
    manifest_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    print(f"Upload this archive to Google Drive: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
