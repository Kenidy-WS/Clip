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
Iniciar câmera → esperar o buffer encher → *Gravar* → *Parar e salvar* → *Salvar / Compartilhar* → *Salvar vídeo*.
O botão **i** mostra o diagnóstico (suporte a WebCodecs, resolução real, fps de saída).

## Limites conhecidos
- O app precisa ficar aberto com a tela ligada (limitação do iOS).
- Clipes ficam só na memória da aba; salve antes de fechar. Trava em 3 min por gravação.
- Comando de voz: próxima etapa.
