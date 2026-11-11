import { MESSAGE_SOURCE, type InspectorMessage } from '../types/messages';

(function initContentScript() {
  // Inject hook script into main world
  function injectHook() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('hook.js');
      script.async = false;
      script.onload = () => {
        script.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.warn('[Three Inspector Content] Failed to inject hook script:', e);
    }
  }

  // Inject early
  injectHook();

  // Extension communication port
  let port: chrome.runtime.Port | null = null;
  let isConnecting = false;

  function connectPort() {
    if (isConnecting || port) return;
    // After an extension reload/update this content script is orphaned:
    // chrome.runtime.id disappears and every connect() would throw forever,
    // spamming the page console with reconnect attempts.
    if (!chrome.runtime?.id) return;
    isConnecting = true;

    try {
      port = chrome.runtime.connect({ name: 'three-inspector-content' });

      port.onMessage.addListener((message: InspectorMessage) => {
        // Forward from DevTools/Background to Page Hook
        if (message && message.source !== MESSAGE_SOURCE.HOOK) {
          window.postMessage(
            {
              ...message,
              source: MESSAGE_SOURCE.CONTENT
            },
            '*'
          );
        }
      });

      port.onDisconnect.addListener(() => {
        port = null;
        isConnecting = false;
        // Reconnect after brief pause if disconnected
        setTimeout(connectPort, 1000);
      });

      isConnecting = false;
    } catch (e) {
      port = null;
      isConnecting = false;
      setTimeout(connectPort, 2000);
    }
  }

  connectPort();

  // Listen to messages from page hook
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== MESSAGE_SOURCE.HOOK) {
      return;
    }

    const message = event.data as InspectorMessage;

    // Relay to background script
    if (port) {
      try {
        port.postMessage(message);
      } catch (err) {
        port = null;
        connectPort();
      }
    }
  });
})();
