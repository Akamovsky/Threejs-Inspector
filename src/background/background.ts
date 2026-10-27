import type { InspectorMessage } from '../types/messages';

interface TabConnection {
  contentPort?: chrome.runtime.Port;
  devtoolsPort?: chrome.runtime.Port;
  lastDetection?: any;
}

const tabConnections = new Map<number, TabConnection>();

function getOrCreateTab(tabId: number): TabConnection {
  let conn = tabConnections.get(tabId);
  if (!conn) {
    conn = {};
    tabConnections.set(tabId, conn);
  }
  return conn;
}

// Connection dispatcher
chrome.runtime.onConnect.addListener((port) => {
  const portName = port.name;

  if (portName === 'three-inspector-content') {
    const tabId = port.sender?.tab?.id;
    if (!tabId) return;

    const tab = getOrCreateTab(tabId);
    tab.contentPort = port;

    port.onMessage.addListener((message: InspectorMessage) => {
      // Forward to DevTools panel if connected
      if (tab.devtoolsPort) {
        tab.devtoolsPort.postMessage(message);
      }

      // Handle detection badge
      if (message.action === 'THREE_DETECTED' && message.payload) {
        tab.lastDetection = message.payload;
        chrome.action.setBadgeText({ tabId, text: '3D' });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' });
      }
    });

    port.onDisconnect.addListener(() => {
      if (tab.contentPort === port) {
        tab.contentPort = undefined;
      }
    });
  } else if (portName.startsWith('three-inspector-devtools-')) {
    const tabIdStr = portName.replace('three-inspector-devtools-', '');
    const tabId = parseInt(tabIdStr, 10);
    if (isNaN(tabId)) return;

    const tab = getOrCreateTab(tabId);
    tab.devtoolsPort = port;

    // DevTools connected -> request scene graph immediately
    if (tab.contentPort) {
      tab.contentPort.postMessage({
        source: 'three-inspector-devtools',
        action: 'REQUEST_SCENE_GRAPH'
      });
    }

    port.onMessage.addListener((message: InspectorMessage) => {
      // Forward devtools actions to content script
      if (tab.contentPort) {
        tab.contentPort.postMessage(message);
      }
    });

    port.onDisconnect.addListener(() => {
      if (tab.devtoolsPort === port) {
        tab.devtoolsPort = undefined;
      }
    });
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  tabConnections.delete(tabId);
});

// Listen for popup messages requesting detection status
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_TAB_STATUS' && request.tabId) {
    const tab = tabConnections.get(request.tabId);
    sendResponse({
      detected: Boolean(tab?.lastDetection),
      details: tab?.lastDetection || null
    });
  }
  return true;
});
