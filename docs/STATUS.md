# Status

**Atualizado em:** 2026-10-30 · **No ar (`main`):** 0.15.7 · `estavel` = 0.15.7 (validada no iPhone)

## Próximo bloco: design (ícone e marca) — começa em chat novo

**Estado:** v0.15.7 na `main` e no `estavel` (nível, espelhar frontal, textos e Sons no vídeo validados). Slogan oficial: "Câmera de ação com comando de voz.".
**Design, o que já foi decidido (30/10):**

- "Clip" = **clipe de filmagem** (vídeo/câmera), NUNCA clipe de papel. Paleta: **amarelo + preto/cinza + vermelho de gravação** (as cores atuais do app; o azul-petróleo foi testado e descartado).
- Direção que ele gostou um pouco: **1 · Claquete** (amarelo sobre preto, ponto vermelho no centro). Ideia da exclamação ("Clip!" / "Ei Clip!") ainda aberta: pode entrar no nome ou só como marca dentro do app (a opção 3, "visor com !", é a que carrega isso).
- Descartados: volta no tempo (A), ondas/azul (B), "C" amarelo (C) e todas as variações com clipe de papel.
- Arquivos: `docs/design/claquete.svg` (base da claquete), `docs/design/rodada1.png`..`rodada3.png` (as três rodadas), `docs/design/rodada3.html` (fonte da rodada 3: claquete, lente, visor com "!").
  **Abertos para decidir:** nome ("Clip!", "Ei Clip!" ou "Ei Clip"); refinar a claquete (formas, contraste pequeno, talvez com a exclamação); depois gerar o ícone (180x180 apple-touch-icon, 192/512 do manifest, favicon) e aplicar no app e no `manifest.webmanifest`. Visual não pode tocar na área protegida (voz/microfone): versão separada.
  **Depois do design:** polimento/robustez (ROADMAP, Onda 4) e, quando quiser, estabilização/lanterna/balanço de branco.

## v0.15.7 — "Sons no vídeo"

Kenidy não gostou de "Marcar no vídeo": o ajuste agora se chama **Sons no vídeo**. Ele aprovou a revisão de textos da v0.15.6 e não vê outros pontos; a frase do Início "Câmera de ação com comando de voz." fica como **slogan oficial** do app.

## v0.15.6 — revisão de textos (1ª rodada)

Ajustes: "Sons de gravação" (volta o nome) e "Sons no vídeo" (o bipe também é gravado no clipe, para achar o momento na edição; antes "Bipe no vídeo gravado"). Avisos sem jargão e sem mensagens técnicas do navegador (`strings.ts`): erros de vídeo, áudio e de salvar agora dizem só o que fazer; o detalhe técnico fica no Diagnóstico. Aviso de download: "Arquivo pronto. Abra-o e escolha “Salvar vídeo”…". "Grave até o fim" → "Termine a gravação".
**Testar:** ver os avisos no uso normal; dizer quais ainda soam estranhos. **Falta:** telas do Início/Galeria (tagline, dicas), 2ª rodada com o que o Kenidy apontar.

## v0.15.5 — nomes dos Ajustes (início da revisão de textos)

Kenidy validou espelhamento e orientação deitada (com a rotação de tela do iPhone ligada). Estabilização ficou para depois (análise no ROADMAP). Renomeados: "Tempo antes do toque" → **Pré-gravação**; "Sons de gravação" → **Bipe ao gravar**; "Bipe no vídeo gravado" → **Bipe no clipe**. Só rótulos; nada de lógica.
**Resto da revisão:** avisos do balão (`strings.ts`), telas do download de clipe grande, textos do Início e da Galeria.

## v0.15.4 — "Espelhar frontal" agora vale para prévia e clipe

Na v0.15.3 a chave só mexia no clipe e o Kenidy comparava a **prévia** com a do iPhone ("o botão não muda nada"). Hipótese: o iOS entrega a frontal sem espelhar, e a Câmera do iPhone espelha por padrão. Agora, com a chave ligada (padrão), a prévia é espelhada por CSS (`body.mirror-front`) e o clipe é invertido no canvas (`video.ts`); desligada, ambos saem como o iOS entrega. Diagnóstico ganhou a linha "Frontal".
**Testar:** frontal com a chave ligada: a prévia deve ficar como a do app Câmera. Gravar com um papel de texto: o clipe deve sair igual à prévia. Se a prévia piorou (ficou o contrário do iPhone), a hipótese está errada: me contar e eu inverto.

## v0.15.3 — "Espelhar frontal"

Kenidy tem "Espelhar câmera frontal" ligado no iPhone e quer o clipe igual à prévia. A v0.15.2 (clipe invertido) fica como opção: Ajustes → **Espelhar frontal**, **ligado por padrão** (clipe = prévia, como a Câmera do iPhone); desligado, o clipe sai como os outros veem (texto legível). Vale para clipe e miniatura; traseira intacta.
**Testar:** gravar com a frontal nos dois modos e comparar com a prévia (versão 0.15.3 no rodapé; tocar em "Atualizar" se avisar).

## v0.15.2 — frontal sem espelhar no clipe

Kenidy viu o clipe da frontal espelhado e quer o contrário. Agora, com a frontal, o quadro é invertido na horizontal ao ir para o canvas (`video.ts`), então o clipe e a miniatura saem como os outros veem. A prévia não mudou. Lente traseira intacta.
**Testar:** gravar com a frontal um papel com texto: no clipe o texto deve sair legível. (Se a prévia ao vivo também deve ficar sem espelho, me dizer.)
**Deitado:** o diagnóstico enviado mostrou 1080x1920 e janela 393x852 (em pé). Possível causa: bloqueio de orientação do iPhone ligado (o app não gira) ou o diagnóstico foi copiado em pé. Sem girar, saber a posição do celular exigiria o sensor de movimento (permissão extra). Aguardando o teste com o bloqueio desligado.

## v0.15.1 — "Nível" e sondagem do foco

Nível validado no iPhone (funciona). Rótulo dos Ajustes agora é só "Nível". Nomes dos outros ajustes ("Tempo antes do toque" → ideia "Pré-gravação", "Som de gravação", bipe no vídeo) ficam para a revisão de textos.
**Foco por toque:** o Safari/iOS pode não expor controle de foco (`focusMode`/`pointsOfInterest`) à web. Em vez de supor, o Diagnóstico ganhou a linha "Controles" com o que a câmera informa. Se aparecer `focusMode`/`pointsOfInterest`, implemento o toque para focar; se não, o iOS segue com o foco automático contínuo e não há como fazer por código.
**Resultado (iPhone 18.7, 0,5×):** Controles = aspectRatio, backgroundBlur, deviceId, facingMode, frameRate, groupId, height, powerEfficient, torch, whiteBalanceMode, width, zoom. **Sem `focusMode`/`pointsOfInterest`: foco por toque não é possível na web.** Decisão: descartado. Disponíveis e ainda não usados: `torch` (lanterna), `whiteBalanceMode` (travar balanço de branco), `zoom`.

## v0.15.0 — nível de horizonte (opcional)

Linha sobre a prévia que mostra se o celular está torto; fica amarela quando está nivelado (até 1°) e some quando o celular aponta para cima ou para baixo. **Desligado por padrão**: o iOS exige uma permissão extra (sensores de movimento), então ela só é pedida ao ligar "Nível na tela" nos Ajustes, nunca ao abrir a câmera. Código: `core/level.ts` (conta, testada), `media/orientation.ts` (permissão e sensor), `ui/level.ts` (desenho). Fora da área protegida de voz/microfone.
**Testar no iPhone:**

- Ajustes → ligar "Nível na tela" → aceitar a permissão → ver a linha sobre a câmera (em pé e deitado).
- Fechar e abrir o app: o iOS pede a permissão de novo ou lembra? (me contar)
- Se a linha parecer invertida ou errada, copiar a linha "Nível" do Diagnóstico (mostra β/γ/inclinação).
  **Próximos:** foco por toque (conferir antes se o Safari permite), espelhamento/orientação da câmera, análise de estabilização, revisão geral de textos.

## v0.14.7 — textos e balão de aviso

Validado no iPhone pelo Kenidy (v0.14.6): áudio do clipe em disco OK; TikTok abre e toca o clipe fragmentado (postar de verdade ainda não feito); recuperação ao fechar o app OK; clipe salvo ao sair do app **tem** miniatura. Sobram só: parada por pouco espaço e limite de 30 min (difíceis de simular), calor/bateria em sessões longas.

- Balão de aviso (`.status`) mais estreito (até 300 px, ajustado ao texto), fonte 13 px, cantos menores. Posição mantida (abaixo da barra superior).
- Textos: sem jargão (MP4, H.264, AAC, AudioContext, nomes de erro) e mais curtos; palavras-chave que o e2e confere foram mantidas.
  **Testar:** ver os avisos (gravar/parar, salvar clipe grande, ligar o som do microfone) e dizer se a largura e a posição agradam.

## v0.14.6 — gravação longa oficial

Kenidy validou a v0.14.5 e pediu para oficializar. **Gravação longa agora vem ligada por padrão** (sem "experimental"; o interruptor nos Ajustes continua como plano B, desligado volta à gravação em memória de 90 s). Limite do download pelo service worker subiu de 100 para **250 MB** (`BIG_DOWNLOAD_BYTES`): clipes menores vão pela folha de compartilhar (menos telas), maiores por download. `estavel` avançou para a v0.14.5.
**Testar:** um clipe de ~200–250 MB (≈1 a 2 min) em "Salvar / Compartilhar": se a página cair, descer o limite.
**Pendências do bloco de gravação:** (1) áudio do clipe em disco ainda não conferido no iPhone (o player abre mudo; ligar o som desliga a câmera); (2) postar no TikTok/Instagram um clipe fragmentado; (3) recuperação ao fechar o app no meio de uma gravação longa; (4) clipe salvo ao sair do app ou recuperado fica sem miniatura; (5) parada por pouco espaço livre e limite de 30 min nunca exercitados no iPhone; (6) calor/bateria em sessões de 20–30 min; (7) revisão de textos e dos passos de download.

## v0.14.5 validada no iPhone (30/10, 16:22)

Clipe de 5:38 (1,22 GB) baixou e foi para o Rolo da Câmera sem travar. Fluxo atual: Salvar/Compartilhar → aviso do app → visualizador do iOS (arquivo MP4, "Abrir com… / Mais…") → "Mais…" → folha de compartilhar → "Salvar Vídeo". Funciona, mas tem 2 telas a mais que o fluxo curto.
**Pendente (pedido do Kenidy):** revisar os textos e a forma como as mensagens aparecem (ex.: aviso de download), deixando o fluxo mais harmonioso; ver se dá para encurtar o caminho até "Salvar Vídeo". `estavel` ainda em 0.13.2: avançar quando o Kenidy confirmar.

## v0.14.5 — clipe longo: download pelo service worker (a v0.14.4 foi desfeita)

v0.14.3 validada (gravação e player fluidos). Salvar o clipe de 5:38 (1,2 GB) pela folha de compartilhar **continua derrubando a página**, mesmo com cópia em arquivo único (v0.14.4, revertida): o problema é entregar um `File` gigante à folha, que o iOS carrega na memória.
Solução: o service worker serve o clipe como download comum (`./__clip/<nome>?take=<id>`, `scripts/sw-template.js`; lê os pedaços do IndexedDB, resposta com `Blob` de arquivos, `Content-Disposition: attachment`, suporta Range). O botão Salvar/Compartilhar de clipes em disco ≥ 100 MB usa esse download em vez da folha (`downloadViaWorker`, `clips-view.ts`). Clipes menores seguem pela folha ("Salvar vídeo").
**Incerteza:** como o iOS mostra o download no app instalado (aviso de downloads, Arquivos ou visualizador). O arquivo deve acabar em Arquivos > Downloads, de onde "Salvar vídeo" é nativo (sem limite de memória da página).
**Testar:** clipe de 5 min: Salvar/Compartilhar; ver o que aparece; achar o arquivo; salvar no Rolo; postar. Se a página ainda cair ou nada acontecer, me dizer o que apareceu.

## v0.14.2 e v0.14.3 — clipe em câmera lenta no player do app

Relato (1080p/60/máxima, 48 Mbps): na Galeria do Rolo o clipe toca normal; no player do app toca em câmera lenta. Arquivo grande (1,2 GB) não salva: a página trava e fica branca (curto salva).

- **v0.14.3:** com a captura estacionada (Galeria/Início) o app continuava desenhando e codificando 1080p60 a 48 Mbps enquanto o player decodificava: disputa do chip de vídeo. Agora `pump` não codifica enquanto `isParked()` (`media/video.ts`; o buffer já é descartado ao voltar). Câmera/microfone/voz seguem ligados.
- **v0.14.2:** 60 fps usa 1,25× a taxa (era 1,5×) e 1080p Alta/Máxima = 22/28 Mbps: 1080p60 máxima cai de 48 para 35 Mbps.
- **Aberto:** compartilhar/salvar arquivo grande derruba a página (a folha de compartilhar precisa carregar o arquivo inteiro na memória). Falta descobrir o limite: testar clipes de ~1, 2 e 4 min.

## v0.14.1 — clipe longo que não tocava nem baixava

Relato (iPhone, v0.14.0): take de 4:01 (4K, 1265 MB) gravou bem e por voz, esquentou pouco, mas o clipe não tocava e não baixava.
Causa provável: o clipe era uma montagem dos pedaços temporários e eu os **apagava** logo depois de salvar; no iOS o arquivo montado depende dos pedaços de origem e fica ilegível. Também copiava 1,2 GB (o dobro de espaço).
Correção: o clipe em disco **usa os próprios pedaços** (`ClipRecord.take`); só o resumo da gravação é apagado (`release`). Apagar o clipe apaga os pedaços. Diagnóstico ganhou a linha "Player de clipes" (código de erro do `<video>`).
O clipe de 4:01 gravado na v0.14.0 provavelmente não tem conserto: apagar.

**Testar:** gravar um take longo (2+ min), tocar, "Salvar vídeo" no Rolo, fechar e reabrir o app e tocar de novo. Se ainda não tocar: abrir o "i" e copiar a linha "Player de clipes".

**Pedidos novos do Kenidy (ainda não feitos):** (1) nível/horizonte na tela como o app nativo; (2) analisar estabilização de vídeo; (3) toque na tela para focar (hoje foco automático). Ver ROADMAP.

## v0.14.0 — gravação longa em disco (experimental, desligada por padrão)

Motivo (Kenidy): o limite de 90 s por clipe (RAM) é curto; o uso real são takes de 2 a 10 min.

- **Como funciona:** com "Gravação longa (experimental)" ligada nos Ajustes, o clipe é gravado como **MP4 fragmentado** direto no IndexedDB, um pedaço a cada ~2 s (`media/disk-rec.ts`, `storage/take-store.ts`, `core/part-collector.ts`). Memória usada: só o fragmento em andamento. Limite: 30 min (`DISK_MAX_SEC`) e para sozinho com menos de 300 MB livres. Desligada, tudo segue como na v0.13.5 (RAM, 90 s).
- **Se algo falhar** ao abrir o disco, a gravação segue na memória. Se o disco falhar no meio, a gravação encerra e guarda o que já estava gravado.
- **Recuperação:** se o app for encerrado/travar gravando, na próxima abertura o trecho até o último fragmento vira clipe ("Um clipe interrompido foi recuperado…", `recoverTakes` em `clips.ts`). Perda máxima: ~2 s.
- Banco IndexedDB passou para a versão 2 (lojas `parts` e `takes`); clipes existentes não são tocados. Os pedaços só são apagados depois de o clipe estar salvo.
- Testes: unitários (`tests/disk-rec.test.ts`, `part-collector.test.ts`) e e2e (gravar/parar, sair do app, travar e recuperar com `Page.crash`).

**O que o Kenidy precisa testar no iPhone:**

1. Ajustes → ligar "Gravação longa (experimental)". Gravar um take **de mais de 2 min** e parar: "Clipe salvo", toca na Galeria, dura o tempo certo.
2. **Compatibilidade (o ponto de risco):** compartilhar → "Salvar Vídeo" no Rolo, tocar lá, e postar no TikTok/Instagram. O formato é MP4 fragmentado; se algum desses recusar, voltar a desligar a opção e avisar.
3. Gravar e matar o app (arrastar para fechar) no meio; abrir de novo: o trecho deve aparecer na Galeria.
4. Gravar 5+ min: o celular esquenta mais? A prévia continua fluida?

**Limites conhecidos:** clipe recuperado ou salvo ao sair do app fica sem miniatura; o áudio não é declarado se o pre-roll não tinha áudio; calor/bateria em sessões longas ainda não medidos.

## Bloco de robustez da gravação (30/10) — v0.13.3 a v0.13.5, aguardando teste no iPhone

Decisão esclarecida pelo Kenidy: **voz e botão manual evoluem juntos**; o botão é a válvula de escape se a voz falhar, então nada pode perder gravação. Revisão do caminho de gravar/parar/salvar/compartilhar (3 versões, cada uma um commit, `check` + `e2e` verdes). A voz e o microfone não foram tocados.

- **v0.13.3:** se o MP4 com áudio falhar, tenta só com vídeo e avisa ("sem áudio"); se o codificador de vídeo morrer gravando, o trecho já gravado vira clipe (antes sumia); `stopRec` com `try/finally` (um erro não deixa o app preso em "Finalizando"); gravação no IndexedDB com 3 tentativas antes de avisar. Código novo: `core/salvage.ts`, `core/retry.ts` (com testes).
- **v0.13.4:** sair do app gravando (outro app, tela bloqueada, chamada) guarda o trecho na hora (`ui/rec-guard.ts` → `salvageRecording`), e reiniciar a captura no meio da gravação também (`stopAll` em `camera.ts`, uma linha). O e2e ganhou um codificador de vídeo falso que entrega dados (`EMIT`): gravar/parar, sair do app e falha do codificador agora rodam com MP4 e IndexedDB de verdade (conferido: sem a proteção o teste falha).
- **v0.13.5:** se a folha de compartilhar do iOS falhar, o clipe é baixado como arquivo e o app avisa; fechar a folha sem escolher não faz nada.

**O que o Kenidy precisa testar no iPhone:**

1. Gravar e parar pelo botão: "Clipe salvo", aparece na Galeria e toca com áudio.
2. Gravando, ir para outro app e voltar: o trecho gravado está na Galeria ("Gravação interrompida. O trecho gravado foi salvo.") e a câmera pede o toque normal para retomar.
3. **Puxar a Central de Controle ou receber uma notificação gravando: NÃO deve cortar.** Se cortar, o gatilho (`visibilitychange`/`pagehide` em `rec-guard.ts`) é mais sensível no iOS do que o esperado: reverter só a v0.13.4.
4. Compartilhar um clipe: a folha abre, "Salvar Vídeo" leva ao Rolo da Câmera; fechar a folha sem escolher não gera aviso.

**Limites conhecidos (ideias para a próxima onda):** a gravação ainda vive só na memória até parar (se o iOS encerrar a página sem nenhum aviso, o trecho se perde); clipe salvo ao sair do app fica sem miniatura (mostra o ícone padrão); o plano B "sem áudio" só foi testado em teste unitário, não no iPhone.

## Fim do bloco (30/10) — v0.13.2 validada

- v0.13.2 validada pelo Kenidy; `estavel` = v0.13.2. Bloco encerrado: voz ao voltar da Galeria/segundo plano, clipe mudo por padrão, aviso falso, miniaturas.
- **Decisão de produto:** a base do app é a **pré-gravação (buffer) + botão vermelho manual**; o comando de voz é **bônus**. Falha da voz nunca pode atrapalhar o botão. Próximo bloco: revisar o caminho manual (buffer, gravar, parar, salvar/compartilhar) como prioridade. (Esclarecimento do Kenidy: não é abandonar a voz; os dois evoluem juntos e o botão é a válvula de escape. Feito na v0.13.3 a v0.13.5, acima.)
- Kenidy vai mandar o link a amigos para testar. Pedir a eles: instalar na Tela de Início, copiar o Diagnóstico ("i") logo após um problema, salvar clipes importantes no Rolo da Câmera. Qualquer push na `main` chega a todos (banner "Nova versão"): só publicar com `check` + `e2e` verdes.
- Pendências abertas: prévia encolhida por <1 s ao voltar do app (adiado), microfone mudo depois de ligar o som (só vale se o som for ligado de propósito).

## v0.13.2 — miniaturas da Galeria com tamanho fixo

- v0.13.1 validada (aviso falso sumiu); `estavel` avançou para ela.
- Relato (23 clipes): miniaturas se sobrepunham e a última ficava comprida. Causa provável: no iOS as linhas `auto` da grade encolhem com `aspect-ratio` nos itens.
- Correção só de CSS (`.grid .tile`): altura por `padding-bottom: 133.33%` + `grid-auto-rows: max-content`. Sem tocar na voz. No Chromium, 23 miniaturas dão 126×168 sem sobreposição.
- **Testar:** Galeria com muitos clipes: todas iguais (3:4), sem sobrepor, rolagem normal; seleção, toque longo e arrastar continuam.

## v0.13.1 — aviso de toque falso retirado sozinho

- v0.13.0 validada pelo Kenidy no iPhone (clipe mudo, voz segue ao voltar); branch `estavel` avançou para ela.
- Relato: às vezes, ao voltar do clipe, aparece "Toque na tela…" mas a voz já funciona. Causa provável: o aviso de surdez (`voice.ts`, som alto sem fala ouvida) dispara logo após um religamento do iOS e **nunca era retirado** fora de um toque.
- Correção mínima: `retractDeafHint` retira o aviso (e volta o ícone a verde) assim que o reconhecedor vê fala (`speechstart` ou texto). Nada mais foi alterado na voz.
- **Testar:** voltar de um clipe várias vezes; se o aviso aparecer, falar algo: ele deve sumir sozinho. Se aparecer e não sumir, copiar o Diagnóstico (linha "Voz").

## v0.13.0 — clipe abre mudo; som liga só por escolha

- O player abre o clipe **mudo**, sem trocar o modo de áudio e sem desligar a câmera estacionada (voltar instantâneo, voz segue).
- Ao ligar o som no controle do vídeo: a captura (câmera e voz) é desligada, o áudio vai para `playback`, e o vídeo é pausado/retomado após 0,5 s para o iOS liberar o som.
- Depois de usar som, voltar à câmera **não reabre sozinho**: mostra "Ligar câmera" (`backToCamera`); o toque refaz o fluxo normal.
- Voltar atrás: `git revert` do commit da v0.13.0 (o branch `estavel` segue na v0.12.14).
- **Testar no iPhone:** (1) abrir clipe na Galeria e voltar: voz continua sem toque; (2) o controle do vídeo mostra o alto-falante e o som liga; (3) com som: ao voltar aparece "Ligar câmera"; o toque religa a voz?; (4) se o alto-falante não aparecer ou o som não sair, avisar (plano B: botão próprio "Ativar som").

## Ponto de retorno e prévia encolhida (sem mudança de código)

- Kenidy validou a v0.12.14: voltar do segundo plano mostra o botão, um toque e câmera + voz funcionam.
- Criado o branch `estavel` (= v0.12.14). Regras de proteção em `CLAUDE.md` ("Proteção contra regressão").
- Aberto: às vezes, ao minimizar e voltar, a prévia aparece menor que a tela (faixas pretas; print de 30/10). Não mexer na voz para isso.
  Próximo passo: na próxima ocorrência, abrir o "i" e copiar o Diagnóstico (linha "Prévia da câmera" diz se o elemento está pequeno ou só a imagem).
  Se for só a imagem, refazer a prévia mais uma vez depois da janela assentar (~1 s), isolado numa versão própria.
- **Adiado por decisão do Kenidy (30/10):** a encolhida dura menos de 1 s e volta sozinha ao abrir o app; não dá para copiar o Diagnóstico a tempo.
  Diagnóstico copiado depois mostra a prévia correta (393x852 em 0,0), então é só o desenho do iOS. Não mexer agora; retomar só se ficar frequente.
- Teste pesado (minimizar e abrir várias vezes seguidas): o iOS pediu permissão e toque de novo. É o comportamento previsto (`pauseUntilTap`), não é bug.

## LEIA PRIMEIRO — resumo da sessão de 30/10 (v0.8.1 → v0.12.6)

As seções abaixo estão em ordem mista: v0.9.x/0.8.x no topo; **v0.9.9 → v0.12.6 ficam no FIM do arquivo**.

**Estado atual (v0.12.6):** quase tudo estável e aprovado pelo Kenidy: redesign, transições, seleção em lote com arrasto e toque longo, miniaturas guardadas na gravação, gestos de borda (voltar/avançar), player fecha arrastando para baixo, 4K seguro (30 fps, recuperação do encoder), "clip" solto liga e desliga por voz, barra do topo mais baixa, bipe com volume fixo bom.

**Problemas abertos (por prioridade):**

1. **Microfone da câmera nasce mudo (pico 0.0000) com frequência ao abrir a câmera** (e ao voltar da Galeria depois de ver um clipe). O app o reinicia sozinho após ~3 s (`camera.ts`, "microfone mudo … reabrindo"), mas a voz fica esperando um toque na tela. **Causa raiz desconhecida.** Já descartado: `setAudioSession('play-and-record')`, recarregar a página ao fechar o player (não evita e pisca), `AudioContext` 'playback'. Próximos experimentos propostos: (a) câmera primeiro e voz logo depois no mesmo toque (hoje a voz abre o microfone antes); (b) pedir o ultra-angular já no 1º `getUserMedia` para evitar o reinício por troca de lente ("start #2"); (c) reutilizar a faixa de áudio viva nos reinícios só de vídeo. Um por vez, comparando o Diagnóstico.
2. **Bipe do alto-falante chia ao vivo** (o vídeo gravado sai limpo). Com o comando de voz **desligado** o chiado some → o reconhecimento de voz aberto interfere. `pauseVoiceFor` (voz pausa no bipe) existe desde a v0.10.6, o bipe toca 200 ms depois (`BEEP_LEAD_SEC`); o chiado **continuou**. Ideias: pausar a voz por mais tempo antes do bipe, ou trocar o bipe do alto-falante por vibração/aviso visual.
3. **Voz ainda um pouco surda** (precisa falar alto): o iOS reconhece pouco; já afrouxamos as variações aceitas (v0.12.0). O iOS ignora `autoGainControl`.
4. Volume do clipe na Galeria baixo (sessão de áudio do iOS); contorno possível: compartilhar/salvar no Rolo da Câmera.

**Como o Kenidy trabalha:** testa no iPhone e cola o **Diagnóstico** (botão "i" → Copiar, de preferência pela tela da câmera) e prints. Prefere explicações curtas em português, "você", tabelas curtas. Fluxo: `npm run check` + `npm run e2e` verdes → push direto na `main` → avisar versão e o que testar.

## v0.9.8 — chiado do bipe de parar, microfone após a Galeria, faixas ao voltar do app

Relato (v0.9.7): volume do bipe bom; o **2º bipe (parar)** chia/estoura; **Câmera → Galeria → Câmera**: sem permissão nova, mas **microfone morto** (sem voz e sem áudio no clipe); às vezes **faixas pretas** voltam ao minimizar/trocar de tela (somem ao virar a câmera).

- **Chiado:** hipótese principal = ao parar, o app monta o MP4 (trabalho pesado na thread principal) justo quando o 2º bipe toca. Agora `stopRec` espera o bipe terminar (+120 ms) antes de drenar e montar. Bipes Alto/Máximo usam bordas lineares a partir de zero (a subida exponencial de 0,0001 estalava); Normal continua o original. Saturação do Máximo reduzida (drive 2,2 → 1,8).
- **Microfone morto:** hipótese principal = tocar um clipe com som na Galeria deixa a sessão de áudio do iOS em reprodução e o microfone volta mudo. Mudanças: `navigator.audioSession.type` ('play-and-record' ao abrir a câmera, 'playback' no player, 'auto' ao fechá-lo — `media/audio-session.ts`) e o `AudioContext` agora é **fechado** (não só suspenso) ao sair da câmera; um novo nasce no toque que abre a câmera. Novo registro em "Câmera: início": `áudio após 3 s: contexto…, faixa…, N blocos, pico…` (se o microfone morrer de novo, essa linha mostra onde).
- **Faixas pretas:** o retorno do segundo plano "sem refazer a captura" (v0.8.4) mantinha o `<video>` velho. Agora recria o elemento, religa o mesmo stream (sem novo pedido de permissão) e reinicia o laço de captura (`refreshPreview`). Registro "prévia refeita (voltou do segundo plano)".
- Testar: gravar com o bipe de parar nos 3 volumes; Câmera → Galeria → abrir um clipe com som → voltar → voz e áudio funcionam?; minimizar e voltar várias vezes (faixas?). Se algo falhar, "Copiar" o Diagnóstico **pela tela da câmera**.

## v0.9.7 — Diagnóstico mais claro + resultado do teste 1080p/60/Alta (a v0.9.6 saiu só com a documentação por engano)

- Dados do Kenidy (v0.9.5, 1080p · 60 fps · Alta): câmera entregou **1080x1920 @ 60 fps** (track), 2619 quadros de entrada / 2618 de saída, **0 descartados**; último clipe 65,3 MB em 16,4 s ≈ **33,4 Mbps** (pedido 36 Mbps) → qualidade e 60 fps aplicados de verdade, pipeline aguenta 60 fps em 1080p. Clipe de 1 min nessa combinação ≈ 250 MB.
- O relatório foi copiado com a câmera desligada (Início), por isso "Processamento do mic" e a prévia vieram vazios. Agora o Resumo avisa ("Dica") e o rótulo da voz distingue "parada (fora da câmera)" de "desativada nos Ajustes".
- "Cargas da página" mostrou `reload` em 00:37 e 00:46: foram as atualizações de versão (botão Atualizar), não recarga espontânea. Permissões aparecem como `prompt` mesmo concedidas (o iOS não informa o estado em app instalado).
- Pendente: confirmar o volume do bipe (v0.9.5) e ver "Processamento do mic" com a câmera ligada.

## v0.9.5 — volume do bipe de verdade

- Relato (v0.9.4): "Gravar bipe no vídeo" funciona. Na tela de gravação o bipe do alto-falante está muito baixo, até no Máximo, e os 3 volumes soam iguais.
- Causa provável: o bipe original sobe e **decai** rápido (pouca energia) e o iOS limita a saída com o microfone ligado; aumentar só o pico (0,3→0,8) mal muda o que se ouve.
- Agora (`core/beep-wave.ts` PROFILE, `media/beep.ts`): **Normal** = bipe original (pico 0,3, decai); **Alto** = pico 0,7 mantido em volume cheio até perto do fim; **Máximo** = pico 1,0 mantido + saturação suave (`WaveShaper` tanh, onda mais "cheia"). Mesmos tons (880 Hz / 660 Hz×2).
- Se ainda estiver baixo no Máximo: provavelmente o iOS está usando o processamento de voz/saída de chamada. Conferir no Diagnóstico "Processamento do mic" (eco sim?) e, se for isso, tentar manter o cancelamento de eco desligado (nível 1 do áudio) ou `navigator.audioSession`.

## v0.9.4 — "Gravar bipe no vídeo" em destaque

- Relato (v0.9.3): bipe original OK. O Kenidy queria um interruptor para o bipe **sair também na gravação**; ele só via "Sons de gravação" (que apenas liga/desliga o som no alto-falante). O interruptor já existia ("Bipe no vídeo", v0.9.0), mas ficava abaixo do volume, sem explicação.
- Agora: ordem Sons de gravação → **Gravar bipe no vídeo** (com a frase "O bipe também sai no clipe salvo") → Volume do bipe. Teste unitário novo da mistura (`tests/beep-mix.test.ts`).
- Testar: ligar "Gravar bipe no vídeo", gravar um clipe, salvar/assistir e ouvir o bipe no início e no fim (funciona mesmo com o iPhone no silencioso). Com "Sons de gravação" desligado e este ligado, o bipe sai só no vídeo.

## v0.9.3 — bipe: gerador original de volta

- Relato (v0.9.2): bipe ainda agudo ao filmar e **a amostra dos Ajustes nem tocava mais**. Eu tinha trocado o gerador (osciladores → `AudioBuffer` com silêncio inicial e atraso) e isso piorou; as "melhorias" da v0.9.1/0.9.2 no som do alto-falante foram **revertidas**.
- Agora: osciladores e envelope exponencial idênticos aos da v0.8 (880 Hz início, 660 Hz ×2 fim); só o pico muda por volume: Normal 0,3 (= antigo) · **Alto 0,5 (padrão)** · Máximo 0,8. A amostra dos Ajustes toca logo após o `resume()` (como na v0.9.1).
- Mantido: rampa suave do microfone ao entrar/sair do silêncio (evita estalo no **áudio do clipe**) e o bipe digital no clipe (`beepInClip`, usa `renderBeep`).
- Hipótese descartada/não confirmada: o iOS pode mudar a taxa de amostragem do áudio quando o microfone liga (tom deslocado). Se o bipe ainda soar mais agudo que na v0.8, comparar `Contexto de áudio`/"Processamento do mic" no Diagnóstico.

## v0.9.2 — estalos do bipe e prova das qualidades

- Relato (v0.9.1): bipe ainda "ruim" (possivelmente ainda na v0.9.0: conferir o rodapé do Início), **estoura** ao tocar a amostra nos Ajustes e às vezes na gravação, mesmo o bipe antigo.
- Hipóteses e mudanças: (1) o áudio do iPhone estala ao sair do repouso → 60 ms de silêncio antes do bipe, e a amostra dos Ajustes espera 150 ms após acordar o áudio; (2) início/fim bruscos → rampas de 12 ms/40 ms; (3) **corte seco do microfone** durante o bipe causava estalo no áudio do clipe → rampa de 256 amostras ao entrar e sair do silêncio (`audio.ts`).
- Diagnóstico novo: "Processamento do mic" (eco/ruído/ganho; se o iOS ligou o cancelamento de eco, ele pode deformar o bipe) e "Último clipe" (MB, s e Mbps reais, para conferir Padrão/Alta/Máxima).
- Pendente: se ainda estourar, ver em qual momento (amostra nos Ajustes, bipe durante a gravação, ou áudio do clipe salvo) e o "Processamento do mic".

## v0.9.1 — bipe original e Diagnóstico reorganizado

- Feedback: o bipe de 2 kHz ficou "péssimo, muito agudo". **Voltou ao original** (880 Hz no início, 660 Hz duas vezes no fim, seno puro). Mantidos "Volume do bipe" (Normal = volume antigo 0,3 · **Alto = 0,6, padrão** · Máximo = 1,0) e "Bipe no vídeo".
- **Diagnóstico** agora é uma tela própria (Ajustes → Diagnóstico), em seções: _Atenção_ (só aparece se houver problema), Resumo, Vídeo, Áudio, Comando de voz, Tela, Permissões e ciclo de vida, Câmera: início, Lentes, Navegador. Cada seção traz rótulo/valor, só os últimos registros, atualiza sozinha a cada ~1 s. Botão **Copiar** (texto completo, para colar no chat). Código: `ui/diagnostics.ts` (dados), `ui/diag-view.ts` (tela).
- Testar: bipe nos 3 volumes; abrir o Diagnóstico e mandar prints (ou "Copiar" e colar).

## v0.9.0 — transições, bipe configurável e mais opções de vídeo

Feedback do Kenidy sobre a v0.8.4: troca de lente com tela cheia OK, menos pedidos de permissão ao minimizar, arrastar na Galeria OK.

- **Transições:** Início → Câmera/Galeria desliza e some com fade; voltar ao Início faz o inverso; Câmera ↔ Galeria só fade. Ajustes sobem/descem como folha; player aparece com leve zoom. Respeita "Reduzir movimento" do iPhone (`src/ui/transitions.ts`, CSS no fim de `styles.css`).
- **Bipe:** "Sons de gravação" (toca no alto-falante), **"Volume do bipe"** (Normal/Alto/Máximo, padrão Alto; tom mais agudo, 1,5–2 kHz — **revertido na v0.9.1**, ver abaixo) e **"Bipe no vídeo"** (liga = o bipe é somado digitalmente ao áudio do clipe, início e fim; desligado = comportamento anterior, bipe fora do clipe). Ao ligar o bipe no vídeo, o corte espera o bipe de fim terminar (~0,4 s). Mudar o volume toca uma amostra. O volume fica desligado se os sons estiverem desligados.
- **Vídeo:** "Resolução" 720p/1080p/**4K**, "Fluidez" 30/**60 fps** e "Qualidade" Padrão/Alta/Máxima (taxa de bits; teto 60 Mbps; 60 fps usa ×1,5). Padrão continua 1080p/30/16 Mbps. Perfil H.264 sobe de nível sozinho (4.2 → 5.1 em 4K30 → 5.2 em 4K60). Duração máxima do clipe cai com a taxa para não estourar a memória (`maxRecSec`, 90 s → ~34 s em 4K a 60 Mbps).
- **Risco a verificar no iPhone (experimental):** 4K e 60 fps passam por `drawImage` em canvas e usam muita memória; o iOS pode entregar menos que o pedido (o Diagnóstico mostra "Vídeo … (pedido …)" e "Fonte … track WxH@fps") ou o encoder pode recusar (aparece erro de H.264). Se a página recarregar, ver a linha "Cargas da página".
- Correção: no modo deitado a coluna de controles tampava o botão de Ajustes (agora só os botões recebem toque).
- Testar: (1) transições sem engasgo; (2) bipe: volume nos 3 níveis, ouvir em ambiente barulhento, e com "Bipe no vídeo" ligado conferir se o bipe aparece no clipe salvo (início e fim); (3) 1080p/60, depois 4K/30, depois 4K/60: imagem, fps real, memória (o app recarrega?), tamanho do clipe.

## v0.8.4 — prévia recriada, voltar do app sem novo pedido, seleção por arrasto

- Logs do Kenidy (v0.8.3): a página **não recarregou** (relógio do Diagnóstico contínuo entre prints). O pedido de permissão vem de uma **nova captura** (`getUserMedia`) dentro da mesma página: o iOS só dispensa o pedido enquanto ainda há uma captura ativa. Antes, `visibilitychange` refazia a captura sempre que ficava >1,5 s fora.
- Mudança: ao voltar do app, se as faixas continuam `live` (iOS só silenciou), apenas `play()` + wake lock + áudio; refaz a captura só se as faixas acabaram ou se nenhum quadro novo chegar em 2,5 s. Linha nova no log "Câmera (início)": "voltou (Ns fora); faixas v:live/mudo a:live". **Sair da câmera (voltar ao Início) continua desligando tudo e voltar a abrir pede permissão** (limitação do iOS; só some com "Ajustes do Site" no Safari).
- Faixas na troca de lente (3ª tentativa): o `<video>` é **recriado** a cada captura (`renewPreview` em `dom.ts`; `els.video` agora é getter). Hipótese: o iOS não refaz a camada do vídeo no mesmo elemento. Ainda sem confirmação.
- Galeria: "Selecionar" mais visível; **seleção por arrasto** (horizontal marca/desmarca; vertical rola; borda do topo/rodapé rola sozinha).
- Texto/ícones "embaçados" perto do notch (Galeria): não há blur no CSS ali. Hipótese: efeito de borda do próprio iOS (blur sob a barra de status) que atinge o topo de elementos `position: fixed`. Se persistir, testar `.app` sem `position: fixed`.
- Testar: trocar de lente várias vezes (faixas?); minimizar e voltar (pede permissão?); arrastar na Galeria.

## v0.8.3 — ações em lote, diagnóstico de recarga

- Pedido do Kenidy: selecionar vários clipes na Galeria para excluir ou compartilhar/baixar de uma vez. Feito: "Selecionar" no topo da Galeria, marca com toque, "Todos/Nenhum", barra inferior com Compartilhar (folha de compartilhar com vários arquivos; sem suporte, baixa um a um) e Excluir (confirmação). Sai do modo ao sair da Galeria.
- Relato (v0.8.2): faixas na troca de lente **continuam** (o ajuste de tamanho da prévia não resolveu). Falta dado: print do Diagnóstico logo após a troca (linha "Tela": janela, preview, fonte/caixa).
- Relato: o iPhone pede câmera/microfone de novo ao minimizar ou após alguns minutos aberto. Hipóteses: (a) a página recarrega (iOS descarta o app em segundo plano ou encerra por memória); (b) o reconhecimento de voz pede "Microfone" a cada religamento; (c) `start()` ao voltar do app refaz a captura. Não confirmado. Novo no Diagnóstico: "Cargas da página" (hora e tipo: navigate/reload/back_forward), "Permissões" (estado de câmera/microfone) e "Ciclo" (saiu/voltou do app, tempo fora).
- Testar: usar o app, minimizar, voltar, e abrir Ajustes → Diagnóstico. Se "Cargas da página" ganhou uma linha nova, o app recarregou (volta ao Início); se não, foi nova captura/voz dentro da mesma página.

## v0.8.2 — faixas ao trocar de lente

- Relato do Kenidy (v0.8.1): a janela já ocupa a tela, mas **ao trocar de lente** o vídeo da prévia fica menor, com faixas pretas em volta (retângulo ~9:16 no centro).
- Hipótese: o iOS não refaz a camada do `<video>` ao trocar o stream. `fitPreview` (`src/ui/viewport.ts`) fixa o tamanho em px, refaz a composição e repete em `loadedmetadata`/`resize`/`playing`/`emptied` e com atrasos. Diagnóstico "Tela" mostra fonte/caixa da prévia.
- Testar: trocar 0,5 ↔ 1× várias vezes e virar a câmera; se persistir, print do Diagnóstico (linha "Tela").

## Feito

- Protótipo `v0.3.7` validado pelo Kenidy no iPhone: vídeo vertical 1080p, áudio nos clipes (também no player do app),
  pre-roll desde o 1º segundo, sons de início/fim, offline, aviso de atualização, abertura já pedindo câmera/mic.
- Onda 1 (`v0.4.0`, aprovada): TypeScript + Vite em módulos, nome "Ei Clip", testes, e2e, ESLint/Prettier, CI e deploy.
- Onda 2, pesquisa do nome: nenhum app/marca "Ei Clip" encontrado nas buscas (a base do INPI não foi consultada; só importa se
  um dia for publicar/comercializar). Nome mantido.
- Onda 2, viabilidade (`v0.4.1`, página `/voz-teste/`): Web Speech API pt-BR testada no iPhone (Safari) com câmera+microfone
  abertos. Música alta: 7/7 falas reconhecidas. **Modo avião, 3 min: ~13 falas, 0 erros, 0 reinícios, tudo reconhecido**
  (funciona offline). Latência do texto parcial ~0,4–0,9 s. Variações devolvidas: "Ei clipe", "Oi clipe", "Hey clipe", "Ec clipe".
  Falso reconhecimento visto: "Ei Felipe" (não dispara, pois exigimos saudação + "clip").
- Onda 2, integração (`v0.5.0`, branch `onda-2`): `src/core/wake-word.ts` (reconhecimento + `WakeGate`, 21 testes),
  `src/media/voice.ts` (escuta contínua, religa sozinha, para com a câmera), botão 🎙️ ao lado do som (apagado = desligado,
  borda verde = escutando, pulso verde = comando reconhecido; escolha guardada). **"Ei Clip" alterna a gravação:** inicia
  (com o pre-roll) e, dito de novo, para e salva. Cenário de voz no e2e (reconhecedor falso).

## Teste da v0.5.0 e correção (v0.5.1)

Kenidy testou a `v0.5.0`: depois de dar permissão o ícone ficava verde, mas "Ei Clip" não funcionava; só depois de desligar e
ligar o 🎙️ passou a funcionar (gravou e parou por voz). Ao recarregar o app, voltou a não funcionar de primeira.
Causa provável (a confirmar no iPhone): escuta iniciada sem toque do usuário fica muda no iOS sem dar erro, e o ícone
verde era mostrado cedo demais. Na `v0.5.1`: ícone âmbar enquanto liga e verde só com áudio da escuta aberto (`onaudiostart`);
o primeiro toque na tela reinicia a escuta dentro do gesto; tocar no 🎙️ âmbar reinicia em vez de desligar; painel "i" mostra
a linha "Voz" com os últimos eventos (start, audiostart, texto, end, erros).

## Teste da v0.5.1 e ajustes (v0.5.2)

A voz passou a funcionar logo depois do toque (confirmado pelo Kenidy). Dois pontos novos:

1. **Primeira abertura: câmera/mic não iniciam depois do "Permitir"** (botão azul "Iniciar câmera" continua; ao tocar nele pede
   permissão de novo e aí funciona). Causa **não confirmada**. Na `v0.5.2`: `start()` isolado do reconhecedor de voz (um erro da
   voz não impede mais a câmera), chamada mais recente de `start()` vence se houver duas sobrepostas, e o painel "i" ganhou a
   seção "Câmera (início)" com cada etapa (pedindo permissão, stream ok/erro, track ended/mute, rodando). Se acontecer de
   novo: abrir o "i" logo após o "Permitir" e mandar um print, junto com qualquer mensagem que apareça na tela.
2. **Atraso do comando:** o app reage em poucos ms; o tempo está no reconhecedor do iOS (texto parcial ~0,4–0,9 s depois do
   início da fala). `v0.5.2` aceita "Ei cli" (começo da frase, ~0,3 s mais cedo) **só para começar a gravar**; parar continua
   exigindo "Ei clipe" completo. O painel "i" (linha "Voz") mostra "comando N ms após a 1ª palavra" para medir.
   O pre-roll de 15–30 s já inclui o que veio antes do comando; o fim do clipe inclui a fala do comando (aparar é ideia futura).

## Causa achada e correção (v0.5.3)

O painel "i" da `v0.5.2` mostrou a causa do "preciso tocar de novo no botão azul": após `stream ok` a câmera (`video: mute`) e o
microfone (`audio: mute`) ficaram **mudos** e nunca voltaram; `start()` esperava um `play()` que não conclui com a câmera muda,
então não chegava a "rodando" e a tela ficava em "Iniciar câmera". Correção: `start()` não bloqueia mais no `play()` (máx. 1,5 s);
espera até 2 s a faixa de vídeo liberar (`unmute`); se não liberar, refaz a captura **uma vez** automaticamente (o que o toque
no botão azul fazia) e segue mesmo assim; ao liberar, o vídeo volta a tocar sozinho. Dois cenários novos no e2e simulam isso.
Se a permissão ainda for pedida duas vezes (o refazer chama a câmera de novo), é o bug do WebKit no app instalado.

## v0.5.3 insuficiente → recuperação automática (v0.5.4)

Teste da `v0.5.3` (print do "i"): `stream ok` aos 3,5 s, `video/audio: mute` aos 3,7 s (depois da checagem de mudo do
`start()`), `rodando` aos 5,0 s, mas **0 quadros de vídeo** (690 blocos de áudio chegando) e sem botão azul para refazer: ficou
travado. Causa raiz do mudo **ainda desconhecida**; hipóteses: outra aba/instância do site (ex.: `/voz-teste/` aberta, app
instalado + aba do Safari) segurando a câmera; permissão recém-dada sem gesto do usuário. Na `v0.5.4`: **watchdog** — se nenhum
quadro chegar em 3,5 s depois de "rodando", refaz a captura até 2 vezes sozinho e depois avisa "A câmera não enviou imagem.
Toque na tela para reiniciar."; **qualquer toque na tela reinicia a câmera quando não há imagem** (`tapRecover`). O "i" registra
cada tentativa na seção "Câmera (início)". Se continuar: pedir ao Kenidy para fechar todas as outras abas/apps do Ei Clip antes
de testar e mandar o print do "i" de novo.

## Três pedidos de permissão e voz muda (v0.5.5)

Relato do Kenidy (Safari e app instalado): pede (1) Câmera e Microfone, (2) Microfone, (3) Câmera e Microfone de novo; a câmera
grava mas o comando de voz não funciona. Leitura: o pedido (2) é da voz, que ligava junto com a câmera e disputava com a abertura
(a câmera ficava muda, sem quadros); o watchdog da `v0.5.4` então refazia a captura (`stopAll` para as faixas e o iOS pede
permissão de novo = pedido 3) e a voz (abortada no meio do pedido) ficava muda. Na `v0.5.5`: **a voz só liga depois do primeiro
quadro de vídeo** (câmera viva); a recuperação tenta primeiro um **reinício leve** (religa o `<video>` à mesma captura, sem
permissão) e só depois refaz a captura. Esperado: no máx. 2 pedidos (câmera+mic, depois mic da voz). Hipótese não confirmada.

## Dois pedidos iguais (v0.5.6)

Teste da `v0.5.5`: só 2 pedidos, **os dois de Câmera e Microfone**; após o 1º "Permitir" a tela fica preta ~2–3 s, vem o 2º pedido,
e depois tudo funciona (imagem, gravação e voz). Leitura: a 1ª captura chega **muda** (sem imagem); `start()` espera 2 s ela liberar
e, não liberando, refaz a captura sozinho; o `stopAll` parava as faixas antes de pedir a nova, e o iOS pede permissão de novo quando
nenhuma captura está ativa (= 2º pedido). Na `v0.5.6`: em nova tentativa a captura antiga **continua aberta até a nova chegar**
(`stopAll(keepTracks)` + `stopTracks(previous)`), para o iOS não pedir de novo. Hipótese (WebKit costuma não repetir o pedido
com captura ativa), **não confirmada no iPhone**. Se ainda pedir 2x: o único jeito de evitar a captura muda inicial seria descobrir
por que ela vem muda (ideia: esperar mais que 2 s o `unmute`; ver o "i": linhas mute/unmute com horário).

## Um pedido só; voz surda sem toque (v0.5.7)

Teste da `v0.5.6` (print do "i"): **1 pedido de permissão** (ok), câmera com imagem ("vídeo ok" aos 3,0 s; às vezes ainda tela
preta), mas a voz não funciona: o reconhecedor iniciou sozinho (`start`/`audiostart` aos 0,3 s) e **não recebeu nenhum texto** até
um toque na tela (`reiniciando por toque`). Mesmo comportamento da `v0.5.0`: **no iOS a escuta iniciada sem toque fica surda, sem
erro**. Na `v0.5.7` a escuta **não começa sozinha**: fica aguardando o primeiro toque na tela (ícone âmbar, aviso "Toque na tela
uma vez para ativar o áudio e o comando de voz.") e liga dentro do toque, quando então fica verde. O toque já era necessário para
o áudio da gravação (AudioContext), então é um toque só para tudo. Religamentos automáticos (`onend`) continuam sem toque. Se a
voz ainda não responder depois do toque: print do "i" (linha "Voz": deve aparecer "texto ..." quando falar) e dizer se o ícone
estava verde.

## Tela inicial com botão "Iniciar" (v0.6.0)

Pedido do Kenidy: mais prático e simples. A `v0.5.7` funcionava "um pouco bugada" (voz depende de um toque que o app não explicava;
câmera às vezes preta). **Aposta:** vários problemas vêm de ligar tudo sem gesto do usuário (câmera muda, AudioContext suspenso,
voz surda). Agora o app **não abre a câmera sozinho**: mostra uma tela inicial ("Ei Clip", "Iniciar") e um único toque liga
**câmera, áudio e escuta de voz juntos, dentro do gesto**. Mudanças: `S.introDone` + `#intro`/`#btnIntro`; o toque chama `start()` e
`startVoice(true)` na mesma hora (não espera a câmera); `stopAll(keepTracks, keepVoice)`: reiniciar só a câmera (trocar câmera/
qualidade, recuperação) **não derruba a escuta**; `startVoice()` não mexe numa escuta já viva; o botão "Iniciar câmera" (depois de
assistir um clipe) também religa a voz no seu toque. Sem a abertura automática, o fluxo da `v0.5.x` (voz aguardando toque) só
aparece em religamentos sem toque (voltar de segundo plano). **Não confirmado no iPhone:** se o iOS aceita a escuta de voz
iniciada junto do pedido de permissão da câmera (pode virar 2 pedidos em sequência, ou conflito). Se der conflito: iniciar a voz
logo que a câmera entregar o primeiro quadro, ainda no mesmo gesto, ou voltar ao toque pós-permissão.

## Teste da v0.8.0 e correções (v0.8.1)

Kenidy testou a `v0.8.0` no iPhone (app instalado): interface aprovada ("já tem cara de app profissional"), **comando de voz e
gravação funcionaram**. Problemas relatados (com print):

1. **Faixa preta fixa embaixo** (~58 px) e, às vezes, **faixas pretas em volta da imagem ao sair e voltar do app**. No print, a
   caixa do app termina 59 px acima do fim da tela (= a altura do notch): o iOS informa uma janela menor que a tela em modo
   instalado. Na `v0.8.1` (`src/ui/viewport.ts`): o tamanho do app vem das variáveis `--app-w/--app-h`, recalculadas na abertura,
   ao girar, ao voltar do segundo plano e com atrasos de 250/900 ms; em modo instalado usa a tela inteira quando a janela é até
   100 px menor; se ainda houver diferença aos 900 ms, "cutuca" o viewport (`viewport-fit` sai e volta, no máx. 2×). **Hipótese não
   confirmada**: se o WebKit recorta o que passa da janela, só o "cutucão" resolve. O Diagnóstico ganhou a linha **"Tela"**
   (janela, screen, visual, margens, tamanho do app e do preview, e os ajustes feitos). Se a faixa continuar: Ajustes → Diagnóstico → print.
2. **Topo colado no notch e indicador "cortado":** margem do topo da câmera de 8 → 22 px acima das margens seguras; o indicador de
   buffer perdeu o preenchimento parcial (parecia cortado) e agora tem uma linha fina de progresso; desfoque menor.
3. **"Microfone indisponível (OverconstrainedError: Invalid constraint)"** ao voltar para o app (câmera abriu sem microfone). Causa
   provável: o iOS recusa as restrições de áudio (sem processamento, estéreo). Agora o áudio é pedido em 3 níveis (estrito →
   sem `channelCount` → padrão do iOS), só descendo quando o erro é de restrição; a escolha aparece em "Câmera (início)" no Diagnóstico.
   Se cair no nível padrão, o iOS aplica cancelamento de eco/ruído e o som do clipe pode ficar mais "tratado".

### O que o Kenidy precisa testar no iPhone (`v0.8.1`)

0. Abrir o app instalado: **sumiu a faixa preta de baixo**? A câmera ocupa a tela toda, em pé e deitado?
1. Sair do app (Início do iPhone, outro app) e voltar várias vezes: aparecem faixas em volta? (print do Diagnóstico se aparecer)
2. O topo está confortável (afastado do notch)? O indicador `10/15 s` ficou limpo?
3. Voltar ao app e olhar o microfone: ainda aparece o erro de microfone? Se aparecer, print do Diagnóstico (seção "Câmera (início)").

## Onda 3a: três telas e visual novo (v0.8.0)

Pedido do Kenidy: câmera em tela cheia como o app Câmera do iPhone (galeria à esquerda embaixo, troca de lente, ajustes),
essenciais à vista, o resto escondido; interface, cores e ícones padronizados, discretos e minimalistas. Feito:

- **Três telas sem rolagem** (`S.view`: `home` | `camera` | `gallery`), em `index.html`/`src/ui/`:
  - **Início:** "Abrir câmera" (é o gesto que liga voz+câmera+áudio), 4 clipes recentes, "Ver todos", engrenagem de Ajustes, versão.
  - **Câmera:** imagem em tela cheia (`object-fit: cover`); topo: voltar, indicador de buffer/gravação (`12/15 s`, `● 0:23` em vermelho),
    microfone da voz (cinza = desligado, laranja = ligando, verde = escutando) e Ajustes; embaixo: miniatura do último clipe (abre a
    Galeria), botão de gravar (anel branco, centro vermelho; vira quadrado ao gravar), trocar câmera, seletor de lente `0,5 | 1×`.
    **Deitado:** os controles vão para a lateral direita (CSS `orientation`), o vídeo gravado não gira por causa disso.
  - **Galeria:** grade de miniaturas (primeiro quadro do vídeo, duração, ícone laranja se sem áudio); toque abre o player
    (Salvar/Compartilhar, Excluir). Só a grade rola; a página não.
  - **Ajustes** (folha por cima, aberta do Início e da Câmera): qualidade 1080p/720p, tempo antes do toque 15/30 s, comando de voz,
    sons, armazenamento e Diagnóstico (o "i" antigo). Qualidade e buffer agora **ficam salvos** (`src/storage/prefs.ts`).
- **Sair da tela da câmera desliga captura, microfone e voz** (`showScreen` em `src/ui/navigation.ts`; `cancelStart()` cancela uma
  abertura em andamento). Isso resolve o áudio ao assistir clipes (a Galeria nunca tem captura ligada). Não dá para sair gravando
  ("Termine a gravação primeiro").
- **Visual:** tokens em `:root` de `src/styles.css` (preto, cinzas neutros, **amarelo `#ffd60a` só para "ativo/selecionado"**,
  vermelho só para gravar, verde só para escutando); ícones só em `src/ui/icons.ts` (`data-icon`); textos em `src/strings.ts`.
  Removidos da tela: medidor do microfone (a leitura fica no Diagnóstico), tamanhos/Mbps, avisos técnicos.
- **Zoom bloqueado:** `user-scalable=no`, `touch-action: manipulation` e `gesturestart` com `preventDefault`.
- Testes: `format` (novo) e e2e reescrito para as telas, incluindo layout em pé/deitado (sem rolagem, imagem ocupa a tela toda,
  controles dentro da tela) e "sair durante a abertura não deixa a câmera ligada".

**Hipóteses/riscos para confirmar no iPhone (não dá para testar na sandbox):**

1. Voltar ao Início/Galeria e reabrir a câmera **pode pedir permissão de novo** (iOS costuma pedir quando nenhuma captura está ativa).
2. Preview em tela cheia **corta as laterais** (~9% de cada lado numa tela 19,5:9): o arquivo gravado (9:16) tem mais imagem que a tela mostra.
3. Gravar **deitado**: o iOS deve entregar quadro deitado e o encoder reconfigura sozinho (fora da gravação); girar o aparelho
   _durante_ a gravação não é tratado.
4. Miniaturas pelo primeiro quadro do `<video>` (seek em `loadedmetadata`): se vierem pretas no iOS, trocar por imagem gerada em canvas.
5. Pinça/duplo toque sem zoom: o Safari às vezes ignora `user-scalable=no`; confirmar.
6. O ícone do app (tela de início do iPhone) **ainda é o antigo** (Onda 3b).

### O que o Kenidy precisa testar no iPhone (`v0.8.0`)

0. Abrir → **Abrir câmera** → permitir → imagem em tela cheia, "Ei Clip" funciona sem tocar.
1. Seletor **0,5 | 1×** (troca sem novo pedido?), trocar câmera, gravar por botão e por voz (indicador vermelho com o tempo).
2. **Em pé e deitado:** os botões ficam no lugar certo? O clipe gravado deitado sai deitado?
3. Miniatura → **Galeria** → abrir clipe → som normal? Salvar/Compartilhar e Excluir funcionam?
4. **Voltar** e **Abrir câmera** de novo: quantos pedidos de permissão aparecem?
5. **Ajustes** (Início e Câmera): trocar qualidade/buffer, fechar e abrir o app: continuam salvos?
6. Pinça e duplo toque na tela não dão zoom? O que está feio, grande, pequeno ou fora do lugar (print ajuda)?

**Próximo (Onda 3b):** ajustes finos do visual depois do teste, ícone do app/marca/cores, e decidir se o enquadramento do preview
deve mostrar o que é gravado (barras) em vez de cortar. Depois, Onda 4.

## Teste da v0.7.0 (resultado)

Kenidy testou a `v0.7.0` no iPhone: **funcional**. Agora são só **2 pedidos**, e ao aceitar o segundo a câmera já abre e tudo
funciona (voz + gravação). **Troca de lente 1×/0,5× funciona e a gravação na 0,5× também.** Pendência visual: na 0,5× o preview
fica menor, com faixas pretas laterais (tratar na Onda 3). Ainda sem confirmação: áudio dos clipes com a voz ouvindo, teste ao
ar livre/vento, sessão longa.

Kenidy grava em pé (principalmente) e deitado. A Onda 3a (telas) foi feita na `v0.8.0`, acima.

## v0.6.1 com defeito → v0.7.0 (voz primeiro + lente 0,5×)

Teste da `v0.6.1` (relato): **3 pedidos** (câmera+mic → mic → câmera+mic), tela preta entre eles, e só então funcionou. Leitura:
o 2º pedido é o da escuta de voz (Web Speech), que o iOS pede à parte e **não dá para juntar** com o da câmera; ele aparecia
com a câmera ainda abrindo, a faixa ficava muda (tela preta), o vigia refazia a captura e o iOS pedia o 3º. Na `v0.7.0`:

- **Voz primeiro:** no toque em "Iniciar" a escuta liga dentro do gesto (resolve também a escuta surda) e a câmera só abre
  depois que o microfone da voz abrir, for recusado ou passar 20 s (`voiceSettled`). Esperado: **2 pedidos seguidos, sem tela
  preta no meio** (o mínimo possível com Web Speech).
- Todo reinício de câmera (lente, câmera, qualidade, voltar do segundo plano) mantém a captura antiga aberta até a nova chegar,
  para o iOS não pedir permissão de novo; se a antiga travar a nova (`NotReadable/Abort`), fecha e tenta de novo.
- **Lente 0,5×:** botão ao lado do ⇄ (aparece só se o iOS listar uma câmera "ultra" ou aceitar zoom < 1). Escolha fica salva.
  Na 1ª abertura com 0,5× salva, abre a principal (os nomes só vêm depois da permissão) e troca sozinho uma vez.
  Se a ultra não abrir, volta para 1× com aviso. O "i" mostra "Lentes:" (nomes que o iOS informou) e a linha da câmera.
- Hipóteses não confirmadas no iPhone: (a) abrir a câmera com a escuta de voz já ativa pode derrubar a escuta (se acontecer,
  o ícone fica âmbar e um toque a religa); (b) o nome da câmera ultra no iOS ("Back Ultra Wide Camera"/equivalente em português)
  casa com `/ultra/i`; (c) 1080p/16 Mbps na ultra-angular não foi testado.

## O que o Kenidy precisa testar no iPhone (`v0.7.0`)

0. Abrir → **Iniciar** → permitir os 2 pedidos (microfone da voz e câmera+mic) → imagem sem tela preta → "Ei Clip" sem tocar.
1. Botão **1×/0,5×**: aparece? Troca sem novo pedido de permissão? Imagem mais aberta? Gravar um clipe na 0,5×.
2. Se algo falhar: print do "i" (seções "Lentes", "Câmera (início)" e "Voz").

## v0.6.0 com defeitos → v0.6.1

Teste da `v0.6.0` (print + relato): (1) o botão azul de baixo ("Iniciar câmera") ligava a câmera mas **a tela inicial continuava por
cima** ("gravando" sem imagem) — `introDone` só era marcado pelo botão de cima; (2) **2 pedidos de permissão**: a escuta de voz
iniciava junto com `getUserMedia` (concorrência: o iOS pediu o microfone da voz separado); (3) voz não funcionou. Na `v0.6.1`:
a tela inicial some sempre que a câmera estiver rodando ou for iniciada (qualquer botão); o botão de baixo fica escondido até o
primeiro "Iniciar"; a escuta de voz liga **logo depois que a câmera é liberada** (`startVoice('auto')` em `start()`, sem novo
pedido, como na v0.5.6), não mais no clique; como pode nascer fora de um gesto real, ficou a rede de segurança: o primeiro toque
na tela a reinicia dentro do gesto, e se o microfone captar som por 1,5 s sem a escuta ouvir fala, o ícone fica âmbar e aparece
"Toque na tela uma vez…". O "i" (linha "Voz") registra `gesto ativo: sim/não/?` (`navigator.userActivation`) a cada início, para
sabermos se o iOS conta o momento pós-permissão como gesto. Tudo isso é hipótese: o e2e usa reconhecedor falso.

## O que o Kenidy precisa testar no iPhone (`v0.6.1`)

0. Abrir → **Iniciar** → permitir (deve ser **1 pedido**) → imagem sem tela preta → falar "Ei Clip" **sem tocar em mais nada**.
   Se a voz não responder: tocar uma vez na tela e tentar de novo; mandar print do "i" (linha "Voz", com "gesto ativo").

## Anterior (`v0.6.0`)

0. Abrir o app → tela "Ei Clip / Iniciar" → tocar em **Iniciar** → permitir → conferir: imagem aparece sem tela preta? quantos
   pedidos de permissão? o 🎙️ fica verde sozinho? "Ei Clip" grava/para sem tocar em mais nada? Print do "i" se algo falhar.

## Anterior (`v0.5.7`)

0. Fechar e abrir o app, dar a permissão, **tocar uma vez em qualquer lugar da tela** (ícone 🎙️ deve ficar verde) e dizer "Ei Clip".
   Depois de 2–3 gravações por voz, conferir se continua respondendo. Print do "i" se falhar.

## Anterior (`v0.5.6`)

0. Fechar e abrir o app: aparece só 1 pedido de Câmera e Microfone (depois o do microfone da voz)? A tela preta passa de ~2–3 s
   e a imagem aparece sozinha? Se ainda vier o 2º pedido igual, print do "i" (seção "Câmera (início)").

## Anterior (`v0.5.5`)

0. Fechar o app e abrir de novo: quantos pedidos de permissão aparecem e em que ordem? A imagem aparece sozinha? "Ei Clip"
   funciona depois do 2º pedido? Se algo falhar, print do "i" (seções "Câmera (início)" e "Voz").

## Anterior (`v0.5.4`)

0. Fechar outras abas do site (inclusive `/voz-teste/`), abrir o app e dar a permissão: deve aparecer imagem sozinha, no máx.
   ~8 s (até 2 tentativas automáticas). Se aparecer o aviso "A câmera não enviou imagem", tocar na tela. Mandar print do "i".

## Anteriores (`v0.5.3`)

0. Abrir o app (com permissão já dada e depois fechando e abrindo de novo): a câmera deve iniciar sozinha, sem tocar no botão azul.
   Se não iniciar, abrir o "i" e mandar print da seção "Câmera (início)".

## Testes anteriores (`v0.5.2`)

0. **Abrir o app, dar as permissões, tocar uma vez em qualquer lugar da tela e dizer "Ei Clip"** — deve funcionar de primeira.
   Se não funcionar, abrir o painel "i" e mandar um print da linha "Voz".

1. **Áudio dos clipes com a escuta ligada** (o ponto de maior risco): gravar por voz e conferir se o som do clipe continua
   limpo e com volume normal. Se piorar, comparar com o botão 🎙️ desligado.
2. Fluxo: dizer "Ei Clip" (grava com pre-roll) e "Ei Clip" de novo (para e salva). Conferir se não para sozinho logo após começar.
3. Escuta **no app instalado** (tela de início) e no Safari: no app instalado pode precisar de um toque na tela para a escuta começar.
4. Ao ar livre: vento, motor de barco, distância de ~2 m.
5. Sessão longa (10+ min) com a câmera aberta: o botão 🎙️ deve continuar com a borda verde.

## Dois pedidos de permissão (apurado na v0.5.4)

Prints do Kenidy: aparece "Câmera e Microfone" (getUserMedia) e, com a câmera já rodando, um segundo "Microfone" (reconhecimento de
voz do iOS). Opções: (A) Safari → aA → Ajustes do Site → Câmera e Microfone = Permitir (sem código; a confirmar se elimina também o
pedido da voz; não existe no app instalado). (B) Trocar o reconhecedor do iOS por detector de palavra de ativação dentro do app,
sobre o mesmo microfone (1 pedido só, resposta mais rápida, sem reinícios): **Porcupine** exige AccessKey e, segundo um post da
comunidade Home Assistant citando e-mail da Picovoice, o plano gratuito foi descontinuado em 30/06/2026 (não consegui abrir a página
oficial de preços; verificar antes de decidir); alternativa de código aberto seria Vosk (WASM, modelo pt pequeno, offline), pesada
para rodar junto do encoder de vídeo: precisaria de teste de viabilidade (Onda 4).

## Pendências e perguntas em aberto

- **Pre-roll:** mantido o comportamento atual (zera depois de cada clipe, sem repetir imagens).
- Se a escuta degradar o áudio gravado ou falhar em campo: plano B é o Porcupine Web (100% no aparelho; exige conta gratuita
  no Picovoice para chave e palavra treinada).
- Áudio a 16 kHz já foi visto uma vez (provável microfone Bluetooth); não confirmado.
- Pausar a câmera ao assistir clipe apaga o buffer; avaliar `audioSession` na Onda 4 se incomodar.

## Próximo passo

Kenidy testa a `v0.8.1` (lista acima). Com o resultado, abrir chat novo para a Onda 3b (ajustes do visual, ícone e marca):
pedir ao Claude para ler o repositório (`CLAUDE.md` e `docs/STATUS.md`).

## v0.9.9 — 4K seguro, recuperação do encoder, microfone

**Relato (v0.9.8):** 4K/60/Máxima deu "Encoding task did not complete", o app travou e reabriu; depois os clipes saíam com vídeo preto (só áudio) mesmo em 1080p; microfone mudo após ver um clipe continuava.

**Feito**

- Canvas de captura é recriado a cada configuração do encoder (hipótese: o iOS estraga o canvas 4K e `drawImage` sai preto).
- Erro do encoder de vídeo: o app reduz sozinho (4K → 1080p, 60 → 30 fps, senão qualidade Padrão), grava a preferência, avisa e reabre a câmera (até 3 vezes).
- 4K só a 30 fps (o iOS entregou 4K a 30); escolher 4K muda o fluxo para 30; escolher 60 fps tira do 4K; 4K salvo com 60 vira 30 ao abrir. Taxas de 4K reduzidas (30/38/45) e teto 50 Mbps.
- Microfone: 3 s após abrir a câmera, se a faixa está muda/sem blocos, reinicia a sessão de áudio e reabre a câmera uma vez (linha "microfone mudo" no Diagnóstico).

**Testar no iPhone:** 1080p gravar e ver na Galeria (vídeo preto sumiu?); abrir um clipe, voltar à câmera e testar a voz; 4K a 30 só se quiser. Se ainda sair preto, mandar o Diagnóstico logo após gravar.

## v0.10.0 — Navegação por gestos

- Arrastar a partir da **borda esquerda** para a direita = voltar (fecha player, Diagnóstico ou Ajustes; sai da seleção; Galeria/Câmera → Início). Na gravação o app avisa para finalizar antes.
- Arrastar a partir da **borda direita** para a esquerda = abrir a Galeria (Início ou Câmera).
- Só vale se o toque começa na borda (28 px), para não atrapalhar a seleção por arrasto nem a barra do vídeo.
- Dado do teste na v0.9.8: o microfone ficou mudo só às vezes depois da Galeria (pico 0.000); a detecção e reinício automático entraram na v0.9.9.

**Testar:** gestos nas três telas; microfone depois de ver um clipe (com a v0.9.9+ instalada: rodapé do app).

## v0.10.1 — Bipe fixo e mais suave, Ajustes enxutos, transições maiores

- Removido o ajuste "Volume do bipe": volume único (o antigo "Máximo"), com saturação reduzida (1,8 → 0,9) e subida/descida mais longas (20/70 ms) para diminuir o estouro, principalmente no bipe de parar.
- "Gravar bipe no vídeo" virou "Bipe no vídeo gravado", sem texto de ajuda.
- Transições: telas deslizam ~26% da largura em 340 ms; o player agora fecha com fade.
- Player: volume forçado a 1, sem mudo, e a categoria de áudio "playback" é reposta após 300 ms. Observação: nos Diagnósticos o pico do microfone é 0.002–0.013, ou seja, o áudio gravado é naturalmente baixo; se o som do clipe continuar fraco, o próximo passo é dar ganho digital ao microfone.

**Testar:** bipe de parar (ainda estoura?); volume do clipe na Galeria; transição ao voltar com o gesto e ao fechar o player.

## v0.10.2 — Reinício do microfone mais forte, bipe sem saturação

- Dado (v0.10.1): com o player em modo "playback" o clipe toca com volume normal, mas o microfone voltava mudo (pico 0.000 em 65 blocos) e o reinício automático não disparou (exigia pico exatamente 0). Agora: pico < 0,0008 conta como mudo; o reinício solta as faixas de áudio, volta a sessão para `auto`, espera 450 ms, usa `play-and-record` e reabre a câmera. Linha no Diagnóstico: "microfone mudo (pico …)". Limitação: o reinício automático não é um toque, então a voz pode exigir um toque no botão de voz.
- Bipe: removida a saturação (drive 0), pico 0,9 (mais limpo; pode soar um pouco mais baixo).
- Transições: 340 → 300 ms.

**Testar:** Galeria → clipe → câmera: o microfone volta sozinho (veja o Diagnóstico)? Bipe ainda estoura?

## v0.10.3 — Recarrega a página ao fechar o player (microfone)

- Dado (v0.10.2): o reinício automático rodou e o microfone continuou mudo (pico 0.0000) — dentro da página não há recuperação depois que o player usa o áudio.
- Contorno: ao fechar o player de um clipe com som a página recarrega e volta para a mesma tela (`sessionStorage` `clip.resumeView`). Em cargas novas o microfone sempre funcionou. Não recarrega em testes (`navigator.webdriver`).
- Custo: uma recarga curta ao fechar o player; a câmera segue abrindo só com o toque em "Abrir câmera".
- Bipe: ainda estoura segundo o Kenidy; falta saber se é no alto-falante ou só no vídeo gravado.

**Testar:** Galeria → clipe → fechar → câmera: voz e áudio da gravação funcionam?

## v0.10.4 — Voz após o reinício do microfone, bipe com buffer maior

- Dado (v0.10.3): mesmo após o recarregamento o 1º microfone vem mudo (pico 0.0000); o reinício automático da v0.10.2+ recupera (pico 0.023) mas a escuta de voz ficava presa ao microfone antigo ("escutando" sem ouvir). Agora o reinício também para a voz; ela volta a esperar um toque na tela (aviso).
- Bipe: estoura só no alto-falante ao vivo (não na gravação) nos dois bipes, mais no 2º. Hipótese: falta de buffer no áudio com 1080p60 a 48 Mbps ocupando a página; `AudioContext` passou de `latencyHint: 'interactive'` para `'playback'` (buffer maior). Risco: pequena mudança na sincronia áudio/vídeo (ver "Áudio − vídeo" no Diagnóstico).
- A recarga ao fechar o player (v0.10.3) segue; avaliar se ainda é necessária, já que o reinício automático resolveu o microfone sozinho.

**Testar:** bipe ao vivo; voz após o reinício (um toque na tela); sincronia áudio/vídeo de um clipe.

## v0.10.5 — Teste: bipe do alto-falante com pico 0,5

- v0.10.4: o bipe estoura ao vivo mesmo em 1080p/30 Padrão, então não é carga de processamento; a gravação sai limpa. Hipótese: o 0,9 de pico passa do que o alto-falante aguenta com o microfone aberto.
- Alto-falante agora usa 55% do pico (≈0,5); o bipe gravado no vídeo continua igual.
- Se ainda estourar: o iOS limita a saída com o microfone aberto; alternativas = bipe só no vídeo ou vibração/aviso visual.

## v0.10.6 — Bipe sem chiado: a escuta de voz pausa durante o bipe

- Teste do Kenidy (v0.10.5): com o comando de voz desligado o bipe sai limpo; ligado, chia. A causa é o reconhecimento de voz (Web Speech) aberto enquanto o alto-falante toca (o eco do `getUserMedia` já estava desligado).
- `pauseVoiceFor(ms)` (`voice.ts`): aborta a escuta no bipe e religa em `beepMs + 150 ms`, sem toque. Pode deixar a escuta surda em alguns casos; o aviso "toque na tela" e o toque seguinte a reiniciam (ver Diagnóstico → Comando de voz: "pausa de … ms (bipe)").
- Volume do alto-falante voltou ao pico 0,9 (o teste de 0,55 não resolvia).

**Testar:** bipes ao vivo (sem chiado?); depois do bipe, o comando de voz continua respondendo (várias gravações seguidas, por voz e por toque).

## v0.10.7 — Bipe volta a tocar, ganho automático do microfone

- Relato (v0.10.6): com a escuta pausada no bipe, os dois bipes ficaram **mudos** (a reconfiguração de áudio do iOS ao abortar a escuta engole o bipe agendado junto). Agora o alto-falante toca 200 ms depois (`BEEP_LEAD_SEC`), com a escuta já pausada; `beepMs` inclui essa espera. O bipe gravado no vídeo continua imediato. Volume mantido (pico 0,9).
- Voz: o Kenidy precisa falar alto/repetir desde versões antigas e o pico do microfone fica em 0,002–0,013. Teste: `autoGainControl: true` na captura (eco e ruído seguem desligados). Verificar no Diagnóstico "ganho sim", o pico e se a voz responde melhor; se o clipe ficar com chiado de ganho, reverter.
- Microfone sem sinal ao abrir (permissões recém-dadas): ainda cai no reinício automático (~3 s) com a voz esperando um toque.

**Testar:** bipes ao vivo (tocam e sem chiado?); voz sem precisar falar alto; áudio do clipe (mais alto? chiado?).

## v0.10.8 — Galeria leve e seleção em ordem de leitura

- Relato (v0.10.7): com muitos clipes a Galeria desmontava o layout e não mostrava os últimos vídeos. Causa provável: cada miniatura era um `<video>` de clipe inteiro (50 MB, 45 Mbps); o iOS esgota decodificadores/memória. Agora `ui/thumbs.ts` gera uma imagem JPEG 240×320 por clipe, em fila (um clipe por vez, com o decodificador solto em seguida), e a Galeria, o Início e o botão da câmera usam `<img>`.
- Seleção por arrasto: marca do clipe onde o dedo desceu até o clipe sob o dedo, em ordem de leitura (descer uma fileira marca o resto da fileira de cima; voltar desmarca).
- Diagnóstico v0.10.7: o iOS ignora `autoGainControl: true` (continua "ganho não"); o teste de ganho não surtiu efeito. Bipe segue chiando mesmo com a escuta pausada — investigar depois (a pausa pode não estar chegando antes do bipe, ou o chiado vem de outro ponto).

**Testar:** Galeria com muitos clipes (layout, últimos vídeos, velocidade das miniaturas); arrastar descendo fileiras.

## v0.10.9 — Miniaturas: vídeo escondido na página + checagem de quadro

- v0.10.8: as miniaturas (imagens) ficaram vazias no iPhone: o `<video>` solto, fora da página, não decodificou. Agora o vídeo da miniatura fica escondido dentro da página (2 px, quase transparente), espera `loadedmetadata` + `seeked`, e confere que o quadro desenhado não está em branco; se estiver, toca mudo por um instante e tenta de novo. Falhas não ficam em cache (a próxima abertura da Galeria repete).
- Teste do Kenidy: 30 fps bateu 30 certinho na galeria nativa; 60 fps saiu ~55 (o Diagnóstico mostra a saída entre 48 e 55/s).
- "Todos"/"Nenhum" existem na barra de seleção (botão alterna); conferir se ficou claro.

**Testar:** miniaturas aparecem na Galeria e no Início? Se continuarem vazias, mandar o Diagnóstico.

## v0.10.10 — Miniatura guardada na gravação

- v0.10.9: as miniaturas continuaram cinza; decodificar clipes grandes no iPhone para tirar o 1º quadro não é confiável (antes funcionava às vezes, sumia depois).
- Agora a miniatura (JPEG 240×320) é tirada do quadro **ao vivo** na hora de parar a gravação (`captureThumb` em `recorder.ts`, a partir de `S.canvas`) e guardada junto do clipe no IndexedDB (`ClipRecord.thumb`). Sem decodificar nada: aparece na hora e não some.
- Clipes antigos (sem `thumb`) ainda tentam o caminho por vídeo escondido (v0.10.9); se falhar, mostram um ícone discreto de câmera em vez do quadrado cinza vazio.

**Testar:** gravar um clipe novo → miniatura na Galeria, no Início e no botão da câmera, também depois de fechar e abrir o app. Os clipes antigos podem ficar com o ícone.

## v0.11.0 — Toque longo para selecionar

- Pressionar ~0,45 s num clipe da Galeria entra no modo de seleção com ele marcado (sem abrir o player); continuar arrastando marca os seguintes em ordem de leitura. O menu de pressionar do iOS foi desligado nas miniaturas (`-webkit-touch-callout`).
- Miniaturas: a geração agora só custa um desenho de 240×320 do quadro que já está na tela, ao parar a gravação (~poucos ms); clipes antigos tentam o caminho por vídeo escondido uma vez por abertura.

**Testar:** toque longo num clipe; arrastar logo depois; toque curto continua abrindo o player.

## v0.11.1 — Barra do topo mais baixa

- Barra do Início e da Galeria desceu 14 px (altura 56 → 70 px, 14 px de respiro em cima) para sair de perto do notch; avisos acompanham (+14 px).
- A tela da câmera tem espaçamento próprio (não mudou).
- Atualização: o app verifica ao abrir, ao voltar ao primeiro plano e a cada 5 min; o publicar leva ~40 s. Se o aviso não vier, minimizar e voltar depois de um minuto.

## v0.12.0 — Fechar o player arrastando para baixo; "Ei Clip" mais fácil de reconhecer

- Player: arrastar para baixo (fora da barra de controles do vídeo e dos botões) faz a tela acompanhar o dedo, encolher e esmaecer; soltando após ~130 px (ou arremesso rápido) fecha, senão volta. Segue valendo o recarregamento ao fechar (microfone).
- Voz ainda "surda" (relato do Kenidy). Sem dado novo do aparelho, afrouxei o que **conta** como o comando: saudações extras ("e", "a", "ae", "eu"), junto ("eiclip", "eclipse"), 5 alternativas por fala (antes 3) e **"clip"/"clipe" solto começa** a gravação (só começa; parar continua exigindo a frase completa). Risco: gravação começar sem querer ao falar "clipe".
- Para investigar melhor: Diagnóstico → Comando de voz mostra "texto …" de cada fala; mandar o texto de uma tentativa que falhou mostra se o problema é o iOS não ouvir (nenhuma linha "texto") ou o app não entender (linha sem ✓).

**Testar:** arrastar o player; falar "Ei Clip" normalmente, sem gritar; se falhar, mandar o Diagnóstico logo depois.

## v0.12.1 — Sem piscar ao fechar o player

- Causa do piscar (Diagnóstico v0.12.0: 6 recarregamentos seguidos em "Cargas da página"): o recarregamento da v0.10.3 acontecia a cada fechamento do player. Agora ele só acontece ao **abrir a câmera** depois de ver um clipe com som (`audioNeedsReset`/`reloadForAudio` em `clips-view.ts`, chamado de `openCamera`); a câmera volta pronta e um toque a liga. Navegar na Galeria e fechar o player não recarrega mais.
- Arrastar para baixo: ao soltar, a tela continua descendo/esmaecendo e só então esconde (antes voltava a 100% por um instante).
- Pergunta do Kenidy: ativar e desativar usam a mesma regra — a frase completa ("ei clip", "aclip", "eiclip"…) alterna (liga/desliga); "clip"/"clipe" solto só **liga**.

## v0.12.2 — "clip" solto também para a gravação; câmera abre sozinha após o recarregamento

- Pedido do Kenidy: parar só com "clip". Agora "clip"/"clipe" solto **também para**, mas só depois de 3,5 s de gravação (`LOOSE_STOP_AFTER_MS` em `voice.ts`), para o "clip" repetido do próprio "Ei clip" que iniciou não parar logo em seguida. A trava de 3 s entre comandos continua.
- Depois de ver um clipe com som, ao abrir a câmera a página ainda recarrega (microfone), mas agora a câmera abre sozinha ao voltar (`openCamera(true)`); a voz espera um toque na tela (aviso), em vez de exigir "ligar câmera" de novo.
- Risco: falar "clipe" durante a gravação (depois de 3,5 s) a encerra.

## v0.12.3 — Volta o recarregamento ao fechar o player (câmera abre sozinha), com fade

- Relato (v0.12.2): ao abrir a câmera depois de ver um clipe a voz exigia um toque na tela; antes da v0.12.1 (recarga ao fechar o player) tudo funcionava sozinho. Motivo: recarregar _ao abrir a câmera_ tira o toque do usuário, e a escuta de voz do iOS só liga dentro de um toque.
- Agora: recarrega de novo **ao fechar o player** (clipe com som), voltando à mesma tela com um fade de entrada (`body.resumed`, 300 ms) para não piscar; o toque seguinte em "abrir câmera" é um gesto e liga câmera, microfone e voz sozinhos. Removida a recarga em `openCamera`.
- Trade-off: uma recarga curta (fade) ao fechar o player. Se ainda incomodar, a alternativa é dispensar o recarregamento e aceitar o toque extra.

## v0.12.4 — Voz religa sozinha após o reinício do microfone

- Relato (v0.12.3): ainda pedia toque na tela para ativar o microfone. Hipótese: o reinício automático do microfone mudo (v0.10.4) parava a voz e a deixava em "aguardando toque". Agora, nesse reinício, a escuta tenta ligar sozinha (`voiceAutoNext` → `startVoice('auto')`); se o iOS a deixar surda, o aviso de toque e o toque seguinte a reiniciam como antes.
- Se continuar pedindo toque, preciso do Diagnóstico logo depois: "Câmera: início" mostra se houve "microfone mudo … reabrindo" e "Comando de voz" mostra "aguardando toque na tela".

## v0.12.5 — Teste: sem `setAudioSession('play-and-record')` ao abrir a câmera; desfeito o auto da voz

- Relato/Diagnóstico (v0.12.4): o 1º microfone nasce mudo (pico 0.0000) após o recarregamento; o reinício o recuperou, mas a voz religada sozinha ficou surda e o microfone voltou a pico 0.000 → o `voiceAutoNext` da v0.12.4 piorou; desfeito (a voz volta a esperar um toque depois do reinício).
- Hipótese em teste: o `setAudioSession('play-and-record')` que o `start()` chama desde a v0.9.8 faz o microfone da câmera nascer mudo. Numa página recém-carregada ela não é necessária. Removida de `start()`; no player seguem 'playback' (ao abrir) e 'auto' (ao fechar, antes do recarregamento).
- Se o microfone ainda nascer mudo: o gatilho é a ordem voz→câmera (a voz abre o microfone primeiro); próximo teste = câmera primeiro, voz logo em seguida dentro do mesmo toque.

## v0.12.6 — Sem recarregamento ao fechar o player

- Diagnóstico (v0.12.5): mesmo sem `setAudioSession('play-and-record')` e **com** recarregamento, o microfone da câmera nasceu mudo (pico 0.0000), o reinício automático não o recuperou e a voz ficou esperando toque. Ou seja: o recarregamento não evita o problema; só causa o piscar. Removido (`closePlayer` volta a só fechar; fora também a restauração da tela e o fade `body.resumed`).
- Ficam: reinício automático do microfone mudo (3 s), a voz aguarda um toque depois dele, `setAudioSession` 'playback'/'auto' só no player, e o teste sem `play-and-record` no `start()`.
- Ainda sem causa raiz do microfone mudo ao abrir a câmera. Hipóteses abertas: (1) a ordem voz→câmera (a voz abre o microfone antes do `getUserMedia`); (2) o reinício extra por troca de lente ("start #2"); (3) o `MediaStreamAudioSourceNode` com a faixa entregando zeros no iOS 27. Próximo experimento sugerido: câmera primeiro e voz logo depois no mesmo toque, e pedir o ultra-angular já no 1º `getUserMedia`.

## v0.12.7 — Voz não é derrubada na recuperação do microfone mudo

- Relato: Câmera → Galeria → tocar um clipe → voltar à câmera: o app volta a pedir um toque para ativar microfone e voz.
- Causa (investigada no código, sem mudar nada antes): não é a navegação. Sair da câmera para a Galeria para a voz de propósito (`showScreen` → `stopAll` → `stopVoice`) e ao voltar `openCamera` a religa dentro do toque (funciona). O pedido de toque vem da **recuperação do microfone mudo** (`camera.ts`, ~3 s depois de abrir): ela chamava `stopVoice()` e reabria a câmera sem gesto; sem gesto, `startVoice('wait')` cai em `waitForTap` (aviso "Toque na tela"). O Diagnóstico da v0.12.5 já mostrava essa sequência. A v0.12.4 tentou religar a voz sozinha (`'auto'`) e ela ficou surda → desfeito na v0.12.5.
- Mudança: removido o `stopVoice()` dessa recuperação. A escuta (Web Speech) tem captura própria e `start()` já a preserva nos reinícios (`stopAll(…, keepVoice)`); `startVoice('wait')` sai sem fazer nada se a escuta está viva. Se ela ficar surda, o aviso de toque (som alto sem fala ouvida) continua como rede de segurança. **Hipótese não confirmada:** que a escuta não precise ser recriada junto com o microfone.
- Testar no iPhone: Câmera → Galeria → tocar um clipe com som → voltar à câmera. A voz continua funcionando sem pedir toque? Se pedir, copie o Diagnóstico (pela tela da câmera): em "Câmera: início" procure "microfone mudo … reabrindo" e em "Comando de voz" o que veio depois (`aguardando toque na tela` ou `microfone com som, mas a escuta não ouviu fala`).
- Não resolve a causa raiz do microfone nascer mudo. Próximo experimento: câmera primeiro e voz logo depois, no mesmo toque.

## v0.12.8 — Desfeita a v0.12.7 (voz verde, mas surda)

- Resultado da v0.12.7 no iPhone: Câmera → Galeria → clipe → câmera: a tela pisca (é o reinício do microfone mudo), o aviso de toque some, o ícone da voz fica **verde, mas "Ei Clip" não funciona**. A hipótese da v0.12.7 (a escuta não depende do microfone da câmera) está **refutada**.
- Por que ficou silencioso: o ícone verde é o estado `S.voice = 'listening'` de antes da recuperação (o `stopVoice()` era o que o zerava); e o aviso de surdez (`voice.ts`, intervalo de 300 ms) fica desligado para escutas nascidas de toque (`inGesture`), então nada avisa.
- Agora (v0.12.8): `stopVoice()` de volta na recuperação do microfone mudo; a voz espera um toque depois do reinício (comportamento da v0.12.6, que funciona após o toque). É preferível pedir um toque a mostrar verde estando surda.
- Resumo do que já foi testado para a voz depois do reinício do microfone: religar sem toque (v0.12.4) → surda; manter viva (v0.12.7) → verde e surda; parar e esperar toque (v0.12.6/0.12.8) → funciona após o toque.
- Conclusão: sem toque não dá para recuperar a voz; o caminho para eliminar o toque é **evitar o microfone mudo** (a recuperação não precisaria rodar). Próximo experimento: câmera primeiro e voz logo depois no mesmo toque (atenção: a v0.7.0 viu tela preta e 3 pedidos ao abrir voz e câmera juntas), ou pedir o ultra-angular já no 1º `getUserMedia` para evitar o "start #2".

## v0.12.9 — Espera mínima antes de reabrir o microfone (microfone mudo ao voltar rápido)

- Observação do Kenidy (v0.12.8): entrar na Galeria e voltar **depressa** à câmera deixa o microfone mudo (a tela pisca com o reinício e a voz pede toque); esperando uns segundos na Galeria e voltando, **funciona**. O atalho ao lado do botão de gravar e o botão "voltar → Início → Galeria" usam o mesmo código (`showScreen`); a diferença é só o tempo até reabrir. Com um clipe reproduzido o microfone para nos dois caminhos (problema à parte: sessão `playback` do player).
- Hipótese (apoiada pelo teste manual): voltar logo após sair → o iOS ainda não liberou a sessão de áudio → o microfone nasce mudo → recuperação aos 3 s → voz espera toque.
- Mudança: `showScreen` chama `markCameraLeft()` (`camera.ts`) ao sair da câmera; no `start()`, depois de a voz se definir e **antes** do `getUserMedia`, espera até `MIN_REOPEN_MS` (3000 ms, palpite) desde a saída. A voz continua nascendo dentro do toque. Só vale na 1ª abertura depois de sair (não afeta trocar lente/qualidade).
- Diagnóstico, "Câmera: início": `saiu da câmera` e `reabriu N ms após sair; aguardando M ms` (ou `sem espera`). Use para ajustar `MIN_REOPEN_MS`.
- Testar: (1) entrar na Galeria pelo atalho e voltar **rápido** → a câmera deve demorar ~3 s para abrir, e a voz e o microfone devem funcionar sem pedir toque; (2) repetir pelo caminho voltar → Início → Galeria; (3) se ainda falhar, copiar o Diagnóstico pela tela da câmera (linhas "saiu da câmera", "reabriu…", "microfone mudo…").
- Não resolve o microfone mudo depois de **reproduzir um clipe** (outro gatilho). Próximo: investigar `setAudioSession('playback')` no player e o tempo de liberação após fechar o player.

## v0.12.10 — Voltar na Galeria volta para a tela de origem

- Resultado da v0.12.9 (Kenidy): **deu certo**. Voltar rápido da Galeria (atalho ao lado do botão de gravar ou via Início) mantém microfone e voz funcionando sem pedir toque. `MIN_REOPEN_MS = 3000` serve por ora (conferir no Diagnóstico "reabriu … ms após sair" se algum dia falhar).
- Observação dele: entrando na Galeria pelo atalho da câmera, o botão voltar levava ao **Início** em vez da câmera.
- Mudança: `navigation.ts` guarda de onde a Galeria foi aberta (`galleryFrom`); `leaveGallery()` volta para a câmera (`openCamera()`, dentro do toque, com a espera mínima da v0.12.9 se for rápido) ou para o Início. Vale para o botão voltar e para o gesto de borda (`gestures.ts`). Entrando pelo Início ("Ver todos"), o voltar continua levando ao Início.
- Testar: (1) câmera → atalho da Galeria → voltar: deve reabrir a câmera com a voz funcionando; (2) Início → Galeria → voltar: Início; (3) o mesmo com o gesto de arrastar da borda esquerda.
- Pendente: microfone mudo depois de **reproduzir um clipe** (sessão `playback` do player).

## v0.12.11 — Câmera "estacionada" na Galeria (voltar rápido é instantâneo)

- Resultado da v0.12.10 (Kenidy): validado. Mas voltar da Galeria **muito rápido** ainda falhava às vezes: a câmera esperava ~3 s e depois o microfone nascia mudo e pedia toque (3 s está no limite; o tempo de liberação do iOS varia). Decisão dele: manter a câmera ligada em vez de afinar o atraso.
- Mudança: ao ir da câmera para a **Galeria**, a captura (câmera, microfone e voz) **continua ligada por 15 s** (`PARK_MS`, `parkCamera()` em `camera.ts`). Voltar nesse prazo (botão voltar, atalho da câmera, gesto da borda) chama `resumeParked()`: refaz só a prévia (`refreshPreview`), descarta o buffer do período fora e **não reabre nada** (sem espera, sem permissão, sem microfone mudo). Vai ao **Início**: desliga como antes (`releaseCamera()`).
- A câmera estacionada é desligada de verdade (`releaseCamera()` = `stopAll` + fecha o `AudioContext` + hora para o `MIN_REOPEN_MS`): (a) ao **tocar num clipe** (`openPlayer`; com captura ligada o iOS silencia o player), (b) após 15 s na Galeria, (c) ao ir ao Início. O comando de voz é ignorado fora da câmera (`onVoice` exige `S.view === 'camera'`), então não grava de dentro da Galeria.
- Riscos a conferir no iPhone: (1) **som do clipe** tocado logo depois de entrar na Galeria (a captura é desligada no mesmo toque; se sair mudo/baixo, o desligamento precisa de um instante antes do `play()`); (2) a **prévia** ao voltar (o `<video>` ficou numa tela oculta; `refreshPreview` deveria bastar, como na volta do segundo plano); (3) uso de bateria e indicador de câmera/microfone do iOS aceso até 15 s na Galeria.
- Diagnóstico, "Câmera: início": `Galeria: câmera mantida ligada por 15 s`, `câmera retomada da Galeria (sem reabrir)`, `Galeria há muito tempo: desligando a câmera`, `saiu da câmera`.
- e2e: o teste que esperava a captura desligada ao abrir a Galeria foi trocado (câmera estacionada; voltar sem nova captura; desliga sozinha; tocar no clipe desliga). O prazo vira 3 s só na página do teste.
- Testar: (1) câmera → atalho da Galeria → voltar **rápido**: volta na hora, com imagem, voz e microfone funcionando, sem pedir toque; (2) ficar mais de 15 s na Galeria e voltar: reabre normal (com a espera mínima); (3) câmera → Galeria → tocar num clipe: tem som? Depois voltar: o microfone ainda para (problema conhecido, próximo item); (4) dizer "Ei Clip" dentro da Galeria: não deve gravar.

## v0.12.12 — Câmera estacionada também no Início

- Resultado da v0.12.11 (Kenidy): **fluido**, a volta da Galeria à câmera não pisca nem buga. Mas câmera → **Início** → "Abrir câmera" de novo (rápido) ainda pedia toque para o microfone e, **mesmo depois do toque, "Ei Clip" não reconhecia**.
- Causa: o Início ainda desligava a captura de verdade, então voltar logo caía no mesmo problema do tempo (microfone nasce mudo; `MIN_REOPEN_MS` = 3 s é limite). A recuperação do microfone roda **uma vez a cada 15 s** (`audioRetried`); se a 2ª captura também nascer muda, a voz fica surda **mesmo após o toque**. **Correção de uma afirmação anterior:** "parar e esperar toque funciona após o toque" (tabela da v0.12.8) só vale se o microfone da câmera estiver bom; com o microfone mudo, o toque não adianta.
- Mudança: `showScreen` estaciona a captura (15 s, `parkCamera`) ao sair da câmera para **qualquer** tela (Início ou Galeria); só desliga se a câmera ainda estava abrindo. Do Início para a Galeria e de volta, o prazo continua correndo (não reinicia).
- Ajustes: qualidade/fluidez/imagem mudados no Início com a câmera estacionada **desligam** a captura (`applyCaptureSettings` em `app.ts`) em vez de reabri-la fora da tela (sem toque a voz ficaria surda); o próximo "Abrir câmera" já usa o ajuste novo (com a espera mínima da v0.12.9).
- Diagnóstico, "Câmera: início": `fora da câmera: captura mantida ligada por 15 s`, `câmera retomada (captura estacionada, sem reabrir)`, `fora da câmera há muito tempo: desligando a captura`.
- e2e: voltar ao Início deixa a câmera e a voz ligadas; abrir logo depois não chama `getUserMedia` nem a voz de novo; ajuste de vídeo no Início desliga a captura; passado o prazo desliga câmera e voz.
- Testar: (1) câmera → Início → "Abrir câmera" **logo**: volta na hora, microfone e voz funcionando; (2) câmera → Início, esperar mais de 15 s, "Abrir câmera": reabre normal (~3 s de espera se for logo depois dos 15 s); (3) mudar a qualidade nos Ajustes do Início e abrir a câmera: usa o ajuste novo; (4) indicador de câmera/microfone do iOS aceso até 15 s no Início (bateria).

## v0.12.13 — Retomar com um toque ao voltar do segundo plano; câmera estacionada por 60 s

- Resultado da v0.12.12 (Kenidy): Início → câmera funcionou. Mas **minimizar o app e voltar depois de alguns segundos** repetia o problema (microfone mudo, voz pedindo toque). Voltar rápido já funcionava (o iOS só silencia as faixas).
- Limite da plataforma: minimizado, o iOS suspende câmera, microfone e escuta de voz da página e, passados alguns segundos, **encerra as faixas**; não há como mantê-las vivas. O app reabria sozinho (`start()` sem toque), o que dava microfone mudo e voz esperando toque.
- Mudança 1 — **Retomar com um toque** (`pauseUntilTap` em `app.ts`): ao voltar com faixas encerradas (ou sem imagem nova em 2,5 s), a captura é desligada de vez (`releaseCamera(leftAt)`, com a espera mínima contada desde a saída do app), a tela da câmera mostra "Toque na tela para retomar a câmera." e o botão "Ligar câmera" na hora (`S.needResume`); um toque fora dos botões (ou no botão) chama `openCamera()` **dentro do gesto**: voz primeiro, câmera, microfone. Se o app voltou no Início/Galeria com a captura estacionada encerrada, ela só é desligada (o "Abrir câmera" abre normal).
- Mudança 2 — volta rápida inalterada: faixas vivas → `refreshPreview()` sem toque.
- Mudança 3 — **`PARK_MS` = 60 s** (antes 15 s). Racional: cobre olhar a Galeria, passar pelos Ajustes e pequenas pausas; mais que isso a câmera ficaria gravando buffer à toa (codificação contínua de vídeo+áudio: bateria e calor) e com o indicador de câmera/microfone do iOS aceso. Ajustável pela constante; se esquentar ou gastar bateria, reduzir.
- Diagnóstico, "Câmera: início": `voltou (Ns fora); faixas …` e `captura encerrada em segundo plano; aguardando toque para retomar`. Copie depois de alguns testes para ver a partir de quantos segundos fora o iOS encerra as faixas.
- e2e: novo teste de voltar do segundo plano com faixas encerradas (pede toque; um toque retoma câmera e voz).
- Testar: (1) minimizar 2 s e voltar: segue sem toque; (2) minimizar 20–30 s e voltar: aparece "Toque na tela para retomar a câmera."; um toque fora dos botões religa câmera, microfone e voz, e "Ei Clip" funciona; (3) câmera → Início/Galeria por ~30 s e voltar: instantâneo (prazo de 60 s); (4) acompanhar bateria/calor em uso longo.

## v0.12.14 — Volta do segundo plano: sem refazer a prévia duas vezes, tempo fora correto, escuta marcada como não verificada

- Relato (v0.12.13): às vezes, ao minimizar e voltar, a tela dá uma piscada, encolhe e volta; a voz às vezes não funciona. Diagnóstico de uma ocorrência **em que a voz seguiu funcionando** (a escuta sobreviveu).
- O que o Diagnóstico mostrou: (1) o `visibilitychange` "visible" chegou **duas vezes seguidas** e **sem** "hidden" antes (nenhum "saiu do app" nem `pagehide`); as faixas voltaram `live/mudas` e desmutaram em 0,2–0,5 s; (2) a prévia foi refeita **duas vezes** em seguida (`prévia refeita` ×2 no mesmo instante) e a nova só entregou imagem ~0,7 s depois (19,8 s → 20,5 s) — essa é a piscada; (3) "voltou (20s fora)" estava errado: `hiddenAt` ficou 0 e o app contou "tempo desde a abertura".
- Mudanças: (a) a 2ª notificação de volta em menos de 1 s é ignorada (a prévia é refeita uma vez só); (b) sem aviso de saída o tempo fora fica desconhecido (log: "sem aviso de saída"); (c) `markVoiceUnverified()` (`voice.ts`): ao voltar, a escuta que segue de pé **não é derrubada** (decisão do Kenidy: não exigir toque quando ela sobrevive); só é marcada como não verificada, para o aviso de surdez (som alto sem fala ouvida por ~1,5 s) valer de novo; esse aviso pede um toque, que reinicia a escuta dentro do gesto. Risco: em ambiente muito ruidoso (vento, motor) sem fala reconhecida o aviso pode aparecer à toa.
- Não resolvido: a prévia ainda fica ~0,7 s sem imagem depois de refeita (o `<video>` novo demora a entregar o 1º quadro). Ideia: manter o antigo até o novo tocar e só então trocar (não implementada). A causa do "encolher" não ficou provada: o CSS do `<video>` novo já é tela cheia.
- Testar: minimizar e voltar várias vezes (rápido e demorado): a piscada deve durar menos (uma refeita, não duas); a voz continua sem pedir toque quando sobrevive; se ela morrer em silêncio, o aviso de toque deve aparecer ao falar/ter som alto. Se acontecer de novo, copie o Diagnóstico logo depois (pela tela da câmera).
- e2e: volta anunciada duas vezes refaz a prévia uma só vez; volta sem aviso de saída mantém a câmera ligada.
