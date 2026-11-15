import io, json, sys, time, urllib.request
from PIL import Image
B="http://localhost:8000"
def post(path, body):
    r=urllib.request.Request(B+path, json.dumps(body).encode(), {"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=900).read())
def img(url): return Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")
out=sys.argv[1]
jobs={"neon":("a rainy neon-lit cyberpunk city street at night, glowing signs, reflections on wet pavement, cinematic","Cyberpunk"),
      "dragon":("a majestic dragon perched on a mountain peak at sunrise, epic fantasy landscape, dramatic clouds","Fantasy Art"),
      "reef":("a vibrant coral reef with colourful tropical fish and sunbeams, underwater photograph, crystal clear water","Photorealistic"),
      "space":("an astronaut floating above a glowing nebula and a ringed planet, cinematic science fiction","Cinematic 3D"),
      "abstract":("abstract fluid art, swirling indigo, coral and gold paint, glossy, high detail, studio lighting","Photorealistic")}
tiles=[]
for name,(p,style) in jobs.items():
    for seed in (5,17):
        t=time.time()
        g=post("/api/v1/generate/multimodel",{"prompt":p,"model_choice":"sd15_baseline","style":style,"seed":seed,"steps":30,"width":768,"height":512,"resolution":768})
        im=img(g["image_url"]); im.save(f"{out}/{name}_{seed}.png"); tiles.append(im.resize((384,256)))
        print(name,seed,round(time.time()-t,1),flush=True)
W=Image.new("RGB",(384*4,256*3)); [W.paste(x,((i%4)*384,(i//4)*256)) for i,x in enumerate(tiles)]; W.save(out+"/contact2.png")
