<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { state, requestAnimations, controlAnimation } from '../bridge';
import { Play, Pause, Square, FastForward, Film, RefreshCw } from 'lucide-vue-next';

const animations = computed(() => state.animations);
const seekingClips = ref<Record<string, boolean>>({});

let pollInterval: any = null;

function startPolling() {
  if (pollInterval) return;
  requestAnimations();
  pollInterval = setInterval(() => {
    if (state.activeTab === 'animations' && Object.keys(seekingClips.value).length === 0) {
      requestAnimations();
    }
  }, 150);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

watch(
  () => state.activeTab,
  (tab) => {
    if (tab === 'animations') {
      startPolling();
    } else {
      stopPolling();
    }
  },
  { immediate: true }
);

onMounted(() => {
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});

function handleSeekInput(mixerId: string, clipName: string, e: Event) {
  const val = +((e.target as HTMLInputElement).value);
  seekingClips.value[`${mixerId}:${clipName}`] = true;

  // Optimistically update the UI time readout immediately
  const mixer = state.animations.find((m) => m.id === mixerId);
  const clip = mixer?.clips.find((c) => c.name === clipName);
  if (clip) {
    clip.time = +val.toFixed(2);
  }

  controlAnimation(mixerId, clipName, 'seek', val);
}

function handleSeekChange(mixerId: string, clipName: string) {
  setTimeout(() => {
    delete seekingClips.value[`${mixerId}:${clipName}`];
  }, 100);
}

function handleSpeedChange(mixerId: string, clipName: string, speed: number) {
  const mixer = state.animations.find((m) => m.id === mixerId);
  const clip = mixer?.clips.find((c) => c.name === clipName);
  if (clip) {
    clip.speed = speed;
  }
  controlAnimation(mixerId, clipName, 'speed', speed);
}
</script>

<template>
  <div class="anim-container">
    <div class="anim-header-row">
      <span class="anim-section-title">Animation Mixers & Clips</span>
      <button class="anim-refresh-btn" @click="requestAnimations">
        <RefreshCw :size="11" />
        Refresh
      </button>
    </div>

    <div v-if="animations.length === 0" class="no-animations">
      <Film :size="24" class="film-icon" />
      <span>No active AnimationMixers or clips detected in the scene</span>
    </div>

    <div v-else class="mixers-list">
      <div v-for="mixer in animations" :key="mixer.id" class="mixer-card">
        <div class="mixer-header">
          <Film :size="12" class="mixer-icon" />
          <span class="mixer-title">{{ mixer.rootName }}</span>
        </div>

        <div v-if="mixer.clips.length === 0" class="no-clips">
          No clips attached to this mixer.
        </div>

        <div v-else class="clips-list">
          <div v-for="clip in mixer.clips" :key="clip.name" class="clip-row">
            <div class="clip-info">
              <span class="clip-name">{{ clip.name }}</span>
              <span class="clip-meta">{{ clip.duration }}s ({{ clip.tracksCount }} tracks)</span>
            </div>

            <!-- Controls -->
            <div class="clip-actions">
              <button
                class="ctrl-btn play"
                :class="{ active: clip.isPlaying }"
                @click="controlAnimation(mixer.id, clip.name, 'play')"
                title="Play animation"
              >
                <Play :size="11" />
              </button>
              <button
                class="ctrl-btn pause"
                :class="{ active: !clip.isPlaying && clip.time > 0 }"
                @click="controlAnimation(mixer.id, clip.name, 'pause')"
                title="Pause animation"
              >
                <Pause :size="11" />
              </button>
              <button
                class="ctrl-btn stop"
                @click="controlAnimation(mixer.id, clip.name, 'stop')"
                title="Stop animation"
              >
                <Square :size="10" />
              </button>
            </div>

            <!-- Timeline Scrubber -->
            <div class="clip-slider-row">
              <input
                type="range"
                min="0"
                :max="clip.duration || 10"
                step="0.05"
                :value="clip.time"
                @input="handleSeekInput(mixer.id, clip.name, $event)"
                @change="handleSeekChange(mixer.id, clip.name)"
                class="timeline-slider"
              />
              <span class="time-readout">{{ clip.time }}s / {{ clip.duration }}s</span>
            </div>

            <!-- Playback Speed -->
            <div class="speed-row">
              <FastForward :size="10" class="speed-icon" />
              <span class="speed-label">Speed:</span>
              <button
                v-for="s in [0.25, 0.5, 1, 1.5, 2]"
                :key="s"
                class="speed-pill"
                :class="{ active: Math.abs((clip.speed || 1) - s) < 0.01 }"
                @click="handleSpeedChange(mixer.id, clip.name, s)"
              >
                {{ s }}x
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.anim-container {
  padding: 10px 12px;
  background: var(--bg-primary);
  overflow-y: auto;
  height: 100%;
}

.anim-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.anim-section-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-bright);
}

.anim-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  font-size: 10px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.anim-refresh-btn:hover {
  background: var(--bg-hover);
  color: #38bdf8;
}

.no-animations {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--text-muted);
  font-size: 11px;
  text-align: center;
}

.film-icon {
  opacity: 0.4;
}

.mixers-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mixer-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 8px 10px;
}

.mixer-header {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-bright);
}

.mixer-icon {
  color: #38bdf8;
}

.clips-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clip-row {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.clip-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clip-name {
  font-weight: 600;
  font-size: 11px;
  color: var(--text-bright);
}

.clip-meta {
  font-size: 9.5px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.clip-actions {
  display: flex;
  gap: 5px;
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 20px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.ctrl-btn:hover {
  background: var(--bg-hover);
}

.ctrl-btn.play.active {
  color: #4ade80;
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.15);
}

.ctrl-btn.pause.active {
  color: #facc15;
  border-color: #facc15;
  background: rgba(250, 204, 21, 0.15);
}

.ctrl-btn.play:hover {
  color: #4ade80;
  border-color: #4ade80;
}

.ctrl-btn.pause:hover {
  color: #facc15;
  border-color: #facc15;
}

.ctrl-btn.stop:hover {
  color: #f87171;
  border-color: #f87171;
}

.clip-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-slider {
  flex: 1;
  height: 4px;
  accent-color: #38bdf8;
  cursor: pointer;
}

.time-readout {
  font-size: 9.5px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.speed-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--text-muted);
}

.speed-icon {
  opacity: 0.6;
}

.speed-pill {
  padding: 1px 4px;
  font-size: 9px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: pointer;
}

.speed-pill.active {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 600;
}

.no-clips {
  font-size: 10px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
