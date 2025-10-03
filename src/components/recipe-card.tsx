"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export type Recipe = {
  id: string
  title: string
  description: string
  ingredients: string[]
  url: string
}

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">{recipe.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{recipe.description}</p>
        <ul className="text-sm list-disc pl-5 space-y-1">
          {recipe.ingredients.map((i, idx) => (
            <li key={idx}>{i}</li>
          ))}
        </ul>
        <Button className="mt-auto" asChild>
          <a href={recipe.url} target="_blank" rel="noreferrer">
            Открыть рецепт
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
