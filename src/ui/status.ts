import type { StatusKind } from '../types';
import { els } from './dom';

export function setStatus(msg: string, kind: StatusKind = ''): void {
  els.status.textContent = msg || '';
  els.status.className = 'status' + (kind ? ' ' + kind : '') + (msg ? ' show' : '');
}
