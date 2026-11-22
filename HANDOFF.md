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

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase B.
- **Pedido (Yuri):** Tirar as faixas pretas nas laterais da prévia e dar mais espaço à imagem.
- **Feito:** `App.tsx` usa um ResizeObserver para que a moldura da prévia tenha exatamente a largura 16:9 que a altura permite, sem faixas escuras dentro do quadro. `electron/main.ts` esconde a barra File/Edit/View (`autoHideMenuBar`; volta com Alt) para ganhar altura. O vídeo enviado sempre foi 16:9 e não tinha faixas.
- **Validação real:** `tsc` ok; `npm test` 52/52; o `qa:ui` com capturas em 1920x1040 e 1280x680 mostra a moldura colada ao vídeo (o 2560x1400 falha porque o monitor tem 1280x720); `package` e `check:package` PASS → instalador das 19:56.
- **Próximo passo:** o Yuri instalar e conferir a prévia e o Lado a lado.

## Penúltima atualização

- **Data/autor:** 2026-11-22, Claude (Opus 5.5) no Claude Code. Fase B, a partir do teste do Yuri ao vivo.
- **Pedido (Yuri):** 1) A live caía com "acumulou mais de 8 segundos de atraso". 2) Mais espaço para a tela. 3) Lado a lado com dois quadros iguais em pé, com o espaço entre eles ajustável.
- **Feito:** `src/engine/backlog.ts` mede a idade do bloco mais antigo; antes contava o tempo desde a última vez que a fila esvaziou e derrubava lives saudáveis (`OutputController.ts`). `layout.ts`: o Foco na tela passa a 992x558; o Lado a lado vira dois quadros de altura total com `splitRatio` (25–80%). `StudioEngine.ts` mostra a tela inteira (contain) ou preenchida, conforme `screenFill`. `App.tsx` ganhou o controle de espaço, os atalhos "Meio a meio" e "Tela grande" e a caixa "Preencher".
- **Validação real:** upload medido em ~22 Mbps no cabo (a rede não era o gargalo); `tsc` ok; `npm test` 52/52; `smoke` PASS; `check:framing` PASS; `package` e `check:package` PASS → `release/OBS-Reverso-Setup-0.1.0.exe` (19:45). O visual do Lado a lado ajustável não foi visto com câmera real.
- **Riscos/próximo passo:** com o PC sobrecarregado de verdade, a proteção de 8 s ainda encerra a live (agora só com atraso real). Falta o Yuri instalar depois da live e homologar a queda, o recorte e a divisão.

## Estado inicial

- Projeto recém-adicionado à memória de agentes.
- Registre somente fatos confirmados, decisões, validações reais, riscos e próximo passo.

## Últimas entregas (mais recente primeiro)

- 2026-11-22 — Prévia sem faixas pretas e sem barra de menu (Claude).
- 2026-11-22 — Live não cai mais por falso atraso; Lado a lado ajustável (Claude).
