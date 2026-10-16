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

## Penúltima atualização

- **Data/autor:** 2026-10-15, Tony / Equipe TONE (Antigravity). Fase A.
- **Pedido (Yuri):** 1) Remover o título que cobria o vídeo ("CRIEI MEU PROPRIO OBS"), pois o título deve ir para o YouTube e não estampar o vídeo. 2) Permitir clicar sobre a telinha da câmera na prévia e arrastá-la livremente para qualquer canto/altura da tela. 3) Dúvida sobre atualização/reinstalação.
- **Feito:**
  - `src/engine/StudioEngine.ts`: removida rotina de desenho invasivo do título/subtítulo no canvas do vídeo; integrado `computePipRect` para renderização fluida do PiP livre.
  - `src/App.tsx`: removido o bloco confuso "Seu nome no vídeo"; adicionado campo opcional "Descrição da transmissão" no painel Destino; implementado drag and drop direto da câmera PiP no canvas com detecção de clique (`isPointInPip`), arrasto delimitado com feedback visual de cursor (`grab`/`grabbing`) e double click para resetar; botões de esquerda/direita sincronizados.
  - `src/engine/pip.ts` + `tests/pip.test.ts`: novo módulo de geometria do PiP com 6 testes unitários.
  - `electron/youtube.ts` + `electron/main.ts` + `src/shared/types.ts`: suporte opcional ao campo `description` no broadcast do YouTube.
  - `src/styles.css`: estilos para `textarea`, cursor `pip-hover` e `pip-dragging`.
- **Validação real:** `tsc --noEmit` ok; `npm test` 43/43 PASS; `npm run build` ok; `check:framing` PASS; `qa:ui` PASS; `smoke` PASS; `package:dir` e `package` ok → `release/OBS-Reverso-Setup-0.1.0.exe`; `check:package` PASS.
- **Próximo passo:** Yuri testar o arrasto da câmera PiP na tela compartilhada, ausência de tarjas no vídeo e opções de inicialização/instalação.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-10-16 — Divisão de telas lado a lado ("Lado a lado" / "Foco na tela") e alternador de posições (Tony/Antigravity).
- 2026-10-15 — Câmera PiP arrastável livremente na prévia e remoção de tarja sobre o vídeo (Tony/Antigravity).
