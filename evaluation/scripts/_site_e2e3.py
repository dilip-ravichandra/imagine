import base64, io, json, urllib.request, urllib.error
from PIL import Image
B="http://localhost:8000"
def post(path, body):
    r=urllib.request.Request(B+path, json.dumps(body).encode(), {"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r, timeout=300) as f: return f.status, json.loads(f.read())
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, None
def b64(im): b=io.BytesIO(); im.save(b,"PNG"); return "data:image/png;base64,"+base64.b64encode(b.getvalue()).decode()
im=Image.open("generated_images/80d4540dee7c45d6ae122beb20df7a5a.png").convert("RGB").resize((384,384)); src=b64(im)
for name,path,body in [("stylize","/api/v1/cv/stylize",{"image_base64":src,"style":"Watercolor","strength":0.8}),
                       ("adjust","/api/v1/cv/adjust",{"image_base64":src,"brightness":10,"contrast":10,"auto":True}),
                       ("upscale","/api/v1/cv/upscale",{"image_base64":src,"scale":2})]:
    c,j=post(path,body); print(name,c,(j or {}).get("width"),(j or {}).get("height"))
blank=Image.new("L",(384,384),0)
print("empty selection  ->", *post("/api/v1/generate/inpaint",{"prompt":"a cat","image_base64":src,"mask_base64":b64(blank)})[:1])
print("corrupt image    ->", post("/api/v1/cv/adjust",{"image_base64":"data:image/png;base64,AAAA"})[0])
print("no rect/stroke   ->", post("/api/v1/cv/select",{"image_base64":src})[0])
print("out-of-range adj ->", post("/api/v1/cv/adjust",{"image_base64":src,"brightness":500})[0])
print("bad story image  ->", post("/api/v1/story/page",{"title":"x","panels":[{"image_url":"http://x/images/nothex.png"}]})[0])
print("styles list      ->", len(json.loads(urllib.request.urlopen(B+"/api/v1/styles").read())["styles"]), "styles")
