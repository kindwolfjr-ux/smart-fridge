export type Unit = "г" | "мл" | "ст. л." | "ч. л.";

export interface RecipeStep {
  order: number;
  action: string;         // краткий заголовок шага
  detail: string;         // развернутое описание: сколько, как, чем
  duration_min?: number;  // по возможности
  temperature_c?: number; // по возможности
}

export interface IngredientItem {
  name: string;           // каноническое имя
  amount: number;         // целое число
  unit: Unit;
  note?: string;          // например: "для варки"
}

export interface Nutrition {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
}

export interface RecipeDto {
  id: string;
  title: string;          // ≤ 6–8 слов
  portion: string;        // например: "2 порции"
  time_min: number;       // суммарное или реалистичное
  equipment: string[];    // инвентарь
  ingredients: IngredientItem[];
  steps: RecipeStep[];    // 3–8 шагов
  tips?: string[];
  nutrition?: Nutrition;
}

export interface RecipesResponse {
  recipes: RecipeDto[];
}
