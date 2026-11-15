"""Authentication and request-hardening primitives (stdlib only: sqlite3, hashlib.scrypt, secrets, hmac).

* Accounts   : email + password, scrypt-hashed with a per-user salt, constant-time verification, a dummy hash is checked for
               unknown emails so login time does not reveal whether an account exists.
* Sessions   : a random 256-bit token in an HttpOnly cookie; only its SHA-256 is stored server side, so a database leak does
               not yield usable sessions. Expiry is absolute (SESSION_DAYS) and logout deletes the row.
* Throttling : failed logins are counted per email and per IP in the database (shared by every worker on the same volume);
               5 failures lock the email for 15 minutes.
* Rate limit : sliding-window limiter per user/IP for expensive endpoints.
* Middleware : security headers + CSP, request-size cap, and an Origin check that blocks cross-site state-changing requests.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import sqlite3
import threading
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

COOKIE_NAME = "imagineai_session"
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,190}\.[A-Za-z]{2,24}$")
COMMON_PASSWORDS = {"password", "password1", "password123", "1234567890", "qwertyuiop", "iloveyou12", "letmein123", "admin12345", "welcome123"}
MAX_FAILS_PER_EMAIL, MAX_FAILS_PER_IP, LOCK_SECONDS = 5, 25, 15 * 60


@dataclass(frozen=True)
class User:
    id: int
    email: str
    name: str
    role: str  # "user" | "admin" | "service"

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


# --------------------------------------------------------------------------------------------- password hashing
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return "scrypt$14$8$1$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, ln, r, p, salt_b64, dk_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        dk = hashlib.scrypt(password.encode("utf-8"), salt=base64.b64decode(salt_b64), n=2 ** int(ln), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(dk, base64.b64decode(dk_b64))
    except Exception:  # noqa: BLE001 - malformed hash = not verified
        return False


_DUMMY_HASH = hash_password("dummy-password-for-timing-equalisation")


def validate_new_password(password: str, email: str) -> str | None:
    """Return an error message, or None when the password is acceptable."""
    if len(password) < 10:
        return "Use at least 10 characters."
    if len(password) > 128:
        return "Use at most 128 characters."
    if password.lower() in COMMON_PASSWORDS or password.lower() == email.lower() or password.isdigit() or len(set(password)) < 5:
        return "That password is too easy to guess. Mix words, numbers and symbols."
    return None


# --------------------------------------------------------------------------------------------- user + session store
class UserStore:
    def __init__(self, path: Path, session_days: int = 7):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.session_seconds = session_days * 86400
        self._lock = threading.Lock()
        with self._db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
                    pw TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created INTEGER NOT NULL,
                    expires INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
                CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY, kind TEXT NOT NULL, key TEXT NOT NULL, ts INTEGER NOT NULL);
                CREATE INDEX IF NOT EXISTS attempts_k ON attempts(kind, key, ts);
            """)

    @contextmanager
    def _db(self):
        con = sqlite3.connect(self.path, timeout=10)
        con.execute("PRAGMA foreign_keys=ON")
        con.execute("PRAGMA journal_mode=WAL")
        try:
            yield con
            con.commit()
        finally:
            con.close()

    # ---- accounts
    def create_user(self, email: str, name: str, password: str, role: str = "user") -> User:
        with self._lock, self._db() as db:
            try:
                cur = db.execute("INSERT INTO users(email,name,pw,role,created) VALUES(?,?,?,?,?)", (email, name, hash_password(password), role, int(time.time())))
            except sqlite3.IntegrityError as exc:
                raise ValueError("exists") from exc
            return User(cur.lastrowid, email, name, role)

    def ensure_admin(self, email: str, password: str) -> None:
        with self._db() as db:
            row = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
        if row is None:
            self.create_user(email, "Administrator", password, role="admin")

    def authenticate(self, email: str, password: str) -> User | None:
        with self._db() as db:
            row = db.execute("SELECT id,email,name,pw,role FROM users WHERE email=?", (email,)).fetchone()
        ok = verify_password(password, row[3] if row else _DUMMY_HASH)  # always hash: equal timing for unknown emails
        return User(row[0], row[1], row[2], row[4]) if (row and ok) else None

    def user_count(self) -> int:
        with self._db() as db:
            return db.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    # ---- sessions
    def create_session(self, user: User) -> str:
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        with self._db() as db:
            db.execute("DELETE FROM sessions WHERE expires < ?", (now,))
            db.execute("INSERT INTO sessions(token_hash,user_id,created,expires) VALUES(?,?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), user.id, now, now + self.session_seconds))
        return token

    def user_for_token(self, token: str | None) -> User | None:
        if not token or len(token) > 200:
            return None
        with self._db() as db:
            row = db.execute("SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?",
                             (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
        return User(*row) if row else None

    def delete_session(self, token: str | None) -> None:
        if token:
            with self._db() as db:
                db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))

    # ---- brute-force protection
    def record_failure(self, kind: str, key: str) -> None:
        with self._db() as db:
            db.execute("INSERT INTO attempts(kind,key,ts) VALUES(?,?,?)", (kind, hashlib.sha256(key.encode()).hexdigest(), int(time.time())))

    def clear_failures(self, kind: str, key: str) -> None:
        with self._db() as db:
            db.execute("DELETE FROM attempts WHERE kind=? AND key=?", (kind, hashlib.sha256(key.encode()).hexdigest()))

    def failures(self, kind: str, key: str, window: int = LOCK_SECONDS) -> int:
        with self._db() as db:
            db.execute("DELETE FROM attempts WHERE ts < ?", (int(time.time()) - 86400,))
            return db.execute("SELECT COUNT(*) FROM attempts WHERE kind=? AND key=? AND ts>?", (kind, hashlib.sha256(key.encode()).hexdigest(), int(time.time()) - window)).fetchone()[0]


# --------------------------------------------------------------------------------------------- rate limiting
class RateLimiter:
    """Sliding-window limiter. In-memory per process; behind a load balancer each replica enforces its own window."""

    def __init__(self):
        self._hits: dict[tuple[str, str], deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, bucket: str, key: str, limit: int, window: int) -> int:
        """Return 0 if allowed, else the seconds until the next request is allowed."""
        now = time.monotonic()
        with self._lock:
            q = self._hits[(bucket, key)]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                return max(1, int(window - (now - q[0])) + 1)
            q.append(now)
            if len(self._hits) > 50000:  # bound memory under key-spraying
                self._hits.clear()
            return 0


# --------------------------------------------------------------------------------------------- ASGI middleware
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "microphone=(self), camera=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; "
       "frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'")


class SecurityHeadersMiddleware:
    def __init__(self, app, hsts: bool = False):
        self.app, self.hsts = app, hsts

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_wrapped(message):
            if message["type"] == "http.response.start":
                headers = message.setdefault("headers", [])
                for k, v in {**SECURITY_HEADERS, "Content-Security-Policy": CSP}.items():
                    headers.append((k.lower().encode(), v.encode()))
                if self.hsts:
                    headers.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                path = scope.get("path", "")
                if path.startswith("/api/") or path.startswith("/images/") or path.startswith("/eval-images/"):
                    headers.append((b"cache-control", b"private, no-store" if path.startswith("/api/") else b"private, max-age=3600"))
            await send(message)

        await self.app(scope, receive, send_wrapped)


class BodySizeLimitMiddleware:
    """Reject oversized request bodies before they are read into memory (base64 images are the largest legitimate payload)."""

    def __init__(self, app, max_bytes: int = 14 * 1024 * 1024):
        self.app, self.max = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] in ("GET", "HEAD", "OPTIONS"):
            return await self.app(scope, receive, send)
        for k, v in scope["headers"]:
            if k == b"content-length":
                try:
                    if int(v) > self.max:
                        return await _reply(send, 413, b'{"error":{"code":"PAYLOAD_TOO_LARGE","message":"The request is too large.","retryable":false}}')
                except ValueError:
                    return await _reply(send, 400, b'{"error":{"code":"BAD_REQUEST","message":"Bad content length.","retryable":false}}')
        seen = 0

        async def limited():
            nonlocal seen
            msg = await receive()
            if msg["type"] == "http.request":
                seen += len(msg.get("body", b""))
                if seen > self.max:
                    raise _TooLarge()
            return msg

        try:
            await self.app(scope, limited, send)
        except _TooLarge:
            await _reply(send, 413, b'{"error":{"code":"PAYLOAD_TOO_LARGE","message":"The request is too large.","retryable":false}}')


class _TooLarge(Exception):
    pass


async def _reply(send, status: int, body: bytes):
    await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


class OriginCheckMiddleware:
    """Cross-site request forgery defence in depth: a state-changing request carrying an Origin that is not this site (or an
    explicitly allowed origin) is refused. Cookies are also SameSite=Lax, so cross-site POSTs do not carry the session."""

    def __init__(self, app, allowed_origins: tuple[str, ...] = ()):
        self.app, self.allowed = app, {o.rstrip("/").lower() for o in allowed_origins}

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["method"] in ("POST", "PUT", "PATCH", "DELETE"):
            headers = {k: v.decode("latin-1") for k, v in scope["headers"]}
            origin = headers.get("origin")
            if origin and origin != "null":
                host = headers.get("x-forwarded-host") or headers.get("host", "")
                o = urlparse(origin)
                if origin.rstrip("/").lower() not in self.allowed and o.netloc.lower() != host.lower():
                    return await _reply(send, 403, b'{"error":{"code":"FORBIDDEN_ORIGIN","message":"Cross-site request refused.","retryable":false}}')
            elif origin == "null":
                return await _reply(send, 403, b'{"error":{"code":"FORBIDDEN_ORIGIN","message":"Cross-site request refused.","retryable":false}}')
        await self.app(scope, receive, send)
