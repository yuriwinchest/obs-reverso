# Handoff

## Convenção de registro (todos os agentes)

- A cada ajuste concluído, atualizar este arquivo e o AI Memory disponível.
- Manter Última atualização e Penúltima atualização, da mais recente para a anterior, independentemente do autor e mesmo na mesma sessão.
- Antes de retirar a terceira, arquivar seu conteúdo integral em docs/handoff/AAAA-MM.md, sem duplicação.
- Cada registro informa data, autor real, pedido, arquivos alterados, validação, riscos/pendências e próximo passo.
- Últimas entregas tem até duas linhas; este arquivo tem até 150 linhas. Detalhes ficam em docs/.
- Se o AI Memory falhar, registrar sincronização pendente e avisar; registro local não prova sincronização.
- Nunca registrar senha, token, conteúdo de .env, dado pessoal ou instrução de acesso à produção.

## Última atualização

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase B, a partir da live do Yuri.
- **Pedido (Yuri):** A live no YouTube ainda caía com o aviso de 8 s de atraso, já com o instalador novo (19:56) instalado.
- **Feito:** `electron/outputs.ts` agora manda a saída do ffmpeg por um muxer `fifo` (`broadcastOutputArgs`): quando o upload trava, ele descarta pacotes em vez de travar a entrada e reconecta sozinho (até 30 tentativas, de 2 em 2 s). O app avisa "reconectando" pela chegada de linha no stderr, sem repassar o texto, que pode conter a chave. `-flags +global_header` é obrigatório com fifo, senão o FLV sai com H.264 em Annex B e é sondado como vídeo 0x0. O prazo da fila e o watchdog passaram de 8 para 15 s.
- **Validação real:** ensaio do ffmpeg contra porta fechada (segue codificando e tentando de novo); `npm test` 53/53; `smoke` PASS (depois de corrigir o global_header); `package` e `check:package` PASS → instalador das 21:15. Não testado contra o YouTube real.
- **Riscos/próximo passo:** com a chave errada, o app mostra "Sinal enviado" e só acusa a falha depois de ~1 min de tentativas. O Yuri deve instalar e fazer uma live longa. O TikTok foi para uma sessão própria.

## Penúltima atualização

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase B.
- **Pedido (Yuri):** Tirar as faixas pretas nas laterais da prévia e dar mais espaço à imagem.
- **Feito:** `App.tsx` usa um ResizeObserver para que a moldura da prévia tenha exatamente a largura 16:9 que a altura permite, sem faixas escuras dentro do quadro. `electron/main.ts` esconde a barra File/Edit/View (`autoHideMenuBar`; volta com Alt) para ganhar altura. O vídeo enviado sempre foi 16:9 e não tinha faixas.
- **Validação real:** `tsc` ok; `npm test` 52/52; o `qa:ui` com capturas em 1920x1040 e 1280x680 mostra a moldura colada ao vídeo (o 2560x1400 falha porque o monitor tem 1280x720); `package` e `check:package` PASS → instalador das 19:56.
- **Próximo passo:** o Yuri instalar e conferir a prévia e o Lado a lado.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-11-22 — Live sobrevive a quedas de rede: fila fifo com reconexão (Claude).
- 2026-11-22 — Prévia sem faixas pretas e sem barra de menu (Claude).
