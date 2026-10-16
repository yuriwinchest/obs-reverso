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

- **Data/autor:** 2026-10-15, Tony / Equipe TONE (Antigravity). Fase A.
- **Pedido (Yuri):** 1) Remover o título que cobria o vídeo ("CRIEI MEU PROPRIO OBS"), pois o título deve ir para o YouTube e não estampar o vídeo. 2) Permitir clicar sobre a telinha da câmera na prévia e arrastá-la livremente para qualquer canto/altura da tela. 3) Dúvida sobre atualização/reinstalação.
- **Feito:**
  - `src/engine/StudioEngine.ts`: removida rotina de desenho invasivo do título/subtítulo no canvas do vídeo; integrado `computePipRect` para renderização fluida do PiP livre.
  - `src/App.tsx`: removido o bloco confuso "Seu nome no vídeo"; adicionado campo opcional "Descrição da transmissão" no painel Destino; implementado drag and drop direto da câmera PiP no canvas com detecção de clique (`isPointInPip`), arrasto delimitado com feedback visual de cursor (`grab`/`grabbing`) e double click para resetar; botões de esquerda/direita sincronizados.
  - `src/engine/pip.ts` + `tests/pip.test.ts`: novo módulo de geometria do PiP (cálculo de retângulo, limites de tela, detecção de clique, clamp de arrasto) com 6 testes unitários.
  - `electron/youtube.ts` + `electron/main.ts` + `src/shared/types.ts`: suporte opcional ao campo `description` no broadcast do YouTube.
  - `src/styles.css`: estilos para `textarea`, cursor `pip-hover` e `pip-dragging`.
- **Validação real:** `tsc --noEmit` ok; `npm test` 43/43 PASS; `npm run build` ok; `check:framing` PASS; `qa:ui` PASS; `smoke` PASS; `package:dir` e `package` ok → `release/OBS-Reverso-Setup-0.1.0.exe`; `check:package` PASS.
- **Próximo passo:** Yuri testar o arrasto da câmera PiP na tela compartilhada, ausência de tarjas no vídeo e opções de inicialização/instalação.

## Penúltima atualização

- **Data/autor:** 2026-10-15, Claude (Claude Code, Opus 5.5), sessão orquestradora. Fase B.
- **Pedido (Yuri):** juntar os três branches no codex/001-estudio-direto, resolver conflitos, testar, gerar instalador e enviar ao GitHub.
- **Feito:** merges de `claude/capa-da-live-4caa5b` (be552d5), `claude/enquadramento-camera-558852` (b9dc871) e `claude/janela-adaptavel-279823` (bc8ba9b). Conflitos: imports em `electron/main.ts` (mantidos os dois) e registros (HANDOFF/arquivo histórico, refeitos a partir das entradas originais de cada branch; capa e enquadramento arquivados em `docs/handoff/2026-10.md`).
- **Validação real (código juntado):** `tsc` ok; `npm test` 37/37; `build` ok; `qa:ui` PASS em 9 tamanhos; `check:segmentation` PASS; `smoke` PASS (inclui queda forçada do encoder); `npm run package` → `release/OBS-Reverso-Setup-0.1.0.exe`; `check:package` PASS no exe; print com câmera simulada mostra prévia grande + bloco Enquadramento.
- **Homologação:** em 2026-10-15 o Yuri reinstalou o Setup e aprovou capa, enquadramento e abertura da janela.
- **Próximo passo:** aguardar o próximo pedido do Yuri; `origin/main` ainda está no commit inicial (atualizar só se ele pedir).

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-10-15 — Câmera PiP arrastável livremente na prévia e remoção de tarja sobre o vídeo (Tony/Antigravity).
- 2026-10-15 — Capa da live, enquadramento da câmera e janela adaptável juntos; instalador novo (Claude).
