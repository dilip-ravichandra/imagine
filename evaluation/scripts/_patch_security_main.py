import re

p = 'backend/app/main.py'
s = open(p, encoding='utf-8').read()


def rep(a, b, count=1):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, count)


# ---- imports
rep("from .config import Settings, load_settings",
    "from .auth_routes import AuthKit, current_user_var, register_auth\nfrom .config import Settings, load_settings\nfrom .security import (COOKIE_NAME, BodySizeLimitMiddleware, OriginCheckMiddleware, SecurityHeadersMiddleware)")
rep("from fastapi.responses import FileResponse, HTMLResponse, JSONResponse",
    "from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse")

# ---- auth + app construction + CORS + gallery
a = s.index("    def require_api_key(request: Request) -> None:")
b = s.index("    def _decode_image(data_str: str) -> Image.Image:")
s = s[:a] + '''    settings.data_dir.mkdir(parents=True, exist_ok=True)
    kit = AuthKit(settings)  # accounts, sessions, rate limits
    auth = [Depends(kit.require_user)]  # EVERY /api/v1 endpoint except /auth/* requires a signed-in user (or the API key)

    def heavy(bucket: str, limit: int, window: int = 60):
        """Signed-in + per-user rate limit, for endpoints that cost GPU time or paid API calls."""
        return [Depends(kit.limit(bucket, limit, window))]

    app = FastAPI(
        title="Imagine AI", version=API_VERSION, lifespan=lifespan,
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.enable_docs else None,  # no public map of the API in production
    )
    if settings.allowed_origins:  # cross-origin browser access only for explicitly listed origins; never "*" with credentials
        app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_credentials=True,
                           allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Content-Type", "X-API-Key"])
    app.add_middleware(OriginCheckMiddleware, allowed_origins=settings.allowed_origins)
    app.add_middleware(BodySizeLimitMiddleware)
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.cookie_secure)

    def _is_signed_in(request: Request) -> bool:
        if kit.users.user_for_token(request.cookies.get(COOKIE_NAME)):
            return True
        key = request.headers.get("x-api-key", "")
        return bool(settings.api_key and key and secrets.compare_digest(key.encode(), settings.api_key.encode()))

    @app.middleware("http")
    async def protect_files_and_pages(request: Request, call_next):
        """Generated images, evaluation images, downloads and the research dashboard are for signed-in users only."""
        path = request.url.path
        if path.startswith(("/images/", "/eval-images/", "/download/")) and not _is_signed_in(request):
            return JSONResponse(status_code=401, content={"error": {"code": "UNAUTHENTICATED", "message": "Please sign in to continue.", "retryable": False}})
        if path.startswith("/research-dashboard") and not _is_signed_in(request):
            return RedirectResponse("/auth", status_code=302)
        return await call_next(request)

    app.mount("/images", StaticFiles(directory=str(store.directory)), name="images")
    gallery_store = GalleryStore(
        storage_path=settings.data_dir / "gallery_records.json",
        owner_provider=lambda: ((u.email, u.is_admin) if (u := current_user_var.get()) else None),
    )

''' + s[b:]

# ---- safe image decoding (size + pixel limits, clear errors)
a = s.index("    def _decode_image(data_str: str) -> Image.Image:")
b = s.index("    repo_root = Path(__file__).resolve().parents[2]")
s = s[:a] + '''    MAX_B64_CHARS = 12 * 1024 * 1024  # ~9 MB of image data
    MAX_SIDE = 4096
    Image.MAX_IMAGE_PIXELS = MAX_SIDE * MAX_SIDE  # PIL raises DecompressionBombError beyond this

    def _decode_image(data_str: str) -> Image.Image:
        if not isinstance(data_str, str) or len(data_str) > MAX_B64_CHARS:
            raise ValueError("image is too large")
        if "," in data_str:
            data_str = data_str.split(",", 1)[1]
        raw = base64.b64decode(data_str, validate=False)
        im = Image.open(io.BytesIO(raw))
        if im.format not in ("PNG", "JPEG", "WEBP"):
            raise ValueError("unsupported image type")
        if im.width > MAX_SIDE or im.height > MAX_SIDE or im.width * im.height > MAX_SIDE * MAX_SIDE:
            raise ValueError("image dimensions are too large")
        im.load()
        return im

''' + s[b:]

# ---- dashboard page: no inline script injection (CSP), no API-key bootstrap script
a = s.index("            if hosted_variants:\n                html = html.replace(\"</head>\", \"<script>window.__IMAGINEAI_HOSTED__=true</script></head>\", 1)")
b = s.index("            return HTMLResponse(html)", a)
s = s[:a] + s[b:]

# ---- remove the unused legacy endpoint
m = re.search(r'    @app\.get\("/api/v1/models/sd15-comparison"[^\n]*\n(?:(?!    @app\.).*\n)*', s)
assert m, 'sd15-comparison route not found'
s = s[:m.start()] + s[m.end():]

# ---- per-endpoint rate limits (same dependency also enforces sign-in)
limits = {
    '/api/v1/generate"': ('gen', 20), '/api/v1/generate/img2img': ('gen', 20), '/api/v1/generate/inpaint': ('gen', 20),
    '/api/v1/generate/multimodel': ('gen', 20), '/api/v1/adaptive/stress-generate': ('gen', 20),
    '/api/v1/chat': ('chat', 30), '/api/v1/prompt/enhance': ('chat', 30), '/api/v1/review/pair': ('chat', 20),
}
for path, (bucket, n) in limits.items():
    pat = re.compile(r'(@app\.post\("' + re.escape(path.rstrip('"')) + r'"[^\n]*?)dependencies=auth\)')
    s, k = pat.subn(lambda m: m.group(1) + f'dependencies=heavy("{bucket}", {n}))', s)
    assert k >= 1, path

# ---- register auth + creative routes (creative gets the limiter) ; docs/health stay minimal
rep("    from .creative_routes import register as register_creative\n    register_creative(app, auth=auth, settings=settings, store=store, decode_image=_decode_image)",
    "    register_auth(app, kit)\n    from .creative_routes import register as register_creative\n    register_creative(app, auth=auth, heavy=heavy, settings=settings, store=store, decode_image=_decode_image)\n"
    "    from .features_routes import register as register_features\n    register_features(app, kit=kit, auth=auth, heavy=heavy, settings=settings, engine=engine, decode_image=_decode_image)")
open(p, 'w', encoding='utf-8').write(s)

# ---- creative routes: rate-limit the expensive POSTs
p = 'backend/app/creative_routes.py'
c = open(p, encoding='utf-8').read()
c = c.replace("def register(app, *, auth, settings, store, decode_image):", "def register(app, *, auth, heavy, settings, store, decode_image):")
for route, bucket, n in [('/api/v1/cv/select', 'cv', 60), ('/api/v1/cv/stylize', 'cv', 60), ('/api/v1/cv/adjust', 'cv', 60), ('/api/v1/cv/analyze', 'cv', 60),
                         ('/api/v1/cv/upscale', 'cv', 30), ('/api/v1/story/outline', 'story', 10), ('/api/v1/story/page', 'cv', 60), ('/api/v1/story/pdf', 'cv', 30)]:
    a = f'@app.post("{route}", dependencies=auth)'
    assert a in c, route
    c = c.replace(a, f'@app.post("{route}", dependencies=heavy("{bucket}", {n}))')
open(p, 'w', encoding='utf-8').write(c)
print('patched')
