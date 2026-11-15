"""Story engine: idea -> structured story (characters, scenes, dialogue, shot list) -> per-scene image prompts.

The LLM (Groq, server-side key) writes a *comic script*, not just prose: each scene has a shot type, a visual description,
narration, speech/thought/shout lines and an optional sound effect. A character sheet (name + fixed visual description) is
injected verbatim into every scene's image prompt, which is what keeps a character recognisable from panel to panel with a
text-to-image model. If no LLM is configured or it fails, a deterministic offline outline is returned so the feature never
breaks (clearly marked ``source: offline``).
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

log = logging.getLogger(__name__)
SHOTS = ["wide establishing shot", "medium shot", "close-up", "low-angle shot", "over-the-shoulder shot", "bird's-eye view", "dutch angle", "extreme close-up"]
KINDS = {"speech", "thought", "shout"}

SYSTEM = (
    "You are a professional comic and manga scriptwriter. Reply with ONE JSON object only, no prose, no markdown. "
    "Write a coherent story with a clear beginning, rising action, a turning point and an ending. Keep it child-safe. "
    "Schema: {\"title\": str, \"logline\": str, \"world\": str (visual setting, <=25 words), "
    "\"characters\": [{\"name\": str, \"role\": str, \"look\": str (fixed visual description for an illustrator: age, hair, clothes with colours, "
    "distinguishing feature; <=25 words; no names inside)}], "
    "\"scenes\": [{\"title\": str, \"narration\": str (<=28 words, may be empty), \"visual\": str (what the panel shows, concrete nouns and action, <=35 words), "
    "\"shot\": one of [wide establishing shot, medium shot, close-up, low-angle shot, over-the-shoulder shot, bird's-eye view], "
    "\"mood\": str (1-3 words), \"characters\": [names present], "
    "\"dialogue\": [{\"speaker\": name, \"text\": str (<=14 words), \"kind\": \"speech\"|\"thought\"|\"shout\"}], \"sfx\": str (optional, one short word)}]}. "
    "Each scene must advance the plot. Use 0-2 dialogue lines per scene. Do not repeat the same sentence in different scenes."
)


def _clean_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    m = re.search(r"\{.*\}", text, flags=re.S)
    return json.loads(m.group(0) if m else text)


def _words(s: Any, n: int) -> str:
    t = str(s or "").replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("—", "-")
    w = t.split()
    return " ".join(w[:n]).strip()


def normalise(raw: dict, n_scenes: int) -> dict:
    chars = []
    for c in (raw.get("characters") or [])[:4]:
        if isinstance(c, dict) and c.get("name"):
            chars.append({"name": _words(c["name"], 3), "role": _words(c.get("role"), 6), "look": _words(c.get("look"), 32)})
    if not chars:
        chars = [{"name": "Hero", "role": "protagonist", "look": "a young adventurer with messy hair and a bright jacket"}]
    names = {c["name"].lower() for c in chars}
    scenes = []
    for i, sc in enumerate((raw.get("scenes") or [])[:n_scenes]):
        if not isinstance(sc, dict):
            continue
        dlg = []
        for d in (sc.get("dialogue") or [])[:2]:
            if isinstance(d, dict) and d.get("text"):
                k = d.get("kind") if d.get("kind") in KINDS else "speech"
                dlg.append({"speaker": _words(d.get("speaker"), 3) or chars[0]["name"], "text": _words(d.get("text"), 16), "kind": k})
        present = [x for x in (sc.get("characters") or []) if str(x).lower() in names] or [chars[0]["name"]]
        shot = sc.get("shot") if sc.get("shot") in SHOTS else SHOTS[i % 4]
        scenes.append({"n": i + 1, "title": _words(sc.get("title"), 7) or f"Scene {i + 1}", "narration": _words(sc.get("narration"), 32),
                       "visual": _words(sc.get("visual"), 45) or "the characters in the story world", "shot": shot, "mood": _words(sc.get("mood"), 3),
                       "characters": present, "dialogue": dlg, "sfx": _words(sc.get("sfx"), 1).upper() or None})
    return {"title": _words(raw.get("title"), 8) or "Untitled", "logline": _words(raw.get("logline"), 30), "world": _words(raw.get("world"), 30),
            "characters": chars, "scenes": scenes}


def offline_outline(idea: str, n_scenes: int) -> dict:
    """Deterministic story skeleton from the idea (used only when no LLM is reachable)."""
    base = " ".join(idea.split()[:14])
    beats = [("A quiet beginning", "wide establishing shot", "Everything seemed ordinary, until the day it changed.", "hopeful"),
             ("The call", "medium shot", "Something unexpected appeared and refused to be ignored.", "curious"),
             ("Into the unknown", "over-the-shoulder shot", "There was no turning back now.", "tense"),
             ("The trouble", "low-angle shot", "Then the real challenge showed itself.", "dramatic"),
             ("The turning point", "close-up", "One brave idea changed everything.", "determined"),
             ("The ending", "wide establishing shot", "And so the story found its quiet, hopeful ending.", "warm")]
    scenes = []
    for i in range(n_scenes):
        t, shot, nar, mood = beats[min(i, len(beats) - 1)] if n_scenes <= len(beats) else beats[min(i * len(beats) // n_scenes, len(beats) - 1)]
        scenes.append({"title": t, "narration": nar, "visual": f"{base}, {t.lower()}", "shot": shot, "mood": mood, "characters": ["Hero"],
                       "dialogue": [{"speaker": "Hero", "text": ["I can do this.", "What is that?", "Stay close!", "We have to try!", "Now or never!", "We did it."][min(i, 5)], "kind": "speech"}],
                       "sfx": None})
    return normalise({"title": " ".join(idea.split()[:5]).title(), "logline": base, "world": f"the world of: {base}",
                      "characters": [{"name": "Hero", "role": "protagonist", "look": f"the main character of: {' '.join(idea.split()[:8])}"}],
                      "scenes": scenes}, n_scenes)


def generate_outline(api_key: str | None, model: str, idea: str, n_scenes: int = 6, genre: str = "adventure", art_style: str = "manga") -> dict:
    n_scenes = max(2, min(12, n_scenes))
    if api_key:
        try:
            r = httpx.post("https://api.groq.com/openai/v1/chat/completions", headers={"Authorization": f"Bearer {api_key}"},
                           json={"model": model, "temperature": 0.8, "response_format": {"type": "json_object"},
                                 "messages": [{"role": "system", "content": SYSTEM},
                                              {"role": "user", "content": f"Story idea: {idea}\nGenre: {genre}\nArt style: {art_style}\nWrite exactly {n_scenes} scenes."}]},
                           timeout=45.0)
            r.raise_for_status()
            out = normalise(_clean_json(r.json()["choices"][0]["message"]["content"]), n_scenes)
            if len(out["scenes"]) >= max(2, n_scenes - 1):
                out["source"] = f"llm:{model}"
                return out
            log.warning("LLM returned %d/%d scenes; using offline outline", len(out["scenes"]), n_scenes)
        except Exception as exc:  # noqa: BLE001 - any LLM/network/JSON failure must degrade, not break the studio
            log.warning("Story LLM failed (%s); using offline outline", type(exc).__name__)
    out = offline_outline(idea, n_scenes)
    out["source"] = "offline"
    return out


def scene_prompt(outline: dict, scene: dict, art_style: str = "", max_len: int = 420) -> str:
    """Image prompt for one panel: shot + action + the fixed character looks + world + mood (+ art style added by the style system)."""
    looks = {c["name"].lower(): c for c in outline["characters"]}
    who = "; ".join(f"{looks[n.lower()]['name']}: {looks[n.lower()]['look']}" for n in scene["characters"] if n.lower() in looks)
    parts = [scene["shot"], scene["visual"], who, outline.get("world", ""), scene.get("mood", "") and f"{scene['mood']} mood"]
    p = ", ".join(x for x in parts if x)
    return p if len(p) <= max_len else p[:max_len].rsplit(",", 1)[0]
