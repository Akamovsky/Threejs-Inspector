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
    (this.helperRoot as any).__isInspectorObject = true;
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

        const onHandlePointerDown = (event: PointerEvent) => {
          if (!this.transformControls || !this.transformControls.enabled || this.currentMode === 'none') return;
          const rect = domElement.getBoundingClientRect();
          const pointer = {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
            button: event.button
          };
          if (typeof (this.transformControls as any).pointerHover === 'function') {
            (this.transformControls as any).pointerHover(pointer);
          }
          if (this.transformControls.axis !== null) {
            event.stopPropagation();
            if (typeof (this.transformControls as any).pointerDown === 'function') {
              (this.transformControls as any).pointerDown(pointer);
            }
          }
        };

        const onHandlePointerMove = (event: PointerEvent) => {
          if (!this.transformControls || !this.transformControls.enabled || this.currentMode === 'none') return;
          const rect = domElement.getBoundingClientRect();
          const pointer = {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
            button: event.button
          };
          if (this.transformControls.dragging) {
            event.stopPropagation();
            if (typeof (this.transformControls as any).pointerMove === 'function') {
              (this.transformControls as any).pointerMove(pointer);
            }
          } else {
            if (typeof (this.transformControls as any).pointerHover === 'function') {
              (this.transformControls as any).pointerHover(pointer);
            }
          }
        };

        const onHandlePointerUp = (event: PointerEvent) => {
          if (!this.transformControls || !this.transformControls.enabled || this.currentMode === 'none') return;
          if (this.transformControls.dragging) {
            event.stopPropagation();
            const rect = domElement.getBoundingClientRect();
            const pointer = {
              x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
              y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
              button: event.button
            };
            if (typeof (this.transformControls as any).pointerUp === 'function') {
              (this.transformControls as any).pointerUp(pointer);
            }
          }
        };

        domElement.addEventListener('pointerdown', onHandlePointerDown, { capture: true });
        domElement.addEventListener('pointermove', onHandlePointerMove, { capture: true });
        domElement.addEventListener('pointerup', onHandlePointerUp, { capture: true });

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
              if (this.targetObject.geometry) {
                if (!this.targetObject.geometry.drawRange) {
                  this.targetObject.geometry.drawRange = { start: 0, count: Infinity };
                } else if (typeof this.targetObject.geometry.drawRange.count !== 'number') {
                  this.targetObject.geometry.drawRange.count = Infinity;
                }
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
        (helper as any).__isInspectorObject = true;
        helper.traverse((node: any) => {
          (node as any).__isInspectorObject = true;
          if (node.geometry && node.geometry.drawRange && typeof node.geometry.drawRange.count !== 'number') {
            node.geometry.drawRange.count = Infinity;
          }
          if (node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach((m: any) => {
              if (m && !m.onBuild) m.onBuild = function () {};
              if (m && !m.onBeforeCompile) m.onBeforeCompile = function () {};
            });
          }
        });
        if ((this.transformControls as any)._plane) {
          const plane = (this.transformControls as any)._plane;
          (plane as any).__isInspectorObject = true;
          plane.visible = false;
          if (plane.geometry) {
            if (!plane.geometry.drawRange) {
              plane.geometry.drawRange = { start: 0, count: Infinity };
            } else if (typeof plane.geometry.drawRange.count !== 'number') {
              plane.geometry.drawRange.count = Infinity;
            }
          }
          if (plane.material) {
            plane.material.visible = false;
            if (!plane.material.onBuild) plane.material.onBuild = function () {};
            if (!plane.material.onBeforeCompile) plane.material.onBeforeCompile = function () {};
          }
        }
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
        this.ensureControlsDrawRanges();
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
          this.ensureControlsDrawRanges();
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

  public ensureControlsDrawRanges() {
    if (!this.transformControls) return;
    try {
      const helper = (this.transformControls as any)._root || this.transformControls.getHelper?.();
      if (helper && helper.traverse) {
        helper.traverse((node: any) => {
          if (node.geometry) {
            if (!node.geometry.drawRange) {
              node.geometry.drawRange = { start: 0, count: Infinity };
            } else if (typeof node.geometry.drawRange.count !== 'number') {
              node.geometry.drawRange.count = Infinity;
            }
          }
        });
      }
      const plane = (this.transformControls as any)._plane;
      if (plane) {
        plane.visible = false;
        if (plane.geometry) {
          if (!plane.geometry.drawRange) {
            plane.geometry.drawRange = { start: 0, count: Infinity };
          } else if (typeof plane.geometry.drawRange.count !== 'number') {
            plane.geometry.drawRange.count = Infinity;
          }
        }
        if (plane.material) {
          plane.material.visible = false;
          if (!plane.material.onBuild) plane.material.onBuild = function () {};
          if (!plane.material.onBeforeCompile) plane.material.onBeforeCompile = function () {};
        }
      }
    } catch (e) {}
  }
}
