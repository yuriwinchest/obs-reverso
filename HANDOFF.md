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
- **Pedido (Yuri):** mover a imagem da câmera para cima e para baixo e aumentar/diminuir.
- **Arquivos:** `src/shared/types.ts` (`cameraZoom` 0,5–2, `cameraX`/`cameraY` −0,5–0,5), `src/engine/framing.ts` (novo: matriz, limites, zoom no ponto do cursor, mapeamento object-fit), `src/engine/StudioEngine.ts` (`applyFraming` fora do espelho; fundo virtual fixo, só o recorte se move; fundo Original com base escura), `src/App.tsx` (Fontes → Câmera → Enquadramento: Tamanho, Horizontal, Vertical, Centralizar; na prévia arrastar, roda do mouse e dois cliques), `src/styles.css`, `tests/framing.test.ts`, `scripts/check-framing.mjs` + `npm run check:framing`.
- **Validação real:** `npm test` 20/20; `tsc` ok; `qa:ui` PASS; `check:segmentation` PASS; `check:framing` PASS (câmera simulada do Chromium, perfil isolado): sobra escura no fundo Original, arrastar 128 px → +13%/+8%, roda → 143%, dois cliques centralizam; fundo Dinâmico com máscara **sintética** (elipse, o vídeo falso não tem pessoa) fica fixo e o recorte se desloca. Prints em `artifacts/framing-*.png`.
- **Não validado:** webcam física e pessoa real; câmera no canto (tela compartilhada) não testada em print, só pelo caminho de código; enquadramento não é salvo entre aberturas do app (nenhuma configuração é).
- **Próximo passo:** `npm run package`, Yuri reinstala e homologa com a câmera dele.

## Penúltima atualização

- **Data/autor:** 2026-10-15, Claude (Claude Code, Opus 5.5). Fase B (homologação do Yuri).
- **Pedido (Yuri):** prévia da câmera grande, ocupando toda a coluna esquerda, com as configurações na lateral.
- **Arquivos:** `src/App.tsx` (sem título "Prepare. Aperte. Apareça."; h1 só para leitor de tela; status IA/fps na barra escura da prévia; botões de apresentação + checks numa linha), `src/styles.css` (layout de altura fixa em ≥761 px, prévia flexível, painel rola por dentro; removido teto `100vh - 455px`), `scripts/{qa-ui,smoke,check-segmentation,check-package}.mjs` (perfil isolado `--user-data-dir` em `artifacts/`).
- **Validação real:** `npm test` 14/14; `tsc` ok; `qa:ui` PASS; `check:segmentation` PASS; prints com câmera simulada sem rolagem em 1240×640 (vídeo 652×367, antes ~300×170), 1440×900, 1920×1040, 1060×720.
- **Riscos/pendências:** instalador ainda não regenerado com este layout; Yuri ainda não homologou. Pedidos de capa da live e enquadramento da câmera foram para sessões separadas.
- **Próximo passo:** `npm run package`, Yuri reinstala e confere a prévia.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-10-15 — Enquadramento da câmera: tamanho e posição por slider, arrastar e roda (Claude).
- 2026-10-15 — Prévia da câmera ocupando toda a coluna esquerda (Claude).
