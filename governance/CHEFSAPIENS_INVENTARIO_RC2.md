# INVENTÁRIO OPERACIONAL — ChefSapiens 1.1 RC2

**Produto:** ChefSapiens  
**Desenvolvedora:** HomoSapiens  
**Categoria:** API de inteligência culinária  
**Versão inventariada:** 1.1.0-rc.2  
**Data de consolidação:** 2026-07-12  
**Repositório:** `milenapsa/chefsapiens`  
**Branch observada:** `main`

## 1. Estado consolidado

A ChefSapiens 1.1 RC2 está em fase de publicação controlada do código-fonte e preparação de homologação externa isolada.

Situação confirmada:
- pacote local RC2 validado anteriormente com 73/73 testes;
- README da RC2 publicado no repositório;
- Dockerfile da RC2 publicado;
- docker-compose da RC2 publicado;
- package.json da RC2 publicado;
- motor culinário `api/lib/engine.mjs` publicado;
- produção principal não substituída;
- homologação externa da RC2 ainda não declarada concluída;
- Action pública da ChefSapiens não criada.

## 2. Inventário visível no repositório

- `README.md`
- `BRAND.md`
- `Dockerfile`
- `docker-compose.yml`
- `package.json`
- `api/`
- `ops/`

Arquivo confirmado dentro de `api/`:
- `api/lib/engine.mjs`

Arquivo confirmado dentro de `ops/`:
- `ops/nginx.conf`

## 3. Capacidades funcionais da RC2

- interface web local;
- API HTTP versionada em `/v1`;
- catálogo culinário;
- ontologia inicial de ingredientes brasileiros e aliases regionais;
- recomendação explicável por despensa, tempo e equipamentos;
- redimensionamento de receitas;
- análise conservadora de alergênicos;
- importação de receitas a partir de texto;
- substituições por função culinária;
- lista de compras com desconto da despensa;
- OpenAPI;
- rate limit;
- limite de corpo;
- cabeçalhos defensivos;
- chave de API opcional em ambiente local e obrigatória no Compose de homologação.

## 4. Infraestrutura conhecida

- VPS Hostinger: `1799286`
- IP conhecido: `76.13.226.21`
- sistema: Ubuntu 24.04 LTS
- proxy reverso: Caddy
- produção principal: `homosapiens.id`
- hostname histórico de homologação: `culinaria-hml.homosapiens.id`
- produção deve permanecer intacta durante a homologação RC2.

## 5. Evidências e limitações

Evidências confirmadas nesta consolidação:
- commits reais no GitHub para README, Dockerfile, Compose, package.json e motor culinário;
- snapshot da VPS havia sido validado antes da etapa de publicação;
- o inventário Docker da Hostinger apresentou falha temporária e não é fonte confiável isolada.

Limitações:
- o upload de um arquivo-fonte único foi rejeitado pelo conector;
- a publicação integral está sendo feita por arquivos rastreáveis;
- não há evidência suficiente, neste ponto, para afirmar homologação RC2 online;
- não há evidência de troca da produção.

## 6. Pendências obrigatórias

1. concluir a publicação dos demais arquivos-fonte da RC2;
2. conferir árvore final do repositório;
3. executar novamente testes e verificações sobre a árvore publicada;
4. criar projeto Docker isolado de homologação;
5. configurar hostname exclusivo sem substituir a produção;
6. validar TLS, Caddy, saúde, OpenAPI e recursos estáticos;
7. executar smoke test público;
8. registrar rollback, hashes, commits e evidências;
9. somente depois declarar homologação concluída.

## 7. Regras de segurança

- não versionar chaves reais;
- não expor segredos no chat ou repositório;
- não substituir `homosapiens.id` sem autorização específica;
- não criar Action pública sem gate próprio;
- não afirmar execução sem evidência técnica;
- publicação de código não equivale a publicação em produção.
