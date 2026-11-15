import base64, io, json, sys, time, urllib.request
from PIL import Image
B="http://localhost:8000"; OUT=sys.argv[1]
def post(path, body, timeout=600):
    r=urllib.request.Request(B+path, json.dumps(body).encode(), {"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=timeout).read())
def img(url): return Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")
def b64(im): b=io.BytesIO(); im.save(b,"PNG"); return "data:image/png;base64,"+base64.b64encode(b.getvalue()).decode()
t=time.time(); g=post("/api/v1/generate/multimodel",{"prompt":"a golden retriever sitting on a wooden park bench, green trees behind","model_choice":"sd15_optimized","style":"Photorealistic","seed":11,"resolution":512})
base=img(g["image_url"]); print("generate", g["steps"], "steps", round(time.time()-t,1),"s"); base.save(OUT+"/e2e_base.png")
# smart-select the dog with a rough box (GrabCut)
W,H=base.size; sel=post("/api/v1/cv/select",{"image_base64":b64(base),"rect":[int(.22*W),int(.25*H),int(.5*W),int(.6*H)]})
print("select area frac", sel["area_fraction"], "bbox", sel["bbox"]); mask=img(sel["mask_base64"]); mask.save(OUT+"/e2e_mask.png")
t=time.time(); ip=post("/api/v1/generate/inpaint",{"prompt":"a small black and white cat sitting","image_base64":b64(base),"mask_base64":b64(mask),"seed":5,"steps":24})
edit=img(ip["image_url"]); print("inpaint", ip["model"], ip["steps"],"steps", ip["latency_ms"],"ms", round(time.time()-t,1),"s total"); edit.save(OUT+"/e2e_edit.png")
import numpy as np
a,b_=np.array(base),np.array(edit); m=np.array(mask.convert("L"))>127
from scipy.ndimage import binary_dilation
far=~binary_dilation(m,iterations=40); print("pixels far from the selection unchanged:", bool((a[far]==b_[far]).all()), "changed inside:", float(np.abs(a[m].astype(int)-b_[m].astype(int)).mean().round(1)))
W3=Image.new("RGB",(W*3,H)); [W3.paste(x,(i*W,0)) for i,x in enumerate([base,mask.convert("RGB"),edit])]; W3.save(OUT+"/e2e_inpaint.png")
