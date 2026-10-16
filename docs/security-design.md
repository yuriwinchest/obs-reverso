# Segurança de desenho — Fase A

Revisão pontual executada por Codex/Crowley em 15/10/2026. Escopo: ponte Electron, saídas, OAuth e ciclo de transmissão. Não é a auditoria formal da Fase C e não substitui homologação funcional.

## Fronteiras implementadas

- Renderer sem Node, isolado e sandboxed; preload expõe métodos específicos.
- IPC valida janela, frame principal e URL exata do aplicativo; links externos aceitam somente destinos internos predefinidos. Webviews e novas janelas bloqueados.
- Destino de transmissão aceita somente RTMPS nos hosts YouTube permitidos, caminho live2, sem usuário/senha/query. Chave aceita alfabeto restrito; FFmpeg usa argumentos separados e `shell: false`.
- Diagnósticos do FFmpeg não chegam a logs/UI porque podem conter a URL completa. A chave não é persistida pelo aplicativo.
- OAuth abre consentimento no navegador do sistema; callback escuta somente 127.0.0.1, porta efêmera, estado aleatório e PKCE S256. Tokens e credenciais são persistidos com Electron safeStorage; indisponibilidade do armazenamento protegido impede conexão.
- Gravação e transmissão têm sessões e filas próprias, teto de bytes e sequência validada. O arquivo parcial é mantido quando a finalização falha.
- Capa da live (15/10/2026, Claude): o renderer não envia bytes nem caminho. O main abre o diálogo, recusa arquivo > 2 MB antes de ler, aceita só assinatura JPEG/PNG, guarda os bytes em memória e devolve apenas nome do arquivo e data URL de prévia. Envio ao YouTube só no modo conta, em paralelo ao encoder; recusa vira aviso e não interrompe a live.

## Correções nesta revisão

- Leitura inicial de credenciais concorrente aguarda uma promessa única.
- Refresh em voo não restaura tokens após desconexão; operações de persistência da sessão são serializadas.
- Confirmação de live verifica a sessão depois de consultar ingestão; encerramento aguarda uma transição já solicitada e consulta o estado remoto antes de concluir.
- Falha ao encerrar no YouTube rejeita a operação, com mensagem para conferir no Studio; não é apresentada como encerramento confirmado.
- Fechamento durante diálogo de gravação ou preparação de live não inicia nova saída. Preparação de live em voo é aguardada e recursos recém preparados são descartados se possível. Falha de descarte é informada.

## Validação real desta revisão

`npx tsc --noEmit` passou. `npm test` passou com 14 testes em 15/10/2026, incluindo três novos testes de OAuth: carga concorrente, desconexão durante refresh pendente e callback HTTP loopback com estado inválido/consentimento negado/repetição da conexão. Os testes de refresh usam respostas de fixture; o callback usa servidor HTTP local real. Não houve conexão com canal nem transmissão real nesta revisão.

## Limites e pendências

- A URL RTMPS completa contém a chave nos argumentos do processo FFmpeg. Ferramentas locais com acesso ao processo podem lê-la. A proteção atual cobre persistência e mensagens, não inspeção de processos ou memória pelo usuário local. Ocultar isso integralmente exige integração nativa com encoder/protocolo; substituir por arquivo temporário apenas muda a superfície de exposição.
- Desconectar remove a sessão local; revogar a autorização do aplicativo na conta Google continua sendo uma ação da conta.
- Encerramento durante uma solicitação Google pode aguardar os timeouts de rede e limpeza remota. Se a rede falhar, conferir recursos e estado da live no YouTube Studio.
- Live privada, consentimento em conta real, controle de encerramento remoto e limites do canal/quota ainda exigem homologação autorizada no canal do Yuri.
- Esta revisão não declara ausência universal de vulnerabilidades nem executou varredura completa das cinco categorias da Fase C.
