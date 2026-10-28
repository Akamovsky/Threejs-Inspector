import {
  Box3,
  Vector3,
  Group
} from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'none';

export class GizmoManager {
  private transformControls: TransformControls | null = null;
  private currentMode: GizmoMode = 'none';
  private targetObject: any = null;
  private helperRoot = new Group();
  private onTransformChange?: (obj: any) => void;
  private onDraggingChange?: (isDragging: boolean) => void;

  constructor() {
    this.helperRoot.name = '__THREE_INSPECTOR_HELPERS__';
  }

  public setOnTransformChange(callback: (obj: any) => void) {
    this.onTransformChange = callback;
  }

  public setOnDraggingChange(callback: (isDragging: boolean) => void) {
    this.onDraggingChange = callback;
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

        this.transformControls.addEventListener('dragging-changed', (event: any) => {
          if (this.onDraggingChange) {
            this.onDraggingChange(Boolean(event.value));
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
      this.transformControls.camera = camera;
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

  public updateCamera(camera: any) {
    if (this.transformControls && camera) {
      this.transformControls.camera = camera;
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
      const distance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.3;

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
