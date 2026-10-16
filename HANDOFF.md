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

- **Data/autor:** 2026-10-15, Claude (Claude Code, Opus 5.5), sessão paralela "capa da live". Fase B.
- **Pedido (Yuri):** colocar foto de capa (miniatura) na live do YouTube.
- **Arquivos:** `electron/thumbnail.ts` (novo: validação por assinatura JPEG/PNG e ≤ 2 MB, nome sem caminho, mensagens de recusa, envio que nunca derruba a live), `electron/youtube.ts` (`setThumbnail` → `POST /upload/youtube/v3/thumbnails/set?videoId=`), `electron/main.ts` (IPC `thumbnail-choose`/`thumbnail-clear` com `validateSender`; bytes só no main; envio após o encoder iniciar, só no modo conta), `electron/preload.ts`, `src/shared/types.ts` (`StudioBridge` + `OutputStatus.kind "thumbnail"`; `ProgramConfig` intocado), `src/App.tsx` + `src/styles.css` (seção "Capa da transmissão" no Destino, linha "Capa" na revisão), `scripts/qa-ui.mjs`, `tests/thumbnail.test.ts`.
- **Validação real:** `npm test` 21/21; `tsc` ok; `qa:ui` PASS; script Playwright no app Electron real (perfil isolado, diálogo simulado): arquivo GIF renomeado .png recusado, PNG mostra prévia só com o nome, remover volta ao estado inicial, modo chave mostra orientação + botão do Studio.
- **Docs conferidas:** página oficial `thumbnails.set` (atualizada 2026-10-15) lista `youtube.force-ssl` entre os escopos; aceita JPEG/PNG até 50 MB; 403 = canal sem permissão para miniatura personalizada.
- **Não validado:** envio real ao YouTube (homologação do Yuri com canal); que o ID do broadcast serve como `videoId` é [memória], a página não fala de lives.
- **Riscos/pendências:** conflito previsível de merge no `HANDOFF.md` com a sessão de enquadramento; capa fica só em memória (some ao fechar o app).
- **Próximo passo:** juntar no branch de trabalho, gerar instalador e o Yuri testa uma live privada com capa.

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

- 2026-10-15 — Capa (miniatura) da live no Destino, enviada no modo conta (Claude).
- 2026-10-15 — Prévia da câmera ocupando toda a coluna esquerda (Claude).
