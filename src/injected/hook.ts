import type {
  SerializedNode,
  ObjectDetails,
  GeometryInfo,
  MaterialInfo,
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
  type UpdatePropertyPayload,
  type ToggleHelperPayload
} from '../types/messages';

(function initThreeInspectorHook() {
  // Prevent duplicate injection
  if ((window as any).__THREE_INSPECTOR_HOOK_INSTALLED__) {
    return;
  }
  (window as any).__THREE_INSPECTOR_HOOK_INSTALLED__ = true;

  // Active Three.js instances
  const registeredScenes = new Set<any>();
  const registeredRenderers = new Set<any>();
  const uuidToObjectMap = new Map<string, any>();

  // Helpers
  let currentHighlightHelper: any = null;
  let activeSelectedUuid: string | null = null;
  let lastActiveCamera: any = null;
  let pickerEnabled = false;

  // FPS calculation
  let frameCount = 0;
  let lastTime = performance.now();
  let currentFps = 60;
  let lastStatsEmit = 0;

  // Post message to content script
  function emit<T>(action: InspectorMessage['action'], payload?: T) {
    const message: InspectorMessage<T> = {
      source: MESSAGE_SOURCE.HOOK,
      action,
      payload,
      timestamp: Date.now()
    };
    window.postMessage(message, '*');
  }

  // Color helper: Three.js Color -> Hex string
  function colorToHex(color: any): string {
    if (!color) return '#ffffff';
    if (typeof color.getHexString === 'function') {
      return '#' + color.getHexString();
    }
    if (typeof color === 'string') return color;
    return '#ffffff';
  }

  // Hex string -> Three.js Color
  function hexToColor(targetColor: any, hex: string) {
    if (targetColor && typeof targetColor.set === 'function') {
      targetColor.set(hex);
    }
  }

  // Register scene and index its objects
  function registerScene(scene: any) {
    if (!scene || !scene.isObject3D) return;
    if (!registeredScenes.has(scene)) {
      registeredScenes.add(scene);
      indexSceneObjects(scene);
      emitDetection();
      emitSceneGraph();
    }
  }

  // Index objects for fast UUID lookup
  function indexSceneObjects(root: any) {
    root.traverse((obj: any) => {
      if (obj && obj.uuid) {
        uuidToObjectMap.set(obj.uuid, obj);
      }
    });
  }

  // Register renderer
  function registerRenderer(renderer: any) {
    if (!renderer) return;
    if (!registeredRenderers.has(renderer)) {
      registeredRenderers.add(renderer);
      emitDetection();
    }
  }

  // Emit detection signal
  function emitDetection() {
    const version = (window as any).__THREE__ || (window as any).THREE?.REVISION || 'unknown';
    emit('THREE_DETECTED', {
      version: String(version),
      scenesCount: registeredScenes.size,
      renderersCount: registeredRenderers.size
    });
  }

  // Serialize a node recursively
  function serializeNode(node: any, depth = 0): SerializedNode | null {
    if (!node || !node.isObject3D) return null;
    // Don't inspect our own helper objects
    if (node.name === '__THREE_INSPECTOR_HELPER__') return null;

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

  // Extract categorized data (Meshes, Lights, Cameras, Materials, Textures, Geometries)
  function extractCategorizedData(): CategorizedSceneData {
    const meshes: CategoryMeshItem[] = [];
    const lights: CategoryLightItem[] = [];
    const cameras: CategoryCameraItem[] = [];
    const materialMap = new Map<string, CategoryMaterialItem>();
    const textureMap = new Map<string, CategoryTextureItem>();
    const geometryMap = new Map<string, CategoryGeometryItem>();

    for (const scene of registeredScenes) {
      scene.traverse((obj: any) => {
        if (!obj || !obj.isObject3D || obj.name === '__THREE_INSPECTOR_HELPER__') return;

        // Meshes
        if (obj.isMesh) {
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
            if (!geometryMap.has(geoUuid)) {
              geometryMap.set(geoUuid, {
                uuid: geoUuid,
                name: obj.geometry.name || geoType,
                type: geoType,
                verticesCount,
                facesCount,
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

              // Texture maps
              const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'envMap'];
              slots.forEach((slot) => {
                const tex = m[slot];
                if (tex && tex.isTexture) {
                  const texUuid = tex.uuid || `tex-${slot}-${matUuid}`;
                  if (!textureMap.has(texUuid)) {
                    textureMap.set(texUuid, {
                      uuid: texUuid,
                      name: tex.name || `${m.name || 'Material'} ${slot}`,
                      type: slot,
                      width: tex.image?.width,
                      height: tex.image?.height,
                      format: tex.format ? String(tex.format) : undefined,
                      mapping: tex.mapping ? String(tex.mapping) : undefined,
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

        // Lights
        if (obj.isLight) {
          lights.push({
            id: obj.id,
            uuid: obj.uuid,
            name: obj.name || `Light (${obj.id})`,
            type: obj.type || 'Light',
            color: colorToHex(obj.color),
            intensity: obj.intensity ?? 1,
            visible: obj.visible !== false
          });
        }

        // Cameras
        if (obj.isCamera) {
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

  // Emit full scene graph & categorized data
  function emitSceneGraph() {
    const scenes: SerializedNode[] = [];
    for (const scene of registeredScenes) {
      const serialized = serializeNode(scene);
      if (serialized) {
        scenes.push(serialized);
      }
    }
    emit('SCENE_GRAPH_DATA', { scenes });
    emit('CATEGORIZED_DATA', extractCategorizedData());
  }

  // Extract single material info
  function extractMaterialInfo(mat: any): MaterialInfo {
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
      wireframe: typeof mat.wireframe === 'boolean' ? mat.wireframe : undefined,
      visible: mat.visible !== false,
      depthTest: mat.depthTest !== false,
      depthWrite: mat.depthWrite !== false
    };
  }

  // Extract object details for inspector view
  function extractObjectDetails(obj: any): ObjectDetails | null {
    if (!obj) return null;

    // Rotation in degrees
    const rotDeg = {
      x: +(obj.rotation.x * (180 / Math.PI)).toFixed(2),
      y: +(obj.rotation.y * (180 / Math.PI)).toFixed(2),
      z: +(obj.rotation.z * (180 / Math.PI)).toFixed(2)
    };

    // Geometry details
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
        parameters: geo.parameters || undefined
      };
    }

    // Material details
    let material: MaterialInfo | MaterialInfo[] | null = null;
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        material = obj.material.map(extractMaterialInfo);
      } else {
        material = extractMaterialInfo(obj.material);
      }
    }

    // Light details
    let light: LightInfo | null = null;
    if (obj.isLight) {
      light = {
        color: colorToHex(obj.color),
        intensity: obj.intensity ?? 1,
        distance: obj.distance,
        decay: obj.decay,
        angle: obj.angle,
        penumbra: obj.penumbra,
        groundColor: obj.groundColor ? colorToHex(obj.groundColor) : undefined
      };
    }

    // Camera details
    let camera: CameraInfo | null = null;
    if (obj.isCamera) {
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
      position: {
        x: +obj.position.x.toFixed(3),
        y: +obj.position.y.toFixed(3),
        z: +obj.position.z.toFixed(3)
      },
      rotation: {
        x: +obj.rotation.x.toFixed(4),
        y: +obj.rotation.y.toFixed(4),
        z: +obj.rotation.z.toFixed(4)
      },
      rotationDegrees: rotDeg,
      scale: {
        x: +obj.scale.x.toFixed(3),
        y: +obj.scale.y.toFixed(3),
        z: +obj.scale.z.toFixed(3)
      },
      geometry,
      material,
      light,
      camera,
      userData: obj.userData || {}
    };
  }

  // Update helper highlight in scene
  function setHighlight(uuid: string | null) {
    if (currentHighlightHelper) {
      if (currentHighlightHelper.parent) {
        currentHighlightHelper.parent.remove(currentHighlightHelper);
      }
      if (typeof currentHighlightHelper.dispose === 'function') {
        currentHighlightHelper.dispose();
      }
      currentHighlightHelper = null;
    }

    if (!uuid) return;

    const target = uuidToObjectMap.get(uuid);
    if (!target) return;

    const THREE = (window as any).THREE;
    if (!THREE || !THREE.BoxHelper) return;

    try {
      const helper = new THREE.BoxHelper(target, 0x00ffcc);
      helper.name = '__THREE_INSPECTOR_HELPER__';
      helper.material.depthTest = false;
      helper.material.transparent = true;
      helper.material.opacity = 0.8;
      helper.renderOrder = 99999;

      // Find root scene
      let root = target;
      while (root.parent) {
        root = root.parent;
      }

      root.add(helper);
      currentHighlightHelper = helper;
    } catch (e) {
      // Ignore helper errors for objects without geometries
    }
  }

  // Update object properties dynamically
  function updateObjectProperty(payload: UpdatePropertyPayload) {
    const { uuid, path, value } = payload;
    const obj = uuidToObjectMap.get(uuid);
    if (!obj) return;

    const [rootProp, subProp, nestedProp] = path;

    if (rootProp === 'position' && subProp) {
      obj.position[subProp] = Number(value);
    } else if (rootProp === 'rotationDegrees' && subProp) {
      const rad = (Number(value) * Math.PI) / 180;
      obj.rotation[subProp] = rad;
    } else if (rootProp === 'scale' && subProp) {
      obj.scale[subProp] = Number(value);
    } else if (rootProp === 'visible') {
      obj.visible = Boolean(value);
    } else if (rootProp === 'castShadow') {
      obj.castShadow = Boolean(value);
    } else if (rootProp === 'receiveShadow') {
      obj.receiveShadow = Boolean(value);
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
      }
      mat.needsUpdate = true;
    } else if (rootProp === 'light' && obj.isLight) {
      if (subProp === 'color') {
        hexToColor(obj.color, value);
      } else if (subProp === 'intensity') {
        obj.intensity = Number(value);
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

    // Refresh details for DevTools
    const updatedDetails = extractObjectDetails(obj);
    if (updatedDetails) {
      emit('OBJECT_DETAILS_DATA', updatedDetails);
    }
  }

  // Toggle wireframe on entire scene or selected object
  function toggleWireframe(enabled: boolean) {
    for (const scene of registeredScenes) {
      scene.traverse((node: any) => {
        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((m: any) => {
            if ('wireframe' in m) {
              m.wireframe = enabled;
            }
          });
        }
      });
    }
  }

  // Expose object to console as window.$three
  function inspectInConsole(uuid: string) {
    const obj = uuidToObjectMap.get(uuid);
    if (!obj) return;
    try {
      (window as any).$three = obj;
      (window as any).$selected = obj;
    } catch (e) {
      // Ignore if window properties are protected
    }
    console.log(
      '%c[Three.js Inspector]%c Selected object assigned to %c$three%c and %c$selected%c:',
      'background: #3b82f6; color: white; padding: 2px 4px; border-radius: 3px; font-weight: bold;',
      'color: inherit;',
      'color: #10b981; font-weight: bold;',
      'color: inherit;',
      'color: #10b981; font-weight: bold;',
      'color: inherit;',
      obj
    );
  }

  // Stats tick called from render hook
  function tickRender(renderer: any) {
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

    if (currentHighlightHelper && typeof currentHighlightHelper.update === 'function') {
      currentHighlightHelper.update();
    }
  }

  // Universal Hook into THREE.WebGLRenderer
  function hookRendererPrototype() {
    const THREE = (window as any).THREE;
    if (THREE && THREE.WebGLRenderer && !THREE.WebGLRenderer.__INSPECTOR_HOOKED__) {
      THREE.WebGLRenderer.__INSPECTOR_HOOKED__ = true;
      const originalRender = THREE.WebGLRenderer.prototype.render;

      THREE.WebGLRenderer.prototype.render = function (scene: any, camera: any) {
        registerRenderer(this);
        if (scene) registerScene(scene);
        if (camera) lastActiveCamera = camera;
        tickRender(this);
        return originalRender.apply(this, arguments as any);
      };

      emitDetection();
    }
  }

  // Raycaster Picker Handlers
  function getActiveCanvas(): HTMLCanvasElement | null {
    for (const r of registeredRenderers) {
      if (r && r.domElement) return r.domElement;
    }
    return document.querySelector('canvas');
  }

  function onPickerPointerMove(e: PointerEvent) {
    if (!pickerEnabled || !lastActiveCamera) return;
    const canvas = e.currentTarget as HTMLCanvasElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouse = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1
    };

    const THREE = (window as any).THREE;
    if (!THREE || !THREE.Raycaster) return;

    try {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, lastActiveCamera);

      const targets: any[] = [];
      for (const scene of registeredScenes) {
        scene.traverse((obj: any) => {
          if (obj.isMesh && obj.visible && obj.name !== '__THREE_INSPECTOR_HELPER__') {
            targets.push(obj);
          }
        });
      }

      const intersects = raycaster.intersectObjects(targets, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        setHighlight(hit.uuid);
      } else {
        setHighlight(activeSelectedUuid);
      }
    } catch (err) {}
  }

  function onPickerClick(e: MouseEvent) {
    if (!pickerEnabled || !lastActiveCamera) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = e.currentTarget as HTMLCanvasElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouse = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1
    };

    const THREE = (window as any).THREE;
    if (!THREE || !THREE.Raycaster) return;

    try {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, lastActiveCamera);

      const targets: any[] = [];
      for (const scene of registeredScenes) {
        scene.traverse((obj: any) => {
          if (obj.isMesh && obj.visible && obj.name !== '__THREE_INSPECTOR_HELPER__') {
            targets.push(obj);
          }
        });
      }

      const intersects = raycaster.intersectObjects(targets, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        activeSelectedUuid = hit.uuid;
        setHighlight(hit.uuid);

        // Notify DevTools panel
        emit('OBJECT_PICKED', { uuid: hit.uuid });

        const details = extractObjectDetails(hit);
        if (details) {
          emit('OBJECT_DETAILS_DATA', details);
        }
      }
    } catch (err) {}

    // Disable picker after selection
    setPickerMode(false);
  }

  function setPickerMode(enabled: boolean) {
    pickerEnabled = enabled;
    const canvas = getActiveCanvas();
    if (!canvas) return;

    if (enabled) {
      canvas.style.cursor = 'crosshair';
      canvas.addEventListener('pointermove', onPickerPointerMove, true);
      canvas.addEventListener('click', onPickerClick, true);
    } else {
      canvas.style.cursor = '';
      canvas.removeEventListener('pointermove', onPickerPointerMove, true);
      canvas.removeEventListener('click', onPickerClick, true);
      setHighlight(activeSelectedUuid);
    }
  }

  // Listen to messages from content script
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin and tagged for hook
    if (event.source !== window || !event.data || event.data.source !== MESSAGE_SOURCE.CONTENT) {
      return;
    }

    const { action, payload } = event.data as InspectorMessage;

    switch (action) {
      case 'PING':
        emitDetection();
        break;

      case 'REQUEST_SCENE_GRAPH':
        // Re-index all registered scenes in case new objects were added
        for (const scene of registeredScenes) {
          indexSceneObjects(scene);
        }
        emitSceneGraph();
        break;

      case 'SELECT_OBJECT':
        if (payload?.uuid) {
          activeSelectedUuid = payload.uuid;
          const obj = uuidToObjectMap.get(payload.uuid);
          if (obj) {
            setHighlight(payload.uuid);
            const details = extractObjectDetails(obj);
            if (details) {
              emit('OBJECT_DETAILS_DATA', details);
            }
          }
        }
        break;

      case 'HIGHLIGHT_OBJECT':
        setHighlight(payload?.uuid || activeSelectedUuid);
        break;

      case 'UPDATE_PROPERTY':
        if (payload) {
          updateObjectProperty(payload);
        }
        break;

      case 'INSPECT_IN_CONSOLE':
        if (payload?.uuid) {
          inspectInConsole(payload.uuid);
        }
        break;

      case 'TOGGLE_WIREFRAME':
        if (typeof payload?.enabled === 'boolean') {
          toggleWireframe(payload.enabled);
        }
        break;

      case 'TOGGLE_PICKER':
        if (typeof payload?.enabled === 'boolean') {
          setPickerMode(payload.enabled);
        }
        break;
    }
  });

  // Safe setup for Three.js DevTools hook protocol
  function setupDevToolsHook() {
    try {
      let devtools = (window as any).__THREE_DEVTOOLS__;

      if (!devtools) {
        // Create standard Three.js EventTarget hook if not present
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

      // Listen to native Three.js 'observe' events (Three.js r120+ dispatches to __THREE_DEVTOOLS__)
      if (devtools && typeof devtools.addEventListener === 'function') {
        devtools.addEventListener('observe', (event: any) => {
          const detail = event?.detail;
          if (detail) {
            if (detail.isScene || detail.isObject3D) registerScene(detail);
            if (detail.render && detail.domElement) registerRenderer(detail);
          }
        });
      }

      // Safely attach helper methods if writable
      if (devtools && typeof devtools === 'object') {
        try {
          devtools.registerScene = registerScene;
          devtools.registerRenderer = registerRenderer;
          devtools.getScenes = () => Array.from(registeredScenes);
          devtools.getRenderers = () => Array.from(registeredRenderers);
          devtools.refresh = () => {
            emitDetection();
            emitSceneGraph();
          };
        } catch {}
      }

      // Also set isolated property for our inspector
      try {
        (window as any).__THREE_INSPECTOR__ = {
          registerScene,
          registerRenderer,
          getScenes: () => Array.from(registeredScenes),
          getRenderers: () => Array.from(registeredRenderers),
          refresh: () => {
            emitDetection();
            emitSceneGraph();
          }
        };
      } catch {}
    } catch (e) {
      // Keep hook functioning even if window properties are strictly locked down
    }
  }

  setupDevToolsHook();

  // Attempt initial hook and watch for THREE appearing
  hookRendererPrototype();

  // Watch for THREE being set on window
  let checkCount = 0;
  const interval = setInterval(() => {
    checkCount++;
    hookRendererPrototype();

    // Check common global variables like window.scene or window.renderer
    if ((window as any).scene && (window as any).scene.isObject3D) {
      registerScene((window as any).scene);
    }

    if (checkCount > 20 && registeredScenes.size > 0) {
      clearInterval(interval);
    }
  }, 500);

  // Hook HTMLCanvasElement.prototype.getContext to detect WebGL canvases even before Three attaches
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as any).getContext = function (type: string, ...args: any[]) {
    const ctx = origGetContext.apply(this, [type, ...args] as any);
    if (type === 'webgl' || type === 'webgl2') {
      // Check for Three.js after short delay when renderer sets up
      setTimeout(() => hookRendererPrototype(), 100);
    }
    return ctx;
  };

  emitDetection();
})();
