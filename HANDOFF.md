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

- **Data/autor:** 2026-10-15, Claude (Claude Code, Opus 5.5). Fase A.
- **Pedido (Yuri):** rodar o app, gerar executável instalável e avaliar melhorias.
- **Arquivos:** `package.json` (alvo NSIS, ícone, versões fixas no lugar de `latest`, script `package:dir`), `package-lock.json`, `build/icon.png` (novo), `electron/main.ts` (trava de instância única), `scripts/check-package.mjs` (seletor ambíguo do microfone), `README.md`.
- **Validação real:** `npm test` 14/14; `tsc` ok; `npm run qa:ui` PASS; `npm run package` gerou `release/OBS-Reverso-Setup-0.1.0.exe` (~135 MB, sem assinatura); `npm run check:package` PASS no exe empacotado; abrir o exe duas vezes resultou em uma janela.
- **Não validado:** instalação do Setup na máquina (homologação do Yuri), câmera/microfone físicos, live real (T014/T015).
- **Riscos/pendências:** SmartScreen avisará "editor desconhecido"; `docs/validacao.md` citado no README não existe; `tasks.md` com todas as caixas desmarcadas; nenhum commit ainda.
- **Próximo passo:** Yuri instala o Setup e homologa câmera, fundo e gravação.

## Penúltima atualização

Nenhum ajuste anterior registrado ainda.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-10-15 — Instalador Windows (Setup.exe), ícone, instância única e versões fixas (Claude).
