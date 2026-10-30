# Arquitetura

## Visão geral

```
câmera/mic ──► VideoEncoder (H.264) ─┐
                                     ├─► ReplayBuffer (RAM, últimos N s) ──► ao gravar: corte no keyframe ─► mp4-muxer ─► IndexedDB
mic ─► AudioWorklet ─► AudioEncoder (AAC) ─┘                                         │
                                                                                      └─► continua acumulando até "Parar"
```

## Estrutura de pastas

| Pasta          | Papel                                                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/`    | Lógica pura e testada: `replay-buffer` (janela, corte, descarte), `timestamps` (rebase), `aac` (ASC/ADTS), `clip-name`, `wake-word` (texto → "Ei Clip" e trava contra disparo duplo)                                   |
| `src/media/`   | Motor: `camera` (permissões, start/stop), `video` (laço de captura + encoder), `audio` (worklet + AAC + relógio), `recorder` (início/fim do clipe), `mp4`, `beep`, `support`, `voice` (escuta contínua por Web Speech) |
| `src/storage/` | `clip-store`: IndexedDB e estimativa de armazenamento                                                                                                                                                                  |
| `src/ui/`      | Interface: `dom` (elementos), `controls` (telas e controles, tick de 250 ms), `navigation` (abrir câmera/trocar de tela), `clips-view` (galeria, recentes e player), `icons`, `diagnostics`, `status`                  |
| `src/pwa/`     | Registro do service worker e aviso de atualização                                                                                                                                                                      |
| `src/`         | `app.ts` (liga tudo), `main.ts` (entrada), `state.ts` (estado), `events.ts` (motor → interface), `strings.ts` (textos), `config.ts`                                                                                    |
| `scripts/`     | Plugin do Vite que gera `dist/sw.js` (lista de arquivos + versão por hash)                                                                                                                                             |
| `tests/`       | Vitest: buffer, timestamps, AAC, montagem do MP4                                                                                                                                                                       |
| `e2e/`         | Fluxo no Chromium (Playwright)                                                                                                                                                                                         |

## Decisões

- **PWA com WebCodecs** em vez de MediaRecorder: só assim existe pre-roll com qualidade controlada (H.264 16 Mbps, AAC 192 kbps).
- **Buffer de chunks codificados** (e não de quadros crus): cabe na RAM do Safari. Keyframe a cada 1 s torna o corte preciso.
- **Estado compartilhado `S`** em `state.ts`: simples e explícito para o motor atual. Candidato a virar classes/serviços
  quando entrar o comando de voz (ver roadmap).
- **Motor sem DOM:** avisos saem por `events.ts`. Exceção temporária: `media/` lê o elemento `<video>` de `ui/dom`.
- **Service worker gerado no build:** o nome do cache inclui hash do conteúdo, então toda mudança dispara a atualização.
  Não há `skipWaiting` automático: a versão nova só entra quando o usuário toca em "Atualizar" (nunca no meio de uma gravação).
- **Caminhos relativos (`base: './'`):** o app roda em qualquer endereço (github.io/Clip/, domínio próprio).

- **Comando de voz = Web Speech API (pt-BR), não Porcupine:** testada no iPhone com câmera+mic abertos, música alta e em
  modo avião (3 min, 0 erros, 0 reinícios). Reconhece "Ei clipe/Oi clipe/Hey clipe"; o texto parcial chega ~0,4 a 0,9 s
  depois do início da fala. Cada fala vale um comando (chave = instância + índice do resultado) e há 3 s de intervalo mínimo.
  O comando **alterna** a gravação (inicia com o pre-roll / para e salva); o pre-roll de 15–30 s já cobre a latência.
  A escuta liga com a câmera (`startVoice` no fim de `start()`), para em `stopAll()` e reinicia sozinha quando o iOS a encerra.
  Plano B se falhar em campo: Porcupine Web (roda 100% no aparelho; exige chave e palavra treinada no Picovoice).

- **Três telas (Início, Câmera, Galeria) em `S.view`:** o iOS só libera áudio, câmera sem ficar muda e escuta de voz dentro de um
  gesto do usuário; o toque em "Abrir câmera" (`openCamera` em `ui/navigation.ts`) liga tudo junto e não pode esperar nada antes de
  `start()`. Reiniciar só a câmera não para a voz (`stopAll(keepTracks, keepVoice)`). Sair da tela da câmera (`showScreen`) cancela
  abertura em andamento (`cancelStart`), para captura, microfone e voz e suspende o áudio: a Galeria nunca tem captura ligada.
- **Visual em um só lugar:** cores em tokens `:root` (`styles.css`), ícones em `ui/icons.ts` (`data-icon`), textos em `strings.ts`
  e rótulos fixos no `index.html`. Preferências (qualidade, buffer, lente, sons, voz) em `storage/prefs.ts`.

## Limites conhecidos

Ver "Armadilhas do iOS/Safari" em `CLAUDE.md`. Gravação máxima de 90 s por clipe (memória). Permissões pedidas a cada abertura.
