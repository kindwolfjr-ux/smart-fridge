"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function UploadZone({
  onFileSelected,
}: { onFileSelected: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function openPicker() {
    inputRef.current?.click()
  }

  function handleFile(file?: File) {
    if (!file) return
    // простая валидация
    if (!file.type.startsWith("image/")) return
    if (file.size > 8 * 1024 * 1024) return // >8MB не берём
    setPreview(URL.createObjectURL(file))
    onFileSelected(file)
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0])
    e.currentTarget.value = "" // чтобы можно было выбрать тот же файл повторно
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFile(e.dataTransfer.files?.[0])
      }}
      className={cn(
        "rounded-2xl border-2 border-dashed p-8 md:p-12 transition",
        dragOver ? "border-black bg-gray-50" : "border-gray-300"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
      <div className="flex flex-col items-center gap-4">
        {preview ? (
          <Image
            src={preview}
            alt="preview"
            width={320}
            height={224}
            unoptimized
            className="max-h-56 rounded-xl object-cover"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Перетащи фото сюда или нажми кнопку
          </p>
        )}
        <Button onClick={openPicker}>Загрузить фото</Button>
      </div>
    </div>
  )
}
