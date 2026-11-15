"""Real-browser QA of auth, learn (diagram), voice (tap to speak + translate), ask-about-image, chat memory and settings.
usage: python _cdp_qa.py OUTDIR      (site must be running on :8000; needs %TEMP%/qa_audio/speech.wav as the fake microphone input)"""
import base64, json, os, random, subprocess, sys, tempfile, time, urllib.request
import websocket

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
SAMPLE = os.path.abspath("generated_images/80d4540dee7c45d6ae122beb20df7a5a.png")
WAV = os.path.join(os.environ["TEMP"], "qa_audio", "speech.wav")

ud = tempfile.mkdtemp()
proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={ud}", "--remote-debugging-port=9336",
                         "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + WAV,
                         "--autoplay-policy=no-user-gesture-required", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    try:
        tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9336/json").read()); break
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


def goto(path, wait_s=3.5):
    call("Page.navigate", url=os.environ.get("QA_BASE", "http://localhost:8000") + path)
    time.sleep(wait_s)


def click_text(t, tag="button"):
    return js("""(()=>{const t=%s;const b=[...document.querySelectorAll('%s')].find(x=>x.innerText&&x.innerText.trim().includes(t)&&!x.disabled);if(!b)return false;b.click();return true})()""" % (json.dumps(t), tag))


def set_value(selector, value):
    js("""(()=>{const el=document.querySelector(%s);if(!el)return;const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el,%s);el.dispatchEvent(new Event('input',{bubbles:true}));})()""" % (json.dumps(selector), json.dumps(value)))


def wait(cond_js, timeout=120, step=1.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if js(cond_js):
            return True
        time.sleep(step)
    return False


R = []


def check(name, ok, detail=""):
    R.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL "), name, "-", str(detail)[:230].replace("\n", " "), flush=True)


def path():
    return js("location.pathname")


def text():
    return js("document.body.innerText")


def brightness(sel):
    return js("""(()=>{const i=document.querySelector(%s);if(!i)return -1;const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.drawImage(i,0,0,64,64);
      const d=x.getImageData(0,0,64,64).data;let t=0,mn=255,mx=0;for(let k=0;k<d.length;k+=4){const v=(d[k]+d[k+1]+d[k+2])/3;t+=v;mn=Math.min(mn,v);mx=Math.max(mx,v)}return Math.round(t/4096)+'/'+Math.round(mx-mn)})()""" % json.dumps(sel))


def alert():
    return js("(document.querySelector('[role=alert]')||{}).innerText||''")


EM = f"ui{random.randint(1, 10**6)}@example.com"
PW = "Tr0ub4dor&Graph9x"
call("Emulation.setDeviceMetricsOverride", width=1366, height=900, deviceScaleFactor=1, mobile=False)
call("Page.enable"); call("DOM.enable")
try:
    # ---------------- auth
    goto("/dashboard"); check("anon /dashboard redirects to /auth", path() == "/auth", path()); shot("a1_auth")
    set_value("input[type=email]", "nobody@example.com"); set_value("input[type=password]", "wrongpassword1")
    js("document.querySelector('form').requestSubmit()"); time.sleep(2.5)
    check("bad login shows a visible error", "ncorrect" in alert(), alert()); shot("a2_badlogin")
    click_text("Sign Up") or click_text("Sign up"); time.sleep(0.6)
    set_value("input[placeholder='John Doe']", "UI Tester"); set_value("input[type=email]", EM); set_value("input[type=password]", "short")
    js("document.querySelector('form').requestSubmit()"); time.sleep(2)
    check("weak password rejected with a message", path() == "/auth" and "10 characters" in alert(), alert())
    set_value("input[type=password]", PW); js("document.querySelector('form').requestSubmit()"); time.sleep(3)
    check("signup lands on dashboard", path() == "/dashboard", path()); shot("a3_dashboard")
    goto("/dashboard"); check("session survives a reload", path() == "/dashboard", path())
    click_text("Sign out") or click_text("Sign out", "*"); time.sleep(2)
    check("sign out returns to /auth", path() == "/auth", path())
    goto("/create"); check("/create protected after sign out", path() == "/auth", path())
    set_value("input[type=email]", EM); set_value("input[type=password]", PW)
    js("document.querySelector('form').requestSubmit()"); time.sleep(3)
    check("login works", path() == "/dashboard", path())

    # ---------------- learn
    goto("/learn"); set_value("input[aria-label='Topic to learn']", "How does the water cycle work?")
    click_text("Teach me"); ok = wait("document.querySelectorAll('svg[role=img] text').length>5", 90); time.sleep(1); shot("b1_learn")
    nodes = js("document.querySelectorAll('svg[role=img] rect[rx=\"12\"]').length")
    labels = js("[...document.querySelectorAll('svg[role=img] text')].map(t=>t.textContent).filter(t=>t.length>3).slice(0,12).join(' | ')")
    check("learn: lesson + labelled diagram rendered", ok and nodes >= 3, f"{nodes} nodes: {labels}")
    check("learn: key points and quiz present", "Check yourself" in text() and "Key points" in text())

    click_text("Make an illustration")
    ok = wait("(()=>{const i=document.querySelector('img[alt^=\"Illustration\"]');return !!i&&i.complete&&i.naturalWidth>0})()", 150); time.sleep(1)
    js("document.querySelector('img[alt^=\"Illustration\"]')&&document.querySelector('img[alt^=\"Illustration\"]').scrollIntoView()"); time.sleep(0.5); shot("b2_learn_picture")
    br = brightness('img[alt^="Illustration"]'); check("learn: illustration is a real picture (not black)", ok and br != "-1" and int(br.split("/")[0]) > 25 and int(br.split("/")[1]) > 60, "mean/contrast " + str(br))

    # ---------------- create an image
    goto("/create"); set_value("textarea[aria-label='Describe your image']", "a red bicycle leaning on a brick wall, golden hour")
    click_text("Create image")
    ok = wait("!document.body.innerText.includes('Drawing your image') && !!document.querySelector('img[src*=\"/images/\"]')", 180); time.sleep(1.5); shot("g1_create")
    check("create: image generated for the prompt", ok and js("document.querySelector('img[src*=\"/images/\"]').naturalWidth")>0, alert())

    # ---------------- voice: translate text
    goto("/voice"); click_text("Translate text"); time.sleep(0.6)
    set_value("textarea[aria-label='Text to translate']", "Good morning, how are you?")
    js("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Translate').click()"); wait("document.body.innerText.includes('Listen')", 40); shot("c1_translate")
    out = js("(document.querySelector('[aria-live=polite]')||{}).innerText||''")
    check("translate: real translation (not mock/reversed)", out and "?uoy" not in out and "Good morning" not in out and "Your translation appears" not in out, out)

    # ---------------- voice: tap to speak
    click_text("Tap to speak"); time.sleep(0.6)
    ok_click = js("(()=>{const b=document.querySelector('button[aria-label=\"Tap to speak\"], [aria-label=\"Tap to speak\"][aria-pressed]');if(!b)return false;b.click();return true})()")
    time.sleep(1.5); listening = "Listening" in text(); shot("c2_listening")
    time.sleep(8)
    js("(document.querySelector('[aria-label=\"Stop recording\"]')||{click(){}}).click()")
    wait("!/Understanding|Translating|Listening/.test(document.body.innerText)", 60); time.sleep(1); shot("c3_voice_result")
    body = text(); i = body.find("You said")
    check("tap to speak: mic opens and shows Listening", ok_click and listening, f"clicked={ok_click}")
    check("tap to speak: heard the speech and translated it", "morning" in body.lower() or "water" in body.lower(), body[i:i + 330])
    if alert(): print("   alert:", alert())
    click_text("Read aloud"); time.sleep(0.4)
    check("read aloud tab opens", js("!!document.querySelector('textarea[aria-label=\"Text to read aloud\"]')"))

    # ---------------- ask about an image
    goto("/ask-image")
    doc = call("DOM.getDocument")["root"]["nodeId"]; nid = call("DOM.querySelector", nodeId=doc, selector="input[type=file]")["nodeId"]
    call("DOM.setFileInputFiles", files=[SAMPLE], nodeId=nid); time.sleep(2.5)
    check("ask image: uploaded image previews", js("!!document.querySelector('img[alt^=\"The picture\"]')"))
    set_value("input[aria-label='Your question']", "What is in this picture?"); click_text("Ask")
    ok = wait("!document.body.innerText.includes('Looking at the picture') && document.querySelectorAll('[aria-live=polite] > div').length>=2", 120); time.sleep(1); shot("d1_ask")
    ans = js("(document.querySelector('[aria-live=polite]')||{}).innerText||''")
    check("ask image: answer received", ok and len(ans) > 40, ans[:230])

    # ---------------- chat assistant
    goto("/dashboard")
    opened = js("(()=>{const el=[...document.querySelectorAll('div')].find(d=>{const s=getComputedStyle(d);const r=d.getBoundingClientRect();return s.position==='relative'&&s.cursor==='pointer'&&r.width>50&&r.width<70&&r.height>50&&r.height<70});if(!el)return false;el.click();return true})()")
    time.sleep(1); shot("e1_chat_open")
    sel = "input[placeholder*='Ask'], textarea[placeholder*='Ask'], input[placeholder*='essage'], textarea[placeholder*='essage'], input[placeholder*='ype']"
    inp = js("!!document.querySelector(%s)" % json.dumps(sel))
    check("chat launcher opens the panel", opened and inp, f"opened={opened} input={inp}")
    if inp:
        for q in ("My favourite colour is teal. Please remember it.", "What is my favourite colour?"):
            set_value(sel, q)
            js("(()=>{const e=document.querySelector(%s);e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));e.dispatchEvent(new KeyboardEvent('keypress',{key:'Enter',bubbles:true}))})()" % json.dumps(sel))
            time.sleep(1); click_text("Send")
            n = js("document.body.innerText.toLowerCase().split('just now').length")
            wait("!document.body.innerText.includes('Imagine Assistant') || (document.body.innerText.match(/\d\d:\d\d [ap]m/gi)||[]).length >= %d" % (2 if q.startswith('My') else 4), 60); time.sleep(1.5)
        shot("e2_chat"); t = text().lower(); tail = t.split("what is my favourite colour?")[-1]
        check("chat answers and remembers earlier message", "teal" in tail, tail[:200])

    # ---------------- settings
    goto("/profile"); shot("f1_settings"); check("settings shows the real account", EM in text())
    click_text("Preferences"); time.sleep(0.5)
    js("document.querySelector('input[aria-label=\"Larger text\"]').click()"); time.sleep(0.6)
    fs = js("document.documentElement.style.fontSize"); check("settings: larger text applies", fs.startswith("118"), fs); shot("f2_prefs")
    goto("/profile"); fs2 = js("document.documentElement.style.fontSize"); check("settings persist after reload", fs2.startswith("118"), fs2)
    click_text("Password"); time.sleep(0.5)
    set_value("input[autocomplete=current-password]", PW); set_value("input[autocomplete=new-password]", "Zebra!Quartz7Lantern")
    click_text("Update password"); time.sleep(3)
    check("settings: change password works", "Password changed" in text(), alert())
finally:
    try:
        shot("zz_final")
    except Exception:
        pass
    print("\nSUMMARY: %d/%d passed" % (sum(1 for r in R if r[1]), len(R)))
    try:
        ws.close()
    finally:
        proc.kill()
