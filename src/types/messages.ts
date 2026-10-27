import type {
  SerializedNode,
  ObjectDetails,
  RendererStats,
  CategorizedSceneData
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
  // Extension -> Hook
  | 'REQUEST_SCENE_GRAPH'
  | 'SELECT_OBJECT'
  | 'HIGHLIGHT_OBJECT'
  | 'UPDATE_PROPERTY'
  | 'INSPECT_IN_CONSOLE'
  | 'TOGGLE_HELPER'
  | 'TOGGLE_WIREFRAME'
  | 'TOGGLE_PICKER'
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
