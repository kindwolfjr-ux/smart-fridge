import { useCallback, useRef, useState } from "react";

type Variant = "basic" | "creative" | "upgrade" | "fast";
type StartArgs = { products: string[]; variant?: Variant };

export function useStreamedRecipe() {
  const [isRunning, setIsRunning] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setText("");
    setError(null);
  }, []);

  const start = useCallback(async ({ products, variant = "basic" }: StartArgs) => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    setText("");
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/recipes/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products, variant }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split("\n")) {
          const s = line.trim();
          if (!s) continue;
          try {
            const obj = JSON.parse(s) as { delta?: string; done?: boolean; fullText?: string };
            if (obj.delta) setText((prev) => prev + obj.delta);
          } catch {}
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "stream failed");
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [isRunning]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isRunning, text, error, start, cancel, reset };
}
