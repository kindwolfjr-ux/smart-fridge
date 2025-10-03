import { NextResponse } from "next/server"

export async function POST() {
  await new Promise((r) => setTimeout(r, 1000)) // имитация задержки

  return NextResponse.json({
    recipes: [
      {
        id: "1",
        title: "Омлет с сыром",
        description: "Быстрый завтрак за 10 минут.",
        ingredients: ["Яйца", "Сыр", "Масло"],
        url: "https://eda.ru/recepty/zavtraki",
      },
      {
        id: "2",
        title: "Паста с томатами",
        description: "Простой ужин из базовых продуктов.",
        ingredients: ["Спагетти", "Помидоры", "Чеснок"],
        url: "https://eda.ru/recepty/osnovnye-blyuda",
      },
      {
        id: "3",
        title: "Салат с творогом",
        description: "Лёгкий салат за 5 минут.",
        ingredients: ["Творог", "Огурец", "Йогурт"],
        url: "https://eda.ru/recepty/salaty",
      },
    ],
  })
}
