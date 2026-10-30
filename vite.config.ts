import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { serviceWorkerPlugin } from './scripts/sw-plugin';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

// base './' = caminhos relativos: o app funciona em qualquer endereço (github.io/Clip/, domínio próprio, etc.).
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [serviceWorkerPlugin(pkg.version)],
  build: { target: 'es2022', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
