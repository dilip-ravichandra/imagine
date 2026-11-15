"""Creative features: GrabCut selection, seamless blending, style finishers, manga layout, story engine and their endpoints.
CPU-only: no diffusion weights and no network are needed (the LLM path is exercised through its offline fallback)."""
import base64
import io

import cv2
import numpy as np
import pytest
from PIL import Image

from computer_vision.creative.adjust import adjust, auto_enhance, upscale
from computer_vision.creative.blend import blend_laplacian, crop_window, seamless_paste
from computer_vision.creative.manga import compose_page, halftone, layout, manga_tone, saliency_map
from computer_vision.creative.selection import grabcut_mask, mask_bbox, refine_mask
from computer_vision.creative.stylize import STYLES, apply_style, compose_prompt, resolve_style


def _scene(h=256, w=256):
    """Red disc on a blue-ish textured background: an unambiguous foreground object."""
    rng = np.random.default_rng(0)
    img = np.full((h, w, 3), (160, 90, 40), np.uint8)
    img = np.clip(img.astype(np.int16) + rng.integers(-12, 12, img.shape), 0, 255).astype(np.uint8)
    cv2.circle(img, (w // 2, h // 2), 55, (30, 30, 220), -1)
    return img


def _png_b64(bgr):
    b = io.BytesIO()
    Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).save(b, format="PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


# ---- selection ------------------------------------------------------------------------------------------------
def test_grabcut_finds_the_object_from_a_rough_box():
    img = _scene()
    m = grabcut_mask(img, rect=(60, 60, 140, 140))
    truth = np.zeros(img.shape[:2], np.uint8)
    cv2.circle(truth, (128, 128), 55, 255, -1)
    inter = ((m > 0) & (truth > 0)).sum()
    union = ((m > 0) | (truth > 0)).sum()
    assert inter / union > 0.85  # IoU against the real disc


def test_grabcut_requires_a_hint():
    with pytest.raises(ValueError):
        grabcut_mask(_scene())


def test_refine_mask_closes_pinholes_and_grows():
    m = np.zeros((100, 100), np.uint8)
    cv2.rectangle(m, (30, 30), (70, 70), 255, -1)
    m[50, 50] = 0  # pinhole
    r = refine_mask(m, dilate_px=4)
    assert r[50, 50] == 255 and (r > 0).sum() > (m > 0).sum()


# ---- blending -------------------------------------------------------------------------------------------------
def test_seamless_paste_leaves_pixels_outside_the_mask_bit_exact():
    base = _scene()
    edit = 255 - base
    mask = np.zeros(base.shape[:2], np.uint8)
    cv2.circle(mask, (128, 128), 40, 255, -1)
    out = seamless_paste(base, edit, mask, feather_px=10)
    far = cv2.GaussianBlur(mask, (31, 31), 8) == 0
    assert (out[far] == base[far]).all()
    assert (out[128, 128] != base[128, 128]).any()  # inside the mask the edit shows


def test_blend_laplacian_alpha_extremes():
    a, b = np.full((64, 64, 3), 10, np.uint8), np.full((64, 64, 3), 200, np.uint8)
    assert abs(int(blend_laplacian(a, b, np.zeros((64, 64), np.float32)).mean()) - 10) <= 1
    assert abs(int(blend_laplacian(a, b, np.ones((64, 64), np.float32)).mean()) - 200) <= 1


def test_crop_window_is_inside_the_image_and_covers_the_box():
    x0, y0, x1, y1 = crop_window((100, 100, 140, 150), (512, 400))
    assert 0 <= x0 < x1 <= 512 and 0 <= y0 < y1 <= 400
    assert x0 <= 100 and x1 >= 140 and y0 <= 100 and y1 >= 150


# ---- styles ---------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("sid", list(STYLES))
def test_every_style_finisher_returns_a_same_size_image(sid):
    img = _scene(128, 128)
    out = apply_style(img, sid, seed=1)
    assert out.shape == img.shape and out.dtype == np.uint8
    assert np.array_equal(out, apply_style(img, sid, seed=1))  # deterministic for a seed


def test_style_names_from_the_ui_resolve():
    for ui, sid in {"Anime & Manga": "anime", "Comic Book": "ink", "Cyberpunk": "neon", "Retro Pixel": "pixel", "Cinematic 3D": "cinematic",
                    "Watercolor": "watercolor", "Fantasy Art": "fantasy", "unknown": "photorealistic"}.items():
        assert resolve_style(ui).id == sid


def test_compose_prompt_respects_the_length_limit():
    pos, neg = compose_prompt("a " * 400, "Watercolor", max_len=450)
    assert len(pos) <= 460 and "watercolor" in pos.lower() and neg


# ---- adjust / upscale ----------------------------------------------------------------------------------------
def test_adjust_directions():
    img = _scene(96, 96)
    assert adjust(img, brightness=30).mean() > img.mean()
    assert adjust(img, brightness=-30).mean() < img.mean()
    assert np.array_equal(adjust(img), img)
    assert upscale(img, 2).shape[:2] == (192, 192)
    assert auto_enhance(img).shape == img.shape


# ---- manga ---------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("n", range(1, 9))
def test_page_layout_never_overlaps_and_stays_on_the_page(n):
    rects = layout(n)
    assert len(rects) == n
    for i, a in enumerate(rects):
        assert a[0] >= 0 and a[1] >= 0 and a[0] + a[2] <= 1240 and a[1] + a[3] <= 1754
        for b in rects[i + 1:]:
            assert a[0] + a[2] <= b[0] or b[0] + b[2] <= a[0] or a[1] + a[3] <= b[1] or b[1] + b[3] <= a[1]


def test_halftone_is_binary_and_darker_tones_get_more_ink():
    light, dark = np.full((64, 64), 220, np.uint8), np.full((64, 64), 60, np.uint8)
    assert set(np.unique(halftone(light))) <= {0, 255}
    assert (halftone(dark) == 0).mean() > (halftone(light) == 0).mean()


def test_saliency_prefers_the_detailed_area():
    img = np.full((200, 200, 3), 128, np.uint8)
    cv2.circle(img, (150, 100), 30, (255, 255, 255), -1)
    s = saliency_map(img)
    assert s[100, 150] > s[100, 20]
    assert manga_tone(img, "bw").shape == img.shape


def test_compose_page_with_empty_and_long_text_does_not_crash():
    im = Image.fromarray(cv2.cvtColor(_scene(300, 300), cv2.COLOR_BGR2RGB))
    page = compose_page([dict(image=im, narration=" ", dialogue=[dict(speaker="A", text="x " * 80), dict(speaker="B", text="", kind="shout")], sfx="BOOM"),
                         dict(image=im, narration="Short.", dialogue=[])], "Title", 1, "bw")
    assert page.size == (1240, 1754)


# ---- story engine ---------------------------------------------------------------------------------------------
def test_offline_story_has_the_requested_scenes_and_a_character_sheet():
    from backend.app.services.story import generate_outline, scene_prompt
    o = generate_outline(None, "unused", "A fox learns to fly a kite over the sea", 5)
    assert o["source"] == "offline" and len(o["scenes"]) == 5 and o["characters"]
    assert all(s["dialogue"] and s["shot"] for s in o["scenes"])
    assert o["characters"][0]["look"] in scene_prompt(o, o["scenes"][0])  # the fixed look is repeated in every panel prompt


def test_story_normalise_repairs_bad_llm_json():
    from backend.app.services.story import normalise
    o = normalise({"title": "T", "characters": [{"name": "Ann", "look": "red hat"}],
                   "scenes": [{"title": "s", "dialogue": [{"speaker": "Ann", "text": "hi", "kind": "bogus"}], "shot": "nonsense", "characters": ["Nobody"]}]}, 4)
    s = o["scenes"][0]
    assert s["dialogue"][0]["kind"] == "speech" and s["shot"] in ("wide establishing shot", "medium shot", "close-up", "low-angle shot")
    assert s["characters"] == ["Ann"]


# ---- endpoints ------------------------------------------------------------------------------------------------
def test_styles_endpoint_lists_cv_styles(client):
    j = client.get("/api/v1/styles").json()
    assert {"watercolor", "anime", "pixel"} <= {s["id"] for s in j["styles"]}


def test_cv_endpoints_round_trip(client):
    src = _png_b64(_scene())
    for path, body, size in [("/api/v1/cv/stylize", {"image_base64": src, "style": "Watercolor"}, 256),
                             ("/api/v1/cv/adjust", {"image_base64": src, "brightness": 10}, 256),
                             ("/api/v1/cv/upscale", {"image_base64": src, "scale": 2}, 512)]:
        r = client.post(path, json=body)
        assert r.status_code == 200 and r.json()["width"] == size


def test_select_endpoint_returns_a_mask(client):
    r = client.post("/api/v1/cv/select", json={"image_base64": _png_b64(_scene()), "rect": [60, 60, 140, 140]})
    j = r.json()
    assert r.status_code == 200 and 0.1 < j["area_fraction"] < 0.5 and j["mask_base64"].startswith("data:image/png")


def test_bad_inputs_get_clear_4xx_not_500(client):
    src = _png_b64(_scene())
    assert client.post("/api/v1/cv/select", json={"image_base64": src}).status_code == 400
    assert client.post("/api/v1/cv/adjust", json={"image_base64": "data:image/png;base64,AAAA"}).status_code == 400
    assert client.post("/api/v1/cv/adjust", json={"image_base64": src, "brightness": 999}).status_code == 422
    assert client.post("/api/v1/story/page", json={"title": "x", "panels": [{"image_url": "http://h/images/nothex.png"}]}).status_code == 400


def test_story_outline_endpoint_degrades_to_offline_without_a_key(client):
    j = client.post("/api/v1/story/outline", json={"idea": "A turtle crosses a desert", "n_scenes": 4}).json()
    assert len(j["scenes"]) == 4 and all("image_prompt" in s for s in j["scenes"])
