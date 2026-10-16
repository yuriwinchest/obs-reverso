# OBS Reverso

Estúdio Windows em português para câmera, microfone, tela, gravação e YouTube. Uma composição visível, sem editor de cenas. Projeto próprio inspirado pelo estudo funcional do OBS; não é um fork nem depende do OBS instalado.

## Instalar
Execute `release\OBS-Reverso-Setup-0.1.0.exe` (gerado por `npm run package`). Instala só para o seu usuário, sem pedir administrador, e cria atalhos na Área de Trabalho e no Menu Iniciar. Desinstale em Configurações → Aplicativos. Como o instalador não tem assinatura comercial, o SmartScreen pode avisar "Editor desconhecido": clique em **Mais informações → Executar assim mesmo**.

## Abrir sem instalar
Clique em **Abrir OBS Reverso.cmd**. Ele prefere o aplicativo em `release/win-unpacked/OBS Reverso.exe` e usa o build de desenvolvimento quando o pacote ainda não existir. O aplicativo e os recursos da IA ficam locais; não há servidor/VPS.

## Usar
1. Ative câmera e microfone. Escolha dispositivos em **Fontes** e confira o medidor.
2. Em **Aparência**, escolha Original, Desfoque, Cor, Sua imagem ou Dinâmico. Fundos dinâmicos são ambientes procedurais animados, sem downloads de imagens. Boa luz ajuda o contorno.
3. **Mostrar minha tela** abre o seletor de janela/tela. A câmera fica no canto; posição/tamanho e volumes ficam em Fontes. Disponibilidade do áudio do sistema depende do Windows/fonte.
4. **Gravar** escolhe um arquivo WebM. A gravação é incremental, independente da live e finalizada com índice/duração sem recodificar. Se a finalização falhar, preserve o `.partial.webm`.
5. Em **Destino**, conecte conta ou cole chave do YouTube. **Entrar ao vivo** abre confirmação; nenhuma transmissão começa automaticamente.

## Conta Google ou chave
O modo chave funciona sem configurar aplicativo OAuth: no YouTube Studio, defina título e privacidade e copie a chave para o campo protegido. A chave fica só nesta sessão. O estado Enviando indica progresso do encoder; confira recebimento no Studio.

Para conectar conta, habilite YouTube Data API v3 no seu projeto Google Cloud e crie cliente OAuth do tipo aplicativo para computador. Importe o JSON em **Configurar conexão Google** e autorize no navegador do sistema. Em modo de teste do Google, inclua sua conta entre os usuários de teste. O aplicativo não inclui credenciais de terceiros. Configuração e tokens ficam cifrados no armazenamento de usuário do Windows, fora deste repositório. A conexão por conta exige canal habilitado para lives e as condições da API Google. Privacidade inicial: **privada**.

## Desenvolver
Node.js 22+ e Windows 64-bit:
```powershell
npm ci
npm run assets
npm run build
npm start
```
Se o npm bloquear o download do runtime Electron durante install scripts: `node node_modules/electron/install.js`. A preparação baixa um modelo MediaPipe pequeno uma vez e copia WASM localmente. Depois, prévia/segmentação/gravação funcionam sem internet.

`npm run dev` abre Vite local + Electron. `npm run package` cria o instalador `release/OBS-Reverso-Setup-<versão>.exe` e a pasta `release/win-unpacked`; `npm run package:dir` gera só a pasta. Na pasta, execute o EXE junto dos demais arquivos. Não mover só o EXE. O pacote local não possui assinatura comercial.

## Verificar
- `npm test`: contratos e regressões de fluxo/arquivos/OAuth, sem credenciais reais.
- `npm run smoke`: Electron real, vídeo/tom sintéticos → ponte → WebM e FFmpeg H.264/AAC local; força queda do encoder e confere continuidade da gravação.
- `npm run check:segmentation`: worker IA real e engine com câmera sintética. Mede execução, não qualidade de contorno humano.
- `npm run qa:ui`: janela mínima, zoom, foco, modal, privacidade e campo protegido.
- `npm run soak`: 5 minutos depois do smoke aprovado no mesmo build; artefatos em `artifacts/`, ignorados no Git.

Perfil inicial: 1280×720, 24 fps, 3 Mbps; segmentação em 256×144 em worker. O computador usado é i5-8265U/UHD 620/16 GB; métricas são observadas, não garantia em todos os dispositivos. Teste físico e transmissão real no canal são aceites separados. Veja [validação](docs/validacao.md), [estudo OBS](docs/estudo-obs.md) e [desenho de segurança](docs/security-design.md).
