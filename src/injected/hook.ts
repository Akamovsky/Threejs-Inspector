import {
  BoxHelper,
  Box3,
  Box3Helper,
  Vector3,
  Color,
  MeshBasicMaterial
} from 'three';
import type {
  SerializedNode,
  ObjectDetails,
  GeometryInfo,
  MaterialInfo,
  TextureSlotInfo,
  LightInfo,
  CameraInfo,
  RendererStats,
  CategorizedSceneData,
  CategoryMeshItem,
  CategoryLightItem,
  CategoryCameraItem,
  CategoryMaterialItem,
  CategoryTextureItem,
  CategoryGeometryItem
} from '../types/three-data';
import {
  MESSAGE_SOURCE,
  type InspectorMessage,
  type UpdatePropertyPayload
} from '../types/messages';
import { GizmoManager, type GizmoMode } from './gizmo';
import { DebugCameraManager } from './debug-camera';
import { ExporterManager } from './exporter';
import { MemoryAuditor } from './memory-audit';
import { AnimationManager } from './animations';

(function initThreeInspectorHook() {
  if ((window as any).__THREE_INSPECTOR_HOOK_INSTALLED__) {
    return;
  }
  (window as any).__THREE_INSPECTOR_HOOK_INSTALLED__ = true;

  // Active Three.js instances
  const registeredScenes = new Set<any>();
  const registeredRenderers = new Set<any>();
  const uuidToObjectMap = new Map<string, any>();
  const allKnownGeometries = new Map<string, any>();
  const allKnownTextures = new Map<string, any>();

  // Managers
  const gizmoManager = new GizmoManager();
  const debugCameraManager = new DebugCameraManager();
  const animationManager = new AnimationManager();

  // Helper and Selection State
  let currentHighlightHelper: any = null;
  let currentHighlightTarget: any = null;
  let activeSelectedUuid: string | null = null;
  let lastActiveCamera: any = null;

  // Wireframe override state
  let isWireframeActive = false;
  const overrideWireframe = new MeshBasicMaterial({ wireframe: true, color: 0x38bdf8 });

  // Simulation Pause & Step
  let simulationPaused = false;
  let stepOneFrame = false;

  // Persistent property overrides (prevent game loops / animations from reverting user edits)
  const pinnedOverrides = new Map<string, Record<string, any>>();

  // Escape key reverts camera focus
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gizmoManager.isFocused()) {
      const cam = getActiveCamera();
      if (cam) {
        gizmoManager.revertFocus(cam);
        emit('FOCUS_STATE_CHANGED', { isFocused: false });
      }
    }
  });

  gizmoManager.setOnDraggingChange((isDragging: boolean) => {
    try {
      const orbit = debugCameraManager.getControls();
      if (orbit) {
        orbit.enabled = !isDragging;
      }
    } catch (e) {}
  });

  gizmoManager.setOnTransformChange((obj: any) => {
    if (!obj || !obj.uuid) return;
    try {
      let overrides = pinnedOverrides.get(obj.uuid);
      if (!overrides) {
        overrides = {};
        pinnedOverrides.set(obj.uuid, overrides);
      }

      if (obj.position) {
        overrides['position.x'] = obj.position.x;
        overrides['position.y'] = obj.position.y;
        overrides['position.z'] = obj.position.z;
      }
      if (obj.rotation) {
        overrides['rotationDegrees.x'] = (obj.rotation.x * 180) / Math.PI;
        overrides['rotationDegrees.y'] = (obj.rotation.y * 180) / Math.PI;
        overrides['rotationDegrees.z'] = (obj.rotation.z * 180) / Math.PI;
      }
      if (obj.scale) {
        overrides['scale.x'] = obj.scale.x;
        overrides['scale.y'] = obj.scale.y;
        overrides['scale.z'] = obj.scale.z;
      }

      emit('TRANSFORM_GIZMO_UPDATED', {
        uuid: obj.uuid,
        position: obj.position ? { x: +obj.position.x.toFixed(3), y: +obj.position.y.toFixed(3), z: +obj.position.z.toFixed(3) } : { x: 0, y: 0, z: 0 },
        rotationDegrees: obj.rotation ? {
          x: +((obj.rotation.x * 180) / Math.PI).toFixed(2),
          y: +((obj.rotation.y * 180) / Math.PI).toFixed(2),
          z: +((obj.rotation.z * 180) / Math.PI).toFixed(2)
        } : { x: 0, y: 0, z: 0 },
        scale: obj.scale ? { x: +obj.scale.x.toFixed(3), y: +obj.scale.y.toFixed(3), z: +obj.scale.z.toFixed(3) } : { x: 1, y: 1, z: 1 }
      });
    } catch (e) {}
  });

  function pinProperty(obj: any, propPath: string, value: any) {
    if (!obj || !obj.uuid) return;
    try {
      let overrides = pinnedOverrides.get(obj.uuid);
      if (!overrides) {
        overrides = {};
        pinnedOverrides.set(obj.uuid, overrides);
      }
      overrides[propPath] = value;

      if (propPath === 'light.intensity') {
        let currentVal = Number(value);
        obj.__inspector_intensity = currentVal;
        try {
          Object.defineProperty(obj, 'intensity', {
            get() {
              return obj.__inspector_intensity !== undefined ? obj.__inspector_intensity : currentVal;
            },
            set(v) {
              if (obj.__inspector_intensity !== undefined) return;
              currentVal = v;
            },
            configurable: true,
            enumerable: true
          });
        } catch (e) {
          obj.intensity = currentVal;
        }
      }
    } catch (e) {}
  }

  function unpinObjectProperties(uuid: string) {
    try {
      const obj = findObjectByUuid(uuid);
      pinnedOverrides.delete(uuid);
      if (!obj) return;

      if (obj.__inspector_intensity !== undefined) {
        delete obj.__inspector_intensity;
        delete obj.intensity;
      }
    } catch (e) {}
  }

  let frameCount = 0;
  let lastTime = performance.now();
  let currentFps = 60;
  let lastStatsEmit = 0;

  function emit<T>(action: InspectorMessage['action'], payload?: T) {
    try {
      const message: InspectorMessage<T> = {
        source: MESSAGE_SOURCE.HOOK,
        action,
        payload,
        timestamp: Date.now()
      };
      window.postMessage(message, '*');
    } catch (e) {}
  }

  function hookPointerLock() {
    const patchObj = (proto: any) => {
      if (!proto || !proto.requestPointerLock || proto.__INSPECTOR_PL_HOOKED__) return;
      proto.__INSPECTOR_PL_HOOKED__ = true;
      const orig = proto.requestPointerLock;
      proto.requestPointerLock = function () {
        if (debugCameraManager.isEnabled() || gizmoManager.getMode() !== 'none') {
          if (document.pointerLockElement) {
            try {
              document.exitPointerLock();
            } catch (e) {}
          }
          return Promise.resolve();
        }
        return orig.apply(this, arguments as any);
      };
    };

    if (typeof Element !== 'undefined') patchObj(Element.prototype);
    if (typeof HTMLElement !== 'undefined') patchObj(HTMLElement.prototype);
    if (typeof HTMLBodyElement !== 'undefined') patchObj(HTMLBodyElement.prototype);
    if (typeof HTMLCanvasElement !== 'undefined') patchObj(HTMLCanvasElement.prototype);
    if (typeof document !== 'undefined') patchObj(document);
  }
  hookPointerLock();

  function colorToHex(color: any): string {
    if (!color) return '#ffffff';
    if (typeof color.getHexString === 'function') {
      return '#' + color.getHexString();
    }
    if (typeof color === 'string') return color;
    return '#ffffff';
  }

  function hexToColor(targetColor: any, hex: string) {
    if (targetColor && typeof targetColor.set === 'function') {
      targetColor.set(hex);
    }
  }

  function findObjectByUuid(uuid: string): any {
    if (uuidToObjectMap.has(uuid)) {
      return uuidToObjectMap.get(uuid);
    }
    for (const scene of registeredScenes) {
      let found: any = null;
      try {
        scene.traverse((o: any) => {
          if (o && o.uuid) {
            uuidToObjectMap.set(o.uuid, o);
            if (o.uuid === uuid) found = o;
          }
        });
      } catch (e) {}
      if (found) return found;
    }
    return null;
  }

  function getActiveCamera(): any {
    const fallback = (() => {
      if (lastActiveCamera) return lastActiveCamera;
      for (const scene of registeredScenes) {
        let cam: any = null;
        try {
          scene.traverse((o: any) => {
            if (o && o.isCamera && !o.__isInspectorCamera && !cam) cam = o;
          });
        } catch (e) {}
        if (cam) return cam;
      }
      return null;
    })();
    return debugCameraManager.getCamera(fallback);
  }

  function getActiveCanvas(): HTMLCanvasElement | null {
    for (const r of registeredRenderers) {
      if (r && r.domElement) return r.domElement;
    }
    return document.querySelector('canvas');
  }

  function getActiveScene(): any {
    for (const s of registeredScenes) {
      return s;
    }
    return null;
  }

  function registerScene(scene: any) {
    if (!scene || !scene.isObject3D) return;
    if (!registeredScenes.has(scene)) {
      registeredScenes.add(scene);
      indexSceneObjects(scene);
      emitDetection();
      emitSceneGraph();
    }
  }

  function indexSceneObjects(root: any) {
    try {
      root.traverse((obj: any) => {
        if (obj && obj.uuid) {
          uuidToObjectMap.set(obj.uuid, obj);
        }
        if (obj?.geometry && obj.geometry.uuid) {
          allKnownGeometries.set(obj.geometry.uuid, obj.geometry);
        }
        if (obj?.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => {
            const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'envMap'];
            slots.forEach((s) => {
              const tex = m[s];
              if (tex && tex.isTexture && tex.uuid) {
                allKnownTextures.set(tex.uuid, tex);
              }
            });
          });
        }
      });
    } catch (e) {}
  }

  function registerRenderer(renderer: any) {
    if (!renderer) return;
    if (!registeredRenderers.has(renderer)) {
      registeredRenderers.add(renderer);
      emitDetection();
    }
  }

  function applyPinnedOverrides() {
    for (const [uuid, overrides] of pinnedOverrides.entries()) {
      try {
        const obj = findObjectByUuid(uuid);
        if (!obj) continue;

        if (obj.position) {
          if (overrides['position.x'] !== undefined) obj.position.x = overrides['position.x'];
          if (overrides['position.y'] !== undefined) obj.position.y = overrides['position.y'];
          if (overrides['position.z'] !== undefined) obj.position.z = overrides['position.z'];
        }

        if (obj.rotation) {
          if (overrides['rotationDegrees.x'] !== undefined) {
            obj.rotation.x = (overrides['rotationDegrees.x'] * Math.PI) / 180;
          }
          if (overrides['rotationDegrees.y'] !== undefined) {
            obj.rotation.y = (overrides['rotationDegrees.y'] * Math.PI) / 180;
          }
          if (overrides['rotationDegrees.z'] !== undefined) {
            obj.rotation.z = (overrides['rotationDegrees.z'] * Math.PI) / 180;
          }
        }

        if (obj.scale) {
          if (overrides['scale.x'] !== undefined) obj.scale.x = overrides['scale.x'];
          if (overrides['scale.y'] !== undefined) obj.scale.y = overrides['scale.y'];
          if (overrides['scale.z'] !== undefined) obj.scale.z = overrides['scale.z'];
        }

        if (overrides['light.intensity'] !== undefined && 'intensity' in obj) {
          obj.intensity = overrides['light.intensity'];
        }
        if (overrides['light.color'] !== undefined && obj.color) {
          hexToColor(obj.color, overrides['light.color']);
        }
        if (overrides['visible'] !== undefined) {
          obj.visible = overrides['visible'];
        }

        if (typeof obj.updateMatrix === 'function') obj.updateMatrix();
        if (typeof obj.updateMatrixWorld === 'function') obj.updateMatrixWorld(true);
        if (obj.isCamera && typeof obj.updateProjectionMatrix === 'function') {
          obj.updateProjectionMatrix();
        }
      } catch (e) {}
    }
  }

  function emitDetection() {
    try {
      const version = (window as any).__THREE__ || (window as any).THREE?.REVISION || 'detected';
      emit('THREE_DETECTED', {
        version: String(version),
        scenesCount: registeredScenes.size,
        renderersCount: registeredRenderers.size
      });
    } catch (e) {}
  }

  function serializeNode(node: any, depth = 0): SerializedNode | null {
    if (!node || !node.isObject3D) return null;
    if (node.name && node.name.startsWith('__THREE_INSPECTOR_')) return null;

    uuidToObjectMap.set(node.uuid, node);

    const children: SerializedNode[] = [];
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const serialized = serializeNode(child, depth + 1);
        if (serialized) {
          children.push(serialized);
        }
      }
    }

    return {
      id: node.id,
      uuid: node.uuid,
      name: node.name || (node.type ? `${node.type} (${node.id})` : `Object3D (${node.id})`),
      type: node.type || 'Object3D',
      visible: node.visible !== false,
      childrenCount: children.length,
      children
    };
  }

  function extractCategorizedData(): CategorizedSceneData {
    const meshes: CategoryMeshItem[] = [];
    const lights: CategoryLightItem[] = [];
    const cameras: CategoryCameraItem[] = [];
    const materialMap = new Map<string, CategoryMaterialItem>();
    const textureMap = new Map<string, CategoryTextureItem>();
    const geometryMap = new Map<string, CategoryGeometryItem>();

    for (const scene of registeredScenes) {
      try {
        scene.traverse((obj: any) => {
          if (!obj || !obj.isObject3D || (obj.name && obj.name.startsWith('__THREE_INSPECTOR_'))) return;

          if (obj.isMesh || obj.isInstancedMesh) {
            let verticesCount = 0;
            let facesCount = 0;
            let geoType = 'None';
            let matType = 'None';
            let matColor: string | undefined;

            if (obj.geometry) {
              geoType = obj.geometry.type || 'BufferGeometry';
              if (obj.geometry.attributes?.position) {
                verticesCount = obj.geometry.attributes.position.count;
              }
              if (obj.geometry.index) {
                facesCount = Math.floor(obj.geometry.index.count / 3);
              } else if (verticesCount > 0) {
                facesCount = Math.floor(verticesCount / 3);
              }

              const geoUuid = obj.geometry.uuid || `geo-${obj.id}`;
              const memBytes = MemoryAuditor.calculateGeometryBytes(obj.geometry);
              if (!geometryMap.has(geoUuid)) {
                geometryMap.set(geoUuid, {
                  uuid: geoUuid,
                  name: obj.geometry.name || geoType,
                  type: geoType,
                  verticesCount,
                  facesCount,
                  memoryBytes: memBytes,
                  linkedObjectUuids: [obj.uuid]
                });
              } else {
                geometryMap.get(geoUuid)!.linkedObjectUuids.push(obj.uuid);
              }
            }

            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              matType = mats.map((m: any) => m.type || 'Material').join(', ');
              if (mats[0]?.color) {
                matColor = colorToHex(mats[0].color);
              }

              mats.forEach((m: any) => {
                const matUuid = m.uuid || `mat-${obj.id}`;
                if (!materialMap.has(matUuid)) {
                  materialMap.set(matUuid, {
                    uuid: matUuid,
                    name: m.name || m.type || 'Material',
                    type: m.type || 'Material',
                    color: m.color ? colorToHex(m.color) : undefined,
                    wireframe: Boolean(m.wireframe),
                    transparent: Boolean(m.transparent),
                    opacity: typeof m.opacity === 'number' ? m.opacity : 1,
                    linkedObjectUuids: [obj.uuid]
                  });
                } else {
                  materialMap.get(matUuid)!.linkedObjectUuids.push(obj.uuid);
                }

                const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'envMap'];
                slots.forEach((slot) => {
                  const tex = m[slot];
                  if (tex && tex.isTexture) {
                    const texUuid = tex.uuid || `tex-${slot}-${matUuid}`;
                    const memBytes = MemoryAuditor.calculateTextureBytes(tex);
                    if (!textureMap.has(texUuid)) {
                      textureMap.set(texUuid, {
                        uuid: texUuid,
                        name: tex.name || `${m.name || 'Material'} ${slot}`,
                        type: slot,
                        width: tex.image?.width,
                        height: tex.image?.height,
                        format: tex.format ? String(tex.format) : undefined,
                        mapping: tex.mapping ? String(tex.mapping) : undefined,
                        dataUrl: ExporterManager.getTextureThumbnail(tex),
                        memoryBytes: memBytes,
                        linkedObjectUuids: [obj.uuid]
                      });
                    } else {
                      textureMap.get(texUuid)!.linkedObjectUuids.push(obj.uuid);
                    }
                  }
                });
              });
            }

            meshes.push({
              id: obj.id,
              uuid: obj.uuid,
              name: obj.name || (obj.type ? `${obj.type} (${obj.id})` : `Mesh (${obj.id})`),
              type: obj.type || 'Mesh',
              geometryType: geoType,
              materialType: matType,
              materialColor: matColor,
              verticesCount,
              facesCount,
              visible: obj.visible !== false
            });
          }

          if (obj.isLight || obj.type?.includes('Light') || 'intensity' in obj) {
            lights.push({
              id: obj.id,
              uuid: obj.uuid,
              name: obj.name || (obj.type ? `${obj.type} (${obj.id})` : `Light (${obj.id})`),
              type: obj.type || 'Light',
              color: colorToHex(obj.color),
              intensity: typeof obj.intensity === 'number' ? obj.intensity : 1,
              visible: obj.visible !== false
            });
          }

          if (obj.isCamera && !obj.__isInspectorCamera) {
            cameras.push({
              id: obj.id,
              uuid: obj.uuid,
              name: obj.name || `Camera (${obj.id})`,
              type: obj.type || 'Camera',
              fov: obj.fov,
              visible: obj.visible !== false
            });
          }
        });
      } catch (e) {}
    }

    return {
      meshes,
      lights,
      cameras,
      materials: Array.from(materialMap.values()),
      textures: Array.from(textureMap.values()),
      geometries: Array.from(geometryMap.values())
    };
  }

  function emitSceneGraph() {
    try {
      const scenes: SerializedNode[] = [];
      for (const scene of registeredScenes) {
        const serialized = serializeNode(scene);
        if (serialized) {
          scenes.push(serialized);
        }
      }
      emit('SCENE_GRAPH_DATA', { scenes });
      emit('CATEGORIZED_DATA', extractCategorizedData());
    } catch (e) {}
  }

  function extractMaterialInfo(mat: any): MaterialInfo {
    const textureSlots: TextureSlotInfo[] = [];
    const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'envMap'];
    slots.forEach((s) => {
      const tex = mat[s];
      if (tex && tex.isTexture) {
        textureSlots.push({
          slot: s,
          uuid: tex.uuid,
          name: tex.name || s,
          dataUrl: ExporterManager.getTextureThumbnail(tex),
          width: tex.image?.width,
          height: tex.image?.height,
          format: tex.format ? String(tex.format) : undefined,
          memoryBytes: MemoryAuditor.calculateTextureBytes(tex)
        });
      }
    });

    return {
      uuid: mat.uuid || '',
      name: mat.name || mat.type || 'Material',
      type: mat.type || 'Material',
      color: mat.color ? colorToHex(mat.color) : undefined,
      emissive: mat.emissive ? colorToHex(mat.emissive) : undefined,
      roughness: typeof mat.roughness === 'number' ? mat.roughness : undefined,
      metalness: typeof mat.metalness === 'number' ? mat.metalness : undefined,
      opacity: typeof mat.opacity === 'number' ? mat.opacity : 1,
      transparent: Boolean(mat.transparent),
      wireframe: Boolean(mat.wireframe),
      visible: mat.visible !== false,
      depthTest: mat.depthTest !== false,
      depthWrite: mat.depthWrite !== false,
      textures: textureSlots,
      isShaderMaterial: Boolean(mat.isShaderMaterial || mat.vertexShader || mat.fragmentShader),
      vertexShader: mat.vertexShader,
      fragmentShader: mat.fragmentShader
    };
  }

  function extractObjectDetails(obj: any): ObjectDetails | null {
    if (!obj) return null;

    try {
      const rotDeg = obj.rotation ? {
        x: +(obj.rotation.x * (180 / Math.PI)).toFixed(2),
        y: +(obj.rotation.y * (180 / Math.PI)).toFixed(2),
        z: +(obj.rotation.z * (180 / Math.PI)).toFixed(2)
      } : { x: 0, y: 0, z: 0 };

      let geometry: GeometryInfo | null = null;
      if (obj.geometry) {
        const geo = obj.geometry;
        let verticesCount = 0;
        let facesCount = 0;

        if (geo.attributes?.position) {
          verticesCount = geo.attributes.position.count;
        }
        if (geo.index) {
          facesCount = geo.index.count / 3;
        } else if (verticesCount > 0) {
          facesCount = verticesCount / 3;
        }

        geometry = {
          uuid: geo.uuid || '',
          type: geo.type || 'BufferGeometry',
          verticesCount,
          facesCount: Math.floor(facesCount),
          hasNormals: Boolean(geo.attributes?.normal),
          hasUVs: Boolean(geo.attributes?.uv),
          hasColors: Boolean(geo.attributes?.color),
          parameters: geo.parameters || undefined,
          memoryBytes: MemoryAuditor.calculateGeometryBytes(geo)
        };
      }

      let material: MaterialInfo | MaterialInfo[] | null = null;
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          material = obj.material.map(extractMaterialInfo);
        } else {
          material = extractMaterialInfo(obj.material);
        }
      }

      let light: LightInfo | null = null;
      if (obj.isLight || obj.type?.includes('Light') || 'intensity' in obj) {
        light = {
          color: colorToHex(obj.color),
          intensity: typeof obj.intensity === 'number' ? obj.intensity : 1,
          distance: obj.distance,
          decay: obj.decay,
          angle: obj.angle,
          penumbra: obj.penumbra,
          groundColor: obj.groundColor ? colorToHex(obj.groundColor) : undefined
        };
      }

      let camera: CameraInfo | null = null;
      if (obj.isCamera && !obj.__isInspectorCamera) {
        camera = {
          fov: obj.fov,
          near: obj.near ?? 0.1,
          far: obj.far ?? 1000,
          zoom: obj.zoom ?? 1,
          aspect: obj.aspect
        };
      }

      return {
        id: obj.id,
        uuid: obj.uuid,
        name: obj.name || (obj.type ? `${obj.type} (${obj.id})` : `Object3D (${obj.id})`),
        type: obj.type || 'Object3D',
        visible: obj.visible !== false,
        castShadow: Boolean(obj.castShadow),
        receiveShadow: Boolean(obj.receiveShadow),
        frustumCulled: obj.frustumCulled !== false,
        renderOrder: obj.renderOrder || 0,
        position: obj.position ? {
          x: +obj.position.x.toFixed(3),
          y: +obj.position.y.toFixed(3),
          z: +obj.position.z.toFixed(3)
        } : { x: 0, y: 0, z: 0 },
        rotation: obj.rotation ? {
          x: +obj.rotation.x.toFixed(4),
          y: +obj.rotation.y.toFixed(4),
          z: +obj.rotation.z.toFixed(4)
        } : { x: 0, y: 0, z: 0 },
        rotationDegrees: rotDeg,
        scale: obj.scale ? {
          x: +obj.scale.x.toFixed(3),
          y: +obj.scale.y.toFixed(3),
          z: +obj.scale.z.toFixed(3)
        } : { x: 1, y: 1, z: 1 },
        geometry,
        material,
        light,
        camera,
        userData: obj.userData || {}
      };
    } catch (e) {
      return null;
    }
  }

  function setHighlight(uuid: string | null) {
    if (currentHighlightHelper) {
      if (currentHighlightHelper.parent) {
        currentHighlightHelper.parent.remove(currentHighlightHelper);
      }
      if (typeof currentHighlightHelper.dispose === 'function') {
        currentHighlightHelper.dispose();
      }
      currentHighlightHelper = null;
      currentHighlightTarget = null;
    }

    if (!uuid) {
      gizmoManager.detach();
      return;
    }

    const target = findObjectByUuid(uuid);
    if (!target) {
      gizmoManager.detach();
      return;
    }

    const cam = getActiveCamera();
    const canvas = getActiveCanvas();
    const scene = getActiveScene();
    if (cam && canvas && scene) {
      gizmoManager.attach(target, cam, canvas, scene);
    }

    try {
      let helper: any = null;

      if ((target.isMesh || target.isInstancedMesh) && target.geometry) {
        helper = new BoxHelper(target, 0x00ffff);
        helper.material.depthTest = false;
        helper.material.transparent = true;
        helper.material.opacity = 0.9;
        helper.renderOrder = 999999;
      } else {
        const worldPos = new Vector3();
        if (typeof target.getWorldPosition === 'function') {
          target.getWorldPosition(worldPos);
        } else if (target.position) {
          worldPos.copy(target.position);
        }

        const box = new Box3();
        box.setFromCenterAndSize(worldPos, new Vector3(1.2, 1.2, 1.2));
        const colorHex = (target.isLight || target.type?.includes('Light'))
          ? 0xffea00
          : target.isCamera
          ? 0xff3b30
          : 0x00ffcc;
        helper = new Box3Helper(box, new Color(colorHex));
        helper.material.depthTest = false;
        helper.material.transparent = true;
        helper.material.opacity = 0.95;
        helper.renderOrder = 999999;
      }

      helper.name = '__THREE_INSPECTOR_HELPER__';

      let rootScene = Array.from(registeredScenes)[0];
      let p = target;
      while (p) {
        if (p.isScene || registeredScenes.has(p)) {
          rootScene = p;
          break;
        }
        p = p.parent;
      }

      if (rootScene) {
        rootScene.add(helper);
        currentHighlightHelper = helper;
        currentHighlightTarget = target;
      }
    } catch (e) {
      console.warn('[Three.js Inspector] Failed to create highlight helper:', e);
    }
  }

  function updateObjectProperty(payload: UpdatePropertyPayload) {
    try {
      const { uuid, path, value } = payload;
      const obj = findObjectByUuid(uuid);
      if (!obj) return;

      const [rootProp, subProp] = path;

      if (rootProp === 'position' && subProp && obj.position) {
        pinProperty(obj, `position.${subProp}`, Number(value));
        obj.position[subProp] = Number(value);
        obj.matrixAutoUpdate = true;
        obj.matrixWorldNeedsUpdate = true;
        if (typeof obj.updateMatrix === 'function') obj.updateMatrix();
        if (typeof obj.updateMatrixWorld === 'function') obj.updateMatrixWorld(true);
        if (obj.isCamera && typeof obj.updateProjectionMatrix === 'function') obj.updateProjectionMatrix();
      } else if (rootProp === 'rotationDegrees' && subProp && obj.rotation) {
        pinProperty(obj, `rotationDegrees.${subProp}`, Number(value));
        obj.rotation[subProp] = (Number(value) * Math.PI) / 180;
        obj.matrixAutoUpdate = true;
        obj.matrixWorldNeedsUpdate = true;
        if (typeof obj.updateMatrix === 'function') obj.updateMatrix();
        if (typeof obj.updateMatrixWorld === 'function') obj.updateMatrixWorld(true);
        if (obj.isCamera && typeof obj.updateProjectionMatrix === 'function') obj.updateProjectionMatrix();
      } else if (rootProp === 'scale' && subProp && obj.scale) {
        pinProperty(obj, `scale.${subProp}`, Number(value));
        obj.scale[subProp] = Number(value);
        obj.matrixAutoUpdate = true;
        obj.matrixWorldNeedsUpdate = true;
        if (typeof obj.updateMatrix === 'function') obj.updateMatrix();
        if (typeof obj.updateMatrixWorld === 'function') obj.updateMatrixWorld(true);
      } else if (rootProp === 'visible') {
        pinProperty(obj, 'visible', Boolean(value));
        obj.visible = Boolean(value);
      } else if (rootProp === 'castShadow') {
        obj.castShadow = Boolean(value);
      } else if (rootProp === 'receiveShadow') {
        obj.receiveShadow = Boolean(value);
      } else if (rootProp === 'wireframeSubtree') {
        obj.traverse((child: any) => {
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m: any) => {
              m.wireframe = Boolean(value);
              m.needsUpdate = true;
            });
          }
        });
      } else if (rootProp === 'material' && obj.material) {
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        if (subProp === 'color') {
          hexToColor(mat.color, value);
        } else if (subProp === 'wireframe') {
          mat.wireframe = Boolean(value);
        } else if (subProp === 'opacity') {
          mat.opacity = Number(value);
          if (mat.opacity < 1) mat.transparent = true;
        } else if (subProp === 'roughness') {
          mat.roughness = Number(value);
        } else if (subProp === 'metalness') {
          mat.metalness = Number(value);
        } else if (subProp === 'visible') {
          mat.visible = Boolean(value);
        } else if (subProp === 'vertexShader') {
          mat.vertexShader = String(value);
        } else if (subProp === 'fragmentShader') {
          mat.fragmentShader = String(value);
        }
        mat.needsUpdate = true;
      } else if (rootProp === 'light' || obj.isLight || obj.type?.includes('Light') || 'intensity' in obj) {
        if (subProp === 'color') {
          pinProperty(obj, 'light.color', value);
          hexToColor(obj.color, value);
        } else if (subProp === 'intensity') {
          pinProperty(obj, 'light.intensity', Number(value));
          obj.intensity = Number(value);
          obj.visible = true;
        } else if (subProp === 'distance') {
          obj.distance = Number(value);
        } else if (subProp === 'decay') {
          obj.decay = Number(value);
        }
      } else if (rootProp === 'camera' && obj.isCamera) {
        if (subProp === 'fov') {
          obj.fov = Number(value);
          obj.updateProjectionMatrix?.();
        } else if (subProp === 'near') {
          obj.near = Number(value);
          obj.updateProjectionMatrix?.();
        } else if (subProp === 'far') {
          obj.far = Number(value);
          obj.updateProjectionMatrix?.();
        } else if (subProp === 'zoom') {
          obj.zoom = Number(value);
          obj.updateProjectionMatrix?.();
        }
      }

      if (currentHighlightHelper && typeof currentHighlightHelper.update === 'function') {
        currentHighlightHelper.update();
      }

      const updatedDetails = extractObjectDetails(obj);
      if (updatedDetails) {
        emit('OBJECT_DETAILS_DATA', updatedDetails);
      }
    } catch (e) {}
  }

  function toggleWireframe(enabled: boolean) {
    try {
      isWireframeActive = enabled;
      for (const scene of registeredScenes) {
        scene.overrideMaterial = enabled ? overrideWireframe : null;
        scene.traverse((node: any) => {
          if (node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((m: any) => {
              if (node.__origWireframe === undefined) {
                node.__origWireframe = Boolean(m.wireframe);
              }
              m.wireframe = enabled ? true : node.__origWireframe;
              m.needsUpdate = true;
            });
          }
        });
      }
    } catch (e) {}
  }

  function inspectInConsole(uuid: string) {
    const obj = findObjectByUuid(uuid);
    if (!obj) return;
    try {
      (window as any).$three = obj;
      (window as any).$selected = obj;
    } catch (e) {}
    console.log(
      '%c[Three.js Inspector]%c Selected object assigned to %c$three%c and %c$selected%c:',
      'background: #38bdf8; color: #000; padding: 2px 4px; border-radius: 3px; font-weight: bold;',
      'color: inherit;',
      'color: #10b981; font-weight: bold;',
      'color: inherit;',
      'color: #10b981; font-weight: bold;',
      'color: inherit;',
      obj
    );
  }

  function tickRender(renderer: any) {
    try {
      frameCount++;
      const now = performance.now();

      if (now - lastTime >= 1000) {
        currentFps = Math.round((frameCount * 1000) / (now - lastTime));
        frameCount = 0;
        lastTime = now;
      }

      if (now - lastStatsEmit > 500) {
        lastStatsEmit = now;
        const info = renderer.info || {};
        const render = info.render || {};
        const memory = info.memory || {};

        const stats: RendererStats = {
          fps: currentFps,
          frameTime: +(1000 / (currentFps || 60)).toFixed(1),
          calls: render.calls || 0,
          triangles: render.triangles || 0,
          points: render.points || 0,
          lines: render.lines || 0,
          geometries: memory.geometries || 0,
          textures: memory.textures || 0,
          programs: info.programs?.length || 0
        };
        emit('STATS_UPDATE', stats);
      }

      if (currentHighlightHelper && currentHighlightTarget) {
        if (typeof currentHighlightHelper.update === 'function') {
          currentHighlightHelper.update();
        } else if (currentHighlightHelper.box) {
          const worldPos = new Vector3();
          if (typeof currentHighlightTarget.getWorldPosition === 'function') {
            currentHighlightTarget.getWorldPosition(worldPos);
          } else if (currentHighlightTarget.position) {
            worldPos.copy(currentHighlightTarget.position);
          }
          currentHighlightHelper.box.setFromCenterAndSize(worldPos, new Vector3(1.2, 1.2, 1.2));
        }
      }
    } catch (e) {}
  }

  // Unified single hook on WebGLRenderer
  function hookRendererPrototype() {
    const THREE = (window as any).THREE;
    if (THREE && THREE.WebGLRenderer && !THREE.WebGLRenderer.__INSPECTOR_HOOKED__) {
      THREE.WebGLRenderer.__INSPECTOR_HOOKED__ = true;
      const originalRender = THREE.WebGLRenderer.prototype.render;

      THREE.WebGLRenderer.prototype.render = function (scene: any, camera: any) {
        registerRenderer(this);
        if (scene) registerScene(scene);
        if (camera && !camera.__isInspectorCamera) lastActiveCamera = camera;

        if (simulationPaused && !stepOneFrame) {
          return;
        }
        if (stepOneFrame) {
          stepOneFrame = false;
        }

        let renderCam = camera;
        try {
          if (debugCameraManager.isEnabled()) {
            renderCam = debugCameraManager.getCamera(camera);
            debugCameraManager.update();
          }
        } catch (e) {}

        try {
          gizmoManager.updateCamera(renderCam);
        } catch (e) {}

        try {
          applyPinnedOverrides();
        } catch (e) {}

        try {
          if (scene) {
            if (isWireframeActive) {
              scene.overrideMaterial = overrideWireframe;
            } else if (scene.overrideMaterial === overrideWireframe) {
              scene.overrideMaterial = null;
            }
          }
        } catch (e) {}

        try {
          tickRender(this);
        } catch (e) {}

        return originalRender.call(this, scene, renderCam);
      };

      emitDetection();
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== MESSAGE_SOURCE.CONTENT) {
      return;
    }

    const { action, payload } = event.data as InspectorMessage;

    switch (action) {
      case 'PING':
        emitDetection();
        break;

      case 'REQUEST_SCENE_GRAPH':
        for (const scene of registeredScenes) {
          indexSceneObjects(scene);
        }
        emitSceneGraph();
        break;

      case 'REQUEST_MEMORY_AUDIT':
        emit('MEMORY_AUDIT_DATA', MemoryAuditor.audit(registeredScenes, allKnownGeometries, allKnownTextures));
        break;

      case 'REQUEST_ANIMATIONS':
        animationManager.scanScenesForMixers(registeredScenes);
        emit('ANIMATION_DATA', animationManager.getMixersData());
        break;

      case 'SELECT_OBJECT':
        if (payload?.uuid) {
          activeSelectedUuid = payload.uuid;
          const obj = findObjectByUuid(payload.uuid);
          if (obj) {
            setHighlight(payload.uuid);
            const details = extractObjectDetails(obj);
            if (details) emit('OBJECT_DETAILS_DATA', details);
          }
        }
        break;

      case 'HIGHLIGHT_OBJECT':
        setHighlight(payload?.uuid || activeSelectedUuid);
        break;

      case 'UPDATE_PROPERTY':
        if (payload) updateObjectProperty(payload);
        break;

      case 'RESET_PROPERTY_OVERRIDES':
        if (payload?.uuid) unpinObjectProperties(payload.uuid);
        break;

      case 'INSPECT_IN_CONSOLE':
        if (payload?.uuid) inspectInConsole(payload.uuid);
        break;

      case 'TOGGLE_WIREFRAME':
        if (typeof payload?.enabled === 'boolean') toggleWireframe(payload.enabled);
        break;

      case 'SET_GIZMO_MODE':
        if (payload?.mode) gizmoManager.setMode(payload.mode);
        break;

      case 'FOCUS_OBJECT':
        if (payload?.uuid) {
          const obj = findObjectByUuid(payload.uuid);
          const cam = getActiveCamera();
          if (obj && cam) {
            const isNowFocused = gizmoManager.toggleFocus(obj, cam);
            emit('FOCUS_STATE_CHANGED', { isFocused: isNowFocused });
          }
        }
        break;

      case 'TOGGLE_PAUSE_SCENE':
        simulationPaused = Boolean(payload?.enabled);
        break;

      case 'STEP_SIMULATION_FRAME':
        stepOneFrame = true;
        break;

      case 'CONTROL_ANIMATION':
        if (payload) {
          animationManager.control(payload.mixerId, payload.clipName, payload.action, payload.value);
        }
        break;

      case 'DISPOSE_RESOURCE':
        if (payload?.uuid && payload?.type) {
          if (payload.type === 'geometry') {
            const geo = allKnownGeometries.get(payload.uuid);
            if (geo && typeof geo.dispose === 'function') {
              geo.dispose();
              allKnownGeometries.delete(payload.uuid);
            }
          } else if (payload.type === 'texture') {
            const tex = allKnownTextures.get(payload.uuid);
            if (tex && typeof tex.dispose === 'function') {
              tex.dispose();
              allKnownTextures.delete(payload.uuid);
            }
          }
          emit('MEMORY_AUDIT_DATA', MemoryAuditor.audit(registeredScenes, allKnownGeometries, allKnownTextures));
        }
        break;
    }
  });

  function setupDevToolsHook() {
    try {
      let devtools = (window as any).__THREE_DEVTOOLS__;

      if (!devtools) {
        devtools = typeof EventTarget !== 'undefined' ? new EventTarget() : {};
        try {
          Object.defineProperty(window, '__THREE_DEVTOOLS__', {
            value: devtools,
            writable: true,
            configurable: true,
            enumerable: false
          });
        } catch {
          try {
            (window as any).__THREE_DEVTOOLS__ = devtools;
          } catch {}
        }
      }

      if (devtools && typeof devtools.addEventListener === 'function') {
        devtools.addEventListener('observe', (event: any) => {
          const detail = event?.detail;
          if (!detail) return;
          if (detail.isScene || (detail.isObject3D && detail.children)) {
            registerScene(detail);
          }
          if (detail.render && (detail.domElement || detail.capabilities)) {
            registerRenderer(detail);
          }
        });

        devtools.addEventListener('register', (event: any) => {
          const detail = event?.detail;
          if (detail?.revision) {
            (window as any).__THREE__ = detail.revision;
            emitDetection();
          }
        });
      }

      try {
        (window as any).__THREE_INSPECTOR__ = {
          registerScene,
          registerRenderer,
          updateProperty: (uuid: string, path: string[], value: any) => {
            updateObjectProperty({ uuid, path, value });
          },
          unpinObjectProperties,
          toggleWireframe,
          isWireframeActive: () => isWireframeActive,
          setGizmoMode: (mode: GizmoMode) => gizmoManager.setMode(mode),
          getGizmoMode: () => gizmoManager.getMode(),
          toggleFocus: (uuid: string) => {
            const obj = findObjectByUuid(uuid);
            const cam = getActiveCamera();
            if (obj && cam) {
              const isNowFocused = gizmoManager.toggleFocus(obj, cam);
              return isNowFocused;
            }
            return false;
          },
          revertFocus: () => {
            const cam = getActiveCamera();
            if (cam) {
              return gizmoManager.revertFocus(cam);
            }
            return false;
          },
          isFocused: (uuid?: string) => gizmoManager.isFocused(uuid),
          toggleDebugCamera: () => {
            const canvas = getActiveCanvas();
            if (canvas) {
              if (debugCameraManager.isEnabled()) {
                debugCameraManager.disable();
              } else {
                debugCameraManager.enable(canvas, lastActiveCamera);
              }
            }
            return debugCameraManager.isEnabled();
          },
          isDebugCameraActive: () => debugCameraManager.isEnabled(),
          togglePauseSimulation: (enable?: boolean) => {
            simulationPaused = enable !== undefined ? enable : !simulationPaused;
            return simulationPaused;
          },
          stepSimulationFrame: () => {
            stepOneFrame = true;
          },
          downloadTexture: (uuid: string) => {
            const tex = allKnownTextures.get(uuid);
            if (tex) ExporterManager.downloadTexture(tex);
          },
          getMemoryAudit: () => MemoryAuditor.audit(registeredScenes, allKnownGeometries, allKnownTextures),
          disposeResource: (uuid: string, type: 'geometry' | 'texture') => {
            if (type === 'geometry') {
              const geo = allKnownGeometries.get(uuid);
              if (geo) {
                geo.dispose?.();
                allKnownGeometries.delete(uuid);
              }
            } else {
              const tex = allKnownTextures.get(uuid);
              if (tex) {
                tex.dispose?.();
                allKnownTextures.delete(uuid);
              }
            }
          },
          getAnimations: () => {
            animationManager.scanScenesForMixers(registeredScenes);
            return animationManager.getMixersData();
          },
          controlAnimation: (mixerId: string, clipName: string, action: any, value?: number) => {
            animationManager.control(mixerId, clipName, action, value);
          },
          selectObject: (uuid: string) => {
            activeSelectedUuid = uuid;
            const obj = findObjectByUuid(uuid);
            if (obj) {
              setHighlight(uuid);
              return extractObjectDetails(obj);
            }
            return null;
          },
          setHighlight,
          getScenes: () => Array.from(registeredScenes),
          getRenderers: () => Array.from(registeredRenderers),
          refresh: () => {
            emitDetection();
            emitSceneGraph();
          }
        };
      } catch {}
    } catch (e) {}
  }

  setupDevToolsHook();
  hookRendererPrototype();

  let checkCount = 0;
  const interval = setInterval(() => {
    checkCount++;
    hookRendererPrototype();

    if ((window as any).scene && (window as any).scene.isObject3D) {
      registerScene((window as any).scene);
    }
    if ((window as any).renderer && (window as any).renderer.render) {
      registerRenderer((window as any).renderer);
    }

    if (checkCount > 30 && registeredScenes.size > 0 && registeredRenderers.size > 0) {
      clearInterval(interval);
    }
  }, 400);

  const origGetContext = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as any).getContext = function (type: string, ...args: any[]) {
    const ctx = origGetContext.apply(this, [type, ...args] as any);
    if (type === 'webgl' || type === 'webgl2') {
      setTimeout(() => hookRendererPrototype(), 100);
    }
    return ctx;
  };

  emitDetection();
})();
