# Status

**Atualizado em:** 2026-10-29 · **Versão no ar:** 0.4.0 (Onda 1 aprovada) · **Próxima:** Onda 2 (comando de voz)

## Feito

- Protótipo `v0.3.7` validado pelo Kenidy no iPhone: vídeo vertical 1080p, áudio nos clipes (também no player do app),
  pre-roll desde o 1º segundo, sons de início/fim, offline, aviso de atualização, abertura já pedindo câmera/mic.
- Correção na Onda 1: configuração de áudio pendente de uma sessão antiga não sobrescreve mais avisos da sessão nova.
- Onda 1: migração para TypeScript + Vite em módulos (comportamento igual ao `v0.3.7`), nome "Ei Clip" em título,
  manifest e textos, 19 testes unitários, e2e no Chromium, ESLint/Prettier, CI e deploy (GitHub Actions), documentação.
- Código antigo preservado no commit `0e9176b` (tag local `v0.3.7-legado`; a tag não subiu para o GitHub).

## Validação da Onda 1

Aprovada pelo Kenidy no iPhone em 2026-10-29: publicada pelo GitHub Pages (fonte: GitHub Actions), `v0.4.0` no rodapé,
gravação com pre-roll funcionando e áudio captado e salvo na galeria. A branch `onda-1` já foi incorporada à `main`.

## Pendências e perguntas em aberto

- **Pre-roll:** zerar depois de cada clipe (hoje) ou sempre guardar 15/30 s completos mesmo sobrepondo? Sem resposta.
- Pesquisar se já existe app/marca "Ei Clip" antes de fixar o nome.
- Áudio a 16 kHz já foi visto uma vez (provável microfone Bluetooth); não confirmado.
- Pausar a câmera ao assistir clipe apaga o buffer; avaliar `audioSession` na Onda 4 se incomodar.

## Próximo passo

Onda 2 (comando de voz "Ei Clip"), em um chat novo: pedir ao Claude para ler o repositório (`CLAUDE.md` e `docs/STATUS.md`).
Começar pelo teste de viabilidade isolado da palavra de ativação no iPhone (ver `docs/ROADMAP.md`).
