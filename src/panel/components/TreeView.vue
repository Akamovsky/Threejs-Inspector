<script setup lang="ts">
import { state, refresh, selectObject } from '../bridge';
import TreeNode from './TreeNode.vue';
import { Search, RefreshCw, Layers } from 'lucide-vue-next';
</script>

<template>
  <div class="tree-view-container" @click.self="selectObject(null)">
    <!-- Filter bar -->
    <div class="tree-search-bar">
      <div class="search-input-wrapper">
        <Search :size="13" class="search-icon" />
        <input
          v-model="state.filterQuery"
          type="text"
          placeholder="Filter scene objects..."
          spellcheck="false"
        />
      </div>
      <button class="icon-btn" @click="refresh" title="Refresh Scene Graph">
        <RefreshCw :size="12" />
      </button>
    </div>

    <!-- Tree Content -->
    <div class="tree-content-scroll" @click.self="selectObject(null)">
      <div v-if="state.scenes.length === 0" class="empty-state">
        <Layers :size="32" class="empty-icon" />
        <p class="empty-title">No Three.js Scene Found</p>
        <p class="empty-hint">
          Make sure your page creates a Three.js scene and renders with WebGLRenderer.
        </p>
        <button class="retry-btn" @click="refresh">
          <RefreshCw :size="12" />
          Refresh Detection
        </button>
      </div>

      <div v-else class="tree-nodes-list">
        <TreeNode
          v-for="scene in state.scenes"
          :key="scene.uuid"
          :node="scene"
          :depth="0"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

.tree-search-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 6px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input-wrapper input {
  width: 100%;
  padding-left: 24px;
  height: 24px;
}

.icon-btn {
  padding: 4px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tree-content-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80%;
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
}

.empty-icon {
  color: var(--border-color);
  margin-bottom: 12px;
}

.empty-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.empty-hint {
  font-size: 11px;
  line-height: 1.5;
  max-width: 260px;
  margin-bottom: 16px;
}

.retry-btn {
  background: var(--accent);
  color: white;
  border: none;
  padding: 5px 12px;
}
.retry-btn:hover {
  background: var(--accent-hover);
}
</style>
