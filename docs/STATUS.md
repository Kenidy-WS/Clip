# Status

**Atualizado em:** 2026-10-29 · **No ar (`main`):** 0.5.1 (comando de voz; correção do início da escuta) · aguardando teste no iPhone

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

## O que o Kenidy precisa testar no iPhone (`v0.5.1`)

0. **Abrir o app, dar as permissões, tocar uma vez em qualquer lugar da tela e dizer "Ei Clip"** — deve funcionar de primeira.
   Se não funcionar, abrir o painel "i" e mandar um print da linha "Voz".

1. **Áudio dos clipes com a escuta ligada** (o ponto de maior risco): gravar por voz e conferir se o som do clipe continua
   limpo e com volume normal. Se piorar, comparar com o botão 🎙️ desligado.
2. Fluxo: dizer "Ei Clip" (grava com pre-roll) e "Ei Clip" de novo (para e salva). Conferir se não para sozinho logo após começar.
3. Escuta **no app instalado** (tela de início) e no Safari: no app instalado pode precisar de um toque na tela para a escuta começar.
4. Ao ar livre: vento, motor de barco, distância de ~2 m.
5. Sessão longa (10+ min) com a câmera aberta: o botão 🎙️ deve continuar com a borda verde.

## Pendências e perguntas em aberto

- **Pre-roll:** mantido o comportamento atual (zera depois de cada clipe, sem repetir imagens).
- Se a escuta degradar o áudio gravado ou falhar em campo: plano B é o Porcupine Web (100% no aparelho; exige conta gratuita
  no Picovoice para chave e palavra treinada).
- Áudio a 16 kHz já foi visto uma vez (provável microfone Bluetooth); não confirmado.
- Pausar a câmera ao assistir clipe apaga o buffer; avaliar `audioSession` na Onda 4 se incomodar.

## Próximo passo

Kenidy testa a `v0.5.0` (lista acima). Aprovada, a Onda 2 fecha e a Onda 3 (interface, marca e ícone) começa em chat novo:
pedir ao Claude para ler o repositório (`CLAUDE.md` e `docs/STATUS.md`).
