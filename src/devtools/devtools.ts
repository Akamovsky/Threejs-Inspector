// DevTools panel registration
chrome.devtools.panels.create(
  'Three.js',
  'icons/icon-16.png',
  'panel.html',
  (panel) => {
    // DevTools panel created successfully
  }
);
