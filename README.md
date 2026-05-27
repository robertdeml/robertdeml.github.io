# HikeNow

A web app for hiking adventures.

## Setup

```
npm ci
```

## Build

```
npm run build
```

Compiles TypeScript from `src/` to `dist/` and copies static assets from `web/` to `dist/`.

## Serve

```
npm start
```

Serves the `dist/` directory on a local server (port 3000) with an HTTPS proxy on port 3001. HTTPS is required for the Geolocation API (GPS) to work on mobile devices.

Open **https://localhost:3001** in your browser (self-signed cert — accept the warning).

## Watch

```
npm run watch
```

Rebuilds on file changes.


# TODOs

- ~add GPS tracking.~
- ~add location markers~
- ~able to remove location markers~
- ~able to adjust left/right/up/down markers~
- ~able to save footprints of where we were~
- ~able to space footprints to a reasonsable spacing~
- able to scale image to fit the screen
- able to zoom in and out and show paths
