# Modelo
ProgramConfig: background original|blur|color|image|motion, cor, imagem local, intensidade, espelho, posição/tamanho PiP, título/legenda opcionais.
Capture: câmera, mic, tela e recursos próprios; cada troca encerra tracks anteriores. AudioContext mistura fontes com ganhos independentes.
Metrics: renderFPS, maskFPS, maskMs, micLevel; nunca valores fictícios.
OutputSession: id aleatório, seq monotônica, bytes limitados, estado idle|starting|sending|stopping|error. Escrita só de sessão atual.
Recording: destino escolhido no diálogo; .partial.webm até flush, rename após sucesso. Falha preserva parcial.
YouTube: OAuth configuração desktop e tokens apenas main; canal e broadcastId permitidos no renderer. Live privada padrão; liveConfirmed somente API.
