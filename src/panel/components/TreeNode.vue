<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { SerializedNode } from '../../types/three-data';
import {
  state,
  selectObject,
  highlightObject,
  updateProperty
} from '../bridge';
import {
  ChevronRight,
  ChevronDown,
  Box,
  Folder,
  Camera,
  Sun,
  Eye,
  EyeOff,
  CircleDot,
  Layers
} from 'lucide-vue-next';

const props = defineProps<{
  node: SerializedNode;
  depth?: number;
}>();

const currentDepth = computed(() => props.depth || 0);
const isExpanded = ref(true);

const isSelected = computed(() => state.selectedUuid === props.node.uuid);

function containsSelected(node: SerializedNode, targetUuid: string | null): boolean {
  if (!targetUuid) return false;
  if (node.uuid === targetUuid) return true;
  if (!node.children || node.children.length === 0) return false;
  return node.children.some((child) => containsSelected(child, targetUuid));
}

watch(
  () => state.selectedUuid,
  (newUuid) => {
    if (newUuid && containsSelected(props.node, newUuid)) {
      isExpanded.value = true;
    }
  },
  { immediate: true }
);

function toggleExpand(e: MouseEvent) {
  e.stopPropagation();
  isExpanded.value = !isExpanded.value;
}

function handleSelect() {
  selectObject(props.node.uuid);
}

function handleMouseEnter() {
  highlightObject(props.node.uuid);
}

function handleMouseLeave() {
  highlightObject(null);
}

function toggleVisibility(e: MouseEvent) {
  e.stopPropagation();
  const nextVisible = !props.node.visible;
  props.node.visible = nextVisible;
  updateProperty(props.node.uuid, ['visible'], nextVisible);
}

// Icon selection based on Three.js object type
const nodeIcon = computed(() => {
  const type = props.node.type?.toLowerCase() || '';
  if (type.includes('camera')) return Camera;
  if (type.includes('light')) return Sun;
  if (type.includes('group') || type.includes('scene')) return Folder;
  if (type.includes('points') || type.includes('particles')) return CircleDot;
  if (type.includes('line')) return Layers;
  return Box;
});

// Color badge for type
const typeColor = computed(() => {
  const type = props.node.type?.toLowerCase() || '';
  if (type.includes('mesh')) return 'var(--type-mesh)';
  if (type.includes('group')) return 'var(--type-group)';
  if (type.includes('scene')) return 'var(--type-scene)';
  if (type.includes('camera')) return 'var(--type-camera)';
  if (type.includes('light')) return 'var(--type-light)';
  return 'var(--text-accent)';
});

// Filter matching
const matchesFilter = computed(() => {
  if (!state.filterQuery) return true;
  const q = state.filterQuery.toLowerCase();
  return (
    props.node.name.toLowerCase().includes(q) ||
    props.node.type.toLowerCase().includes(q)
  );
});
</script>

<template>
  <div class="tree-node-wrapper" v-show="matchesFilter || node.children.length > 0">
    <div
      class="tree-node-row"
      :class="{ selected: isSelected }"
      :style="{ paddingLeft: `${currentDepth * 16 + 6}px` }"
      @click="handleSelect"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <!-- Expand chevron -->
      <span
        class="chevron-btn"
        @click="toggleExpand"
        :class="{ invisible: node.childrenCount === 0 }"
      >
        <ChevronDown v-if="isExpanded" :size="12" />
        <ChevronRight v-else :size="12" />
      </span>

      <!-- Type Icon -->
      <component
        :is="nodeIcon"
        :size="13"
        class="node-icon"
        :style="{ color: typeColor }"
      />

      <!-- Node Name -->
      <span class="node-name" :title="node.name">
        {{ node.name }}
      </span>

      <!-- Node Type Badge -->
      <span class="node-type" :style="{ color: typeColor }">
        {{ node.type }}
      </span>

      <!-- Visibility Toggle -->
      <span class="visibility-btn" @click="toggleVisibility" :title="node.visible ? 'Hide' : 'Show'">
        <Eye v-if="node.visible" :size="12" class="eye-on" />
        <EyeOff v-else :size="12" class="eye-off" />
      </span>
    </div>

    <!-- Recursive Children -->
    <div v-if="isExpanded && node.children && node.children.length > 0" class="tree-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.uuid"
        :node="child"
        :depth="currentDepth + 1"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-node-wrapper {
  display: flex;
  flex-direction: column;
}

.tree-node-row {
  display: flex;
  align-items: center;
  height: 24px;
  cursor: pointer;
  border-radius: 2px;
  padding-right: 8px;
  gap: 6px;
  transition: background 0.1s ease;
}

.tree-node-row:hover {
  background: var(--bg-hover);
}

.tree-node-row.selected {
  background: var(--bg-selected);
  color: var(--text-bright);
}

.chevron-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  cursor: pointer;
}

.chevron-btn.invisible {
  visibility: hidden;
}

.chevron-btn:hover {
  color: var(--text-bright);
}

.node-icon {
  flex-shrink: 0;
}

.node-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11.5px;
}

.node-type {
  font-size: 10px;
  font-family: var(--font-mono);
  opacity: 0.75;
  margin-left: auto;
  padding: 1px 4px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
}

.visibility-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  border-radius: 2px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s, color 0.15s;
}

.visibility-btn:hover {
  opacity: 1;
  color: var(--text-bright);
}

.eye-off {
  color: var(--text-error);
}
</style>
