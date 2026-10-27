<script setup lang="ts">
import { computed } from 'vue';
import { state, updateProperty, inspectInConsole, toggleLockTransform } from '../bridge';
import {
  Terminal,
  Move,
  RotateCw,
  Maximize2,
  Box,
  Palette,
  Sun,
  Camera as CameraIcon,
  Info,
  Lock,
  Unlock
} from 'lucide-vue-next';

const obj = computed(() => state.selectedObject);

function update(path: string[], value: any) {
  if (!obj.value) return;
  updateProperty(obj.value.uuid, path, value);
}

function handleConsoleLog() {
  if (!obj.value) return;
  inspectInConsole(obj.value.uuid);
}

// Ensure single material access
const activeMaterial = computed(() => {
  if (!obj.value?.material) return null;
  if (Array.isArray(obj.value.material)) {
    return obj.value.material[0] || null;
  }
  return obj.value.material;
});
</script>

<template>
  <div class="inspector-container">
    <div v-if="!obj" class="empty-inspector">
      <Info :size="24" class="info-icon" />
      <p>Select an object from the scene tree to inspect its properties.</p>
    </div>

    <div v-else class="inspector-content">
      <!-- Header / Summary -->
      <div class="inspector-header">
        <div class="title-row">
          <span class="obj-name">{{ obj.name }}</span>
          <button class="console-btn" @click="handleConsoleLog" title="Expose to console as $three">
            <Terminal :size="12" />
            $three
          </button>
        </div>
        <div class="meta-row">
          <span class="meta-badge type">{{ obj.type }}</span>
          <span class="meta-badge uuid" :title="obj.uuid">UUID: {{ obj.uuid.slice(0, 8) }}...</span>
          <span class="meta-badge id">ID: {{ obj.id }}</span>
        </div>
      </div>

      <!-- Transform Card -->
      <div class="section-card">
        <div class="section-title transform-title">
          <div class="title-left">
            <Move :size="13" class="section-icon" />
            Transform
          </div>
          <button
            class="lock-btn"
            :class="{ active: state.lockedTransformUuids.has(obj.uuid) }"
            @click="toggleLockTransform(obj.uuid, obj.position)"
            :title="state.lockedTransformUuids.has(obj.uuid) ? 'Transform locked in game loop. Click to release.' : 'Lock transform to prevent game loops / physics from overwriting it'"
          >
            <Lock v-if="state.lockedTransformUuids.has(obj.uuid)" :size="10" />
            <Unlock v-else :size="10" />
            <span>{{ state.lockedTransformUuids.has(obj.uuid) ? 'Locked in Loop' : 'Lock in Loop' }}</span>
          </button>
        </div>

        <div class="fields-grid">
          <!-- Position -->
          <div class="field-row">
            <span class="field-label">Position</span>
            <div class="xyz-group">
              <div class="axis-input x">
                <span class="axis-tag">X</span>
                <input
                  type="number"
                  step="0.1"
                  v-model.number="obj.position.x"
                  @input="update(['position', 'x'], obj.position.x)"
                />
              </div>
              <div class="axis-input y">
                <span class="axis-tag">Y</span>
                <input
                  type="number"
                  step="0.1"
                  v-model.number="obj.position.y"
                  @input="update(['position', 'y'], obj.position.y)"
                />
              </div>
              <div class="axis-input z">
                <span class="axis-tag">Z</span>
                <input
                  type="number"
                  step="0.1"
                  v-model.number="obj.position.z"
                  @input="update(['position', 'z'], obj.position.z)"
                />
              </div>
            </div>
          </div>

          <!-- Rotation (Degrees) -->
          <div class="field-row">
            <span class="field-label">Rotation</span>
            <div class="xyz-group">
              <div class="axis-input x">
                <span class="axis-tag">X°</span>
                <input
                  type="number"
                  step="1"
                  v-model.number="obj.rotationDegrees.x"
                  @input="update(['rotationDegrees', 'x'], obj.rotationDegrees.x)"
                />
              </div>
              <div class="axis-input y">
                <span class="axis-tag">Y°</span>
                <input
                  type="number"
                  step="1"
                  v-model.number="obj.rotationDegrees.y"
                  @input="update(['rotationDegrees', 'y'], obj.rotationDegrees.y)"
                />
              </div>
              <div class="axis-input z">
                <span class="axis-tag">Z°</span>
                <input
                  type="number"
                  step="1"
                  v-model.number="obj.rotationDegrees.z"
                  @input="update(['rotationDegrees', 'z'], obj.rotationDegrees.z)"
                />
              </div>
            </div>
          </div>

          <!-- Scale -->
          <div class="field-row">
            <span class="field-label">Scale</span>
            <div class="xyz-group">
              <div class="axis-input x">
                <span class="axis-tag">X</span>
                <input
                  type="number"
                  step="0.1"
                  v-model.number="obj.scale.x"
                  @input="update(['scale', 'x'], obj.scale.x)"
                />
              </div>
              <div class="axis-input y">
                <span class="axis-tag">Y</span>
                <input
                  type="number"
                  step="0.1"
                  v-model.number="obj.scale.y"
                  @input="update(['scale', 'y'], obj.scale.y)"
                />
              </div>
              <div class="axis-input z">
                <span class="axis-tag">Z</span>
                <input
                  type="number"
                  step="0.1"
                  v-model.number="obj.scale.z"
                  @input="update(['scale', 'z'], obj.scale.z)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- General / Rendering Flags -->
      <div class="section-card">
        <div class="section-title">
          <Info :size="13" class="section-icon" />
          Rendering Flags
        </div>
        <div class="flags-row">
          <label class="flag-item">
            <input
              type="checkbox"
              v-model="obj.visible"
              @change="update(['visible'], obj.visible)"
            />
            Visible
          </label>
          <label class="flag-item">
            <input
              type="checkbox"
              v-model="obj.castShadow"
              @change="update(['castShadow'], obj.castShadow)"
            />
            Cast Shadow
          </label>
          <label class="flag-item">
            <input
              type="checkbox"
              v-model="obj.receiveShadow"
              @change="update(['receiveShadow'], obj.receiveShadow)"
            />
            Receive Shadow
          </label>
          <label class="flag-item">
            <input
              type="checkbox"
              @change="update(['wireframeSubtree'], ($event.target as HTMLInputElement).checked)"
            />
            Wireframe
          </label>
        </div>
      </div>

      <!-- Geometry Card -->
      <div v-if="obj.geometry" class="section-card">
        <div class="section-title">
          <Box :size="13" class="section-icon" />
          Geometry ({{ obj.geometry.type }})
        </div>
        <div class="stats-mini-grid">
          <div class="stat-mini">
            <span class="stat-mini-label">Vertices</span>
            <span class="stat-mini-val">{{ obj.geometry.verticesCount.toLocaleString() }}</span>
          </div>
          <div class="stat-mini">
            <span class="stat-mini-label">Faces</span>
            <span class="stat-mini-val">{{ obj.geometry.facesCount.toLocaleString() }}</span>
          </div>
          <div class="stat-mini">
            <span class="stat-mini-label">Normals</span>
            <span class="stat-mini-val">{{ obj.geometry.hasNormals ? 'Yes' : 'No' }}</span>
          </div>
          <div class="stat-mini">
            <span class="stat-mini-label">UVs</span>
            <span class="stat-mini-val">{{ obj.geometry.hasUVs ? 'Yes' : 'No' }}</span>
          </div>
        </div>
      </div>

      <!-- Material Card -->
      <div v-if="activeMaterial" class="section-card">
        <div class="section-title">
          <Palette :size="13" class="section-icon" />
          Material ({{ activeMaterial.type }})
        </div>

        <div class="fields-grid">
          <!-- Color -->
          <div v-if="activeMaterial.color" class="field-row">
            <span class="field-label">Color</span>
            <div class="color-field">
              <input
                type="color"
                v-model="activeMaterial.color"
                @input="update(['material', 'color'], activeMaterial.color)"
              />
              <span class="color-hex">{{ activeMaterial.color }}</span>
            </div>
          </div>

          <!-- Wireframe -->
          <div class="field-row">
            <span class="field-label">Wireframe</span>
            <input
              type="checkbox"
              :checked="Boolean(activeMaterial.wireframe)"
              @change="update(['material', 'wireframe'], !Boolean(activeMaterial.wireframe))"
            />
          </div>

          <!-- Opacity -->
          <div class="field-row">
            <span class="field-label">Opacity ({{ activeMaterial.opacity }})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              v-model.number="activeMaterial.opacity"
              @input="update(['material', 'opacity'], activeMaterial.opacity)"
              class="range-slider"
            />
          </div>

          <!-- Roughness -->
          <div v-if="typeof activeMaterial.roughness === 'number'" class="field-row">
            <span class="field-label">Roughness ({{ activeMaterial.roughness }})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              v-model.number="activeMaterial.roughness"
              @input="update(['material', 'roughness'], activeMaterial.roughness)"
              class="range-slider"
            />
          </div>

          <!-- Metalness -->
          <div v-if="typeof activeMaterial.metalness === 'number'" class="field-row">
            <span class="field-label">Metalness ({{ activeMaterial.metalness }})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              v-model.number="activeMaterial.metalness"
              @input="update(['material', 'metalness'], activeMaterial.metalness)"
              class="range-slider"
            />
          </div>
        </div>
      </div>

      <!-- Light Card -->
      <div v-if="obj.light" class="section-card">
        <div class="section-title">
          <Sun :size="13" class="section-icon" />
          Light Settings
        </div>
        <div class="fields-grid">
          <div class="field-row">
            <span class="field-label">Color</span>
            <div class="color-field">
              <input
                type="color"
                v-model="obj.light.color"
                @input="update(['light', 'color'], obj.light.color)"
              />
              <span class="color-hex">{{ obj.light.color }}</span>
            </div>
          </div>
          <div class="field-row">
            <span class="field-label">Intensity ({{ obj.light.intensity }})</span>
            <div class="slider-with-input">
              <input
                type="range"
                min="0"
                max="20"
                step="0.1"
                v-model.number="obj.light.intensity"
                @input="update(['light', 'intensity'], obj.light.intensity)"
                class="range-slider"
              />
              <input
                type="number"
                step="0.1"
                min="0"
                v-model.number="obj.light.intensity"
                @input="update(['light', 'intensity'], obj.light.intensity)"
                class="mini-num-input"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Camera Card -->
      <div v-if="obj.camera" class="section-card">
        <div class="section-title">
          <CameraIcon :size="13" class="section-icon" />
          Camera Settings
        </div>
        <div class="fields-grid">
          <div v-if="typeof obj.camera.fov === 'number'" class="field-row">
            <span class="field-label">FOV</span>
            <input
              type="number"
              step="1"
              v-model.number="obj.camera.fov"
              @input="update(['camera', 'fov'], obj.camera.fov)"
            />
          </div>
          <div class="field-row">
            <span class="field-label">Near / Far</span>
            <div class="xyz-group">
              <input
                type="number"
                step="0.1"
                v-model.number="obj.camera.near"
                @input="update(['camera', 'near'], obj.camera.near)"
                placeholder="Near"
              />
              <input
                type="number"
                step="10"
                v-model.number="obj.camera.far"
                @input="update(['camera', 'far'], obj.camera.far)"
                placeholder="Far"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inspector-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-primary);
  overflow-y: auto;
}

.empty-inspector {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  color: var(--text-muted);
  text-align: center;
}

.info-icon {
  margin-bottom: 12px;
  color: var(--border-color);
}

.inspector-content {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inspector-header {
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.obj-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-bright);
}

.console-btn {
  background: var(--bg-tertiary);
  font-family: var(--font-mono);
  font-size: 11px;
}

.meta-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-mono);
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.meta-badge.type {
  color: var(--type-mesh);
  background: rgba(78, 201, 176, 0.1);
}

.section-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 8px 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 4px;
}

.section-icon {
  color: var(--text-accent);
}

.fields-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-label {
  font-size: 11px;
  color: var(--text-primary);
  flex-shrink: 0;
  width: 100px;
}

.xyz-group {
  display: flex;
  gap: 4px;
  flex: 1;
}

.axis-input {
  display: flex;
  align-items: center;
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  overflow: hidden;
}

.axis-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 4px;
}

.axis-input.x .axis-tag { color: #f87171; }
.axis-input.y .axis-tag { color: #4ade80; }
.axis-input.z .axis-tag { color: #60a5fa; }

.axis-input input {
  width: 100%;
  border: none;
  background: transparent;
  padding: 2px 4px;
}

.flags-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.flag-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  cursor: pointer;
}

.stats-mini-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.stat-mini {
  background: var(--bg-primary);
  padding: 4px 6px;
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
}

.stat-mini-label {
  font-size: 9.5px;
  color: var(--text-muted);
}

.stat-mini-val {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-bright);
}

.color-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-hex {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.range-slider {
  flex: 1;
  accent-color: var(--accent);
}

.transform-title {
  display: flex;
  align-items: center;
  justify-content: space-between !important;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lock-btn {
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
}

.lock-btn:hover {
  color: var(--text-bright);
}

.lock-btn.active {
  background: #b91c1c;
  color: #ffffff;
  border-color: #ef4444;
}

.slider-with-input {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.mini-num-input {
  width: 50px;
  text-align: right;
}
</style>
