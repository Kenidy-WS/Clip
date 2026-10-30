/**
 * Registro de ciclo de vida para o Diagnóstico.
 *
 * Relato do Kenidy (v0.8.1): o iPhone volta a pedir câmera e microfone depois de minimizar o app ou de alguns minutos aberto,
 * "como se o app recarregasse". Aqui guardamos as últimas cargas da página (sobrevivem ao recarregamento) e as idas e voltas
 * ao app, para ver se foi recarga (a página reiniciou) ou só nova captura dentro da mesma página.
 */
import { getPref, setPref } from '../storage/prefs';

const BOOTS_KEY = 'boots';
const MAX_BOOTS = 6;
const events: string[] = [];
let hiddenAt = 0;
const perms: Record<string, string> = {};

const clock = (t: number): string =>
  new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const push = (msg: string): void => {
  events.push(`${clock(Date.now())} ${msg}`);
  if (events.length > 8) events.shift();
};

function navType(): string {
  const nav = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
  return nav?.type ?? '?';
}

async function readPermissions(): Promise<void> {
  for (const name of ['camera', 'microphone']) {
    try {
      const st = await navigator.permissions.query({ name: name as PermissionName });
      perms[name] = st.state;
      st.onchange = () => {
        perms[name] = st.state;
        push(`permissão ${name}: ${st.state}`);
      };
    } catch {
      perms[name] = 'n/d';
    }
  }
}

export function initLifecycleLog(): void {
  let boots: Array<[number, string]> = [];
  try {
    boots = JSON.parse(getPref(BOOTS_KEY) || '[]') as Array<[number, string]>;
  } catch {
    boots = [];
  }
  boots.push([Date.now(), navType()]);
  setPref(BOOTS_KEY, JSON.stringify(boots.slice(-MAX_BOOTS)));
  bootsCache = boots.slice(-MAX_BOOTS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      push('saiu do app');
    } else {
      const secs = hiddenAt ? Math.round((Date.now() - hiddenAt) / 1000) : 0;
      push(`voltou (fora ${secs}s)`);
    }
  });
  addEventListener('pagehide', (e) => push(`pagehide${e.persisted ? ' (cache)' : ''}`));
  void readPermissions();
}

let bootsCache: Array<[number, string]> = [];

/** Linhas do Diagnóstico: cargas recentes da página, idas/voltas e estado das permissões. */
export function lifecycleInfo(): string {
  const loads = bootsCache.map(([t, ty]) => `${clock(t)} ${ty}`).join(' | ');
  const p = `câmera ${perms.camera ?? '?'}, microfone ${perms.microphone ?? '?'}`;
  return [
    `Cargas da página (mais recente por último): ${loads || '-'}`,
    `Permissões: ${p}`,
    events.length ? 'Ciclo:\n  ' + events.join('\n  ') : '',
  ]
    .filter(Boolean)
    .join('\n');
}
