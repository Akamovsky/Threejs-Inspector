<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { state, requestMemoryAudit, disposeResource } from '../bridge';
import {
  Activity,
  Cpu,
  Layers,
  Image as ImageIcon,
  Zap,
  HardDrive,
  AlertTriangle,
  Trash2,
  RefreshCw,
  TrendingUp
} from 'lucide-vue-next';

const stats = computed(() => state.stats);
const memoryAudit = computed(() => state.memoryAudit);
const canvasRef = ref<HTMLCanvasElement | null>(null);

// Rolling timeline history
const historyLength = 60;
const fpsHistory: number[] = [];
const callsHistory: number[] = [];

const fpsColor = computed(() => {
  if (!stats.value) return 'var(--text-muted)';
  if (stats.value.fps >= 50) return '#4ade80';
  if (stats.value.fps >= 30) return '#facc15';
  return '#f87171';
});

let animId: any = null;

function renderGraph() {
  if (!canvasRef.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Background grid
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.25);
  ctx.lineTo(width, height * 0.25);
  ctx.moveTo(0, height * 0.5);
  ctx.lineTo(width, height * 0.5);
  ctx.moveTo(0, height * 0.75);
  ctx.lineTo(width, height * 0.75);
  ctx.stroke();

  if (fpsHistory.length < 2) return;

  // Draw FPS line (Green)
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < fpsHistory.length; i++) {
    const x = (i / (historyLength - 1)) * width;
    const y = height - (Math.min(fpsHistory[i], 120) / 120) * (height - 8) - 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Gradient fill under FPS line
  ctx.lineTo(((fpsHistory.length - 1) / (historyLength - 1)) * width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgba(74, 222, 128, 0.25)');
  grad.addColorStop(1, 'rgba(74, 222, 128, 0.0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw Draw Calls line (Blue)
  if (callsHistory.length > 1) {
    const maxCalls = Math.max(50, ...callsHistory);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < callsHistory.length; i++) {
      const x = (i / (historyLength - 1)) * width;
      const y = height - (callsHistory[i] / maxCalls) * (height - 8) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

watch(
  () => state.stats,
  (newStats) => {
    if (!newStats) return;
    fpsHistory.push(newStats.fps);
    if (fpsHistory.length > historyLength) fpsHistory.shift();

    callsHistory.push(newStats.calls);
    if (callsHistory.length > historyLength) callsHistory.shift();

    renderGraph();
  }
);

onMounted(() => {
  requestMemoryAudit();
  renderGraph();
});

onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId);
});

const activeSection = ref<'overview' | 'memory'>('overview');
</script>

<template>
  <div class="stats-container">
    <!-- Sub Nav -->
    <div class="stats-sub-nav">
      <button
        class="nav-pill"
        :class="{ active: activeSection === 'overview' }"
        @click="activeSection = 'overview'"
      >
        <TrendingUp :size="12" />
        Overview & Timeline
      </button>
      <button
        class="nav-pill"
        :class="{ active: activeSection === 'memory' }"
        @click="activeSection = 'memory'; requestMemoryAudit()"
      >
        <HardDrive :size="12" />
        VRAM & Leak Detector
        <span v-if="memoryAudit?.orphansCount" class="orphan-count-badge">
          {{ memoryAudit.orphansCount }} leaks
        </span>
      </button>
    </div>

    <!-- OVERVIEW TAB -->
    <div v-show="activeSection === 'overview'" class="section-body">
      <!-- Performance Timeline Graph -->
      <div class="graph-card">
        <div class="graph-header">
          <span class="graph-title">Performance Timeline (60s)</span>
          <div class="graph-legend">
            <span class="legend-item fps"><span class="legend-dot fps-dot"></span> FPS</span>
            <span class="legend-item calls"><span class="legend-dot calls-dot"></span> Draw Calls</span>
          </div>
        </div>
        <canvas ref="canvasRef" width="340" height="90" class="timeline-canvas"></canvas>
      </div>

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
          <div class="stat-sub">{{ stats.frameTime }} ms/frame</div>
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

    <!-- VRAM & MEMORY AUDIT TAB -->
    <div v-show="activeSection === 'memory'" class="section-body">
      <div class="memory-header-row">
        <span class="section-subtitle">Estimated GPU VRAM Footprint</span>
        <button class="audit-btn" @click="requestMemoryAudit">
          <RefreshCw :size="11" />
          Re-Audit
        </button>
      </div>

      <div v-if="memoryAudit" class="vram-summary-cards">
        <div class="stat-card highlight">
          <div class="stat-header">Total VRAM</div>
          <div class="stat-value big" style="color: #38bdf8">
            {{ memoryAudit.totalVramMB }} MB
          </div>
          <div class="stat-sub">Textures + Geometries</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">Textures VRAM</div>
          <div class="stat-value">
            {{ memoryAudit.texturesVramMB }} MB
          </div>
          <div class="stat-sub">RGBA & Mipmaps</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">Geometries VRAM</div>
          <div class="stat-value">
            {{ memoryAudit.geometriesVramMB }} MB
          </div>
          <div class="stat-sub">Vertex & Index Buffers</div>
        </div>
      </div>

      <!-- Leak / Orphan Warning -->
      <div v-if="memoryAudit && memoryAudit.orphansCount > 0" class="leak-alert">
        <AlertTriangle :size="16" class="leak-icon" />
        <div class="leak-info">
          <strong>{{ memoryAudit.orphansCount }} Orphan Resource(s) Detected</strong>
          <span>These resources reside in GPU memory but are not attached to any scene object.</span>
        </div>
      </div>

      <!-- Resource Table -->
      <div v-if="memoryAudit && memoryAudit.resources.length > 0" class="resource-table-container">
        <table class="resource-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th>Details</th>
              <th>VRAM</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="res in memoryAudit.resources"
              :key="res.uuid"
              :class="{ 'orphan-row': !res.inScene }"
            >
              <td>
                <span class="type-pill" :class="res.type">{{ res.type }}</span>
              </td>
              <td class="res-name" :title="res.uuid">{{ res.name }}</td>
              <td class="res-dim">{{ res.details }}</td>
              <td class="res-mb">{{ res.memoryMB }} MB</td>
              <td>
                <span v-if="res.inScene" class="badge-in-scene">In Scene</span>
                <span v-else class="badge-orphan">Orphan</span>
              </td>
              <td>
                <button
                  v-if="!res.inScene"
                  class="dispose-btn"
                  @click="disposeResource(res.uuid, res.type)"
                  title="Dispose resource from GPU memory"
                >
                  <Trash2 :size="11" />
                  Dispose
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-container {
  padding: 10px 12px;
  background: var(--bg-primary);
  overflow-y: auto;
  height: 100%;
}

.stats-sub-nav {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: pointer;
}

.nav-pill:hover {
  background: var(--bg-hover);
  color: var(--text-bright);
}

.nav-pill.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 600;
}

.orphan-count-badge {
  background: #ef4444;
  color: white;
  padding: 1px 4px;
  font-size: 9px;
  border-radius: 3px;
  margin-left: 2px;
}

.graph-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 5px;
  padding: 8px 10px;
  margin-bottom: 12px;
}

.graph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.graph-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-bright);
}

.graph-legend {
  display: flex;
  gap: 10px;
  font-size: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.fps-dot {
  background: #4ade80;
}

.calls-dot {
  background: #38bdf8;
}

.timeline-canvas {
  width: 100%;
  height: 75px;
  border-radius: 3px;
  background: #141416;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
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
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.04);
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
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

.memory-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-subtitle {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}

.audit-btn {
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

.audit-btn:hover {
  background: var(--bg-hover);
  color: #38bdf8;
}

.vram-summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.leak-alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  margin-bottom: 10px;
  color: #f87171;
}

.leak-info {
  display: flex;
  flex-direction: column;
  font-size: 10.5px;
  gap: 2px;
}

.leak-info strong {
  color: #ef4444;
}

.resource-table-container {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.resource-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5px;
  text-align: left;
}

.resource-table th {
  padding: 5px 8px;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
}

.resource-table td {
  padding: 5px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.orphan-row {
  background: rgba(239, 68, 68, 0.04);
}

.type-pill {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
}

.type-pill.texture {
  background: rgba(217, 70, 239, 0.15);
  color: #d946ef;
}

.type-pill.geometry {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.res-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.res-dim {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
}

.res-mb {
  font-family: var(--font-mono);
  font-weight: 600;
}

.badge-in-scene {
  color: #4ade80;
  font-size: 9.5px;
}

.badge-orphan {
  color: #f87171;
  font-weight: 600;
  font-size: 9.5px;
}

.dispose-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  font-size: 9.5px;
  border-radius: 3px;
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  cursor: pointer;
}

.dispose-btn:hover {
  background: rgba(239, 68, 68, 0.25);
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
</style>
