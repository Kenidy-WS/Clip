# Arquitetura

## Visão geral

```
câmera/mic ──► VideoEncoder (H.264) ─┐
                                     ├─► ReplayBuffer (RAM, últimos N s) ──► ao gravar: corte no keyframe ─► mp4-muxer ─► IndexedDB
mic ─► AudioWorklet ─► AudioEncoder (AAC) ─┘                                         │
                                                                                      └─► continua acumulando até "Parar"
```

## Estrutura de pastas

| Pasta          | Papel                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/`    | Lógica pura e testada: `replay-buffer` (janela, corte, descarte), `timestamps` (rebase), `aac` (ASC/ADTS), `clip-name`                                                       |
| `src/media/`   | Motor: `camera` (permissões, start/stop), `video` (laço de captura + encoder), `audio` (worklet + AAC + relógio), `recorder` (início/fim do clipe), `mp4`, `beep`, `support` |
| `src/storage/` | `clip-store`: IndexedDB e estimativa de armazenamento                                                                                                                        |
| `src/ui/`      | Interface: `dom` (elementos), `controls` (botão, tick de 250 ms), `clips-view` (lista), `diagnostics`, `status`                                                              |
| `src/pwa/`     | Registro do service worker e aviso de atualização                                                                                                                            |
| `src/`         | `app.ts` (liga tudo), `main.ts` (entrada), `state.ts` (estado), `events.ts` (motor → interface), `strings.ts` (textos), `config.ts`                                          |
| `scripts/`     | Plugin do Vite que gera `dist/sw.js` (lista de arquivos + versão por hash)                                                                                                   |
| `tests/`       | Vitest: buffer, timestamps, AAC, montagem do MP4                                                                                                                             |
| `e2e/`         | Fluxo no Chromium (Playwright)                                                                                                                                               |

## Decisões

- **PWA com WebCodecs** em vez de MediaRecorder: só assim existe pre-roll com qualidade controlada (H.264 16 Mbps, AAC 192 kbps).
- **Buffer de chunks codificados** (e não de quadros crus): cabe na RAM do Safari. Keyframe a cada 1 s torna o corte preciso.
- **Estado compartilhado `S`** em `state.ts`: simples e explícito para o motor atual. Candidato a virar classes/serviços
  quando entrar o comando de voz (ver roadmap).
- **Motor sem DOM:** avisos saem por `events.ts`. Exceção temporária: `media/` lê o elemento `<video>` de `ui/dom`.
- **Service worker gerado no build:** o nome do cache inclui hash do conteúdo, então toda mudança dispara a atualização.
  Não há `skipWaiting` automático: a versão nova só entra quando o usuário toca em "Atualizar" (nunca no meio de uma gravação).
- **Caminhos relativos (`base: './'`):** o app roda em qualquer endereço (github.io/Clip/, domínio próprio).

## Limites conhecidos

Ver "Armadilhas do iOS/Safari" em `CLAUDE.md`. Gravação máxima de 90 s por clipe (memória). Permissões pedidas a cada abertura.
