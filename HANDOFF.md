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

- **Data/autor:** 2026-10-15, Claude (Claude Code, Opus 5.5), sessão orquestradora. Fase B.
- **Pedido (Yuri):** juntar os três branches no codex/001-estudio-direto, resolver conflitos, testar, gerar instalador e enviar ao GitHub.
- **Feito:** merges de `claude/capa-da-live-4caa5b` (be552d5), `claude/enquadramento-camera-558852` (b9dc871) e `claude/janela-adaptavel-279823` (bc8ba9b). Conflitos: imports em `electron/main.ts` (mantidos os dois) e registros (HANDOFF/arquivo histórico, refeitos a partir das entradas originais de cada branch; capa e enquadramento arquivados em `docs/handoff/2026-10.md`).
- **Validação real (código juntado):** `tsc` ok; `npm test` 37/37; `build` ok; `qa:ui` PASS em 9 tamanhos; `check:segmentation` PASS; `smoke` PASS (inclui queda forçada do encoder); `npm run package` → `release/OBS-Reverso-Setup-0.1.0.exe`; `check:package` PASS no exe; print com câmera simulada mostra prévia grande + bloco Enquadramento.
- **Não validado:** capa enviada a canal real (OAuth), webcam física com enquadramento, tablet/TV físicos — homologação do Yuri.
- **Próximo passo:** Yuri reinstala o Setup e homologa capa, enquadramento e abertura da janela.

## Penúltima atualização

- **Data/autor:** 2026-10-15, Claude (Claude Code, Opus 5.5). Fase B (homologação do Yuri).
- **Pedido (Yuri):** o app deve abrir inteiro em tablet, notebook, PC e TV; estava abrindo cortado e saindo da tela.
- **Causa:** janela fixa 1440×940 com mínimo 1060×720, maior que a área útil de notebooks e telas com escala do Windows.
- **Arquivos:** `electron/windowBounds.ts` (novo, conta pura: ~92% da área útil centralizado, máximo 1440×940, maximiza abaixo de 1440×800, mínimo ≤ área útil, restauração validada, zoom 1,1/1,25 só a partir de 2000/2400 px), `electron/windowState.ts` (novo, lê/grava `window-state.json` no userData com debounce; arquivo ruim é ignorado), `electron/main.ts` (só a criação da janela), `tests/windowBounds.test.ts` (10 testes), `scripts/qa-ui.mjs` (6 tamanhos novos; desmaximiza e fixa a posição antes de medir; falha se a janela não assumir o tamanho pedido; print via `capturePage`). CSS sem mudança: nenhum tamanho cortou.
- **Validação real:** `npm test` 24/24; `tsc` ok; `build` ok; `qa:ui` PASS em 1280×680, 1024×640, 960×540, 800×560, 1920×1040, 2560×1400 (zoom 1,25) e nos 3 antigos (prints `artifacts/ui-*.png`). Nesta máquina (2 monitores 1280×720 DIP, um a 150%) o app abre maximizado e inteiro; restauração exata em cada monitor; JSON corrompido, monitor removido e janela maior que a tela voltam a um tamanho que cabe.
- **Riscos/pendências:** tablet e TV físicos não testados (homologação do Yuri). O qa:ui antigo media a janela errada sem acusar (agora falha). Mover a janela entre monitores de escala diferente faz o Windows reescalar o tamanho (comportamento do sistema). `scripts/qa-ui.mjs` também é alterado pela sessão da capa: conflito pequeno no merge.
- **Próximo passo:** Yuri reinstala o Setup e confere a abertura no notebook, tablet e TV.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-10-15 — Capa da live, enquadramento da câmera e janela adaptável juntos; instalador novo (Claude).
- 2026-10-15 — Janela abre inteira em qualquer tela e lembra tamanho/posição (Claude).
