"""Click through every tab of a page in a real browser and report console errors, failed requests and blank panels.
usage: python _cdp_audit.py OUTDIR PATH [selector-for-tab-buttons]"""
import base64, json, os, subprocess, sys, tempfile, time, urllib.request
import websocket

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT, PATH = sys.argv[1], sys.argv[2]
TABSEL = sys.argv[3] if len(sys.argv) > 3 else "[data-tab]"
os.makedirs(OUT, exist_ok=True)
ud = tempfile.mkdtemp()
proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={ud}", "--remote-debugging-port=9335", "about:blank"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    try:
        tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9335/json").read()); break
    except Exception:
        time.sleep(0.5)
ws = websocket.create_connection([t for t in tabs if t["type"] == "page"][0]["webSocketDebuggerUrl"], timeout=120)
ws.settimeout(1.0)
_n = [0]; events = []


def drain():
    try:
        while True:
            m = json.loads(ws.recv())
            if "method" in m:
                events.append(m)
    except Exception:
        pass


def call(method, **params):
    _n[0] += 1
    ws.send(json.dumps({"id": _n[0], "method": method, "params": params}))
    t0 = time.time()
    while time.time() - t0 < 60:
        try:
            r = json.loads(ws.recv())
        except Exception:
            continue
        if r.get("id") == _n[0]:
            return r.get("result")
        if "method" in r:
            events.append(r)


def js(expr):
    r = call("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
    return (r or {}).get("result", {}).get("value")


call("Emulation.setDeviceMetricsOverride", width=1366, height=900, deviceScaleFactor=1, mobile=False)
for d in ("Page", "Runtime", "Network", "Log"):
    call(d + ".enable")
call("Page.navigate", url="http://localhost:8000" + PATH); time.sleep(5); drain()
names = js("[...document.querySelectorAll(%s)].map((b,i)=>(b.dataset.tab||b.innerText||('#'+i)).trim().slice(0,40))" % json.dumps(TABSEL)) or []
print("tabs found:", names)
report = []
for i, nm in enumerate(names):
    start = len(events)
    js("document.querySelectorAll(%s)[%d].click()" % (json.dumps(TABSEL), i)); time.sleep(3.5); drain()
    txt = js("(document.querySelector('.tab-content.active, .tab-pane.active, main')||document.body).innerText.length")
    errs = [e for e in events[start:] if (e["method"] == "Runtime.exceptionThrown") or
            (e["method"] == "Log.entryAdded" and e["params"]["entry"]["level"] == "error") or
            (e["method"] == "Network.responseReceived" and e["params"]["response"]["status"] >= 400)]
    desc = []
    for e in errs:
        if e["method"] == "Runtime.exceptionThrown":
            desc.append("EXC " + e["params"]["exceptionDetails"].get("exception", {}).get("description", "")[:140])
        elif e["method"] == "Log.entryAdded":
            desc.append("LOG " + e["params"]["entry"]["text"][:140] + " " + e["params"]["entry"].get("url", "")[-60:])
        else:
            desc.append(f"HTTP {e['params']['response']['status']} {e['params']['response']['url'][-70:]}")
    shot = call("Page.captureScreenshot", format="png")
    if shot:
        open(f"{OUT}/{i:02d}_{''.join(c if c.isalnum() else '_' for c in nm)}.png", "wb").write(base64.b64decode(shot["data"]))
    else:
        desc.append("SCREENSHOT TIMED OUT (page unresponsive?)")
    report.append((nm, txt, desc))
    print(f"[{i}] {nm!r}: text_len={txt} problems={len(desc)}")
    for d in desc[:4]:
        print("     ", d)
try:
    proc.terminate()
except Exception:
    pass
