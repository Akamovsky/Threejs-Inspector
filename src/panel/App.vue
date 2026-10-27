<script setup lang="ts">
import { ref } from 'vue';
import { state, toggleWireframe, refresh } from './bridge';
import TreeView from './components/TreeView.vue';
import Inspector from './components/Inspector.vue';
import StatsView from './components/StatsView.vue';
import {
  Grid,
  RefreshCw,
  Activity,
  Sliders,
  Box
} from 'lucide-vue-next';

const activeTab = ref<'inspector' | 'stats'>('inspector');
</script>

<template>
  <div class="panel-root">
    <!-- Top Bar -->
    <header class="panel-header">
      <div class="header-brand">
        <Box :size="15" class="brand-icon" />
        <span class="brand-title">Three.js</span>
        <span v-if="state.version" class="version-badge">
          {{ state.version }}
        </span>
      </div>

      <div class="header-center">
        <span class="status-indicator" :class="{ active: state.detected }"></span>
        <span class="status-text">{{ state.statusMessage }}</span>
      </div>

      <div class="header-actions">
        <!-- Wireframe Global Toggle -->
        <button
          class="action-btn"
          :class="{ active: state.wireframeActive }"
          @click="toggleWireframe"
          title="Toggle Global Wireframe"
        >
          <Grid :size="12" />
          Wireframe
        </button>

        <!-- Refresh -->
        <button class="action-btn" @click="refresh" title="Reload Scene">
          <RefreshCw :size="12" />
        </button>
      </div>
    </header>

    <!-- Main Workspace Split Pane -->
    <main class="panel-workspace">
      <!-- Left: Scene Graph Tree -->
      <section class="left-pane">
        <TreeView />
      </section>

      <!-- Right: Inspector & Performance Stats -->
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
            Performance
            <span v-if="state.stats" class="fps-pill">
              {{ state.stats.fps }} FPS
            </span>
          </button>
        </nav>

        <div class="tab-body">
          <Inspector v-show="activeTab === 'inspector'" />
          <StatsView v-show="activeTab === 'stats'" />
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
  height: 32px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  user-select: none;
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

.header-center {
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
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn.active {
  background: var(--bg-active);
  color: var(--text-bright);
  border-color: var(--accent);
}

.panel-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-pane {
  flex: 0 0 45%;
  min-width: 250px;
  max-width: 60%;
  height: 100%;
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
  border-bottom-color: var(--accent);
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

.tab-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
