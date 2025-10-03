export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </div>
    </div>
  )
}
