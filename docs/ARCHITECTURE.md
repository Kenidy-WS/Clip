# Arquitetura

## Visão geral

```
câmera ─► canvas ─► VideoEncoder (H.264) ─┐
                                          ├─► ReplayBuffer (RAM, últimos N s + 3 s)
mic ─► AudioWorklet ─► AudioEncoder (AAC) ┘                │
                                                           ▼ ao gravar: corte no keyframe, depois acumula até "Parar"
                      gravação longa (padrão) ─► disk-rec: MP4 fragmentado, pedaço a cada ~2 s ─► IndexedDB `parts`/`takes`
                      plano B (Ajustes)        ─► mp4-muxer na RAM (~90 s) ─► IndexedDB `clips`
```

No clipe em disco o vídeo **é** a sequência de pedaços (`ClipRecord.take`); só o resumo da gravação é apagado depois de salvar. Clipes em
disco ≥ 250 MB saem por download do service worker (`__clip/`), os menores pela folha de compartilhar do iOS.

## Estrutura de pastas

| Pasta          | Papel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/`    | Lógica pura (sem DOM), com teste em `tests/`: `replay-buffer` (janela, corte, descarte), `timestamps` (rebase), `aac` (ASC/ADTS), `clip-name`, `format` (m:ss), `day-label` ("Hoje", "Ontem", dia da semana), `wake-word` (texto → palavra de ativação "Ei Clip", "Câmera, ação" ou "Ei Câmera" e trava contra disparo duplo), `lens` (qual câmera é a ultra-angular traseira), `beep-wave` (amostras e perfis do bipe), `video-profile` (taxa, nível H.264, duração máxima), `level` (inclinação do horizonte), `part-collector` (junta o que o muxer entrega em pedaços contíguos), `salvage` (monta o MP4 e cai para só vídeo se falhar), `retry` |
| `src/media/`   | Motor, sem DOM: `camera` (permissões, start/stop, lentes, microfone mudo, **câmera estacionada**), `video` (laço de captura + encoder), `audio` (worklet + AAC + relógio + bipe no clipe), `worklet-source`, `audio-session` (categoria de áudio do iOS), `recorder` (início/fim do clipe, `salvageRecording`), `mp4`, `disk-rec` (gravação longa em disco), `rec-sink` (entrega chunks ao disco ou à RAM), `beep`, `orientation` (permissão de movimento para o nível), `support`, `voice` (escuta contínua por Web Speech)                                                                                                                         |
| `src/storage/` | `clip-store` (IndexedDB dos clipes e estimativa de armazenamento), `take-store` (pedaços e resumo das gravações em disco), `prefs` (preferências em localStorage)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/ui/`      | Só desenha e lê o estado: `dom` (elementos), `controls` (controles e tick de 250 ms), `navigation` (telas, abrir câmera), `clips-view` (galeria, recentes, player e seus gestos), `gestures` (voltar/avançar pela borda), `sheet-swipe` (arrastar fecha os Ajustes), `thumbs` (miniaturas), `transitions`, `icons`, `status` (balão de aviso), `level` (nível sobre a prévia), `viewport` (tamanho real da janela e área segura), `rec-guard` (salva a gravação ao sair do app), `brand-intro` (abertura da marca), `diagnostics`, `diag-view`, `lifecycle-log`                                                                                      |
| `src/pwa/`     | Registro do service worker e aviso de atualização                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/`         | `app.ts` (liga tudo, Ajustes), `main.ts` (entrada), `state.ts` (estado `S` e `cfg`), `events.ts` (motor → interface), `strings.ts` (textos), `config.ts`, `types.ts`, `clips.ts` (lista de clipes, salvar, recuperar takes), `styles.css` (tokens `:root`)                                                                                                                                                                                                                                                                                                                                                                                           |
| `scripts/`     | Plugin do Vite que gera `dist/sw.js` (lista de arquivos + versão por hash) e `sw-template.js` (cache e download de clipes longos)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `tests/`       | Vitest: buffer, timestamps, AAC, montagem do MP4, gravação em disco, voz, lente, bipe, perfis de vídeo, formatos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `e2e/`         | Fluxo no Chromium (Playwright) com codificadores falsos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `docs/`        | `STATUS.md` (estado atual), `HISTORICO.md` (registro completo), `ROADMAP.md`, este arquivo e `design/` (referências da marca)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Decisões

- **PWA com WebCodecs** em vez de MediaRecorder: só assim existe pre-roll com qualidade controlada (H.264 16 Mbps, AAC 192 kbps).
- **Buffer de chunks codificados** (e não de quadros crus): cabe na RAM do Safari. Keyframe a cada 1 s torna o corte preciso.
- **Estado compartilhado `S`** em `state.ts`: simples e explícito, mas já grande (câmera, áudio, voz, gravação, interface).
  Candidato a virar serviços na Onda 4 (ver roadmap).
- **Motor sem DOM:** avisos saem por `events.ts`. Exceção temporária: `media/` lê o elemento `<video>` de `ui/dom`.
- **Service worker gerado no build:** o nome do cache inclui hash do conteúdo, então toda mudança dispara a atualização.
  Não há `skipWaiting` automático: a versão nova só entra quando o usuário toca em "Atualizar" (nunca no meio de uma gravação).
- **Caminhos relativos (`base: './'`):** o app roda em qualquer endereço (github.io/Clip/, domínio próprio).

- **Comando de voz = Web Speech API (pt-BR), não Porcupine:** testada no iPhone com câmera+mic abertos, música alta e em
  modo avião (3 min, 0 erros, 0 reinícios). Reconhece "Ei clipe/Oi clipe/Hey clipe"; o texto parcial chega ~0,4 a 0,9 s
  depois do início da fala. Cada fala vale um comando (chave = instância + índice do resultado) e há 3 s de intervalo mínimo.
  O comando **alterna** a gravação (inicia com o pre-roll / para e salva); o pre-roll de 15–30 s já cobre a latência.
  Até a v0.21.4 a escuta ligava **primeiro**, dentro do toque em "Abrir câmera" (`startVoice('tap')`); na v0.21.5 (experimento, `VOICE_AFTER_CAMERA`) a câmera abre primeiro e a escuta liga logo depois (`startVoice('auto')`; ver "Ordem de início" em `CLAUDE.md`). Ela para em `stopAll()` e reinicia sozinha quando o iOS a encerra.
  Plano B se falhar em campo: Porcupine Web (roda 100% no aparelho; exige chave e palavra treinada no Picovoice).
- **Palavra de ativação escolhida (v0.17.0):** `S.wakeWord` (`'clip' | 'camera-acao' | 'ei-camera'`, preferência `wake`) decide só
  **como o texto da escuta é interpretado** (`wakeMatcher` em `core/wake-word.ts`, usado em `onResult` de `media/voice.ts`); o
  reconhecedor, os religamentos e o toque não mudam, então trocar a palavra não reinicia nada. Cada palavra tem `full`, `loose` e
  `early`; só "Ei Clip" tem os atalhos "ei cli" e "clip" solto. "Câmera" é palavra comum: as outras duas exigem a frase completa
  e "Ei Câmera" não aceita as saudações curtas (`a`, `e`, `eu`, `ai`), senão "a câmera está ligada" dispararia. Motivo: vários celulares
  perto uns dos outros com o mesmo gatilho disparavam juntos. Para acrescentar uma palavra: tipo em `types.ts`, matcher em
  `wake-word.ts` com testes de aceitar e de ignorar, botão em `#segWake` (`index.html`) e rótulo em `T.wakeLabel`.

- **Três telas (Início, Câmera, Galeria) em `S.view`:** o iOS só libera áudio, câmera sem ficar muda e escuta de voz dentro de um
  gesto do usuário; o toque em "Abrir câmera" (`openCamera` em `ui/navigation.ts`) liga tudo junto e não pode esperar nada antes de
  `start()`. Reiniciar só a câmera não para a voz (`stopAll(keepTracks, keepVoice)`). Sair da tela da câmera (`showScreen`) cancela
  abertura em andamento (`cancelStart`), para captura, microfone e voz e suspende o áudio: a Galeria nunca tem captura ligada.
- **Câmera estacionada:** ao sair da tela da câmera (Início ou Galeria) a captura (câmera, microfone e voz) não é desligada: fica
  **estacionada por 60 s** (`parkCamera`/`resumeParked`/`releaseCamera` em `camera.ts`) e `pump` deixa de codificar (`isParked()`).
  Voltar nesse prazo é instantâneo e não pede permissão nem toque; passado o prazo, ao ligar o som de um clipe ou ao mudar um ajuste
  de vídeo, a captura é liberada e a volta espera um toque (`S.needResume`). Motivo: o iOS só dispensa o pedido de permissão enquanto
  existe captura ativa na página, e o microfone costuma nascer mudo se reaberto logo depois de liberado.
- **Gravação longa em disco (padrão):** `media/disk-rec.ts` grava MP4 fragmentado em pedaços no IndexedDB (memória usada: só o
  fragmento em andamento), até 30 min (`DISK_MAX_SEC`) e para sozinho com menos de 300 MB livres. `recoverTakes()` (`clips.ts`) recupera
  takes interrompidos na abertura (perda máxima ~2 s). Se o disco falhar no meio, o trecho já gravado é salvo.
- **Gravação nunca é descartada:** todo caminho que encerra a captura com gravação ativa passa por `salvageRecording()`
  (`media/recorder.ts`); `ui/rec-guard.ts` a chama ao sair do app; a montagem do MP4 tem plano B só com vídeo (`core/salvage.ts`).
- **Visual em um só lugar:** cores em tokens `:root` (`styles.css`), ícones em `ui/icons.ts` (`data-icon`), textos em `strings.ts`
  e rótulos fixos no `index.html`. Preferências (qualidade, buffer, lente, sons, voz, palavra de ativação) em `storage/prefs.ts`.

## Limites conhecidos

Ver "Armadilhas do iOS/Safari" em `CLAUDE.md` e as pendências em `docs/STATUS.md`. Gravação de até 30 min por clipe com a gravação longa em
disco (padrão); desligada nos Ajustes, o limite volta a ~90 s (memória). Permissões de câmera e microfone são pedidas a cada abertura do
app instalado. O app precisa ficar aberto com a tela ligada.
