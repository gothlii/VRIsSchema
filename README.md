# VRIsSchema

This repository now runs the `ice-time-tamer` codebase and deploys it with GitHub Pages on every push to `main`.

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

## Deploy

GitHub Pages is published through:

- `.github/workflows/deploy.yml`

The Vite base path is configured for the `VRIsSchema` repository so the built site works under the GitHub Pages repo URL.
