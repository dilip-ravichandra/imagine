"""Download the model weights once, so the website works with no internet afterwards.
usage (inside the container):  python docker/prefetch_models.py [--minimal]
  --minimal : only SD-Turbo (the default model, ~2.5 GB)
  default   : SD-Turbo + SD 1.5 with LCM-LoRA (the 'balanced' models) + the photo-editing model (~9 GB in total)
It calls the same loaders the website uses, so the Hugging Face cache ends up exactly as the app expects."""
import os
import sys

os.environ.setdefault("IMAGINEAI_ALLOW_DOWNLOAD", "1")
sys.path.insert(0, os.getcwd())


def step(name, fn):
    print(f"\n=== {name} ===", flush=True)
    try:
        fn()
        print(f"OK  {name}", flush=True)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED {name}: {type(exc).__name__}: {exc}", flush=True)
        return False


def main() -> int:
    from backend.app.services import multi_model as mm
    ok = [step("SD-Turbo (default model)", lambda: mm.get_pipeline("sd_turbo"))]
    if "--minimal" not in sys.argv:
        ok.append(step("SD 1.5 + LCM-LoRA (balanced model)", lambda: mm.get_pipeline("sd15_optimized")))
        if mm.imagineai_lcm_path() is not None:
            ok.append(step("Our own LCM-LoRA", lambda: mm.get_pipeline("imagineai_lcm")))
        from backend.app.services import inpaint_cv
        ok.append(step("Photo-editing (inpainting) model", lambda: inpaint_cv._get_pipe(False)))
    print("\nDone." if all(ok) else "\nSome downloads failed (check your internet connection and run again; finished files are kept).")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
