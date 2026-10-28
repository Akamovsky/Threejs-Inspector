import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class DebugCameraManager {
  private debugCamera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private isActive = false;
  private canvas: HTMLCanvasElement | null = null;
  private onContextMenuBound: ((e: MouseEvent) => void) | null = null;

  public isEnabled(): boolean {
    return this.isActive;
  }

  public getControls(): OrbitControls | null {
    return this.controls;
  }

  public enable(domElement: HTMLCanvasElement, currentCamera: any) {
    if (this.isActive) return;

    this.canvas = domElement;

    // Release any existing pointer lock
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
      // Left click (0) = Orbit / Rotate
      // Scroll wheel = Zoom / Dolly (handled by wheel event)
      // Right click (2) = Pan / Move
      this.controls.mouseButtons = {
        LEFT: 0,
        MIDDLE: 0,
        RIGHT: 2
      };

      // Set orbit target in front of camera
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
      console.warn('[Three.js Inspector] Failed to init OrbitControls on debug camera:', e);
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
      this.controls.dispose();
      this.controls = null;
    }

    this.debugCamera = null;
    this.canvas = null;
    this.isActive = false;
  }

  public update() {
    if (this.isActive && this.controls) {
      this.controls.update();
    }
  }

  public getCamera(fallback?: any): any {
    return this.isActive && this.debugCamera ? this.debugCamera : fallback;
  }
}
