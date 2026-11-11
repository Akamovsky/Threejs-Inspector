# Three.js Inspector DevTools Extension

A high-performance Chrome DevTools extension for inspecting, debugging, and modifying Three.js scenes in real time.

## Architecture

```
Webpage Context (Main World)
  └── hook.js (intercepts WebGLRenderer.prototype.render, extracts scene graph, live mutations)
          ▲
          │ window.postMessage
          ▼
Isolated Content Script
  └── content.js (bridges page and extension runtime)
          ▲
          │ chrome.runtime.Port
          ▼
Background Service Worker
  └── background.js (routes messages per tab, manages 3D badges)
          ▲
          │ chrome.runtime.Port
          ▼
DevTools Panel (Vue 3 + TypeScript)
  ├── TreeView (scene hierarchy, type icons, search, visibility toggle)
  ├── Inspector (live transform XYZ, material color/roughness, geometry stats, lights)
  ├── StatsView (real-time FPS, draw calls, triangles, GPU memory)
  └── Console Bridge (assigns selected object to window.$three)
```

## Directory Structure

```
├── manifest.json            # Manifest V3 extension configuration
├── INSTALL.md               # Step-by-step browser installation guide
├── package.json
├── tsconfig.json
├── vite.config.ts           # Dual build: Vite (Vue UI) + Esbuild (isolated scripts)
├── public/
│   ├── manifest.json
│   └── icons/               # 16x16, 48x48, 128x128 extension icons
├── src/
│   ├── types/               # Strict TypeScript definitions for protocol and 3D data
│   │   ├── messages.ts
│   │   └── three-data.ts
│   ├── injected/            # Main-world hook (renderer intercept, gizmo, flashlight,
│   │   ├── hook.ts          #   debug camera, exporter, memory audit, animations)
│   │   ├── gizmo.ts
│   │   ├── debug-camera.ts
│   │   ├── exporter.ts
│   │   ├── memory-audit.ts
│   │   └── animations.ts
│   ├── content/             # Isolated content script bridge
│   │   └── content.ts
│   ├── background/          # MV3 Service worker
│   │   └── background.ts
│   ├── devtools/            # DevTools panel registration
│   │   └── devtools.ts
│   ├── panel/               # DevTools Vue 3 UI (entry: root panel.html)
│   │   ├── App.vue
│   │   ├── bridge.ts        # Communication store
│   │   ├── main.ts
│   │   ├── components/      # TreeNode, TreeView, CategoryView, Inspector,
│   │   │                   #   StatsView, AnimationView, EditsView
│   │   └── styles/          # Dark theme CSS
│   └── popup/               # Browser action popup (entry: root popup.html)
│       ├── Popup.vue
│       └── popup.ts
└── dist/                    # Build output — load this folder into the browser
```

## Installation

See **[INSTALL.md](INSTALL.md)** for full step-by-step instructions.

Quick start:

```bash
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension via `chrome://extensions/` (Developer mode → **Load unpacked**).

## Development

| Command | Description |
| --- | --- |
| `npm run build` | Production build to `dist/` |
| `npm run watch` | Rebuild on file change (reload the extension in the browser after each build) |
| `npm run typecheck` | Full `vue-tsc` type check |

## Usage

1. Open any page running Three.js and press `F12`.
2. Select the **Three.js** tab in the DevTools panel.
3. Inspect the scene tree, tweak transforms/materials/lights, drag the 3D gizmo,
   toggle the free debug camera (with its built-in flashlight), watch FPS and
   estimated VRAM, control animation mixers, and export your session edits as JSON.
