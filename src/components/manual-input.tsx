"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function ManualInput({
  onSubmit,
}: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("")

  function handleSubmit() {
    const clean = text.trim()
    if (!clean) return
    onSubmit(clean)
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Например: яйца, молоко, сыр"
        className="max-w-xl"
      />
      <Button onClick={handleSubmit}>Найти рецепты</Button>
      <p className="text-xs text-muted-foreground">
        Введите продукты через запятую и нажмите Enter или кнопку
      </p>
    </div>
  )
}
