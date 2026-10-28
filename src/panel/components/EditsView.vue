<script setup lang="ts">
import { computed } from 'vue';
import { state, exportEditsJSON } from '../bridge';
import { FileJson, Download, Trash2, History } from 'lucide-vue-next';

const edits = computed(() => state.sessionEdits);

function clearEdits() {
  state.sessionEdits = [];
}
</script>

<template>
  <div class="edits-container">
    <div class="edits-header-row">
      <div class="title-with-count">
        <span class="edits-section-title">Session Modifications</span>
        <span class="count-tag">{{ edits.length }}</span>
      </div>
      <div class="edits-actions">
        <button
          v-if="edits.length > 0"
          class="export-btn"
          @click="exportEditsJSON"
          title="Download changes as JSON diff"
        >
          <Download :size="11" />
          Export JSON
        </button>
        <button
          v-if="edits.length > 0"
          class="clear-btn"
          @click="clearEdits"
          title="Clear session edit history"
        >
          <Trash2 :size="11" />
        </button>
      </div>
    </div>

    <div v-if="edits.length === 0" class="no-edits">
      <History :size="24" class="history-icon" />
      <span>No changes recorded yet in this session.</span>
      <span class="sub-tip">Edits to positions, lights, colors, and materials will appear here.</span>
    </div>

    <div v-else class="edits-list">
      <div v-for="edit in edits" :key="edit.id" class="edit-item">
        <div class="edit-header">
          <span class="object-badge">{{ edit.objectName }}</span>
          <span class="prop-key">{{ edit.path }}</span>
          <span class="edit-time">{{ new Date(edit.timestamp).toLocaleTimeString() }}</span>
        </div>
        <div class="edit-value-box">
          <code>{{ typeof edit.value === 'object' ? JSON.stringify(edit.value) : edit.value }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edits-container {
  padding: 10px 12px;
  background: var(--bg-primary);
  overflow-y: auto;
  height: 100%;
}

.edits-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.title-with-count {
  display: flex;
  align-items: center;
  gap: 6px;
}

.edits-section-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-bright);
}

.count-tag {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  font-size: 9.5px;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
}

.edits-actions {
  display: flex;
  gap: 5px;
}

.export-btn {
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

.export-btn:hover {
  background: var(--bg-hover);
  color: #38bdf8;
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  padding: 2px 5px;
  font-size: 10px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: pointer;
}

.clear-btn:hover {
  color: #f87171;
  background: var(--bg-hover);
}

.no-edits {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 32px 16px;
  color: var(--text-muted);
  font-size: 11px;
  text-align: center;
}

.history-icon {
  opacity: 0.4;
  margin-bottom: 4px;
}

.sub-tip {
  font-size: 9.5px;
  opacity: 0.6;
}

.edits-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.edit-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.edit-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.object-badge {
  font-weight: 600;
  color: var(--text-bright);
}

.prop-key {
  color: #38bdf8;
  font-family: var(--font-mono);
}

.edit-time {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 9px;
  font-family: var(--font-mono);
}

.edit-value-box {
  background: var(--bg-primary);
  border-radius: 3px;
  padding: 3px 6px;
}

.edit-value-box code {
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: #4ade80;
  word-break: break-all;
}
</style>
