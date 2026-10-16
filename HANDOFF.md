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
- **Pedido (Yuri):** prévia da câmera grande, ocupando toda a coluna esquerda, com as configurações na lateral.
- **Arquivos:** `src/App.tsx` (sem título "Prepare. Aperte. Apareça."; h1 só para leitor de tela; status IA/fps na barra escura da prévia; botões de apresentação + checks numa linha), `src/styles.css` (layout de altura fixa em ≥761 px, prévia flexível, painel rola por dentro; removido teto `100vh - 455px`), `scripts/{qa-ui,smoke,check-segmentation,check-package}.mjs` (perfil isolado `--user-data-dir` em `artifacts/`).
- **Validação real:** `npm test` 14/14; `tsc` ok; `qa:ui` PASS; `check:segmentation` PASS; prints com câmera simulada sem rolagem em 1240×640 (vídeo 652×367, antes ~300×170), 1440×900, 1920×1040, 1060×720.
- **Riscos/pendências:** instalador ainda não regenerado com este layout; Yuri ainda não homologou. Pedidos de capa da live e enquadramento da câmera foram para sessões separadas.
- **Próximo passo:** `npm run package`, Yuri reinstala e confere a prévia.

## Penúltima atualização

- **Data/autor:** 2026-10-15, Claude (Claude Code, Opus 5.5).
- **Pedido (Yuri):** commitar e, como não havia remoto, criar repositório GitHub exclusivo para o projeto.
- **Feito:** commit inicial `edaa869` (81 arquivos); repositório **privado** criado em https://github.com/yuriwinchest/obs-reverso como `origin`; `main` e `codex/001-estudio-direto` enviados.
- **Validação real:** `gh repo create` concluído; varredura de nomes/conteúdo sem segredo antes do commit; `.gitignore` exclui `.env`, credenciais, `node_modules`, `release` e `artifacts`.
- **Riscos/pendências:** instalador não vai para o Git (fica em `release/`); publicar binário exigiria GitHub Release, não feito. Homologação física continua pendente.
- **Próximo passo:** Yuri instala o Setup e homologa câmera, fundo e gravação.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-10-15 — Prévia da câmera ocupando toda a coluna esquerda (Claude).
- 2026-10-15 — Repositório privado yuriwinchest/obs-reverso criado e código enviado (Claude).
