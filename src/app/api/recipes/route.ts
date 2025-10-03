import { NextResponse } from "next/server"

export async function POST(req: Request) {
  // можно принимать и файл, и текст — что-то одно или сразу оба
  let text = ""
  try {
    const form = await req.formData()
    text = (form.get("text") as string) || ""
    // const image = form.get("image") as File | null // если понадобится
  } catch {
    // если пришёл не multipart — не страшно
  }

  await new Promise((r) => setTimeout(r, 1000))

  // Можем слегка «реагировать» на текст
  const lower = text.toLowerCase()
  const base = [
    {
      id: "1",
      title: "Омлет с сыром и зеленью",
      description: "Быстрый завтрак за 10 минут.",
      ingredients: ["Яйца", "Сыр", "Зелень", "Соль", "Масло"],
      url: "https://eda.ru/recepty/zavtraki",
    },
    {
      id: "2",
      title: "Паста с томатами и чесноком",
      description: "Простой ужин из базовых продуктов.",
      ingredients: ["Спагетти", "Помидоры", "Чеснок", "Оливковое масло"],
      url: "https://eda.ru/recepty/osnovnye-blyuda",
    },
    {
      id: "3",
      title: "Салат с творогом и огурцом",
      description: "Лёгкий салат за 5 минут.",
      ingredients: ["Творог", "Огурец", "Йогурт", "Соль", "Перец"],
      url: "https://eda.ru/recepty/salaty",
    },
  ]

  const filtered =
    lower.includes("яйц") || lower.includes("яица")
      ? base
      : lower.includes("паста") || lower.includes("спагетти")
      ? [base[1], base[0], base[2]]
      : base

  return NextResponse.json({ recipes: filtered })
}
