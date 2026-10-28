import { PerspectiveCamera, Vector3, Box3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class DebugCameraManager {
  private debugCamera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private isActive = false;
  private canvas: HTMLCanvasElement | null = null;
  private onContextMenuBound: ((e: MouseEvent) => void) | null = null;

  // Saved state before focusing an object
  private savedStateBeforeFocus: {
    position: Vector3;
    target: Vector3;
    wasActiveBefore: boolean;
  } | null = null;
  private isFocused = false;

  public isEnabled(): boolean {
    return this.isActive;
  }

  public isFocusActive(): boolean {
    return this.isFocused;
  }

  public getControls(): OrbitControls | null {
    return this.controls;
  }

  public enable(domElement: HTMLCanvasElement, currentCamera?: any) {
    if (this.isActive) return;

    this.canvas = domElement;

    // Release any pointer lock
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (e) {}
    }

    const width = domElement.clientWidth || window.innerWidth || 800;
    const height = domElement.clientHeight || window.innerHeight || 600;
    const aspect = width / height;

    this.debugCamera = new PerspectiveCamera(
      currentCamera?.fov || 60,
      aspect,
      currentCamera?.near || 0.1,
      currentCamera?.far || 5000
    );
    this.debugCamera.name = '__THREE_INSPECTOR_DEBUG_CAM__';
    (this.debugCamera as any).__isInspectorCamera = true;

    if (currentCamera) {
      this.debugCamera.position.copy(currentCamera.position);
      this.debugCamera.quaternion.copy(currentCamera.quaternion);
      this.debugCamera.zoom = currentCamera.zoom || 1;
    } else {
      this.debugCamera.position.set(0, 5, 10);
      this.debugCamera.lookAt(0, 0, 0);
    }
    this.debugCamera.updateMatrixWorld(true);
    this.debugCamera.updateProjectionMatrix();

    try {
      this.controls = new OrbitControls(this.debugCamera, domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.screenSpacePanning = true;

      // Blender-style controls:
      // Left-click (0) = Orbit / Rotate
      // Scroll wheel = Zoom / Dolly
      // Right-click (2) = Pan / Move
      this.controls.mouseButtons = {
        LEFT: 0,
        MIDDLE: 1,
        RIGHT: 2
      };

      // Set initial orbit target 8 units in front of camera
      const dir = new Vector3();
      this.debugCamera.getWorldDirection(dir);
      this.controls.target.copy(this.debugCamera.position).addScaledVector(dir, 8);
      this.controls.update();

      // Prevent browser context menu on right-click pan
      this.onContextMenuBound = (e: MouseEvent) => {
        if (this.isActive) {
          e.preventDefault();
        }
      };
      domElement.addEventListener('contextmenu', this.onContextMenuBound);
    } catch (e) {
      console.warn('[Three.js Inspector] Failed to init OrbitControls:', e);
    }

    this.isActive = true;
  }

  public disable() {
    if (!this.isActive) return;

    if (this.canvas && this.onContextMenuBound) {
      this.canvas.removeEventListener('contextmenu', this.onContextMenuBound);
      this.onContextMenuBound = null;
    }

    if (this.controls) {
      try {
        this.controls.dispose();
      } catch (e) {}
      this.controls = null;
    }

    this.debugCamera = null;
    this.canvas = null;
    this.isActive = false;
    this.isFocused = false;
    this.savedStateBeforeFocus = null;
  }

  public update() {
    if (this.isActive && this.controls) {
      try {
        this.controls.update();
      } catch (e) {}
    }
  }

  public getCamera(fallback?: any): any {
    return this.isActive && this.debugCamera ? this.debugCamera : fallback;
  }

  public focusOn(targetObject: any, domElement: HTMLCanvasElement, currentCamera?: any): boolean {
    if (!targetObject) return false;

    // If already focused, toggle revert back to original
    if (this.isFocused) {
      this.revertFocus();
      return false;
    }

    const wasActiveBefore = this.isActive;
    if (!this.isActive) {
      this.enable(domElement, currentCamera);
    }

    if (!this.controls || !this.debugCamera) return false;

    // Cache camera position & target before focusing
    this.savedStateBeforeFocus = {
      position: this.debugCamera.position.clone(),
      target: this.controls.target.clone(),
      wasActiveBefore
    };
    this.isFocused = true;

    try {
      const box = new Box3();
      box.setFromObject(targetObject);

      const center = new Vector3();
      box.getCenter(center);

      const size = new Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z, 0.5);

      const fov = (this.debugCamera.fov * Math.PI) / 180;
      const distance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.35;

      const direction = new Vector3()
        .subVectors(this.debugCamera.position, center)
        .normalize();

      if (direction.lengthSq() < 0.001) {
        direction.set(0, 0.5, 1).normalize();
      }

      this.debugCamera.position.copy(center).addScaledVector(direction, Math.max(distance, 1.2));
      this.controls.target.copy(center);
      this.debugCamera.lookAt(center);
      this.debugCamera.updateMatrixWorld(true);
      this.debugCamera.updateProjectionMatrix();
      this.controls.update();
    } catch (e) {
      console.warn('[Three.js Inspector] Focus failed:', e);
    }
    return true;
  }

  public revertFocus(): boolean {
    if (!this.savedStateBeforeFocus) {
      this.isFocused = false;
      return false;
    }

    if (!this.savedStateBeforeFocus.wasActiveBefore) {
      // Revert completely to normal game camera!
      this.disable();
    } else if (this.controls && this.debugCamera) {
      // Revert to pre-focus position & orbit target
      try {
        this.debugCamera.position.copy(this.savedStateBeforeFocus.position);
        this.controls.target.copy(this.savedStateBeforeFocus.target);
        this.debugCamera.updateMatrixWorld(true);
        this.debugCamera.updateProjectionMatrix();
        this.controls.update();
      } catch (e) {}
    }

    this.savedStateBeforeFocus = null;
    this.isFocused = false;
    return true;
  }
}
