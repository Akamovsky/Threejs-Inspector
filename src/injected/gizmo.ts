import {
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
  private hookedDomElement: HTMLElement | null = null;

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

    // Intercept capture-phase pointerdown on canvas so that clicks/drags on gizmo handles
    // do not bubble into the game engine's pointer-lock or mouse-look handlers
    if (domElement && this.hookedDomElement !== domElement) {
      this.hookedDomElement = domElement;
      domElement.addEventListener(
        'pointerdown',
        (e: PointerEvent) => {
          if (!this.transformControls || !this.transformControls.enabled || this.currentMode === 'none') {
            return;
          }
          // Compute pointer coordinate in normalized device coordinates
          const rect = domElement.getBoundingClientRect();
          const pointer = {
            x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
            button: e.button
          };
          if (typeof (this.transformControls as any).pointerHover === 'function') {
            (this.transformControls as any).pointerHover(pointer);
          }
          if (this.transformControls.axis !== null) {
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') {
              e.stopImmediatePropagation();
            }
          }
        },
        { capture: true }
      );
    }
  }

  // Set the current target object (cached so mode switches can attach/detach seamlessly)
  public setTarget(object: any, camera: any, domElement: HTMLElement, scene: any) {
    this.targetObject = object;
    this.initControls(camera, domElement, scene);

    if (this.transformControls) {
      this.transformControls.camera = camera;
      if (object && this.currentMode !== 'none') {
        const isLight = Boolean(object.isLight || object.type?.includes('Light'));
        const activeMode = (isLight && this.currentMode === 'scale') ? 'translate' : this.currentMode;
        this.transformControls.setMode(activeMode);
        this.transformControls.attach(object);
      } else {
        this.transformControls.detach();
      }
    }
  }

  public attach(object: any, camera: any, domElement: HTMLElement, scene: any) {
    this.setTarget(object, camera, domElement, scene);
  }

  // Detach the visual gizmo handles from the object without forgetting the target
  public detachGizmoOnly() {
    if (this.transformControls) {
      try {
        this.transformControls.detach();
      } catch (e) {}
    }
  }

  // Full detach (used only when an object is completely deselected)
  public detach() {
    this.targetObject = null;
    this.detachGizmoOnly();
  }

  public setMode(mode: GizmoMode, camera?: any, domElement?: HTMLElement, scene?: any, target?: any) {
    if (target) {
      this.targetObject = target;
    }

    const isLight = Boolean(this.targetObject?.isLight || this.targetObject?.type?.includes('Light'));
    if (isLight && mode === 'scale') {
      mode = 'translate';
    }

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

  public getTarget(): any {
    return this.targetObject;
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
