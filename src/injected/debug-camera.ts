import {
  PerspectiveCamera,
  Vector3,
  Box3,
  Group,
  SpotLight,
  Object3D,
  Mesh,
  MeshBasicMaterial,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  MathUtils,
  AdditiveBlending,
  DoubleSide
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class DebugCameraManager {
  private debugCamera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private flashlightRig: Group | null = null;
  private flashlight: SpotLight | null = null;
  private flashlightTarget: Object3D | null = null;
  private scene: any = null;
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

  public enable(domElement: HTMLCanvasElement, currentCamera?: any, scene?: any) {
    if (this.isActive) return;

    this.canvas = domElement;
    this.scene = scene || null;

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

    // Proper flashlight: warm SpotLight + visible housing + volumetric beam.
    // The rig lives in the scene graph (lights parented to an out-of-scene
    // camera are never collected by the renderer and would do nothing).
    this.buildFlashlight();

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

  // ---------------------------------------------------------------
  // Flashlight: warm SpotLight + visible torch housing + volumetric beam
  // ---------------------------------------------------------------
  private buildFlashlight() {
    try {
      const rig = new Group();
      rig.name = '__THREE_INSPECTOR_FLASHLIGHT_RIG__';
      (rig as any).__isInspectorObject = true;

      // The aim group sits at the lens and tilts the beam slightly inward so
      // the cone converges toward the center of the view, like a held torch.
      const aim = new Group();
      aim.name = '__THREE_INSPECTOR_FLASHLIGHT_AIM__';
      (aim as any).__isInspectorObject = true;
      const lensPos = new Vector3(0.27, -0.2, -0.45);
      const converge = new Vector3(0.05, -0.01, -12);
      const aimDir = converge.clone().sub(lensPos).normalize();
      aim.position.copy(lensPos);
      aim.quaternion.setFromUnitVectors(new Vector3(0, 0, -1), aimDir);
      rig.add(aim);

      // Warm halogen spot doing the actual lighting (physical falloff, soft edge)
      const spot = new SpotLight(0xffe3b3, 260, 90, 0.46, 0.45, 1.6);
      spot.name = '__THREE_INSPECTOR_FLASHLIGHT__';
      (spot as any).__isInspectorObject = true;
      const target = new Object3D();
      target.name = '__THREE_INSPECTOR_FLASHLIGHT_TARGET__';
      (target as any).__isInspectorObject = true;
      target.position.set(0, 0, -14);
      spot.target = target;
      aim.add(spot);
      aim.add(target);
      this.flashlight = spot;
      this.flashlightTarget = target;

      // Older host Three.js bundles call onBuild/onBeforeCompile when present;
      // guard our materials the same way the gizmo helpers do.
      const guardMaterial = (m: MeshBasicMaterial) => {
        const mm = m as any;
        if (!mm.onBuild) mm.onBuild = function () {};
        if (!mm.onBeforeCompile) mm.onBeforeCompile = function () {};
        return m;
      };

      // Volumetric beam: two soft additive cones (apex at the lens, -Z forward)
      const makeBeamCone = (radius: number, segments: number, opacity: number, color: number) => {
        const geo = new ConeGeometry(radius, 16, segments, 1, true);
        geo.translate(0, -8, 0); // apex at origin, base at y = -16
        const mat = guardMaterial(new MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          blending: AdditiveBlending,
          depthWrite: false,
          fog: false,
          toneMapped: false,
          side: DoubleSide
        }));
        const mesh = new Mesh(geo, mat);
        mesh.rotation.x = Math.PI / 2; // cone axis +Y -> -Z (camera forward)
        mesh.position.z = -0.25;
        mesh.renderOrder = 2;
        return mesh;
      };

      const beamOuter = makeBeamCone(4.6, 32, 0.09, 0xffdfae);
      const beamInner = makeBeamCone(2.1, 24, 0.16, 0xfff3d6);

      // Sleek tactical torch, assembled backward from the lens (+Z = toward camera):
      // slim tapered body, lighter shroud, emerald accent rings, glowing lens.
      const makePart = (geo: CylinderGeometry, z: number, color: number) => {
        const mesh = new Mesh(geo, guardMaterial(new MeshBasicMaterial({ color })));
        mesh.rotation.x = -Math.PI / 2; // cylinder axis +Y -> -Z (radiusTop faces the lens)
        mesh.position.z = z;
        return mesh;
      };

      const body = makePart(new CylinderGeometry(0.032, 0.038, 0.7, 24), 0.48, 0x2a3038);
      const shroud = makePart(new CylinderGeometry(0.048, 0.036, 0.16, 24), 0.1, 0x39424f);
      const bezel = makePart(new CylinderGeometry(0.05, 0.05, 0.02, 24), 0.01, 0x10b981);
      const stripe = makePart(new CylinderGeometry(0.0345, 0.0345, 0.05, 24), 0.62, 0x10b981);
      const tail = makePart(new CylinderGeometry(0.034, 0.028, 0.08, 24), 0.86, 0x171b22);

      // Glowing lens: a sphere reads from every viewing angle; the halo adds bloom
      const lensMat = guardMaterial(new MeshBasicMaterial({
        color: 0xfff3d9,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false
      }));
      const lens = new Mesh(new SphereGeometry(0.042, 20, 14), lensMat);
      lens.renderOrder = 3;

      const haloMat = guardMaterial(new MeshBasicMaterial({
        color: 0xffdfae,
        transparent: true,
        opacity: 0.3,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false
      }));
      const halo = new Mesh(new SphereGeometry(0.075, 20, 14), haloMat);
      halo.renderOrder = 3;

      aim.add(beamOuter, beamInner, body, shroud, bezel, stripe, tail, lens, halo);
      rig.traverse((node: any) => {
        (node as any).__isInspectorObject = true;
      });

      this.flashlightRig = rig;
      if (this.scene) {
        this.scene.add(rig);
        this.syncFlashlightRig();
      }
    } catch (e) {
      console.warn('[Three.js Inspector] Failed to build flashlight:', e);
    }
  }

  private syncFlashlightRig() {
    if (!this.flashlightRig || !this.debugCamera) return;
    try {
      this.flashlightRig.position.copy(this.debugCamera.position);
      this.flashlightRig.quaternion.copy(this.debugCamera.quaternion);
      // Scale the whole torch with the working distance so it reads correctly
      // in both tiny and huge scenes
      const dist = this.controls
        ? this.debugCamera.position.distanceTo(this.controls.target)
        : 10;
      this.flashlightRig.scale.setScalar(MathUtils.clamp(dist / 12, 0.25, 4));
    } catch (e) {}
  }

  private teardownFlashlight() {
    if (this.flashlightRig) {
      if (this.scene) {
        try { this.scene.remove(this.flashlightRig); } catch (e) {}
      }
      this.flashlightRig.traverse((node: any) => {
        try {
          node.geometry?.dispose?.();
          const m = node.material;
          if (Array.isArray(m)) m.forEach((mm: any) => mm?.dispose?.());
          else m?.dispose?.();
        } catch (e) {}
      });
      this.flashlightRig = null;
    }
    try { this.flashlight?.dispose?.(); } catch (e) {}
    this.flashlight = null;
    this.flashlightTarget = null;
  }

  public disable() {
    if (!this.isActive) return;

    this.teardownFlashlight();
    this.scene = null;

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
    if (!this.isActive) return;
    if (this.controls) {
      try {
        this.controls.update();
      } catch (e) {}
    }
    this.syncFlashlightRig();
  }

  public getCamera(fallback?: any): any {
    return this.isActive && this.debugCamera ? this.debugCamera : fallback;
  }

  public focusOn(targetObject: any, domElement: HTMLCanvasElement, currentCamera?: any, scene?: any): boolean {
    if (!targetObject) return false;

    // If already focused, toggle revert back to original
    if (this.isFocused) {
      this.revertFocus();
      return false;
    }

    const wasActiveBefore = this.isActive;
    if (!this.isActive) {
      this.enable(domElement, currentCamera, scene);
    } else if (scene && this.flashlightRig && !this.flashlightRig.parent) {
      // Already active but the rig never got a scene (first enable had none)
      this.scene = scene;
      try {
        scene.add(this.flashlightRig);
        this.syncFlashlightRig();
      } catch (e) {}
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
