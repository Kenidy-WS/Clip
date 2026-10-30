/**
 * Junta os trechos que o muxer entrega (`onData(dados, posição)`) em "pedaços" contíguos do arquivo.
 * O MP4 fragmentado é gravado sempre em sequência; se um trecho chegar fora de ordem, o arquivo não serve e o erro sobe.
 */
export class PartCollector {
  private pieces: Uint8Array[] = [];
  private next = 0;

  /** Posição do próximo byte esperado (= bytes recebidos até agora). */
  get size(): number {
    return this.next;
  }

  push(data: Uint8Array, position: number): void {
    if (position !== this.next) {
      throw new Error(`trecho fora de ordem (posição ${position}, esperada ${this.next})`);
    }
    // Cópia: o muxer pode reaproveitar o buffer depois da chamada.
    this.pieces.push(data.slice());
    this.next += data.byteLength;
  }

  /** Entrega o que foi acumulado desde a última chamada (ou null se não há nada) e recomeça. */
  take(): Uint8Array[] | null {
    if (!this.pieces.length) return null;
    const out = this.pieces;
    this.pieces = [];
    return out;
  }
}
