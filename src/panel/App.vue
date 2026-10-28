<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  state,
  setGizmoMode,
  toggleDebugCamera,
  toggleWireframe,
  refresh
} from './bridge';
import TreeView from './components/TreeView.vue';
import CategoryView from './components/CategoryView.vue';
import Inspector from './components/Inspector.vue';
import StatsView from './components/StatsView.vue';
import AnimationView from './components/AnimationView.vue';
import EditsView from './components/EditsView.vue';
import {
  Grid,
  RefreshCw,
  Activity,
  Sliders,
  Box,
  FolderTree,
  Layers,
  Camera,
  Move,
  RotateCw,
  Maximize2,
  Film,
  History
} from 'lucide-vue-next';

const explorerView = ref<'hierarchy' | 'categories'>('hierarchy');
const activeTab = computed({
  get: () => state.activeTab,
  set: (val) => { state.activeTab = val; }
});
</script>

<template>
  <div class="panel-root">
    <!-- Top Bar -->
    <header class="panel-header">
      <div class="header-left">
        <div class="header-brand">
          <Box :size="15" class="brand-icon" />
          <span class="brand-title">Three.js</span>
          <span v-if="state.version" class="version-badge">
            {{ state.version }}
          </span>
        </div>

        <div class="header-status">
          <span class="status-indicator" :class="{ active: state.detected }"></span>
          <span class="status-text">{{ state.statusMessage }}</span>
        </div>
      </div>

      <div class="header-actions">
        <!-- 3D Transform Gizmo Buttons -->
        <div class="btn-group">
          <button
            class="action-btn icon-only"
            :class="{ active: state.gizmoMode === 'translate' }"
            @click="setGizmoMode(state.gizmoMode === 'translate' ? 'none' : 'translate')"
            title="Translate Gizmo (W)"
          >
            <Move :size="12" />
          </button>
          <button
            class="action-btn icon-only"
            :class="{ active: state.gizmoMode === 'rotate' }"
            @click="setGizmoMode(state.gizmoMode === 'rotate' ? 'none' : 'rotate')"
            title="Rotate Gizmo (E)"
          >
            <RotateCw :size="12" />
          </button>
          <button
            class="action-btn icon-only"
            :class="{ active: state.gizmoMode === 'scale' }"
            @click="setGizmoMode(state.gizmoMode === 'scale' ? 'none' : 'scale')"
            title="Scale Gizmo (R)"
          >
            <Maximize2 :size="12" />
          </button>
        </div>

        <!-- Free-fly / Debug Camera Toggle (Blender-style OrbitControls) -->
        <button
          class="action-btn"
          :class="{ active: state.debugCameraActive }"
          @click="toggleDebugCamera"
          title="Free/Roaming Debug Camera (Left-click: Orbit, Scroll: Zoom, Right-click: Pan)"
        >
          <Camera :size="12" />
          <span>{{ state.debugCameraActive ? 'Debug Cam (Active)' : 'Debug Camera' }}</span>
        </button>

        <!-- Global Wireframe Toggle -->
        <button
          class="action-btn"
          :class="{ active: state.wireframeActive }"
          @click="toggleWireframe"
          title="Toggle Global Wireframe"
        >
          <Grid :size="12" />
          <span>Wireframe</span>
        </button>

        <!-- Refresh -->
        <button class="action-btn icon-only" @click="refresh" title="Reload Scene">
          <RefreshCw :size="12" />
        </button>
      </div>
    </header>

    <!-- Main Workspace Split Pane -->
    <main class="panel-workspace">
      <!-- Left: Scene Explorer (Hierarchy Tree or Grouped Categories) -->
      <section class="left-pane">
        <!-- Explorer View Switcher -->
        <div class="explorer-mode-tabs">
          <button
            class="mode-btn"
            :class="{ active: explorerView === 'hierarchy' }"
            @click="explorerView = 'hierarchy'"
          >
            <FolderTree :size="12" />
            Hierarchy
          </button>
          <button
            class="mode-btn"
            :class="{ active: explorerView === 'categories' }"
            @click="explorerView = 'categories'"
          >
            <Layers :size="12" />
            Categories
          </button>
        </div>

        <div class="explorer-body">
          <TreeView v-show="explorerView === 'hierarchy'" />
          <CategoryView v-show="explorerView === 'categories'" />
        </div>
      </section>

      <!-- Right: Inspector, Performance & Memory, Animations, Session Edits -->
      <section class="right-pane">
        <nav class="sub-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'inspector' }"
            @click="activeTab = 'inspector'"
          >
            <Sliders :size="12" />
            Properties
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeTab === 'stats' }"
            @click="activeTab = 'stats'"
          >
            <Activity :size="12" />
            Performance & VRAM
            <span v-if="state.stats" class="fps-pill">
              {{ state.stats.fps }} FPS
            </span>
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeTab === 'animations' }"
            @click="activeTab = 'animations'"
          >
            <Film :size="12" />
            Animations
          </button>

          <button
            class="tab-btn"
            :class="{ active: activeTab === 'edits' }"
            @click="activeTab = 'edits'"
          >
            <History :size="12" />
            Session Edits
            <span v-if="state.sessionEdits.length > 0" class="edits-pill">
              {{ state.sessionEdits.length }}
            </span>
          </button>
        </nav>

        <div class="tab-body">
          <Inspector v-show="activeTab === 'inspector'" />
          <StatsView v-show="activeTab === 'stats'" />
          <AnimationView v-show="activeTab === 'animations'" />
          <EditsView v-show="activeTab === 'edits'" />
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.panel-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

.panel-header {
  height: 34px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  user-select: none;
  gap: 8px;
  overflow-x: auto;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 6px;
}

.brand-icon {
  color: #38bdf8;
}

.brand-title {
  font-weight: 700;
  font-size: 12px;
  color: var(--text-bright);
  letter-spacing: 0.3px;
}

.version-badge {
  font-family: var(--font-mono);
  font-size: 9.5px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  padding: 1px 5px;
  border-radius: 3px;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f87171;
}

.status-indicator.active {
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
}

.status-text {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  height: 24px;
  font-size: 11px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-bright);
}

.action-btn.active {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border-color: #38bdf8;
}

.action-btn.icon-only {
  padding: 0 7px;
}

.btn-group {
  display: flex;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  overflow: hidden;
}

.btn-group .action-btn {
  border: none;
  border-radius: 0;
  border-right: 1px solid var(--border-color);
}

.btn-group .action-btn:last-child {
  border-right: none;
}

.panel-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-pane {
  flex: 0 0 45%;
  min-width: 260px;
  max-width: 60%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.explorer-mode-tabs {
  display: flex;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 4px 6px 0 6px;
  gap: 4px;
}

.mode-btn {
  background: transparent;
  border: 1px solid transparent;
  border-bottom: none;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--text-muted);
  border-radius: 3px 3px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.mode-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.03);
}

.mode-btn.active {
  background: var(--bg-primary);
  color: var(--text-bright);
  border-color: var(--border-color);
}

.explorer-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.right-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

.sub-tabs {
  display: flex;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0 8px;
  gap: 4px;
}

.tab-btn {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 6px 10px;
  color: var(--text-muted);
  font-size: 11.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: transparent;
}

.tab-btn.active {
  color: var(--text-bright);
  border-bottom-color: #38bdf8;
  background: transparent;
}

.fps-pill {
  font-family: var(--font-mono);
  font-size: 9px;
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
  padding: 1px 4px;
  border-radius: 3px;
}

.edits-pill {
  font-family: var(--font-mono);
  font-size: 9px;
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  padding: 1px 4px;
  border-radius: 3px;
}

.tab-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
