"use client"

import { useEffect, useRef, useState } from "react"
import UploadZone from "@/components/upload-zone"
import RecipeCard, { type Recipe } from "@/components/recipe-card"
import { Progress } from "@/components/ui/progress"
import ManualInput from "@/components/manual-input"

export default function HomeClient() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (loading) {
      setProgress(10)
      timerRef.current = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 8 : p))
      }, 150)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setProgress(100)
      const t = setTimeout(() => setProgress(0), 300)
      return () => clearTimeout(t)
    }
  }, [loading])

  async function requestRecipes(form: FormData) {
    setRecipes([])
    setLoading(true)
    try {
      const res = await fetch("/api/recipes", { method: "POST", body: form })
      const data = await res.json()
      setRecipes((data.recipes || []) as Recipe[])
    } finally {
      setLoading(false)
    }
  }

  async function handleImageSelected(file: File) {
    const form = new FormData()
    form.append("image", file)
    await requestRecipes(form)
  }

  async function handleManualSubmit(text: string) {
    const form = new FormData()
    form.append("text", text)
    await requestRecipes(form)
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
          Что приготовить?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Загрузите фото или введите продукты вручную — покажем 3 идеи.
        </p>

        <div className="mt-8">
          <UploadZone onFileSelected={handleImageSelected} />
          <ManualInput onSubmit={handleManualSubmit} />
        </div>

        {loading && (
          <div className="mt-8">
            <Progress value={progress} />
            <p className="mt-2 text-sm text-muted-foreground">Ищем рецепты…</p>
          </div>
        )}

        {!loading && recipes.length > 0 && (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
