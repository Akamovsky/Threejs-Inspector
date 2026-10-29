import { PerspectiveCamera, Vector3, Box3, DirectionalLight, AmbientLight } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class DebugCameraManager {
  private debugCamera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private headlight: DirectionalLight | null = null;
  private ambientLight: AmbientLight | null = null;
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
  private guideOverlayElement: HTMLElement | null = null;
  private hasSeenGuide = false;

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
    (this.debugCamera as any).__isInspectorObject = true;
    (this.debugCamera as any).__isInspectorCamera = true;

    if (currentCamera) {
      if (typeof currentCamera.getWorldPosition === 'function') {
        currentCamera.getWorldPosition(this.debugCamera.position);
        currentCamera.getWorldQuaternion(this.debugCamera.quaternion);
      } else if (currentCamera.position) {
        this.debugCamera.position.copy(currentCamera.position);
        this.debugCamera.quaternion.copy(currentCamera.quaternion);
      }
      this.debugCamera.zoom = currentCamera.zoom || 1;
    } else {
      this.debugCamera.position.set(0, 5, 10);
      this.debugCamera.lookAt(0, 0, 0);
    }
    this.debugCamera.updateMatrixWorld(true);
    this.debugCamera.updateProjectionMatrix();

    // Attach gentle headlights so dark levels/rooms are clearly visible in debug mode
    this.headlight = new DirectionalLight(0xffffff, 1.2);
    this.headlight.name = '__THREE_INSPECTOR_HEADLIGHT__';
    (this.headlight as any).__isInspectorObject = true;
    this.debugCamera.add(this.headlight);

    this.ambientLight = new AmbientLight(0xffffff, 0.4);
    this.ambientLight.name = '__THREE_INSPECTOR_AMBIENT__';
    (this.ambientLight as any).__isInspectorObject = true;
    this.debugCamera.add(this.ambientLight);

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

      // Set initial orbit target 6 units in front of camera
      const dir = new Vector3();
      this.debugCamera.getWorldDirection(dir);
      this.controls.target.copy(this.debugCamera.position).addScaledVector(dir, 6);
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
    this.showGuideHUD();
  }

  private showGuideHUD() {
    if (this.guideOverlayElement) {
      this.guideOverlayElement.remove();
      this.guideOverlayElement = null;
    }

    const el = document.createElement('div');
    el.id = '__three_inspector_debug_cam_guide__';
    el.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #090d16;
      color: #e2e8f0;
      padding: 14px 18px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      font-size: 12px;
      border: 1px solid #10b981;
      box-shadow: 0 20px 35px rgba(0, 0, 0, 0.85), 0 0 20px rgba(16, 185, 129, 0.25);
      z-index: 9999999;
      pointer-events: auto;
      backdrop-filter: blur(12px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      min-width: 270px;
      max-width: 320px;
    `;

    el.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;"></span>
          <span style="color: #10b981; font-weight: 700; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase;">Debug Camera Controls</span>
        </div>
        <button id="__three_inspector_guide_close__" style="
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 16px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
          transition: color 0.15s ease;
        " title="Dismiss Guide">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 11.5px; color: #94a3b8; border-top: 1px solid rgba(16, 185, 129, 0.15); padding-top: 10px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #cbd5e1;">Orbit / Rotate</span>
          <kbd style="background: #041c14; color: #34d399; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-family: monospace; border: 1px solid rgba(16, 185, 129, 0.4);">Left Click</kbd>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #cbd5e1;">Zoom In / Out</span>
          <kbd style="background: #041c14; color: #34d399; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-family: monospace; border: 1px solid rgba(16, 185, 129, 0.4);">Scroll Wheel</kbd>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #cbd5e1;">Pan Viewport</span>
          <kbd style="background: #041c14; color: #34d399; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-family: monospace; border: 1px solid rgba(16, 185, 129, 0.4);">Right Click</kbd>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end;">
        <button id="__three_inspector_guide_dismiss__" style="
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid #10b981;
          color: #34d399;
          border-radius: 4px;
          font-size: 11px;
          padding: 3px 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.15s ease;
        ">Got it</button>
      </div>
    `;

    document.body.appendChild(el);
    this.guideOverlayElement = el;

    const closeBtn = el.querySelector('#__three_inspector_guide_close__') as HTMLElement;
    const dismissBtn = el.querySelector('#__three_inspector_guide_dismiss__') as HTMLElement;

    if (closeBtn) {
      closeBtn.onmouseenter = () => { closeBtn.style.color = '#10b981'; };
      closeBtn.onmouseleave = () => { closeBtn.style.color = '#64748b'; };
    }
    if (dismissBtn) {
      dismissBtn.onmouseenter = () => { dismissBtn.style.background = 'rgba(16, 185, 129, 0.3)'; };
      dismissBtn.onmouseleave = () => { dismissBtn.style.background = 'rgba(16, 185, 129, 0.15)'; };
    }

    const hideGuide = () => {
      if (this.guideOverlayElement) {
        this.guideOverlayElement.style.opacity = '0';
        this.guideOverlayElement.style.transform = 'translateY(8px)';
        setTimeout(() => {
          if (this.guideOverlayElement) {
            this.guideOverlayElement.remove();
            this.guideOverlayElement = null;
          }
        }, 250);
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', hideGuide);
    if (dismissBtn) dismissBtn.addEventListener('click', hideGuide);
  }

  public disable() {
    if (!this.isActive) return;

    if (this.headlight && this.debugCamera) {
      this.debugCamera.remove(this.headlight);
      this.headlight.dispose?.();
      this.headlight = null;
    }

    if (this.ambientLight && this.debugCamera) {
      this.debugCamera.remove(this.ambientLight);
      this.ambientLight.dispose?.();
      this.ambientLight = null;
    }

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

    if (this.guideOverlayElement) {
      this.guideOverlayElement.remove();
      this.guideOverlayElement = null;
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
