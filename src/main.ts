import './styles.css';
import { initApp } from './app';
import { registerServiceWorker } from './pwa/register';

registerServiceWorker();
initApp();
