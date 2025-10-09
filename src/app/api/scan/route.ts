// src/app/api/scan/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

// export const runtime = "edge";

function norm(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ").replace(/ё/g, "е");
}

type ScanRequestBody = {
  imageUrl?: string;
  imageBase64?: string; // data URL
};

type ScanModelResponse = {
  products?: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as unknown;

    const { imageUrl, imageBase64 } =
      body && typeof body === "object" ? (body as ScanRequestBody) : ({} as ScanRequestBody);

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ ok: false, error: "Нет изображения" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const systemPrompt =
      "Ты определяешь продукты питания на фото холодильника/стола. " +
      "Верни СТРОГО валидный JSON без пояснений в формате: " +
      '{ "products": ["яблоко","молоко"] } ' +
      "Только реальные продукты, общие названия, нижний регистр, без брендов. " +
      "Если сомневаешься — не добавляй предмет.";

    // Готовим изображение для vision
    const image = imageBase64 ? imageBase64 : (imageUrl as string);

const resp = await client.chat.completions.create({
  model: "gpt-4o-mini",
  temperature: 0.1,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: "Определи продукты на фото и верни JSON как указано выше." },
        { type: "image_url", image_url: { url: image } },
      ] satisfies OpenAI.ChatCompletionContentPart[],
    },
  ],
});


    const text = resp.choices?.[0]?.message?.content || "{}";

    // Пытаемся распарсить строго; если модель подсунула лишнее — вырежем { ... }
    let parsed: ScanModelResponse | null = null;
    try {
      parsed = JSON.parse(text) as ScanModelResponse;
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? (JSON.parse(m[0]) as ScanModelResponse) : null;
    }

    // Извлекаем продукты
    const productsRaw: unknown = parsed?.products;

    const rawProducts: string[] = Array.isArray(productsRaw)
      ? productsRaw.map((p) => String(p))
      : [];

    // Нормализация + дедуп с сохранением порядка
    const products: string[] = Array.from(
      new Set(
        rawProducts
          .map((s) => norm(s))
          .filter((s) => s.length > 0)
      )
    );

    if (!products.length) {
      throw new Error("empty_products");
    }

    return NextResponse.json({ ok: true, products });
  } catch (err) {
    console.error("scan error:", err);
    return NextResponse.json(
      { ok: false, error: "Не удалось распознать продукты. Добавь вручную или выбери другое фото." },
      { status: 422 }
    );
  }
}
