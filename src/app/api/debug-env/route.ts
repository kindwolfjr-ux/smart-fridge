import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasKvUrl: !!process.env.KV_REST_API_URL,
    hasKvToken: !!process.env.KV_REST_API_TOKEN,
    mockRecipes: process.env.MOCK_RECIPES ?? null,
    nodeEnv: process.env.NODE_ENV,
  });
}
