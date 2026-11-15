import base64, io, json, sys, time, urllib.request
from PIL import Image
B="http://localhost:8000"; OUT=sys.argv[1]
def post(path, body, timeout=900):
    r=urllib.request.Request(B+path, json.dumps(body).encode(), {"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=timeout).read())
def img(url): return Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")
# ---- styles: one prompt, every style
styles=["Photorealistic"]
tiles=[]; t=time.time()
for s in styles:
    g=post("/api/v1/generate/multimodel",{"prompt":"a fox walking through a misty autumn forest","model_choice":"sd_turbo","style":s,"seed":7,"resolution":512,"steps":2})
    tiles.append(img(g["image_url"]).resize((256,256)))
print("10 styles", round(time.time()-t,1),"s")
G=Image.new("RGB",(256*5,512)); [G.paste(x,((i%5)*256,(i//5)*256)) for i,x in enumerate(tiles)]; G.save(OUT+"/e2e_styles.png")
# ---- storybook
t=time.time(); o=post("/api/v1/story/outline",{"idea":"A shy girl and her robot friend search a flooded city for the last working lighthouse","n_scenes":6,"genre":"adventure","art_style":"Anime & Manga"})
print("outline", o["source"], round(time.time()-t,1),"s", o["title"])
panels=[]
for sc in o["scenes"]:
    g=post("/api/v1/generate/multimodel",{"prompt":sc["image_prompt"],"model_choice":"sd_turbo","style":"Anime & Manga","seed":100+sc["n"],"resolution":512,"steps":2,"category":"storybook"})
    panels.append({"image_url":g["image_url"],"narration":sc["narration"],"dialogue":sc["dialogue"],"sfx":sc["sfx"]})
for mode in ("colour","bw"):
    pg=post("/api/v1/story/page",{"title":o["title"],"panels":panels,"mode":mode,"page_no":1}); img(pg["image_url"]).resize((620,877)).save(f"{OUT}/e2e_page_{mode}.png"); print("page",mode,pg["width"],pg["height"])
r=urllib.request.Request(B+"/api/v1/story/pdf",json.dumps({"image_urls":[pg["image_url"]],"title":o["title"]}).encode(),{"Content-Type":"application/json"})
pdf=urllib.request.urlopen(r).read(); print("pdf bytes",len(pdf), pdf[:5])
