<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Box, CheckCircle2, XCircle, Info } from '@lucide/vue';

interface TabStatus {
  detected: boolean;
  details: {
    version?: string;
    scenesCount?: number;
    renderersCount?: number;
  } | null;
}

const status = ref<TabStatus | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.runtime.sendMessage(
        { action: 'GET_TAB_STATUS', tabId: tab.id },
        (response) => {
          status.value = response;
          loading.value = false;
        }
      );
    } else {
      loading.value = false;
    }
  } catch (e) {
    loading.value = false;
  }
});
</script>

<template>
  <div class="popup-wrapper">
    <div class="popup-header">
      <Box :size="18" class="brand-icon" />
      <span class="brand-title">Three.js Inspector</span>
    </div>

    <div v-if="loading" class="popup-body loading">
      Scanning active tab...
    </div>

    <div v-else-if="status?.detected" class="popup-body detected">
      <div class="status-banner success">
        <CheckCircle2 :size="18" />
        <div>
          <div class="banner-title">Three.js Detected!</div>
          <div class="banner-sub">Revision: {{ status.details?.version || 'Detected' }}</div>
        </div>
      </div>

      <div class="details-list">
        <div class="detail-item">
          <span>Active Scenes</span>
          <span class="val">{{ status.details?.scenesCount || 1 }}</span>
        </div>
        <div class="detail-item">
          <span>WebGL Renderers</span>
          <span class="val">{{ status.details?.renderersCount || 1 }}</span>
        </div>
      </div>

      <div class="tip-box">
        <Info :size="13" class="tip-icon" />
        <span>Open Chrome DevTools (F12) and select the <strong>Three.js</strong> tab to inspect scene objects.</span>
      </div>
    </div>

    <div v-else class="popup-body not-detected">
      <div class="status-banner not-found">
        <XCircle :size="18" />
        <div>
          <div class="banner-title">No Three.js Found</div>
          <div class="banner-sub">On current active webpage</div>
        </div>
      </div>

      <p class="empty-desc">
        Navigate to a webpage that uses Three.js or start a local Three.js project to begin inspecting.
      </p>
    </div>
  </div>
</template>

<style scoped>
.popup-wrapper {
  padding: 12px;
  background: #1e1e1e;
  color: #cccccc;
  font-size: 12px;
}

.popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid #333333;
  margin-bottom: 12px;
}

.brand-icon {
  color: #38bdf8;
}

.brand-title {
  font-weight: 700;
  color: #ffffff;
  font-size: 13px;
}

.popup-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 4px;
}

.status-banner.success {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.25);
}

.status-banner.not-found {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.25);
}

.banner-title {
  font-weight: 600;
  font-size: 12px;
}

.banner-sub {
  font-size: 10.5px;
  opacity: 0.8;
  font-family: monospace;
}

.details-list {
  background: #252526;
  border: 1px solid #333333;
  border-radius: 4px;
  overflow: hidden;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid #2d2d30;
  font-size: 11.5px;
}

.detail-item:last-child {
  border-bottom: none;
}

.val {
  font-family: monospace;
  font-weight: 700;
  color: #ffffff;
}

.tip-box {
  display: flex;
  gap: 6px;
  font-size: 11px;
  line-height: 1.4;
  color: #9ca3af;
  background: #252526;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #333;
}

.tip-icon {
  flex-shrink: 0;
  color: #38bdf8;
  margin-top: 1px;
}

.empty-desc {
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.5;
}
</style>
