import type {
  SerializedNode,
  ObjectDetails,
  RendererStats,
  CategorizedSceneData,
  MemoryAuditData,
  AnimationMixerInfo
} from './three-data';

export const MESSAGE_SOURCE = {
  HOOK: 'three-inspector-hook',
  CONTENT: 'three-inspector-content',
  PANEL: 'three-inspector-panel',
  POPUP: 'three-inspector-popup',
  BACKGROUND: 'three-inspector-background'
} as const;

export type MessageSource = typeof MESSAGE_SOURCE[keyof typeof MESSAGE_SOURCE];

export type ActionType =
  // Hook -> Extension
  | 'THREE_DETECTED'
  | 'SCENE_GRAPH_DATA'
  | 'CATEGORIZED_DATA'
  | 'OBJECT_DETAILS_DATA'
  | 'STATS_UPDATE'
  | 'OBJECT_MUTATED'
  | 'OBJECT_PICKED'
  | 'MEMORY_AUDIT_DATA'
  | 'ANIMATION_DATA'
  | 'TRANSFORM_GIZMO_UPDATED'
  | 'FOCUS_STATE_CHANGED'
  // Extension -> Hook
  | 'REQUEST_SCENE_GRAPH'
  | 'REQUEST_MEMORY_AUDIT'
  | 'REQUEST_ANIMATIONS'
  | 'SELECT_OBJECT'
  | 'HIGHLIGHT_OBJECT'
  | 'UPDATE_PROPERTY'
  | 'INSPECT_IN_CONSOLE'
  | 'TOGGLE_HELPER'
  | 'TOGGLE_WIREFRAME'
  | 'SET_RENDER_OVERRIDE'
  | 'TOGGLE_PICKER'
  | 'SET_GIZMO_MODE'
  | 'FOCUS_OBJECT'
  | 'TOGGLE_DEBUG_CAMERA'
  | 'TOGGLE_POINTER_LOCK_BYPASS'
  | 'LOCK_TRANSFORM'
  | 'RESET_PROPERTY_OVERRIDES'
  | 'TOGGLE_PAUSE_SCENE'
  | 'STEP_SIMULATION_FRAME'
  | 'SPAWN_PRIMITIVE'
  | 'EXPORT_GLTF'
  | 'CAPTURE_SCREENSHOT'
  | 'CONTROL_ANIMATION'
  | 'DISPOSE_RESOURCE'
  | 'PING'
  | 'PONG';

export interface InspectorMessage<T = any> {
  source: MessageSource;
  action: ActionType;
  payload?: T;
  tabId?: number;
  timestamp?: number;
}

export interface ThreeDetectedPayload {
  version: string;
  scenesCount: number;
  renderersCount: number;
}

export interface SceneGraphPayload {
  scenes: SerializedNode[];
}

export interface SelectObjectPayload {
  uuid: string;
}

export interface HighlightObjectPayload {
  uuid: string | null;
}

export interface UpdatePropertyPayload {
  uuid: string;
  path: string[];
  value: any;
}

export interface InspectInConsolePayload {
  uuid: string;
}

export interface ToggleHelperPayload {
  uuid: string;
  helper: 'box' | 'axes' | 'wireframe';
  enabled: boolean;
}

export interface TogglePickerPayload {
  enabled: boolean;
}

export interface ObjectPickedPayload {
  uuid: string;
}

export interface TogglePointerLockBypassPayload {
  enabled: boolean;
}

export interface LockTransformPayload {
  uuid: string;
  enabled: boolean;
  position?: { x: number; y: number; z: number };
}

export interface TogglePauseScenePayload {
  enabled: boolean;
}

export interface SetGizmoModePayload {
  mode: 'translate' | 'rotate' | 'scale' | 'none';
}

export interface SetRenderOverridePayload {
  mode: 'default' | 'wireframe' | 'normals' | 'depth' | 'unlit';
}

export interface SpawnPrimitivePayload {
  type: 'box' | 'sphere' | 'plane' | 'cylinder' | 'directionalLight' | 'pointLight' | 'ambientLight' | 'group';
}

export interface ControlAnimationPayload {
  mixerId: string;
  clipName: string;
  action: 'play' | 'pause' | 'stop' | 'seek' | 'speed';
  value?: number;
}
