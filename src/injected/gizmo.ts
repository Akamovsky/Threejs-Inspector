import {
  Group
} from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'none';

export class GizmoManager {
  private transformControls: TransformControls | null = null;
  private currentMode: GizmoMode = 'translate';
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

    if (this.helperRoot.parent !== scene) {
      scene.add(this.helperRoot);
    }

    if (!this.transformControls) {
      try {
        this.transformControls = new TransformControls(camera, domElement);
        this.transformControls.size = 0.85;
        this.transformControls.setMode(this.currentMode === 'none' ? 'translate' : this.currentMode);

        this.transformControls.addEventListener('objectChange', () => {
          if (this.targetObject && this.onTransformChange) {
            try {
              this.targetObject.matrixAutoUpdate = true;
              this.targetObject.matrixWorldNeedsUpdate = true;
              if (typeof this.targetObject.updateMatrix === 'function') {
                this.targetObject.updateMatrix();
              }
              if (typeof this.targetObject.updateMatrixWorld === 'function') {
                this.targetObject.updateMatrixWorld(true);
              }
              this.onTransformChange(this.targetObject);
            } catch (e) {}
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
      if (this.transformControls.domElement !== domElement) {
        try {
          this.transformControls.disconnect();
          this.transformControls.domElement = domElement;
          this.transformControls.connect();
        } catch (e) {}
      }
    }
  }

  public attach(object: any, camera: any, domElement: HTMLElement, scene: any) {
    this.targetObject = object;
    this.initControls(camera, domElement, scene);

    if (this.transformControls) {
      this.transformControls.camera = camera;
      if (object && this.currentMode !== 'none') {
        this.transformControls.setMode(this.currentMode);
        this.transformControls.attach(object);
      } else {
        this.transformControls.detach();
      }
    }
  }

  public detach() {
    this.targetObject = null;
    if (this.transformControls) {
      try {
        this.transformControls.detach();
      } catch (e) {}
    }
  }

  public setMode(mode: GizmoMode, camera?: any, domElement?: HTMLElement, scene?: any) {
    this.currentMode = mode;

    if (!this.transformControls && camera && domElement && scene) {
      this.initControls(camera, domElement, scene);
    }

    if (!this.transformControls) return;

    try {
      if (mode === 'none') {
        this.transformControls.detach();
      } else {
        this.transformControls.setMode(mode);
        if (this.targetObject) {
          this.transformControls.attach(this.targetObject);
        }
      }
    } catch (e) {}
  }

  public getMode(): GizmoMode {
    return this.currentMode;
  }

  public updateCamera(camera: any) {
    if (this.transformControls && camera && this.transformControls.camera !== camera) {
      this.transformControls.camera = camera;
    }
  }

  public isDragging(): boolean {
    return Boolean(this.transformControls?.dragging);
  }
}
