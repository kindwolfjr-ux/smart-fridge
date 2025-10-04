import { BASIC_ALLOWED, canonicalize, canonicalizeList } from "./food-normalize";

export function buildAllowed(userItems: string[]): Set<string> {
  const canon = canonicalizeList(userItems);
  const allowed = new Set<string>([...canon, ...BASIC_ALLOWED]);
  return allowed;
}

export function titleFromIngredients(ings: { name: string }[]): string {
  // Простой генератор заголовка: "Паста с колбасой", "Паста с солью и маслом"
  const core = ings
    .map(i => i.name)
    .filter(n => !["соль", "перец", "масло", "вода"].includes(n));
  const uniq = Array.from(new Set(core));
  if (uniq.length === 0) return "Простое блюдо";
  if (uniq.length === 1) return capitalize(uniq[0]);
  return `${capitalize(uniq[0])} с ${uniq.slice(1).join(" и ")}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { canonicalize };
