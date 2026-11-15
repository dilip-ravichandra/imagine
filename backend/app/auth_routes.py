"""Auth endpoints and the dependencies that protect every other endpoint."""
from __future__ import annotations

import secrets
from contextvars import ContextVar

from fastapi import Depends, Request, Response
from pydantic import BaseModel, Field

from .security import (COOKIE_NAME, EMAIL_RE, MAX_FAILS_PER_EMAIL, MAX_FAILS_PER_IP, RateLimiter, User, UserStore, validate_new_password)
from .services.errors import ServiceError

current_user_var: ContextVar[User | None] = ContextVar("current_user", default=None)


class SignupBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class LoginBody(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class ChangePasswordBody(BaseModel):
    current_password: str = Field(max_length=256)
    new_password: str = Field(max_length=256)


def _public(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role}


class AuthKit:
    def __init__(self, settings):
        self.settings = settings
        self.users = UserStore(settings.data_dir / "users.db", settings.session_days)
        self.limiter = RateLimiter()
        if settings.admin_email and settings.admin_password:
            self.users.ensure_admin(settings.admin_email.strip().lower(), settings.admin_password)

    # ---------------------------------------------------------------- helpers
    def client_ip(self, request: Request) -> str:
        if self.settings.trust_proxy:
            xff = request.headers.get("x-forwarded-for", "")
            if xff:
                return xff.split(",")[0].strip()[:64]
        return (request.client.host if request.client else "unknown")[:64]

    def _set_cookie(self, response: Response, token: str) -> None:
        response.set_cookie(COOKIE_NAME, token, max_age=self.settings.session_days * 86400, httponly=True, samesite="lax",
                            secure=self.settings.cookie_secure, path="/")

    # ---------------------------------------------------------------- dependencies
    async def require_user(self, request: Request) -> User:
        user = self.users.user_for_token(request.cookies.get(COOKIE_NAME))
        if user is None and self.settings.api_key:  # machine clients (the Android app) may use the shared key instead of a session
            supplied = request.headers.get("x-api-key", "")
            if supplied and secrets.compare_digest(supplied.encode(), self.settings.api_key.encode()):
                user = User(0, "api-client", "API client", "service")
        if user is None:
            raise ServiceError(401, "UNAUTHENTICATED", "Please sign in to continue.", False, "Sign in, then retry.")
        request.state.user = user
        current_user_var.set(user)
        return user

    def limit(self, bucket: str, limit: int, window: int = 60):
        """Dependency factory: per-user (or per-IP) sliding window. Use on expensive endpoints."""
        async def dep(request: Request, user: User = Depends(self.require_user)) -> None:
            wait = self.limiter.check(bucket, f"u{user.id}", limit, window)
            if wait:
                raise ServiceError(429, "RATE_LIMITED", "You are doing that too often.", True, f"Wait {wait} seconds and try again.")
        return dep


def register_auth(app, kit: AuthKit) -> None:
    settings = kit.settings

    async def admin_dep(user: User = Depends(kit.require_user)) -> User:
        if not user.is_admin:
            raise ServiceError(403, "FORBIDDEN", "This area is for administrators.", False, "Ask an administrator for access.")
        return user
    kit.require_admin = admin_dep  # type: ignore[assignment]

    def _ip_guard(request: Request, bucket: str, limit: int, window: int) -> None:
        wait = kit.limiter.check(bucket, kit.client_ip(request), limit, window)
        if wait:
            raise ServiceError(429, "RATE_LIMITED", "Too many attempts from your network.", True, f"Wait {wait} seconds and try again.")

    @app.post("/api/v1/auth/signup")
    async def signup(body: SignupBody, request: Request, response: Response):
        if not settings.allow_signup:
            raise ServiceError(403, "SIGNUP_DISABLED", "New accounts are disabled on this server.", False, "Ask an administrator for an account.")
        _ip_guard(request, "signup", 10, 3600)
        email = body.email.strip().lower()
        name = " ".join(body.name.split())[:60]
        if not EMAIL_RE.match(email):
            raise ServiceError(422, "INVALID_EMAIL", "Enter a valid email address.", False, "Check the address and retry.")
        problem = validate_new_password(body.password, email)
        if problem:
            raise ServiceError(422, "WEAK_PASSWORD", problem, False, "Choose a stronger password.")
        try:
            user = kit.users.create_user(email, name, body.password)
        except ValueError:
            raise ServiceError(409, "ACCOUNT_EXISTS", "An account with this email already exists.", False, "Sign in instead.")
        kit._set_cookie(response, kit.users.create_session(user))
        return {"user": _public(user)}

    @app.post("/api/v1/auth/login")
    async def login(body: LoginBody, request: Request, response: Response):
        email = body.email.strip().lower()[:254]
        ip = kit.client_ip(request)
        if kit.users.failures("email", email) >= MAX_FAILS_PER_EMAIL or kit.users.failures("ip", ip) >= MAX_FAILS_PER_IP:
            raise ServiceError(429, "TOO_MANY_ATTEMPTS", "Too many failed sign-ins. Try again in 15 minutes.", True, "Wait 15 minutes, or reset your password with an administrator.")
        user = kit.users.authenticate(email, body.password)
        if user is None:
            kit.users.record_failure("email", email)
            kit.users.record_failure("ip", ip)
            raise ServiceError(401, "INVALID_CREDENTIALS", "Incorrect email or password.", False, "Check your details and retry.")  # same message for unknown email
        kit.users.clear_failures("email", email)
        kit._set_cookie(response, kit.users.create_session(user))
        return {"user": _public(user)}

    @app.post("/api/v1/auth/logout")
    async def logout(request: Request, response: Response):
        kit.users.delete_session(request.cookies.get(COOKIE_NAME))
        response.delete_cookie(COOKIE_NAME, path="/")
        return {"status": "signed_out"}

    @app.get("/api/v1/auth/me")
    async def me(user: User = Depends(kit.require_user)):
        return {"user": _public(user)}

    @app.post("/api/v1/auth/change-password")
    async def change_password(body: ChangePasswordBody, request: Request, response: Response, user: User = Depends(kit.require_user)):
        if user.role == "service":
            raise ServiceError(403, "FORBIDDEN", "API clients have no password.", False, "Use a user account.")
        _ip_guard(request, "chpw", 10, 3600)
        if kit.users.authenticate(user.email, body.current_password) is None:
            raise ServiceError(401, "INVALID_CREDENTIALS", "Your current password is incorrect.", False, "Retry.")
        problem = validate_new_password(body.new_password, user.email)
        if problem:
            raise ServiceError(422, "WEAK_PASSWORD", problem, False, "Choose a stronger password.")
        from .security import hash_password
        with kit.users._db() as db:
            db.execute("UPDATE users SET pw=? WHERE id=?", (hash_password(body.new_password), user.id))
            db.execute("DELETE FROM sessions WHERE user_id=?", (user.id,))  # every other session is signed out
        kit._set_cookie(response, kit.users.create_session(user))
        return {"status": "password_changed"}
