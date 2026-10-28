import type { AnimationMixerInfo, AnimationClipInfo } from '../types/three-data';

export class AnimationManager {
  private registeredMixers = new Set<any>();

  public registerMixer(mixer: any) {
    if (mixer && !this.registeredMixers.has(mixer)) {
      this.registeredMixers.add(mixer);
    }
  }

  public scanScenesForMixers(scenes: Iterable<any>) {
    // Scan window
    const win = window as any;
    if (win.mixer && typeof win.mixer.update === 'function') {
      this.registerMixer(win.mixer);
    }
    if (Array.isArray(win.mixers)) {
      win.mixers.forEach((m: any) => this.registerMixer(m));
    }

    // Scan scene userData or roots
    for (const scene of scenes) {
      scene.traverse((obj: any) => {
        if (!obj) return;
        if (obj.mixer && typeof obj.mixer.update === 'function') {
          this.registerMixer(obj.mixer);
        }
        if (obj.animations && Array.isArray(obj.animations) && obj.animations.length > 0) {
          // If object has animations but no registered mixer yet, check if one can be created
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
    }
  }

  public getMixersData(): AnimationMixerInfo[] {
    const result: AnimationMixerInfo[] = [];

    let idx = 1;
    for (const mixer of this.registeredMixers) {
      const root = mixer.getRoot ? mixer.getRoot() : null;
      const rootUuid = root?.uuid || `mixer-${idx}`;
      const rootName = root?.name || `Animation Root (${idx})`;

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
            time = action.time || 0;
            speed = action.timeScale || 1;
          }
        } catch (e) {}

        clips.push({
          name: name || 'Unnamed Clip',
          duration: +(clip.duration || 0).toFixed(2),
          tracksCount: clip.tracks?.length || 0,
          isPlaying,
          time: +(time).toFixed(2),
          speed
        });
      }

      result.push({
        id: `mixer-${idx}`,
        rootUuid,
        rootName,
        clips
      });
      idx++;
    }

    return result;
  }

  public control(mixerId: string, clipName: string, action: 'play' | 'pause' | 'stop' | 'seek' | 'speed', value?: number) {
    let targetMixer: any = null;
    let idx = 1;
    for (const m of this.registeredMixers) {
      if (`mixer-${idx}` === mixerId) {
        targetMixer = m;
        break;
      }
      idx++;
    }

    if (!targetMixer) return;

    try {
      const root = targetMixer.getRoot ? targetMixer.getRoot() : null;
      const clip = root?.animations?.find((c: any) => c.name === clipName) || clipName;
      const act = targetMixer.clipAction(clip);
      if (!act) return;

      switch (action) {
        case 'play':
          act.paused = false;
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
            act.time = Math.max(0, Math.min(value, act.getClip().duration || 100));
          }
          break;
        case 'speed':
          if (typeof value === 'number') {
            act.setEffectiveTimeScale(value);
          }
          break;
      }
    } catch (e) {
      console.warn('[Three.js Inspector] Animation control error:', e);
    }
  }
}
