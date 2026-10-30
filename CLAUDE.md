# Ei Clip — guia para quem continua o desenvolvimento

Câmera de ação para iPhone feita como PWA (sem Mac, sem App Store): grava o que aconteceu **antes** do toque
(buffer circular de 15/30 s) e, no futuro, dispara por comando de voz ("Ei Clip"). Uso pessoal do Kenidy e de
amigos, para filmar pesca e postar no TikTok/Instagram.

## Comece por aqui (troca de chat)

1. Leia `docs/STATUS.md` (onde paramos, o que testar, próximos passos) e `docs/ROADMAP.md` (ondas).
2. Leia `docs/ARCHITECTURE.md` antes de mexer em `src/media/` ou `src/core/`.
3. Rode `npm ci && npm run check` para confirmar que tudo está verde antes de começar.
4. Ao terminar a sessão, **atualize `docs/STATUS.md`** (feito, pendente, decisões, o que o Kenidy precisa testar no iPhone).

## Comandos

- `npm run dev` servidor local · `npm run build` build de produção em `dist/` (inclui o `sw.js` gerado)
- `npm run check` = typecheck + lint + format:check + testes + build (é o que o CI roda)
- `npm run e2e` fluxo no Chromium com Playwright (precisa do `dist/`; usa codificadores falsos)
- `npm run format` aplica o Prettier

## Regras do projeto

- **Textos:** toda frase exibida ao usuário fica em `src/strings.ts`. Tom simples, formal e profissional; telas limpas, sem
  informação técnica para o usuário final (diagnóstico é só para desenvolvimento).
- **Camadas:** `src/core/` é lógica pura (sem DOM, sem navegador) e **tem teste** em `tests/`. `src/media/` é o motor
  (câmera, encoders, buffer) e não conhece o DOM: avisa a interface por `src/events.ts`. `src/ui/` só desenha e lê o estado.
- **Versão:** ao publicar uma mudança, suba `version` em `package.json` (aparece no rodapé; o `sw.js` ganha hash do
  conteúdo e dispara o aviso "Nova versão disponível" sozinho).
- **Publicação:** push na `main` roda `.github/workflows/deploy.yml` (checks + GitHub Pages). Base de caminhos é `./`.
- Commits: mensagens em português, curtas, no formato "vX.Y.Z: o que mudou".
- Trabalho em **ondas** (ver roadmap): uma onda por chat, o Kenidy testa no iPhone e aprova antes da próxima.

## Armadilhas do iOS/Safari já descobertas (não repita)

- **Nunca chamar `encoder.flush()` ao parar** a gravação: reinicia o estado do AAC e gera timestamps fora de ordem.
  Esperamos a fila esvaziar (`drainEncoders`) e cortamos em `stopTs`.
- **Quadros via canvas:** `VideoFrame(<video>)` sai deitado no iOS; `drawImage` no canvas respeita a rotação.
- **AAC no MP4:** o Safari entrega um `esds` de 39 bytes como `description`; o MP4 precisa só dos 2 bytes do
  AudioSpecificConfig (`extractAsc`). Sem isso o áudio fica inválido.
- **Relógio do áudio** é contador de amostras ancorado em `performance.now()` e reancora se atrasar >250 ms
  (o iOS suspende o áudio ao compartilhar/salvar).
- **Áudio de reprodução:** com câmera+mic ligados o iOS silencia `<video>` da página. Ao dar play num clipe o app
  para a captura (`onClipPlay`). Alternativa futura: `navigator.audioSession.type`.
- **Permissões** de câmera/mic são pedidas a cada abertura do app instalado (bug WebKit 280394): não há contorno em código.
  No Safari comum, "aA → Ajustes do Site → Permitir" costuma persistir.
- **AudioContext** só liga após um toque; é criado em `start()` dentro do gesto e mantido entre reinícios.
- **Cache:** GitHub Pages manda `max-age=600`; o service worker usa rede primeiro com `cache: 'no-cache'`.
- O pre-roll é **zerado depois de cada clipe** para o final de um clipe não reaparecer no começo do próximo.
- Buffer guarda `janela + 3 s` e há keyframe forçado a cada 1 s (precisão do corte).
- O app precisa ficar aberto com a tela ligada (Wake Lock); em segundo plano o iOS suspende a câmera.

## Ambiente de desenvolvimento (Claude)

- Não há Mac nem iPhone na sandbox: o que depende de WebCodecs/H.264/AAC reais só se confirma no iPhone do Kenidy.
  Os testes automáticos cobrem lógica pura, montagem do MP4 e o fluxo da interface (com codificadores falsos).
- Não é possível alterar configurações do GitHub (Pages, tags) por aqui; peça ao Kenidy.
- O Kenidy tem conhecimento básico de front-end e quer que o Claude escreva o código; explique decisões em português
  simples, direto ao ponto. Comparações em listas curtas (tela de celular).
