# Ei Clip

Câmera de ação para iPhone com **gravação retroativa**: o app guarda na memória os últimos 15 ou 30 segundos e, ao tocar
em gravar, o clipe já começa antes do toque. Roda no navegador (PWA), sem App Store e sem Mac. Em breve: comando de voz "Ei Clip".

## Usar

Abra o endereço do app no Safari do iPhone → Compartilhar → **Adicionar à Tela de Início**. Permita câmera e microfone.
Toque em Gravar e depois em Parar e salvar; em "Salvar / Compartilhar" envie o vídeo ao Rolo da Câmera.

## Desenvolver

```bash
npm ci
npm run dev      # servidor local
npm run check    # typecheck + lint + formatação + testes + build
npm run e2e      # fluxo no Chromium (depois de npm run build)
```

Stack: TypeScript, Vite, Vitest, ESLint, Prettier, WebCodecs, mp4-muxer. Publicação automática no GitHub Pages
(`.github/workflows/deploy.yml`). Detalhes em `docs/ARCHITECTURE.md`; continuidade em `CLAUDE.md` e `docs/STATUS.md`.

## Limites conhecidos

- O app precisa ficar aberto com a tela ligada (limitação do iOS).
- Clipes ficam no IndexedDB do navegador até você excluir; salve no Rolo da Câmera para não depender disso. Máximo de 90 s por gravação.
- Após cada gravação o buffer é zerado: o pre-roll do próximo clipe só tem imagens posteriores ao anterior.
- O iOS pede permissão de câmera e microfone a cada abertura do app instalado (bug do WebKit).
