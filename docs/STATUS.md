# Status

**Atualizado em:** 2026-11-01 · **No ar (`main`):** v0.21.4 · **`estavel`:** v0.21.4 (`9011f10`, validada no iPhone pelo Kenidy em 01/11, inclusive player, Ajustes e troca de clipe)

Histórico completo (o que foi feito, testado e descoberto, versão a versão): [`docs/HISTORICO.md`](HISTORICO.md). Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md). Ondas e ideias: [`ROADMAP.md`](ROADMAP.md). Regras e armadilhas do iOS: `CLAUDE.md`.

## Estado atual do produto

PWA de câmera de ação para iPhone (uso do Kenidy e de amigos, para filmar pesca e postar no TikTok/Instagram). Tudo abaixo funciona e foi validado por ele, exceto o que está em "Testar no iPhone agora".

- **Gravação retroativa:** buffer de 15 ou 30 s; botão vermelho manual (base) e comando de voz (bônus). O pre-roll é zerado depois de cada clipe.
- **Vídeo:** 720p, 1080p ou 4K, 30 ou 60 fps (4K sempre a 30), qualidade de imagem Padrão/Alta/Máxima, lente 1× e 0,5× (traseira ultra-angular, corrigida para o iPhone 17), frontal com espelhamento opcional, nível de horizonte opcional.
- **Gravação longa em disco (padrão):** clipe de até 30 min em MP4 fragmentado no IndexedDB; recuperação automática se o app for encerrado; clipes grandes (≥ 250 MB) saem por download do service worker. Desligável nos Ajustes (volta à gravação em memória, ~90 s).
- **Gravação nunca é descartada:** sair do app, falha de codificador ou de montagem do MP4 salvam o trecho gravado (`salvageRecording`).
- **Voz:** três palavras à escolha nos Ajustes ("Ei Clip", "Câmera, ação", "Ei Câmera"), validadas no iPhone.
- **Sons:** bipe de início/fim em duas notas, volume fixo (hoje "Alto", pico 0,7); opção "Sons no vídeo" (desligada por padrão) soma o bipe ao áudio do clipe.
- **Telas:** Início, Câmera e Galeria, sem rolagem; captura estacionada por 60 s ao sair da câmera. Gestos de borda (voltar/avançar). Marca "Ei Clip" com abertura animada.
- **Galeria:** miniaturas guardadas na gravação, seleção em lote (toque longo e arrasto), compartilhar/excluir vários.
- **Player (estilo Fotos, discreto):** controles próprios sobre vidro claro, data/hora na pílula ("Hoje", "Ontem", dia da semana, depois a data), botão de informações (inclui fluidez em clipes novos), velocidade 1×/1,5×/2×/0,5×, som (abre mudo), download e lixeira; arrastar para baixo fecha; arrastar para os lados troca de clipe.
- **Ajustes:** folha com primeira página essencial (vídeo) e tópicos (Comando de voz, Sons, Câmera, Armazenamento); arrastar para baixo fecha.
- **Infra:** `npm run check` (158 testes) e `npm run e2e` verdes; deploy no GitHub Pages a cada push na `main`; aviso "Nova versão disponível".

## Pendências abertas (por prioridade)

1. **Microfone nasce mudo (pico 0.0000)** com frequência ao abrir a câmera e ao voltar da Galeria depois de ouvir um clipe. O app reinicia o microfone sozinho (~3 s) e a voz espera um toque. **Causa raiz desconhecida.** Descartados: `setAudioSession('play-and-record')`, recarregar a página, `AudioContext` 'playback'. Experimentos propostos, um por vez: (a) câmera primeiro e voz logo depois, no mesmo toque; (b) pedir a ultra-angular já no 1º `getUserMedia`; (c) reutilizar a faixa de áudio viva nos reinícios só de vídeo. Área protegida.
2. **Bipe com chiadinho** no começo e no fim, não constante, ao vivo. Some com a voz desligada (a escuta aberta interfere); o arquivo gravado sai limpo. `pauseVoiceFor` e `BEEP_LEAD_SEC` não resolveram. **Em teste na v0.20.4:** volume 0,9 → 0,7. Se não mudar: pausar a voz por mais tempo antes do bipe ou trocar o bipe do alto-falante por vibração/aviso visual.
3. **Voz às vezes surda** (precisa falar alto): o iOS reconhece pouco e ignora `autoGainControl`. Escuta iniciada sem toque fica muda sem erro; por isso a voz só liga dentro de um toque.
4. **Prévia encolhida** (faixas pretas por menos de 1 s) ao voltar do segundo plano: adiado por decisão do Kenidy; só retomar se ficar frequente (copiar o Diagnóstico na hora, linha "Prévia da câmera").
5. **Postar clipe fragmentado no TikTok/Instagram:** o TikTok abre e toca o clipe, mas postar de verdade ainda não foi feito. Salvar no Rolo está validado com 1,2 GB.
6. **Gravação longa, casos difíceis de simular:** parada por pouco espaço livre (< 300 MB) e limite de 30 min nunca exercitados no iPhone; calor e bateria em sessões de 20 a 30 min não medidos.
7. **Volume do clipe baixo** na Galeria (sessão de áudio do iOS); contorno: salvar no Rolo da Câmera.
8. **Permissões** de câmera e microfone pedidas a cada abertura do app instalado (bug WebKit 280394): sem contorno em código.
9. **Estabilização de vídeo:** a web não expõe controle; não se sabe se o iOS já estabiliza o fluxo. Testar balançando e comparar com o app Câmera (ver ROADMAP).
10. Menores: clipes feitos antes da v0.20.3 e takes recuperados não mostram "Fluidez"; áudio a 16 kHz visto uma vez (provável microfone Bluetooth, não confirmado).

## Testar no iPhone agora

O Kenidy validou o visual e os gestos das versões 0.18 a 0.21.4 (player, pílula de data, Ajustes, trocar de clipe com tela preta curta); a `estavel` avançou para a 0.21.4. Falta só confirmar:

1. **Bipe (0.20.4):** o chiado no começo/fim diminuiu com o volume em 0,7? O volume mais baixo incomoda? Se o chiado seguir igual, a causa é a escuta de voz aberta (pendência 2).
2. **Fluidez (0.20.3):** gravar um clipe novo e abrir os detalhes ("i"): "Fluidez: 30 fps/60 fps".
3. **Download pelo ícone** em clipe pequeno (folha "Salvar vídeo") e grande (download do service worker).

## Próximo passo sugerido

Onda 4 (ver ROADMAP): atacar a pendência 1 (microfone que nasce mudo) com os experimentos propostos, **um por versão e sozinho** (área protegida), comparando o Diagnóstico; ou, se o Kenidy preferir, começar pela pendência 5 (postar um clipe de gravação longa no TikTok/Instagram) ou pelo item de refatoração do estado `S`. Perguntar a ele a prioridade antes de começar.

## Últimas versões

- **v0.21.4** — voltou à troca de clipe das v0.21.1 (tela preta curta, sem piscar): as tentativas com miniatura (v0.21.2 e v0.21.3) foram desfeitas.
- **v0.21.1** — arrasto no player segue a ordem da Galeria (esquerda = próximo, direita = anterior). Correção da 0.21.0.
- **v0.21.0** — trocar de clipe arrastando para os lados no player (animação de saída/entrada, som continua, pontas com tranco).
- **v0.20.3** — "Fluidez" (fps) nos detalhes do clipe; gravada em `ClipRecord.fps`.
- **v0.20.2** — barra de controles do player mais estreita e mais alta; Ajustes: respiro só nos submenus e arrastar para baixo fecha; pílula com "Hoje"/"Ontem"/dia da semana.

Antes disso (v0.18 a v0.20.1: player estilo Fotos, vidro, Ajustes em tópicos, palavra de ativação v0.17.0, lente do iPhone 17 v0.16.5) está no [`HISTORICO.md`](HISTORICO.md).

## Decisões de produto vigentes

- **Base = pré-gravação + botão manual; a voz é bônus.** Voz e botão evoluem juntos, mas a falha da voz nunca pode atrapalhar o botão nem perder gravação.
- **Palavras de ativação:** "Ei Clip" (padrão), "Câmera, ação" e "Ei Câmera", para vários celulares perto não dispararem uns aos outros. Não usar palavras do hobby (o app não é só de pesca); descartadas "Ei Peixe", "Ei Capitão", "Ei Anzol"; reservas em ROADMAP. Não dá para reconhecer a voz de cada pessoa (Web Speech do iOS).
- **Design minimalista e discreto**, no padrão da Fotos do iPhone: vidro claro só sobre imagem, ícones brancos pequenos (alvos de toque ≥ 44 px), sem textos técnicos para o usuário final, tom simples e formal. Direção da marca: claquete amarela sobre preto (`docs/design/`).
- **Gravação longa em disco é o padrão** (até 30 min); a gravação em memória (~90 s) é plano B nos Ajustes.
- **PWA primeiro:** a decisão entre continuar PWA ou migrar para app nativo (Swift) foi **adiada de propósito** até o web app estar bem feito (Onda 4).
- **Proteção contra regressão:** área protegida (voz e microfone) só muda sozinha numa versão; `estavel` só avança com a confirmação do Kenidy; nunca reescrever o histórico da `main`.
- **Fluxo de entrega:** com `check` e `e2e` verdes, push direto na `main`, avisando versão e o que testar. Ele testa no iPhone e cola o Diagnóstico ("i" → Copiar) e prints quando algo falha.
- **Amigos testam o link:** qualquer push na `main` chega a todos (aviso "Nova versão"); publicar só com `check` + `e2e` verdes.
