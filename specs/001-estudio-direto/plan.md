# Implementation Plan: Estúdio direto
**Branch**: codex/001-estudio-direto | **Date**: 2026-10-15 | **Spec**: spec.md
## Summary
Desktop Windows, uma composição canvas, segmentação local, áudio mixado, gravação incremental e YouTube RTMPS/OAuth.
## Technical Context
TypeScript/React/Electron/Vite; MediaPipe worker; FFmpeg separado. Arquivos locais, credenciais no main. Testes node:test/tsx e Electron Playwright com saída de vídeo real. Windows 11 i5-8265U/UHD620/16GB. 720p24 inicial; fila até 16MiB, um frame IA pendente. FPS/meta precisa benchmark. Um usuário local, sem servidor/VPS.
## Constitution Check
Pass: sem cenas, sem segredos renderer persistente, sem cópia OBS, sem live automática, estados distinguem confirmação, gravação não depende rede. Reavaliado após pesquisa/contratos: pass, riscos dupla codificação e recorte físico explícitos.
## Project Structure
src/shared (contratos), src/engine (captura/worker/outputs), src/App.tsx/styles.css (UI), electron (main/preload/outputs/youtube), scripts (build/assets/smoke), tests (validação/falhas), docs (origem/evidência).
## Quality gates
Build + testes contratos, arquivo WebM→H264/AAC real e ffprobe, falha rede com gravação intacta, UI teclado/layout, ensaio sustentado. Canal real e câmera física reportados separadamente. Sem deploy, Fase C ou publicação.
## Complexity tracking
Dois MediaRecorder para gravação/live independentes: custo medido, confiabilidade priorizada. Worker IA evita bloquear UI.
