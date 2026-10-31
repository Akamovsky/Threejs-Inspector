import {
  BoxHelper,
  Box3,
  Box3Helper,
  Vector3,
  Color,
  MeshBasicMaterial,
  Matrix4
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

  // Polyfill Matrix4.prototype.determinantAffine across Three.js bundles (r185+ compatibility)
  function ensureDeterminantAffine(proto: any) {
    try {
      if (proto && !proto.determinantAffine) {
        proto.determinantAffine = function () {
          const te = this.elements;
          if (!te) return 1;
          const m11 = te[0], m12 = te[4], m13 = te[8];
          const m21 = te[1], m22 = te[5], m23 = te[9];
          const m31 = te[2], m32 = te[6], m33 = te[10];
          return m11 * (m22 * m33 - m23 * m32) -
            m12 * (m21 * m33 - m23 * m31) +
            m13 * (m21 * m32 - m22 * m31);
        };
      }
    } catch (e) {}
  }
  if (typeof Matrix4 !== 'undefined') {
    ensureDeterminantAffine(Matrix4.prototype);
  }

  // Ensure any geometry in host scenes (or extension helpers) has a valid drawRange
  function ensureDrawRange(geo: any) {
    if (!geo) return;
    try {
      if (!geo.drawRange) {
        geo.drawRange = { start: 0, count: Infinity };
      } else if (typeof geo.drawRange.count !== 'number') {
        geo.drawRange.count = Infinity;
      }
    } catch (e) {}
  }
  // and polyfills onBuild / onBeforeCompile so different Three.js versions never crash WebGLPrograms
  function createHelperMaterial(colorHex: number, opacity = 0.8) {
    const THREE = (window as any).THREE;
    let mat: any;
    if (THREE && THREE.LineBasicMaterial) {
      try {
        mat = new THREE.LineBasicMaterial({ color: colorHex, depthTest: false, transparent: true, opacity });
      } catch (e) {}
    }
    if (!mat) {
      mat = new MeshBasicMaterial({ color: colorHex, depthTest: false, transparent: true, opacity, wireframe: true });
    }
    // Polyfill onBuild / onBeforeCompile on the material instance
    if (!mat.onBuild) {
      mat.onBuild = function () {};
    }
    if (!mat.onBeforeCompile) {
      mat.onBeforeCompile = function () {};
    }
    return mat;
  }

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
  let selectedHighlightHelper: any = null;
  let selectedHighlightTarget: any = null;
  let hoverHelper: any = null;
  let activeSelectedUuid: string | null = null;
  let lastActiveCamera: any = null;

  // Wireframe override state
  let isWireframeActive = false;
  const overrideWireframe = new MeshBasicMaterial({ wireframe: true, color: 0x38bdf8 });
  if (!(overrideWireframe as any).onBuild) (overrideWireframe as any).onBuild = function () {};
  if (!overrideWireframe.onBeforeCompile) overrideWireframe.onBeforeCompile = function () {};

  // Persistent property overrides (e.g. for light intensity)
  const pinnedOverrides = new Map<string, Record<string, any>>();

  // Escape key reverts camera focus
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && debugCameraManager.isFocusActive()) {
      debugCameraManager.revertFocus();
      emit('FOCUS_STATE_CHANGED', { isFocused: false });
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
      if (obj.position) {
        pinProperty(obj, 'position.x', obj.position.x);
        pinProperty(obj, 'position.y', obj.position.y);
        pinProperty(obj, 'position.z', obj.position.z);
      }
      if (obj.rotation) {
        pinProperty(obj, 'rotation.x', obj.rotation.x);
        pinProperty(obj, 'rotation.y', obj.rotation.y);
        pinProperty(obj, 'rotation.z', obj.rotation.z);
      }
      if (obj.scale) {
        pinProperty(obj, 'scale.x', obj.scale.x);
        pinProperty(obj, 'scale.y', obj.scale.y);
        pinProperty(obj, 'scale.z', obj.scale.z);
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

  // Check if an object or any of its ancestors is an internal inspector/helper object
  function isInternalInspectorObject(obj: any): boolean {
    if (!obj) return true;
    let p = obj;
    while (p) {
      if (p.name && p.name.startsWith('__THREE_INSPECTOR_')) return true;
      if (p.__isInspectorObject) return true;
      if (p.isTransformControls || (p.type && p.type.includes('TransformControls'))) return true;
      p = p.parent;
    }
    return false;
  }

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
        if (currentVal > 0) {
          obj.visible = true;
          overrides['visible'] = true;
        }
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
        if (
          debugCameraManager.isEnabled() ||
          gizmoManager.isDragging() ||
          gizmoManager.getMode() !== 'none'
        ) {
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

    if (typeof Element !== 'undefined') {
      patchObj(Element.prototype);
      if (Element.prototype.setPointerCapture && !(Element.prototype as any).__INSPECTOR_PC_HOOKED__) {
        (Element.prototype as any).__INSPECTOR_PC_HOOKED__ = true;
        const origPC = Element.prototype.setPointerCapture;
        Element.prototype.setPointerCapture = function (pointerId: number) {
          if (
            gizmoManager.isDragging() ||
            (gizmoManager.getMode() !== 'none' && gizmoManager.transformControls?.axis !== null)
          ) {
            return;
          }
          return origPC.call(this, pointerId);
        };
      }
    }
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
    if (!uuid) return null;
    if (uuidToObjectMap.has(uuid)) {
      return uuidToObjectMap.get(uuid);
    }
    for (const scene of registeredScenes) {
      if (!scene) continue;
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
    if (lastActiveCamera) {
      try {
        lastActiveCamera.traverse((o: any) => {
          if (o && o.uuid) {
            uuidToObjectMap.set(o.uuid, o);
          }
        });
        if (uuidToObjectMap.has(uuid)) return uuidToObjectMap.get(uuid);
      } catch (e) {}
    }
    return null;
  }

  function getActiveCamera(): any {
    if (debugCameraManager.isEnabled()) {
      return debugCameraManager.getCamera(lastActiveCamera);
    }
    if (lastActiveCamera) return lastActiveCamera;

    for (const scene of registeredScenes) {
      let cam: any = null;
      try {
        scene.traverse((o: any) => {
          if (o && o.isCamera && !isInternalInspectorObject(o) && !cam) cam = o;
        });
      } catch (e) {}
      if (cam) return cam;
    }
    return null;
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

  function getObjectScene(obj: any): any {
    let p = obj;
    while (p) {
      if (p.isScene || registeredScenes.has(p)) return p;
      p = p.parent;
    }
    return getActiveScene();
  }

  // Only real THREE.Scene instances are ever registered
  function registerScene(scene: any) {
    if (!scene || !scene.isScene) return;
    if (isInternalInspectorObject(scene)) return;
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
        if (!obj || isInternalInspectorObject(obj)) return;
        if (obj.uuid) {
          uuidToObjectMap.set(obj.uuid, obj);
        }
        if (obj.geometry && obj.geometry.uuid && !isInternalInspectorObject(obj.geometry)) {
          allKnownGeometries.set(obj.geometry.uuid, obj.geometry);
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => {
            if (isInternalInspectorObject(m)) return;
            const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'envMap'];
            slots.forEach((s) => {
              const tex = m[s];
              if (tex && tex.isTexture && tex.uuid && !isInternalInspectorObject(tex)) {
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
      hookRenderer(renderer);
      emitDetection();
    }
  }

  function handleHookedRender(this: any, originalRender: any, scene: any, camera: any) {
    try {
      // Validate whether this call is a true 3D scene render, or a postprocessing quad pass
      const isMain3DScene = Boolean(scene && (scene.isScene === true || scene.type === 'Scene') && !isInternalInspectorObject(scene));
      const isQuadPass = Boolean(camera && camera.isOrthographicCamera && camera.near === 0 && camera.far === 1);

      // If it is a post-processing pass (e.g. UnrealBloomPass / OutputPass fullscreen quad):
      // NEVER replace camera, NEVER add quad to registeredScenes, NEVER run wireframe!
      if (!isMain3DScene || isQuadPass) {
        return originalRender.call(this, scene, camera);
      }

      // True 3D Scene!
      if (scene?.matrixWorld) {
        ensureDeterminantAffine(Object.getPrototypeOf(scene.matrixWorld));
      }
      registerScene(scene);
      if (camera && !camera.__isInspectorCamera) {
        lastActiveCamera = camera;
      }
      if (!registeredRenderers.has(this)) {
        registeredRenderers.add(this);
      }

      let renderCam = camera;
      if (debugCameraManager.isEnabled()) {
        renderCam = debugCameraManager.getCamera(camera);
        debugCameraManager.update();
      }

      gizmoManager.updateCamera(renderCam);
      gizmoManager.ensureControlsDrawRanges();

      applyPinnedOverrides();

      if (isWireframeActive) {
        scene.overrideMaterial = overrideWireframe;
      } else if (scene.overrideMaterial === overrideWireframe) {
        scene.overrideMaterial = null;
      }

      tickRender(this);

      return originalRender.call(this, scene, renderCam);
    } catch (err) {
      console.warn('[Three.js Inspector] render hook fallback:', err);
    }
  }

  function hookRenderer(renderer: any) {
    if (!renderer || renderer.__INSPECTOR_RENDER_HOOKED__) return;
    renderer.__INSPECTOR_RENDER_HOOKED__ = true;

    // Hook renderer prototype if accessible
    try {
      const proto = renderer.constructor?.prototype;
      if (proto && !proto.__INSPECTOR_RENDER_HOOKED__) {
        proto.__INSPECTOR_RENDER_HOOKED__ = true;
        const protoRender = proto.render;
        proto.render = function (scene: any, camera: any) {
          return handleHookedRender.call(this, protoRender, scene, camera);
        };
      }
    } catch (e) {}

    // Hook instance directly
    const originalRender = renderer.render;
    renderer.render = function (scene: any, camera: any) {
      return handleHookedRender.call(this, originalRender, scene, camera);
    };
  }

  function applyPinnedOverrides() {
    for (const [uuid, overrides] of pinnedOverrides.entries()) {
      try {
        const obj = findObjectByUuid(uuid);
        if (!obj) continue;

        if (overrides['light.intensity'] !== undefined && 'intensity' in obj) {
          obj.intensity = overrides['light.intensity'];
          if (overrides['light.intensity'] > 0) {
            obj.visible = true;
          }
        }
        if (overrides['light.color'] !== undefined && obj.color) {
          hexToColor(obj.color, overrides['light.color']);
        }
        if (overrides['visible'] !== undefined) {
          obj.visible = overrides['visible'];
        }
        if (overrides['position.x'] !== undefined && obj.position) {
          obj.position.x = overrides['position.x'];
        }
        if (overrides['position.y'] !== undefined && obj.position) {
          obj.position.y = overrides['position.y'];
        }
        if (overrides['position.z'] !== undefined && obj.position) {
          obj.position.z = overrides['position.z'];
        }
        if (overrides['rotation.x'] !== undefined && obj.rotation) {
          obj.rotation.x = overrides['rotation.x'];
        }
        if (overrides['rotation.y'] !== undefined && obj.rotation) {
          obj.rotation.y = overrides['rotation.y'];
        }
        if (overrides['rotation.z'] !== undefined && obj.rotation) {
          obj.rotation.z = overrides['rotation.z'];
        }
        if (overrides['scale.x'] !== undefined && obj.scale) {
          obj.scale.x = overrides['scale.x'];
        }
        if (overrides['scale.y'] !== undefined && obj.scale) {
          obj.scale.y = overrides['scale.y'];
        }
        if (overrides['scale.z'] !== undefined && obj.scale) {
          obj.scale.z = overrides['scale.z'];
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

  function getObjectDisplayName(obj: any): string {
    if (!obj) return 'Object';
    if (obj.name && typeof obj.name === 'string' && obj.name.trim().length > 0) {
      return obj.name.trim();
    }
    if (obj.parent && obj.parent.name && typeof obj.parent.name === 'string' && obj.parent.name.trim().length > 0 && !obj.parent.isScene && !isInternalInspectorObject(obj.parent)) {
      return `${obj.parent.name.trim()} / ${obj.type || 'Object'}`;
    }
    if (obj.geometry?.name && typeof obj.geometry.name === 'string' && obj.geometry.name.trim().length > 0) {
      return `${obj.geometry.name.trim()} (${obj.type || 'Mesh'})`;
    }
    return obj.type ? `${obj.type} (${obj.id})` : `Object3D (${obj.id})`;
  }

  function serializeNode(node: any, depth = 0): SerializedNode | null {
    if (!node || !node.isObject3D) return null;
    if (isInternalInspectorObject(node)) return null;

    uuidToObjectMap.set(node.uuid, node);

    const children: SerializedNode[] = [];
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (!isInternalInspectorObject(child)) {
          const serialized = serializeNode(child, depth + 1);
          if (serialized) {
            children.push(serialized);
          }
        }
      }
    }

    return {
      id: node.id,
      uuid: node.uuid,
      name: getObjectDisplayName(node),
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
      if (!scene || !scene.isScene || isInternalInspectorObject(scene)) continue;

      try {
        scene.traverse((obj: any) => {
          try {
            if (!obj || !obj.isObject3D || isInternalInspectorObject(obj)) return;

            // Meshes, SkinnedMeshes, Lines, Points, Sprites
            const isRenderable = Boolean(
              obj.isMesh ||
              obj.isInstancedMesh ||
              obj.isSkinnedMesh ||
              obj.isLine ||
              obj.isLineSegments ||
              obj.isLineLoop ||
              obj.isPoints ||
              obj.isSprite
            );

            if (isRenderable) {
              // Exclude fullscreen postprocessing quads
              if (obj.geometry?.type === 'FullscreenTriangleGeometry') return;

              let verticesCount = 0;
              let facesCount = 0;
              let geoType = 'None';
              let matType = 'None';
              let matColor: string | undefined;

              if (obj.geometry && !isInternalInspectorObject(obj.geometry)) {
                geoType = obj.geometry.type || 'BufferGeometry';
                if (obj.geometry.attributes?.position && typeof obj.geometry.attributes.position.count === 'number') {
                  verticesCount = obj.geometry.attributes.position.count;
                }
                if (obj.geometry.index && typeof obj.geometry.index.count === 'number') {
                  facesCount = Math.floor(obj.geometry.index.count / 3);
                } else if (verticesCount > 0) {
                  facesCount = Math.floor(verticesCount / 3);
                }

                const geoUuid = obj.geometry.uuid || `geo-${obj.id}`;
                const memBytes = MemoryAuditor.calculateGeometryBytes(obj.geometry);
                if (!geometryMap.has(geoUuid)) {
                  geometryMap.set(geoUuid, {
                    uuid: geoUuid,
                    name: (obj.geometry.name && obj.geometry.name.trim().length > 0)
                      ? obj.geometry.name.trim()
                      : `${getObjectDisplayName(obj)} Geometry`,
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
                const validMats = mats.filter((m: any) => m && !isInternalInspectorObject(m));
                matType = validMats.map((m: any) => m.type || 'Material').join(', ');
                if (validMats[0]?.color) {
                  matColor = colorToHex(validMats[0].color);
                }

                validMats.forEach((m: any) => {
                  const matUuid = m.uuid || `mat-${obj.id}`;
                  if (!materialMap.has(matUuid)) {
                    materialMap.set(matUuid, {
                      uuid: matUuid,
                      name: (m.name && m.name.trim().length > 0)
                        ? m.name.trim()
                        : `${getObjectDisplayName(obj)} Material`,
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
                    if (tex && tex.isTexture && !isInternalInspectorObject(tex)) {
                      const texUuid = tex.uuid || `tex-${slot}-${matUuid}`;
                      const memBytes = MemoryAuditor.calculateTextureBytes(tex);
                      if (!textureMap.has(texUuid)) {
                        textureMap.set(texUuid, {
                          uuid: texUuid,
                          name: (tex.name && tex.name.trim().length > 0)
                            ? tex.name.trim()
                            : `${m.name || getObjectDisplayName(obj)} ${slot}`,
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
                name: getObjectDisplayName(obj),
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
                name: getObjectDisplayName(obj),
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
                name: getObjectDisplayName(obj),
                type: obj.type || 'Camera',
                fov: obj.fov,
                visible: obj.visible !== false
              });
            }
          } catch (e) {}
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
      animationManager.scanScenesForMixers(registeredScenes);
      emit('ANIMATION_DATA', animationManager.getMixersData());
    } catch (e) {}
  }

  function extractMaterialInfo(mat: any): MaterialInfo {
    const textureSlots: TextureSlotInfo[] = [];
    const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'envMap'];
    slots.forEach((s) => {
      const tex = mat[s];
      if (tex && tex.isTexture && !isInternalInspectorObject(tex)) {
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

  function safeCloneUserData(userData: any): Record<string, any> {
    if (!userData || typeof userData !== 'object') return {};
    try {
      const clean: Record<string, any> = {};
      for (const key of Object.keys(userData)) {
        const val = userData[key];
        if (typeof val === 'function' || typeof val === 'symbol') continue;
        if (typeof val === 'object' && val !== null) {
          if (val.isObject3D || val.isScene || val.isCamera || val.isRenderer || val.nodeType) {
            continue;
          }
          try {
            clean[key] = JSON.parse(JSON.stringify(val));
          } catch {
            clean[key] = '[Complex Object]';
          }
        } else {
          clean[key] = val;
        }
      }
      return clean;
    } catch {
      return {};
    }
  }

  function extractObjectDetails(obj: any): ObjectDetails | null {
    if (!obj || !obj.uuid) return null;

    try {
      let posX = 0, posY = 0, posZ = 0;
      if (obj.position) {
        posX = typeof obj.position.x === 'number' ? +obj.position.x.toFixed(3) : 0;
        posY = typeof obj.position.y === 'number' ? +obj.position.y.toFixed(3) : 0;
        posZ = typeof obj.position.z === 'number' ? +obj.position.z.toFixed(3) : 0;
      }

      let rotX = 0, rotY = 0, rotZ = 0;
      let rotDegX = 0, rotDegY = 0, rotDegZ = 0;
      if (obj.rotation) {
        rotX = typeof obj.rotation.x === 'number' ? +obj.rotation.x.toFixed(4) : 0;
        rotY = typeof obj.rotation.y === 'number' ? +obj.rotation.y.toFixed(4) : 0;
        rotZ = typeof obj.rotation.z === 'number' ? +obj.rotation.z.toFixed(4) : 0;
        rotDegX = +(rotX * (180 / Math.PI)).toFixed(2);
        rotDegY = +(rotY * (180 / Math.PI)).toFixed(2);
        rotDegZ = +(rotZ * (180 / Math.PI)).toFixed(2);
      }

      let scaleX = 1, scaleY = 1, scaleZ = 1;
      if (obj.scale) {
        scaleX = typeof obj.scale.x === 'number' ? +obj.scale.x.toFixed(3) : 1;
        scaleY = typeof obj.scale.y === 'number' ? +obj.scale.y.toFixed(3) : 1;
        scaleZ = typeof obj.scale.z === 'number' ? +obj.scale.z.toFixed(3) : 1;
      }

      let geometry: GeometryInfo | null = null;
      if (obj.geometry && !isInternalInspectorObject(obj.geometry)) {
        try {
          const geo = obj.geometry;
          let verticesCount = 0;
          let facesCount = 0;

          if (geo.attributes?.position) {
            verticesCount = geo.attributes.position.count || 0;
          }
          if (geo.index) {
            facesCount = Math.floor((geo.index.count || 0) / 3);
          } else if (verticesCount > 0) {
            facesCount = Math.floor(verticesCount / 3);
          }

          let memBytes = 0;
          try {
            memBytes = MemoryAuditor.calculateGeometryBytes(geo);
          } catch {}

          geometry = {
            uuid: geo.uuid || '',
            type: geo.type || 'BufferGeometry',
            verticesCount,
            facesCount,
            hasNormals: Boolean(geo.attributes?.normal),
            hasUVs: Boolean(geo.attributes?.uv),
            hasColors: Boolean(geo.attributes?.color),
            parameters: geo.parameters || undefined,
            memoryBytes: memBytes
          };
        } catch (e) {}
      }

      let material: MaterialInfo | MaterialInfo[] | null = null;
      if (obj.material) {
        try {
          if (Array.isArray(obj.material)) {
            material = obj.material.filter((m: any) => m && !isInternalInspectorObject(m)).map(extractMaterialInfo);
          } else if (!isInternalInspectorObject(obj.material)) {
            material = extractMaterialInfo(obj.material);
          }
        } catch (e) {}
      }

      let light: LightInfo | null = null;
      if (obj.isLight || obj.type?.includes('Light') || 'intensity' in obj) {
        try {
          light = {
            color: colorToHex(obj.color),
            intensity: typeof obj.intensity === 'number' ? obj.intensity : 1,
            distance: obj.distance,
            decay: obj.decay,
            angle: obj.angle,
            penumbra: obj.penumbra,
            groundColor: obj.groundColor ? colorToHex(obj.groundColor) : undefined
          };
        } catch (e) {}
      }

      let camera: CameraInfo | null = null;
      if (obj.isCamera && !obj.__isInspectorCamera) {
        try {
          camera = {
            fov: obj.fov,
            near: obj.near ?? 0.1,
            far: obj.far ?? 1000,
            zoom: obj.zoom ?? 1,
            aspect: obj.aspect
          };
        } catch (e) {}
      }

      return {
        id: obj.id,
        uuid: obj.uuid,
        name: getObjectDisplayName(obj),
        type: obj.type || 'Object3D',
        visible: obj.visible !== false,
        castShadow: Boolean(obj.castShadow),
        receiveShadow: Boolean(obj.receiveShadow),
        frustumCulled: obj.frustumCulled !== false,
        renderOrder: obj.renderOrder || 0,
        position: { x: posX, y: posY, z: posZ },
        rotation: { x: rotX, y: rotY, z: rotZ },
        rotationDegrees: { x: rotDegX, y: rotDegY, z: rotDegZ },
        scale: { x: scaleX, y: scaleY, z: scaleZ },
        geometry,
        material,
        light,
        camera,
        userData: safeCloneUserData(obj.userData)
      };
    } catch (e) {
      console.warn('[Three.js Inspector] extractObjectDetails fallback:', e);
      return {
        id: obj.id || 0,
        uuid: obj.uuid || '',
        name: getObjectDisplayName(obj),
        type: obj.type || 'Object3D',
        visible: obj.visible !== false,
        castShadow: false,
        receiveShadow: false,
        frustumCulled: true,
        renderOrder: 0,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        rotationDegrees: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        geometry: null,
        material: null,
        light: null,
        camera: null,
        userData: {}
      };
    }
  }

  // Set selected object (attaches TransformControls gizmo and selection box)
  function setSelectedHighlight(uuid: string | null) {
    if (selectedHighlightHelper) {
      if (selectedHighlightHelper.parent) {
        selectedHighlightHelper.parent.remove(selectedHighlightHelper);
      }
      if (typeof selectedHighlightHelper.dispose === 'function') {
        selectedHighlightHelper.dispose();
      }
      selectedHighlightHelper = null;
      selectedHighlightTarget = null;
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
    const scene = getObjectScene(target);

    if (cam && canvas && scene) {
      gizmoManager.setTarget(target, cam, canvas, scene);
    }

    try {
      let helper: any = null;

      if ((target.isMesh || target.isInstancedMesh) && target.geometry) {
        helper = new BoxHelper(target, 0x00ffff);
        helper.material = createHelperMaterial(0x00ffff, 0.9);
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
        helper.material = createHelperMaterial(colorHex, 0.95);
        helper.renderOrder = 999999;
      }

      helper.name = '__THREE_INSPECTOR_HELPER__';
      helper.__isInspectorObject = true;
      ensureDrawRange(helper.geometry);
      if (helper.matrixWorld) {
        ensureDeterminantAffine(Object.getPrototypeOf(helper.matrixWorld));
      }

      if (scene) {
        scene.add(helper);
        selectedHighlightHelper = helper;
        selectedHighlightTarget = target;
      }
    } catch (e) {}
  }

  // Lightweight hover highlight (NEVER attaches gizmo, zero performance cost)
  function setHoverHighlight(uuid: string | null) {
    if (hoverHelper) {
      if (hoverHelper.parent) {
        hoverHelper.parent.remove(hoverHelper);
      }
      if (typeof hoverHelper.dispose === 'function') {
        hoverHelper.dispose();
      }
      hoverHelper = null;
    }

    if (!uuid || uuid === activeSelectedUuid) return;

    const target = findObjectByUuid(uuid);
    if (!target) return;

    try {
      let helper: any = null;

      if ((target.isMesh || target.isInstancedMesh) && target.geometry) {
        helper = new BoxHelper(target, 0x38bdf8);
        helper.material = createHelperMaterial(0x38bdf8, 0.5);
        helper.renderOrder = 999998;
      } else {
        const worldPos = new Vector3();
        if (typeof target.getWorldPosition === 'function') {
          target.getWorldPosition(worldPos);
        } else if (target.position) {
          worldPos.copy(target.position);
        }
        const box = new Box3();
        box.setFromCenterAndSize(worldPos, new Vector3(1, 1, 1));
        helper = new Box3Helper(box, new Color(0x38bdf8));
        helper.material = createHelperMaterial(0x38bdf8, 0.5);
        helper.renderOrder = 999998;
      }

      helper.name = '__THREE_INSPECTOR_HOVER__';
      helper.__isInspectorObject = true;
      ensureDrawRange(helper.geometry);
      if (helper.matrixWorld) {
        ensureDeterminantAffine(Object.getPrototypeOf(helper.matrixWorld));
      }

      const scene = getObjectScene(target);
      if (scene) {
        scene.add(helper);
        hoverHelper = helper;
      }
    } catch (e) {}
  }

  function updateObjectProperty(payload: UpdatePropertyPayload) {
    try {
      const { uuid, path, value } = payload;
      const obj = findObjectByUuid(uuid);
      if (!obj) return;

      const [rootProp, subProp] = path;

      if (rootProp === 'position' && subProp && obj.position) {
        obj.position[subProp] = Number(value);
        obj.matrixAutoUpdate = true;
        obj.matrixWorldNeedsUpdate = true;
        if (typeof obj.updateMatrix === 'function') obj.updateMatrix();
        if (typeof obj.updateMatrixWorld === 'function') obj.updateMatrixWorld(true);
        if (obj.isCamera && typeof obj.updateProjectionMatrix === 'function') obj.updateProjectionMatrix();
      } else if (rootProp === 'rotationDegrees' && subProp && obj.rotation) {
        obj.rotation[subProp] = (Number(value) * Math.PI) / 180;
        obj.matrixAutoUpdate = true;
        obj.matrixWorldNeedsUpdate = true;
        if (typeof obj.updateMatrix === 'function') obj.updateMatrix();
        if (typeof obj.updateMatrixWorld === 'function') obj.updateMatrixWorld(true);
        if (obj.isCamera && typeof obj.updateProjectionMatrix === 'function') obj.updateProjectionMatrix();
      } else if (rootProp === 'scale' && subProp && obj.scale) {
        if (obj.isLight || obj.type?.includes('Light')) {
          return; // Lights cannot and should not be scaled
        }
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

      if (selectedHighlightHelper && typeof selectedHighlightHelper.update === 'function') {
        try {
          selectedHighlightHelper.update();
          ensureDrawRange(selectedHighlightHelper.geometry);
        } catch (e) {}
      }

      const updatedDetails = extractObjectDetails(obj);
      if (updatedDetails) {
        emit('OBJECT_DETAILS_DATA', updatedDetails);
      }
    } catch (e) {}
  }

  const originalMaterialWireframe = new WeakMap<any, boolean>();

  function toggleWireframe(enabled: boolean) {
    try {
      isWireframeActive = enabled;
      for (const scene of registeredScenes) {
        if (!scene || !scene.isScene) continue;
        scene.overrideMaterial = enabled ? overrideWireframe : null;
        scene.traverse((node: any) => {
          if (node.material && !isInternalInspectorObject(node)) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((m: any) => {
              if (!m) return;
              if (enabled) {
                if (!originalMaterialWireframe.has(m)) {
                  originalMaterialWireframe.set(m, Boolean(m.wireframe));
                }
                m.wireframe = true;
              } else {
                const orig = originalMaterialWireframe.get(m);
                m.wireframe = orig !== undefined ? orig : false;
              }
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

      if (selectedHighlightHelper && selectedHighlightTarget && gizmoManager.isDragging()) {
        if (typeof selectedHighlightHelper.update === 'function') {
          try {
            selectedHighlightHelper.update();
            ensureDrawRange(selectedHighlightHelper.geometry);
          } catch (e) {}
        } else if (selectedHighlightHelper.box) {
          const worldPos = new Vector3();
          if (typeof selectedHighlightTarget.getWorldPosition === 'function') {
            selectedHighlightTarget.getWorldPosition(worldPos);
          } else if (selectedHighlightTarget.position) {
            worldPos.copy(selectedHighlightTarget.position);
          }
          selectedHighlightHelper.box.setFromCenterAndSize(worldPos, new Vector3(1.2, 1.2, 1.2));
        }
      }
    } catch (e) {}
  }

  function hookRendererPrototype() {
    const THREE = (window as any).THREE;
    if (THREE) {
      if (THREE.BufferGeometry?.prototype) {
        try {
          const origInit = THREE.BufferGeometry.prototype.constructor;
          if (origInit && !THREE.BufferGeometry.prototype.__INSPECTOR_DRAWRANGE_GUARDED__) {
            THREE.BufferGeometry.prototype.__INSPECTOR_DRAWRANGE_GUARDED__ = true;
            Object.defineProperty(THREE.BufferGeometry.prototype, 'drawRange', {
              get() {
                if (!this._drawRange) this._drawRange = { start: 0, count: Infinity };
                if (typeof this._drawRange.count !== 'number') this._drawRange.count = Infinity;
                return this._drawRange;
              },
              set(val) {
                if (val && typeof val.count !== 'number') val.count = Infinity;
                this._drawRange = val;
              },
              configurable: true,
              enumerable: true
            });
          }
        } catch (e) {}
      }
    }
    if (THREE && THREE.WebGLRenderer && !THREE.WebGLRenderer.__INSPECTOR_HOOKED__) {
      THREE.WebGLRenderer.__INSPECTOR_HOOKED__ = true;
      const originalRender = THREE.WebGLRenderer.prototype.render;
      THREE.WebGLRenderer.prototype.render = function (scene: any, camera: any) {
        return handleHookedRender.call(this, originalRender, scene, camera);
      };
      emitDetection();
    }
    animationManager.hookMixerPrototype();
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
        activeSelectedUuid = payload?.uuid || null;
        if (payload?.uuid) {
          const obj = findObjectByUuid(payload.uuid);
          if (obj) {
            setSelectedHighlight(payload.uuid);
            const details = extractObjectDetails(obj);
            emit('OBJECT_DETAILS_DATA', details);
          } else {
            setSelectedHighlight(null);
            emit('OBJECT_DETAILS_DATA', null);
          }
        } else {
          setSelectedHighlight(null);
          emit('OBJECT_DETAILS_DATA', null);
        }
        break;

      case 'HIGHLIGHT_OBJECT':
        setHoverHighlight(payload?.uuid || null);
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
        if (payload?.mode) {
          const cam = getActiveCamera();
          const canvas = getActiveCanvas();
          const scene = getActiveScene();
          const target = activeSelectedUuid ? findObjectByUuid(activeSelectedUuid) : null;
          gizmoManager.setMode(payload.mode, cam, canvas || undefined, scene, target);
        }
        break;

      case 'FOCUS_OBJECT':
        if (payload?.uuid) {
          const obj = findObjectByUuid(payload.uuid);
          const canvas = getActiveCanvas();
          const cam = getActiveCamera();
          if (obj && canvas) {
            const isNowFocused = debugCameraManager.focusOn(obj, canvas, cam);
            emit('FOCUS_STATE_CHANGED', { isFocused: isNowFocused });
          }
        }
        break;

      case 'CONTROL_ANIMATION':
        if (payload) {
          const data = animationManager.control(payload.mixerId, payload.clipName, payload.action, payload.value);
          emit('ANIMATION_DATA', data);
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
          if (detail.isScene && !isInternalInspectorObject(detail)) {
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
          setGizmoMode: (mode: GizmoMode) => {
            const cam = getActiveCamera();
            const canvas = getActiveCanvas();
            const scene = getActiveScene();
            const target = activeSelectedUuid ? findObjectByUuid(activeSelectedUuid) : null;
            gizmoManager.setMode(mode, cam, canvas || undefined, scene, target);
          },
          getGizmoMode: () => gizmoManager.getMode(),
          toggleFocus: (uuid: string) => {
            const obj = findObjectByUuid(uuid);
            const canvas = getActiveCanvas();
            const cam = getActiveCamera();
            if (obj && canvas) {
              const isNowFocused = debugCameraManager.focusOn(obj, canvas, cam);
              return isNowFocused;
            }
            return false;
          },
          revertFocus: () => {
            return debugCameraManager.revertFocus();
          },
          isFocused: () => debugCameraManager.isFocusActive(),
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
          setHoverHighlight,
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
            const data = animationManager.control(mixerId, clipName, action, value);
            emit('ANIMATION_DATA', data);
            return data;
          },
          selectObject: (uuid: string | null) => {
            activeSelectedUuid = uuid || null;
            if (!uuid) {
              setSelectedHighlight(null);
              return null;
            }
            const obj = findObjectByUuid(uuid);
            if (obj) {
              setSelectedHighlight(uuid);
              return extractObjectDetails(obj);
            }
            setSelectedHighlight(null);
            return null;
          },
          setSelectedHighlight,
          getCategorizedData: () => extractCategorizedData(),
          getSceneGraph: () => {
            const scenes: SerializedNode[] = [];
            for (const scene of registeredScenes) {
              const serialized = serializeNode(scene);
              if (serialized) scenes.push(serialized);
            }
            return scenes;
          },
          getScenes: () => Array.from(registeredScenes),
          getRenderers: () => Array.from(registeredRenderers),
          refresh: () => {
            animationManager.scanScenesForMixers(registeredScenes);
            emitDetection();
            emitSceneGraph();
            emit('ANIMATION_DATA', animationManager.getMixersData());
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

    if ((window as any).scene && (window as any).scene.isScene) {
      registerScene((window as any).scene);
    }
    if ((window as any).renderer && (window as any).renderer.render) {
      registerRenderer((window as any).renderer);
    }

    if (registeredScenes.size > 0) {
      animationManager.scanScenesForMixers(registeredScenes);
    }

    const canvases = document.querySelectorAll('canvas');
    canvases.forEach((c: any) => {
      if (c.__threeRenderer) {
        registerRenderer(c.__threeRenderer);
      }
    });

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
