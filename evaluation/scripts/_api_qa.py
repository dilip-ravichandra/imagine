"""Signed-in API smoke test of auth, chat, translate, ask-about-image, learn. Run with the site up on :8000."""
import base64, io, json, random, sys, urllib.request, urllib.error, http.cookiejar
from PIL import Image, ImageDraw
B = "http://localhost:8000"
cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def call(path, body=None, method=None):
    req = urllib.request.Request(B + path, None if body is None else json.dumps(body).encode(), {"Content-Type": "application/json"}, method=method)
    try:
        r = op.open(req, timeout=90); return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, {}
print("anon capabilities ->", call("/api/v1/capabilities")[0], "(want 401)")
em = f"qa{random.randint(1,10**6)}@example.com"; pw = "Tr0ub4dor&Graph9x"
print("weak signup ->", call("/api/v1/auth/signup", {"name": "Q", "email": em, "password": "abc"})[0], "(want 422)")
print("signup ->", call("/api/v1/auth/signup", {"name": "QA Tester", "email": em, "password": pw})[0])
print("me ->", call("/api/v1/auth/me"))
print("logout ->", call("/api/v1/auth/logout", {})[0], "| me after ->", call("/api/v1/auth/me")[0], "(want 401)")
print("bad login ->", call("/api/v1/auth/login", {"email": em, "password": "wrongpass"})[0], "(want 401)")
print("login ->", call("/api/v1/auth/login", {"email": em, "password": pw})[0])
print("chat ->", call("/api/v1/chat", {"messages": [{"role": "user", "content": "Hi, I am Sam."}, {"role": "assistant", "content": "Hello Sam!"}, {"role": "user", "content": "What is my name?"}]})[1].get("message", "")[:100])
for t in ("hi", "es", "ja"):
    print("translate", t, "->", call("/api/v1/translate", {"text": "Good morning, how are you?", "target": t})[1].get("translation"))
im = Image.new("RGB", (400, 300), (30, 120, 220)); d = ImageDraw.Draw(im); d.ellipse((150, 100, 250, 200), fill=(250, 220, 30)); b = io.BytesIO(); im.save(b, "PNG")
s, r = call("/api/v1/vision/ask", {"image_base64": base64.b64encode(b.getvalue()).decode(), "question": "What shape and colour is in the middle?"})
print("ask image ->", s, r.get("source"), "|", (r.get("answer") or "")[:140])
s, r = call("/api/v1/learn/explain", {"topic": "How photosynthesis works", "level": "Beginner"})
print("learn ->", s, json.dumps(r)[:300])
