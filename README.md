# Vector Rift

A browser-based, Tempest-inspired arcade game built with Vite, Canvas, and Web Audio.

## Features

- Classic radial lane shooting loop.
- Toggleable evolving arenas.
- Toggleable combo weapons and special meter.
- Synthesized sound effects for shots, hits, specials, breaches, wave changes, and game over.
- Deterministic engine tests.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Verification

```bash
npm test
npm run build
```

## Vercel Deployment

This repo is ready for Vercel as a static Vite app.

Recommended settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

The included `vercel.json` declares the build command and output directory.

## Controls

- `Left` / `A`: rotate left
- `Right` / `D`: rotate right
- `Space`: shoot
- `Shift`: use charged special
- `P`: pause
