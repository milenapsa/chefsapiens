export const VERSION = "1.1.0-rc.2";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const jsonContent = (schema) => ({
  "application/json": { schema }
});

const errorResponse = (description) => ({
  description,
  content: jsonContent(ref("ErrorEnvelope"))
});

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "ChefSapiens API",
      version: VERSION,
      description: "ChefSapiens — inteligência culinária da HomoSapiens.",
      contact: { name: "HomoSapiens" }
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "Operação" },
      { name: "Ingredientes" },
      { name: "Receitas" },
      { name: "Inteligência culinária" }
    ],
    paths: {
      "/healthz": {
        get: {
          operationId: "getHealth",
          tags: ["Operação"],
          summary: "Saúde do processo",
          responses: {
            "200": {
              description: "Serviço ativo",
              content: jsonContent(ref("Health"))
            }
          }
        }
      },
      "/readyz": {
        get: {
          operationId: "getReadiness",
          tags: ["Operação"],
          summary: "Prontidão do serviço",
          responses: {
            "200": {
              description: "Serviço pronto",
              content: jsonContent(ref("Health"))
            }
          }
        }
      },
      "/v1/ingredients/search": {
        get: {
          operationId: "searchIngredients",
          tags: ["Ingredientes"],
          summary: "Pesquisa a ontologia de ingredientes",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 120 } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } }
          ],
          responses: {
            "200": { description: "Resultados", content: jsonContent(ref("IngredientSearchEnvelope")) },
            "401": errorResponse("Chave ausente ou inválida"),
            "429": errorResponse("Limite excedido")
          }
        }
      },
      "/v1/recipes": {
        get: {
          operationId: "listRecipes",
          tags: ["Receitas"],
          summary: "Lista receitas disponíveis",
          security: [{ ApiKeyAuth: [] }],
          responses: {
            "200": { description: "Receitas", content: jsonContent(ref("RecipeListEnvelope")) },
            "401": errorResponse("Chave ausente ou inválida"),
            "429": errorResponse("Limite excedido")
          }
        }
      },
      "/v1/recipes/{id}": {
        get: {
          operationId: "getRecipe",
          tags: ["Receitas"],
          summary: "Obtém uma receita",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", minLength: 1 } }
          ],
          responses: {
            "200": { description: "Receita", content: jsonContent(ref("RecipeEnvelope")) },
            "401": errorResponse("Chave ausente ou inválida"),
            "404": errorResponse("Receita não encontrada"),
            "429": errorResponse("Limite excedido")
          }
        }
      },
      "/v1/recipes/scale": {
        post: {
          operationId: "scaleRecipe",
          tags: ["Receitas"],
          summary: "Redimensiona uma receita",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              required: ["recipeId", "servings"],
              properties: {
                recipeId: { type: "string", minLength: 1 },
                servings: { type: "integer", minimum: 1, maximum: 100 }
              },
              additionalProperties: false
            })
          },
          responses: {
            "200": { description: "Receita redimensionada", content: jsonContent(ref("RecipeEnvelope")) },
            "400": errorResponse("Entrada inválida"),
            "401": errorResponse("Chave ausente ou inválida"),
            "404": errorResponse("Receita não encontrada"),
            "429": errorResponse("Limite excedido")
          }
        }
      },
      "/v1/recipes/analyze": {
        post: {
          operationId: "analyzeRecipe",
          tags: ["Inteligência culinária"],
          summary: "Normaliza ingredientes e detecta alergênicos indicativos",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              required: ["ingredients"],
              properties: {
                title: { type: "string", maxLength: 200 },
                ingredients: { type: "array", maxItems: 200, items: { type: "string", maxLength: 200 } }
              },
              additionalProperties: true
            })
          },
          responses: {
            "200": { description: "Análise", content: jsonContent(ref("GenericSuccessEnvelope")) },
            "400": errorResponse("Entrada inválida"),
            "401": errorResponse("Chave ausente ou inválida"),
            "429": errorResponse("Limite excedido")
          }
        }
      },
      "/v1/recipes/import": {
        post: {
          operationId: "importRecipeText",
          tags: ["Inteligência culinária"],
          summary: "Importa receita a partir de texto para revisão humana",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              required: ["text"],
              properties: { text: { type: "string", minLength: 1, maxLength: 100000 } },
              additionalProperties: false
            })
          },
          responses: {
            "200": { description: "Prévia para revisão", content: jsonContent(ref("GenericSuccessEnvelope")) },
            "400": errorResponse("Texto inválido ou insuficiente"),
            "401": errorResponse("Chave ausente ou inválida"),
            "429": errorResponse("Limite excedido")
          }
        }
      },
      "/v1/recommendations": {
        post: {
          operationId: "generateRecommendations",
          tags: ["Inteligência culinária"],
          summary: "Gera recomendações explicáveis",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              properties: {
                pantry: { type: "array", maxItems: 500, items: ref("PantryItem") },
                equipment: { type: "array", maxItems: 100, items: { type: "string", maxLength: 80 } },
                exclude: { type: "string", maxLength: 300 },
                maxTime: { type: ["integer", "string"], minimum: 1 },
                diet: { type: "string", maxLength: 40 },
                servings: { type: "integer", minimum: 1, maximum: 100 }
              },
              additionalProperties: false
            })
          },
          responses: {
            "200": { description: "Recomendações", content: jsonContent(ref("GenericSuccessEnvelope")) },
            "400": errorResponse("Entrada inválida"),
            "401": errorResponse("Chave ausente ou inválida"),
            "429": errorResponse("Limite excedido")
          }
        }
      },
      "/v1/substitutions": {
        post: {
          operationId: "suggestSubstitutions",
          tags: ["Inteligência culinária"],
          summary: "Sugere substituições culinárias indicativas",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              required: ["ingredient"],
              properties: {
                ingredient: { type: "string", minLength: 1, maxLength: 120 },
                context: { type: "string", maxLength: 500 }
              },
              additionalProperties: false
            })
          },
          responses: {
            "200": { description: "Sugestões", content: jsonContent(ref("GenericSuccessEnvelope")) },
            "400": errorResponse("Entrada inválida"),
            "401": errorResponse("Chave ausente ou inválida"),
            "404": errorResponse("Ingrediente não reconhecido"),
            "429": errorResponse("Limite excedido")
          }
        }
      },
      "/v1/shopping-lists/generate": {
        post: {
          operationId: "generateShoppingList",
          tags: ["Inteligência culinária"],
          summary: "Gera lista de compras descontando a despensa",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              properties: {
                mealPlan: {
                  type: "array",
                  maxItems: 100,
                  items: {
                    type: "object",
                    required: ["recipeId", "servings"],
                    properties: {
                      recipeId: { type: "string", minLength: 1 },
                      servings: { type: "integer", minimum: 1, maximum: 100 }
                    },
                    additionalProperties: false
                  }
                },
                pantry: { type: "array", maxItems: 500, items: ref("PantryItem") }
              },
              additionalProperties: false
            })
          },
          responses: {
            "200": { description: "Lista", content: jsonContent(ref("GenericSuccessEnvelope")) },
            "400": errorResponse("Entrada inválida"),
            "401": errorResponse("Chave ausente ou inválida"),
            "429": errorResponse("Limite excedido")
          }
        }
      }
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "Obrigatória quando REQUIRE_API_KEY=true ou quando o ambiente possui chaves configuradas."
        }
      },
      schemas: {
        Health: {
          type: "object",
          required: ["ok", "service", "version"],
          properties: {
            ok: { type: "boolean", const: true },
            service: { type: "string", const: "chefsapiens" },
            version: { type: "string" }
          },
          additionalProperties: false
        },
        ErrorEnvelope: {
          type: "object",
          required: ["ok", "error"],
          properties: {
            ok: { type: "boolean", const: false },
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              additionalProperties: false
            }
          },
          additionalProperties: false
        },
        PantryItem: {
          type: "object",
          required: ["name", "unit"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            qty: { type: "number", exclusiveMinimum: 0 },
            quantity: { type: "number", exclusiveMinimum: 0, description: "Alias aceito para qty." },
            unit: { type: "string", enum: ["g", "kg", "ml", "l", "un"] }
          },
          anyOf: [{ required: ["qty"] }, { required: ["quantity"] }],
          additionalProperties: false
        },
        Ingredient: {
          type: "object",
          required: ["id", "canonical", "aliases", "category", "baseUnit", "allergens"],
          properties: {
            id: { type: "string" },
            canonical: { type: "string" },
            aliases: { type: "array", items: { type: "string" } },
            category: { type: "string" },
            baseUnit: { type: "string" },
            allergens: { type: "array", items: { type: "string" } },
            functions: { type: "array", items: { type: "string" } },
            substitutions: { type: "array", items: { type: "string" } }
          },
          additionalProperties: true
        },
        RecipeSummary: {
          type: "object",
          required: ["id", "title", "minutes", "baseServings", "diets", "allergens"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            minutes: { type: "integer" },
            baseServings: { type: "integer" },
            diets: { type: "array", items: { type: "string" } },
            allergens: { type: "array", items: { type: "string" } }
          },
          additionalProperties: true
        },
        GenericSuccessEnvelope: {
          type: "object",
          required: ["ok", "data"],
          properties: {
            ok: { type: "boolean", const: true },
            data: {}
          },
          additionalProperties: false
        },
        IngredientSearchEnvelope: {
          type: "object",
          required: ["ok", "data"],
          properties: {
            ok: { type: "boolean", const: true },
            data: { type: "array", items: ref("Ingredient") }
          },
          additionalProperties: false
        },
        RecipeListEnvelope: {
          type: "object",
          required: ["ok", "data"],
          properties: {
            ok: { type: "boolean", const: true },
            data: { type: "array", items: ref("RecipeSummary") }
          },
          additionalProperties: false
        },
        RecipeEnvelope: {
          type: "object",
          required: ["ok", "data"],
          properties: {
            ok: { type: "boolean", const: true },
            data: { type: "object", additionalProperties: true }
          },
          additionalProperties: false
        }
      }
    }
  };
}
