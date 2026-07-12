# ChefSapiens

**ChefSapiens — inteligência culinária da HomoSapiens.**

Candidato `1.1.0-rc.2` com aplicação web e API culinária reproduzível.

## Capacidades desta entrega

- interface local existente;
- API HTTP versionada em `/v1`;
- ontologia inicial de ingredientes brasileiros e aliases regionais;
- recomendação explicável por despensa, tempo e equipamentos;
- redimensionamento de receitas;
- análise conservadora de alergênicos;
- importação de receitas a partir de texto;
- substituições por função culinária;
- lista de compras com desconto da despensa;
- OpenAPI em `/openapi.json`;
- rate limit, limite de corpo, headers defensivos e API key opcional.

## Executar

```bash
npm test
npm run verify
npm start
```

O serviço responde por padrão em `http://127.0.0.1:8080`.

## Autenticação

Defina `CHEFSAPIENS_API_KEYS` com uma lista separada por vírgulas. Se a variável estiver vazia, a API funciona em modo local sem autenticação.

Nunca versionar chaves reais.

## Aviso de segurança alimentar

A detecção de alergênicos é indicativa. O usuário deve conferir rótulos, composição, manipulação e risco de contaminação cruzada.

## Homologação local

```bash
npm run release:local
```

A execução inicia uma instância efêmera em `127.0.0.1`, exige uma chave de teste somente em memória e valida autenticação, contrato OpenAPI, receitas, ontologia, recomendações, importação, escalonamento, cabeçalhos defensivos e encerramento.

Para o Docker Compose, `CHEFSAPIENS_API_KEYS` deve ser fornecida pelo ambiente. Não registre chaves no repositório.
