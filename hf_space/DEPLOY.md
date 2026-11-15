# Publishing the Imagine AI ZeroGPU Space

## Switch the existing Space to Gradio

Your existing Space is Static. The staged `README.md` sets `sdk: gradio`, which
switches the repository to the Gradio SDK when pushed. Do not choose Docker.
In Space **Settings → Hardware**, select **ZeroGPU** if the account is eligible.
Set the Space license to `other`; the included project,
checkpoints, adapter, and evaluation artifacts do not share an Apache-2.0
license. Review the upstream licenses before publishing the Space publicly.

Free ZeroGPU hosting currently requires a verified Hugging Face account in
good standing that is at least 30 days old. The free account quota is limited
and requests may queue. See the current [ZeroGPU docs](https://huggingface.co/docs/hub/en/spaces-zerogpu).

## Configure private Space Secrets

In **Settings → Variables and secrets**, add:

- `HF_TOKEN`: a Hugging Face read token whose account has accepted access to
  `stable-diffusion-v1-5/stable-diffusion-v1-5`.
- `API_KEY`: optional, but recommended to limit calls through the Imagine AI
  and Android APIs. If set, the browser asks for this key and Android accepts
  it in Server Configuration.
- `GROQ_API_KEY` and `GEMINI_API_KEY`: optional; needed for prompt enhancement,
  chat, or image-pair review. Provider billing and usage limits are separate
  from ZeroGPU.

Never put tokens in repository files or commit them.

## Assemble and push

From the ImagineAI_Combined project root, build the clean Space repository:

```powershell
.\.venv\Scripts\python.exe hf_space\build_space.py
```

This stages the app under `hf_space\_build`, including the existing React
build, research dashboard, approved LoRA, only the required evaluation images,
and the rebuilt Android APK. It omits `.env`, training data, and review sheets.

The Space URL is `https://huggingface.co/spaces/DILIP-R/Imagine_AI`. To publish,
clone that Space, copy the contents of `hf_space\_build` into the clone, then
commit and push using a locally authenticated Hugging Face write token. Do not
send the token in chat.

## Client URLs

- Imagine AI React site: Space root `/`
- Research dashboard: `/research`
- ZeroGPU Gradio page: `/zero-gpu`
- Android APK: `/download/android.apk`
- Android API base URL: `https://<space-subdomain>.hf.space/`

