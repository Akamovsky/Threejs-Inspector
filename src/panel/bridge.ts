import { reactive, ref } from 'vue';
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
  filterQuery: '',
  statusMessage: 'Waiting for Three.js scene...'
});

let port: chrome.runtime.Port | null = null;
const tabId = chrome.devtools?.inspectedWindow?.tabId || 0;

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

    // Request initial data
    send('REQUEST_SCENE_GRAPH');
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
      state.statusMessage = `Three.js detected (revision: ${state.version || 'r?'})`;
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
  send('SELECT_OBJECT', { uuid });
}

export function highlightObject(uuid: string | null) {
  send('HIGHLIGHT_OBJECT', { uuid });
}

export function updateProperty(uuid: string, path: string[], value: any) {
  send('UPDATE_PROPERTY', { uuid, path, value });
}

export function inspectInConsole(uuid: string) {
  send('INSPECT_IN_CONSOLE', { uuid });
}

export function toggleWireframe() {
  state.wireframeActive = !state.wireframeActive;
  send('TOGGLE_WIREFRAME', { enabled: state.wireframeActive });
}

export function togglePicker() {
  state.pickerActive = !state.pickerActive;
  send('TOGGLE_PICKER', { enabled: state.pickerActive });
}

export function refresh() {
  send('REQUEST_SCENE_GRAPH');
}
