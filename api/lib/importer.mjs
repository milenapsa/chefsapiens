import { resolveIngredient } from "./ontology.mjs";

const QUANTITY_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|un|unidade|unidades)?\s+(?:de\s+)?(.+)$/i;

function cleanLine(value) {
  return String(value ?? "")
    .replace(/^[-*•]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIngredientLine(line) {
  const cleaned = cleanLine(line);
  const match = cleaned.match(QUANTITY_PATTERN);
  if (!match) {
    const resolved = resolveIngredient(cleaned);
    return {
      source: cleaned,
      quantity: null,
      unit: resolved?.baseUnit ?? null,
      name: resolved?.canonical ?? cleaned,
      ingredientId: resolved?.id ?? null,
      confidence: resolved ? 0.7 : 0.25
    };
  }

  const quantity = Number(match[1].replace(",", "."));
  const rawUnit = (match[2] ?? "").toLowerCase();
  const unit = rawUnit === "unidade" || rawUnit === "unidades" ? "un" : rawUnit || null;
  const rawName = match[3].trim();
  const resolved = resolveIngredient(rawName);

  return {
    source: cleaned,
    quantity,
    unit: unit ?? resolved?.baseUnit ?? null,
    name: resolved?.canonical ?? rawName,
    ingredientId: resolved?.id ?? null,
    confidence: resolved ? 0.95 : 0.5
  };
}

export function importRecipeText(input) {
  const text = String(input?.text ?? "").slice(0, 100_000);
  if (!text.trim()) {
    return {
      ok: false,
      error: { code: "empty_text", message: "Informe o texto da receita." }
    };
  }

  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const title = String(input?.title ?? lines[0] ?? "Receita importada").slice(0, 160);
  const ingredientStart = lines.findIndex((line) => /^ingredientes?$/i.test(line));
  const instructionStart = lines.findIndex((line) => /^(modo de preparo|preparo|instrucoes|instruções)$/i.test(line));

  let ingredientLines = [];
  let instructionLines = [];

  if (ingredientStart >= 0) {
    const end = instructionStart > ingredientStart ? instructionStart : lines.length;
    ingredientLines = lines.slice(ingredientStart + 1, end);
  }

  if (instructionStart >= 0) {
    instructionLines = lines.slice(instructionStart + 1);
  }

  if (!ingredientLines.length) {
    ingredientLines = lines.slice(1).filter((line) => QUANTITY_PATTERN.test(line)).slice(0, 100);
  }

  if (!instructionLines.length) {
    instructionLines = lines
      .slice(1)
      .filter((line) => !QUANTITY_PATTERN.test(line) && !/^ingredientes?$/i.test(line))
      .slice(0, 100);
  }

  const ingredients = ingredientLines.map(parseIngredientLine);
  const unresolved = ingredients.filter((item) => !item.ingredientId).map((item) => item.name);

  return {
    ok: true,
    data: {
      title,
      ingredients,
      instructions: instructionLines,
      reviewRequired: unresolved.length > 0 || ingredients.some((item) => item.quantity == null),
      unresolvedIngredients: unresolved,
      warnings: [
        ...(unresolved.length ? ["Existem ingredientes sem correspondência na ontologia."] : []),
        ...(ingredients.some((item) => item.quantity == null) ? ["Existem ingredientes sem quantidade identificada."] : []),
        "A importação não acessa URLs externas nesta versão; o conteúdo deve ser enviado como texto."
      ]
    }
  };
}
