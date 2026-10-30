# Status

**Atualizado em:** 2026-10-29 · **Versão:** 0.4.0 (Onda 1) · **Branch com a Onda 1:** `onda-1`

## Feito

- Protótipo `v0.3.7` validado pelo Kenidy no iPhone: vídeo vertical 1080p, áudio nos clipes (também no player do app),
  pre-roll desde o 1º segundo, sons de início/fim, offline, aviso de atualização, abertura já pedindo câmera/mic.
- Onda 1: migração para TypeScript + Vite em módulos (comportamento igual ao `v0.3.7`), nome "Ei Clip" em título,
  manifest e textos, 19 testes unitários, e2e no Chromium, ESLint/Prettier, CI e deploy (GitHub Actions), documentação.
- Código antigo preservado no commit `0e9176b` (tag local `v0.3.7-legado`; a tag não subiu para o GitHub).

## Para publicar a Onda 1 (ação do Kenidy)

1. GitHub → repositório → Settings → Pages → **Source: GitHub Actions**.
2. Avisar o Claude, que faz o merge da branch `onda-1` na `main`. O workflow publica sozinho.
   (Antes disso a `main` ainda serve o app antigo, e nada quebra.)
3. No iPhone: abrir o app, tocar em "Atualizar" no banner e conferir `v0.4.0` no rodapé.
   Se o ícone da tela de início ainda mostrar o nome antigo, remover e adicionar de novo.

## O que o Kenidy deve testar no iPhone (Onda 1)

- Abre e pede câmera/mic; buffer enche; gravar e parar gera clipe com vídeo, áudio e orientação corretos.
- Assistir um clipe no app: áudio sai (a câmera pausa durante o play).
- Offline: com internet desligada o app abre.
- Nada deve ter mudado de comportamento em relação ao `v0.3.7`; qualquer diferença é bug da migração.

## Pendências e perguntas em aberto

- **Pre-roll:** zerar depois de cada clipe (hoje) ou sempre guardar 15/30 s completos mesmo sobrepondo? Sem resposta.
- Pesquisar se já existe app/marca "Ei Clip" antes de fixar o nome.
- Áudio a 16 kHz já foi visto uma vez (provável microfone Bluetooth); não confirmado.
- Pausar a câmera ao assistir clipe apaga o buffer; avaliar `audioSession` na Onda 4 se incomodar.

## Próximo passo

Onda 2 (comando de voz), em um chat novo: pedir ao Claude para ler o repositório (`CLAUDE.md` e `docs/STATUS.md`).
