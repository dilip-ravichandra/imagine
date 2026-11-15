"""Drive the real React UI in a browser (Chrome DevTools Protocol) and check the three headline flows work end to end.
usage: python _cdp_flow.py OUTDIR [create] [edit] [story]      (site must be running on :8000)"""
import base64, json, os, subprocess, sys, tempfile, time, urllib.request
import websocket

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT = sys.argv[1]; WHICH = sys.argv[2:] or ["create", "edit", "story"]
os.makedirs(OUT, exist_ok=True)
SAMPLE = os.path.abspath("generated_images/80d4540dee7c45d6ae122beb20df7a5a.png")

ud = tempfile.mkdtemp()
proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={ud}", "--remote-debugging-port=9334", "about:blank"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    try:
        tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9334/json").read()); break
    except Exception:
        time.sleep(0.5)
ws = websocket.create_connection([t for t in tabs if t["type"] == "page"][0]["webSocketDebuggerUrl"], timeout=300)
_n = [0]


def call(method, **params):
    _n[0] += 1
    ws.send(json.dumps({"id": _n[0], "method": method, "params": params}))
    while True:
        r = json.loads(ws.recv())
        if r.get("id") == _n[0]:
            if "error" in r:
                raise RuntimeError(r["error"])
            return r.get("result")


def js(expr):
    r = call("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
    return r["result"].get("value")


def shot(name):
    open(f"{OUT}/{name}.png", "wb").write(base64.b64decode(call("Page.captureScreenshot", format="png")["data"]))


def goto(path):
    call("Page.navigate", url="http://localhost:8000" + path)
    time.sleep(4)


def click_text(text, tag="button"):
    return js("""(()=>{const t=%s;const b=[...document.querySelectorAll('%s')].find(x=>x.innerText&&x.innerText.trim().includes(t)&&!x.disabled);if(!b)return false;b.click();return true})()""" % (json.dumps(text), tag))


def set_value(selector, value):
    js("""(()=>{const el=document.querySelector(%s);const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el,%s);el.dispatchEvent(new Event('input',{bubbles:true}));})()""" % (json.dumps(selector), json.dumps(value)))


def wait(cond_js, timeout=180, step=1.5):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if js(cond_js):
            return True
        time.sleep(step)
    return False


call("Emulation.setDeviceMetricsOverride", width=1366, height=900, deviceScaleFactor=1, mobile=False)
call("Page.enable"); call("DOM.enable")
results = {}
try:
    if "create" in WHICH:
        goto("/create")
        before = js("document.querySelector('img[alt]:not([alt=\"\"])') ? [...document.querySelectorAll('main img, img')].map(i=>i.src).join('|') : ''")
        set_value("textarea[aria-label='Describe your image']", "a red bicycle leaning on a brick wall, golden hour")
        click_text("Watercolor")
        ok_click = click_text("Create image")
        time.sleep(2); shot("create_1_generating")
        ok = wait("!document.body.innerText.includes('Drawing your image') && document.body.innerText.includes('Your image')", 180)
        time.sleep(1.5); shot("create_2_done")
        err = js("(document.querySelector('[role=alert]')||{}).innerText||''")
        after = js("[...document.querySelectorAll('img')].map(i=>i.src).join('|')")
        results["create"] = dict(clicked=ok_click, finished=ok, error=err, image_changed=before != after)
        # about this image (real CV measurements)
        click_text("About this image"); time.sleep(4); shot("create_3_details")
        results["create"]["details_show_measurements"] = js("document.body.innerText.includes('Main colours')")

    if "edit" in WHICH:
        goto("/edit")
        root = call("DOM.getDocument")["root"]["nodeId"]
        node = call("DOM.querySelector", nodeId=root, selector="[data-testid='editor-file-input']")["nodeId"]
        call("DOM.setFileInputFiles", files=[SAMPLE], nodeId=node)
        ok = wait("!!document.querySelector('canvas')", 30)
        time.sleep(1.5); shot("edit_1_loaded")
        # paint a selection with the mouse on the canvas (brush is the default tool)
        rect = js("(()=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
        cx, cy = rect[0] + rect[2] * 0.55, rect[1] + rect[3] * 0.55
        call("Input.dispatchMouseEvent", type="mousePressed", x=cx, y=cy, button="left", clickCount=1)
        for i in range(25):
            call("Input.dispatchMouseEvent", type="mouseMoved", x=cx + (i % 5) * 12 - 24, y=cy + (i // 5) * 12 - 24, button="left", buttons=1)
        call("Input.dispatchMouseEvent", type="mouseReleased", x=cx, y=cy, button="left", clickCount=1)
        time.sleep(1); shot("edit_2_selected")
        set_value("input[aria-label='What should appear in the selection']", "a small blue flower pot")
        sel_ready = js("document.body.innerText.includes('Selection ready')")
        applied = click_text("Apply to selection")
        done = wait("document.body.innerText.includes('Version 2 of')", 240)
        time.sleep(1.5); shot("edit_3_result")
        results["edit"] = dict(canvas_loaded=ok, selection_ready=sel_ready, applied=applied, new_version_created=done,
                               error=js("(document.querySelector('[role=alert]')||{}).innerText||''"))

    if "story" in WHICH:
        goto("/storybook")
        click_text("Surprise me"); time.sleep(0.5)
        click_text("4 scenes")
        started = click_text("Create my storybook")
        time.sleep(3); shot("story_1_progress")
        done = wait("!!document.querySelector('img[alt^=\"Page 1\"]')", 420)
        time.sleep(3); shot("story_2_page")
        results["story"] = dict(started=started, page_shown=done, error=js("(document.querySelector('[role=alert]')||{}).innerText||''"))
        click_text("Black and white manga"); time.sleep(8); shot("story_3_bw")
finally:
    print(json.dumps(results, indent=1))
    proc.terminate()
