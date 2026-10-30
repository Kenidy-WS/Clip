import './styles.css';
import { initApp } from './app';
import { registerServiceWorker } from './pwa/register';
import { initBrandIntro } from './ui/brand-intro';

registerServiceWorker();
initApp();
initBrandIntro();
