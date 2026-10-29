# Clip

Câmera com gravação retroativa: o app mantém na memória os últimos 15 ou 30 segundos e, ao tocar em gravar, o clipe já começa antes do toque. Roda no navegador (PWA), sem App Store.

## Como funciona
Câmera/mic → `VideoEncoder` (H.264) + `AudioEncoder` (AAC) → buffer circular em memória → ao gravar, pega o buffer desde o último keyframe antes do corte e continua gravando → ao parar, monta um `.mp4` com `mp4-muxer` (em `vendor/`, sem CDN).

## Publicar (GitHub Pages)
1. Repositório precisa ser **público** (Pages grátis).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. Abrir `https://<usuario>.github.io/<repositorio>/` no Safari do iPhone.
4. Compartilhar → *Adicionar à Tela de Início*.

## Uso
O app já abre pedindo câmera e microfone (toque uma vez na tela para liberar o áudio). Se a câmera estiver parada: Iniciar câmera → esperar o buffer encher → *Gravar* → *Parar e salvar* → *Salvar / Compartilhar* → *Salvar vídeo*.
O botão **i** mostra o diagnóstico (suporte a WebCodecs, resolução real, fps de saída).

## Limites conhecidos
- O app precisa ficar aberto com a tela ligada (limitação do iOS).
- Clipes ficam guardados no IndexedDB do navegador (sobrevivem a fechar o app) até você excluir; salve no Rolo da Câmera para não depender disso. Trava em 90 s por gravação (memória).
- Após cada gravação o buffer é zerado: o pre-roll do próximo clipe só tem imagens posteriores ao anterior.
- Funciona offline depois do primeiro carregamento (service worker, rede primeiro).
- O iOS pede permissão de câmera/microfone a cada abertura (limitação do WebKit, bug 280394).
- Comando de voz: próxima etapa.
