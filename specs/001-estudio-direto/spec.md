# Feature Specification: Estúdio direto para YouTube
**Feature Branch**: `codex/001-estudio-direto`
**Created**: 2026-10-15
**Status**: Especificado; implementação autorizada pelo Yuri.
**Input**: Estudar OBS com REA, criar app Windows simples em OBS Reverso, fundos sem verde, YouTube conta e chave, tela e gravação. Identidade a definir pela equipe; IA local autorizada.

## User Scenarios & Testing
### User Story 1 — Preparar imagem e áudio (Priority: P1)
Usuário vê câmera, escolhe microfone, recorta o fundo e ajusta composição no mesmo estúdio.
**Why this priority**: composição é a base de toda saída.
**Independent Test**: iniciar câmera/microfone, escolher fundo, observar medidor, compartilhar tela e retornar à câmera.
**Acceptance Scenarios**:
1. Sem permissão, exibir erro acionável e permitir tentar novamente.
2. Com câmera ativa, alternar original/desfoque/cor/ambiente dinâmico/imagem sem cenas.
3. Com tela ativa, mostrar tela com câmera sobreposta e parar no controle do sistema ou aplicativo.
4. Modelo falha: informar e preservar vídeo original com aviso explícito.

### User Story 2 — Gravar a composição (Priority: P1)
Gravar vídeo/áudio localmente com escolha de destino e estado independente da live.
**Why this priority**: resultado inspecionável e recuperável.
**Independent Test**: gravar 10 segundos, parar, abrir arquivo e verificar vídeo/áudio; cancelar diálogo não grava.
**Acceptance Scenarios**: falha da transmissão não para gravação; disco/escrita falha avisa; saída parcial fica recuperável.

### User Story 3 — Transmitir YouTube (Priority: P1)
Escolher chave ou conectar conta e preparar live privada por padrão, revisar e iniciar envio.
**Why this priority**: objetivo principal do produto.
**Independent Test**: envio sintético para receptor local, seguido de live privada no canal autorizado pelo PO.
**Acceptance Scenarios**: rejeitar destino inválido; OAuth sem credenciais explica configuração; consentimento negado/timeout permite recuperar; chave nunca aparece em mensagens; envio não equivale a confirmação do YouTube.

### Edge Cases
Câmera ausente, mic removido, tela encerrada pelo sistema, máscara atrasada, modelo indisponível, fila encoder excedida, chave recusada, API com erro/quota, app fechado com saída ativa, disco cheio e duplo clique em iniciar/parar.

## Requirements
### Functional Requirements
- FR-001: Interface pt-BR com prévia final dominante, seletores de fonte e controles persistentes; sem criação de cenas.
- FR-002: Câmera/microfone selecionáveis, volume/mute e medidor real; captura de tela pelo seletor do sistema.
- FR-003: Segmentar pessoa localmente e compor original, desfoque, cor, imagem escolhida e fundos procedurais animados.
- FR-004: Gravar incrementalmente a saída e finalizar arquivo usável.
- FR-005: Transmitir com chave YouTube por conexão criptografada e com conta por autorização no navegador do sistema.
- FR-006: Indicar separadamente estado de envio, confirmação da plataforma e gravação.
- FR-007: Mostrar desempenho medido; limitar filas e liberar recursos ao parar.
- FR-008: Empacotar aplicativo Windows e documentar início/configuração/limites.
- FR-009: Não publicar live automaticamente na inicialização ou durante testes locais.
### Key Entities
Fontes (dispositivos e tela), Composição (fundo/layout), Gravação (sessão/arquivo), Transmissão (sessão/estado), Conta (consentimento/canal sem credenciais em logs).

## Success Criteria
### Measurable Outcomes
- SC-001: Acessar prévia a partir da abertura com até três ações, quando dispositivos estão autorizados.
- SC-002: Mesmo enquadramento/fundo em prévia, arquivo gravado e saída codificada no teste integrado.
- SC-003: Gravação de 10 segundos decodificável com vídeo e áudio, mesmo após falha de envio.
- SC-004: Ensaio de 5 minutos sem crescimento ilimitado de fila; reportar desempenho no PC real.
- SC-005: Operação de controles por teclado e leitura sem corte em janela 1100x720 e escala 150%.
- SC-006: Live privada confirmada pelo YouTube e aceita pelo Yuri antes de declarar uso real homologado.

## Assumptions
Windows primeiro; internet para instalar dependências e transmitir. Modelo e runtime locais depois de preparados. Conta YouTube habilitada para lives e credenciais desktop Google são dependências externas. Sem convidados/chat nesta versão. 720p como ponto inicial de medição; sem garantia de FPS ou recorte perfeito. Desenvolvimento e testes locais autorizados; transmissão real requer ação explícita do usuário no app.
