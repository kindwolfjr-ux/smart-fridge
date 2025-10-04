import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const recipe = {
    title: "Омлет с помидорами и грибами",
    ingredients: [
      "яйца 3 шт",
      "помидоры 150 г",
      "шампиньоны 120 г",
      "лук репчатый 60 г",
      "масло 1 ст. л.",
      "соль",
      "перец"
    ],
    steps: [
      "Нарежьте лук, помидоры и грибы.",
      "Разогрейте сковороду с маслом, обжарьте лук 3–4 мин.",
      "Добавьте грибы, жарьте 5–6 мин до испарения влаги.",
      "Добавьте помидоры, посолите, готовьте 2 мин.",
      "Взбейте яйца, вылейте на сковороду и готовьте 3–4 мин под крышкой."
    ],
    time: "15–20 мин",
    servings: "2 порции"
  };

  return res.status(200).json({ recipes: [recipe], _from: "recipes_test" });
}
