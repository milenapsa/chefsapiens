# ChefSapiens 1.1 RC3 — Canônico de homologação

## Linhagem

- Base funcional: ChefSapiens 1.0
- Camada incorporada: API da 1.1 RC2
- Candidata resultante: 1.1.0-rc.3
- Produção alterada: não
- Homologação RC2 removida: não

## Não regressão comprovada

- 9 receitas preservadas
- PWA e service worker preservados
- interface da 1.0 preservada
- storage v4 preservado
- 101/101 testes aprovados
- OpenAPI: 11 operações e 9 schemas
- integridade: aprovada
- secret scan: aprovado

## Artefato

- Pacote: `release/rc3-parts/chunk-*.bin`
- SHA-256 após concatenação: `6232c3bd8d2433f0ca9dad7af08ccaa9e4e559e6b525f9f338ebbd66ce50738b`
- Dockerfile: `Dockerfile.rc3-hml`
- Compose de referência: `docker-compose.rc3-hml.yml`
- Hostname planejado: `culinaria-rc3-hml.homosapiens.id`

## Regra

Homologação não é produção. A candidata não pode substituir a versão 1.0 sem autorização A4 separada, pós-teste público e rollback disponível.
