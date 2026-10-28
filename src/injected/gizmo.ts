import {
  Box3,
  Vector3,
  GridHelper,
  AxesHelper,
  DirectionalLightHelper,
  PointLightHelper,
  SpotLightHelper,
  CameraHelper,
  Group
} from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'none';

export interface HelperOptions {
  grid: boolean;
  axes: boolean;
  lights: boolean;
  cameras: boolean;
}

export class GizmoManager {
  private transformControls: TransformControls | null = null;
  private currentMode: GizmoMode = 'none';
  private targetObject: any = null;
  private helperRoot = new Group();
  private gridHelper: GridHelper | null = null;
  private axesHelper: AxesHelper | null = null;
  private activeHelpers: any[] = [];
  private helperOptions: HelperOptions = {
    grid: false,
    axes: false,
    lights: false,
    cameras: false
  };

  private onTransformChange?: (obj: any) => void;

  constructor() {
    this.helperRoot.name = '__THREE_INSPECTOR_HELPERS__';
  }

  public setOnTransformChange(callback: (obj: any) => void) {
    this.onTransformChange = callback;
  }

  public initControls(camera: any, domElement: HTMLElement, scene: any) {
    if (!scene || !camera || !domElement) return;

    if (!this.helperRoot.parent) {
      scene.add(this.helperRoot);
    }

    if (!this.transformControls) {
      try {
        this.transformControls = new TransformControls(camera, domElement);
        this.transformControls.size = 0.85;

        this.transformControls.addEventListener('change', () => {
          if (this.targetObject && this.onTransformChange) {
            this.targetObject.matrixAutoUpdate = true;
            this.targetObject.matrixWorldNeedsUpdate = true;
            this.targetObject.updateMatrix();
            this.targetObject.updateMatrixWorld(true);
            this.onTransformChange(this.targetObject);
          }
        });

        const helper = this.transformControls.getHelper();
        helper.name = '__THREE_INSPECTOR_GIZMO__';
        this.helperRoot.add(helper);
      } catch (e) {
        console.warn('[Three.js Inspector] Failed to initialize TransformControls:', e);
      }
    } else {
      this.transformControls.camera = camera;
    }
  }

  public attach(object: any, camera: any, domElement: HTMLElement, scene: any) {
    this.targetObject = object;
    this.initControls(camera, domElement, scene);

    if (this.transformControls) {
      if (object && this.currentMode !== 'none') {
        this.transformControls.attach(object);
      } else {
        this.transformControls.detach();
      }
    }
  }

  public detach() {
    this.targetObject = null;
    if (this.transformControls) {
      this.transformControls.detach();
    }
  }

  public setMode(mode: GizmoMode) {
    this.currentMode = mode;
    if (!this.transformControls) return;

    if (mode === 'none') {
      this.transformControls.detach();
    } else {
      this.transformControls.setMode(mode);
      if (this.targetObject) {
        this.transformControls.attach(this.targetObject);
      }
    }
  }

  public getMode(): GizmoMode {
    return this.currentMode;
  }

  public updateHelpers(scene: any, options: Partial<HelperOptions>) {
    Object.assign(this.helperOptions, options);
    if (!scene) return;

    if (!this.helperRoot.parent) {
      scene.add(this.helperRoot);
    }

    // Grid
    if (this.helperOptions.grid) {
      if (!this.gridHelper) {
        this.gridHelper = new GridHelper(20, 20, 0x38bdf8, 0x475569);
        this.gridHelper.name = '__THREE_INSPECTOR_GRID__';
        this.helperRoot.add(this.gridHelper);
      }
    } else if (this.gridHelper) {
      this.helperRoot.remove(this.gridHelper);
      this.gridHelper.dispose();
      this.gridHelper = null;
    }

    // Axes
    if (this.helperOptions.axes) {
      if (!this.axesHelper) {
        this.axesHelper = new AxesHelper(5);
        this.axesHelper.name = '__THREE_INSPECTOR_AXES__';
        this.axesHelper.renderOrder = 9999;
        this.helperRoot.add(this.axesHelper);
      }
    } else if (this.axesHelper) {
      this.helperRoot.remove(this.axesHelper);
      this.axesHelper.dispose();
      this.axesHelper = null;
    }

    // Dynamic light & camera helpers
    for (const helper of this.activeHelpers) {
      this.helperRoot.remove(helper);
      if (typeof helper.dispose === 'function') helper.dispose();
    }
    this.activeHelpers = [];

    if (this.helperOptions.lights || this.helperOptions.cameras) {
      scene.traverse((obj: any) => {
        if (!obj || obj === this.helperRoot || obj.parent === this.helperRoot) return;

        if (this.helperOptions.lights && obj.isLight) {
          try {
            let helper: any = null;
            if (obj.isDirectionalLight) {
              helper = new DirectionalLightHelper(obj, 1, 0xffea00);
            } else if (obj.isPointLight) {
              helper = new PointLightHelper(obj, 0.5, 0xffea00);
            } else if (obj.isSpotLight) {
              helper = new SpotLightHelper(obj, 0xffea00);
            }
            if (helper) {
              helper.name = '__THREE_INSPECTOR_LIGHT_HELPER__';
              this.helperRoot.add(helper);
              this.activeHelpers.push(helper);
            }
          } catch (e) {}
        }

        if (this.helperOptions.cameras && obj.isCamera && !obj.__isInspectorCamera) {
          try {
            const helper = new CameraHelper(obj);
            helper.name = '__THREE_INSPECTOR_CAMERA_HELPER__';
            this.helperRoot.add(helper);
            this.activeHelpers.push(helper);
          } catch (e) {}
        }
      });
    }
  }

  public updateHelpersState() {
    for (const helper of this.activeHelpers) {
      if (typeof helper.update === 'function') {
        try {
          helper.update();
        } catch (e) {}
      }
    }
  }

  public focusObject(target: any, camera: any) {
    if (!target || !camera) return;

    try {
      const box = new Box3();
      box.setFromObject(target);

      const center = new Vector3();
      box.getCenter(center);

      const size = new Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      const fov = camera.fov ? (camera.fov * Math.PI) / 180 : 0.8;
      const distance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.2;

      const direction = new Vector3()
        .subVectors(camera.position, center)
        .normalize();

      if (direction.lengthSq() < 0.001) {
        direction.set(0, 0.5, 1).normalize();
      }

      camera.position.copy(center).addScaledVector(direction, distance);
      camera.lookAt(center);
      if (camera.updateProjectionMatrix) {
        camera.updateProjectionMatrix();
      }
    } catch (e) {
      console.warn('[Three.js Inspector] Focus failed:', e);
    }
  }
}
