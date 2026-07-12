const RAW_INGREDIENTS = [
  {
    id: "arroz",
    canonical: "arroz",
    aliases: ["arroz branco", "arroz agulhinha"],
    category: "cereal",
    baseUnit: "g",
    allergens: [],
    functions: ["base", "amido"],
    substitutions: ["quinoa", "cuscuz"]
  },
  {
    id: "tomate",
    canonical: "tomate",
    aliases: ["tomates", "tomate italiano", "tomate cereja"],
    category: "hortalica",
    baseUnit: "un",
    allergens: [],
    functions: ["acidez", "umidade", "aroma"],
    substitutions: ["pimentao", "abobora"]
  },
  {
    id: "cebola",
    canonical: "cebola",
    aliases: ["cebolas", "cebola branca", "cebola roxa"],
    category: "hortalica",
    baseUnit: "un",
    allergens: [],
    functions: ["aroma", "base aromatica"],
    substitutions: ["alho-poro", "cebolinha"]
  },
  {
    id: "frango",
    canonical: "frango",
    aliases: ["peito de frango", "coxa de frango", "file de frango"],
    category: "proteina animal",
    baseUnit: "g",
    allergens: [],
    functions: ["proteina"],
    substitutions: ["tofu", "grao-de-bico"]
  },
  {
    id: "lentilha",
    canonical: "lentilha",
    aliases: ["lentilhas"],
    category: "leguminosa",
    baseUnit: "g",
    allergens: [],
    functions: ["proteina", "estrutura"],
    substitutions: ["feijao", "grao-de-bico"]
  },
  {
    id: "cenoura",
    canonical: "cenoura",
    aliases: ["cenouras"],
    category: "hortalica",
    baseUnit: "un",
    allergens: [],
    functions: ["doçura", "estrutura"],
    substitutions: ["abobora", "batata-doce"]
  },
  {
    id: "ovo",
    canonical: "ovo",
    aliases: ["ovos", "ovo de galinha"],
    category: "proteina animal",
    baseUnit: "un",
    allergens: ["ovo"],
    functions: ["estrutura", "emulsificacao", "proteina"],
    substitutions: ["linhaça hidratada", "chia hidratada", "aquafaba"]
  },
  {
    id: "queijo",
    canonical: "queijo",
    aliases: ["queijos", "mussarela", "muçarela", "parmesao"],
    category: "laticinio",
    baseUnit: "g",
    allergens: ["leite"],
    functions: ["gordura", "umami", "estrutura"],
    substitutions: ["tofu firme", "levedura nutricional"]
  },
  {
    id: "batata",
    canonical: "batata",
    aliases: ["batatas", "batata inglesa"],
    category: "tuberculo",
    baseUnit: "un",
    allergens: [],
    functions: ["amido", "estrutura"],
    substitutions: ["mandioca", "batata-doce"]
  },
  {
    id: "banana",
    canonical: "banana",
    aliases: ["bananas", "banana prata", "banana nanica"],
    category: "fruta",
    baseUnit: "un",
    allergens: [],
    functions: ["doçura", "umidade", "estrutura"],
    substitutions: ["manga", "maca cozida"]
  },
  {
    id: "leite",
    canonical: "leite",
    aliases: ["leite integral", "leite desnatado", "leite semidesnatado"],
    category: "laticinio",
    baseUnit: "ml",
    allergens: ["leite"],
    functions: ["umidade", "gordura", "emulsificacao"],
    substitutions: ["bebida de aveia", "bebida de arroz", "bebida de coco"]
  },
  {
    id: "mandioca",
    canonical: "mandioca",
    aliases: ["aipim", "macaxeira"],
    category: "tuberculo",
    baseUnit: "g",
    allergens: [],
    functions: ["amido", "estrutura"],
    substitutions: ["batata", "inhame"]
  },
  {
    id: "grao-de-bico",
    canonical: "grão-de-bico",
    aliases: ["grao de bico", "grao-de-bico", "grãos-de-bico"],
    category: "leguminosa",
    baseUnit: "g",
    allergens: [],
    functions: ["proteina", "estrutura", "emulsificacao"],
    substitutions: ["lentilha", "feijao branco"]
  },
  {
    id: "azeite",
    canonical: "azeite",
    aliases: ["azeite de oliva", "oleo de oliva"],
    category: "gordura",
    baseUnit: "ml",
    allergens: [],
    functions: ["gordura", "aroma", "emulsificacao"],
    substitutions: ["oleo vegetal"]
  },
  {
    id: "alho",
    canonical: "alho",
    aliases: ["dente de alho", "dentes de alho"],
    category: "hortalica",
    baseUnit: "un",
    allergens: [],
    functions: ["aroma"],
    substitutions: ["alho-poro", "cebolinha"]
  },
  {
    id: "macarrao",
    canonical: "macarrão",
    aliases: ["macarrao", "massa", "espaguete", "penne"],
    category: "cereal",
    baseUnit: "g",
    allergens: ["gluten"],
    functions: ["base", "amido"],
    substitutions: ["macarrao sem gluten", "arroz"]
  },
  {
    id: "amendoim",
    canonical: "amendoim",
    aliases: ["amendoins", "pasta de amendoim"],
    category: "oleaginosa",
    baseUnit: "g",
    allergens: ["amendoim"],
    functions: ["gordura", "proteina", "estrutura"],
    substitutions: ["semente de girassol"]
  },
  {
    id: "soja",
    canonical: "soja",
    aliases: ["grao de soja", "proteina de soja", "tofu"],
    category: "leguminosa",
    baseUnit: "g",
    allergens: ["soja"],
    functions: ["proteina", "estrutura"],
    substitutions: ["grao-de-bico", "lentilha"]
  },
  {
    id: "camarao",
    canonical: "camarão",
    aliases: ["camarao", "camarões"],
    category: "fruto do mar",
    baseUnit: "g",
    allergens: ["crustaceos"],
    functions: ["proteina", "umami"],
    substitutions: ["cogumelo", "palmito"]
  },
  {
    id: "peixe",
    canonical: "peixe",
    aliases: ["file de peixe", "tilapia", "sardinha", "salmao"],
    category: "proteina animal",
    baseUnit: "g",
    allergens: ["peixe"],
    functions: ["proteina", "umami"],
    substitutions: ["tofu", "palmito"]
  }
];

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const INGREDIENTS = Object.freeze(
  RAW_INGREDIENTS.map((item) => Object.freeze({
    ...item,
    aliases: Object.freeze([...item.aliases]),
    allergens: Object.freeze([...item.allergens]),
    functions: Object.freeze([...item.functions]),
    substitutions: Object.freeze([...item.substitutions])
  }))
);

const INDEX = new Map();
for (const item of INGREDIENTS) {
  for (const label of [item.id, item.canonical, ...item.aliases]) {
    INDEX.set(normalizeText(label), item);
  }
}

export function resolveIngredient(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (INDEX.has(normalized)) return INDEX.get(normalized);
  return INGREDIENTS.find((item) =>
    normalizeText(item.canonical).includes(normalized) ||
    item.aliases.some((alias) => normalizeText(alias).includes(normalized))
  ) ?? null;
}

export function searchIngredients(query, limit = 10) {
  const normalized = normalizeText(query);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  if (!normalized) return INGREDIENTS.slice(0, safeLimit);

  return INGREDIENTS
    .map((item) => {
      const labels = [item.canonical, ...item.aliases].map(normalizeText);
      const exact = labels.includes(normalized);
      const prefix = labels.some((label) => label.startsWith(normalized));
      const contains = labels.some((label) => label.includes(normalized));
      const score = exact ? 100 : prefix ? 70 : contains ? 40 : 0;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.canonical.localeCompare(b.item.canonical, "pt-BR"))
    .slice(0, safeLimit)
    .map(({ item }) => item);
}

export function detectAllergens(ingredientNames) {
  const detected = new Set();
  const unresolved = [];
  for (const raw of ingredientNames) {
    const item = resolveIngredient(raw);
    if (!item) {
      unresolved.push(String(raw));
      continue;
    }
    item.allergens.forEach((allergen) => detected.add(allergen));
  }
  return {
    allergens: [...detected].sort(),
    unresolved
  };
}
