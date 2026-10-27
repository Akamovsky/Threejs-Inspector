export interface SerializedNode {
  id: number;
  uuid: string;
  name: string;
  type: string;
  visible: boolean;
  childrenCount: number;
  children: SerializedNode[];
}

export interface GeometryInfo {
  uuid: string;
  type: string;
  verticesCount: number;
  facesCount: number;
  hasNormals: boolean;
  hasUVs: boolean;
  hasColors: boolean;
  parameters?: Record<string, any>;
}

export interface MaterialInfo {
  uuid: string;
  name: string;
  type: string;
  color?: string;
  emissive?: string;
  roughness?: number;
  metalness?: number;
  opacity: number;
  transparent: boolean;
  wireframe?: boolean;
  visible: boolean;
  depthTest?: boolean;
  depthWrite?: boolean;
}

export interface LightInfo {
  color: string;
  intensity: number;
  distance?: number;
  decay?: number;
  angle?: number;
  penumbra?: number;
  groundColor?: string;
}

export interface CameraInfo {
  fov?: number;
  near: number;
  far: number;
  zoom: number;
  aspect?: number;
}

export interface ObjectDetails {
  id: number;
  uuid: string;
  name: string;
  type: string;
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  frustumCulled: boolean;
  renderOrder: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // In radians
  rotationDegrees: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  geometry?: GeometryInfo | null;
  material?: MaterialInfo | MaterialInfo[] | null;
  light?: LightInfo | null;
  camera?: CameraInfo | null;
  userData: Record<string, any>;
}

export interface RendererStats {
  fps: number;
  frameTime: number;
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  programs: number;
}

export interface ThreeSceneSummary {
  id: number;
  uuid: string;
  name: string;
  type: string;
  childrenCount: number;
}
