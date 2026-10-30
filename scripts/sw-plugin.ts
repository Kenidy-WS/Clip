import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * Gera dist/sw.js a partir de scripts/sw-template.js, depois do build:
 * - ASSETS = todos os arquivos publicados (o app funciona offline);
 * - CACHE  = versão + hash do conteúdo, então qualquer mudança no app dispara o aviso "Nova versão disponível".
 */
export function serviceWorkerPlugin(version: string): Plugin {
  let outDir = 'dist';
  return {
    name: 'ei-clip-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .filter((f) => relative(outDir, f) !== 'sw.js')
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(relative(outDir, f)).update(readFileSync(f));
      const assets = ['./', ...files.map((f) => relative(outDir, f).split('\\').join('/'))];
      const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf-8');
      const sw = template
        .replace('__CACHE_NAME__', `ei-clip-${version}-${hash.digest('hex').slice(0, 8)}`)
        .replace('__ASSETS__', JSON.stringify(assets));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}
