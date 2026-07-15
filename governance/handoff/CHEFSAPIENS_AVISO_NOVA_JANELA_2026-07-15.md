# AVISO DE TRANSIÇÃO — CHEFSAPIENS

**Data:** 15 de julho de 2026  
**Inventário:** `CHEFSAPIENS_HANDOFF_CANONICO_2026-07-15.json`  
**SHA-256:** `a03b13208c94d534606caf6f3ce6cefc6f9b3d1db01b28b56183f14bd16b35d1`

## Cole isto na nova janela

> Estamos continuando o projeto ChefSapiens. Leia primeiro o arquivo `CHEFSAPIENS_HANDOFF_CANONICO_2026-07-15.json` e trate-o como estado canônico de recuperação.
>
> Reancore sem repetir trabalhos concluídos. A autorização cobre apenas homologação. Produção deve permanecer inalterada; promoção é A4 separado e exige autorização explícita.
>
> Estado esperado: monitor v4 verde, `drift_count=0`, Core 1.2.0-rc.1, Portal 1.5, Admin/Cockpit 2.1, Auditoria UI 2.0, Agenda 1.9, rotação validada com 3 arquivos/3 entradas e sem exclusão automática.
>
> Primeiras verificações:
> 1. Ler logs de `chefsapiens-inventory-monitor`.
> 2. Confirmar `DRIFT_V4_COMPLETED status=green count=0`.
> 3. Ler `governance/CHEFSAPIENS_CURRENT_POINTER.json`.
> 4. Não repetir o laboratório de rotação.
> 5. Não afirmar execução sem ID, SHA, log ou status.
>
> Próxima frente: mapa visual, preview das telas e E2E visual assistido da homologação, sem promoção para produção.

🟢 Homologação funcional e governada.  
🟡 E2E visual completo ainda não registrado.  
🔒 Produção sem autorização de promoção.

Preparar não é executar. Enfileirar não é concluir. Sem evidência técnica, não afirmar execução real.
