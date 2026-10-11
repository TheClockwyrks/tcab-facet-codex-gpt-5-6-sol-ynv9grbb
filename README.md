# Facet

Facet is a browser puzzle game about matching cut gems while pressure fractures the board around each clear. Match three, build chains, exploit flawed stones, and create brilliant, star, and prism cuts.

## Run

```sh
npm ci
npm run dev
```

Run `npm run build` for the self-contained production site in `dist/`, or `npm run preview` to serve it.

## Controls

Drag a gem onto an orthogonal neighbor and release to offer a swap. Menus use the pointer or Up/Down and Enter/Space. Escape or P pauses; Escape backs out; M toggles all sound. Mouse, pen, and touch are supported.

All shipped art, animation frames, particle definitions, music, and sounds live in `public/assets/`; the build only bundles those committed files.
