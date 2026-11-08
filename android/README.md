# Imagine AI Android client

The app sends image requests to the laptop backend's approved SD 1.5 Adaptive LoRA (`sd15_adapted`) at the reviewed weight 0.25 and 30 inference steps.

## Android emulator

The default backend URL is `http://10.0.2.2:8080/`. `10.0.2.2` is the Android emulator's address for services on the development computer. Keep the laptop backend running on port 8080, then launch the app in the emulator.

To override the URL at build time, pass a Gradle property:

```powershell
./gradlew.bat :app:assembleDebug -PIMAGINEAI_BASE_URL=http://10.0.2.2:8080/
```

The app also has a Server Configuration dialog for changing the URL without rebuilding.

## Physical Android phone

Set the server URL to `http://<laptop-LAN-IP>:8080/`. The laptop and phone must be on the same trusted Wi-Fi network. The backend must listen on the laptop's LAN interface and Windows Firewall must allow port 8080. The current local backend is bound to `127.0.0.1`, which is suitable for the emulator but intentionally not reachable from other devices. Do not expose this unauthenticated development server to an untrusted network.

The first generation can take longer while the backend loads the SD 1.5 pipeline and adapter. Later requests reuse the loaded model.
