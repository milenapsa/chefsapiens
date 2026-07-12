# CHEFSAPIENS — CANÔNICO OPERACIONAL 1.1 RC2

## 1. Identidade

A marca pública do produto é **ChefSapiens**.  
A desenvolvedora é **HomoSapiens**.  
A categoria é **API de inteligência culinária**.  
A assinatura institucional é:

> ChefSapiens — inteligência culinária da HomoSapiens.

Não usar “OmniSapiens”. Não misturar ChefSapiens com Peterle, Uni ou Lex.

## 2. Escopo da versão

A versão canônica desta consolidação é `1.1.0-rc.2`.

A RC2 pode conter:
- aplicação web;
- API HTTP em `/v1`;
- receitas e catálogo culinário;
- ontologia de ingredientes;
- recomendações explicáveis;
- redimensionamento;
- substituições culinárias;
- lista de compras;
- importação textual;
- análise indicativa de alergênicos;
- documentação OpenAPI;
- segurança de transporte e aplicação;
- Docker e homologação isolada.

## 3. Exclusões e avisos

A ChefSapiens:
- não oferece diagnóstico médico;
- não garante ausência de alergênicos;
- não substitui leitura de rótulos;
- não substitui orientação de nutricionista ou médico;
- não deve prometer segurança alimentar absoluta;
- não deve inferir condição clínica;
- não deve expor segredos, chaves ou credenciais.

A análise de alergênicos é indicativa e conservadora. Deve sempre exibir aviso sobre rótulos, composição, manipulação e contaminação cruzada.

## 4. Sequência operacional obrigatória

1. definir;
2. construir;
3. testar;
4. refinar;
5. fechar escopo;
6. declarar prontidão;
7. preparar release;
8. aprovar release;
9. publicar;
10. criar Action somente se houver necessidade e autorização separada.

## 5. Ambientes

### Local
Usado para desenvolvimento, testes e validação funcional.

### Homologação
Deve ser isolada, reversível e ter hostname próprio. Não pode substituir a produção principal.

### Produção
Só pode ser alterada com autorização explícita, revalidação imediata, snapshot válido, rollback e smoke test público.

## 6. Repositório canônico

Repositório: `milenapsa/chefsapiens`  
Branch principal observada: `main`

Arquivos mínimos esperados:
- `README.md`
- `BRAND.md`
- `package.json`
- `Dockerfile`
- `docker-compose.yml`
- `api/`
- `site/`
- `ops/`
- `tests/`
- `scripts/`
- especificação OpenAPI
- inventário e metadados de release

## 7. Gates

### Gate de código
- árvore completa;
- testes aprovados;
- secret scan aprovado;
- OpenAPI validada;
- integridade verificada.

### Gate de homologação
- snapshot válido;
- projeto isolado;
- DNS sem colisão;
- Caddy validado;
- health check;
- smoke público;
- rollback documentado.

### Gate de produção
- autorização explícita distinta;
- alvo confirmado;
- snapshot novo;
- não substituir portal principal por inferência;
- publicação seguida de smoke e evidência.

### Gate de Action
A criação ou publicação de Action não é consequência automática da publicação do código ou da homologação.

## 8. Verdade operacional atual

Confirmado:
- publicação parcial e rastreável da RC2 no GitHub;
- produção principal preservada;
- homologação RC2 ainda não declarada concluída.

Não confirmado:
- árvore integral da RC2 publicada;
- container RC2 ativo;
- DNS/TLS da RC2 validados;
- smoke público da RC2;
- Action da ChefSapiens.

## 9. Regra final

Preparar não é executar.  
Enviar ordem não é concluir.  
Publicar código não é trocar produção.  
Homologar não é publicar em produção.  
Nenhuma conclusão externa pode ser afirmada sem evidência técnica.
