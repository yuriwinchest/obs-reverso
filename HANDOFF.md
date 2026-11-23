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

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code, sessão aberta pela orquestradora. Fase A.
- **Pedido (Yuri):** Transmitir no TikTok pelo próprio app, com URL do servidor + chave, sem o TikTok LIVE Studio. Respostas: YouTube e TikTok ao mesmo tempo; 16:9 agora (9:16 fica para depois); ele ainda não tem chave do TikTok; guardar a última chave criptografada.
- **Feito:** `electron/outputs.ts`: `tiktokDestination` (rtmp/rtmps só em tiktok.com, tiktokcdn.com, tiktokcdn-us.com, tiktokcdn-eu.com, tiktokv.com; porta 1935/443; chave sem caracteres que abram outro destino); `checkTarget` revalida cada destino; com dois, a saída usa `tee` com um `fifo` por destino e `onfail=ignore` (um encode; se um cair o outro segue, e o app avisa qual caiu). `electron/tiktokKey.ts` guarda servidor+chave com safeStorage; a tela só recebe o servidor. `main.ts`/`preload.ts`/`types.ts`: IPC `tiktok-status/save/clear` e `youtube`/`tiktok` no broadcast-start. `App.tsx`: "Enviar para" (YouTube/TikTok), cartão do TikTok, revisão antes de entrar e erro sem o prefixo técnico do Electron. `tests/tiktok.test.ts` (6 testes); `scripts/smoke.mjs` manda o ensaio aos dois destinos.
- **Validação real:** ffmpeg com tee contra porta fechada: o destino vivo segue e o morto desiste após as tentativas; os dois mortos encerram o ffmpeg com erro. `tsc` ok; `npm test` 59/59; `smoke` PASS (dois FLV H.264/AAC 1280x720 de 10 s); `package` e `check:package` PASS. A pedido do Yuri, a versão passou a 0.1.2 (`release/OBS-Reverso-Setup-0.1.2.exe`, `check:package` PASS nela); regra de subir a versão a cada instalador no `AGENTS.md`. Print da tela: host estranho recusado, host do TikTok aceito. Não testado contra o TikTok real.
- **Riscos/próximo passo:** os hosts de ingestão do TikTok não estão em página oficial; a lista vem de domínios do TikTok e pode precisar de ajuste quando o Yuri colar a URL real. `rtmp://` sem TLS expõe a chave na rede (é o que o TikTok costuma dar). O TikTok não confirma a live ao app. O Yuri homologa quando a conta liberar a chave; depois, cena vertical 9:16.

## Penúltima atualização

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase B, a partir da live do Yuri.
- **Pedido (Yuri):** A live no YouTube ainda caía com o aviso de 8 s de atraso, já com o instalador novo (19:56) instalado.
- **Feito:** `electron/outputs.ts` agora manda a saída do ffmpeg por um muxer `fifo` (`broadcastOutputArgs`): quando o upload trava, ele descarta pacotes em vez de travar a entrada e reconecta sozinho (até 30 tentativas, de 2 em 2 s). O app avisa "reconectando" pela chegada de linha no stderr, sem repassar o texto, que pode conter a chave. `-flags +global_header` é obrigatório com fifo, senão o FLV sai com H.264 em Annex B e é sondado como vídeo 0x0. O prazo da fila e o watchdog passaram de 8 para 15 s.
- **Validação real:** ensaio do ffmpeg contra porta fechada (segue codificando e tentando de novo); `npm test` 53/53; `smoke` PASS (depois de corrigir o global_header); `package` e `check:package` PASS → instalador das 21:15. Não testado contra o YouTube real.
- **Riscos/próximo passo:** com a chave errada, o app mostra "Sinal enviado" e só acusa a falha depois de ~1 min de tentativas. O Yuri deve instalar e fazer uma live longa. O TikTok foi para uma sessão própria.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-11-22 — Live no TikTok, sozinha ou junto com o YouTube, chave criptografada (Claude).
- 2026-11-22 — Live sobrevive a quedas de rede: fila fifo com reconexão (Claude).
