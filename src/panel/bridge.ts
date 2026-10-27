import { reactive } from 'vue';
import type {
  SerializedNode,
  ObjectDetails,
  RendererStats,
  CategorizedSceneData
} from '../types/three-data';
import {
  MESSAGE_SOURCE,
  type InspectorMessage,
  type ActionType
} from '../types/messages';

export const state = reactive({
  connected: false,
  detected: false,
  version: '',
  scenes: [] as SerializedNode[],
  categories: null as CategorizedSceneData | null,
  selectedUuid: null as string | null,
  selectedObject: null as ObjectDetails | null,
  stats: null as RendererStats | null,
  wireframeActive: false,
  pickerActive: false,
  pointerLockBypassed: false,
  scenePaused: false,
  lockedTransformUuids: new Set<string>(),
  filterQuery: '',
  statusMessage: 'Waiting for Three.js scene...'
});

let port: chrome.runtime.Port | null = null;
const tabId = chrome.devtools?.inspectedWindow?.tabId || 0;
let pickerPollTimer: any = null;

// Direct execution in the inspected page's main world
export function executeInPage(code: string, callback?: (result: any, isException: any) => void) {
  if (chrome.devtools?.inspectedWindow?.eval) {
    chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
      if (callback) {
        callback(result, isException);
      }
    });
  }
}

export function initBridge() {
  if (port) return;

  try {
    port = chrome.runtime.connect({
      name: `three-inspector-devtools-${tabId}`
    });

    state.connected = true;

    port.onMessage.addListener((message: InspectorMessage) => {
      handleMessage(message);
    });

    port.onDisconnect.addListener(() => {
      state.connected = false;
      port = null;
      setTimeout(initBridge, 1000);
    });

    // Request initial data via port and direct eval
    send('REQUEST_SCENE_GRAPH');
    refresh();
  } catch (e) {
    state.statusMessage = 'DevTools bridge error: ' + String(e);
  }
}

function handleMessage(message: InspectorMessage) {
  if (!message || !message.action) return;

  switch (message.action) {
    case 'THREE_DETECTED':
      state.detected = true;
      if (message.payload?.version) {
        state.version = message.payload.version;
      }
      state.statusMessage = `Three.js detected (${state.version || 'r?'})`;
      send('REQUEST_SCENE_GRAPH');
      break;

    case 'SCENE_GRAPH_DATA':
      state.detected = true;
      if (message.payload?.scenes) {
        state.scenes = message.payload.scenes;
        state.statusMessage = `Loaded ${state.scenes.length} scene(s)`;
      }
      break;

    case 'CATEGORIZED_DATA':
      if (message.payload) {
        state.categories = message.payload;
      }
      break;

    case 'OBJECT_PICKED':
      if (message.payload?.uuid) {
        state.selectedUuid = message.payload.uuid;
        state.pickerActive = false;
        selectObject(message.payload.uuid);
      }
      break;

    case 'OBJECT_DETAILS_DATA':
      if (message.payload) {
        state.selectedObject = message.payload;
        state.selectedUuid = message.payload.uuid;
      }
      break;

    case 'STATS_UPDATE':
      if (message.payload) {
        state.stats = message.payload;
      }
      break;
  }
}

export function send(action: ActionType, payload?: any) {
  if (!port) return;
  const message: InspectorMessage = {
    source: MESSAGE_SOURCE.PANEL,
    action,
    payload,
    tabId,
    timestamp: Date.now()
  };
  try {
    port.postMessage(message);
  } catch (e) {
    console.error('[DevTools Panel] Send failed:', e);
  }
}

export function selectObject(uuid: string) {
  state.selectedUuid = uuid;

  // Direct page eval: instantly gets details and sets highlight
  const script = `
    (function() {
      if (window.__THREE_INSPECTOR__) {
        return window.__THREE_INSPECTOR__.selectObject(${JSON.stringify(uuid)});
      }
      return null;
    })()
  `;
  executeInPage(script, (details) => {
    if (details && details.uuid) {
      state.selectedObject = details;
    }
  });

  send('SELECT_OBJECT', { uuid });
}

export function highlightObject(uuid: string | null) {
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.setHighlight(${JSON.stringify(uuid)});
    }
  `;
  executeInPage(script);
  send('HIGHLIGHT_OBJECT', { uuid });
}

export function updateProperty(uuid: string, path: string[], value: any) {
  // Direct page eval: modifies property in Three.js object instantly!
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.updateProperty(${JSON.stringify(uuid)}, ${JSON.stringify(path)}, ${JSON.stringify(value)});
    }
  `;
  executeInPage(script);
  send('UPDATE_PROPERTY', { uuid, path, value });
}

export function inspectInConsole(uuid: string) {
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.inspectInConsole(${JSON.stringify(uuid)});
    }
  `;
  executeInPage(script);
  send('INSPECT_IN_CONSOLE', { uuid });
}

export function toggleWireframe() {
  state.wireframeActive = !state.wireframeActive;
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.toggleWireframe(${state.wireframeActive});
    }
  `;
  executeInPage(script);
  send('TOGGLE_WIREFRAME', { enabled: state.wireframeActive });
}

export function togglePicker() {
  state.pickerActive = !state.pickerActive;

  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.setPickerMode(${state.pickerActive});
    }
  `;
  executeInPage(script);
  send('TOGGLE_PICKER', { enabled: state.pickerActive });

  // Poll for picked object while picker is active to ensure instant selection
  if (state.pickerActive) {
    if (pickerPollTimer) clearInterval(pickerPollTimer);
    pickerPollTimer = setInterval(() => {
      if (!state.pickerActive) {
        clearInterval(pickerPollTimer);
        return;
      }
      const pollScript = `
        (function() {
          if (window.__THREE_INSPECTOR__ && window.__THREE_INSPECTOR__.lastPickedObject) {
            var uuid = window.__THREE_INSPECTOR__.lastPickedObject;
            window.__THREE_INSPECTOR__.lastPickedObject = null;
            return uuid;
          }
          return null;
        })()
      `;
      executeInPage(pollScript, (pickedUuid) => {
        if (pickedUuid) {
          state.pickerActive = false;
          clearInterval(pickerPollTimer);
          selectObject(pickedUuid);
        }
      });
    }, 120);
  } else {
    if (pickerPollTimer) clearInterval(pickerPollTimer);
  }
}

export function togglePointerLockBypass() {
  state.pointerLockBypassed = !state.pointerLockBypassed;
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.setPointerLockBypass(${state.pointerLockBypassed});
    }
  `;
  executeInPage(script);
  send('TOGGLE_POINTER_LOCK_BYPASS', { enabled: state.pointerLockBypassed });
}

export function togglePauseScene() {
  state.scenePaused = !state.scenePaused;
  send('TOGGLE_PAUSE_SCENE', { enabled: state.scenePaused });
}

export function toggleLockTransform(uuid: string, position?: { x: number; y: number; z: number }) {
  const isLocked = state.lockedTransformUuids.has(uuid);
  if (isLocked) {
    state.lockedTransformUuids.delete(uuid);
    send('LOCK_TRANSFORM', { uuid, enabled: false });
  } else {
    state.lockedTransformUuids.add(uuid);
    send('LOCK_TRANSFORM', { uuid, enabled: true, position });
  }
}

export function resetPropertyOverrides(uuid: string) {
  state.lockedTransformUuids.delete(uuid);
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.unpinObjectProperties(${JSON.stringify(uuid)});
    }
  `;
  executeInPage(script);
  send('RESET_PROPERTY_OVERRIDES', { uuid });
  refresh();
}

export function refresh() {
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.refresh();
    }
  `;
  executeInPage(script);
  send('REQUEST_SCENE_GRAPH');
}
