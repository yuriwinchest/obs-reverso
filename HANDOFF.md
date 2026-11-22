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

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase A.
- **Pedido (Yuri):** 1) Sobre a tela compartilhada, mostrar só a pessoa, sem o quadro com fundo virtual (eram "três telas"). 2) Áudio picotando no fone Bluetooth e na live/gravação.
- **Feito:** `pipCutout` (padrão ligado) em `types.ts`; `StudioEngine.ts` desenha só a silhueta recortada com sombra no modo Sobreposta e liga a IA de recorte mesmo com fundo Original (`needsMask`/`syncSegmenter`); o microfone é liberado ao silenciar e o modo Automático evita o mic Hands-Free do Bluetooth (`isHandsFreeMic`); `App.tsx` tem a caixa "Só você, sem quadro" e um aviso de mic Bluetooth; `outputs.ts` usa `aresample=async` na live; `tests/microphone.test.ts`.
- **Validação real:** `tsc` ok; `npm test` 49/49; `build` ok; `smoke` PASS; `check:framing` PASS; `qa:ui` FAIL só em 2560x1400, porque os monitores agora são de 1280x720 (ambiente, não código). Recorte e Bluetooth não testados com a câmera e o fone reais.
- **Riscos/próximo passo:** a borda do recorte segue a máscara (cerca de 7 fps) e pode atrasar em movimentos rápidos. Se o único microfone for o do fone, o Windows continua no modo telefone. Falta o Yuri homologar com a câmera e o fone dele.

## Penúltima atualização

- **Data/autor:** 2026-10-16, Tony / Equipe TONE (Antigravity). Fase A.
- **Pedido (Yuri):** Dividir as telas e colocar lado a lado a imagem da webcam e a tela do monitor compartilhada, em vez de apenas a telinha pequena (PiP) sobreposta.
- **Feito:**
  - `src/engine/layout.ts` + `tests/layout.test.ts`: novo módulo de layouts de apresentação (`pip`, `side-by-side`, `screen-focus`) com cálculo de geometria proporcional 16:9, margens broadcast e alternância de posições (`swapPresentation`), com 4 testes unitários.
  - `src/shared/types.ts`: adicionadas definições de tipo `PresentationLayout`, `presentationLayout` e `swapPresentation` em `ProgramConfig` e `defaultConfig`.
  - `src/engine/StudioEngine.ts`: renderização no canvas em modo split com fundo de estúdio broadcast, recortes arredondados e borda limpa (`#e8e8dc`) quando o layout for diferente de PiP.
  - `src/App.tsx`: controles integrados no dock do palco (`.stage-dock`) e no painel lateral de Compartilhamento ("Disposição das telas" e botão "Inverter posições"); restrição de arrasto PiP somente para o modo sobreposto.
  - `src/styles.css`: estilização de seletor pílula `.presentation-toggle`.
- **Validação real:** `tsc --noEmit` ok; `npm test` 47/47 PASS; `npm run check:framing` PASS; `npm run qa:ui` PASS; `npm run build` ok; `npm run check:package` PASS; `npm run package:dir` ok.
- **Próximo passo:** Yuri testar os modos "Lado a lado" e "Foco na tela" na apresentação com tela compartilhada e webcam ativas.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-11-22 — Câmera recortada sem quadro sobre a tela e correção do áudio picotado com fone Bluetooth (Claude).
- 2026-10-16 — Divisão de telas lado a lado ("Lado a lado" / "Foco na tela") e alternador de posições (Tony/Antigravity).
