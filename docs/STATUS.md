# Status

**Atualizado em:** 2026-10-29 · **No ar (`main`):** 0.7.0 · aguardando teste no iPhone

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

Kenidy testa a `v0.5.0` (lista acima). Aprovada, a Onda 2 fecha e a Onda 3 (interface, marca e ícone) começa em chat novo:
pedir ao Claude para ler o repositório (`CLAUDE.md` e `docs/STATUS.md`).
