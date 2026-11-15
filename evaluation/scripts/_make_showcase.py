import base64, io, json, sys, time, urllib.request
from PIL import Image
B="http://localhost:8000"
def post(path, body):
    r=urllib.request.Request(B+path, json.dumps(body).encode(), {"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=900).read())
def img(url): return Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")
out=sys.argv[1]
prompts={"cabin":"a cozy wooden cabin beside a calm mountain lake at golden sunset, warm light from the windows, pine trees, snow-capped peaks reflected in the water, ultra detailed",
         "coast":"a turquoise bay with a small white sailboat, rugged green cliffs, golden hour light, clear water, cinematic landscape photograph"}
tiles=[]
for name,p in prompts.items():
    for seed in (3,11,21,42):
        t=time.time()
        g=post("/api/v1/generate/multimodel",{"prompt":p,"model_choice":"sd15_baseline","style":"Photorealistic","seed":seed,"steps":30,"width":768,"height":512,"resolution":768})
        im=img(g["image_url"]); im.save(f"{out}/{name}_{seed}.png"); tiles.append(im.resize((384,256)))
        print(name,seed,round(time.time()-t,1),"s",flush=True)
W=Image.new("RGB",(384*4,256*2)); [W.paste(x,((i%4)*384,(i//4)*256)) for i,x in enumerate(tiles)]; W.save(out+"/contact.png")
