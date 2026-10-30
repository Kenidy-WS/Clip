# Roadmap por ondas

Uma onda por chat. Em cada uma: Claude entrega, o Kenidy testa no iPhone e aprova, só então começa a próxima.

| Onda | Objetivo                                                                                                      | Estado                                      |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 0    | Protótipo funcional: pre-roll, qualidade, áudio, offline, aviso de atualização                                | Concluída (`v0.3.7`, commit 0e9176b)        |
| 1    | Base profissional: TypeScript + Vite, módulos, testes, lint, CI/deploy, documentação, nome "Ei Clip"          | Concluída e aprovada (`v0.4.0`)             |
| 2    | Comando de voz "Ei Clip": teste de viabilidade no iPhone (vento/ruído) e integração                           | Concluída (`v0.7.0`)                        |
| 3    | Interface, marca e ícone: tela limpa, textos finais, layout ocupando a tela toda, ícone, esconder diagnóstico | 3a feita (`v0.8.0`, em teste); 3b planejada |
| 4    | Polimento e robustez: áudio, permissões, armazenamento; decidir se vale migrar para app nativo                | Planejada                                   |

## Onda 2 — pontos de atenção

- Gatilho "Ei Clip" (três sílabas, no padrão "Hey Siri"). Candidatos: Porcupine Web (palavra personalizada, exige chave de uso pessoal)
  ou Web Speech API (menos confiável no iOS). Fazer primeiro um **teste de viabilidade** isolado.
- O microfone é compartilhado entre gravação e escuta contínua: reaproveitar o mesmo stream.
- Resolver refatoração do estado `S` em serviços se a integração exigir.
- Indicadores mínimos na tela: escutando / comando reconhecido.

## Onda 3 — requisitos do Kenidy

- Tela bem limpa e profissional: é uma câmera com controle por voz, pouca informação na tela.
- Textos simples e formais (prioridade); remover avisos que o usuário final não precisa ver (ex.: "Toque na tela uma vez…").
- Proporção/layout: o preview deve ocupar os espaços corretos (hoje sobra espaço), principalmente no web app instalado.
- Favicon/ícone próprio e marca "Ei Clip".

### Plano da Onda 3 (combinado em 2026-10-29). **3a feita na `v0.8.0`** (ver `docs/STATUS.md`); decisões: Ajustes é uma folha aberta do Início e da Câmera, sair da câmera desliga a captura, preview em tela cheia (`cover`)

Três telas, **sem rolagem** em nenhuma (hoje é uma página só com a galeria embaixo):

1. **Início** (abre com o app, a câmera não liga sozinha): nome, botão grande "Abrir câmera" (é o gesto que liga voz+câmera+áudio),
   últimos clipes em miniaturas, ícone de **Ajustes** (qualidade, buffer 15/30 s, som, voz; diagnóstico "i" escondido aqui).
   Qualidade/buffer saem da tela de câmera.
2. **Câmera** (só gravação, estilo app Câmera do iPhone): imagem em **tela cheia** (`object-fit: cover`/área segura), botão de
   gravar grande embaixo no centro, bolinha de lente 0,5/1× sobre a imagem, trocar câmera e voltar nos cantos, miniatura da
   última gravação (abre a galeria), indicador discreto de buffer e de voz no topo.
3. **Galeria**: grade de clipes; toque abre o player (Salvar/Compartilhar/Excluir). Como é tela própria, parar a captura ao
   assistir (limite do áudio no iOS) vira comportamento natural.

Também na Onda 3: **bloquear zoom** (viewport `user-scalable=no`, `touch-action: manipulation`, `gesturestart` com preventDefault
— hoje o pinch/duplo toque desconfigura a tela), **funcionar em pé e deitado** (Kenidy grava nos dois, principalmente em pé:
layout da câmera precisa girar os controles sem girar o vídeo gravado), imagem da 0,5× hoje aparece menor com faixas pretas
(preview em `contain`; provável causa, confirmar no iPhone), ícone/marca/cores/tipografia (3b, com as referências dele).
Sugestão de divisão: **3a estrutura** (telas, tela cheia, zoom, orientação) e **3b visual** (identidade). Remover textos
técnicos/avisos que o usuário final não precisa ver.

## Ideias futuras

- **Câmera (pedidos do Kenidy, 30/10):** (1) nível/horizonte na tela como o app nativo (sensor de movimento; pede permissão no iOS); (2) toque na tela para focar (o Safari só permite em alguns aparelhos: verificar no iPhone antes); (3) analisar a estabilização de vídeo (o que o Safari entrega e o que dá para fazer).
- **Espelhamento/posição da câmera (dúvida do Kenidy):** conferir como a imagem sai gravada, em especial com a câmera frontal (prévia espelhada x arquivo), orientação em pé/deitado e a 0,5×. Verificar no código (`pump` desenha via canvas) e testar no iPhone.
- **Limite de download x folha de compartilhar:** hoje clipes em disco ≥ 100 MB vão pelo download (2 telas a mais do iOS). Descobrir o maior tamanho que a folha de compartilhar aguenta (RAM antigos, até ~260 MB, funcionavam) e subir o limite (`BIG_DOWNLOAD_BYTES` em `clips-view.ts`).
- **Marca (3b):** ideia do Kenidy: **ponto de exclamação na marca** ("Clip!"). Analisar junto com a identidade visual.

- App nativo em Swift (4K60, estabilização, escolha de lente), compilado por GitHub Actions macOS; expira em 7 dias com Apple ID gratuito.
- Domínio próprio para o endereço do app.
