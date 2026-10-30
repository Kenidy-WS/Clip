/** Código do AudioWorkletProcessor (carregado por Blob URL): junta blocos de 2048 amostras por canal. */
export const WORKLET_SRC = `
  class Cap extends AudioWorkletProcessor {
    constructor() { super(); this.buf = []; this.n = 0; this.chs = 0; }
    process(inputs) {
      const inp = inputs[0];
      if (!inp || !inp.length) return true;
      const chs = inp.length;
      if (this.chs !== chs) { this.buf = []; this.n = 0; this.chs = chs; }
      if (!this.buf.length) for (let c = 0; c < chs; c++) this.buf.push(new Float32Array(2048));
      const len = inp[0].length;
      for (let c = 0; c < chs; c++) this.buf[c].set(inp[c], this.n);
      this.n += len;
      if (this.n >= 2048) {
        this.port.postMessage({ ch: this.buf, frames: this.n }, this.buf.map((b) => b.buffer));
        this.buf = []; this.n = 0;
      }
      return true;
    }
  }
  registerProcessor('cap', Cap);`;
