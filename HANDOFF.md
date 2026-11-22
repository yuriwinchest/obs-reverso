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

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase B, a partir do teste do Yuri ao vivo.
- **Pedido (Yuri):** 1) A live caía com "acumulou mais de 8 segundos de atraso". 2) Mais espaço para a tela. 3) Lado a lado com dois quadros iguais em pé, com o espaço entre eles ajustável.
- **Feito:** `src/engine/backlog.ts` mede a idade do bloco mais antigo; antes contava o tempo desde a última vez que a fila esvaziou e derrubava lives saudáveis (`OutputController.ts`). `layout.ts`: o Foco na tela passa a 992x558; o Lado a lado vira dois quadros de altura total com `splitRatio` (25–80%). `StudioEngine.ts` mostra a tela inteira (contain) ou preenchida, conforme `screenFill`. `App.tsx` ganhou o controle de espaço, os atalhos "Meio a meio" e "Tela grande" e a caixa "Preencher".
- **Validação real:** upload medido em ~22 Mbps no cabo (a rede não era o gargalo); `tsc` ok; `npm test` 52/52; `smoke` PASS; `check:framing` PASS; `package` e `check:package` PASS → `release/OBS-Reverso-Setup-0.1.0.exe` (19:45). O visual do Lado a lado ajustável não foi visto com câmera real.
- **Riscos/próximo passo:** com o PC sobrecarregado de verdade, a proteção de 8 s ainda encerra a live (agora só com atraso real). Falta o Yuri instalar depois da live e homologar a queda, o recorte e a divisão.

## Penúltima atualização

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase A.
- **Pedido (Yuri):** 1) Sobre a tela compartilhada, mostrar só a pessoa, sem o quadro com fundo virtual (eram "três telas"). 2) Áudio picotando no fone Bluetooth e na live/gravação.
- **Feito:** `pipCutout` (padrão ligado) em `types.ts`; `StudioEngine.ts` desenha só a silhueta recortada com sombra no modo Sobreposta e liga a IA de recorte mesmo com fundo Original (`needsMask`/`syncSegmenter`); o microfone é liberado ao silenciar e o modo Automático evita o mic Hands-Free do Bluetooth (`isHandsFreeMic`); `App.tsx` tem a caixa "Só você, sem quadro" e um aviso de mic Bluetooth; `outputs.ts` usa `aresample=async` na live; `tests/microphone.test.ts`.
- **Validação real:** `tsc` ok; `npm test` 49/49; `build` ok; `smoke` PASS; `check:framing` PASS; `qa:ui` FAIL só em 2560x1400, porque os monitores agora são de 1280x720 (ambiente, não código). Recorte e Bluetooth não testados com a câmera e o fone reais.
- **Riscos/próximo passo:** a borda do recorte segue a máscara (cerca de 7 fps) e pode atrasar em movimentos rápidos. Se o único microfone for o do fone, o Windows continua no modo telefone. Falta o Yuri homologar com a câmera e o fone dele.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-11-22 — Live não cai mais por falso atraso; Lado a lado ajustável e tela maior no Foco (Claude).
- 2026-11-22 — Câmera recortada sem quadro sobre a tela e áudio Bluetooth (Claude).
