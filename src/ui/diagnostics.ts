import { APP_NAME } from '../strings';
import { support } from '../media/support';
import { APP_VERSION } from '../config';
import { cfg, S } from '../state';
import { lifecycleEvents, lifecycleRows } from './lifecycle-log';
import { viewportLog, viewportRows } from './viewport';

export type Row = [label: string, value: string];
export interface DiagSection {
  title: string;
  /** Pares rótulo/valor. */
  rows?: Row[];
  /** Linhas soltas (registros), da mais antiga para a mais nova. */
  lines?: string[];
  /** Seção de problemas (destacada). */
  alert?: boolean;
}

const QUALITY_LABEL = { std: 'padrão', high: 'alta', max: 'máxima' } as const;
const VOICE_LABEL = {
  off: 'parada (fora da câmera)',
  starting: 'iniciando',
  listening: 'escutando',
  unsupported: 'sem suporte',
} as const;
const voiceState = (): string => (S.voiceEnabled ? VOICE_LABEL[S.voice] : 'desativada nos Ajustes');
const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Taxa real do último clipe salvo (tamanho ÷ duração): mostra se a Qualidade escolhida chegou ao arquivo. */
function lastClip(): string {
  const c = S.clips[0];
  if (!c || !c.durSec) return '-';
  const mbps = (c.blob.size * 8) / c.durSec / 1e6;
  return `${(c.blob.size / 1048576).toFixed(1)} MB · ${c.durSec.toFixed(1)} s · ≈ ${mbps.toFixed(1)} Mbps (vídeo + áudio)`;
}

/** Problemas que o Diagnóstico precisa destacar no topo. */
function alerts(): string[] {
  const out: string[] = [];
  if (S.micErr) out.push(`Microfone: ${S.micErr}`);
  if (S.audioDisabled) out.push('Áudio desativado nesta sessão');
  if (S.aErr) out.push(`Encoder de áudio: ${S.aErr}`);
  if (S.running && S.framesIn === 0 && performance.now() - S.startedAt > 3000)
    out.push('A câmera está ligada mas não entregou nenhum quadro');
  if (S.dropped > 0) out.push(`${S.dropped} quadro(s) de vídeo descartado(s)`);
  if (S.reorders > 0) out.push(`${S.reorders} quadro(s) fora de ordem`);
  if (S.note) out.push(`Aviso do app: ${S.note}`);
  return out;
}

/** Seções do Diagnóstico, da mais importante para a menos importante. */
export function diagnosticsSections(): DiagSection[] {
  const sp = support();
  const ok = (x: boolean): string => (x ? 'sim' : 'NÃO');
  const at = S.stream?.getAudioTracks()[0];
  const vt = S.stream?.getVideoTracks()[0];
  const st = vt?.getSettings?.() ?? {};
  const ios = /OS (\d+)[_.](\d+)/.exec(navigator.userAgent);
  const sections: DiagSection[] = [];

  const problems = alerts();
  if (problems.length) sections.push({ title: 'Atenção', lines: problems, alert: true });

  sections.push({
    title: 'Resumo',
    rows: [
      ['App', `${APP_NAME} v${APP_VERSION}`],
      ['iPhone', ios ? `iOS ${ios[1]}.${ios[2]}` : '?'],
      ['Câmera', S.running ? 'ligada' : 'desligada'],
      ['Gravando', S.rec ? 'sim' : 'não'],
      ['Voz', voiceState()],
      ...(S.running
        ? []
        : ([
            [
              'Dica',
              'Câmera desligada: abra o Diagnóstico pela tela da câmera para ver vídeo e áudio ao vivo',
            ],
          ] as Row[])),
      ['App aberto há', `${Math.round(performance.now() / 1000)} s`],
    ],
  });

  sections.push({
    title: 'Vídeo',
    rows: [
      [
        'Pedido',
        `${cfg.quality === '2160' ? '4K' : cfg.quality + 'p'} · ${cfg.fps} fps · ${QUALITY_LABEL[cfg.imageQuality]}`,
      ],
      [
        'Entregue pela câmera',
        st.width ? `${st.width}x${st.height} @ ${Math.round(st.frameRate || 0)} fps` : '-',
      ],
      ['Codificação', S.W ? `${S.W}x${S.H} · ${S.codec} · ${(S.bitrate / 1e6).toFixed(0)} Mbps` : '-'],
      ['Quadros', `entrada ${S.framesIn} · saída ${S.framesOut} (${S.outFps.toFixed(1)}/s)`],
      ['Descartados / fora de ordem', `${S.dropped} / ${S.reorders}`],
      ['Último clipe', lastClip()],
      ['Buffer', `${S.buffer.video.length} quadros · ${S.buffer.audio.length} blocos de áudio`],
      ['Elemento de vídeo', S.srcInfo || '-'],
      ['Player de clipes', S.playErr || 'sem erro'],
      ['Nível', S.levelOn ? S.levelInfo || 'ligado, sem leitura' : 'desligado'],
    ],
  });

  sections.push({
    title: 'Áudio',
    rows: [
      ['Microfone', at ? (at.muted ? 'MUDO' : at.readyState) : 'nenhum'],
      ['Contexto de áudio', S.audioCtx ? S.audioCtx.state : '-'],
      [
        'Processamento do mic',
        at?.getSettings
          ? `eco ${at.getSettings().echoCancellation ? 'sim' : 'não'} · ruído ${at.getSettings().noiseSuppression ? 'sim' : 'não'} · ganho ${at.getSettings().autoGainControl ? 'sim' : 'não'}`
          : '-',
      ],
      ['Sinal', `pico ${S.audioPeak.toFixed(3)} · ${S.audioBlocks} blocos`],
      [
        'Codificação',
        S.nCh
          ? `${S.sampleRate} Hz · ${S.nCh} canal(is) · AAC`
          : S.audioDisabled
            ? 'desativada'
            : 'aguardando',
      ],
      [
        'Fluxo',
        `chunks ${S.aOut} · fila ${S.aEnc ? S.aEnc.encodeQueueSize : '-'} · ressincs ${S.aResyncs} · erros ${S.aErrCount}`,
      ],
      ['Áudio − vídeo', S.aLastTs && S.lastInTs ? `${Math.round((S.aLastTs - S.lastInTs) / 1000)} ms` : '-'],
      [
        'Bipe',
        `${S.soundOn ? 'alto-falante ' + { normal: 'normal', high: 'alto', max: 'máximo' }[S.beepVol] : 'sem som'} · ${S.beepInClip ? 'no vídeo' : 'fora do vídeo'}`,
      ],
    ],
  });

  const voice = S.voiceLog.slice(-6);
  sections.push({
    title: 'Comando de voz',
    rows: [['Estado', voiceState()]],
    lines: voice,
  });

  sections.push({
    title: 'Tela',
    rows: viewportRows(),
    lines: viewportLog(),
  });

  sections.push({
    title: 'Permissões e ciclo de vida',
    rows: lifecycleRows(),
    lines: lifecycleEvents().slice(-6),
  });

  sections.push({ title: 'Câmera: início', lines: S.camLog.slice(-8) });

  sections.push({
    title: 'Lentes',
    rows: [
      ['Câmeras', S.lensInfo ? clean(S.lensInfo) : '-'],
      ['Controles', S.camCaps || '-'],
      ['Em uso', `${S.lensActive}×`],
      ['Ultra-angular', S.lensId ? 'sim' : 'não'],
      ['Zoom mínimo', String(S.lensZoomMin)],
    ],
  });

  sections.push({
    title: 'Navegador',
    rows: [
      ['VideoEncoder / AudioEncoder', `${ok(sp.VideoEncoder)} / ${ok(sp.AudioEncoder)}`],
      ['AudioWorklet', ok(sp.AudioWorklet)],
      ['Quadro por quadro (rVFC)', ok(sp.rVFC)],
      ['Tela sempre ligada', ok(sp.WakeLock)],
      ['Compartilhar arquivos', ok(sp.Share)],
    ],
    lines: [navigator.userAgent],
  });

  return sections;
}

/** O mesmo conteúdo em texto simples (botão "Copiar"). */
export function diagnosticsText(): string {
  return diagnosticsSections()
    .map((s) =>
      [
        `== ${s.title} ==`,
        ...(s.rows ?? []).map(([k, v]) => `${k}: ${v}`),
        ...(s.lines ?? []).map((l) => `  ${l}`),
      ].join('\n'),
    )
    .join('\n\n');
}
