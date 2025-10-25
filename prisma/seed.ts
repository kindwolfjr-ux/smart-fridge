// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Фейковая генерация рецепта
  const rg = await prisma.recipeGenerated.create({
    data: {
      userId: null,
      products: { items: ["eggs", "milk", "tomato"] },
      filters: { vegan: false, timeLimitMin: 30 },
      recipesJson: { list: [{ title: "Omelette", steps: ["Beat eggs", "Fry"] }] }
    }
  });

  // 2. Сохранённый рецепт
  const sr = await prisma.savedRecipe.create({
    data: {
      userId: null,
      payloadJson: { title: "Tomato Pasta", steps: ["Boil", "Mix"] },
      customPhotoUrl: null
    }
  });

  // 3. Сессия готовки
  await prisma.cookingSession.create({
    data: {
      userId: null,
      savedRecipeId: sr.id,
      snapshotJson: { title: "Tomato Pasta", step: 1 },
      currentStepIndex: 1,
      timersStateJson: { timer1: { remaining: 120 } }
    }
  });

  // 4. Публичная ссылка
  await prisma.shareLink.create({
    data: {
      slug: "demo-" + Math.random().toString(36).slice(2, 8),
      recipeSnapshotJson: { title: "Omelette (snapshot)" }
    }
  });

  console.log("Seed done ✓");
}

main().finally(() => prisma.$disconnect());
