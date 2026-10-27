<script setup lang="ts">
import { computed } from 'vue';
import { state } from '../bridge';
import { Activity, Cpu, Layers, Image as ImageIcon, Zap } from 'lucide-vue-next';

const stats = computed(() => state.stats);

const fpsColor = computed(() => {
  if (!stats.value) return 'var(--text-muted)';
  if (stats.value.fps >= 50) return '#4ade80';
  if (stats.value.fps >= 30) return '#facc15';
  return '#f87171';
});
</script>

<template>
  <div class="stats-container">
    <div v-if="!stats" class="no-stats">
      <Activity :size="20" class="activity-icon" />
      <span>Waiting for renderer stats...</span>
    </div>

    <div v-else class="stats-grid">
      <!-- FPS Card -->
      <div class="stat-card highlight">
        <div class="stat-header">
          <Activity :size="12" />
          <span>FPS</span>
        </div>
        <div class="stat-value big" :style="{ color: fpsColor }">
          {{ stats.fps }}
        </div>
        <div class="stat-sub">
          {{ stats.frameTime }} ms/frame
        </div>
      </div>

      <!-- Draw Calls -->
      <div class="stat-card">
        <div class="stat-header">
          <Zap :size="12" />
          <span>Draw Calls</span>
        </div>
        <div class="stat-value">
          {{ stats.calls.toLocaleString() }}
        </div>
        <div class="stat-sub">per frame</div>
      </div>

      <!-- Triangles -->
      <div class="stat-card">
        <div class="stat-header">
          <Layers :size="12" />
          <span>Triangles</span>
        </div>
        <div class="stat-value">
          {{ stats.triangles.toLocaleString() }}
        </div>
        <div class="stat-sub">rendered</div>
      </div>

      <!-- Memory / Geometries -->
      <div class="stat-card">
        <div class="stat-header">
          <Cpu :size="12" />
          <span>Geometries</span>
        </div>
        <div class="stat-value">
          {{ stats.geometries.toLocaleString() }}
        </div>
        <div class="stat-sub">in memory</div>
      </div>

      <!-- Textures -->
      <div class="stat-card">
        <div class="stat-header">
          <ImageIcon :size="12" />
          <span>Textures</span>
        </div>
        <div class="stat-value">
          {{ stats.textures.toLocaleString() }}
        </div>
        <div class="stat-sub">in memory</div>
      </div>

      <!-- Shaders -->
      <div class="stat-card">
        <div class="stat-header">
          <Cpu :size="12" />
          <span>Programs</span>
        </div>
        <div class="stat-value">
          {{ stats.programs }}
        </div>
        <div class="stat-sub">active shaders</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-container {
  padding: 8px 12px;
  background: var(--bg-primary);
  overflow-y: auto;
}

.no-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--text-muted);
  font-size: 11.5px;
}

.activity-icon {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.stat-card.highlight {
  border-color: rgba(78, 201, 176, 0.3);
  background: rgba(78, 201, 176, 0.03);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--text-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-bright);
}

.stat-value.big {
  font-size: 22px;
}

.stat-sub {
  font-size: 9.5px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
