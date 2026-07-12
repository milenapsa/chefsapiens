# ChefSapiens

**ChefSapiens — inteligência culinária da HomoSapiens.**

## Estado de versões

- Produção preservada: `1.0`
- Homologação anterior preservada: `1.1.0-rc.2`
- Candidata atual: `1.1.0-rc.3`

A RC3 foi reconstruída sobre a versão 1.0 para preservar o catálogo de 9 receitas, o PWA, o service worker e a interface consolidada, incorporando a API `/v1`, OpenAPI, ontologia culinária, importador conservador e endpoints de saúde.

## Fonte reproduzível da RC3

O pacote canônico está dividido em partes binárias em `release/rc3-parts/`. O `Dockerfile.rc3-hml` concatena as partes, verifica SHA-256 e constrói a imagem.

SHA-256 do pacote:

```text
6232c3bd8d2433f0ca9dad7af08ccaa9e4e559e6b525f9f338ebbd66ce50738b
```

## Verificação

Dentro do pacote extraído:

```bash
npm run release:local
```

Gate local registrado:

- 101 testes aprovados;
- acessibilidade estática aprovada;
- escopo culinário aprovado;
- OpenAPI com 11 operações e 9 schemas;
- varredura de segredos aprovada;
- homologação local aprovada;
- integridade aprovada.

## Governança

Código publicado não significa promoção. A produção 1.0 permanece preservada. A RC3 é destinada à homologação externa isolada e só poderá substituir produção mediante autorização específica, blue-green, smoke público e rollback comprovado.
