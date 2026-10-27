import { createApp } from 'vue';
import App from './App.vue';
import './styles/theme.css';
import { initBridge } from './bridge';

const app = createApp(App);
app.mount('#app');

// Initialize DevTools communication bridge
initBridge();
