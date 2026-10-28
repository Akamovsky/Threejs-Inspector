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
  memoryBytes?: number;
}

export interface TextureSlotInfo {
  slot: string;
  uuid: string;
  name: string;
  dataUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  mapping?: string;
  memoryBytes?: number;
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
  textures?: TextureSlotInfo[];
  isShaderMaterial?: boolean;
  vertexShader?: string;
  fragmentShader?: string;
  customUniforms?: Record<string, any>;
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

// Category Items for Categorized View
export interface CategoryMeshItem {
  id: number;
  uuid: string;
  name: string;
  type: string;
  geometryType: string;
  materialType: string;
  materialColor?: string;
  verticesCount: number;
  facesCount: number;
  visible: boolean;
}

export interface CategoryLightItem {
  id: number;
  uuid: string;
  name: string;
  type: string;
  color: string;
  intensity: number;
  visible: boolean;
}

export interface CategoryCameraItem {
  id: number;
  uuid: string;
  name: string;
  type: string;
  fov?: number;
  visible: boolean;
}

export interface CategoryMaterialItem {
  uuid: string;
  name: string;
  type: string;
  color?: string;
  wireframe?: boolean;
  transparent?: boolean;
  opacity?: number;
  linkedObjectUuids: string[];
}

export interface CategoryTextureItem {
  uuid: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  format?: string;
  mapping?: string;
  dataUrl?: string;
  memoryBytes?: number;
  linkedObjectUuids: string[];
}

export interface CategoryGeometryItem {
  uuid: string;
  name: string;
  type: string;
  verticesCount: number;
  facesCount: number;
  memoryBytes?: number;
  linkedObjectUuids: string[];
}

export interface CategorizedSceneData {
  meshes: CategoryMeshItem[];
  lights: CategoryLightItem[];
  cameras: CategoryCameraItem[];
  materials: CategoryMaterialItem[];
  textures: CategoryTextureItem[];
  geometries: CategoryGeometryItem[];
}

// Memory & Resource Auditing
export interface AuditedResourceItem {
  uuid: string;
  name: string;
  type: 'texture' | 'geometry';
  memoryBytes: number;
  memoryMB: number;
  inScene: boolean;
  details: string;
}

export interface MemoryAuditData {
  totalVramMB: number;
  texturesVramMB: number;
  geometriesVramMB: number;
  orphansCount: number;
  resources: AuditedResourceItem[];
}

// Animation
export interface AnimationClipInfo {
  name: string;
  duration: number;
  tracksCount: number;
  isPlaying: boolean;
  time: number;
  speed: number;
}

export interface AnimationMixerInfo {
  id: string;
  rootUuid: string;
  rootName: string;
  clips: AnimationClipInfo[];
}

// Session Edits / Diff Record
export interface SessionEditRecord {
  id: string;
  timestamp: number;
  uuid: string;
  objectName: string;
  path: string;
  value: any;
}
