export type Unit = "г" | "мл" | "ст. л." | "ч. л.";

export interface RecipeStep {
  order: number;
  action: string;
  detail: string;
  duration_min?: number;
  temperature_c?: number;
}

export interface IngredientItem {
  name: string;
  amount: number;
  unit: Unit;
  note?: string;
}

export interface Nutrition {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
}

export interface RecipeDto {
  id: string;
  title: string;
  portion: string;
  time_min: number;
  equipment: string[];
  ingredients: IngredientItem[];
  steps: RecipeStep[];
  tips?: string[];
  nutrition?: Nutrition;
}

export interface RecipesResponse {
  recipes: RecipeDto[];
}
