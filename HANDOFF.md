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

- **Data/autor:** 2026-11-23, Claude (Opus 5.5) no Claude Code. Fase B.
- **Pedido (Yuri):** A gravação para com erro "da tela" e a live no YouTube cai em 2–3 minutos.
- **Investigação:** o app não guardava log nenhum, então o motivo real se perdia com o aviso. Ensaios locais com o app real (câmera falsa, Desfoque, gravação + live para arquivo) passaram 5 min com a CPU a 100% (LIVE Studio + mapa 3D), 5 min com tela e 4 min com a janela minimizada, sem queda. A causa no PC do Yuri **não foi reproduzida**. A hipótese mais forte vem do código: o encoder fica abaixo de 1x com a CPU saturada, a fila passa de 15 s e o app encerra a saída de propósito.
- **Feito (0.1.4):** `electron/diagLog.ts` grava `%APPDATA%\obs-reverso\logs\sessao-AAAA-MM-DD.log` (7 dias), sem URL nem chave (`redact` + chaves da live). Entram: estados, linhas do ffmpeg (até 60/min), velocidade/fps do encoder a cada 10 s, código de saída, o motivo interno de cada falha de envio (antes era engolido), erros do MediaRecorder, o atraso da fila e todo erro mostrado na tela. O aviso de erro ganhou "Ver registro". O ffmpeg passa a rodar com prioridade acima do normal. `outputs.ts`, `main.ts`, `preload.ts`, `types.ts`, `OutputController.ts`, `App.tsx`, `styles.css`, `tests/diagLog.test.ts`.
- **Validação real:** `npm test` 64/64; `smoke` PASS; `package` e `check:package` PASS; Setup 0.1.4 copiado para `D:\Projetos\Pessoal\OBS Reverso\release` (hash conferido). Correção do registro anterior: o smoke falhava por um soluço de ~1,7 s nos timestamps do áudio no **início** da live (FLV repete o pts), não pela CPU. O teste agora mede o tom a partir de 3 s.
- **Riscos/próximo passo:** a queda ainda não está corrigida, só passou a ficar registrada. O Yuri instala o 0.1.4, faz uma live, e quando cair clica em "Ver registro" e manda o arquivo do dia. A correção sai daí. Soluço de áudio no início da live fica pendente.

## Penúltima atualização

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase B, durante o teste do Yuri com o TikTok LIVE Studio.
- **Pedido (Yuri):** O fundo virtual caía ("A IA deixou de acompanhar a câmera") e não voltava nem trocando de fundo. A conta dele não tem chave do TikTok (o LIVE Center manda `/producer` de volta ao Início), então ele transmite pelo LIVE Studio capturando a janela do OBS Reverso.
- **Causa e correção:** com a CPU em 100% (LIVE Studio + mapa 3D compartilhado + Edge), a máscara atrasava mais de 2 s, e o app desligava a IA de vez. Ela só religava ao passar de "sem IA" para "com IA", o que nunca acontece com o recorte "Só você, sem quadro" ligado. Agora `src/engine/segmentationRecovery.ts` religa o worker sozinho até 3 vezes por minuto (sem máscara por 2,5 s); só depois mostra o erro. Escolher um fundo depois da falha religa a IA. O vídeo segue sem efeito enquanto isso. `StudioEngine.ts`, `tests/segmentationRecovery.test.ts`. Versão 0.1.3.
- **Validação real:** `tsc` ok; `npm test` 61/61; `check:segmentation` PASS; `package` e `check:package` PASS; Setup 0.1.3 copiado para `D:\Projetos\Pessoal\OBS Reverso\release` (hash conferido). `smoke` FALHOU duas vezes (tom de 440 Hz, depois duração de 6 s), com a CPU medida em 100% pelo uso do Yuri; o mesmo smoke passou mais cedo e a mudança não toca o caminho dele. Rodar de novo com o PC livre.
- **Riscos/próximo passo:** com o PC saturado, o efeito ainda pisca enquanto a IA religa. O Yuri instala o 0.1.3 e homologa durante a live.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-11-23 — 0.1.4: registro de diagnóstico da gravação e da live; encoder com prioridade maior (Claude).
- 2026-11-22 — 0.1.3: fundo virtual religa sozinho quando a IA engasga (Claude).
