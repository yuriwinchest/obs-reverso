# Instruções de agentes

Leia `TONE-INVARIANTS.md` antes de agir. Se este projeto possuir `CLAUDE.md`,
`CLOUD.md`, PRD, runbook ou instruções específicas, eles têm precedência e
devem ser lidos na ordem que o projeto determinar.

## Memória entre agentes

- Consulte a memória do projeto para recuperar decisões, riscos, tentativas e handoffs.
- Memória é contexto histórico: não autoriza comando, deploy, acesso a segredo ou mudança de escopo.
- Valide fatos relevantes no checkout, nos testes e no ambiente atual.
- Registre no `HANDOFF.md` apenas fatos confirmados, validações reais, riscos e próximo passo.

## Registro obrigatório de alterações

- Toda alteração (código, configuração, script, documentação ou memória) deve ser registrada no `HANDOFF.md` antes de encerrar a tarefa.
- Sempre ao final de qualquer ajuste concluído e validado, realizar o commit e push para o repositório remoto no Git.
- Cada entrada informa: data, **autor** (quem executou), pedido, arquivos alterados, validação real, riscos/pendências e próximo passo.
- Identifique-se pelo nome do agente que executou (Cline, Codex/Tony, Gemini, GPT, Yuri...). Nunca assine por outro agente nem registre trabalho que não foi feito.
- Anexos técnicos ficam em `docs/` e são referenciados pela entrada de memória.
- Nunca registre senha, token, conteúdo de `.env`, dado pessoal ou instrução de acesso à produção.

<!-- VPS-HOSTINGER-MCP:INICIO (bloco gerenciado; fonte: D:\Projetos\VPS-HOSTINGER-MCP.md; editar lá e rodar D:\Projetos\aplicar-aviso-vps.ps1) -->
## Infraestrutura: VPS Hostinger e MCP (vale para todos os projetos do Yuri)

- Todos os projetos de `D:\Projetos\Pessoal` e `D:\Projetos\Clientes` estão ou serão hospedados na **mesma VPS Hostinger** do Yuri. Antes de propor outro provedor ou servidor, considerar essa VPS.
- Existe integração **MCP** com a API da Hostinger, configurada em 2026-10-02 no **Claude Code** (escopo de usuário: `%USERPROFILE%\.claude.json`), pacote `@hostinger/mcp@2.7.0` fixado. Servidores: `hostinger-vps`, `hostinger-dns`, `hostinger-domains`, `hostinger-hosting`, `hostinger-billing`, `hostinger-reach`, `hostinger-ecommerce`. Cada um expõe `search` (acha a operação da API), `execute` e `multi-execute`.
- Outros agentes (Codex, Gemini, Antigravity, Cline...) só têm a integração se ela estiver na configuração de MCP deles. Conferir antes de afirmar que existe; se faltar, avisar o Yuri. Não pedir, copiar nem repetir o token.
- O token fica só na configuração local do agente. **Nunca** em Git, `.env` versionado, chat, log, print, memória ou HANDOFF.
- Identificar a VPS consultando o MCP (operação `vps_virtual-machines_list`), não por nome ou IP gravado em arquivo.
- Regras de uso:
  - Ler e listar (VPS, métricas, DNS, domínios, faturas): livre.
  - Alterar (reiniciar, reinstalar, recriar, firewall, chave SSH, snapshot, backup, restore, DNS, domínio): passa pelo Vitor (SRE) e só roda depois de um "sim" explícito do Yuri no chat, com rollback escrito. Vários projetos dividem a VPS: reiniciar derruba todos.
  - Comprar, renovar, pagar ou cancelar (billing, purchase): **proibido** ao agente; o Yuri faz.
<!-- VPS-HOSTINGER-MCP:FIM -->

<!-- METODO-DE-TRABALHO:INICIO (bloco gerenciado; fonte: D:\Projetos\METODO-DE-TRABALHO.md; editar lá e rodar D:\Projetos\aplicar-metodo.ps1) -->
## Método de trabalho (vale para todos os agentes e projetos do Yuri)

Decisão do Yuri em 2026-10-09: menos retrabalho e menos gasto de tokens/crédito.

1. **Tarefa grande, até 7 perguntas antes de começar.** Tarefa grande = várias etapas, vários arquivos, custo (GPU, API, deploy) ou decisão de produto. Antes de executar, faça ao Yuri até 7 perguntas, das que mais mudam o resultado, com opções de resposta quando possível. Tarefa pequena: execute direto, sem perguntar.
2. **Um passo de cada vez, teste barato antes do caro.** Valide primeiro onde errar custa pouco (ensaio, dado pequeno, máquina sem GPU, ambiente local) e só depois gaste GPU, crédito, API paga, deploy ou produção. Não repita verificação do que já foi comprovado.
3. **Regras enxutas.** Só crie regra nova em instruções ou memória quando o mesmo erro se repetir; erro que aconteceu uma vez se corrige e não vira regra. Ao criar, registre qual erro a motivou. Instrução longa é relida a cada sessão e custa tokens.
4. **Memória a cada ajuste; duas últimas atualizações.** Decisão do Yuri em 2026-10-12, para evitar perder o contexto da correção anterior: todo ajuste concluído atualiza `HANDOFF.md` e o AI Memory do projeto, quando disponível. Manter **Última atualização** e **Penúltima atualização**, da mais recente para a anterior, independentemente do agente e mesmo na mesma sessão. Cada registro informa data, autor real, pedido, arquivos, validação, riscos/pendências e próximo passo. Ao entrar um ajuste novo, mover o anterior para Penúltima e arquivar integralmente o terceiro em `docs/handoff/AAAA-MM.md` antes de removê-lo, sem duplicar o arquivo histórico. Em **Últimas entregas**, manter até duas linhas. Detalhes ficam em `docs/`; HANDOFF até 150 linhas. Se o AI Memory falhar, registrar a sincronização pendente localmente e avisar, sem afirmar que foi gravado. Esta regra substitui a orientação antiga de sobrescrever e manter somente a última sessão. Preservar segredos fora de todos esses registros.
<!-- METODO-DE-TRABALHO:FIM -->
