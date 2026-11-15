import json
import logging
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

log = logging.getLogger("imagineai.gallery")


class GalleryStore:
    def __init__(self, storage_path: Optional[Path] = None, owner_provider: Optional[Callable[[], Optional[Tuple[str, bool]]]] = None):
        # owner_provider() -> (owner_key, is_admin) for the signed-in user, or None. Every record belongs to exactly one owner.
        self._owner = owner_provider or (lambda: None)
        if storage_path is None:
            repo_root = Path(__file__).resolve().parents[3]
            storage_path = repo_root / "data_cache" / "gallery_records.json"
        self.path = Path(storage_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._ensure_file()

    def _ensure_file(self) -> None:
        if not self.path.exists():
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump([], f)

    def _read_all(self) -> List[Dict[str, Any]]:
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log.warning("Failed to read gallery file, initializing empty: %s", e)
            return []

    def _write_all(self, items: List[Dict[str, Any]]) -> None:
        temp_file = self.path.with_suffix(".tmp")
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
        temp_file.replace(self.path)

    def add_item(
        self,
        image_url: str,
        prompt: str,
        category: str = "single",  # "single" | "storybook" | "inpaint"
        style: str = "Photorealistic",
        model: str = "SD-Turbo",
        width: int = 512,
        height: int = 512,
        liked: bool = False,
        source_id: Optional[str] = None,
        recreation_note: Optional[str] = None,
        item_id: Optional[str] = None,
        timestamp: Optional[int] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            items = self._read_all()
            record_id = item_id or uuid.uuid4().hex
            record = {
                "id": record_id,
                "image_url": image_url,
                "prompt": prompt,
                "category": category,
                "style": style,
                "model": model,
                "width": width,
                "height": height,
                "liked": liked,
                "source_id": source_id,
                "recreation_note": recreation_note,
                "timestamp": timestamp or int(time.time() * 1000),
                "owner": (self._owner() or (None, False))[0],
            }
            # Prepend newest first
            items.insert(0, record)
            self._write_all(items)
            return record

    def _visible(self, item: Dict[str, Any]) -> bool:
        who = self._owner()
        if who is None:
            return False
        key, is_admin = who
        owner = item.get("owner")
        return owner == key or (owner is None and is_admin)  # records from before accounts existed belong to the administrator

    def list_items(
        self,
        category: Optional[str] = None,
        favorites_only: bool = False,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        with self._lock:
            items = self._read_all()
            filtered = []
            for item in items:
                if not self._visible(item):
                    continue
                if category and category.lower() != "all":
                    item_cat = (item.get("category") or "single").lower()
                    if item_cat != category.lower():
                        continue
                if favorites_only and not item.get("liked", False):
                    continue
                if search:
                    q = search.lower().strip()
                    prompt = item.get("prompt", "").lower()
                    style = item.get("style", "").lower()
                    note = (item.get("recreation_note") or "").lower()
                    if q not in prompt and q not in style and q not in note:
                        continue
                filtered.append(item)
            return filtered

    def get_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            items = self._read_all()
            for it in items:
                if it.get("id") == item_id and self._visible(it):
                    return it
            return None

    def update_item(self, item_id: str, **fields) -> Optional[Dict[str, Any]]:
        with self._lock:
            items = self._read_all()
            for it in items:
                if it.get("id") == item_id and self._visible(it):
                    for k, v in fields.items():
                        if k in ("liked", "recreation_note", "style", "category"):  # never let a client rewrite id/owner/url
                            it[k] = v
                    self._write_all(items)
                    return it
            return None

    def delete_item(self, item_id: str) -> bool:
        with self._lock:
            items = self._read_all()
            initial_len = len(items)
            items = [it for it in items if not (it.get("id") == item_id and self._visible(it))]
            if len(items) < initial_len:
                self._write_all(items)
                return True
            return False
