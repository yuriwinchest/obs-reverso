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

- **Data/autor:** 2026-10-15, Claude (Claude Code, Opus 5.5). Fase B (homologação do Yuri).
- **Pedido (Yuri):** o app deve abrir inteiro em tablet, notebook, PC e TV; estava abrindo cortado e saindo da tela.
- **Causa:** janela fixa 1440×940 com mínimo 1060×720, maior que a área útil de notebooks e telas com escala do Windows.
- **Arquivos:** `electron/windowBounds.ts` (novo, conta pura: ~92% da área útil centralizado, máximo 1440×940, maximiza abaixo de 1440×800, mínimo ≤ área útil, restauração validada, zoom 1,1/1,25 só a partir de 2000/2400 px), `electron/windowState.ts` (novo, lê/grava `window-state.json` no userData com debounce; arquivo ruim é ignorado), `electron/main.ts` (só a criação da janela), `tests/windowBounds.test.ts` (10 testes), `scripts/qa-ui.mjs` (6 tamanhos novos; desmaximiza e fixa a posição antes de medir; falha se a janela não assumir o tamanho pedido; print via `capturePage`). CSS sem mudança: nenhum tamanho cortou.
- **Validação real:** `npm test` 24/24; `tsc` ok; `build` ok; `qa:ui` PASS em 1280×680, 1024×640, 960×540, 800×560, 1920×1040, 2560×1400 (zoom 1,25) e nos 3 antigos (prints `artifacts/ui-*.png`). Nesta máquina (2 monitores 1280×720 DIP, um a 150%) o app abre maximizado e inteiro; restauração exata em cada monitor; JSON corrompido, monitor removido e janela maior que a tela voltam a um tamanho que cabe.
- **Riscos/pendências:** tablet e TV físicos não testados (homologação do Yuri). O qa:ui antigo media a janela errada sem acusar (agora falha). Mover a janela entre monitores de escala diferente faz o Windows reescalar o tamanho (comportamento do sistema). `scripts/qa-ui.mjs` também é alterado pela sessão da capa: conflito pequeno no merge.
- **Próximo passo:** Yuri reinstala o Setup e confere a abertura no notebook, tablet e TV.

## Penúltima atualização

- **Data/autor:** 2026-10-15, Claude (Claude Code, Opus 5.5). Fase B (homologação do Yuri).
- **Pedido (Yuri):** prévia da câmera grande, ocupando toda a coluna esquerda, com as configurações na lateral.
- **Arquivos:** `src/App.tsx` (sem título "Prepare. Aperte. Apareça."; h1 só para leitor de tela; status IA/fps na barra escura da prévia; botões de apresentação + checks numa linha), `src/styles.css` (layout de altura fixa em ≥761 px, prévia flexível, painel rola por dentro; removido teto `100vh - 455px`), `scripts/{qa-ui,smoke,check-segmentation,check-package}.mjs` (perfil isolado `--user-data-dir` em `artifacts/`).
- **Validação real:** `npm test` 14/14; `tsc` ok; `qa:ui` PASS; `check:segmentation` PASS; prints com câmera simulada sem rolagem em 1240×640 (vídeo 652×367, antes ~300×170), 1440×900, 1920×1040, 1060×720.
- **Homologação:** Yuri reinstalou o Setup regenerado (check:package PASS) e aprovou a prévia grande em 2026-10-15. Pedidos de capa da live e enquadramento da câmera foram para sessões separadas.
- **Próximo passo:** integrar as sessões de capa da live e enquadramento da câmera quando concluírem.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-10-15 — Janela abre inteira em qualquer tela e lembra tamanho/posição (Claude).
- 2026-10-15 — Prévia da câmera ocupando toda a coluna esquerda (Claude).
