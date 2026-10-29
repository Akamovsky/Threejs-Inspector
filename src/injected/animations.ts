import type { AnimationMixerInfo, AnimationClipInfo } from '../types/three-data';

export class AnimationManager {
  private registeredMixers = new Set<any>();

  public registerMixer(mixer: any) {
    if (mixer && !this.registeredMixers.has(mixer)) {
      this.registeredMixers.add(mixer);
      this.hookMixerPrototype(mixer);
    }
  }

  // Automatically hook AnimationMixer prototype so any instantiated mixer is tracked
  public hookMixerPrototype(mixerInstance?: any) {
    try {
      const proto = mixerInstance?.constructor?.prototype || (window as any).THREE?.AnimationMixer?.prototype;
      if (proto && !proto.__INSPECTOR_MIXER_HOOKED__) {
        proto.__INSPECTOR_MIXER_HOOKED__ = true;
        const scope = this;
        const origUpdate = proto.update;
        proto.update = function (...args: any[]) {
          scope.registerMixer(this);
          return origUpdate.apply(this, args);
        };
      }
    } catch (e) {}
  }

  public scanScenesForMixers(scenes: Iterable<any>) {
    // Check global THREE.AnimationMixer prototype
    this.hookMixerPrototype();

    // Scan window
    const win = window as any;
    if (win.mixer && typeof win.mixer.update === 'function') {
      this.registerMixer(win.mixer);
    }
    if (Array.isArray(win.mixers)) {
      win.mixers.forEach((m: any) => this.registerMixer(m));
    }

    // Scan scene graphs
    for (const scene of scenes) {
      if (!scene || !scene.traverse) continue;
      try {
        scene.traverse((obj: any) => {
          if (!obj) return;
          if (obj.mixer && typeof obj.mixer.update === 'function') {
            this.registerMixer(obj.mixer);
          }
          if (obj.animations && Array.isArray(obj.animations) && obj.animations.length > 0) {
            if (!obj.__inspector_mixer) {
              try {
                const THREE = (window as any).THREE;
                if (THREE && THREE.AnimationMixer) {
                  obj.__inspector_mixer = new THREE.AnimationMixer(obj);
                  this.registerMixer(obj.__inspector_mixer);
                }
              } catch (e) {}
            }
          }
        });
      } catch (e) {}
    }
  }

  private getMixerId(mixer: any, idx: number): string {
    const root = mixer.getRoot ? mixer.getRoot() : null;
    return root?.uuid ? `mixer-${root.uuid}` : `mixer-${idx}`;
  }

  public getMixersData(): AnimationMixerInfo[] {
    const result: AnimationMixerInfo[] = [];

    let idx = 1;
    for (const mixer of this.registeredMixers) {
      const root = mixer.getRoot ? mixer.getRoot() : null;
      const rootUuid = root?.uuid || `mixer-${idx}`;
      const rootName = root?.name || `Animation Root (${idx})`;
      const mixerId = this.getMixerId(mixer, idx);

      const clips: AnimationClipInfo[] = [];
      const rootAnimations = root?.animations || [];

      // Collect known clips from root or internal actions
      const clipMap = new Map<string, any>();
      rootAnimations.forEach((c: any) => {
        if (c && c.name) clipMap.set(c.name, c);
      });

      if (mixer._actions && Array.isArray(mixer._actions)) {
        mixer._actions.forEach((act: any) => {
          const clip = act.getClip ? act.getClip() : null;
          if (clip && clip.name && !clipMap.has(clip.name)) {
            clipMap.set(clip.name, clip);
          }
        });
      }

      for (const [name, clip] of clipMap.entries()) {
        let isPlaying = false;
        let time = 0;
        let speed = 1;

        try {
          const action = mixer.existingAction ? mixer.existingAction(clip) : null;
          if (action) {
            isPlaying = action.isRunning ? action.isRunning() : false;
            time = typeof action.time === 'number' ? action.time : 0;
            const effective = typeof action.getEffectiveTimeScale === 'function' ? action.getEffectiveTimeScale() : action.timeScale;
            speed = typeof action.timeScale === 'number' ? action.timeScale : (typeof effective === 'number' ? effective : 1);
          }
        } catch (e) {}

        const duration = +(clip.duration || 0).toFixed(2);
        const normalizedTime = duration > 0 ? +((time % duration + duration) % duration).toFixed(2) : +(time).toFixed(2);

        clips.push({
          name: name || 'Unnamed Clip',
          duration,
          tracksCount: clip.tracks?.length || 0,
          isPlaying,
          time: normalizedTime,
          speed
        });
      }

      result.push({
        id: mixerId,
        rootUuid,
        rootName,
        clips
      });
      idx++;
    }

    return result;
  }

  public control(
    mixerId: string,
    clipName: string,
    action: 'play' | 'pause' | 'stop' | 'seek' | 'speed',
    value?: number
  ) {
    let targetMixer: any = null;
    let idx = 1;
    for (const m of this.registeredMixers) {
      if (this.getMixerId(m, idx) === mixerId || `mixer-${idx}` === mixerId) {
        targetMixer = m;
        break;
      }
      idx++;
    }

    if (!targetMixer) return;

    try {
      const root = targetMixer.getRoot ? targetMixer.getRoot() : null;
      let clip = root?.animations?.find((c: any) => c.name === clipName);

      if (!clip && targetMixer._actions && Array.isArray(targetMixer._actions)) {
        for (const a of targetMixer._actions) {
          const c = a.getClip ? a.getClip() : null;
          if (c && c.name === clipName) {
            clip = c;
            break;
          }
        }
      }

      if (!clip) clip = clipName;

      const act = targetMixer.clipAction ? targetMixer.clipAction(clip) : null;
      if (!act) return;

      switch (action) {
        case 'play':
          act.paused = false;
          act.enabled = true;
          if (act.timeScale === 0) {
            act.timeScale = 1;
          }
          act.play();
          break;

        case 'pause':
          act.paused = true;
          break;

        case 'stop':
          act.stop();
          break;

        case 'seek':
          if (typeof value === 'number') {
            const clipDur = (act.getClip ? act.getClip()?.duration : null) || 100;
            const clamped = Math.max(0, Math.min(value, clipDur));
            act.time = clamped;
            act.paused = true;
            // Force mixer to evaluate properties at the scrubbed timestamp immediately
            try {
              if (typeof targetMixer.update === 'function') {
                targetMixer.update(0);
              }
            } catch (e) {}
          }
          break;

        case 'speed':
          if (typeof value === 'number') {
            act.timeScale = value;
            if (typeof act.setEffectiveTimeScale === 'function') {
              act.setEffectiveTimeScale(value);
            }
          }
          break;
      }
    } catch (e) {
      console.warn('[Three.js Inspector] Animation control error:', e);
    }

    return this.getMixersData();
  }
}
