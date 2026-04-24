# VRIsSchema

This repository runs the `ice-time-tamer` codebase and deploys it with GitHub Pages on every push to `main`.

## Development

Install dependencies and start the local dev server:

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Firebase

The app reads schedule data from Firebase Firestore when these variables are configured:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

If Firebase is not configured, the app falls back to local demo schedule data.

## Deploy

GitHub Pages is published through:

- `.github/workflows/deploy.yml`

The Vite base path is configured for the `VRIsSchema` repository so the built site works under the GitHub Pages repo URL.
