# Classical-CV ablation on real O4 outputs

n = 300 images. Reference = real COCO validation photos. Deltas are vs `none`.

| CV configuration | FID | ΔFID | KID×1e3 | CLIP | ΔCLIP | CV ms/img | sharpness (Laplacian var) | flagged | pixels changed |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| none | 121.21 | +0.00 | 10.0 | 0.3034 | +0.0000 | 95.2 | 2008 | 68% | 0% |
| enhance (CLAHE/WB/gamma, adaptive) | 120.90 | -0.31 | 9.5 | 0.3040 | +0.0006 | 177.6 | 1954 | 58% | 74% |
| smooth (bilateral) | 121.56 | +0.36 | 10.2 | 0.3035 | +0.0000 | 185.6 | 1859 | 61% | 100% |
| sharpen (edge-preserving unsharp) | 120.84 | -0.37 | 9.7 | 0.3037 | +0.0002 | 161.5 | 2775 | 68% | 100% |
| smooth + sharpen | 121.19 | -0.02 | 9.8 | 0.3037 | +0.0002 | 202.0 | 2573 | 61% | 100% |
| enhance + smooth + sharpen | 121.03 | -0.18 | 9.3 | 0.3039 | +0.0005 | 230.1 | 2496 | 51% | 100% |
| correct (guarded artifact fix) | 120.88 | -0.33 | 9.8 | 0.3035 | +0.0001 | 226.0 | 1942 | 53% | 40% |