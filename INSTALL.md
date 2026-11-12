# Installing Three.js Inspector in Your Browser

Three.js Inspector is an unpacked (developer-mode) Chrome DevTools extension.
This guide covers building it and loading it into any Chromium-based browser:
Chrome, Chromium, Edge, Brave, Arc, Opera, Vivaldi, etc.

## Prerequisites

| Requirement | Version |
| --- | --- |
| Node.js | `^20.19.0` or `>= 22.12.0` (check with `node --version`) |
| npm | bundled with Node.js |
| Browser | any Chromium-based browser (Chrome, Edge, Brave, ...) |

Firefox is **not** supported — the extension uses Manifest V3 service workers
and `chrome.devtools` APIs.

## Step 1 — Build the extension

```bash
git clone https://github.com/Akamovsky/Threejs-Inspector.git
cd threejs-inspector
npm install
npm run build
```

The ready-to-load extension is written to `dist/`:

```
dist/
├── manifest.json      # MV3 manifest
├── background.js      # Service worker
├── content.js         # Content script bridge
├── hook.js            # Main-world Three.js hook
├── devtools.html      # DevTools entry
├── panel.html         # The inspector panel (Vue 3)
├── popup.html         # Toolbar popup
├── assets/            # Compiled JS/CSS
└── icons/             # Extension icons
```

## Step 2 — Load it into the browser

1. Open the extensions page: navigate to `chrome://extensions/`
   (`edge://extensions/` in Edge, `brave://extensions/` in Brave).
2. Enable **Developer mode** using the toggle (top-right corner).
3. Click **Load unpacked**.
4. Select the `dist/` folder of this project (the folder itself, not a zip).
5. The **Three.js Inspector** card appears with a "3D" badge system — the
   toolbar icon shows a green `3D` badge on tabs where Three.js is detected.

> Tip: pin the toolbar icon to see the detection badge at a glance.

## Step 3 — Use it

1. Open any website that renders with Three.js.
2. Press `F12` to open DevTools and select the **Three.js** tab in the top bar.
3. The panel auto-detects scenes, renderers, cameras, lights, materials,
   textures, geometries, and animation mixers.

What you can do from the panel:

- **Scene Hierarchy / Categories** — browse, search, hover-highlight, click to select
- **Properties** — edit transforms (or drag the 3D gizmo: W/E/R), visibility,
  shadows, material colors/roughness/metalness/opacity, light color & intensity
- **Debug Camera** — free orbit camera (left-click orbit, scroll zoom,
  right-click pan) with a built-in flashlight; `F` focuses the selected object,
  `Esc` reverts
- **Performance & VRAM** — live FPS timeline, draw calls, triangles, estimated
  GPU memory, orphaned-resource leak detector with one-click dispose
- **Animations** — play/pause/stop, scrub timelines, adjust playback speed
- **Session Edits** — every change is recorded; export as a JSON diff
- **Console bridge** — expose the selected object as `$three` / `$selected`

## Reloading after code changes

```bash
npm run watch   # rebuilds dist/ on every save
```

After each rebuild:

1. Click the **reload** (↻) icon on the extension card in `chrome://extensions/`.
2. Refresh the inspected page (`F5`) so the updated hook is re-injected.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No **Three.js** tab in DevTools | Make sure you loaded `dist/` (not the repo root), then restart the browser. |
| Panel says "No Three.js Scene Found" | The page must actually render with `WebGLRenderer`. Click **Refresh Detection** — detection also runs continuously, so late-initialized scenes are picked up automatically. |
| "Extension context invalidated" in the console | The extension was reloaded/updated. Refresh the page — reconnect loops stop automatically on orphaned tabs. |
| Selection/edits don't apply | Some heavily sandboxed pages block `inspectedWindow.eval`; the port-based path still works. Try refreshing the page. |
| FPS reading looks capped | FPS is measured from hooked render calls; pages using `requestAnimationFrame` throttling (background tabs) will show lower values. |

## Uninstall

`chrome://extensions/` → **Three.js Inspector** → **Remove**.
