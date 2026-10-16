# Tasks: Estúdio direto
## Setup e base
- [ ] T001 Estudar OBS/REA e registrar docs/estudo-obs.md.
- [ ] T002 Criar package.json, build e tipos src/shared/types.ts.
- [ ] T003 Aplicar fronteiras Electron em electron/main.ts e electron/preload.ts.
## US1 — Compor (P1)
- [ ] T004 [P] [US1] Criar engine captura/composição em src/engine/StudioEngine.ts.
- [ ] T005 [P] [US1] Criar segmentação worker em src/engine/segment.worker.ts e scripts/prepare-assets.mjs.
- [ ] T006 [P] [US1] Criar interface acessível em src/App.tsx e src/styles.css.
## US2 — Gravar (P1)
- [ ] T007 [US2] Criar gravação incremental main e output renderer em electron/outputs.ts e src/engine/OutputController.ts.
## US3 — Transmitir (P1)
- [ ] T008 [US3] Criar encoder limitado em electron/outputs.ts e modo chave validado.
- [ ] T009 [US3] Criar OAuth e API YouTube em electron/youtube.ts e controles destino.
## Validação e entrega
- [ ] T010 Testar contratos/falhas em tests/ e pipeline real com scripts/smoke.mjs.
- [ ] T011 Testar interface, segmentação e ensaio sustentado; registrar docs/validacao.md.
- [ ] T012 Empacotar Windows e criar iniciar.ps1, README.md, THIRD-PARTY-NOTICES.md.
- [ ] T013 Atualizar HANDOFF.md, AI Memory, caso REA e preservar estado Git.
- [ ] T014 [US3] Validar OAuth com conta e live privada real com Yuri (dependência externa).
- [ ] T015 [US1] Homologar recorte, câmera, microfone e áudio desktop físico com Yuri.
## Dependências
T001→T002→T003; T004/T005/T006 podem avançar em arquivos distintos; T007/T008/T009 depois dos contratos; T010–T013 depois da integração. T014/T015 exigem conta/canal/dispositivos/aceite do PO e não são satisfeitas por mocks.
