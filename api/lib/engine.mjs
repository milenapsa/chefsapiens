import { RECIPES } from "../../site/assets/js/catalog.js";
import {
  recommendRecipes,
  scaleRecipe,
  buildShoppingList
} from "../../site/assets/js/domain.js";
import { detectAllergens, resolveIngredient, normalizeText } from "./ontology.mjs";

const MAX_ARRAY = 200;

function clampServings(value, fallback = 2) {
  return Math.min(12, Math.max(1, Number(value) || Number(fallback) || 2));
}


function safeArray(value, limit = MAX_ARRAY) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function safeText(value, max = 200) {
  return String(value ?? "").slice(0, max).trim();
}

function safeQuantity(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function canonicalPantry(rawPantry) {
  return safeArray(rawPantry).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const resolved = resolveIngredient(item.name);
    const name = resolved?.canonical ?? safeText(item.name, 80);
    const qty = safeQuantity(item.qty ?? item.quantity);
    const unit = ["g", "kg", "ml", "l", "un"].includes(item.unit) ? item.unit : resolved?.baseUnit;
    if (!name || !unit || qty <= 0) return [];
    return [{ name, qty, unit }];
  });
}

function canonicalEquipment(value) {
  return [...new Set(safeArray(value, 50).map((item) => safeText(item, 50)).filter(Boolean))];
}

export function listRecipes() {
  return RECIPES.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    minutes: recipe.minutes,
    baseServings: recipe.baseServings,
    diets: recipe.diets,
    allergens: recipe.allergens
  }));
}

export function getRecipe(recipeId) {
  return RECIPES.find((recipe) => recipe.id === recipeId) ?? null;
}

export function scaleRecipeById(recipeId, servings) {
  const recipe = getRecipe(recipeId);
  if (!recipe) {
    return { ok: false, error: { code: "recipe_not_found", message: "Receita não encontrada." } };
  }
  const scaled = scaleRecipe(recipe, clampServings(servings, recipe.baseServings));
  return {
    ok: true,
    data: {
      id: scaled.id,
      title: scaled.title,
      servings: scaled.servings,
      ingredients: scaled.ingredients,
      methods: scaled.methods
    }
  };
}

export function analyzeRecipe(input) {
  const ingredients = safeArray(input?.ingredients, 100)
    .map((item) => typeof item === "string" ? item : item?.name)
    .map((item) => safeText(item, 100))
    .filter(Boolean);

  const detected = detectAllergens(ingredients);
  const normalizedIngredients = ingredients.map((name) => {
    const resolved = resolveIngredient(name);
    return {
      source: name,
      canonical: resolved?.canonical ?? null,
      ingredientId: resolved?.id ?? null,
      category: resolved?.category ?? null,
      baseUnit: resolved?.baseUnit ?? null,
      functions: resolved?.functions ?? [],
      confidence: resolved ? 1 : 0
    };
  });

  return {
    ok: true,
    data: {
      title: safeText(input?.title, 160) || null,
      ingredientCount: ingredients.length,
      ingredients: normalizedIngredients,
      allergens: detected.allergens,
      unresolvedIngredients: detected.unresolved,
      warnings: [
        ...(detected.unresolved.length
          ? ["Há ingredientes não reconhecidos; revise alergênicos e unidades manualmente."]
          : []),
        "A análise de alergênicos é indicativa e não substitui a conferência de rótulos e risco de contaminação cruzada."
      ]
    }
  };
}

export function recommend(input) {
  const pantry = canonicalPantry(input?.pantry);
  const equipment = canonicalEquipment(input?.equipment);
  const filters = {
    exclude: safeText(input?.exclude, 300),
    maxTime: safeText(input?.maxTime, 10),
    diet: safeText(input?.diet, 40),
    servings: clampServings(input?.servings, 2)
  };

  const state = {
    pantry,
    appliances: equipment,
    utensils: []
  };

  const results = recommendRecipes(RECIPES, state, filters).slice(0, 20).map((item) => ({
    recipeId: item.recipe.id,
    title: item.recipe.title,
    score: item.score,
    servings: item.servings,
    minutes: item.recipe.minutes,
    method: item.method ? {
      id: item.method.id,
      label: item.method.label,
      missingEquipment: item.method.missing,
      coverage: Number(item.method.coverage.toFixed(3))
    } : null,
    pantryCoverage: Number(item.pantryCoverage.toFixed(3)),
    missingIngredients: item.missingIngredients,
    partialIngredients: item.pantryPartial,
    explanation: buildExplanation(item)
  }));

  return {
    ok: true,
    data: {
      query: {
        pantryItems: pantry.length,
        equipmentItems: equipment.length,
        servings: filters.servings,
        diet: filters.diet || null,
        maxTime: filters.maxTime || null
      },
      results
    }
  };
}

function buildExplanation(item) {
  const percent = Math.round(item.pantryCoverage * 100);
  const method = item.method?.missing?.length
    ? `O método ${item.method.label} ainda exige ${item.method.missing.join(", ")}.`
    : `O método ${item.method?.label ?? "selecionado"} é compatível com os equipamentos informados.`;
  const missing = item.missingIngredients.length
    ? `Faltam ${item.missingIngredients.length} ingrediente(s) integralmente.`
    : "Nenhum ingrediente está totalmente ausente.";
  return `Compatibilidade estimada de ${percent}% com a despensa. ${method} ${missing}`;
}

export function generateShoppingList(input) {
  const pantry = canonicalPantry(input?.pantry);
  const mealPlan = safeArray(input?.mealPlan, 100).map((entry) => ({
    recipeId: safeText(entry?.recipeId, 80),
    servings: clampServings(entry?.servings, 2)
  })).filter((entry) => getRecipe(entry.recipeId));

  return {
    ok: true,
    data: {
      itemCount: mealPlan.length,
      items: buildShoppingList(mealPlan, RECIPES, pantry, 2)
    }
  };
}

export function suggestSubstitutions(input) {
  const ingredient = resolveIngredient(input?.ingredient);
  if (!ingredient) {
    return {
      ok: false,
      error: {
        code: "ingredient_not_found",
        message: "Ingrediente não reconhecido na ontologia atual."
      }
    };
  }

  const avoid = new Set(safeArray(input?.avoid, 30).map(normalizeText));
  const suggestions = ingredient.substitutions
    .filter((candidate) => !avoid.has(normalizeText(candidate)))
    .map((candidate) => {
      const resolved = resolveIngredient(candidate);
      return {
        ingredient: resolved?.canonical ?? candidate,
        ingredientId: resolved?.id ?? null,
        preservesFunctions: ingredient.functions,
        confidence: resolved ? 0.8 : 0.55,
        note: "A proporção e o resultado dependem da função do ingrediente na receita; revise antes de aplicar."
      };
    });

  return {
    ok: true,
    data: {
      source: ingredient,
      suggestions
    }
  };
}
