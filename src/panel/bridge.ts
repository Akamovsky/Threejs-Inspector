import { reactive } from 'vue';
import type {
  SerializedNode,
  ObjectDetails,
  RendererStats,
  CategorizedSceneData,
  MemoryAuditData,
  AnimationMixerInfo,
  SessionEditRecord
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
  scenePaused: false,
  debugCameraActive: false,
  isFocused: false,
  gizmoMode: 'none' as 'translate' | 'rotate' | 'scale' | 'none',
  memoryAudit: null as MemoryAuditData | null,
  animations: [] as AnimationMixerInfo[],
  sessionEdits: [] as SessionEditRecord[],
  lockedTransformUuids: new Set<string>(),
  filterQuery: '',
  statusMessage: 'Waiting for Three.js scene...'
});

let port: chrome.runtime.Port | null = null;
const tabId = chrome.devtools?.inspectedWindow?.tabId || 0;

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

    case 'MEMORY_AUDIT_DATA':
      if (message.payload) {
        state.memoryAudit = message.payload;
      }
      break;

    case 'ANIMATION_DATA':
      if (message.payload) {
        state.animations = message.payload;
      }
      break;

    case 'TRANSFORM_GIZMO_UPDATED':
      if (message.payload && state.selectedObject && state.selectedObject.uuid === message.payload.uuid) {
        state.selectedObject.position = message.payload.position;
        state.selectedObject.rotationDegrees = message.payload.rotationDegrees;
        state.selectedObject.scale = message.payload.scale;

        logSessionEdit(message.payload.uuid, state.selectedObject.name, 'transform', {
          position: message.payload.position,
          rotation: message.payload.rotationDegrees,
          scale: message.payload.scale
        });
      }
      break;

    case 'FOCUS_STATE_CHANGED':
      if (typeof message.payload?.isFocused === 'boolean') {
        state.isFocused = message.payload.isFocused;
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

export function logSessionEdit(uuid: string, objectName: string, path: string, value: any) {
  state.sessionEdits.unshift({
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    uuid,
    objectName,
    path,
    value
  });
  if (state.sessionEdits.length > 200) {
    state.sessionEdits.pop();
  }
}

export function selectObject(uuid: string) {
  state.selectedUuid = uuid;

  if (state.gizmoMode === 'none') {
    state.gizmoMode = 'translate';
  }

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
}

let hoverDebounceTimer: any = null;

export function highlightObject(uuid: string | null) {
  if (hoverDebounceTimer) {
    clearTimeout(hoverDebounceTimer);
  }
  hoverDebounceTimer = setTimeout(() => {
    const script = `
      if (window.__THREE_INSPECTOR__) {
        window.__THREE_INSPECTOR__.setHoverHighlight(${JSON.stringify(uuid)});
      }
    `;
    executeInPage(script);
  }, 40);
}

export function updateProperty(uuid: string, path: string[], value: any) {
  const propKey = path.join('.');
  if (state.selectedObject) {
    logSessionEdit(uuid, state.selectedObject.name, propKey, value);
  }

  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.updateProperty(${JSON.stringify(uuid)}, ${JSON.stringify(path)}, ${JSON.stringify(value)});
    }
  `;
  executeInPage(script);
  send('UPDATE_PROPERTY', { uuid, path, value });
}

export function setGizmoMode(mode: 'translate' | 'rotate' | 'scale' | 'none') {
  state.gizmoMode = mode;
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.setGizmoMode(${JSON.stringify(mode)});
    }
  `;
  executeInPage(script);
  send('SET_GIZMO_MODE', { mode });
}

export function toggleFocusObject(uuid?: string) {
  const targetUuid = uuid || state.selectedUuid;
  if (!targetUuid) return;
  const script = `
    (function() {
      if (window.__THREE_INSPECTOR__) {
        return window.__THREE_INSPECTOR__.toggleFocus(${JSON.stringify(targetUuid)});
      }
      return false;
    })()
  `;
  executeInPage(script, (isFocused) => {
    state.isFocused = Boolean(isFocused);
  });
}

export function revertFocus() {
  const script = `
    (function() {
      if (window.__THREE_INSPECTOR__) {
        return window.__THREE_INSPECTOR__.revertFocus();
      }
      return false;
    })()
  `;
  executeInPage(script, () => {
    state.isFocused = false;
  });
}

// Window Escape key handler in DevTools panel
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.isFocused) {
      revertFocus();
    }
  });
}

export function toggleDebugCamera() {
  const script = `
    (function() {
      if (window.__THREE_INSPECTOR__) {
        return window.__THREE_INSPECTOR__.toggleDebugCamera();
      }
      return false;
    })()
  `;
  executeInPage(script, (active) => {
    state.debugCameraActive = Boolean(active);
  });
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

export function togglePauseSimulation() {
  state.scenePaused = !state.scenePaused;
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.togglePauseSimulation(${state.scenePaused});
    }
  `;
  executeInPage(script);
  send('TOGGLE_PAUSE_SCENE', { enabled: state.scenePaused });
}

export function stepSimulationFrame() {
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.stepSimulationFrame();
    }
  `;
  executeInPage(script);
  send('STEP_SIMULATION_FRAME');
}

export function downloadTexture(uuid: string) {
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.downloadTexture(${JSON.stringify(uuid)});
    }
  `;
  executeInPage(script);
}

export function requestMemoryAudit() {
  const script = `
    (function() {
      if (window.__THREE_INSPECTOR__) {
        return window.__THREE_INSPECTOR__.getMemoryAudit();
      }
      return null;
    })()
  `;
  executeInPage(script, (data) => {
    if (data) state.memoryAudit = data;
  });
  send('REQUEST_MEMORY_AUDIT');
}

export function disposeResource(uuid: string, type: 'geometry' | 'texture') {
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.disposeResource(${JSON.stringify(uuid)}, ${JSON.stringify(type)});
    }
  `;
  executeInPage(script);
  send('DISPOSE_RESOURCE', { uuid, type });
  requestMemoryAudit();
}

export function requestAnimations() {
  const script = `
    (function() {
      if (window.__THREE_INSPECTOR__) {
        return window.__THREE_INSPECTOR__.getAnimations();
      }
      return [];
    })()
  `;
  executeInPage(script, (data) => {
    if (Array.isArray(data)) state.animations = data;
  });
  send('REQUEST_ANIMATIONS');
}

export function controlAnimation(mixerId: string, clipName: string, action: 'play' | 'pause' | 'stop' | 'seek' | 'speed', value?: number) {
  const script = `
    if (window.__THREE_INSPECTOR__) {
      window.__THREE_INSPECTOR__.controlAnimation(${JSON.stringify(mixerId)}, ${JSON.stringify(clipName)}, ${JSON.stringify(action)}, ${JSON.stringify(value)});
    }
  `;
  executeInPage(script);
  send('CONTROL_ANIMATION', { mixerId, clipName, action, value });
}

export function exportEditsJSON() {
  const diffObject: Record<string, any> = {};
  state.sessionEdits.forEach((edit) => {
    if (!diffObject[edit.objectName]) {
      diffObject[edit.objectName] = { uuid: edit.uuid, changes: {} };
    }
    diffObject[edit.objectName].changes[edit.path] = edit.value;
  });

  const blob = new Blob([JSON.stringify(diffObject, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `threejs-edits-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

export function copyThreeCode(obj: ObjectDetails) {
  if (!obj) return;
  const lines: string[] = [
    `// Three.js code for: ${obj.name}`,
    `const obj = scene.getObjectByProperty('uuid', '${obj.uuid}');`,
    `if (obj) {`,
    `  obj.position.set(${obj.position.x}, ${obj.position.y}, ${obj.position.z});`,
    `  obj.rotation.set(${obj.rotation.x}, ${obj.rotation.y}, ${obj.rotation.z});`,
    `  obj.scale.set(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});`,
    `  obj.visible = ${obj.visible};`
  ];

  if (obj.light) {
    lines.push(`  obj.intensity = ${obj.light.intensity};`);
    lines.push(`  obj.color.set('${obj.light.color}');`);
  }

  if (obj.material && !Array.isArray(obj.material)) {
    if (obj.material.color) lines.push(`  obj.material.color.set('${obj.material.color}');`);
    lines.push(`  obj.material.wireframe = ${Boolean(obj.material.wireframe)};`);
    lines.push(`  obj.material.opacity = ${obj.material.opacity};`);
  }

  lines.push(`}`);
  const code = lines.join('\n');
  navigator.clipboard.writeText(code);
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
    (function() {
      if (window.__THREE_INSPECTOR__) {
        window.__THREE_INSPECTOR__.refresh();
        return {
          categories: typeof window.__THREE_INSPECTOR__.getCategorizedData === 'function' ? window.__THREE_INSPECTOR__.getCategorizedData() : null,
          scenes: typeof window.__THREE_INSPECTOR__.getSceneGraph === 'function' ? window.__THREE_INSPECTOR__.getSceneGraph() : null
        };
      }
      return null;
    })()
  `;
  executeInPage(script, (data) => {
    if (data?.categories) {
      state.categories = data.categories;
    }
    if (data?.scenes) {
      state.scenes = data.scenes;
      state.statusMessage = `Loaded ${state.scenes.length} scene(s)`;
    }
  });
  send('REQUEST_SCENE_GRAPH');
}
