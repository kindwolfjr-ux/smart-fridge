// src/types/recipe.ts

export type Unit =
  | "г"
  | "мл"
  | "шт"
  | "щепотка"
  | "ст.л."
  | "ч.л."
  | "по вкусу"
  | string;

export interface IngredientDto {
  name: string;
  amount?: number | string;
  unit?: Unit;
  note?: string;
}

export interface StepDto {
  order: number;
  action: string;
  detail?: string;
  duration_min?: number;
}

export interface RecipeDto {
  /** Уникальный идентификатор (используется для key в React) */
  id: string;

  /** Название рецепта */
  title: string;

  /** Количество порций */
  portion?: string;

  /** Время приготовления (в минутах) */
  time_min?: number;

  /** Список ингредиентов */
  ingredients: IngredientDto[];

  /** Шаги приготовления */
  steps: StepDto[];
}

export interface RecipesResponse {
  ok?: boolean;
  error?: string;
  recipes: RecipeDto[];
  trace?: unknown;
}
