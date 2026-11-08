"""Run advisory Gemini reviews over a blinded comparison directory.

The output is separate from the human review sheet and never writes approval.json.
"""
import argparse
import base64
import csv
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx


def data_url(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def run(args) -> int:
    compare = Path(args.compare)
    sheet_path = compare / "review_sheet.csv"
    if not sheet_path.is_file():
        print(f"ERROR: review sheet not found: {sheet_path}", file=sys.stderr)
        return 2
    with sheet_path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    def review_one(row):
        for attempt in range(args.retries + 1):
            try:
                with httpx.Client(timeout=args.timeout) as client:
                    response = client.post(
                        args.endpoint,
                        json={
                            "prompt": row["prompt"],
                            "image_a": data_url(compare / row["image_A"]),
                            "image_b": data_url(compare / row["image_B"]),
                        },
                    )
                    response.raise_for_status()
                    return dict(row, ai_status="ok", **response.json())
            except httpx.HTTPStatusError as exc:
                if attempt < args.retries and exc.response.status_code in {429, 500, 502, 503, 504}:
                    time.sleep(args.retry_delay * (attempt + 1))
                    continue
                return dict(row, ai_status="failed", ai_error=f"http_{exc.response.status_code}")
            except (OSError, httpx.HTTPError, ValueError, KeyError) as exc:
                if attempt < args.retries:
                    time.sleep(args.retry_delay * (attempt + 1))
                    continue
                return dict(row, ai_status="failed", ai_error=type(exc).__name__)

    previous = {}
    if args.resume and (compare / "ai_review.json").is_file():
        previous = {
            row["pair"]: row for row in json.loads((compare / "ai_review.json").read_text(encoding="utf-8"))
            if row.get("ai_status") == "ok"
        }
    results = [previous.get(row["pair"]) for row in rows]
    pending = {index: row for index, row in enumerate(rows) if results[index] is None}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(review_one, row): index for index, row in pending.items()}
        for completed, future in enumerate(as_completed(jobs), start=1):
            index = jobs[future]
            results[index] = future.result()
            status = results[index]["ai_status"]
            print(f"{completed}/{len(rows)} {status}", flush=True)

    report = compare / "ai_review.json"
    report.write_text(json.dumps(results, indent=2), encoding="utf-8")
    with (compare / "ai_review.csv").open("w", newline="", encoding="utf-8") as handle:
        fields = sorted({key for row in results for key in row})
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(results)

    successful = [row for row in results if row["ai_status"] == "ok"]
    winners = {"A": 0, "B": 0, "TIE": 0}
    for row in successful:
        winners[row["winner"]] += 1
    summary = {
        "pairs": len(results),
        "successful_reviews": len(successful),
        "failed_reviews": len(results) - len(successful),
        "winner_counts": winners,
        "ai_A_not_worse_fraction": (winners["A"] + winners["TIE"]) / len(successful) if successful else None,
        "variant_mapping_deferred": True,
        "approval_written": False,
        "human_review_required": True,
    }
    (compare / "ai_review_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0 if len(successful) == len(results) else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compare", required=True)
    parser.add_argument("--endpoint", default="http://localhost:8080/api/v1/review/pair")
    parser.add_argument("--timeout", type=float, default=120)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--retry-delay", type=float, default=5)
    parser.add_argument("--resume", action="store_true")
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
