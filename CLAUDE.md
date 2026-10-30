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

- **Telas:** Início, Câmera e Galeria (`S.view`), sem rolagem da página. Sair da câmera desliga captura/voz. Cores só por tokens
  `:root` em `styles.css` (amarelo = ativo, vermelho = gravar, verde = escutando); ícones só em `src/ui/icons.ts`.
- **Textos:** toda frase exibida ao usuário fica em `src/strings.ts` (rótulos fixos de botões/ajustes ficam no `index.html`). Tom simples, formal e profissional; telas limpas, sem
  informação técnica para o usuário final (diagnóstico é só para desenvolvimento).
- **Camadas:** `src/core/` é lógica pura (sem DOM, sem navegador) e **tem teste** em `tests/`. `src/media/` é o motor
  (câmera, encoders, buffer) e não conhece o DOM: avisa a interface por `src/events.ts`. `src/ui/` só desenha e lê o estado.
- **Versão:** ao publicar uma mudança, suba `version` em `package.json` (aparece no rodapé; o `sw.js` ganha hash do
  conteúdo e dispara o aviso "Nova versão disponível" sozinho).
- **Publicação:** push na `main` roda `.github/workflows/deploy.yml` (checks + GitHub Pages). Base de caminhos é `./`.
- **Fluxo de entrega (pedido do Kenidy):** quando uma feature estiver pronta e `npm run check` + `npm run e2e` passarem,
  suba direto na `main` (sem esperar aprovação do merge) para ele validar no iPhone. Avise a versão publicada e o que testar.
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
- **Comando de voz (Web Speech):** o reconhecedor devolve a mesma fala várias vezes (parciais e final) e a escreve como
  "Ei clipe", "Oi clipe", "Hey clipe", "Ec clipe"; por isso o gatilho é por fala (`WakeGate`) e a lista de variações fica em
  `src/core/wake-word.ts`. O iOS encerra a escuta sozinho de tempos em tempos (religamos em `onend`) e pode recusar iniciar sem
  um toque. **Escuta iniciada sem toque (abertura do app, religamento automático) pode ficar muda sem dar erro** (visto no iPhone
  na v0.5.0: ícone verde e nenhum comando reconhecido até desligar/ligar o botão). Por isso o indicador só fica verde depois de
  `onaudiostart`/resultado. **A escuta só começa dentro de um toque** (`voiceTap`; sem toque ela fica surda, confirmado de novo na v0.5.6):
  `startVoice()` sem toque só marca "aguardando toque" (ícone âmbar + aviso). Por isso a câmera **não abre sozinha** (v0.6.0):
  o Início tem o botão "Abrir câmera" (`openCamera`), que liga câmera, áudio e voz no mesmo gesto. Eventos da escuta ficam no
  painel "i" (linha "Voz").
- **Dois pedidos de permissão:** o iOS pede (1) "Câmera e Microfone" (`getUserMedia`) e, quando a escuta de voz inicia, (2) "Microfone"
  de novo, só para o reconhecimento de voz (Web Speech). Não há como juntar os dois em código. No Safari, "aA → Ajustes do Site →
  Câmera/Microfone: Permitir" pode eliminar ambos (a confirmar se vale para o pedido da voz); o app instalado não tem esses ajustes.
- **Ordem de início (v0.7.0):** no toque em "Abrir câmera", `start(false, true)` liga a voz **primeiro** (`startVoice('tap')`, dentro do gesto)
  e só abre a câmera depois de `voiceSettled` (microfone da voz aberto/recusado/20 s). Ligar voz e câmera ao mesmo tempo dava
  tela preta + 3 pedidos. Reinícios mantêm a captura antiga aberta até a nova chegar (senão o iOS pede permissão de novo).
- **Janela menor que a tela (v0.8.1):** no app instalado o iOS pode informar `innerHeight` ≈ tela − notch (faixa preta fixa embaixo,
  faixas em volta ao voltar do app). `src/ui/viewport.ts` define `--app-w/--app-h` (tela inteira em modo instalado) e "cutuca" o
  viewport se a diferença persistir; a linha "Tela" do Diagnóstico mostra os valores. Hipótese a confirmar no iPhone.
- **Áudio recusado (v0.8.1):** o iOS já respondeu `OverconstrainedError: Invalid constraint` às restrições de áudio e a câmera abria
  sem microfone. `getMedia` (`camera.ts`) pede áudio em 3 níveis (estrito → sem `channelCount` → padrão) e só desce nesse erro.
- **Lente 0,5×:** o iOS só informa os nomes das câmeras depois da permissão; a ultra-angular é a câmera cujo nome casa `/ultra/i`
  (`deviceId: {exact}`); sem ela, tenta `zoom` < 1. Detalhes em `refreshLenses` (`camera.ts`).
- **Permissão e capturas (v0.8.4):** o iOS só dispensa o pedido de câmera/microfone enquanto ainda existe uma captura ativa na página; parar todas as faixas e chamar `getUserMedia` de novo pede de novo. Por isso, ao voltar do segundo plano **não** refazemos a captura se as faixas seguem `live` (`returnFromBackground` em `app.ts`).
- **Prévia (v0.8.4):** ao trocar de lente o iOS pode desenhar o `<video>` menor que o elemento (faixas). O elemento é recriado a cada captura (`renewPreview`); nunca guardar referência ao `<video>`, use `els.video` (getter).
- **Bipe (v0.9.0):** gerado por `core/beep-wave.ts` e tocado como `AudioBuffer`; com `beepInClip` as mesmas amostras são somadas ao bloco de áudio em `audio.ts` (`mixBeepInto`). O microfone fica mudo durante o bipe do alto-falante para não captá-lo em dobro.
- **Qualidade (v0.9.0):** resolução, fps e taxa vêm de `cfg` e de `core/video-profile.ts` (tabelas de taxa, nível H.264, duração máxima do clipe). Não usar mais constantes `FPS`/`VIDEO_*` em `config.ts`.
- **Sessão de áudio (v0.9.8):** tocar clipe com som na Galeria pode deixar o microfone mudo ao voltar para a câmera. `setAudioSession` (`media/audio-session.ts`) troca a categoria e o `AudioContext` é fechado ao sair da câmera. Montar o MP4 trava a página: não fazer isso enquanto o bipe de parar toca (`stopRec` espera).
- **Miniaturas (v0.10.10):** nunca gerar miniatura decodificando clipes grandes (50–160 MB) no iPhone: um `<video>` por clipe derruba a Galeria e um `<video>` solto fora da página não decodifica. A miniatura (JPEG 240×320) é tirada do `S.canvas` ao parar a gravação e vai em `ClipRecord.thumb`.
- **Voz × bipe × microfone (v0.10.x):** o reconhecimento de voz aberto faz o bipe do alto-falante chiar (some com a voz desligada); abortar a voz no mesmo instante do bipe o deixa **mudo** (por isso `BEEP_LEAD_SEC`). O iOS ignora `autoGainControl`. O microfone da câmera costuma nascer **mudo (pico 0.0000)**: há reinício automático em `camera.ts`; recarregar a página **não** resolve e a voz religada sem toque fica surda. **Na recuperação do microfone mudo a voz tem de parar e esperar um toque** (`stopVoice()` em `camera.ts`): religar sem toque (v0.12.4) ou manter viva (v0.12.7) deixa o ícone verde com a escuta surda e sem aviso. Para eliminar o toque é preciso evitar o microfone mudo, não contornar a recuperação.
- **Reproduzir clipe (v0.12.x):** `setAudioSession('playback')` no player dá volume normal mas pode deixar o microfone mudo depois; sem ele o clipe toca baixo.
- O app precisa ficar aberto com a tela ligada (Wake Lock); em segundo plano o iOS suspende a câmera.

## Ambiente de desenvolvimento (Claude)

- Não há Mac nem iPhone na sandbox: o que depende de WebCodecs/H.264/AAC reais só se confirma no iPhone do Kenidy.
  Os testes automáticos cobrem lógica pura, montagem do MP4 e o fluxo da interface (com codificadores falsos).
- Não é possível alterar configurações do GitHub (Pages, tags) por aqui; peça ao Kenidy.
- O Kenidy tem conhecimento básico de front-end e quer que o Claude escreva o código; explique decisões em português
  simples, direto ao ponto. Comparações em listas curtas (tela de celular).
