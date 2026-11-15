# Run Imagine AI on any laptop (Docker)

Everything (the website, the AI engine and the image models) runs on your own computer. Nothing is installed except Docker.

## 1. Install Docker (once)
- **Windows / Mac:** install [Docker Desktop](https://www.docker.com/products/docker-desktop), open it, wait for "Engine running".
- **Linux:** install Docker Engine + the compose plugin.

Needs about **15 GB free disk** and **8 GB RAM** (16 GB is more comfortable).

## 2. Start it
- **Windows:** double-click `docker\start.bat`
- **Mac / Linux:** `./docker/start.sh`

The first run builds the image (about 10 minutes, needs internet). The browser then opens at **http://localhost:8000**.
Create an account on the first screen, then use the site.

The first picture you make downloads the AI model once (about 2.5 GB for the default model), so that first image is slow.
To download everything up front, run `prefetch-models.bat` (or `.sh`). Add `--minimal` for just the default model.
After that the site works without internet, except the AI assistant, lessons, translation and voice, which call Groq.

## 3. Optional settings
`start` creates `docker/.env` from `docker/.env.example`. Open it and set:

| Setting | What it does |
|---|---|
| `GROQ_API_KEY` | Turns on the assistant, **Learn**, **translate**, **tap to speak** and **ask about an image**. Free key at console.groq.com/keys. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Creates an administrator account on first start. |
| `PORT` | Use another port if 8000 is busy. |
| `ALLOW_SIGNUP` | `0` stops new people creating accounts. |

Without a Groq key the site still creates and edits images, styles, storybooks and the results pages.
After changing `.env`, run start again.

## Speed: what to expect
| Laptop | Default model (SD-Turbo, 1 step) | Balanced models (4 steps) |
|---|---|---|
| NVIDIA GPU (see below) | about 0.3 s | about 0.5 s |
| CPU only | roughly 10 to 40 s | roughly 1 to 3 minutes |

CPU laptops should keep the default model. It is also the best one in our benchmark.

### NVIDIA GPU
```
cd docker
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```
Docker Desktop with WSL2 and a recent NVIDIA driver is required.

## Moving it to another laptop without rebuilding
On the built machine run `export-image.bat` (or `.sh`). It writes `imagineai-image.tar`. Copy that file and the `docker` folder, then:
```
docker load -i imagineai-image.tar
cd docker
docker compose up -d
```

## Everyday commands
| Do this | Command |
|---|---|
| Stop | `stop.bat` / `./stop.sh` |
| See what is happening | `docker logs -f imagineai` |
| Delete your accounts, gallery and downloaded models | `docker compose down -v` |

Your accounts, gallery and downloaded models live in a Docker volume, so they survive restarts and updates.

## Troubleshooting
- **"Docker is not running":** open Docker Desktop and wait until it says the engine is running.
- **Port already in use:** set `PORT=8080` in `docker/.env`, then start again.
- **First image never finishes:** the model is still downloading. Watch `docker logs -f imagineai`.
- **Out of memory on CPU:** Docker Desktop, Settings, Resources, raise Memory to 8 GB or more.
- **Microphone:** browsers allow it on `http://localhost` only. Opening the site from another device needs HTTPS.

## Security notes
No key is baked into the image. `docker/.env` is gitignored. Every API route requires an account, and passwords are stored hashed.
If you expose the site beyond your own laptop, put it behind HTTPS and set `COOKIE_SECURE=1`, a strong `ADMIN_PASSWORD` and `ALLOW_SIGNUP=0`.
