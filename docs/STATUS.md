# Status

**Atualizado em:** 2026-10-29 · **No ar (`main`):** 0.5.4 · aguardando teste no iPhone

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

## O que o Kenidy precisa testar no iPhone (`v0.5.4`)

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
