// src/app/api/scan/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

// Если были проблемы на edge, можно закомментировать следующую строку:
// export const runtime = "edge";

function norm(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ").replace(/ё/g, "е");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { imageUrl, imageBase64 } = body as {
      imageUrl?: string;      // публичная ссылка на картинку
      imageBase64?: string;   // data URL: data:image/...;base64,AAA...
    };

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
            { type: "image_url", image_url: { url: image } as any },
          ],
        },
      ],
    });

    const text = resp.choices?.[0]?.message?.content || "{}";

    // Пытаемся распарсить строго; если модель подсунула лишнее — вырежем { ... }
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    let products: string[] = Array.isArray(parsed?.products) ? parsed.products : [];

    // Нормализация + дедуп
    const seen = new Set<string>();
    products = products
      .map((s) => norm(String(s)))
      .filter((s) => s && !seen.has(s) && (seen.add(s), true));

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
