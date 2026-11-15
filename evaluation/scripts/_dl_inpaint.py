from huggingface_hub import snapshot_download
p = snapshot_download("stable-diffusion-v1-5/stable-diffusion-inpainting",
    allow_patterns=["model_index.json","scheduler/*","tokenizer/*","text_encoder/*fp16*","text_encoder/config.json",
                    "unet/config.json","unet/*fp16.safetensors","vae/config.json","vae/*fp16.safetensors","feature_extractor/*"])
print(p)
