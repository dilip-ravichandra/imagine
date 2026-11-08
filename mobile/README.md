# ImagineAI Mobile App

This folder contains an **Expo React‑Native** version of the ImagineAI web UI. It mirrors the visual style, model selector, image generation, storybook, and gallery features.

## Prerequisites
- Node.js (>=18)
- Expo CLI (`npm i -g expo-cli`)
- Android emulator **or** iOS simulator / physical device with Expo Go installed.
- The backend FastAPI server must be running on port **8080** (the same as the web app). The mobile app will automatically target `http://10.0.2.2:8080` on Android emulators and `http://localhost:8080` on iOS simulators.

## Getting started
```bash
cd C:\Users\dilip\OneDrive\Documents\CV\ImagineAI_Combined\mobile
npm install            # installs expo and all dependencies
npx expo start         # opens Metro bundler UI
```
- Scan the QR code with **Expo Go** on your phone, or press **a** to launch an Android emulator, **i** for iOS.
- The app will load the landing screen, and you can navigate to **Image Generator**, **Storybook Studio**, and **Gallery** via the drawer menu.

## Main screens
| Screen | What it does |
|--------|--------------|
| **Landing** | Intro screen with a "Start Generating" button. |
| **Image Generator** (`CreateStudioScreen`) | Prompt input, model selector, generates an image, caches it locally and stores a reference in the Gallery. |
| **Storybook Studio** (`StorybookScreen`) | Provide a story description and number of scenes; generates multiple images and saves them to the Gallery under the *Storybook* category. |
| **Gallery** (`GalleryScreen`) | Shows all locally cached images (both generator and storybook), with delete capability. |

## Extending / customizing
- **Add more models**: edit `app/src/config/models.ts` – the UI picker reads from this list.
- **Add new pages**: create a new file under `app/src/screens/`, add it to `RootNavigator.tsx`.
- **Voice / Translation**: use the helper functions in `app/src/api/client.ts` (`transcribeAudio`, etc.) and UI components from `expo-av`.

## Build for production
```bash
# Android APK
eas build -p android --profile production
# iOS IPA (requires Apple developer account)
eas build -p ios --profile production
```
The resulting artifacts will be uploaded to the Expo dashboard.

---
*All UI follows the dark‑theme palette defined in `theme.ts` (`#080B0A` background, `#B7FF35` accent).*
