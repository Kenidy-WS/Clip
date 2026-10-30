/** Preferências simples guardadas no aparelho (localStorage). Sem localStorage, o app segue com os padrões. */
const PREFIX = 'clip.';

export function getPref(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function setPref(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* sem localStorage */
  }
}
