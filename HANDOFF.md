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

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase B, durante o teste do Yuri com o TikTok LIVE Studio.
- **Pedido (Yuri):** O fundo virtual caía ("A IA deixou de acompanhar a câmera") e não voltava nem trocando de fundo. A conta dele não tem chave do TikTok (o LIVE Center manda `/producer` de volta ao Início), então ele transmite pelo LIVE Studio capturando a janela do OBS Reverso.
- **Causa e correção:** com a CPU em 100% (LIVE Studio + mapa 3D compartilhado + Edge), a máscara atrasava mais de 2 s, e o app desligava a IA de vez. Ela só religava ao passar de "sem IA" para "com IA", o que nunca acontece com o recorte "Só você, sem quadro" ligado. Agora `src/engine/segmentationRecovery.ts` religa o worker sozinho até 3 vezes por minuto (sem máscara por 2,5 s); só depois mostra o erro. Escolher um fundo depois da falha religa a IA. O vídeo segue sem efeito enquanto isso. `StudioEngine.ts`, `tests/segmentationRecovery.test.ts`. Versão 0.1.3.
- **Validação real:** `tsc` ok; `npm test` 61/61; `check:segmentation` PASS; `package` e `check:package` PASS; Setup 0.1.3 copiado para `D:\Projetos\Pessoal\OBS Reverso\release` (hash conferido). `smoke` FALHOU duas vezes (tom de 440 Hz, depois duração de 6 s), com a CPU medida em 100% pelo uso do Yuri; o mesmo smoke passou mais cedo e a mudança não toca o caminho dele. Rodar de novo com o PC livre.
- **Riscos/próximo passo:** com o PC saturado, o efeito ainda pisca enquanto a IA religa. O Yuri instala o 0.1.3 e homologa durante a live.

## Penúltima atualização

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code, sessão aberta pela orquestradora. Fase A.
- **Pedido (Yuri):** Transmitir no TikTok pelo próprio app, com URL do servidor + chave, sem o TikTok LIVE Studio. Respostas: YouTube e TikTok ao mesmo tempo; 16:9 agora (9:16 fica para depois); ele ainda não tem chave do TikTok; guardar a última chave criptografada.
- **Feito:** `electron/outputs.ts`: `tiktokDestination` (rtmp/rtmps só em tiktok.com, tiktokcdn.com, tiktokcdn-us.com, tiktokcdn-eu.com, tiktokv.com; porta 1935/443; chave sem caracteres que abram outro destino); `checkTarget` revalida cada destino; com dois, a saída usa `tee` com um `fifo` por destino e `onfail=ignore` (um encode; se um cair o outro segue, e o app avisa qual caiu). `electron/tiktokKey.ts` guarda servidor+chave com safeStorage; a tela só recebe o servidor. `main.ts`/`preload.ts`/`types.ts`: IPC `tiktok-status/save/clear` e `youtube`/`tiktok` no broadcast-start. `App.tsx`: "Enviar para" (YouTube/TikTok), cartão do TikTok, revisão antes de entrar e erro sem o prefixo técnico do Electron. `tests/tiktok.test.ts` (6 testes); `scripts/smoke.mjs` manda o ensaio aos dois destinos.
- **Validação real:** ffmpeg com tee contra porta fechada: o destino vivo segue e o morto desiste após as tentativas; os dois mortos encerram o ffmpeg com erro. `tsc` ok; `npm test` 59/59; `smoke` PASS (dois FLV H.264/AAC 1280x720 de 10 s); `package` e `check:package` PASS. A pedido do Yuri, a versão passou a 0.1.2 (`release/OBS-Reverso-Setup-0.1.2.exe`, `check:package` PASS nela); regra de subir a versão a cada instalador no `AGENTS.md`. Print da tela: host estranho recusado, host do TikTok aceito. Não testado contra o TikTok real.
- **Riscos/próximo passo:** os hosts de ingestão do TikTok não estão em página oficial; a lista vem de domínios do TikTok e pode precisar de ajuste quando o Yuri colar a URL real. `rtmp://` sem TLS expõe a chave na rede (é o que o TikTok costuma dar). O TikTok não confirma a live ao app. O Yuri homologa quando a conta liberar a chave; depois, cena vertical 9:16.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-11-22 — 0.1.3: fundo virtual religa sozinho quando a IA engasga (Claude).
- 2026-11-22 — Live no TikTok, sozinha ou junto com o YouTube, chave criptografada (Claude).
