'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  /** необязательно: если родителю нужно узнать про выбранный файл */
  onFileSelected?: (file: File) => void | Promise<void>;
};

export default function UploadZone({ onFileSelected }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // уведомим родителя, если он чего-то ждёт от выбора файла
    try { await onFileSelected?.(file); } catch {}

    // превью
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result); // data:image/jpeg;base64,...
      setPreview(dataUrl);

      // скан через /api/scan с base64
      setLoading(true);
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl }),
        });
        const data = await res.json();

        if (Array.isArray(data?.products) && data.products.length) {
          sessionStorage.setItem('lastScanItems', JSON.stringify(data.products));
          router.push('/confirm');
        } else {
          alert('Не удалось распознать продукты. Добавь вручную или выбери другое фото.');
        }
      } catch (err) {
        console.error(err);
        alert('Ошибка при сканировании.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-2xl border border-dashed p-6 text-center">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-black px-4 py-2 text-white hover:bg-black/90">
        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {loading ? 'Сканируем…' : 'Загрузить фото'}
      </label>

      {preview && (
        <div className="mt-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="max-h-56 rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
