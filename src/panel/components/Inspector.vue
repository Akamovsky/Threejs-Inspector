<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  state,
  updateProperty,
  inspectInConsole,
  resetPropertyOverrides,
  setGizmoMode,
  toggleFocusObject,
  copyThreeCode,
  downloadTexture,
  selectObject
} from '../bridge';
import {
  Terminal,
  Move,
  RotateCw,
  RotateCcw,
  Maximize2,
  Box,
  Palette,
  Sun,
  Camera as CameraIcon,
  Info,
  Crosshair,
  Copy,
  Download,
  Code,
  Check,
  Image as ImageIcon,
  X
} from '@lucide/vue';

const obj = computed(() => state.selectedObject);
const isLight = computed(() => Boolean(obj.value?.light || obj.value?.type?.includes('Light')));
const copiedCode = ref(false);
const activeMaterialTab = ref<'properties' | 'shader'>('properties');
const editedVertexShader = ref('');
const editedFragmentShader = ref('');
const lightMaxRange = ref(10);

function handleIntensityChange(val: number) {
  if (!obj.value || !obj.value.light) return;
  const num = Number(val);
  obj.value.light.intensity = num;
  update(['light', 'intensity'], num);
}

function update(path: string[], value: any) {
  if (!obj.value) return;
  updateProperty(obj.value.uuid, path, value);
}

function handleConsoleLog() {
  if (!obj.value) return;
  inspectInConsole(obj.value.uuid);
}

function handleCopyCode() {
  if (!obj.value) return;
  copyThreeCode(obj.value);
  copiedCode.value = true;
  setTimeout(() => (copiedCode.value = false), 2000);
}

const activeMaterial = computed(() => {
  if (!obj.value?.material) return null;
  if (Array.isArray(obj.value.material)) {
    return obj.value.material[0] || null;
  }
  return obj.value.material;
});

function applyShaders() {
  if (!obj.value || !activeMaterial.value) return;
  if (editedVertexShader.value) {
    update(['material', 'vertexShader'], editedVertexShader.value);
  }
  if (editedFragmentShader.value) {
    update(['material', 'fragmentShader'], editedFragmentShader.value);
  }
}
</script>

<template>
  <div class="inspector-container">
    <div v-if="!obj" class="empty-inspector">
      <Info :size="24" class="info-icon" />
      <p>Select an object from the scene tree to inspect its properties.</p>
    </div>

    <div v-else class="inspector-content">
      <!-- Header / Summary with Actions -->
      <div class="inspector-header">
        <div class="title-row">
          <span class="obj-name">{{ obj.name }}</span>
          <div class="header-tools">
            <!-- Focus / Unfocus in 3D -->
            <button
              class="tool-btn"
              :class="{ active: state.isFocused }"
              @click="toggleFocusObject(obj.uuid)"
              :title="state.isFocused ? 'Revert Camera to Original View (Esc)' : 'Focus Camera on Object (F)'"
            >
              <Crosshair :size="12" />
              <span>{{ state.isFocused ? 'Unfocus (Esc)' : 'Focus' }}</span>
            </button>

            <!-- Copy Three.js Code -->
            <button class="tool-btn" @click="handleCopyCode" title="Copy Three.js Code Snippet">
              <Check v-if="copiedCode" :size="12" style="color: #4ade80" />
              <Copy v-else :size="12" />
              <span>{{ copiedCode ? 'Copied!' : 'Code' }}</span>
            </button>

            <!-- Console $three -->
            <button class="tool-btn console-btn" @click="handleConsoleLog" title="Expose to console as $three">
              <Terminal :size="12" />
              <span>$three</span>
            </button>

            <!-- Deselect / Clear Selection -->
            <button class="tool-btn deselect-btn" @click="selectObject(null)" title="Deselect object (Esc)">
              <X :size="12" />
              <span>Deselect</span>
            </button>
          </div>
        </div>

        <div class="meta-row">
          <span class="meta-badge type">{{ obj.type }}</span>
          <span class="meta-badge uuid" :title="obj.uuid">UUID: {{ obj.uuid.slice(0, 8) }}...</span>
          <span class="meta-badge id">ID: {{ obj.id }}</span>
        </div>
      </div>

      <!-- Transform Card + Interactive 3D Gizmo Controls -->
      <div class="section-card">
        <div class="section-title transform-title">
          <div class="title-left">
            <Move :size="13" class="section-icon" />
            Transform & Gizmo
          </div>
          <div class="title-actions">
            <button
              class="reset-btn"
              @click="resetPropertyOverrides(obj.uuid)"
              title="Reset all inspector overrides for this object and return control to the game loop"
            >
              <RotateCcw :size="10" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <!-- 3D Transform Gizmo Mode Selector -->
        <div class="gizmo-mode-selector">
          <span class="gizmo-label">3D Gizmo:</span>
          <button
            class="gizmo-btn"
            :class="{ active: state.gizmoMode === 'none' }"
            @click="setGizmoMode('none')"
            title="Disable 3D Gizmo"
          >
            Off
          </button>
          <button
            class="gizmo-btn"
            :class="{ active: state.gizmoMode === 'translate' }"
            @click="setGizmoMode('translate')"
            title="Translate Gizmo (W)"
          >
            <Move :size="11" />
            Translate
          </button>
          <button
            class="gizmo-btn"
            :class="{ active: state.gizmoMode === 'rotate' }"
            @click="setGizmoMode('rotate')"
            title="Rotate Gizmo (E)"
          >
            <RotateCw :size="11" />
            Rotate
          </button>
          <button
            v-if="!isLight"
            class="gizmo-btn"
            :class="{ active: state.gizmoMode === 'scale' }"
            @click="setGizmoMode('scale')"
            title="Scale Gizmo (R)"
          >
            <Maximize2 :size="11" />
            Scale
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

          <!-- Scale (Hidden for lights) -->
          <div v-if="!isLight" class="field-row">
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

      <!-- Material Card + Texture Thumbnails + Shader Editor -->
      <div v-if="activeMaterial" class="section-card">
        <div class="material-card-header">
          <div class="section-title" style="margin-bottom: 0">
            <Palette :size="13" class="section-icon" />
            Material ({{ activeMaterial.type }})
          </div>
          <div class="mat-tab-toggle">
            <button
              class="mat-tab-btn"
              :class="{ active: activeMaterialTab === 'properties' }"
              @click="activeMaterialTab = 'properties'"
            >
              Properties
            </button>
            <button
              v-if="activeMaterial.isShaderMaterial || activeMaterial.vertexShader"
              class="mat-tab-btn"
              :class="{ active: activeMaterialTab === 'shader' }"
              @click="activeMaterialTab = 'shader'"
            >
              <Code :size="10" />
              Shaders
            </button>
          </div>
        </div>

        <!-- Material Properties Tab -->
        <div v-show="activeMaterialTab === 'properties'" class="fields-grid" style="margin-top: 8px">
          <!-- Color (swatch + hex sit left of the label) -->
          <div v-if="activeMaterial.color" class="field-row color-row">
            <div class="color-field">
              <input
                type="color"
                v-model="activeMaterial.color"
                @input="update(['material', 'color'], activeMaterial.color)"
              />
              <span class="color-hex">{{ activeMaterial.color }}</span>
            </div>
            <span class="field-label">Color</span>
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

          <!-- Textures Previews Row -->
          <div v-if="activeMaterial.textures && activeMaterial.textures.length > 0" class="textures-section">
            <span class="textures-label">Attached Textures ({{ activeMaterial.textures.length }})</span>
            <div class="texture-slots-grid">
              <div v-for="tex in activeMaterial.textures" :key="tex.slot" class="tex-slot-card">
                <div class="tex-thumb-box">
                  <img v-if="tex.dataUrl" :src="tex.dataUrl" class="tex-thumb-img" />
                  <ImageIcon v-else :size="16" class="tex-empty-icon" />
                </div>
                <div class="tex-details">
                  <span class="slot-name">{{ tex.slot }}</span>
                  <span class="slot-res">{{ tex.width }}x{{ tex.height }}</span>
                  <button class="tex-dl-btn" @click="downloadTexture(tex.uuid)" title="Download PNG">
                    <Download :size="9" />
                    PNG
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Live GLSL Shader Editor Tab -->
        <div v-show="activeMaterialTab === 'shader'" class="shader-editor-container" style="margin-top: 8px">
          <div class="shader-section">
            <span class="shader-title">Vertex Shader</span>
            <textarea
              class="glsl-textarea"
              rows="6"
              :placeholder="activeMaterial.vertexShader || '// Default vertex shader'"
              v-model="editedVertexShader"
            ></textarea>
          </div>
          <div class="shader-section">
            <span class="shader-title">Fragment Shader</span>
            <textarea
              class="glsl-textarea"
              rows="6"
              :placeholder="activeMaterial.fragmentShader || '// Default fragment shader'"
              v-model="editedFragmentShader"
            ></textarea>
          </div>
          <button class="apply-shader-btn" @click="applyShaders">
            Apply Shaders Live
          </button>
        </div>
      </div>

      <!-- Light Card -->
      <div v-if="obj.light" class="section-card">
        <div class="section-title transform-title">
          <div class="title-left">
            <Sun :size="13" class="section-icon" />
            Light Settings
          </div>
          <button
            class="reset-btn"
            @click="resetPropertyOverrides(obj.uuid)"
            title="Reset light intensity to game loop control"
          >
            <RotateCcw :size="10" />
            <span>Reset</span>
          </button>
        </div>
        <div class="fields-grid">
          <div class="field-row color-row">
            <div class="color-field">
              <input
                type="color"
                v-model="obj.light.color"
                @input="update(['light', 'color'], obj.light.color)"
              />
              <span class="color-hex">{{ obj.light.color }}</span>
            </div>
            <span class="field-label">Color</span>
          </div>
          <div class="field-row">
            <div class="intensity-label-row">
              <span class="field-label">Intensity</span>
              <span class="intensity-value-badge">{{ Number(obj.light.intensity ?? 0).toFixed(2) }}</span>
            </div>
            <div class="intensity-slider-wrapper">
              <div class="slider-track-row">
                <span class="bound-tag start-bound" title="Minimum bound">0</span>
                <input
                  type="range"
                  min="0"
                  :max="lightMaxRange"
                  step="0.05"
                  v-model.number="obj.light.intensity"
                  @input="handleIntensityChange(obj.light.intensity)"
                  class="range-slider intensity-range"
                />
                <span class="bound-tag end-bound" :title="`Maximum bound: ${lightMaxRange}`">{{ lightMaxRange }}</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  v-model.number="obj.light.intensity"
                  @input="handleIntensityChange(obj.light.intensity)"
                  class="mini-num-input intensity-num-input"
                />
              </div>
              <div class="range-presets-row">
                <span class="range-hint">End bound:</span>
                <div class="preset-badges">
                  <button
                    v-for="r in [5, 10, 25, 50, 100]"
                    :key="r"
                    type="button"
                    class="bound-pill"
                    :class="{ active: lightMaxRange === r }"
                    @click="lightMaxRange = r"
                  >
                    {{ r }}
                  </button>
                </div>
              </div>
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
  padding: 8px 10px;
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

.header-tools {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
}

.tool-btn:hover {
  background: var(--bg-hover);
  color: #38bdf8;
  border-color: #38bdf8;
}

.tool-btn.active {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border-color: #38bdf8;
  font-weight: 600;
}

.deselect-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border-color: #ef4444;
}

.console-btn {
  font-family: var(--font-mono);
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
  background: var(--bg-primary);
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
}

.transform-title {
  justify-content: space-between;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gizmo-mode-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  padding: 4px;
  background: var(--bg-primary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.gizmo-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-right: 4px;
}

.gizmo-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.gizmo-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-bright);
}

.gizmo-btn.active {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  font-weight: 600;
}

.reset-btn {
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.reset-btn:hover {
  background: var(--bg-hover);
  color: #38bdf8;
  border-color: #38bdf8;
}

.fields-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* Color rows pack everything left: swatch + hex sit flush before the label */
.field-row.color-row {
  justify-content: flex-start;
}

.field-label {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 80px;
}

.xyz-group {
  display: flex;
  gap: 4px;
  flex: 1;
}

.axis-input {
  display: flex;
  align-items: center;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  flex: 1;
  overflow: hidden;
}

.axis-tag {
  font-size: 10px;
  font-weight: bold;
  padding: 2px 4px;
  font-family: var(--font-mono);
}

.axis-input.x .axis-tag { color: #f87171; }
.axis-input.y .axis-tag { color: #4ade80; }
.axis-input.z .axis-tag { color: #38bdf8; }

.axis-input input,
.xyz-group input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-bright);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 3px 4px;
  outline: none;
}

.flags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.flag-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-primary);
  cursor: pointer;
}

.stats-mini-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.stat-mini {
  background: var(--bg-primary);
  padding: 4px;
  border-radius: 3px;
  display: flex;
  flex-direction: column;
}

.stat-mini-label {
  font-size: 9px;
  color: var(--text-muted);
}

.stat-mini-val {
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-bright);
}

.material-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mat-tab-toggle {
  display: flex;
  gap: 3px;
}

.mat-tab-btn {
  padding: 2px 6px;
  font-size: 10px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.mat-tab-btn.active {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border-color: #38bdf8;
}

.color-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-field input[type="color"] {
  border: none;
  background: transparent;
  width: 24px;
  height: 20px;
  cursor: pointer;
}

.color-hex {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-bright);
}

.intensity-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 4px;
}

.intensity-value-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid rgba(251, 191, 36, 0.25);
}

.intensity-slider-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.slider-track-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.bound-tag {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  min-width: 18px;
  text-align: center;
}

.intensity-range {
  flex: 1;
  accent-color: #f59e0b;
}

.intensity-num-input {
  width: 58px;
}

.range-presets-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
  padding-top: 4px;
  border-top: 1px dashed rgba(255, 255, 255, 0.07);
}

.range-hint {
  font-size: 10px;
  color: var(--text-muted);
}

.preset-badges {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bound-pill {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bg-primary);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease;
}

.bound-pill:hover {
  color: var(--text-bright);
  border-color: #f59e0b;
}

.bound-pill.active {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border-color: #f59e0b;
  font-weight: 700;
}

.range-slider {
  flex: 1;
  accent-color: #38bdf8;
}

.slider-with-input {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.mini-num-input {
  width: 50px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-bright);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 4px;
  text-align: right;
}

.textures-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.textures-label {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 600;
}

.texture-slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 6px;
}

.tex-slot-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tex-thumb-box {
  width: 28px;
  height: 28px;
  background: #141416;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.tex-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tex-empty-icon {
  opacity: 0.3;
}

.tex-details {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  overflow: hidden;
}

.slot-name {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--text-bright);
}

.slot-res {
  font-size: 8.5px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.tex-dl-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 8px;
  padding: 1px 3px;
  border-radius: 2px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: pointer;
  align-self: flex-start;
}

.tex-dl-btn:hover {
  color: #38bdf8;
  border-color: #38bdf8;
}

.shader-editor-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shader-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.shader-title {
  font-size: 9.5px;
  color: var(--text-muted);
  font-weight: 600;
}

.glsl-textarea {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: #4ade80;
  font-family: var(--font-mono);
  font-size: 9.5px;
  padding: 4px;
  resize: vertical;
  outline: none;
}

.apply-shader-btn {
  background: #38bdf8;
  color: #000;
  font-weight: 600;
  font-size: 10.5px;
  border: none;
  border-radius: 3px;
  padding: 4px;
  cursor: pointer;
}

.apply-shader-btn:hover {
  background: #7dd3fc;
}
</style>
