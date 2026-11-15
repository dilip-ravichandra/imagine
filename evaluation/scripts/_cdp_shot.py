"""Screenshot pages at a real device size via the Chrome DevTools Protocol.
usage: python _cdp_shot.py OUTDIR WIDTH HEIGHT route [route ...]"""
import base64, json, subprocess, sys, tempfile, time, urllib.request
import websocket
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
out, W, H, routes = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
ud = tempfile.mkdtemp()
p = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={ud}", "--remote-debugging-port=9333", "about:blank"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()); break
        except Exception: time.sleep(0.5)
    ws = websocket.create_connection([t for t in tabs if t["type"] == "page"][0]["webSocketDebuggerUrl"], timeout=60)
    n = [0]
    def call(m, **kw):
        n[0] += 1; ws.send(json.dumps({"id": n[0], "method": m, "params": kw}))
        while True:
            r = json.loads(ws.recv())
            if r.get("id") == n[0]: return r.get("result")
    call("Emulation.setDeviceMetricsOverride", width=W, height=H, deviceScaleFactor=1, mobile=W < 600)
    call("Page.enable")
    import os; os.makedirs(out, exist_ok=True)
    for r in routes:
        call("Page.navigate", url="http://localhost:8000" + r); time.sleep(6)
        # report horizontal overflow, then screenshot
        ov = call("Runtime.evaluate", expression="document.documentElement.scrollWidth + ' vs ' + window.innerWidth", returnByValue=True)
        print(r, "scrollWidth vs viewport:", ov["result"]["value"])
        img = call("Page.captureScreenshot", format="png")["data"]
        open(f"{out}/" + (__import__('re').sub(r'[^A-Za-z0-9]+','_',r.strip('/')) or 'home') + ".png", "wb").write(base64.b64decode(img))
finally:
    p.terminate()
