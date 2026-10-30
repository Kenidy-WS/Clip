import { S } from '../state';
import { T } from '../strings';
import { els } from '../ui/dom';

const UPDATE_CHECK_MS = 5 * 60 * 1000;

/**
 * Offline + atualização: o service worker novo fica "esperando"; mostramos o aviso e só trocamos
 * quando o usuário tocar em Atualizar (nunca no meio de uma gravação).
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  let updating = false;

  const showUpdate = (worker: ServiceWorker): void => {
    els.update.classList.add('show');
    els.btnUpdate.onclick = () => {
      if (S.rec || S.finalizing) return;
      updating = true;
      els.btnUpdate.dataset.updating = '1';
      els.btnUpdate.textContent = T.updating;
      els.btnUpdate.disabled = true;
      worker.postMessage('SKIP_WAITING');
    };
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updating) location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(nw);
          });
        });
        const check = (): void => void reg.update().catch(() => {});
        setInterval(check, UPDATE_CHECK_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      })
      .catch(() => {});
  });
}
