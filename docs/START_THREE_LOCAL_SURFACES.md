# Start the three Imagine AI local surfaces

Run each surface in a **separate PowerShell terminal** from the repository root:

```powershell
Set-Location C:\Users\dilip\OneDrive\Documents\CV\ImagineAI_Combined
```

All three use the same FastAPI backend on port `8080`; image generation runs on the laptop GPU. Start the backend first, then start either client.

## 1. Research dashboard — port 8080

In Terminal 1:

```powershell
Set-Location C:\Users\dilip\OneDrive\Documents\CV\ImagineAI_Combined
$env:CV_MODE = 'correct'
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8080
```

Open the research dashboard at:

- `http://localhost:8080/research`
- API health check: `http://localhost:8080/health`

Keep this terminal open. Press **Ctrl+C** to stop the backend. `CV_MODE=correct` enables the CV stage on the single-model `/api/v1/generate` route.

## 2. Imagine AI React website — port 5134

In Terminal 2:

```powershell
Set-Location C:\Users\dilip\OneDrive\Documents\CV\ImagineAI_Combined\frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5134 --strictPort
```

Open `http://localhost:5134`. Vite proxies `/api` requests to `http://localhost:8080`, so Terminal 1 must still be running. `npm install` is needed only the first time or after dependencies change.

## 3. Android mobile app — laptop GPU backend

Start an Android emulator and make sure `adb` can see it. In Terminal 3:

```powershell
Set-Location C:\Users\dilip\OneDrive\Documents\CV\ImagineAI_Combined\android
.\gradlew.bat :app:installDebug -PIMAGINEAI_BASE_URL=http://10.0.2.2:8080/
adb shell monkey -p com.imagineai.app 1
```

`10.0.2.2` is the Android emulator's address for the laptop's localhost. The Android app sends generation requests to the backend on port 8080 and receives the generated image. For physical-device development, configure the app with the laptop's LAN IP and run Uvicorn bound to `0.0.0.0` on a trusted network.

### Expo mobile client (alternate app)

The repository also has an Expo React Native client under `mobile/`. To start it instead of the native Android client:

```powershell
Set-Location C:\Users\dilip\OneDrive\Documents\CV\ImagineAI_Combined\mobile
npm install
npm run start
```

Press **a** to open it in the Android emulator, or scan the displayed QR code with Expo Go on a physical phone. Keep the backend running on port 8080.

## Port and connection notes

- `8080` is the shared API and research-dashboard backend.
- `5134` is the React/Vite website and proxies API traffic to `8080`.
- The native Android app uses the emulator URL `http://10.0.2.2:8080/` by default.
- If a port is already occupied, stop the server from the terminal where it was started with **Ctrl+C**, then rerun its command.
- Do not put `.env` contents or API keys into these commands or share them in screenshots.

## Optional: open the React site from the backend

To serve the built React site from the backend instead of using Vite, build it first:

```powershell
Set-Location C:\Users\dilip\OneDrive\Documents\CV\ImagineAI_Combined\frontend
npm install
npm run build
```

Then start the backend with the hosted-variants switch in a separate terminal:

```powershell
Set-Location C:\Users\dilip\OneDrive\Documents\CV\ImagineAI_Combined
$env:IMAGINEAI_HOSTED_VARIANTS = 'true'
$env:CV_MODE = 'correct'
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8080
```

With that switch, the React website is at `http://localhost:8080/` and the research dashboard remains at `http://localhost:8080/research`.
