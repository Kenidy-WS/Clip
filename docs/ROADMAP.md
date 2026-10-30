# Roadmap por ondas

Uma onda por chat. Em cada uma: Claude entrega, o Kenidy testa no iPhone e aprova, só então começa a próxima.

| Onda | Objetivo                                                                                                      | Estado                               |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 0    | Protótipo funcional: pre-roll, qualidade, áudio, offline, aviso de atualização                                | Concluída (`v0.3.7`, commit 0e9176b) |
| 1    | Base profissional: TypeScript + Vite, módulos, testes, lint, CI/deploy, documentação, nome "Ei Clip"          | Concluída e aprovada (`v0.4.0`)      |
| 2    | Comando de voz "Ei Clip": teste de viabilidade no iPhone (vento/ruído) e integração                           | Próxima                              |
| 3    | Interface, marca e ícone: tela limpa, textos finais, layout ocupando a tela toda, ícone, esconder diagnóstico | Planejada                            |
| 4    | Polimento e robustez: áudio, permissões, armazenamento; decidir se vale migrar para app nativo                | Planejada                            |

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

## Ideias futuras

- App nativo em Swift (4K60, estabilização, escolha de lente), compilado por GitHub Actions macOS; expira em 7 dias com Apple ID gratuito.
- Domínio próprio para o endereço do app.
