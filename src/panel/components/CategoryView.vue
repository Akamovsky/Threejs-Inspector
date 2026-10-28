<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  state,
  selectObject,
  highlightObject,
  updateProperty
} from '../bridge';
import {
  Box,
  Sun,
  Camera as CameraIcon,
  Palette,
  Image as ImageIcon,
  Shapes,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Search
} from 'lucide-vue-next';

// Collapsible category sections state
const openSections = ref({
  meshes: true,
  lights: true,
  cameras: true,
  materials: true,
  textures: true,
  geometries: true
});

function toggleSection(section: keyof typeof openSections.value) {
  openSections.value[section] = !openSections.value[section];
}

const categories = computed(() => state.categories);

const filterQuery = computed(() => state.filterQuery.toLowerCase().trim());

const filteredMeshes = computed(() => {
  if (!categories.value?.meshes) return [];
  if (!filterQuery.value) return categories.value.meshes;
  return categories.value.meshes.filter(
    (m) =>
      m.name.toLowerCase().includes(filterQuery.value) ||
      m.type.toLowerCase().includes(filterQuery.value) ||
      m.geometryType.toLowerCase().includes(filterQuery.value)
  );
});

const filteredLights = computed(() => {
  if (!categories.value?.lights) return [];
  if (!filterQuery.value) return categories.value.lights;
  return categories.value.lights.filter(
    (l) =>
      l.name.toLowerCase().includes(filterQuery.value) ||
      l.type.toLowerCase().includes(filterQuery.value)
  );
});

const filteredCameras = computed(() => {
  if (!categories.value?.cameras) return [];
  if (!filterQuery.value) return categories.value.cameras;
  return categories.value.cameras.filter(
    (c) =>
      c.name.toLowerCase().includes(filterQuery.value) ||
      c.type.toLowerCase().includes(filterQuery.value)
  );
});

const filteredMaterials = computed(() => {
  if (!categories.value?.materials) return [];
  if (!filterQuery.value) return categories.value.materials;
  return categories.value.materials.filter(
    (mat) =>
      mat.name.toLowerCase().includes(filterQuery.value) ||
      mat.type.toLowerCase().includes(filterQuery.value)
  );
});

const filteredTextures = computed(() => {
  if (!categories.value?.textures) return [];
  if (!filterQuery.value) return categories.value.textures;
  return categories.value.textures.filter(
    (t) =>
      t.name.toLowerCase().includes(filterQuery.value) ||
      t.type.toLowerCase().includes(filterQuery.value)
  );
});

const filteredGeometries = computed(() => {
  if (!categories.value?.geometries) return [];
  if (!filterQuery.value) return categories.value.geometries;
  return categories.value.geometries.filter(
    (g) =>
      g.name.toLowerCase().includes(filterQuery.value) ||
      g.type.toLowerCase().includes(filterQuery.value)
  );
});

// Selection handler
function handleSelect(uuid: string) {
  selectObject(uuid);
}

function handleHover(uuid: string | null) {
  highlightObject(uuid);
}

function toggleMeshVisibility(e: MouseEvent, mesh: any) {
  e.stopPropagation();
  mesh.visible = !mesh.visible;
  updateProperty(mesh.uuid, ['visible'], mesh.visible);
}

function toggleLightVisibility(e: MouseEvent, light: any) {
  e.stopPropagation();
  light.visible = !light.visible;
  updateProperty(light.uuid, ['visible'], light.visible);
}
</script>

<template>
  <div class="category-view-container">
    <!-- Filter Input -->
    <div class="category-search-bar">
      <div class="search-input-wrapper">
        <Search :size="13" class="search-icon" />
        <input
          v-model="state.filterQuery"
          type="text"
          placeholder="Filter in categories..."
          spellcheck="false"
        />
      </div>
    </div>

    <!-- Category Sections List -->
    <div class="category-scroll-area">
      <div v-if="!categories" class="loading-state">
        Scanning scene categories...
      </div>

      <div v-else class="accordion-list">
        <!-- 1. MESHES -->
        <div class="category-group">
          <div class="category-header" @click="toggleSection('meshes')">
            <span class="chevron">
              <ChevronDown v-if="openSections.meshes" :size="12" />
              <ChevronRight v-else :size="12" />
            </span>
            <Box :size="13" class="cat-icon mesh" />
            <span class="cat-title">Meshes</span>
            <span class="count-badge">{{ filteredMeshes.length }}</span>
          </div>

          <div v-if="openSections.meshes" class="category-items">
            <div
              v-for="mesh in filteredMeshes"
              :key="mesh.uuid"
              class="cat-item-row"
              :class="{ selected: state.selectedUuid === mesh.uuid }"
              @click="handleSelect(mesh.uuid)"
              @mouseenter="handleHover(mesh.uuid)"
              @mouseleave="handleHover(null)"
            >
              <span
                v-if="mesh.materialColor"
                class="color-dot"
                :style="{ backgroundColor: mesh.materialColor }"
                :title="mesh.materialColor"
              ></span>
              <span class="item-name" :title="mesh.name">{{ mesh.name }}</span>
              <span class="geo-badge">{{ mesh.geometryType }}</span>
              <span class="faces-count">{{ mesh.facesCount }}△</span>
              <span
                class="visibility-toggle"
                @click="toggleMeshVisibility($event, mesh)"
                :title="mesh.visible ? 'Hide' : 'Show'"
              >
                <Eye v-if="mesh.visible" :size="11" />
                <EyeOff v-else :size="11" class="off" />
              </span>
            </div>
            <div v-if="filteredMeshes.length === 0" class="empty-cat">No meshes found</div>
          </div>
        </div>

        <!-- 2. LIGHTS -->
        <div class="category-group">
          <div class="category-header" @click="toggleSection('lights')">
            <span class="chevron">
              <ChevronDown v-if="openSections.lights" :size="12" />
              <ChevronRight v-else :size="12" />
            </span>
            <Sun :size="13" class="cat-icon light" />
            <span class="cat-title">Lights</span>
            <span class="count-badge">{{ filteredLights.length }}</span>
          </div>

          <div v-if="openSections.lights" class="category-items">
            <div
              v-for="light in filteredLights"
              :key="light.uuid"
              class="cat-item-row"
              :class="{ selected: state.selectedUuid === light.uuid }"
              @click="handleSelect(light.uuid)"
              @mouseenter="handleHover(light.uuid)"
              @mouseleave="handleHover(null)"
            >
              <span
                class="color-dot"
                :style="{ backgroundColor: light.color }"
                :title="light.color"
              ></span>
              <span class="item-name" :title="light.name">{{ light.name }}</span>
              <span class="type-badge">{{ light.type }}</span>
              <span class="intensity-badge">{{ light.intensity }}x</span>
              <span
                class="visibility-toggle"
                @click="toggleLightVisibility($event, light)"
                :title="light.visible ? 'Hide' : 'Show'"
              >
                <Eye v-if="light.visible" :size="11" />
                <EyeOff v-else :size="11" class="off" />
              </span>
            </div>
            <div v-if="filteredLights.length === 0" class="empty-cat">No lights found</div>
          </div>
        </div>

        <!-- 3. CAMERAS -->
        <div class="category-group">
          <div class="category-header" @click="toggleSection('cameras')">
            <span class="chevron">
              <ChevronDown v-if="openSections.cameras" :size="12" />
              <ChevronRight v-else :size="12" />
            </span>
            <CameraIcon :size="13" class="cat-icon camera" />
            <span class="cat-title">Cameras</span>
            <span class="count-badge">{{ filteredCameras.length }}</span>
          </div>

          <div v-if="openSections.cameras" class="category-items">
            <div
              v-for="cam in filteredCameras"
              :key="cam.uuid"
              class="cat-item-row"
              :class="{ selected: state.selectedUuid === cam.uuid }"
              @click="handleSelect(cam.uuid)"
              @mouseenter="handleHover(cam.uuid)"
              @mouseleave="handleHover(null)"
            >
              <span class="item-name" :title="cam.name">{{ cam.name }}</span>
              <span class="type-badge">{{ cam.type }}</span>
              <span v-if="cam.fov" class="fov-badge">{{ cam.fov }}° FOV</span>
            </div>
            <div v-if="filteredCameras.length === 0" class="empty-cat">No cameras found</div>
          </div>
        </div>

        <!-- 4. MATERIALS -->
        <div class="category-group">
          <div class="category-header" @click="toggleSection('materials')">
            <span class="chevron">
              <ChevronDown v-if="openSections.materials" :size="12" />
              <ChevronRight v-else :size="12" />
            </span>
            <Palette :size="13" class="cat-icon material" />
            <span class="cat-title">Materials</span>
            <span class="count-badge">{{ filteredMaterials.length }}</span>
          </div>

          <div v-if="openSections.materials" class="category-items">
            <div
              v-for="mat in filteredMaterials"
              :key="mat.uuid"
              class="cat-item-row"
              :class="{ selected: state.selectedUuid && mat.linkedObjectUuids.includes(state.selectedUuid) }"
              @click="mat.linkedObjectUuids[0] && handleSelect(mat.linkedObjectUuids[0])"
              @mouseenter="mat.linkedObjectUuids[0] && handleHover(mat.linkedObjectUuids[0])"
              @mouseleave="handleHover(null)"
              :title="mat.linkedObjectUuids[0] ? 'Click to inspect in scene' : undefined"
            >
              <span
                v-if="mat.color"
                class="color-dot"
                :style="{ backgroundColor: mat.color }"
              ></span>
              <span class="item-name" :title="mat.name">{{ mat.name }}</span>
              <span class="type-badge">{{ mat.type }}</span>
              <span class="users-badge" :title="`Used by ${mat.linkedObjectUuids.length} object(s)`">
                {{ mat.linkedObjectUuids.length }} users
              </span>
            </div>
            <div v-if="filteredMaterials.length === 0" class="empty-cat">No materials found</div>
          </div>
        </div>

        <!-- 5. TEXTURES -->
        <div class="category-group">
          <div class="category-header" @click="toggleSection('textures')">
            <span class="chevron">
              <ChevronDown v-if="openSections.textures" :size="12" />
              <ChevronRight v-else :size="12" />
            </span>
            <ImageIcon :size="13" class="cat-icon texture" />
            <span class="cat-title">Textures</span>
            <span class="count-badge">{{ filteredTextures.length }}</span>
          </div>

          <div v-if="openSections.textures" class="category-items">
            <div
              v-for="tex in filteredTextures"
              :key="tex.uuid"
              class="cat-item-row"
              :class="{ selected: state.selectedUuid && tex.linkedObjectUuids.includes(state.selectedUuid) }"
              @click="tex.linkedObjectUuids[0] && handleSelect(tex.linkedObjectUuids[0])"
              @mouseenter="tex.linkedObjectUuids[0] && handleHover(tex.linkedObjectUuids[0])"
              @mouseleave="handleHover(null)"
            >
              <img v-if="tex.dataUrl" :src="tex.dataUrl" class="cat-tex-thumb" />
              <span class="item-name" :title="tex.name">{{ tex.name }}</span>
              <span class="type-badge">{{ tex.type }}</span>
              <span v-if="tex.width && tex.height" class="res-badge">
                {{ tex.width }}x{{ tex.height }}
              </span>
            </div>
            <div v-if="filteredTextures.length === 0" class="empty-cat">No textures found</div>
          </div>
        </div>

        <!-- 6. GEOMETRIES -->
        <div class="category-group">
          <div class="category-header" @click="toggleSection('geometries')">
            <span class="chevron">
              <ChevronDown v-if="openSections.geometries" :size="12" />
              <ChevronRight v-else :size="12" />
            </span>
            <Shapes :size="13" class="cat-icon geometry" />
            <span class="cat-title">Geometries</span>
            <span class="count-badge">{{ filteredGeometries.length }}</span>
          </div>

          <div v-if="openSections.geometries" class="category-items">
            <div
              v-for="geo in filteredGeometries"
              :key="geo.uuid"
              class="cat-item-row"
              :class="{ selected: state.selectedUuid && geo.linkedObjectUuids.includes(state.selectedUuid) }"
              @click="geo.linkedObjectUuids[0] && handleSelect(geo.linkedObjectUuids[0])"
              @mouseenter="geo.linkedObjectUuids[0] && handleHover(geo.linkedObjectUuids[0])"
              @mouseleave="handleHover(null)"
            >
              <span class="item-name" :title="geo.name">{{ geo.name }}</span>
              <span class="geo-badge">{{ geo.type }}</span>
              <span class="faces-count">{{ geo.facesCount }}△</span>
              <span class="users-badge">{{ geo.linkedObjectUuids.length }} users</span>
            </div>
            <div v-if="filteredGeometries.length === 0" class="empty-cat">No geometries found</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

.category-search-bar {
  display: flex;
  align-items: center;
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

.category-scroll-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.loading-state {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 11.5px;
}

.category-group {
  border-bottom: 1px solid var(--border-subtle);
}

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  cursor: pointer;
  user-select: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  transition: background 0.15s;
}

.category-header:hover {
  background: var(--bg-hover);
}

.chevron {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
}

.cat-icon {
  flex-shrink: 0;
}

.cat-icon.mesh { color: #4ec9b0; }
.cat-icon.light { color: #facc15; }
.cat-icon.camera { color: #f87171; }
.cat-icon.material { color: #c084fc; }
.cat-icon.texture { color: #38bdf8; }
.cat-icon.geometry { color: #fb923c; }

.cat-title {
  flex: 1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.count-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--bg-tertiary);
  padding: 1px 5px;
  border-radius: 10px;
  color: var(--text-muted);
}

.category-items {
  display: flex;
  flex-direction: column;
}

.cat-item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px 0 20px;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.1s ease;
}

.cat-item-row:hover {
  background: var(--bg-hover);
}

.cat-item-row.selected {
  background: var(--bg-selected) !important;
  color: #ffffff !important;
  font-weight: 600;
  border-left: 3px solid var(--border-selected) !important;
  box-shadow: inset 0 0 10px rgba(56, 189, 248, 0.25);
}

.color-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-tex-thumb {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.geo-badge,
.type-badge,
.faces-count,
.intensity-badge,
.fov-badge,
.users-badge,
.res-badge {
  font-family: var(--font-mono);
  font-size: 9.5px;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  flex-shrink: 0;
}

.faces-count {
  color: #38bdf8;
}

.intensity-badge {
  color: #facc15;
}

.visibility-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.6;
}

.visibility-toggle:hover {
  opacity: 1;
  color: var(--text-bright);
}

.visibility-toggle .off {
  color: var(--text-error);
}

.empty-cat {
  padding: 6px 20px;
  font-size: 10.5px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
