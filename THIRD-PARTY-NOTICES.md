# Dependências e origem

OBS Reverso é implementação própria. OBS Studio foi referência funcional via documentação pública; nenhum código/recurso do OBS foi incorporado. OBS Studio: https://github.com/obsproject/obs-studio (GPL-2.0-or-later).

O pacote contém Electron/Chromium/Node e respectivos avisos/LICENÇAS fornecidos na distribuição Electron. Electron: MIT; https://github.com/electron/electron .

Frontend compilado: React (MIT, https://github.com/facebook/react), Lucide (ISC, https://github.com/lucide-icons/lucide), MediaPipe Tasks Vision (Apache-2.0, https://github.com/google-ai-edge/mediapipe). Veja versões exatas em package-lock.json. O modelo Selfie Segmentation Landscape float16 v1 e seu SHA256 estão em public/models/manifest.json; model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf . Sem modelo generativo ou imagem de terceiros incorporada aos fundos.

FFmpeg é executável separado (`resources/ffmpeg.exe`), obtido de ffmpeg-static 5.3.0, distribuição b6.1.1: https://github.com/eugeneware/ffmpeg-static . Pacote ffmpeg-static: GPL-3.0-or-later. FFmpeg é software livre; detalhes da compilação e fontes: https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1 e https://ffmpeg.org/legal.html . A distribuição local inclui avisos em docs/licenses; preserve-os ao redistribuir. ffprobe-static é usado somente nos ensaios de desenvolvimento e não é incorporado ao aplicativo.

Este é um candidato local privado. A eventual distribuição pública deve incluir os textos/avisos e a oferta de código-fonte correspondente exigidos pelas licenças dos binários distribuídos.
