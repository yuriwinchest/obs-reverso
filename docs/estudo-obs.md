# Estudo funcional OBS → OBS Reverso
Data: 2026-10-15. Autor: Codex/Tony. Fase A.

Pedido: simplificar live YouTube, câmera/mic/tela/gravação e fundos sem chroma. Destino: D:\Projetos\Pessoal\OBS Reverso.

## Origem e evidência
OBS é um aplicativo nativo C/C++, com documentação/código públicos. O estudo começou pelo guia oficial https://obsproject.com/kb/quick-start-guide e descrição de captura/composição/codificação em https://github.com/obsproject/obs-studio . Nenhum instalador foi baixado ou executado e nenhum código OBS foi incorporado.

REA 6.3.0 executado via wrapper oficial do projeto engenharia-reversa, offline: `doctor --provider ghidra --json`. Node saudável; Ghidra ausente: GHIDRA_INSTALL_DIR não configurado. Relatório completo fora deste produto em `D:\Projetos\Pessoal\engenharia-reversa\saidas\obs-reverso\rea-doctor-ghidra.json`. Não houve decompilação/inspeção do binário OBS. Ghidra não foi instalado nem configuração MCP alterada.

## Mapa funcional em palavras próprias
| Origem observada | Regra própria | Verificação do produto |
|---|---|---|
| Guia: adicionar fontes de vídeo/áudio | Dispositivos selecionáveis direto na tela | câmera/mic e medidor; teste físico pendente |
| Guia: cenas organizam fontes | composição única interna, sem editor de cenas | câmera ou tela + PiP, mesma saída canvas |
| Guia: separar gravar e transmitir | sessões independentes | ensaio integrado e falha de rede |
| Guia: configurar serviço e chave | painel Destino YouTube e confirmação explícita | RTMPS restrito; OAuth externo necessário |
| Necessidade do Yuri, não extraída do OBS | segmentação IA local e fundos dinâmicos | MediaPipe worker + composição; qualidade física pendente |

## Decisões e limites
Reimplementação própria em Electron, sem libobs. Referência funcional não significa equivalência aos recursos/otimizações OBS. Não reproduzimos marca ou ícones OBS. Nome de trabalho escolhido pelo Yuri; identidade gráfica própria. Bibliotecas e modelo têm atribuições separadas em THIRD-PARTY-NOTICES.md.
