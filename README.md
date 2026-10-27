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
├── package.json
├── tsconfig.json
├── vite.config.ts           # Dual build: Vite (Vue UI) + Esbuild (isolated scripts)
├── vite.demo.config.ts      # Dev server config for demo playground
├── public/
│   ├── manifest.json
│   └── icons/               # 16x16, 48x48, 128x128 extension icons
├── src/
│   ├── types/               # Strict TypeScript definitions for protocol and 3D data
│   │   ├── messages.ts
│   │   └── three-data.ts
│   ├── injected/            # Main-world hook
│   │   └── hook.ts
│   ├── content/             # Isolated content script bridge
│   │   └── content.ts
│   ├── background/          # MV3 Service worker
│   │   └── background.ts
│   ├── devtools/            # DevTools panel registration
│   │   ├── devtools.html
│   │   └── devtools.ts
│   ├── panel/               # DevTools Vue 3 UI
│   │   ├── App.vue
│   │   ├── bridge.ts        # Communication store
│   │   ├── main.ts
│   │   ├── components/      # TreeNode, TreeView, Inspector, StatsView
│   │   └── styles/          # Dark theme CSS
│   └── popup/               # Browser action popup
│       ├── Popup.vue
│       ├── popup.html
│       └── popup.ts
└── demo/                    # Interactive Three.js test scene
    ├── index.html
    └── main.ts
```

## How to Build & Load

1. **Build the extension**:
   ```bash
   npm run build
   ```
   The compiled extension is output to the `dist/` folder.

2. **Load in Chrome / Chromium**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top right).
   - Click **Load unpacked** and select `/home/akam/Projects/threejs-inspector/dist`.

3. **Run the demo scene**:
   ```bash
   npm run demo
   ```
   - Open `http://localhost:5173/` in Chrome.
   - Press `F12` (Open DevTools) and select the **Three.js** tab.
